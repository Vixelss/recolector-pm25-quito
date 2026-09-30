# Decisiones y hallazgos del recolector

Bitácora del proyecto: qué se decidió, por qué, y qué se descubrió al probar las fuentes.
Sirve como respaldo para redactar la metodología de la tesis y para la defensa.

- Contexto inicial y requisitos: [`CONTEXTO_RECOLECTOR.md`](CONTEXTO_RECOLECTOR.md)
- Las fechas son de 2026. Las horas son de Ecuador (UTC−5) salvo que se indique otra cosa.

---

## 1. Decisiones

| # | Fecha | Decisión | Motivo |
|---|---|---|---|
| D1 | 29/09 | El repositorio es **privado** en GitHub. | Decisión del autor. Implica un cupo de 2000 min/mes de GitHub Actions. |
| D2 | 29/09 | **Una sola ejecución por hora.** Siempre guarda las mediciones de AQICN. En las horas 00, 03, 06, 09, 12, 15, 18 y 21 también guarda los pronósticos de clima y CAMS. | Ahorrar minutos. GitHub cobra cada ejecución redondeada hacia arriba al minuto, así que ~720 ejecuciones/mes ≈ 720 min, dentro del cupo. |
| D3 | 29/09 | Cada ejecución debe durar **menos de 1 minuto**: caché de `pip`, pocas dependencias y un límite de `timeout-minutes: 3` en el flujo. | Sin límite, un proceso colgado podría consumir hasta 360 min (el límite por defecto de GitHub). |
| D4 | 29/09 | El cron se programa en el **minuto :07**, no en el :00. | GitHub retrasa las ejecuciones programadas, sobre todo en el :00. Con el margen, un retraso normal no pasa a la hora siguiente y no se pierde la emisión de pronóstico. *(Se aplica en el paso 7.)* |
| D5 | 29/09 | Python **3.13** (local 3.13.3). Dependencias fijadas: `requests==2.34.2`, `psycopg[binary]==3.3.6`, `python-dotenv==1.2.3`. | Que GitHub Actions instale exactamente lo mismo que en local, y que la caché de `pip` se aproveche. |
| D6 | 29/09 | Los secretos (`WAQI_TOKEN`, `DATABASE_URL`) van en `.env` (ignorado por git) y en GitHub Secrets. `.env.example` es una plantilla **sin valores**. | Seguridad. |
| D7 | 29/09 | Base de datos en **Neon**, con PostgreSQL 18.6. | Definido en el contexto inicial. |
| D8 | 29/09 | Open-Meteo se consulta con **una sola solicitud para las 8 estaciones** (coordenadas separadas por comas), una para clima y otra para CAMS. | 2 solicitudes en lugar de 16. Cada una tarda ~0,8 s. |
| D9 | 29/09 | `forecast_hours=48` en clima y en CAMS (no `forecast_days`). | `forecast_hours` empieza en la hora actual. `forecast_days` empieza a las 00:00 del día e incluye horas ya pasadas. |
| D10 | 29/09 | Las variables de Open-Meteo se guardan **en sus unidades originales**, con la unidad en el nombre de la columna (`viento_10m_kmh`, `presion_superficie_hpa`, etc.). | Evitar confusiones (el viento de la REMMAQ está en m/s). La conversión se hace en el análisis. |
| D11 | 29/09 | Se añade la radiación solar (`shortwave_radiation`, W/m²) al pronóstico de clima. | El parámetro existe (verificado). |
| D12 | 29/09 | `emitido_en` = momento de nuestra consulta, **igual para todas las filas de una ejecución**. | La API no informa la hora de la corrida del modelo. Con un solo valor por ejecución, cada emisión se agrupa fácilmente. |
| D13 | 29/09 | Esquema creado en Neon (`sql/esquema.sql`). Respecto a la propuesta inicial se añadieron: `aqi_num`, `contaminante_dominante`, `r` y `wg` en `mediciones_aqicn`; `elevacion_m` en `pronostico_clima`; `avisos` y `origen` en `ejecuciones`. | Ajustes según lo que devuelven realmente las APIs (ver hallazgos). |
| D14 | 29/09 | Los mensajes de error se **limpian del token** antes de registrarlos. | `requests` incluye la URL completa (con el token) en sus errores (ver H9). |
| D15 | 29/09 | Clima de Open-Meteo con el modelo por defecto **`best_match`** (no se fija el parámetro `models`). | Decisión del autor: suele dar el pronóstico más preciso. **Limitación a declarar en la tesis:** combina varios modelos, no informa cuál usa y la combinación puede cambiar con el tiempo. (Resuelve P1.) |

