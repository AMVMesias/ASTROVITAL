"""Adaptador del portátil; no calcula biometría ni sustituye el firmware.

serial: CSV original a 230400, instantánea de pulso a 1 Hz como máximo.
ble: contrato JSON v1 terminado en LF; admite fragmentación de notificaciones.
La cola local conserva payload/fecha/ID tras fallo o reinicio. No almacena tokens.
"""
import asyncio
from collections import deque
import datetime as dt
import json
import math
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


async def connected_bluez_device(address):
    """BlueZ puede conservar una conexión aunque la placa ya no anuncie."""
    from bleak.backends.device import BLEDevice
    from dbus_fast import BusType, Message, MessageType
    from dbus_fast.aio import MessageBus

    bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
    try:
        reply = await bus.call(Message(destination="org.bluez", path="/",
            interface="org.freedesktop.DBus.ObjectManager", member="GetManagedObjects"))
        if reply.message_type == MessageType.ERROR:
            raise OSError("No se pudo consultar BlueZ")
        for path, interfaces in reply.body[0].items():
            variants = interfaces.get("org.bluez.Device1", {})
            props = {key: value.value for key, value in variants.items()}
            if str(props.get("Address", "")).lower() == address.lower() and props.get("Connected"):
                return BLEDevice(address, props.get("Name"), {"path": path, "props": props})
        return None
    finally:
        bus.disconnect()
        await bus.wait_for_disconnect()


async def find_ble_device(address, scanner):
    if sys.platform == "linux":
        connected = await connected_bluez_device(address)
        if connected is not None:
            return connected
    peripheral = await scanner.find_device_by_address(address, timeout=10)
    if peripheral is None:
        raise LookupError("BLE no descubierto")
    return peripheral


def ble_error_message(error):
    # Solo diagnósticos de transporte: no registrar tramas, credenciales ni errores HTTP.
    if isinstance(error, LookupError):
        return "BLE no descubierto: comprueba alimentación, dirección y publicidad de la placa."
    if isinstance(error, PermissionError):
        return "BLE sin permiso para acceder a Bluetooth/D-Bus."
    if isinstance(error, OSError):
        number = getattr(error, "errno", None)
        suffix = f" (errno={number})" if number is not None else ""
        return "BLE: fallo del sistema Bluetooth/D-Bus" + suffix + "; comprueba bluetoothctl show."
    return "BLE no disponible: " + type(error).__name__ + "; comprueba servicio y característica de notificación."


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def utc(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z", value):
        raise ValueError("Fecha UTC inválida")
    stamp = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp > dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=60):
        raise ValueError("Fecha futura")
    return stamp.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Frames:
    def __init__(self):
        self.buffer = bytearray()

    def feed(self, chunk):
        self.buffer.extend(chunk)
        if len(self.buffer) > 16384:
            self.buffer.clear()
            raise ValueError("Paquete demasiado grande")
        lines = []
        while b"\n" in self.buffer:
            line, _, rest = self.buffer.partition(b"\n")
            self.buffer = bytearray(rest)
            lines.append(line.decode("utf-8").strip())
        return lines


def payload(status, bpm, observed_at, reading_id, clock):
    if status != "valid":
        if status not in {"no_contact", "no_signal", "insufficient", "disconnected"}:
            raise ValueError("Estado desconocido")
        return "/api/v1/devices/status", {"status": status, "observedAt": observed_at}
    if isinstance(bpm, bool) or not isinstance(bpm, (int, float)) or not math.isfinite(bpm) or not 1 <= bpm <= 300:
        raise ValueError("Pulso inválido")
    return "/api/v1/measurements", {"readingId": reading_id, "indicator": "heart_rate", "value": bpm,
        "unit": "bpm", "capturedAt": observed_at, "activity": os.environ.get("BRIDGE_ACTIVITY", "rest"), "note": "AD8232; clock=" + clock}


