# Contexto: recolector de datos para la tesis de pronóstico de PM2.5 en Quito

## 1. Quién soy y qué necesito

Soy Alex Vivanco, estudiante de Ingeniería en Sistemas de la Información (PUCE, Quito). Mi tesis es: **"Pronóstico horario de PM2.5 en el Distrito Metropolitano de Quito mediante aprendizaje automático y su implementación en un sistema web"**. Plazo final: 5 de diciembre de 2026.

Necesito construir un **recolector de datos**: un programa en Python que corra solo en la nube (GitHub Actions) y guarde datos en una base PostgreSQL (Neon). Este documento resume las decisiones ya tomadas y los problemas ya detectados. Por favor, respétalos y pregúntame antes de cambiar alguna decisión.

**Forma de trabajo:** quiero avanzar paso a paso, entendiendo cada parte. Explícame lo que haces antes de hacerlo y comenta el código en español, porque en la defensa de la tesis me van a preguntar cómo funciona.

## 2. Para qué sirve el recolector

1. **Operación en vivo:** el modelo necesita el PM2.5 de las últimas horas y días. La API de AQICN solo devuelve la última hora, no el historial, así que hay que guardarlo hora por hora.
2. **Evaluación con clima pronosticado:** en la vida real el modelo no conoce el clima futuro, solo su pronóstico. Hay que guardar los pronósticos meteorológicos tal como se emitieron.
3. **Comparación justa con CAMS** (pedido del tutor): hay que guardar el pronóstico de CAMS emitido en el mismo momento en que pronosticaría mi modelo, con la misma anticipación.
4. **Desempeño en operación:** comparar después lo pronosticado contra lo medido.

Regla clave: **cada pronóstico se guarda con dos tiempos: cuándo se obtuvo (emisión) y para qué hora es (hora objetivo).** Sin la emisión no se puede saber la anticipación y la comparación con CAMS pierde validez.

## 3. Estaciones

Red: REMMAQ (Red Metropolitana de Monitoreo Atmosférico de Quito, Secretaría de Ambiente). IDs y coordenadas confirmados con la búsqueda de la API de AQICN:

| Estación | ID AQICN | Latitud | Longitud | Nota |
|---|---|---|---|---|
| Belisario | 6941 | -0.184719 | -78.495986 | **Principal** |
| Carapungo | 6943 | -0.095472 | -78.449809 | **Principal** |
| Tumbaco | 10686 | -0.214933 | -78.403253 | **Principal** |
| Cotocollao | 6942 | -0.107777 | -78.497222 | Secundaria |
| Centro | 6944 | -0.221393 | -78.514005 | Secundaria |
| Los Chillos | 6945 | -0.297062 | -78.455248 | Secundaria |
| Guamaní | 10685 | -0.333949 | -78.553416 | Secundaria |
| El Camal | 10687 | -0.25 | -78.51 | Sin datos desde el 15/06/2026; consultar igual, sin fallar |

San Antonio no existe en AQICN. Las coordenadas se usan también para Open-Meteo.

## 4. Fuentes y cómo consultarlas

### 4.1 AQICN / World Air Quality Index Project (mediciones)

- URL: `https://api.waqi.info/feed/@{ID}/?token={WAQI_TOKEN}`
- Requiere token (ya lo tengo). Cuota por defecto amplia; una consulta por estación por hora es mínima.
- Campos útiles de la respuesta:
  - `status` ("ok" o error)
  - `data.aqi` (puede venir como número, texto o "-")
  - `data.iaqi.pm25.v`, `pm10`, `no2`, `co`, `so2`, `o3`, `t`, `h`, `p`, `w`, `wd`, `wg`, `dew` (cualquiera puede faltar)
  - `data.time.iso` (ejemplo: `2026-09-21T14:00:00-05:00`)
  - `data.city.geo`, `data.city.name`, `data.attributions`

**Trampas ya detectadas:**
- **Usar siempre `data.time.iso` para la hora de medición. NO usar `data.time.v`:** en dos respuestas para la misma hora ese número difirió exactamente 5 horas.
- **Los valores de `iaqi` están en la escala AQI de la EPA de EE. UU., no en µg/m³** (ejemplo: pm25 = 78 igual al AQI general). Guardarlos tal cual; la conversión a µg/m³ se hará después, no en el recolector.
- El dato se publica con 1 a 2 horas de retraso. Varias consultas pueden devolver la misma hora: evitar duplicados.
- La meteorología de AQICN (`t`, `h`, `p`, `w`) no es oficial (red ciudadana) y la presión viene ajustada al nivel del mar (~1023 hPa). Se puede guardar, pero no es la fuente meteorológica del proyecto.
- El pronóstico de AQICN (`forecast.daily`) es diario, no horario. No se usa.
- Términos de uso: atribución obligatoria y **no redistribuir los datos archivados**. Se guardan solo para uso interno del proyecto.

### 4.2 Open-Meteo, pronóstico meteorológico

- URL base: `https://api.open-meteo.com/v1/forecast`
- Sin token, gratuito para uso no comercial.
- Parámetros probados: `latitude`, `longitude`, `hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure`, `timezone=America/Guayaquil`. Agregar radiación solar si el parámetro existe (verificar en la documentación, por ejemplo `shortwave_radiation`).
- Devuelve listas horarias en `hourly` (una por variable) y `hourly_units`.
- **El viento viene en km/h**; los datos históricos de la REMMAQ están en m/s. Guardar la unidad original o convertir, pero dejarlo documentado.
- `surface_pressure` es presión a la altura de Quito (~730 hPa), coherente con la REMMAQ.
- La API ajusta las coordenadas a su cuadrícula: guardar la latitud y longitud que devuelve.
- Solo interesan las próximas 24 a 48 horas; verificar el parámetro para limitar los días de pronóstico.

