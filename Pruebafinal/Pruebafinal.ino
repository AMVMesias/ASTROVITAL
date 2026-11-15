// ESP32 clasico: AD8232 + MPU6050 + oximetro MAX30102
// Prototipo educativo; las estimaciones no sustituyen un oximetro clinico.
// ECG suavizado: 0.7-8 Hz + rechazo de 60 Hz, antes de transmitir al HMI.
//
// ECG: objetivo de 250 muestras/s. Serial: 50 lineas/s a 115200 baudios.
// CSV: ecg,bpm_ecg,estado_ecg*50,resp_mg,rpm,estado_resp*50,
//      spo2,bpm_oxi,estado_oxi*50,ir,rojo
// spo2 y bpm_oxi: 0 indica dato no valido, no una medicion de cero.
// estado_oxi: 0=no disponible, 1=sin dedo, 2=calculando/invalido,
//             3=SpO2 valida, 4=SpO2 y pulso validos.
// MAX30102: SDA=21, SCL=22, GND comun, alimentacion segun tu modulo.
// MPU6050 (0x68) y MAX30102 (0x57) comparten el bus I2C
// Libreria: SparkFun MAX3010x Pulse and Proximity Sensor Library.
//
// estado_ecg : 0 = electrodos sueltos, 1 = sin latido detectado, 2 = latido OK
// estado_resp: 0 = MPU6050 no detectado, 1 = sin respiración, 2 = respirando
// resp_mg    : señal de respiración en milésimas de g (inclinación del tórax)

#include <Wire.h>
#include <MAX30105.h>
#include <spo2_algorithm.h>

// ================= PINES =================
const int PIN_ECG      = 34;   // AD8232 OUTPUT (ADC1, solo entrada)
const int PIN_LO_PLUS  = 32;   // AD8232 LO+
const int PIN_LO_MINUS = 33;   // AD8232 LO-
const int PIN_SDA      = 21;   // MPU6050 SDA
const int PIN_SCL      = 22;   // MPU6050 SCL

// ================= GENERAL =================
const unsigned long PERIODO_US = 4000;   // 250 muestras/s
// 0=CSV/HMI; 1=LO+/LO-; 2=acelerometro; 3=oximetro; 4=diagnostico ECG
const int MODO_DEBUG = 0;
const unsigned long PERIODO_SERIAL_MS = 20; // 50 Hz; evita saturar 115200
unsigned long ultimoEnvio = 0;

// ================= PARÁMETROS ECG =================
const unsigned long REFRACTARIO         = 300;   // ms mínimos entre latidos
const unsigned long TIMEOUT_LATIDO      = 3000;  // ms sin latidos -> "sin latido"
const unsigned long DEBOUNCE_SUELTO_MS  = 500;
const unsigned long DEBOUNCE_CONECT_MS  = 1000;
const float AMPLITUD_MINIMA = 12.0f; // Umbral inicial sensible, en cuentas ADC.
// Despues del filtrado la amplitud es menor; ante pulsos espurios subir a 20-30.
const bool SOLO_ECG = false; // true: diagnostico sin bus I2C (no MPU ni oximetro).
bool ecgInicializado = false;
unsigned long ecgInicio = 0;
int ultimoADC = 0;

// ================= PARÁMETROS RESPIRACIÓN =================
const int MPU_ADDR = 0x68;                       // 0x69 si AD0 está a 3.3V
const int EJE_RESP = 1;                          // 0 = X, 1 = Y, 2 = Z (eje cabeza-pies)
const unsigned long PERIODO_RESP_MS = 40;        // lectura del MPU a 25 Hz
const unsigned long REFRACT_RESP    = 1000;      // ms mínimos entre respiraciones
const unsigned long TIMEOUT_RESP    = 10000;     // ms sin respirar -> "sin respiración"
const float AMPLITUD_MIN_RESP = 0.004;           // en g (4 mg); ajustar según tu señal

// ================= VARIABLES ECG =================
float lineaBase = 2048;
float senalSuave = 0;
float picoRef = 0;
bool  sobreUmbral = false;
unsigned long ultimoLatido = 0;
unsigned long intervalos[4];
int idx = 0, cuenta = 0;
float bpm = 0;
int estadoECG = 0;

