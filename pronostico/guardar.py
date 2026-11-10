"""Guarda el pronóstico de una emisión en la tabla pronostico_modelo de Neon."""

import pandas as pd

from .config import ID_DE, VERSION_MODELO
from .datos import a_utc

COLUMNAS_TABLA = ["estacion_id", "hora_emision", "horizonte", "hora_objetivo", "pm25_ugm3", "banda_inferior",
                  "banda_superior", "categoria", "cerca_del_limite", "datos_incompletos", "variables_faltantes",
                  "ultimo_dato", "version_modelo"]


def filas_para_neon(p: pd.DataFrame) -> list[tuple]:
    filas = []
    for r in p.itertuples(index=False):
        filas.append((
            ID_DE[r.estacion], a_utc(r.hora_emision).to_pydatetime(), int(r.horizonte),
            a_utc(r.hora_objetivo).to_pydatetime(), float(r.pm25_ugm3), float(r.banda_inferior),
            float(r.banda_superior), str(r.categoria), bool(r.cerca_del_limite), bool(r.datos_incompletos),
            int(r.variables_faltantes), None if pd.isna(r.ultimo_dato) else a_utc(r.ultimo_dato).to_pydatetime(),
            VERSION_MODELO,
        ))
    return filas


def guardar(conexion, p: pd.DataFrame) -> int:
    """Inserta las filas; si la emisión ya estaba guardada no la sobrescribe. Devuelve las filas nuevas."""
    sql = (f"INSERT INTO pronostico_modelo ({', '.join(COLUMNAS_TABLA)}) "
           f"VALUES ({', '.join(['%s'] * len(COLUMNAS_TABLA))}) ON CONFLICT DO NOTHING")
    with conexion.cursor() as cur:
        cur.executemany(sql, filas_para_neon(p))
        nuevas = cur.rowcount
    conexion.commit()
    return nuevas
