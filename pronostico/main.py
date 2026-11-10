"""Pronóstico horario: lee de Neon, pronostica 24 h para 3 estaciones y guarda.

Uso:
    python -m pronostico.main                       # emisión = hora en punto actual de Ecuador
    python -m pronostico.main --seco                # calcula y muestra, sin guardar
    python -m pronostico.main --emision 2026-11-10T08:00

Se ejecuta en GitHub Actions después del recolector, como paso separado: si falla,
la recolección de esa hora ya quedó guardada.
"""

import argparse
import os
import sys
import time
from datetime import datetime

import pandas as pd
import psycopg

from .config import ESTACIONES, HORAS_SIN_DATOS, ZONA_ECUADOR
from .datos import leer_mediciones, serie_pm25
from .guardar import guardar
from .modelo import pronosticar, sin_datos_recientes


def emision_actual() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(ZONA_ECUADOR).replace(tzinfo=None)).floor("h")


def main() -> int:
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument("--seco", action="store_true", help="no guardar en la base")
    args.add_argument("--emision", help="hora de emisión (Ecuador), por defecto la actual")
    a = args.parse_args()

    if not os.environ.get("DATABASE_URL"):
        from dotenv import load_dotenv     # solo en ejecución local
        load_dotenv()
    inicio = time.time()
    emision = pd.Timestamp(a.emision).floor("h") if a.emision else emision_actual()

    with psycopg.connect(os.environ["DATABASE_URL"]) as conexion:
        mediciones = leer_mediciones(conexion, emision)
        serie = serie_pm25(mediciones, emision)
        p = pronosticar(serie, emision)
        nuevas = 0 if a.seco else guardar(conexion, p)

    print(f"Emisión {emision:%Y-%m-%d %H:%M} (hora de Ecuador) | {len(mediciones)} mediciones leídas | "
          f"{len(p)} pronósticos | {'sin guardar (--seco)' if a.seco else f'{nuevas} filas nuevas'} | "
          f"{time.time() - inicio:.1f} s")
    for e in ESTACIONES:
        g = p[p.estacion == e].set_index("horizonte")
        ultimo = g.ultimo_dato.iloc[0]
        estado = ("SIN DATOS RECIENTES" if sin_datos_recientes(ultimo, emision)
                  else "datos incompletos" if g.datos_incompletos.iloc[0] else "ok")
        print(f"  {e:<10} último dato {ultimo:%d/%m %H:%M} | h1 {g.pm25_ugm3[1]:5.1f} | h6 {g.pm25_ugm3[6]:5.1f} | "
              f"h12 {g.pm25_ugm3[12]:5.1f} | h24 {g.pm25_ugm3[24]:5.1f} µg/m³ | "
              f"{int(g.cerca_del_limite.sum())} h cerca del límite | {estado}")
    if any(sin_datos_recientes(u, emision) for u in p.ultimo_dato.unique()):
        print(f"Aviso: alguna estación no tiene mediciones en las últimas {HORAS_SIN_DATOS} h (RF8)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