// Filtros IIR causales para muestreo objetivo de 250 Hz.
// Rechazo de red a 60 Hz, pasa-altos 0.7 Hz y pasa-bajos Butterworth 8 Hz.
// Prioriza visualizar pulsos; suaviza la morfologia y añade retardo.
struct BiquadECG {
  float b0, b1, b2, a1, a2;
  float z1 = 0, z2 = 0;
  BiquadECG(float p0, float p1, float p2, float q1, float q2)
      : b0(p0), b1(p1), b2(p2), a1(q1), a2(q2) {}
  float aplicar(float x) {
    float y = b0*x + z1;
    z1 = b1*x - a1*y + z2;
    z2 = b2*x - a2*y;
    return y;
  }
  void limpiar() { z1 = z2 = 0; }
};
BiquadECG filtroRed(0.97071504441f, -0.12190340391f, 0.97071504441f, -0.12190340391f, 0.94143008882f);
BiquadECG filtroHP(0.98763698268f, -1.97527396536f, 0.98763698268f, -1.97512111532f, 0.97542681539f);
BiquadECG filtroLP1(0.00007957016f, 0.00015914033f, 0.00007957016f, -1.65445076375f, 0.68846479867f);
BiquadECG filtroLP2(1.00000000000f, 2.00000000000f, 1.00000000000f, -1.82057164120f, 0.85800097348f);

bool sueltoEstable = true;
bool cambioPendiente = false;
unsigned long inicioCambio = 0;

// ================= VARIABLES RESPIRACIÓN =================
float lp1 = 0, lp2 = 0, baseResp = 0;
float respSenal = 0;
float picoResp = 0;
bool  respArriba = false;
bool  respInit = false;
unsigned long ultimoRespiro = 0;
unsigned long ultimaLecturaResp = 0;
unsigned long intervalosR[4];
int idxR = 0, cuentaR = 0;
float rpm = 0;
int estadoResp = 0;

bool mpuOK = false;
int fallosMPU = 0;
unsigned long ultimoIntentoMPU = 0;

unsigned long ultimaMuestra = 0;

// ================= OXIMETRO MAX30102 =================
MAX30105 oximetro; // El nombre MAX30105 de la libreria tambien sirve para MAX30102.
const int N_OXI = 100;
const int PASO_OXI = 25;
const uint32_t UMBRAL_DEDO_IR = 50000; // Ajustar viendo IR en MODO_DEBUG=3.
const unsigned long PERIODO_OXI_MS = 10;
const unsigned long TIMEOUT_OXI_MS = 1500;

// Obtener el tipo real del primer parametro del algoritmo instalado.
// Evita conversiones ilegales de punteros uint32_t* a uint16_t*.
template<typename T>
T tipoMuestraOxi(void (*)(T*, int32_t, T*, int32_t*, int8_t*, int32_t*, int8_t*));
using MuestraOxi = decltype(tipoMuestraOxi(maxim_heart_rate_and_oxygen_saturation));
MuestraOxi irBuffer[N_OXI];
MuestraOxi redBuffer[N_OXI];
static_assert(sizeof(MuestraOxi) == 2 || sizeof(MuestraOxi) == 4,
              "Tipo de muestra no compatible con el algoritmo SpO2");

bool oxiOK = false;
int muestrasOxi = 0;
int32_t spo2 = 0, bpmOxi = 0;
int8_t spo2Valida = 0, pulsoOxiValido = 0;
int estadoOxi = 0;
uint32_t irOxi = 0, rojoOxi = 0;
unsigned long ultimoIntentoOxi = 0;
unsigned long ultimaConsultaOxi = 0;
unsigned long ultimaMuestraOxi = 0;

void invalidarOxi() {
  spo2 = 0;
  bpmOxi = 0;
  spo2Valida = 0;
  pulsoOxiValido = 0;
}

void reiniciarOxi() {
  muestrasOxi = 0;
  invalidarOxi();
}

bool iniciarOxi() {
  if (!oximetro.begin(Wire, I2C_SPEED_FAST)) return false;
  // Brillo=60, promedio=4, rojo+IR, ADC=100 Hz, pulso=411 us, rango=4096.
  // 100 / 4 = 25 pares/s: frecuencia esperada por el algoritmo SparkFun.
  oximetro.setup(60, 4, 2, 100, 411, 4096);
  oximetro.setPulseAmplitudeGreen(0);
  oximetro.clearFIFO();
  reiniciarOxi();
  irOxi = rojoOxi = 0;
  estadoOxi = 1;
  ultimaMuestraOxi = millis();
  return true;
}