| D16 | 29/09 | Estructura del código: `recolector/` con `config.py` (estaciones y parámetros), `red.py` (solicitudes con reintentos y ocultamiento de secretos), `aqicn.py`, `open_meteo.py`, `db.py` y `main.py`. Se ejecuta con `python -m recolector.main`. | Separar responsabilidades para que cada parte se pueda explicar por separado. |
| D17 | 29/09 | Las 8 estaciones de AQICN se consultan **en paralelo** (8 hilos). | La ejecución tarda lo que tarda la estación más lenta, no la suma de todas. |
| D18 | 29/09 | Reintentos: 3 intentos, espera de 1 s y luego 2 s, tiempo de espera de 5 s para conectar y 10 s para leer. Se reintenta ante errores de red, HTTP 429 y 5xx; otros 4xx fallan de inmediato. | Hallazgo H8. El peor caso cabe en el límite de 3 min del flujo. |
| D19 | 29/09 | Estado de cada ejecución: `ok` (sin errores), `parcial` (algún error, pero se obtuvo algo) o `error` (no se obtuvo nada). Solo `error` o un fallo de la base de datos terminan con código 1 (ejecución en rojo en GitHub). | Que una estación caída no marque en rojo toda la ejecución, pero que un fallo total sí se note. |
| D20 | 29/09 | Una medición con más de **6 h** de antigüedad genera un **aviso**, no un error. | El Camal responde `ok` con un dato de junio (H5). |
| D21 | 29/09 | Opción `--forzar-pronosticos` para pruebas manuales fuera de las horas 00, 03, …, 21. | Probar sin esperar. **Ojo:** genera emisiones fuera de horario; en el análisis se filtran por `hora_emision` (00, 03, …, 21). |
| D22 | 29/09 | Nueva columna **`hora_emision`** (hora de Ecuador en punto: 00, 03, …, 21) en `pronostico_clima` y `pronostico_cams`. La clave única pasa a ser **(estacion_id, hora_emision, hora_objetivo)**. `emitido_en` se conserva como el momento real de la consulta. | Resuelve H22: si hay dos ejecuciones en la misma hora, se conserva la primera (la más cercana al horario previsto) y la segunda se descarta. Cada emisión queda identificada por una hora limpia, coincidente con los momentos de emisión del modelo propio. **Cambia la clave propuesta en el contexto inicial** (aprobado por el autor). Verificado: la segunda ejecución insertó 0 filas de pronóstico. |
| D23 | 29/09 | Se borraron todos los datos de prueba (`TRUNCATE`). | Que la recolección real empiece limpia. |
| D24 | 29/09 | Flujo `.github/workflows/recolector.yml` con estas características:<br>• cron `7 * * * *` (en UTC; el script calcula la hora de Ecuador)<br>• `workflow_dispatch` con la opción `forzar_pronosticos`<br>• `concurrency` para que nunca haya dos ejecuciones a la vez<br>• `timeout-minutes: 3`<br>• `permissions: contents: read`<br>• `actions/checkout@v7` y `actions/setup-python@v7` (Python 3.13 con `cache: pip`) | Aplica D2, D3 y D4. Se usan las versiones más recientes de las acciones oficiales al 29/09/2026. |
| D25 | 29/09 | El autor delega en Claude todas las operaciones del repositorio: commits, push, secretos y Actions. Se instaló GitHub CLI 2.101.0 (`winget`). | Decisión del autor. |

**Decisiones pendientes**
- ~~P1. Modelo meteorológico de Open-Meteo~~ → resuelta en D15.
- ~~P2. Emisiones duplicadas en la misma hora~~ → resuelta en D22.

---

## 2. Hallazgos al probar las fuentes (29/09/2026)

### AQICN
- **H1. Retraso variable de publicación.** A las 19:40 Belisario devolvía la medición de las 16:00 (~3,7 h de retraso). Más tarde ya devolvía la de las 19:00. En operación, el modelo tendrá datos de hace 2 a 4 horas.
- **H2. `data.time.v` está desfasado 5 horas.** Ejemplo: `v = 1790708400` equivale a 19:00 **UTC**, pero la medición es de las 19:00 **−05:00** (`time.iso`). Se usa siempre `time.iso`.
- **H3. Estaciones con campos faltantes.** Los Chillos no mide pm25 ni pm10. Tumbaco y Guamaní no miden co. Centro y Guamaní no miden no2. Por eso todas las columnas de contaminantes admiten NULL.
- **H4. Campo `r` no documentado** en todas las estaciones (probablemente lluvia). `wg` (ráfaga) no apareció en ninguna.
- **H5. El Camal** responde `status: ok`, pero con datos del **15/06/2026 13:00**. No es un error de la API. Se guarda una vez y luego la clave única lo descarta; se registra como aviso.
- **H6.** `data.aqi` llegó siempre como entero en las pruebas. Se guarda como texto (`aqi_general`) y como número (`aqi_num`) por si llega como `"-"`.
- **H7.** La presión de AQICN es de ~1027 hPa (ajustada al nivel del mar). No es comparable con la REMMAQ.
- **H8. Tiempos de espera reales.** La consulta de Los Chillos no respondió en 15 s en un intento; al reintentar respondió en 1,4 s. Hacen falta reintentos.
- **H9. El token aparece en los mensajes de error** de `requests` (van en la URL). Ocurrió en una prueba local, así que se recomienda pedir un token nuevo en https://aqicn.org/data-platform/token/.
- **H10.** Atribución obligatoria: *"Metropolitan Air Monitoring Network of Quito managed by Secretaria de Ambiente DMQ"* y *"World Air Quality Index Project"*.

