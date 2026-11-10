import type { Categoria } from './tipos'

// Índice Quiteño de Calidad del Aire (IQCA) para PM2.5. Rangos, colores y significado oficial:
// Requisitos_Sistema_Web.md, sección 6 (Galárraga Salinas, 2026; López-Terán et al., 2021; MDMQ, 2021).
// RF3: el sistema no emite recomendaciones propias, solo el significado oficial.
export interface InfoCategoria {
  clave: Categoria
  nombre: string
  indice: string
  rango: string
  color: string        // relleno
  borde: string        // contorno (el blanco necesita borde oscuro)
  tinta: string        // texto sobre el relleno
  significado: string
}

export const CATEGORIAS: InfoCategoria[] = [
  { clave: 'deseable', nombre: 'Deseable', indice: '0–50', rango: '0–25', color: '#ffffff', borde: '#1d2430', tinta: '#1d2430',
    significado: 'Calidad del aire óptima.' },
  { clave: 'aceptable', nombre: 'Aceptable', indice: '51–100', rango: '26–50', color: '#2f9e44', borde: '#1f6e2f', tinta: '#ffffff',
    significado: 'Calidad del aire buena.' },
  { clave: 'precaución', nombre: 'Precaución', indice: '101–200', rango: '51–150', color: '#8a9099', borde: '#5c626b', tinta: '#ffffff',
    significado: 'Puede afectar a personas con alta sensibilidad o problemas de salud.' },
  { clave: 'alerta', nombre: 'Alerta', indice: '201–300', rango: '151–250', color: '#f2c230', borde: '#a37f0f', tinta: '#1d2430',
    significado: 'Puede afectar a personas sensibles o con problemas de salud.' },
  { clave: 'alarma', nombre: 'Alarma', indice: '301–400', rango: '251–350', color: '#f08a24', borde: '#a85a10', tinta: '#1d2430',
    significado: 'Puede afectar a gran parte de la población.' },
  { clave: 'emergencia', nombre: 'Emergencia', indice: '401–500', rango: 'más de 350', color: '#d63b3b', borde: '#8f2222', tinta: '#ffffff',
    significado: 'Peligrosa para toda la población.' },
]

export const POR_CLAVE = Object.fromEntries(CATEGORIAS.map((c) => [c.clave, c])) as Record<Categoria, InfoCategoria>

export const SIN_DATOS = { color: '#c5cad1', borde: '#7d848d' }