MuestraOxi convertirOxi(uint32_t dato); // Prototipo explicito para Arduino IDE
MuestraOxi convertirOxi(uint32_t dato) {
  // Las muestras originales tienen 18 bits. Si el algoritmo exige 16 bits,
  // dividir ambos canales por 4 conserva su proporcion y evita desbordarlos.
  return static_cast<MuestraOxi>(sizeof(MuestraOxi) == 2 ? (dato >> 2) : dato);
}

void calcularOxi() {
  maxim_heart_rate_and_oxygen_saturation(
      irBuffer, N_OXI, redBuffer,
      &spo2, &spo2Valida, &bpmOxi, &pulsoOxiValido);
  // No inventar, recortar ni mantener mediciones declaradas invalidas.
  if (!spo2Valida || spo2 <= 0 || spo2 > 100) {
    spo2 = 0;
    spo2Valida = 0;
  }
  if (!pulsoOxiValido || bpmOxi <= 0) {
    bpmOxi = 0;
    pulsoOxiValido = 0;
  }
  estadoOxi = spo2Valida ? (pulsoOxiValido ? 4 : 3) : 2;
  // Ventana movil de 4 s: conservar 75 puntos y actualizar cada 1 s.
  for (int i = 0; i < N_OXI - PASO_OXI; i++) {
    irBuffer[i] = irBuffer[i + PASO_OXI];
    redBuffer[i] = redBuffer[i + PASO_OXI];
  }
  muestrasOxi = N_OXI - PASO_OXI;
}

void procesarOxi(unsigned long ahora) {
  if (!oxiOK) {
    estadoOxi = 0;
    if (ahora - ultimoIntentoOxi >= 2000) {
      ultimoIntentoOxi = ahora;
      oxiOK = iniciarOxi();
    }
    return;
  }
  if (ahora - ultimaConsultaOxi < PERIODO_OXI_MS) return;
  ultimaConsultaOxi = ahora;

  // Leer solo lo que ya esta en la FIFO: sin esperar un bloque de 100 datos.
  oximetro.check();
  while (oximetro.available()) {
    rojoOxi = oximetro.getFIFORed();
    irOxi = oximetro.getFIFOIR();
    oximetro.nextSample();
    ultimaMuestraOxi = ahora;
    if (irOxi < UMBRAL_DEDO_IR) {
      reiniciarOxi();
      estadoOxi = 1;
      continue;
    }
    if (muestrasOxi < N_OXI) {
      irBuffer[muestrasOxi] = convertirOxi(irOxi);
      redBuffer[muestrasOxi] = convertirOxi(rojoOxi);
      muestrasOxi++;
    }
    if (estadoOxi == 1) estadoOxi = 2;
    if (muestrasOxi == N_OXI) calcularOxi();
  }
  // No conservar valores antiguos si el sensor deja de entregar muestras.
  if (ahora - ultimaMuestraOxi > TIMEOUT_OXI_MS) {
    reiniciarOxi();
    irOxi = rojoOxi = 0;
    oxiOK = false;
    estadoOxi = 0;
    ultimoIntentoOxi = ahora;
  }
}

// ================= ECG =================
void reiniciarECG(int raw) {
  lineaBase = raw;
  filtroRed.limpiar();
  filtroHP.limpiar();
  filtroLP1.limpiar();
  filtroLP2.limpiar();
  senalSuave = 0;
  picoRef = 0;
  sobreUmbral = false;
  cuenta = 0;
  idx = 0;
  bpm = 0;
  ultimoLatido = 0;
}

