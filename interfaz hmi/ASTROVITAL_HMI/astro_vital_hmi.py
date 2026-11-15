"""ASTROVITAL USB — ESP32 AD8232 + MPU6050 + MAX30102.
Python 3.9+, Tkinter y pyserial. Ejecutar: python astro_vital_hmi.py
"""
import csv
import math
import queue
import threading
import time
from collections import deque
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    serial = None
    list_ports = None

BG = '#0a1220'
PANEL = '#111e30'
TEXT = '#e7eef8'
MUTED = '#8fa6c1'
GREEN = '#51dfb0'
BLUE = '#66bdff'
AMBER = '#ffca75'
FIELDS = ['ecg', 'bpm_ecg', 'estado_ecg_x50', 'resp_mg', 'rpm',
          'estado_resp_x50', 'spo2', 'bpm_oxi', 'estado_oxi_x50', 'ir', 'rojo']


def parse_line(line):
    """Contrato CSV del firmware: exactamente 11 numeros finitos y estados x50."""
    parts = line.strip().split(',')
    if len(parts) != 11:
        raise ValueError('Se esperaban 11 columnas')
    values = tuple(float(p) for p in parts)
    if not all(math.isfinite(x) for x in values):
        raise ValueError('Dato no finito')
    if values[2] not in (0, 50, 100) or values[5] not in (0, 50, 100):
        raise ValueError('Estado ECG/respiracion no valido')
    if values[8] not in (0, 50, 100, 150, 200):
        raise ValueError('Estado oximetro no valido')
    if not 0 <= values[6] <= 100 or any(values[i] < 0 for i in (1, 4, 7, 9, 10)):
        raise ValueError('Valores fuera del contrato CSV')
    return values


class SerialReader(threading.Thread):
    def __init__(self, port, events, stop):
        super().__init__(daemon=True)
        self.port, self.events, self.stop = port, events, stop

    def emit(self, kind, data):
        try:
            self.events.put_nowait((kind, data))
        except queue.Full:
            # Una interfaz detenida no debe consumir memoria sin limite.
            try:
                self.events.get_nowait()
            except queue.Empty:
                pass
            try:
                self.events.put_nowait((kind, data))
            except queue.Full:
                pass

    def run(self):
        try:
            with serial.Serial(self.port, 115200, timeout=0.15) as stream:
                stream.reset_input_buffer()
                self.emit('open', self.port)
                pending = bytearray()
                while not self.stop.is_set():
                    chunk = stream.read(min(max(stream.in_waiting, 1), 4096))
                    pending.extend(chunk)
                    while b'\n' in pending:
                        raw, _, pending = pending.partition(b'\n')
                        try:
                            values = parse_line(raw.decode('ascii'))
                        except (ValueError, UnicodeDecodeError):
                            self.emit('invalid', raw[:120].decode('ascii', errors='replace'))
                            continue
                        self.emit('sample', (time.monotonic(), datetime.now().isoformat(timespec='milliseconds'), values))
                    if len(pending) > 8192:
                        pending.clear()
                        self.emit('invalid', 'Trama sin salto de linea')
        except Exception as exc:
            if not self.stop.is_set():
                self.emit('error', str(exc))


