import { POR_CLAVE } from '@/lib/iqca'
import type { Categoria } from '@/lib/tipos'
import { cn } from './cn'

export function InsigniaCategoria({ categoria, className }: { categoria: Categoria; className?: string }) {
  const c = POR_CLAVE[categoria]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em]', className)}
      style={{ background: c.color, borderColor: c.borde, color: c.tinta }}
    >
      {c.nombre}
    </span>
  )
}

export function AvisoLimite({ className, corto = false }: { className?: string; corto?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-aviso-fondo px-2.5 py-0.5 text-[0.72rem] font-medium text-aviso', className)}>
      <svg aria-hidden width="11" height="11" viewBox="0 0 12 12"><path d="M6 1 11 10.5H1Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M6 4.6v2.6M6 8.6v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      {corto ? 'Cerca del límite' : 'Cerca del límite: podría ser aceptable'}
    </span>
  )
}

export function Muestra({ categoria, size = 12 }: { categoria: Categoria; size?: number }) {
  const c = POR_CLAVE[categoria]
  return <span aria-hidden className="inline-block shrink-0 rounded-full border" style={{ width: size, height: size, background: c.color, borderColor: c.borde }} />
}