void procesarECG(int raw, bool sueltoAhora, unsigned long ahora) {
  ultimoADC = raw;
  if (!ecgInicializado) {
    reiniciarECG(raw);
    ecgInicializado = true;
    ecgInicio = ahora;
  }

  // Filtrar ANTES de enviar a 50 Hz. El filtro de 60 Hz no puede aplicarse
  // despues del submuestreo: la interferencia ya habria cambiado de frecuencia.
  float senal = filtroRed.aplicar(raw - lineaBase);
  senal = filtroHP.aplicar(senal);
  senal = filtroLP1.aplicar(senal);
  senalSuave = filtroLP2.aplicar(senal);

  // Antirrebote de deteccion de cables. Un aviso no borra la curva.
  if (sueltoAhora != sueltoEstable) {
    if (!cambioPendiente) {
      cambioPendiente = true;
      inicioCambio = ahora;
    }
    unsigned long espera = sueltoAhora ? DEBOUNCE_SUELTO_MS : DEBOUNCE_CONECT_MS;
    if (ahora - inicioCambio >= espera) {
      sueltoEstable = sueltoAhora;
      cambioPendiente = false;
      cuenta = idx = 0;
      bpm = 0;
      ultimoLatido = 0;
      picoRef = 0;
      sobreUmbral = false;
    }
  } else {
    cambioPendiente = false;
  }
  if (sueltoEstable || sueltoAhora || cambioPendiente) {
    estadoECG = 0;
    bpm = 0;
    ultimoLatido = 0;
    cuenta = idx = 0;
    sobreUmbral = false;
    return;
  }

  // Un ADC pegado al limite no da una frecuencia util. Seguir graficando.
  if (raw <= 8 || raw >= 4087 || ahora - ecgInicio < 1500) {
    estadoECG = 1;
    bpm = 0;
    ultimoLatido = 0;
    cuenta = idx = 0;
    picoRef = 0;
    sobreUmbral = false;
    return;
  }

  // Magnitud: funciona tambien si el pico dominante esta invertido.
  float magnitud = (senalSuave >= 0) ? senalSuave : -senalSuave;
  picoRef = max(magnitud, picoRef * 0.996f);
  float umbral = max(AMPLITUD_MINIMA, picoRef * 0.55f);

  if (magnitud > umbral && !sobreUmbral) {
    sobreUmbral = true;
    unsigned long intervalo = ahora - ultimoLatido;
    if (ultimoLatido == 0 || intervalo > REFRACTARIO) {
      if (ultimoLatido != 0 && intervalo <= 2000) {
        intervalos[idx] = intervalo;
        idx = (idx + 1) % 4;
        if (cuenta < 4) cuenta++;
        unsigned long suma = 0;
        for (int i = 0; i < cuenta; i++) suma += intervalos[i];
        bpm = 60000.0f / (static_cast<float>(suma) / cuenta);
      } else {
        bpm = 0;
        cuenta = idx = 0;
      }
      ultimoLatido = ahora;
    }
  }
  if (magnitud < umbral * 0.40f) sobreUmbral = false;
  if (ultimoLatido == 0 || ahora - ultimoLatido > TIMEOUT_LATIDO) {
    estadoECG = 1;
    bpm = 0;
    cuenta = idx = 0;
    if (ultimoLatido != 0) {
      ultimoLatido = 0;
      sobreUmbral = false;
    }
  } else {
    estadoECG = 2;
  }
}

// ================= RESPIRACIÓN (MPU6050) =================
bool iniciarMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);                 // PWR_MGMT_1
  Wire.write(0x00);                 // despertar
  if (Wire.endTransmission() != 0) return false;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);                 // ACCEL_CONFIG
  Wire.write(0x00);                 // rango ±2 g
  Wire.endTransmission();

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1A);                 // CONFIG
  Wire.write(0x03);                 // filtro interno ~44 Hz
  Wire.endTransmission();
  return true;
}

bool leerAccel(float a[3]) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);                 // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, 6, 1) != 6) return false;
  for (int i = 0; i < 3; i++) {
    int hi = Wire.read();
    int lo = Wire.read();
    int16_t v = (int16_t)((hi << 8) | lo);
    a[i] = v / 16384.0f;            // en g
  }
  return true;
}

void reiniciarResp() {
  picoResp = 0;
  respArriba = false;
  cuentaR = 0;
  idxR = 0;
  rpm = 0;
  ultimoRespiro = 0;
}

