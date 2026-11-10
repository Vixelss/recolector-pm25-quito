"""Genera web/public/datos.json, lo único que lee la página.

Lleva solo lo que la página muestra: el último pronóstico, ~7 días de mediciones para comparar
y las métricas de desempeño. No se guarda en git (términos de AQICN: no redistribuir datos
archivados); se publica directamente en GitHub Pages en cada ejecución.

Uso: python -m pronostico.exportar [--salida ruta]
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import pandas as pd
import psycopg

from .config import (BANDA, COORDENADAS, ESTACIONES, HORAS_SIN_DATOS, ID_DE, META, NOMBRE, UMBRAL_AVISO,
                     UMBRAL_EPISODIO, VERSION_MODELO)
from .datos import leer_cams, leer_mediciones, leer_pronosticos, serie_pm25
from .evaluacion import desempeno, tabla
from .main import emision_actual
from .modelo import sin_datos_recientes

SALIDA = Path(__file__).resolve().parents[1] / "web" / "public" / "datos.json"
DIAS_EVALUACION = 30
DIAS_GRAFICO = 7


def _iso(t):
    return None if t is None or pd.isna(t) else f"{pd.Timestamp(t):%Y-%m-%dT%H:%M}"


def _num(x, d=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) or pd.isna(x) else round(float(x), d)


def construir(serie: pd.DataFrame, pron: pd.DataFrame, cams: pd.DataFrame, ahora: pd.Timestamp) -> dict:
    ultima = pron.hora_emision.max() if len(pron) else None
    estaciones = []
    for e in ESTACIONES:
        s = serie[e]
        ultimo = s.last_valid_index()
        sin_datos = sin_datos_recientes(ultimo, ahora)
        pe = pron[pron.estacion == e]
        ult = pe[pe.hora_emision == ultima].sort_values("horizonte")
        actual = pe[pe.hora_objetivo == ahora].sort_values("horizonte").head(1)
        incompleto = bool(ult.datos_incompletos.any()) if len(ult) else False
        estado = "sin_datos" if sin_datos or ult.empty else ("incompleto" if incompleto else "ok")
        horas = pd.date_range(ahora - pd.Timedelta(days=DIAS_GRAFICO), ahora, freq="h")
        a6 = pe[pe.horizonte == 6].set_index("hora_objetivo").pm25_ugm3
        a24 = pe[pe.horizonte == 24].set_index("hora_objetivo").pm25_ugm3
        estaciones.append({
            "id": ID_DE[e], "clave": e, "nombre": NOMBRE[e],
            "lat": COORDENADAS[ID_DE[e]][0], "lon": COORDENADAS[ID_DE[e]][1],
            "estado": estado,
            "ultimo_medido": None if ultimo is None else {"hora": _iso(ultimo), "pm25": _num(s[ultimo])},
            # RF8: sin datos recientes → no se publica el pronóstico
            "ahora": None if sin_datos or actual.empty else {
                "hora": _iso(ahora), "pm25": _num(actual.pm25_ugm3.iloc[0]), "categoria": actual.categoria.iloc[0],
                "cerca_del_limite": bool(actual.cerca_del_limite.iloc[0]), "horizonte": int(actual.horizonte.iloc[0])},
            "pronostico": [] if sin_datos else [
                {"h": int(r.horizonte), "hora": _iso(r.hora_objetivo), "pm25": _num(r.pm25_ugm3),
                 "inferior": _num(r.banda_inferior), "superior": _num(r.banda_superior),
                 "categoria": r.categoria, "cerca_del_limite": bool(r.cerca_del_limite)} for r in ult.itertuples()],
            "ultimos_7_dias": [
                {"hora": _iso(t), "medido": _num(s.get(t)), "pronostico_6h": _num(a6.get(t)),
                 "pronostico_24h": _num(a24.get(t))} for t in horas],
        })
    evaluacion = tabla(pron, serie, cams) if len(pron) else pd.DataFrame()
    datos_hasta = max((x["ultimo_medido"]["hora"] for x in estaciones if x["ultimo_medido"]), default=None)
    return {
        "generado_en": _iso(pd.Timestamp.now(tz="America/Guayaquil").tz_localize(None)),
        "ahora": _iso(ahora),
        "emision": _iso(ultima),
        "datos_hasta": datos_hasta,
        "modelo": {"version": VERSION_MODELO, "fin_entrenamiento": META["fin_entrenamiento"][:10],
                   "banda": BANDA["periodo"]},
        "umbrales": {"episodio": UMBRAL_EPISODIO, "aviso": UMBRAL_AVISO, "horas_sin_datos": HORAS_SIN_DATOS},
        "estaciones": estaciones,
        "desempeno": {
            "pronosticos_desde": _iso(pron.hora_emision.min()) if len(pron) else None,
            "ventanas": desempeno(evaluacion, ahora) if len(evaluacion) else {},
        },
    }


def _sin_nan(x):
    if isinstance(x, dict):
        return {k: _sin_nan(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_sin_nan(v) for v in x]
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return None
    return x


def main() -> int:
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument("--salida", default=str(SALIDA))
    args.add_argument("--ahora", help="hora de referencia (Ecuador), por defecto la actual")
    a = args.parse_args()
    if not os.environ.get("DATABASE_URL"):
        from dotenv import load_dotenv
        load_dotenv()
    inicio = time.time()
    ahora = pd.Timestamp(a.ahora).floor("h") if a.ahora else emision_actual()
    desde = ahora - pd.Timedelta(days=DIAS_EVALUACION + 1)
    with psycopg.connect(os.environ["DATABASE_URL"]) as conexion:
        mediciones = leer_mediciones(conexion, ahora, dias=DIAS_EVALUACION + 2)
        pron = leer_pronosticos(conexion, desde)
        cams = leer_cams(conexion, desde - pd.Timedelta(days=1))
    serie = serie_pm25(mediciones, ahora, dias=DIAS_EVALUACION + 2)
    datos = _sin_nan(construir(serie, pron, cams, ahora))
    salida = Path(a.salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"datos.json: emisión {datos['emision']} | {len(pron)} pronósticos guardados leídos | "
          f"{salida.stat().st_size / 1024:.0f} KB | {time.time() - inicio:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
