import { POR_CLAVE } from '@/lib/iqca'
import type { Categoria } from '@/lib/tipos'
import { cn } from './cn'

// Categoría: muestra de color + nombre (nunca solo color)
export function InsigniaCategoria({ categoria, className }: { categoria: Categoria; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[4px] border border-regla bg-superficie px-2 py-0.5 text-[0.8125rem] font-medium text-tinta', className)}>
      <Muestra categoria={categoria} size={10} />
      {POR_CLAVE[categoria].nombre}
    </span>
  )
}

export function AvisoLimite({ className, corto = false }: { className?: string; corto?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[4px] bg-aviso-fondo px-2 py-0.5 text-[0.8125rem] font-medium text-aviso', className)}>
      <svg aria-hidden width="10" height="10" viewBox="0 0 12 12"><path d="M6 1 11 10.5H1Z" fill="currentColor" /></svg>
      {corto ? 'Cerca del límite' : 'Cerca del límite: podría ser aceptable'}
    </span>
  )
}

export function Muestra({ categoria, size = 12 }: { categoria: Categoria; size?: number }) {
  const c = POR_CLAVE[categoria]
  return <span aria-hidden className="inline-block shrink-0 rounded-[2px] border" style={{ width: size, height: size, background: c.color, borderColor: c.borde }} />
}
