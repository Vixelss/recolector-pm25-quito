// Las horas llegan como texto de Ecuador ("2026-11-10T08:00"); se formatean sin pasar por la
// zona horaria del navegador, para que se vean igual desde cualquier país.

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function partes(t: string) {
  const [f, h] = t.split('T')
  const [a, m, d] = f.split('-').map(Number)
  return { a, m, d, hh: h.slice(0, 5), dia: new Date(Date.UTC(a, m - 1, d)).getUTCDay() }
}

export const hora = (t: string) => partes(t).hh

export function dia(t: string) {
  const p = partes(t)
  return `${DIAS[p.dia]} ${p.d} ${MESES[p.m - 1]}`
}

export const diaHora = (t: string) => `${dia(t)}, ${hora(t)}`

export function num(x: number | null | undefined, d = 1) {
  return x == null ? '—' : x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function pct(x: number | null | undefined, d = 0) {
  return x == null ? '—' : `${(x * 100).toLocaleString('es-EC', { maximumFractionDigits: d })} %`
}

// Hora actual de Ecuador en el mismo formato que datos.json
export function ahoraEcuador() {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 16)
}

export function horasEntre(a: string, b: string) {
  return (Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 3600e3
}
