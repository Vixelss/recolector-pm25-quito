import { ahoraEcuador, dia, hora, horasEntre } from '@/lib/formato'
import type { Datos } from '@/lib/tipos'

// Título y momento del pronóstico (RF7); aviso si los datos no están frescos (RF4)
export function Encabezado({ datos }: { datos: Datos }) {
  const atrasado = datos.emision != null && horasEntre(datos.emision, ahoraEcuador()) >= 2
  return (
    <header className="aparece pb-8 pt-10 md:pt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-tinta pb-3">
        <span className="rotulo">Boletín horario · Distrito Metropolitano de Quito</span>
        <span className="rotulo">Proyecto académico · datos preliminares</span>
      </div>
      <div className="mt-8 grid items-end gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="titulo text-[3.4rem] leading-[0.92] font-[420] sm:text-[4.6rem] md:text-[5.6rem]">
            Aire de Quito
          </h1>
          <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-tinta-2">
            Pronóstico de material particulado fino (PM2.5) para las próximas 24 horas en tres estaciones de la
            red de monitoreo, con un modelo de aprendizaje automático que se actualiza cada hora.
          </p>
        </div>
        <dl className="grid min-w-[15rem] gap-3 border-l border-regla pl-5 text-sm">
          <div>
            <dt className="rotulo">Pronóstico emitido</dt>
            <dd className="cifra mt-0.5 text-lg">{datos.emision ? `${dia(datos.emision)} · ${hora(datos.emision)}` : '—'}</dd>
          </div>
          <div>
            <dt className="rotulo">Con datos medidos hasta</dt>
            <dd className="cifra mt-0.5 text-lg">{datos.datos_hasta ? `${dia(datos.datos_hasta)} · ${hora(datos.datos_hasta)}` : '—'}</dd>
          </div>
          <div className="text-[0.78rem] text-tinta-3">Hora de Ecuador (UTC−5)</div>
        </dl>
      </div>
      {atrasado && (
        <p role="status" className="mt-6 rounded-md border border-aviso/30 bg-aviso-fondo px-4 py-2.5 text-sm text-aviso">
          El último pronóstico tiene más de dos horas. Puede haber una demora en la actualización; los valores
          mostrados corresponden a la emisión indicada.
        </p>
      )}
    </header>
  )
}
