"""Acceso a la base de datos (Neon / PostgreSQL)."""

from datetime import datetime

import psycopg
from psycopg.types.json import Jsonb


def conectar(url: str) -> psycopg.Connection:
    # autocommit: cada inserción se confirma de inmediato; si falla una tabla,
    # lo ya guardado en las otras no se pierde.
    return psycopg.connect(url, autocommit=True, connect_timeout=15)


def _insertar(con: psycopg.Connection, tabla: str, filas: list[dict]) -> int:
    """Inserta filas ignorando las que ya existen; devuelve cuántas son nuevas.

    ON CONFLICT DO NOTHING hace la inserción idempotente: si la clave
    primaria ya existe (misma estación y misma hora), la fila se descarta
    sin error. Así, repetir una ejecución no duplica datos.
    """
    if not filas:
        return 0
    columnas = list(filas[0])
    sql = (f"INSERT INTO {tabla} ({', '.join(columnas)}) "
           f"VALUES ({', '.join('%(' + c + ')s' for c in columnas)}) "
           f"ON CONFLICT DO NOTHING")
    with con.cursor() as cur:
        # executemany envía todas las filas juntas (modo pipeline de psycopg),
        # mucho más rápido que una ida y vuelta por fila.
        cur.executemany(sql, filas)
        return cur.rowcount  # suma de filas realmente insertadas


def emision_guardada(con, tabla: str, hora_emision: datetime) -> bool:
    """Indica si la tabla de pronóstico ya tiene filas de esa emisión (D26)."""
    with con.cursor() as cur:
        cur.execute(f"SELECT EXISTS (SELECT 1 FROM {tabla} WHERE hora_emision = %s)",
                    (hora_emision,))
        return cur.fetchone()[0]


def insertar_mediciones(con, filas: list[dict]) -> int:
    # La respuesta completa se guarda como JSONB.
    filas = [{**f, "respuesta_cruda": Jsonb(f["respuesta_cruda"])} for f in filas]
    return _insertar(con, "mediciones_aqicn", filas)


def insertar_clima(con, filas: list[dict]) -> int:
    return _insertar(con, "pronostico_clima", filas)


def insertar_cams(con, filas: list[dict]) -> int:
    return _insertar(con, "pronostico_cams", filas)


def insertar_cams_archivo(con, filas: list[dict]) -> int:
    return _insertar(con, "pronostico_cams_archivo", filas)


def registrar_ejecucion(con, iniciado_en: datetime, finalizado_en: datetime,
                        incluye_pronosticos: bool, estado: str, filas: dict,
                        errores: list[str], avisos: list[str], origen: str) -> None:
    con.execute(
        """INSERT INTO ejecuciones (iniciado_en, finalizado_en, incluye_pronosticos, estado,
                                    filas_mediciones, filas_clima, filas_cams,
                                    errores, avisos, origen)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (iniciado_en, finalizado_en, incluye_pronosticos, estado,
         filas["mediciones"], filas["clima"], filas["cams"],
         Jsonb(errores) if errores else None,
         Jsonb(avisos) if avisos else None,
         origen),
    )
