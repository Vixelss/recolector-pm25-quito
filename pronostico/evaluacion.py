"""Desempeño del modelo en operación (RF5): compara los pronósticos guardados con lo que AQICN
publicó después, frente a la persistencia y a CAMS, con las mismas definiciones del notebook 05.

- Observado: PM2.5 de AQICN convertido a µg/m³ y limpio (L1–L3), con todo lo publicado hasta ahora.
- Persistencia: último dato publicado en la emisión (E−2, o E−3/E−4 si falta), igual que pm_ultimo.
- CAMS: emisión de CAMS guardada a la misma hora de emisión (solo existen cada 3 h); el valor de la
  hora t es la media de CAMS en t y t+1 (CAMS da valores instantáneos; la REMMAQ, promedios de t a t+1).
"""

import numpy as np
import pandas as pd

from .config import CORTES_IQCA, ESTACIONES, HORIZONTES, RETRASO, UMBRAL_AVISO, UMBRAL_EPISODIO

MODELOS = ["XGBoost A", "persistencia", "CAMS"]


def tabla(pronosticos: pd.DataFrame, serie: pd.DataFrame, cams: pd.DataFrame) -> pd.DataFrame:
    """Una fila por pronóstico guardado cuya hora objetivo ya tiene medición."""
    obs = serie[ESTACIONES].stack().rename("y")
    obs.index.names = ["hora_objetivo", "estacion"]
    persist = serie[ESTACIONES].ffill(limit=2).shift(RETRASO).stack().rename("persistencia")
    persist.index.names = ["hora_emision", "estacion"]
    t = (pronosticos.rename(columns={"pm25_ugm3": "XGBoost A"})
         .join(obs, on=["hora_objetivo", "estacion"])
         .join(persist, on=["hora_emision", "estacion"]))
    if len(cams):
        c = cams.sort_values(["estacion", "hora_emision", "hora_objetivo"])
        c["siguiente"] = c.groupby(["estacion", "hora_emision"]).pm2_5_ugm3.shift(-1)
        consecutiva = c.groupby(["estacion", "hora_emision"]).hora_objetivo.shift(-1) == c.hora_objetivo + pd.Timedelta(hours=1)
        c["CAMS"] = ((c.pm2_5_ugm3 + c.siguiente) / 2).where(consecutiva)
        t = t.join(c.set_index(["estacion", "hora_emision", "hora_objetivo"]).CAMS,
                   on=["estacion", "hora_emision", "hora_objetivo"])
    else:
        t["CAMS"] = np.nan
    return t[t.y.notna()]


def _categoria(x):
    return np.searchsorted(CORTES_IQCA, np.asarray(x, float), side="left")


def metricas(t: pd.DataFrame, modelo: str) -> dict:
    g = t[t[modelo].notna()]
    if g.empty:
        return {"n": 0}
    y, p = g.y.to_numpy(), g[modelo].to_numpy()
    e = p - y
    umbral = UMBRAL_AVISO if modelo == "XGBoost A" else UMBRAL_EPISODIO     # aviso del modelo desde 20
    obs, pre = y > UMBRAL_EPISODIO, p > umbral
    vp = int((obs & pre).sum())
    precision = vp / pre.sum() if pre.sum() else None
    sensibilidad = vp / obs.sum() if obs.sum() else None
    f1 = (2 * precision * sensibilidad / (precision + sensibilidad)
          if precision is not None and sensibilidad is not None and precision + sensibilidad > 0 else None)
    por_h = g.assign(ae=np.abs(e)).groupby("horizonte").ae.mean().reindex(HORIZONTES)
    return {
        "n": int(len(g)), "mae": float(np.abs(e).mean()), "sesgo": float(e.mean()),
        "categoria_correcta": float((_categoria(y) == _categoria(p)).mean() * 100),
        "episodios": int(obs.sum()), "avisos": int(pre.sum()),
        "precision": precision, "sensibilidad": sensibilidad, "f1": f1,
        "mae_por_horizonte": [None if np.isnan(v) else round(float(v), 3) for v in por_h],
    }


def desempeno(t: pd.DataFrame, ahora: pd.Timestamp) -> dict:
    ventanas = {}
    for nombre, dias in (("7d", 7), ("30d", 30)):
        v = t[t.hora_objetivo > ahora - pd.Timedelta(days=dias)]
        # Comparación justa: todos los modelos en las mismas filas; CAMS aparte en las filas con CAMS
        comun = v[v[["XGBoost A", "persistencia"]].notna().all(axis=1)]
        con_cams = v[v[["XGBoost A", "persistencia", "CAMS"]].notna().all(axis=1)]
        ventanas[nombre] = {
            "desde": None if v.empty else f"{v.hora_objetivo.min():%Y-%m-%dT%H:%M}",
            "modelos": {m: metricas(comun, m) for m in ("XGBoost A", "persistencia")},
            "con_cams": {m: metricas(con_cams, m) for m in MODELOS},
        }
    return ventanas
