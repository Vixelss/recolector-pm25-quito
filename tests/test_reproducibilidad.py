"""El servicio debe dar los mismos pronósticos que el notebook 05 del análisis.

Recalcula cada emisión de la evaluación en vivo del 05 con las funciones del servicio,
usando la misma copia de las mediciones de AQICN, y compara con las predicciones guardadas
(vivo_predicciones.parquet). Necesita la carpeta ../analisis (no está en el repositorio:
los datos no se publican); si no existe, la prueba se salta.

Uso: python -m tests.test_reproducibilidad   (o con pytest)
"""

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from pronostico.datos import serie_pm25
from pronostico.modelo import pronosticar
from pronostico.variables import dias_feriados
from pronostico.config import META

ANALISIS = Path(__file__).resolve().parents[2] / "analisis"
MEDICIONES = ANALISIS / "datos_procesados" / "recolector" / "aqicn_pm25.csv"
PREDICCIONES = ANALISIS / "datos_procesados" / "vivo_predicciones.parquet"
TOLERANCIA = 0.001   # µg/m³ (criterio de aceptación de RF4)


def comparar(emisiones=None):
    mediciones = pd.read_csv(MEDICIONES)
    ref = pd.read_parquet(PREDICCIONES)[["emision", "estacion", "h", "XGBoost A"]]
    if emisiones is None:
        emisiones = sorted(ref.emision.unique())
    filas = []
    for E in emisiones:
        E = pd.Timestamp(E)
        p = pronosticar(serie_pm25(mediciones, E), E)
        filas.append(p[["hora_emision", "estacion", "horizonte", "pm25_ugm3"]])
    nuestro = pd.concat(filas).rename(columns={"hora_emision": "emision", "horizonte": "h"})
    c = ref.merge(nuestro, on=["emision", "estacion", "h"], how="inner")
    c["dif"] = (c.pm25_ugm3 - c["XGBoost A"]).abs()
    return c


def test_feriados_iguales_al_entrenamiento():
    calculados = [f"{d:%Y-%m-%d}" for d in dias_feriados(range(2018, 2027))]
    assert calculados == META["feriados"]


def test_reproduce_notebook_05():
    import pytest
    if not PREDICCIONES.exists():
        pytest.skip("no está la carpeta del análisis")
    c = comparar()
    assert len(c) > 0
    assert (c.dif < TOLERANCIA).mean() > 0.99, c.sort_values("dif").tail()


if __name__ == "__main__":
    test_feriados_iguales_al_entrenamiento()
    print("Feriados 2018–2026: iguales a metadatos.json")
    n = int(sys.argv[1]) if len(sys.argv) > 1 else None
    ref_emisiones = sorted(pd.read_parquet(PREDICCIONES).emision.unique())
    emisiones = ref_emisiones[:: max(1, len(ref_emisiones) // n)] if n else ref_emisiones
    t0 = time.time()
    c = comparar(emisiones)
    print(f"{len(emisiones)} emisiones, {len(c):,} predicciones comparadas en {time.time() - t0:.0f} s")
    print(f"Diferencia máxima: {c.dif.max():.2e} µg/m³ | dentro de {TOLERANCIA}: {(c.dif < TOLERANCIA).mean() * 100:.3f} %")
    malas = c[c.dif >= TOLERANCIA]
    if len(malas):
        print(f"Predicciones fuera de tolerancia: {len(malas)} en {malas.emision.nunique()} emisiones")
        print(malas.groupby(["estacion"]).agg(n=("dif", "size"), max=("dif", "max"), desde=("emision", "min"), hasta=("emision", "max")))