### 4.3 Open-Meteo, calidad del aire (pronóstico CAMS)

- URL base: `https://air-quality-api.open-meteo.com/v1/air-quality`
- Sin token.
- Parámetros probados: `latitude`, `longitude`, `hourly=pm2_5`, `timezone=America/Guayaquil` (también funcionó `past_days=3`).
- Valores en µg/m³. Para Ecuador viene del modelo global CAMS: celdas de ~45 km, salidas cada 3 horas, corridas cada 12 horas. La API devuelve valores horarios.
- La cuadrícula es gruesa: para Belisario devolvió -0.20, -78.50. Guardar las coordenadas devueltas.
- Las últimas horas del horizonte pueden venir en `null`: manejarlo.
- **Pendiente de investigar:** si Open-Meteo guarda corridas anteriores de CAMS (permitiría reconstruir la comparación hacia atrás). No bloquea el recolector.

## 5. Frecuencia

- **Mediciones AQICN:** cada hora, todas las estaciones.
- **Pronósticos (clima y CAMS):** cada 3 horas, en horarios fijos (por ejemplo 00, 03, 06, ..., 21 hora de Ecuador), todas las estaciones, guardando al menos las próximas 24 horas. Los mismos horarios se usarán después como momentos de emisión del pronóstico de mi modelo en la evaluación.

Si propones otra frecuencia, explícame el motivo (por ejemplo, volumen de datos o límites de Neon).

## 6. Base de datos (PostgreSQL en Neon)

Propuesta de tablas (ajustable, pero mantener la idea):

- `mediciones_aqicn`: estacion_id, estacion, medido_en (timestamptz), aqi_general (texto), pm25, pm10, no2, co, so2, o3, t, h, p, w, wd, dew (todos en escala AQICN tal como vienen), consultado_en, respuesta_cruda (jsonb). Clave única: (estacion_id, medido_en).
- `pronostico_clima`: estacion_id, emitido_en (momento de la consulta), hora_objetivo, variables meteorológicas con su unidad clara, lat_cuadricula, lon_cuadricula. Clave única: (estacion_id, emitido_en, hora_objetivo).
- `pronostico_cams`: estacion_id, emitido_en, hora_objetivo, pm2_5, lat_cuadricula, lon_cuadricula. Clave única: (estacion_id, emitido_en, hora_objetivo).
- `ejecuciones`: registro de cada corrida (inicio, tarea, estado, filas insertadas, errores).

Reglas:
- Guardar todas las fechas como timestamptz (Ecuador es UTC−5, sin horario de verano).
- Inserciones idempotentes (`ON CONFLICT DO NOTHING`) para que repetir una ejecución no duplique datos.
- `emitido_en` es el momento de nuestra consulta; la hora real de la corrida del modelo no la da la API, y eso quedará declarado en la tesis.

## 7. Robustez

- Tiempo de espera en cada solicitud y reintentos con espera creciente.
- Si falla una estación o una fuente, seguir con las demás y registrar el error.
- Tolerar campos faltantes, `null` y "-" sin romper la ejecución.
- Mensajes de registro claros, para leerlos en la pestaña Actions de GitHub.

## 8. Secretos y seguridad

- `WAQI_TOKEN` y `DATABASE_URL` nunca en el código.
- En local: archivo `.env` incluido en `.gitignore`.
- En GitHub: Settings > Secrets and variables > Actions.
- El token de WAQI se compartió en un chat; evaluar si conviene pedir uno nuevo.

## 9. GitHub Actions

- Un flujo con disparador programado (cron en UTC, ojo con la conversión desde hora de Ecuador) y disparador manual (`workflow_dispatch`) para pruebas.
- Dependencias mínimas (por ejemplo `requests` y un cliente de PostgreSQL).
- Tener en cuenta:
  - Si el repositorio es privado, hay un cupo mensual de minutos gratuitos; verificarlo.
  - Los flujos programados pueden arrancar con algunos minutos de retraso.
  - GitHub puede desactivar los flujos programados tras unos 60 días sin actividad en el repositorio. La recolección dura de septiembre a diciembre, así que hay que prever cómo evitarlo.

## 10. Orden de trabajo

1. Estructura del repositorio y dependencias.
2. Guiarme para crear el proyecto en Neon y obtener `DATABASE_URL`.
3. Crear las tablas.
4. Script del recolector y prueba local con una ejecución manual.
5. Revisar juntos los datos en Neon (estaciones, horas, pronósticos con emisión y hora objetivo).
6. Guiarme para cargar los secretos en GitHub.
7. Crear el flujo de GitHub Actions y probarlo con el disparador manual.
8. Checklist de verificación tras 24 a 48 horas.

## 11. Cómo sabremos que funciona (tras 24 horas)

- Alrededor de 24 registros por estación activa en `mediciones_aqicn` (puede haber huecos de la fuente) y ninguno duplicado.
- Hora de medición coherente con la que muestra la página de la estación en aqicn.org.
- 8 emisiones por estación en `pronostico_clima` y en `pronostico_cams`, cada una con al menos 24 horas objetivo.
- El Camal registrado como sin datos, sin romper la ejecución.
- La tabla `ejecuciones` sin errores o con errores explicados.

## 12. Fuera de alcance por ahora

- El modelo de pronóstico, la web y la conversión de AQI a µg/m³.
- La carga de los datos históricos de la REMMAQ (se trabajará aparte en un cuaderno).
