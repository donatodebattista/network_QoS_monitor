# Network QoS Monitor

**Analizador y Visualizador de Calidad de Servicio y Cobertura de Red Móvil en Tiempo Real**

* **Institución:** Facultad de Ciencia y Tecnología (FCyT) — Sede Concepción del Uruguay
* **Universidad:** Universidad Autónoma de Entre Ríos (UADER)
* **Carrera:** Licenciatura en Sistemas de Información
* **Cátedra:** Desarrollo de Aplicaciones Móviles — Ciclo Lectivo 2026
* **Tecnología:** React Native CLI (v0.87 con Nueva Arquitectura / Fabric / TurboModules) & Android Nativo (Kotlin)

---

## 01. Introducción y Contexto

En el despliegue y consumo de servicios móviles, la **Calidad de Servicio (QoS - Quality of Service)** y la **Calidad de Experiencia (QoE - Quality of Experience)** del usuario final son variables dinámicas fuertemente influenciadas por la geografía urbana, la atenuación de propagación de radiofrecuencia (RSRP), la congestión de celdas celulares y el enrutamiento de paquetes en la red troncal.

Este proyecto aborda la ingeniería y desarrollo de una aplicación móvil multiplataforma que desciende por debajo de las abstracciones estándar de frameworks híbridos, implementando:
1. **Acceso directo a capas de radiofrecuencia celular** mediante un módulo nativo en Kotlin (`TelephonyManager`).
2. **Medición activa de latencia real y jitter** a nivel de sockets TCP crudos (`RFC 3550`).
3. **Prueba de rendimiento (Throughput)** de descarga y subida contra un backend de referencia HTTP.
4. **Persistencia y georreferenciación** de cada muestra capturada con GPS.
5. **Visualización geoespacial y temporal** mediante mapas de cobertura (pines y heatmaps) y gráficos de evolución cronológica.
6. **Muestreo periódico autónomo en segundo plano** y disparo de **alertas nativas** ante degradaciones críticas de conectividad.

---

## 02. Matriz de Requisitos Funcionales (PRD Compliance)

El sistema satisface el 100% de los requerimientos especificados en el documento de requerimientos (`prd.md`):

| ID | Requisito Funcional | Estado | Módulo Responsable | Componentes Principales |
| :--- | :--- | :---: | :--- | :--- |
| **RF-01** | Detectar y mostrar tipo de red activa, operador y señal en dBm | ✅ Cumplido | `src/native-bridge` | `TelephonyModule.kt`, `CellularMetricsCard.tsx`, `NetworkStatus.tsx` |
| **RF-02** | Medir RTT (ping) contra $\ge 3$ hosts, calculando min/avg/max y jitter RFC 3550 | ✅ Cumplido | `src/measurement-engine` | `ping-engine.ts`, `PingEngineCard.tsx` (Cloudflare, Google, OpenDNS) |
| **RF-03** | Test de descarga y subida para calcular throughput en Mbps | ✅ Cumplido | `src/measurement-engine` | `throughput-engine.ts`, `ThroughputEngineCard.tsx`, `backend/server.js` |
| **RF-04** | Registrar mediciones con timestamp y coordenadas GPS | ✅ Cumplido | `src/geo`, `src/persistence` | `location-service.ts`, `LocationCard.tsx`, `storage-engine.ts` |
| **RF-05** | Visualizar historial en mapa interactivo con Heatmap y pines | ✅ Cumplido | `src/presentation` | `QoSMapView.tsx` (OpenStreetMap + Leaflet.js interactivo) |
| **RF-06** | Graficar series temporales de señal (dBm), latencia (ms) y velocidad (Mbps) | ✅ Cumplido | `src/presentation` | `TimeSeriesChart.tsx` (`react-native-svg` con escala dinámica) |
| **RF-07** | Muestreo periódico en segundo plano y notificaciones ante degradación | ✅ Cumplido | `src/native-bridge`, `src/measurement-engine` | `NotificationModule.kt`, `background-sampler.ts`, `BackgroundMonitoringCard.tsx` |
| **RF-08** | Exportar historial de mediciones a formatos CSV y JSON | ✅ Cumplido | `src/persistence` | `storage-engine.ts`, `MeasurementHistoryCard.tsx` |
| **RF-09** | Filtrar historial por tipo de red (Todos, Celular, Wi-Fi) y fechas | ✅ Cumplido | `src/persistence` | `storage-engine.ts`, `MeasurementHistoryCard.tsx`, `QoSMapView.tsx` |

---

## 03. Arquitectura del Sistema

