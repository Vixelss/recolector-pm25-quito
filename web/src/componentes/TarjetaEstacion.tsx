import { hora, num } from '@/lib/formato'
import type { Estacion } from '@/lib/tipos'
import { cn } from '@/ui/cn'
import { AvisoLimite, InsigniaCategoria } from '@/ui/Insignia'

// Fila de una estación en el panel: pronóstico de la hora en curso y último dato medido (RF7, RF8)
export function TarjetaEstacion({ e, activa, onElegir, horaActual }: { e: Estacion; activa: boolean; onElegir: () => void; horaActual: string }) {
  const sin = e.estado === 'sin_datos' || !e.ahora
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activa}
      className={cn(
        'block w-full px-5 py-4 text-left transition-colors duration-150',
        activa ? 'bg-elegida' : 'hover:bg-hundido',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={cn('text-[1.0625rem] leading-tight', activa ? 'font-bold' : 'font-semibold')}>{e.nombre}</h3>
        <span className="cifra text-[0.8125rem] text-tinta-3">
          {sin ? 'Sin datos' : `${e.ahora!.hora === horaActual ? 'Ahora' : 'Pronóstico'}, ${hora(e.ahora!.hora)}`}
        </span>
      </div>
      {sin ? (
        <p className="mt-2 text-sm leading-relaxed text-tinta-2">
          La estación no tiene mediciones en las últimas 6 horas, así que no se publica su pronóstico.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-baseline gap-1">
            <span className="cifra text-[1.875rem] leading-none font-semibold tracking-[-0.01em]">{num(e.ahora!.pm25)}</span>
            <span className="text-[0.8125rem] text-tinta-3">µg/m³</span>
          </span>
          <span className="flex flex-wrap gap-1.5">
            <InsigniaCategoria categoria={e.ahora!.categoria} />
            {e.ahora!.cerca_del_limite && <AvisoLimite corto />}
            {e.estado === 'incompleto' && (
              <span className="inline-flex items-center rounded-[4px] border border-regla px-2 py-0.5 text-[0.8125rem] text-tinta-2">Datos incompletos</span>
            )}
          </span>
        </div>
      )}
      <p className="mt-2 text-[0.8125rem] text-tinta-3">
        Último medido:{' '}
        {e.ultimo_medido ? <span className="cifra text-tinta-2">{num(e.ultimo_medido.pm25)} µg/m³ a las {hora(e.ultimo_medido.hora)}</span> : '—'}
      </p>
    </button>
  )
}
