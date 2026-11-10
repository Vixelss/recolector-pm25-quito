"""Servicio de pronóstico horario de PM2.5 (XGBoost versión A, un modelo por horizonte).

Aplica cada hora los 24 modelos entrenados en el análisis de la tesis (notebook 05)
a las mediciones recientes que guarda el recolector, y publica los datos de la página.
"""
