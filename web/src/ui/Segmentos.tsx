import { cn } from './cn'

// Control segmentado accesible (grupo de botones con estado presionado)
export function Segmentos<T extends string>({ opciones, valor, onCambio, etiqueta, className }: {
  opciones: { valor: T; texto: string }[]; valor: T; onCambio: (v: T) => void; etiqueta: string; className?: string
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cn('inline-flex rounded-full border border-regla bg-hoja p-0.5', className)}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onCambio(o.valor)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-[0.8rem] font-medium transition-colors',
            o.valor === valor ? 'bg-tinta text-hoja' : 'text-tinta-2 hover:text-tinta',
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
