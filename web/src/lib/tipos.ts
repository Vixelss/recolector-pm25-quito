// Contrato de datos.json (lo genera pronostico/exportar.py cada hora).
// Las horas son de Ecuador (UTC−5), en texto "AAAA-MM-DDTHH:MM"; la hora t cubre de t a t+1.

export type Categoria = 'deseable' | 'aceptable' | 'precaución' | 'alerta' | 'alarma' | 'emergencia'

export interface HoraPronostico {
  h: number
  hora: string
  pm25: number
  inferior: number
  superior: number
  categoria: Categoria
  cerca_del_limite: boolean
}

export interface PuntoHistorial {
  hora: string
  medido: number | null
  pronostico_6h: number | null
  pronostico_24h: number | null
}

export interface Estacion {
  id: number
  clave: string
  nombre: string
  lat: number
  lon: number
  estado: 'ok' | 'incompleto' | 'sin_datos'
  ultimo_medido: { hora: string; pm25: number | null } | null
  ahora: { hora: string; pm25: number; categoria: Categoria; cerca_del_limite: boolean; horizonte: number } | null
  pronostico: HoraPronostico[]
  ultimos_7_dias: PuntoHistorial[]
}

export interface Metricas {
  n: number
  mae?: number
  sesgo?: number
  categoria_correcta?: number
  episodios?: number
  avisos?: number
  precision?: number | null
  sensibilidad?: number | null
  f1?: number | null
  mae_por_horizonte?: (number | null)[]
}

export interface Ventana {
  desde: string | null
  modelos: Record<'XGBoost A' | 'persistencia', Metricas>
  con_cams: Record<'XGBoost A' | 'persistencia' | 'CAMS', Metricas>
}

export interface Datos {
  generado_en: string
  ahora: string
  emision: string | null
  datos_hasta: string | null
  modelo: { version: string; fin_entrenamiento: string; banda: string }
  umbrales: { episodio: number; aviso: number; horas_sin_datos: number }
  estaciones: Estacion[]
  desempeno: { pronosticos_desde: string | null; ventanas: Partial<Record<'7d' | '30d', Ventana>> }
}
