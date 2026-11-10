import type { ReactNode } from 'react'

// Piezas compartidas por los gráficos: ejes, retícula, márgenes, recuadro de detalle y leyenda

const MARCA = { fontSize: 11.5, fill: 'var(--color-tinta-3)', fontFamily: 'var(--font-sans)' }

export const MARGEN = { top: 8, right: 12, bottom: 4, left: -14 }
export const RETICULA = { vertical: false, stroke: 'var(--color-regla-suave)' }
export const EJE = {
  x: { tickLine: false, axisLine: { stroke: 'var(--color-regla)' }, tick: MARCA },
  y: { tickLine: false, axisLine: false, width: 48, tick: MARCA },
}
export const TIP = 'rounded-[4px] border border-regla bg-superficie px-3 py-2.5 text-[0.8125rem] shadow-[0_2px_6px_rgba(22,27,34,.12)]'

export function Leyenda({ elementos }: { elementos: { texto: string; marca: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-tinta-2" aria-label="Leyenda">
      {elementos.map((x) => <li key={x.texto} className="inline-flex items-center gap-2">{x.marca}{x.texto}</li>)}
    </ul>
  )
}