def decode_ble(line, device_id, received_at):
    packet = json.loads(line)
    if not isinstance(packet, dict) or (type(packet.get("v")) is not int or packet.get("v") != 1) or packet.get("deviceId") != device_id:
        raise ValueError("Versión o dispositivo incompatibles")
    boot, seq = packet.get("bootId"), packet.get("sequence")
    if not isinstance(boot, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", boot):
        raise ValueError("Falta bootId")
    if type(seq) is not int or not 0 <= seq <= 9007199254740991:
        raise ValueError("Secuencia inválida")
    captured = packet.get("capturedAt")
    observed_at = utc(captured) if captured is not None else received_at
    # Sin reloj UTC del firmware, solo se registra recepción en vivo identificada.
    route, body = payload(packet.get("quality"), packet.get("bpm"), observed_at,
                          f"{boot}:{seq}", "firmware_utc" if captured else "host_received")
    return f"{boot}:{seq}", route, body


def decode_serial(line, received_at, reading_id, columns_expected=10):
    columns = line.split(",")
    if len(columns) != columns_expected:
        raise ValueError("Cantidad de columnas CSV incompatible")
    values = [float(value) for value in columns]
    if not all(math.isfinite(value) for value in values):
        raise ValueError("CSV no finito")
    state, bpm = values[2], values[1]
    if state not in {0, 50, 100}:
        raise ValueError("Estado ECG desconocido")
    status = "no_contact" if state == 0 else "no_signal" if state == 50 else "valid" if bpm > 0 else "insufficient"
    return payload(status, bpm, received_at, reading_id, "host_received_csv_snapshot")


def decode_telemetry(line, received_at, reading_id):
    names = ("ecg", "bpm_ecg", "estado_ecg_x50", "resp_mg", "rpm", "estado_resp_x50",
             "spo2", "bpm_oxi", "estado_oxi_x50", "ir", "rojo")
    columns = line.split(",")
    if len(columns) != 11:
        raise ValueError("Se requieren once columnas")
    values = [float(value) for value in columns]
    if not all(math.isfinite(value) and abs(value) <= 1e9 for value in values):
        raise ValueError("Telemetría no finita o fuera de rango")
    if values[2] not in (0,50,100) or values[5] not in (0,50,100) or values[8] not in (0,50,100,150,200):
        raise ValueError("Estado de sensor desconocido")
    return {"readingId":reading_id,"capturedAt":received_at,"fields":dict(zip(names,values))}


def csv_invalid_reason(line):
    columns = line.split(",")
    if len(columns) != 11:
        return "columns_" + str(len(columns)) + "_expected_11"
    try:
        values = [float(value) for value in columns]
    except ValueError:
        return "non_numeric"
    if not all(math.isfinite(value) for value in values):
        return "non_finite"
    if values[2] not in {0, 50, 100}:
        return "ecg_state_not_0_50_100"
    return "bpm_out_of_range"


class NotificationPairError(ValueError):
    pass


class NotificationCopies:
    """Modo explícito para enlaces que duplican cada fragmento; valida cada pareja."""
    def __init__(self, copies=1):
        if copies not in (1, 2):
            raise ValueError("BLE_NOTIFICATION_COPIES debe ser 1 o 2")
        self.copies, self.pending, self.removed = copies, None, 0

    def feed(self, chunk):
        chunk = bytes(chunk)
        if self.copies == 1:
            return chunk
        if self.pending is None:
            self.pending = chunk
            return None
        previous, self.pending = self.pending, None
        if previous != chunk:
            raise NotificationPairError("Pareja de notificaciones distinta; revisa BLE_NOTIFICATION_COPIES")
        self.removed += 1
        return chunk


class CsvInspection:
    """Conteos y última trama válida, solo diagnóstico local; antes del muestreo."""
    def __init__(self, copies=1):
        self.notifications = NotificationCopies(copies)
        self.frames = Frames()
        self.invalid_reasons = {}
        self.last_sample = None
        self.recent_notifications = deque(maxlen=6)
        self.last_invalid_csv = None
        self.counts = {"complete": 0, "invalid": 0, "valid_bpm": 0,
                       "no_contact": 0, "no_signal": 0, "insufficient": 0}

    def feed(self, chunk):
        self.recent_notifications.append(bytes(chunk[:192]).decode("utf-8", errors="replace"))
        try:
            chunk = self.notifications.feed(chunk)
            if chunk is None:
                return
            lines = self.frames.feed(chunk)
        except (ValueError, UnicodeError) as error:
            self.counts["invalid"] += 1
            self.frames.buffer.clear()
            reason = "notification_copy_mismatch_check_BLE_NOTIFICATION_COPIES" if isinstance(error, NotificationPairError) else "framing_or_utf8"
            self.invalid_reasons[reason] = self.invalid_reasons.get(reason, 0) + 1
            return
        for line in lines:
            if not line:
                continue
            self.counts["complete"] += 1
            try:
                route, body = decode_serial(line, utc_now(), "inspection", 11)
                key = "valid_bpm" if route == "/api/v1/measurements" else body["status"]
                self.counts[key] += 1
                names = ("ecg", "bpm_ecg", "estado_ecg_x50", "resp_mg", "rpm",
                         "estado_resp_x50", "spo2", "bpm_oxi", "estado_oxi_x50", "ir", "rojo")
                self.last_sample = {"receivedAt": utc_now(), "csv": line,
                    "fields": dict(zip(names, (float(value) for value in line.split(",")))),
                    "ecg_status": "valid" if key == "valid_bpm" else key}
            except (ValueError, TypeError):
                self.counts["invalid"] += 1
                self.last_invalid_csv = line[:384]
                reason = csv_invalid_reason(line)
                self.invalid_reasons[reason] = self.invalid_reasons.get(reason, 0) + 1

    def summary(self):
        return {**self.counts, "partial_bytes": len(self.frames.buffer), "invalid_reasons": dict(self.invalid_reasons), "last_sample": self.last_sample, "last_invalid_csv": self.last_invalid_csv,
                "recent_notifications": list(self.recent_notifications), "duplicate_fragments_removed": self.notifications.removed}


async def inspect_ble():
    """Observación acotada: no abre la cola ni envía eventos a la API."""
    from bleak import BleakClient, BleakScanner
    address, service, characteristic = [os.environ.get(key) for key in
        ("BLE_ADDRESS", "BLE_SERVICE_UUID", "BLE_CHARACTERISTIC_UUID")]
    if not all((address, service, characteristic)):
        raise ValueError("Configura dirección y UUID BLE confirmados por firmware")
    uuid.UUID(service)
    uuid.UUID(characteristic)
    if os.environ.get("BLE_FORMAT", "json-v1") != "csv-11":
        raise ValueError("La inspección del firmware ASTROVITAL requiere BLE_FORMAT=csv-11")
    duration = float(os.environ.get("BRIDGE_INSPECT_SECONDS", "20"))
    if not math.isfinite(duration) or not 1 <= duration <= 60:
        raise ValueError("BRIDGE_INSPECT_SECONDS debe estar entre 1 y 60")
    inspection = CsvInspection(int(os.environ.get("BLE_NOTIFICATION_COPIES", "1")))
    try:
        peripheral = await find_ble_device(address, BleakScanner)
        async with BleakClient(peripheral, services=[service]) as client:
            await client.start_notify(characteristic, lambda _sender, chunk: inspection.feed(chunk))
            print("Inspección BLE activa; no se guardan ni envían mediciones.", flush=True)
            elapsed = 0.0
            while elapsed < duration and client.is_connected:
                step = min(5, duration - elapsed)
                await asyncio.sleep(step)
                elapsed += step
                print(json.dumps(inspection.summary()), flush=True)
            await client.stop_notify(characteristic)
    except Exception as error:
        print(ble_error_message(error), file=sys.stderr)
        print(json.dumps(inspection.summary()), flush=True)
        raise ValueError("Inspección no completada; revisa alimentación y publicidad BLE") from None


class Spool:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(path)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("""CREATE TABLE IF NOT EXISTS bridge_outbox(
            device_id TEXT NOT NULL, event_id TEXT NOT NULL, route TEXT NOT NULL, body TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, reason TEXT,
            PRIMARY KEY(device_id,event_id))""")
        self.db.commit()

    def put(self, device, event_id, route, body):
        encoded = json.dumps(body, sort_keys=True, separators=(",", ":"), allow_nan=False)
        with self.db:
            old = self.db.execute("SELECT route,body FROM bridge_outbox WHERE device_id=? AND event_id=?", (device, event_id)).fetchone()
            if old:
                if old != (route, encoded):
                    raise ValueError("ID repetido con otro contenido; evento rechazado")
                return
            self.db.execute("INSERT INTO bridge_outbox(device_id,event_id,route,body) VALUES(?,?,?,?)", (device, event_id, route, encoded))

    def observed_at(self, device, event_id):
        row = self.db.execute("SELECT body FROM bridge_outbox WHERE device_id=? AND event_id=?", (device, event_id)).fetchone()
        if row:
            body = json.loads(row[0])
            return body.get("capturedAt", body.get("observedAt"))
        return None

    def flush(self, root, device, token, send=None):
        send = send or post
        rows = self.db.execute("SELECT event_id,route,body FROM bridge_outbox WHERE device_id=? AND state='pending' ORDER BY rowid LIMIT 100", (device,)).fetchall()
        for event_id, route, encoded in rows:
            with self.db:
                self.db.execute("UPDATE bridge_outbox SET attempts=attempts+1 WHERE device_id=? AND event_id=?", (device, event_id))
            try:
                status, result = send(root + route, device, token, encoded)
            except (OSError, TimeoutError, ValueError):
                break  # caída HTTP: conservar payload/fecha/ID sin regenerarlos
            if not isinstance(result, dict):
                break
            if status in {200, 201}:
                valid = result.get("status") == "recorded" if route.endswith("/status") else isinstance(result.get("measurement"), dict) and result["measurement"].get("readingId") == json.loads(encoded)["readingId"]
                if route.endswith("/telemetry"):
                    valid = result.get("status") == "recorded" and result.get("readingId") == json.loads(encoded)["readingId"]
                if not valid:
                    break
                state, reason = "confirmed", None
            elif status in {408, 425, 429} or status >= 500:
                break
            else:
                state, reason = "rejected", str(result.get("error", {}).get("code", f"HTTP_{status}"))[:100]
            with self.db:
                self.db.execute("UPDATE bridge_outbox SET state=?,reason=? WHERE device_id=? AND event_id=?", (state, reason, device, event_id))

    def retry(self, device):
        with self.db:
            self.db.execute("UPDATE bridge_outbox SET state='pending',reason=NULL WHERE device_id=? AND state='rejected'", (device,))

    def close(self):
        self.db.close()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("El puente no reenvía credenciales mediante redirecciones")


def post(url, device, token, body):
    request = urllib.request.Request(url, data=body.encode(), headers={"Content-Type": "application/json", "X-Device-Id": device, "Authorization": "Bearer " + token}, method="POST")
    try:
        response = urllib.request.build_opener(NoRedirect).open(request, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.loads(response.read(65536))


async def run(mode):
    if mode == "inspect":
        await inspect_ble()
        return
    device, token = os.environ.get("DEVICE_ID", ""), os.environ.get("DEVICE_TOKEN", "")
    root = os.environ.get("BRIDGE_API_URL", "http://localhost:3001").rstrip("/")
    target = urllib.parse.urlparse(root)
    if not device or len(token) < 32:
        raise ValueError("Configura DEVICE_ID y DEVICE_TOKEN aprovisionados")
    if target.scheme not in {"http", "https"} or not target.hostname or target.username or target.password or target.path or target.query or target.fragment:
        raise ValueError("BRIDGE_API_URL debe ser un origen HTTP(S)")
    if target.scheme == "http" and target.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("El puente HTTP debe apuntar al mismo portátil; usa HTTPS para un equipo remoto")
    if os.environ.get("BRIDGE_ACTIVITY", "rest") not in {"rest", "exercise", "eva"}:
        raise ValueError("BRIDGE_ACTIVITY inválida")
    ble_format = os.environ.get("BLE_FORMAT", "json-v1")
    if ble_format not in {"json-v1", "csv-11"}:
        raise ValueError("BLE_FORMAT debe ser json-v1 o csv-11")
    spool = Spool(os.environ.get("BRIDGE_SPOOL_PATH", "data/local/bridge.sqlite"))
    period = float(os.environ.get("BRIDGE_SAMPLE_SECONDS", "1"))
    if not math.isfinite(period) or period < 1:
        raise ValueError("BRIDGE_SAMPLE_SECONDS debe ser al menos 1")
    if mode in {"flush", "retry", "status"}:
        if mode == "retry":
            spool.retry(device)
        if mode != "status":
            spool.flush(root, device, token)
        counts = dict(spool.db.execute("SELECT state,COUNT(*) FROM bridge_outbox WHERE device_id=? GROUP BY state", (device,)).fetchall())
        rejections = spool.db.execute("SELECT event_id,reason FROM bridge_outbox WHERE device_id=? AND state='rejected' ORDER BY rowid DESC LIMIT 50", (device,)).fetchall()
        print(json.dumps({"counts": counts, "rejections": rejections}))
        spool.close()
        return
    stopping = asyncio.Event()
    async def sender():
        while not stopping.is_set():
            # Conexión propia en el hilo: lectura serial/BLE no se bloquea por HTTP.
            def deliver():
                own = Spool(os.environ.get("BRIDGE_SPOOL_PATH", "data/local/bridge.sqlite"))
                try:
                    own.flush(root, device, token)
                finally:
                    own.close()
            await asyncio.to_thread(deliver)
            await asyncio.sleep(2)
    worker = asyncio.create_task(sender())
    notifications = NotificationCopies(int(os.environ.get("BLE_NOTIFICATION_COPIES", "1")))
    frames, host_boot, sequence, last_sample = Frames(), uuid.uuid4().hex, 0, 0.0
    def accept(chunk, transport):
        nonlocal sequence, last_sample
        try:
            if transport == "ble":
                chunk = notifications.feed(chunk)
                if chunk is None:
                    return
            lines = frames.feed(chunk)
        except (ValueError, UnicodeError):
            frames.buffer.clear()
            print("Trama descartada: tamaño o codificación inválida", file=sys.stderr)
            return
        for line in lines:
            if not line:
                continue
            try:
                received = utc_now()
                if transport == "serial" or ble_format == "csv-11":
                    if time.monotonic() - last_sample < period:
                        continue
                    sequence += 1
                    event_id = f"host-{host_boot}:{sequence}"
                    if transport == "ble":
                        telemetry = decode_telemetry(line, received, event_id)
                        spool.put(device, event_id + ":telemetry", "/api/v1/devices/telemetry", telemetry)
                        last_sample = time.monotonic()
                    route, body = decode_serial(line, received, event_id, 10 if transport == "serial" else 11)
                    last_sample = time.monotonic()
                else:
                    event_id, route, body = decode_ble(line, device, received)
                    original_time = spool.observed_at(device, event_id)
                    if original_time:
                        event_id, route, body = decode_ble(line, device, original_time)
                spool.put(device, event_id, route, body)
            except (ValueError, UnicodeError, TypeError):
                print("Trama descartada: revisa BLE_FORMAT, columnas, estados y DEVICE_ID; o ID repetido con otro contenido", file=sys.stderr)
    try:
        if mode == "serial":
            import serial  # dependencia opcional, solo en el portátil que captura
            port = os.environ.get("SERIAL_PORT")
            if not port:
                raise ValueError("Configura SERIAL_PORT; el sketch usa 230400 baudios")
            while True:
                try:
                    with serial.Serial(port, 230400, timeout=1) as connection:
                        frames.buffer.clear()
                        print("Puerto serial conectado; solo pulso AD8232 y estados")
                        while True:
                            chunk = await asyncio.to_thread(connection.read, max(1, min(connection.in_waiting, 4096)))
                            if chunk:
                                accept(chunk, "serial")
                except (serial.SerialException, OSError):
                    spool.put(device, uuid.uuid4().hex, "/api/v1/devices/status", {"status": "disconnected", "observedAt": utc_now()})
                    print("Serial desconectado; reconexión en 3 s", file=sys.stderr)
                    await asyncio.sleep(3)
        elif mode == "ble":
            from bleak import BleakClient, BleakScanner
            address, service, characteristic = [os.environ.get(key) for key in ("BLE_ADDRESS", "BLE_SERVICE_UUID", "BLE_CHARACTERISTIC_UUID")]
            if not all((address, service, characteristic)):
                raise ValueError("Configura dirección y UUID BLE confirmados por firmware")
            uuid.UUID(service)
            uuid.UUID(characteristic)
            while True:
                try:
                    peripheral = await find_ble_device(address, BleakScanner)
                    async with BleakClient(peripheral, services=[service]) as client:
                        frames.buffer.clear()
                        notifications.pending = None
                        await client.start_notify(characteristic, lambda _sender, chunk: accept(chunk, "ble"))
                        print("BLE conectado; formato " + ble_format)
                        while client.is_connected:
                            await asyncio.sleep(1)
                except Exception as error:
                    # Nunca registrar excepciones de HTTP que pudieran incluir credenciales.
                    print(ble_error_message(error), file=sys.stderr)
                spool.put(device, uuid.uuid4().hex, "/api/v1/devices/status", {"status": "disconnected", "observedAt": utc_now()})
                await asyncio.sleep(3)
        else:
            raise ValueError("Modos: serial, ble, flush, retry, status")
    finally:
        stopping.set()
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        spool.close()


if __name__ == "__main__":
    try:
        asyncio.run(run(sys.argv[1] if len(sys.argv) > 1 else "serial"))
    except KeyboardInterrupt:
        pass
    except (ValueError, ImportError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