void procesarResp(unsigned long ahora) {
  // Sensor no disponible: reintentar cada 2 s
  if (!mpuOK) {
    estadoResp = 0;
    rpm = 0;
    respSenal = 0;
    if (ahora - ultimoIntentoMPU >= 2000) {
      ultimoIntentoMPU = ahora;
      if (iniciarMPU()) {
        mpuOK = true;
        respInit = false;
        fallosMPU = 0;
      }
    }
    return;
  }

  // Lectura a 25 Hz
  if (ahora - ultimaLecturaResp >= PERIODO_RESP_MS) {
    ultimaLecturaResp = ahora;

    float a[3];
    if (!leerAccel(a)) {
      if (++fallosMPU >= 10) mpuOK = false;
      return;
    }
    fallosMPU = 0;

    if (MODO_DEBUG == 2) {
      Serial.printf("%.3f,%.3f,%.3f\n", a[0], a[1], a[2]);
    }

    float v = a[EJE_RESP];
    if (!respInit) {
      lp1 = lp2 = baseResp = v;
      reiniciarResp();
      respInit = true;
    }

    // Filtro pasa-bajos (2 etapas, ~0.6 Hz) y quitar línea base lenta
    lp1 += (v - lp1) * 0.2f;
    lp2 += (lp1 - lp2) * 0.2f;
    baseResp += (lp2 - baseResp) * 0.01f;
    respSenal = lp2 - baseResp;

    // Umbral adaptativo
    picoResp = max(respSenal, picoResp * 0.998f);
    float umbral = max(AMPLITUD_MIN_RESP, picoResp * 0.5f);

    // Detección de cada respiración
    if (respSenal > umbral && !respArriba) {
      respArriba = true;
      if (ahora - ultimoRespiro > REFRACT_RESP) {
        if (ultimoRespiro > 0 && ahora - ultimoRespiro <= TIMEOUT_RESP) {
          intervalosR[idxR] = ahora - ultimoRespiro;
          idxR = (idxR + 1) % 4;
          if (cuentaR < 4) cuentaR++;
          if (cuentaR >= 2) {
            unsigned long suma = 0;
            for (int i = 0; i < cuentaR; i++) suma += intervalosR[i];
            rpm = 60000.0 / ((float)suma / cuentaR);
          }
        }
        ultimoRespiro = ahora;
      }
    }
    if (respSenal < umbral * 0.3f) respArriba = false;
  }

  // Estado
  if (ultimoRespiro == 0 || ahora - ultimoRespiro > TIMEOUT_RESP) {
    estadoResp = 1;
    rpm = 0;
    cuentaR = 0;
  } else {
    estadoResp = 2;
  }
}

// ================= SALIDA =================
void enviarDatos() {
  Serial.printf("%.1f,%.0f,%d,%d,%.1f,%d,%ld,%ld,%d,%lu,%lu\n",
                senalSuave, bpm, estadoECG * 50,
                (int)(respSenal * 1000.0f), rpm, estadoResp * 50,
                (long)spo2, (long)bpmOxi, estadoOxi * 50,
                (unsigned long)irOxi, (unsigned long)rojoOxi);
}

// ================= SETUP / LOOP =================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_LO_PLUS, INPUT);
  pinMode(PIN_LO_MINUS, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_ECG, ADC_11db);

  // Sembrar la linea base con la primera lectura para evitar un pico artificial.
  reiniciarECG(analogRead(PIN_ECG));

  if (!SOLO_ECG) {
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);
  Wire.setTimeOut(10);              // no bloquear si el MPU falla
  delay(100);
  mpuOK = iniciarMPU();
  ultimoIntentoMPU = millis();
  oxiOK = iniciarOxi();
  ultimoIntentoOxi = millis();
  }
}

void loop() {
  unsigned long ahora_us = micros();
  if (ahora_us - ultimaMuestra < PERIODO_US) return;
  ultimaMuestra = ahora_us;
  unsigned long ahora = millis();

  int raw = analogRead(PIN_ECG);
  bool sueltoAhora = (digitalRead(PIN_LO_PLUS) == HIGH) || (digitalRead(PIN_LO_MINUS) == HIGH);

  procesarECG(raw, sueltoAhora, ahora);
  if (!SOLO_ECG) {
    procesarResp(ahora);
    procesarOxi(ahora);
  }

  unsigned long periodoSalida = (MODO_DEBUG == 3) ? 200 : PERIODO_SERIAL_MS;
  if (ahora - ultimoEnvio >= periodoSalida) {
    ultimoEnvio = ahora;
    if (MODO_DEBUG == 0) enviarDatos();
    if (MODO_DEBUG == 1) {
      Serial.printf("LO+: %d  LO-: %d\n", digitalRead(PIN_LO_PLUS), digitalRead(PIN_LO_MINUS));
    }
    if (MODO_DEBUG == 4) {
      Serial.printf("ECG:%.1f,ADC:%d,BPM:%.0f,LOmas:%d,LOmenos:%d\n",
                    senalSuave, ultimoADC, bpm, digitalRead(PIN_LO_PLUS), digitalRead(PIN_LO_MINUS));
    }
    if (MODO_DEBUG == 3) {
      Serial.printf("IR=%lu | ROJO=%lu | SpO2=%ld | BPM_OXI=%ld | ESTADO=%d | MUESTRAS=%d\n",
                    (unsigned long)irOxi, (unsigned long)rojoOxi,
                    (long)spo2, (long)bpmOxi, estadoOxi, muestrasOxi);
    }
  }
}