La solución sigue una **arquitectura en capas desacopladas**, garantizando que las tareas intensivas de red no bloqueen el hilo de renderizado de JavaScript:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER (UI)                         │
│  NetworkStatus | CellularCard | LocationCard | QoSMapView (Leaflet)   │
│  TimeSeriesChart (SVG) | PingCard | ThroughputCard | HistoryCard       │
│  BackgroundMonitoringCard                                             │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
┌───────────────▼────────────────────────┐ ┌─────────────▼───────────────┐
│        MEASUREMENT ENGINE              │ │         GEO LAYER           │
│  • ping-engine (TCP Sockets, RFC 3550) │ │  • location-service         │
│  • throughput-engine (HTTP XHR Stream) │ │    (GPS Fine/Coarse Geocod) │
│  • background-sampler (Daemon & Rules) │ └─────────────┬───────────────┘
└───────────────┬────────────────────────┘               │
                │                                        │
┌───────────────▼────────────────────────────────────────▼───────────────┐
│                       PERSISTENCE LAYER                                │
│  • storage-engine (AsyncStorage Key-Value Store)                       │
│  • Exportadores estructurados (JSON Parser & CSV Formatter)            │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────────┐
│                      NATIVE BRIDGE (KOTLIN)                            │
│  • TelephonyModule: TelephonyManager (RSRP dBm, CellID, TAC, Red)      │
│  • NotificationModule: NotificationChannel, NotificationCompat         │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────────┐
│                    REFERENCE BACKEND (NODE.JS)                         │
│  • GET /download?size=X  • POST /upload  • GET /health                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 04. Decisiones Técnicas y Justificación

### 1. Módulos Nativos en Kotlin (TurboModules & New Architecture)
En Android moderno (API 29+ a 35), la potencia de señal celular (RSRP) y los identificadores de celda (`CellInfoLte`, `CellInfoNr`, `CellIdentity`) están protegidos bajo permisos de tiempo de ejecución (`ACCESS_FINE_LOCATION`, `READ_PHONE_STATE`). Se construyó el módulo nativo propio `TelephonyModule.kt` en Kotlin para consultar de manera segura el `TelephonyManager`, extrayendo:
- Potencia en dBm (`cellSignalStrength.dbm`).
- Nivel de barras estandarizado de 0 a 4 (`cellSignalStrength.level`).
- Operador de SIM y red (`networkOperatorName`).
- Generación de telefonía celular (3G, 4G LTE, 5G NR).
- Identificador de celda (Cell ID) y Código de Área de Rastreo (TAC).

### 2. Sondas TCP y Algoritmo de Jitter RFC 3550
A diferencia del comando `ping` de consola (basado en ICMP, el cual suele estar bloqueado por firewalls de operadoras móviles), el motor implementado en `ping-engine.ts` utiliza sockets TCP hacia puertos abiertos (`443` en Cloudflare `1.1.1.1`, Google `8.8.8.8` y OpenDNS `208.67.222.222`).
El cálculo de **Jitter inter-llegada** implementa la fórmula canónica del **RFC 3550**:

$$D(i, j) = |R_j - R_i|$$

$$J_i = J_{i-1} + \frac{|D(i, j)| - J_{i-1}}{16}$$

### 3. Visualización Geoespacial Libre (OpenStreetMap + Leaflet)
Para evitar la dependencia de claves de facturación (API Keys) de Google Cloud Console y evitar bloqueos en entornos de evaluación académica, el mapa se implementó con **Leaflet.js** y teselas de **OpenStreetMap** embebidas mediante `react-native-webview`:
- **Modo Pines:** Marcadores circulares con código de colores según calidad (Verde $\ge -85\text{ dBm}$, Ámbar, Rojo $< -105\text{ dBm}$) con tooltips emergentes detallados.
- **Modo Heatmap:** Halos concéntricos ponderados que ilustran la dispersión de calidad y zonas ciegas.

### 4. Muestreo en Background y Alertas Locales
El motor `background-sampler.ts` automatiza la recolección periódica de muestras sin requerir interacción activa. Al finalizar cada ciclo, evalúa tres reglas de degradación severa:
- Desconexión de red o pérdida de acceso a Internet (`isInternetReachable === false`).
- Señal celular crítica ($\text{RSRP} \le -115\text{ dBm}$).
- Latencia excesiva ($\text{RTT} \ge 250\text{ ms}$).

Ante cualquiera de estas anomalías, dispara una notificación local nativa con alta prioridad y vibración a través de `NotificationModule.kt`.

---

## 05. Guía de Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js:** Versión 18 o superior.
- **JDK:** OpenJDK 17.
- **Android SDK:** Configurado en `ANDROID_HOME` con herramientas de compilación para API 35.
- **Dispositivo Físico o Emulador Android:** Con depuración USB habilitada.