### Open-Meteo, clima
- **H11.** Las horas vienen **sin zona horaria** (`"2026-09-29T20:00"`), junto con `utc_offset_seconds = -18000`. El recolector aplica ese desfase para guardar `timestamptz` correctos.
- **H12.** Unidades: °C, %, **km/h**, °, mm, hPa (~731 hPa, presión a la altura de Quito) y W/m². Sin nulos en 48 h.
- **H13.** Cada estación cae en un punto de malla distinto, salvo **Centro y El Camal, que comparten celda**. Aun así su temperatura difiere un poco (11,9 °C frente a 11,5 °C): Open-Meteo corrige por la elevación del punto pedido. Elevaciones de la malla: de 2335 m (Tumbaco) a 3067 m (Guamaní).

### Open-Meteo, calidad del aire (CAMS)
- **H14. CAMS solo da 2 series distintas para las 8 estaciones:**
  - Norte (Belisario, Carapungo y Cotocollao): una misma serie.
  - Sur (Tumbaco, Centro, Los Chillos, Guamaní y El Camal): otra.

  Esto es coherente con la malla de ~0,4° de CAMS global. El límite entre celdas pasa cerca de la latitud −0,2, entre Belisario (−0,185) y Centro (−0,221). **Implicación para la tesis:** CAMS apenas distingue entre el norte y el sur de Quito, lo que debe declararse al comparar con el modelo propio.
- **H15. Las coordenadas que devuelve la API no identifican la celda real:** Belisario y Centro dicen estar en (−0,20, −78,50) pero tienen valores distintos. Se guardan tal como vienen, pero no deben usarse para agrupar series.
- **H16.** Valores en µg/m³. Sin nulos al final del horizonte en esta prueba (se sigue tolerando NULL). `domains=cams_global` devuelve los mismos valores que el valor por defecto.

### Otros
- **H17.** La consola de Windows (cp1252) no puede imprimir "µ". El recolector forzará la salida en UTF-8. En GitHub Actions (Linux) no ocurre.
- **H18.** Prueba de carga en Neon con las respuestas reales, dentro de una transacción que luego se deshizo: 8 mediciones, 384 filas de clima y 384 de CAMS. Todos los tipos y las zonas horarias quedaron correctos, y la reinserción no duplicó filas.
- **H19. Volumen estimado:** ~3.000 filas de pronóstico al día por tabla y ~190 mediciones al día. Hasta diciembre serían 30 a 50 MB, frente al límite de 0,5 GB del plan gratuito de Neon.
- **H20.** Git Bash en Windows no reconoce `TZ=America/Guayaquil` (usa UTC). No afecta al recolector, que calcula la hora de Ecuador en Python con un desfase fijo de −5 h.
- **H21. Primera prueba local completa (29/09, 20:58 y 21:00).**
  - A las 20:58 (sin pronósticos): 8 mediciones en 8,7 s.
  - A las 21:00 (con pronósticos): 384 filas de clima y 384 de CAMS en 16,9 s. La hora 21 activó los pronósticos correctamente.
  - Hubo varios tiempos de espera en AQICN y en Open-Meteo, y todos se recuperaron con los reintentos. La peor duración fue de 30,8 s, dentro del objetivo de menos de 1 min.
  - El token apareció como `<oculto>` en los mensajes.
  - A las 21:00 AQICN seguía devolviendo la medición de las 19:00, así que no hubo mediciones nuevas. Es el comportamiento esperado.
- **H22. Idempotencia de los pronósticos.** Repetir la ejecución en la misma hora **no** duplica mediciones, pero **sí crea una segunda emisión** de pronóstico, porque `emitido_en` cambia (21:00:20 frente a 21:00:38). Puede ocurrir si GitHub repite una ejecución o si se lanza una manual en una hora de pronóstico. Resuelto en D22.
- **H23.** Documentación oficial de GitHub: *"In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."* **Solo aplica a repositorios públicos**, así que el repositorio privado del proyecto no necesita medidas contra la inactividad.

---

## 3. Avance

| Paso | Estado | Notas |
|---|---|---|
| 1. Estructura y dependencias | ✅ 29/09 | `.venv`, `requirements.txt` y `.env.example`. |
| 2. Proyecto en Neon y `DATABASE_URL` | ✅ 29/09 | Conexión verificada. |
| 3. Crear las tablas | ✅ 29/09 | `sql/esquema.sql` ejecutado y prueba de carga superada. |
| 4. Script del recolector y prueba local | ✅ 29/09 | Pruebas a las 20:58 y 21:00 (H21) y prueba de emisión duplicada (D22). Datos de prueba borrados. |
| 5. Revisar los datos en Neon | — | |
| 6. Secretos en GitHub | ✅ 29/09 | `WAQI_TOKEN` y `DATABASE_URL` cargados con `gh secret set`, leídos de `.env` sin mostrarlos. |
| 7. Flujo de GitHub Actions | ⏳ | Flujo escrito (D24); falta subirlo y probarlo. No aplica la desactivación a los 60 días (H23). |
| 8. Checklist a las 24–48 h | — | |
