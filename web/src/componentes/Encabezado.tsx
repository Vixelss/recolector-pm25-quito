import { ahoraEcuador, dia, hora, horasEntre } from '@/lib/formato'
import type { Datos } from '@/lib/tipos'

const cuando = (t: string | null) => (t ? `${dia(t)}, ${hora(t)}` : '—')

// Título y momento del pronóstico (RF7); aviso si los datos no están frescos (RF4)
export function Encabezado({ datos }: { datos: Datos }) {
  const atrasado = datos.emision != null && horasEntre(datos.emision, ahoraEcuador()) >= 2
  return (
    <header>
      <div className="border-b border-regla bg-superficie">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-[0.8125rem] sm:px-6">
          <span className="font-medium text-tinta">Distrito Metropolitano de Quito · PM2.5</span>
          <span className="text-tinta-3">Proyecto académico de titulación, no oficial</span>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-8 pt-9 sm:px-6 md:grid-cols-[1fr_auto] md:items-end md:pt-12">
        <div>
          <h1 className="text-[2.25rem] leading-[1.1] font-bold tracking-[-0.02em] sm:text-[2.75rem]">Aire de Quito</h1>
          <p className="mt-3 max-w-[60ch] text-[1.0625rem] leading-relaxed text-tinta-2">
            Pronóstico de material particulado fino (PM2.5) para las próximas 24 horas en tres estaciones de la red de
            monitoreo, con un modelo de aprendizaje automático que se actualiza cada hora.
          </p>
        </div>
        <dl className="caja grid grid-cols-2 divide-x divide-regla-suave text-[0.8125rem] md:min-w-[22rem]">
          <div className="px-4 py-3">
            <dt className="text-tinta-3">Pronóstico emitido</dt>
            <dd className="cifra mt-0.5 whitespace-nowrap text-[0.9375rem] font-semibold text-tinta sm:text-[1.0625rem]">{cuando(datos.emision)}</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-tinta-3">Con datos medidos hasta</dt>
            <dd className="cifra mt-0.5 whitespace-nowrap text-[0.9375rem] font-semibold text-tinta sm:text-[1.0625rem]">{cuando(datos.datos_hasta)}</dd>
          </div>
          <div className="col-span-2 border-t border-regla-suave px-4 py-2 text-[0.75rem] text-tinta-3">
            Hora de Ecuador (UTC−5) · se actualiza cada hora
          </div>
        </dl>
      </div>

      {atrasado && (
        <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <p role="status" className="rounded-md border border-aviso/30 bg-aviso-fondo px-4 py-2.5 text-sm text-aviso">
            El último pronóstico tiene más de dos horas. Puede haber una demora en la actualización; los valores
            mostrados corresponden a la emisión indicada.
          </p>
        </div>
      )}
    </header>
  )
}