class Trace(tk.Canvas):
    def __init__(self, parent, title, unit, color, index):
        super().__init__(parent, bg=PANEL, highlightthickness=0, height=155)
        self.title, self.unit, self.color, self.index = title, unit, color, index

    def draw(self, records, now, seconds, live):
        self.delete('all')
        w, h = max(300, self.winfo_width()), max(120, self.winfo_height())
        left, right, top, bottom = 68, w - 22, 42, h - 28
        self.create_text(18, 19, text=self.title, fill=TEXT, anchor='w', font=('Segoe UI', 11, 'bold'))
        self.create_text(right, 19, text=self.unit, fill=MUTED, anchor='e', font=('Segoe UI', 9))
        valid = lambda v: (True if self.index == 0 else v[5] != 0 if self.index == 3 else v[8] >= 100)
        rows = [(r[0], r[2][self.index], valid(r[2])) for r in records if now - seconds <= r[0] <= now]
        values = [y for _, y, ok in rows if ok]
        if values:
            lo, hi = min(values), max(values)
            span = max(hi - lo, 10 if self.index == 0 else 2 if self.index == 3 else 100)
            mid = (hi + lo) / 2
            lo, hi = mid - span * .62, mid + span * .62
        else:
            lo, hi = -1, 1
        for i in range(5):
            y = top + (bottom - top) * i / 4
            self.create_line(left, y, right, y, fill='#21334b')
            self.create_text(left - 8, y, text=f'{hi - (hi-lo)*i/4:.0f}', fill=MUTED,
                             anchor='e', font=('Segoe UI', 8))
        for i in range(6):
            x = left + (right - left) * i / 5
            self.create_line(x, top, x, bottom, fill='#1b2b40')
            self.create_text(x, bottom + 15, text=f'{-seconds + seconds*i/5:.0f}s', fill=MUTED,
                             font=('Segoe UI', 8))
        points = []
        previous = None
        def flush():
            if len(points) >= 4:
                self.create_line(*points, fill=self.color, width=1.6)
            points.clear()
        for stamp, value, ok in rows:
            if not ok or (previous is not None and stamp - previous > .3):
                flush()
            previous = stamp
            if ok:
                points.extend((left + (stamp - (now - seconds)) / seconds * (right-left),
                               bottom - (value-lo)/(hi-lo)*(bottom-top)))
        flush()
        if not values or not live:
            self.create_text((left+right)/2, (top+bottom)/2,
                             text='Esperando señal' if not values else 'Sin datos recientes',
                             fill=MUTED, font=('Segoe UI', 13))


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('ASTROVITAL | Monitor USB ESP32')
        self.geometry('1180x860')
        self.minsize(940, 740)
        self.configure(bg=BG)
        self.records = deque(maxlen=30000)  # Ultimos 10 minutos a 50 Hz.
        self.events = queue.Queue(maxsize=6000)
        self.stop_event = threading.Event()
        self.worker = None
        self.mode = 'off'
        self.session_demo = False
        self.last_sample = 0
        self.started = time.monotonic()
        self.invalid_count = 0
        self.count = 0
        self.demo_next = 0
        self.port = tk.StringVar()
        self.window_seconds = tk.StringVar(value='10')
        self.connection = tk.StringVar(value='DESCONECTADO · selecciona el puerto del ESP32')
        self.detail = tk.StringVar(value='Firmware con MODO_DEBUG = 0 · 115200 baudios · 11 columnas CSV')
        self.sensor_states = [tk.StringVar(value='Sin datos') for _ in range(3)]
        self.metric_vars = [tk.StringVar(value='—') for _ in range(4)]
        self.raw_var = tk.StringVar(value='IR —   /   ROJO —')
        self.build_ui()
        self.refresh_ports()
        self.protocol('WM_DELETE_WINDOW', self.close_app)
        self.after(50, self.tick)

    def label(self, parent, text=None, var=None, color=TEXT, font=('Segoe UI', 10), **kw):
        return tk.Label(parent, text=text, textvariable=var, bg=parent.cget('bg'), fg=color, font=font, **kw)

    def button(self, parent, text, command, accent=False):
        return tk.Button(parent, text=text, command=command, bg=GREEN if accent else '#24364e',
                         fg=BG if accent else TEXT, activebackground='#3c5878',
                         activeforeground=TEXT, relief='flat', bd=0, padx=14, pady=8,
                         cursor='hand2', font=('Segoe UI', 10, 'bold'))

    def build_ui(self):
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure('TCombobox', fieldbackground='#24364e', background='#24364e', foreground=TEXT)
        head = tk.Frame(self, bg=BG)
        head.pack(fill='x', padx=24, pady=(18, 12))
        self.label(head, 'ASTROVITAL', font=('Segoe UI', 23, 'bold')).pack(side='left')
        self.label(head, 'ESP32 / MONITOREO MULTISENSOR', color=MUTED).pack(side='left', padx=18, pady=(8, 0))
        bar = tk.Frame(self, bg=PANEL, padx=14, pady=12)
        bar.pack(fill='x', padx=24)
        self.label(bar, 'Puerto USB', color=MUTED).pack(side='left', padx=(0, 8))
        self.ports = ttk.Combobox(bar, textvariable=self.port, width=14)
        self.ports.pack(side='left', padx=(0, 8))
        self.button(bar, 'Actualizar', self.refresh_ports).pack(side='left', padx=4)
        self.connect_button = self.button(bar, 'Conectar', self.connect, True)
        self.connect_button.pack(side='left', padx=4)
        self.button(bar, 'Desconectar', self.disconnect).pack(side='left', padx=4)
        self.button(bar, 'Demo', self.demo).pack(side='right', padx=4)
        self.button(bar, 'Exportar CSV', self.export).pack(side='right', padx=4)
        self.label(self, var=self.connection, color=GREEN, anchor='w').pack(fill='x', padx=28, pady=(10, 8))
        metrics = tk.Frame(self, bg=BG)
        metrics.pack(fill='x', padx=24)
        for i, (title, unit, color) in enumerate([
                ('FRECUENCIA ESTIMADA · ECG', 'latidos/min', GREEN),
                ('SATURACIÓN · SpO₂', '%', BLUE),
                ('PULSO · OXÍMETRO', 'latidos/min', AMBER),
                ('FRECUENCIA RESPIRATORIA', 'respiraciones/min', BLUE)]):
            metrics.columnconfigure(i, weight=1)
            card = tk.Frame(metrics, bg=PANEL, padx=14, pady=12)
            card.grid(row=0, column=i, sticky='nsew', padx=(0 if i == 0 else 8, 0))
            self.label(card, title, color=MUTED, font=('Segoe UI', 9), anchor='w', wraplength=200, height=2, justify='left').pack(fill='x')
            self.label(card, var=self.metric_vars[i], color=color, font=('Segoe UI', 34, 'bold'), anchor='w').pack(fill='x')
            self.label(card, unit, color=MUTED, anchor='w').pack(fill='x')
        sensors = tk.Frame(self, bg=BG)
        sensors.pack(fill='x', padx=24, pady=10)
        for title, var in zip(['AD8232', 'MPU6050', 'MAX30102'], self.sensor_states):
            box = tk.Frame(sensors, bg=BG)
            box.pack(side='left', expand=True, fill='x')
            self.label(box, title + '  ', font=('Segoe UI', 9, 'bold')).pack(side='left')
            self.label(box, var=var, color=MUTED, font=('Segoe UI', 9)).pack(side='left')
        plots = tk.Frame(self, bg=BG)
        plots.pack(fill='both', expand=True, padx=24)
        self.traces = []
        for title, unit, color, index in [('Señal cardíaca aproximada', 'Filtro 0.7–8 Hz · escala automática', GREEN, 0),
                                         ('Respiración / movimiento del tórax', 'mg · escala automática', BLUE, 3),
                                         ('Señal óptica infrarroja', 'IR crudo · escala automática', AMBER, 9)]:
            trace = Trace(plots, title, unit, color, index)
            trace.pack(fill='both', expand=True, pady=(0, 7))
            self.traces.append(trace)
        foot = tk.Frame(self, bg=BG)
        foot.pack(fill='x', padx=24, pady=(2, 6))
        self.label(foot, var=self.raw_var, color=MUTED, font=('Segoe UI', 9)).pack(side='left')
        self.label(foot, 'Ventana: ', color=MUTED).pack(side='right')
        ttk.Combobox(foot, textvariable=self.window_seconds, values=['5', '10', '20', '30'],
                     width=4, state='readonly').pack(side='right', padx=8)
        self.label(self, var=self.detail, color=MUTED, font=('Segoe UI', 9), anchor='w').pack(fill='x', padx=24)
        self.label(self, 'Prototipo educativo · No destinado a diagnóstico clínico', color=MUTED,
                   font=('Segoe UI', 8), anchor='w').pack(fill='x', padx=24, pady=(4, 12))

    def refresh_ports(self):
        try:
            ports = sorted(p.device for p in list_ports.comports()) if list_ports else []
            self.ports['values'] = ports
            if ports and self.port.get() not in ports:
                self.port.set(ports[0])
        except Exception as exc:
            messagebox.showerror('Puertos USB', str(exc))

    def clear_session(self):
        self.records.clear()
        self.last_sample = 0
        self.count = self.invalid_count = 0
        self.started = time.monotonic()
        self.clear_values()

    def clear_values(self):
        for var in self.metric_vars:
            var.set('—')
        for var in self.sensor_states:
            var.set('Sin datos')
        self.raw_var.set('IR —   /   ROJO —')

    def connect(self):
        if self.mode == 'usb':
            return
        if serial is None:
            messagebox.showerror('Falta pyserial', 'Instala la dependencia:\n\npython -m pip install pyserial\n\nDespués vuelve a abrir el HMI.')
            return
        port = self.port.get().strip()
        if not port:
            messagebox.showinfo('Puerto USB', 'Conecta el ESP32 y selecciona su puerto COM. También puedes escribirlo.')
            return
        self.disconnect()
        if not self.confirm_clear():
            return
        self.clear_session()
        self.mode = 'usb'
        self.session_demo = False
        self.events = queue.Queue(maxsize=6000)
        self.stop_event = threading.Event()
        self.worker = SerialReader(port, self.events, self.stop_event)
        self.worker.start()
        self.connection.set('CONECTANDO · ' + port)
        self.detail.set('Esperando datos CSV. El ESP32 puede reiniciarse al abrir el puerto USB.')

    def confirm_clear(self):
        return not self.records or messagebox.askyesno('Nueva sesión',
            'La nueva sesión borrará el historial visible. ¿Continuar?\nPuedes cancelar y exportarlo primero.')

    def disconnect(self):
        self.stop_event.set()
        if self.worker is not None and self.worker.is_alive():
            self.worker.join(timeout=0.4)
        # Las colas se separan para que un hilo anterior nunca modifique otra sesión.
        self.events = queue.Queue(maxsize=6000)
        self.mode = 'off'
        self.connection.set('DESCONECTADO · historial conservado para exportar')
        self.clear_values()

    def demo(self):
        if not self.confirm_clear():
            return
        self.disconnect()
        self.clear_session()
        self.mode = 'demo'
        self.session_demo = True
        self.demo_next = time.monotonic()
        self.connection.set('DEMO · DATOS SIMULADOS · no provienen de sensores')

    def add_sample(self, record):
        self.records.append(record)
        self.last_sample = record[0]
        self.count += 1

    def show_values(self, v):
        ecg, resp, oxi = int(v[2]/50), int(v[5]/50), int(v[8]/50)
        values = [v[1] if ecg == 2 else 0, v[6] if oxi >= 3 else 0,
                  v[7] if oxi >= 2 else 0, v[4] if resp == 2 else 0]
        for var, val in zip(self.metric_vars, values):
            var.set(f'{val:.0f}' if val > 0 else '—')
        self.sensor_states[0].set(['Revisar electrodos', 'Buscando pulsos',
                                   'Latido detectado' if v[1] > 0 else 'Calculando frecuencia'][ecg])
        self.sensor_states[1].set(['No disponible', 'Sin ciclo detectado',
                                   'Ciclo detectado' if v[4] > 0 else 'Calculando frecuencia'][resp])
        self.sensor_states[2].set(['No disponible', 'Sin dedo', 'Calculando / no válido',
                                   'SpO₂ válida', 'SpO₂ y pulso válidos'][oxi])
        self.raw_var.set(f'IR {v[9]:.0f}   /   ROJO {v[10]:.0f}')

    def tick(self):
        now = time.monotonic()
        if self.mode == 'demo':
            # Ritmo simulado de 50 Hz, siempre marcado como DEMO en la pantalla y CSV.
            for _ in range(100):
                if self.demo_next > now:
                    break
                t = self.demo_next - self.started
                phase = (t * 1.2) % 1
                ecg = (600*math.exp(-((phase-.2)/.022)**2)
                       -120*math.exp(-((phase-.24)/.025)**2)
                       +65*math.exp(-((phase-.52)/.09)**2))
                v = (ecg, 72, 100, 12*math.sin(2*math.pi*t/4), 15, 100,
                     98, 72, 200, 95000+3500*math.sin(2*math.pi*t*1.2),
                     76000+1800*math.sin(2*math.pi*t*1.2))
                self.add_sample((self.demo_next, datetime.now().isoformat(timespec='milliseconds'), v))
                self.demo_next += .02
        for _ in range(1500):
            try:
                kind, payload = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == 'sample':
                self.add_sample(payload)
            elif kind == 'invalid':
                self.invalid_count += 1
            elif kind == 'open':
                self.connection.set('USB CONECTADO · ' + payload + ' · 115200 baudios')
            elif kind == 'error':
                self.disconnect()
                self.connection.set('ERROR USB · ' + payload)
                self.detail.set('Cierra el Monitor Serial / Plotter del Arduino IDE y vuelve a conectar.')
                break
        live = self.mode != 'off' and self.last_sample > 0 and now-self.last_sample <= 2
        if live:
            self.show_values(self.records[-1][2])
            source = 'DEMO / SIMULADO' if self.mode == 'demo' else 'USB / REAL'
            self.detail.set(f'{source} · {self.count} tramas recibidas · {self.invalid_count} descartadas · Historial: últimos 10 min como máximo')
        elif self.mode != 'off':
            self.clear_values()
            age = now - (self.last_sample or self.started)
            self.detail.set(f'Esperando datos · {age:.0f} s sin trama válida · Descartadas: {self.invalid_count} · Verifica MODO_DEBUG=0 y las 11 columnas')
        plot_now = now if self.mode != 'off' else (self.last_sample or now)
        for trace in self.traces:
            trace.draw(self.records, plot_now, float(self.window_seconds.get()), live)
        self.after(50, self.tick)

    def export(self):
        if not self.records:
            messagebox.showinfo('Exportar CSV', 'Aún no hay datos para exportar.')
            return
        path = filedialog.asksaveasfilename(defaultextension='.csv', filetypes=[('CSV', '*.csv')],
                    initialfile='astrovital_' + ('DEMO_' if self.session_demo else '') + datetime.now().strftime('%Y%m%d_%H%M%S') + '.csv')
        if not path:
            return
        try:
            with open(path, 'w', newline='', encoding='utf-8-sig') as stream:
                writer = csv.writer(stream)
                writer.writerow(['origen', 'fecha_hora_pc', 'tiempo_s'] + FIELDS)
                origin = 'SIMULADO' if getattr(self, 'session_demo', False) else 'USB'
                first = self.records[0][0]
                for stamp, date, v in self.records:
                    writer.writerow([origin, date, round(stamp-first, 4)] + list(v))
            messagebox.showinfo('Exportación completa', f'Se guardaron {len(self.records)} muestras.\n{path}')
        except OSError as exc:
            messagebox.showerror('No se pudo guardar', str(exc))

    def close_app(self):
        self.stop_event.set()
        self.destroy()


if __name__ == '__main__':
    App().mainloop()