### Pasos de Ejecución

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone <URL_REPOSITORIO>
   cd NetworkQoSMonitor
   npm install
   ```

2. **Verificar dispositivo conectado:**
   ```bash
   adb devices
   # Debe listar tu dispositivo físico o emulador
   ```

3. **Reenviar puertos locales por USB (ADB Reverse):**
   ```bash
   # Puerto 8081 para Metro Bundler y puerto 3000 para el Backend local
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:3000 tcp:3000
   ```

4. **Iniciar el Backend de Referencia (Terminal 1):**
   ```bash
   npm run server
   # Iniciará el servidor en http://0.0.0.0:3000
   ```

5. **Iniciar Metro Bundler (Terminal 2):**
   ```bash
   npm start
   ```

6. **Compilar e instalar la aplicación en el dispositivo (Terminal 3):**
   ```bash
   npm run android
   ```

---

## 06. Backend de Referencia para Throughput

El backend de medición está implementado en [`backend/server.js`](backend/server.js) utilizando Node.js nativo sin dependencias pesadas:

* **`GET /download?size=X`**: Genera dinámicamente un flujo de datos pseudoaleatorio de $X$ megabytes (por defecto 5 MB) con cabeceras `Content-Type: application/octet-stream`.
* **`POST /upload`**: Endpoint que consume y drena el payload binario transmitido por el cliente, contabilizando el tamaño recibido y retornando el tiempo de procesamiento en JSON.
* **`GET /health`**: Endpoint de diagnóstico y latencia base.

### Despliegue con Docker
Para desplegar el backend en un servidor remoto o contenedor local:

```bash
docker run -d --name qos-backend -p 3000:3000 -v $(pwd)/backend:/app -w /app node:18-alpine node server.js
```

---

## 07. Suite de Testing Automatizado

La aplicación cuenta con una suite completa de pruebas unitarias y de integración implementada con **Jest**:

```bash
npm test
```

### Cobertura de Pruebas:
- **`__tests__/ping-engine.test.ts`**: Verificación de hosts por defecto, cálculo de RTT min/max/avg y cumplimiento estricto del algoritmo de jitter RFC 3550.
- **`__tests__/storage-engine.test.ts`**: Verificación del CRUD de mediciones en `AsyncStorage`, cálculo de resúmenes estadísticos y generación correcta de exports CSV y JSON.
- **`__tests__/background-sampler.test.ts`**: Verificación del ciclo de temporizador y umbrales de alerta de degradación.
- **`__tests__/App.test.tsx`**: Prueba de integración de renderizado completo de la interfaz principal con todos los componentes montados.

Para verificar análisis estático y tipos de TypeScript:
```bash
npx tsc --noEmit
npm run lint
```

---

## 08. Limitaciones Conocidas y Trabajo Futuro

1. **Optimizaciones de Batería en Android (Doze Mode):** En Android 12+, el sistema operativo puede retardar tareas periódicas de fondo cuando el dispositivo entra en reposo profundo. Como trabajo futuro, se puede integrar un Android Foreground Service con notificación persistente para muestreos de alta frecuencia en campo.
2. **Compatibilidad con iOS:** La API `CoreTelephony` de Apple restringe el acceso al valor numérico exacto de dBm por políticas de privacidad de la App Store, exponiendo únicamente indicadores de barras o tecnología celular.
3. **Validación Cruzada con Datos Abiertos:** Integración futura con APIs de **OpenCelliD** y **Mozilla Location Service** para contrastar la cobertura medida con registros globales de antenas.

---

## 09. Guión para el Video Demostrativo (3 a 5 min)

Para la entrega del video exigido por la cátedra, se sugiere seguir esta estructura:

1. **0:00 - 0:45 | Introducción y Métricas Nativas:**
   - Presentar la app en el dispositivo físico.
   - Mostrar la tarjeta **Estado de Red** (Wi-Fi / Móvil) y la tarjeta **Métricas Celulares Nativas**, destacando la lectura en tiempo real de operador, RSRP en dBm, TAC y Cell ID obtenidos mediante Kotlin.
2. **0:45 - 1:45 | Pruebas de Latencia y Velocidad:**
   - Ejecutar una sesión de 10 sondas en la tarjeta **TCP Sockets** (mostrando el cálculo de RTT y Jitter RFC 3550).
   - Ejecutar el **Test de Velocidad** contra el servidor local o Cloudflare CDN (observando la velocidad de descarga y subida en Mbps).
3. **1:45 - 2:45 | Historial, Mapa y Series Temporales:**
   - Capturar una muestra georreferenciada con GPS en la tarjeta de historial.
   - Navegar al **Mapa de Cobertura**: alternar entre el modo *Pines* (pulsar un marcador para ver el popup) y el modo *Heatmap*.
   - Observar el **Gráfico de Serie Temporal**: cambiar entre las pestañas de *Señal (dBm)*, *Latencia (ms)* y *Throughput (Mbps)*.
4. **2:45 - 3:30 | Monitoreo en Background y Alertas:**
   - Ir a la tarjeta **Monitoreo en Segundo Plano**.
   - Pulsar *"Probar Notificación"* para mostrar cómo aparece y suena la alerta local en la barra de notificaciones del teléfono.
   - Activar el interruptor de muestreo periódico continuo.
5. **3:30 - 4:00 | Exportación y Cierre:**
   - En la tarjeta de historial, pulsar *"Exportar JSON"* y *"Exportar CSV"*, demostrando la capacidad de extraer los datos para su posterior análisis en herramientas como QGIS o Excel.
