import { hora, num } from '@/lib/formato'
import { POR_CLAVE } from '@/lib/iqca'
import type { Estacion } from '@/lib/tipos'
import { cn } from '@/ui/cn'
import { AvisoLimite, InsigniaCategoria } from '@/ui/Insignia'

// Estado actual de una estación: pronóstico de la hora en curso y último dato medido (RF7, RF8)
export function TarjetaEstacion({ e, activa, onElegir, horaActual }: { e: Estacion; activa: boolean; onElegir: () => void; horaActual: string }) {
  const sin = e.estado === 'sin_datos' || !e.ahora
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activa}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border bg-hoja px-5 py-4 text-left transition-all',
        activa ? 'border-tinta shadow-[0_10px_30px_-18px_rgba(20,24,31,.55)]' : 'border-regla hover:border-tinta-3',
      )}
    >
      {!sin && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: POR_CLAVE[e.ahora!.categoria].color, boxShadow: `inset -1px 0 0 ${POR_CLAVE[e.ahora!.categoria].borde}` }} />
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="titulo text-[1.45rem] leading-none">{e.nombre}</h3>
        <span className="rotulo">{sin ? 'sin datos' : `${e.ahora!.hora === horaActual ? 'ahora' : 'pronóstico'} · ${hora(e.ahora!.hora)}`}</span>
      </div>
      {sin ? (
        <p className="mt-4 text-sm leading-relaxed text-tinta-2">
          Sin datos recientes: la estación no tiene mediciones en las últimas 6 horas, así que no se publica su
          pronóstico.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-2">
            <span className="cifra text-[2.6rem] leading-none font-medium">{num(e.ahora!.pm25)}</span>
            <span className="mb-1 text-sm text-tinta-3">µg/m³</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <InsigniaCategoria categoria={e.ahora!.categoria} />
            {e.ahora!.cerca_del_limite && <AvisoLimite corto />}
            {e.estado === 'incompleto' && (
              <span className="inline-flex items-center rounded-full border border-regla px-2.5 py-0.5 text-[0.72rem] text-tinta-2">
                Datos incompletos
              </span>
            )}
          </div>
        </>
      )}
      <p className="mt-3 border-t border-regla-suave pt-2 text-[0.78rem] text-tinta-3">
        Último medido:{' '}
        {e.ultimo_medido ? <span className="cifra text-tinta-2">{num(e.ultimo_medido.pm25)} µg/m³ a las {hora(e.ultimo_medido.hora)}</span> : '—'}
      </p>
    </button>
  )
}
