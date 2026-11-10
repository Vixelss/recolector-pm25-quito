import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dia, num, pct } from '@/lib/formato'
import type { Datos, Metricas } from '@/lib/tipos'
import { Segmentos } from '@/ui/Segmentos'
import { EJE, Leyenda, MARGEN, RETICULA, TIP } from './comunes'

const MODELOS = [
  { clave: 'XGBoost A', nombre: 'Modelo (XGBoost)', color: 'var(--color-serie-1)' },
  { clave: 'persistencia', nombre: 'Persistencia', color: 'var(--color-serie-2)' },
  { clave: 'CAMS', nombre: 'CAMS (Copernicus)', color: 'var(--color-serie-3)' },
] as const


function Cifra({ rotulo, valor, unidad, nota }: { rotulo: string; valor: string; unidad?: string; nota?: string }) {
  return (
    <div className="bg-superficie px-4 py-3.5">
      <dt className="text-[0.8125rem] text-tinta-3">{rotulo}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5"><span className="cifra text-[1.625rem] leading-none font-semibold tracking-[-0.01em]">{valor}</span>{unidad && <span className="text-[0.8125rem] text-tinta-3">{unidad}</span>}</dd>
      {nota && <dd className="mt-1.5 text-[0.8125rem] leading-snug text-tinta-2">{nota}</dd>}
    </div>
  )
}

// RF5: error de los últimos 7 y 30 días por horizonte, frente a la persistencia y CAMS
export function Desempeno({ datos }: { datos: Datos }) {
  const [ventana, setVentana] = useState<'7d' | '30d'>('7d')
  const v = datos.desempeno.ventanas[ventana]
  const xgb: Metricas | undefined = v?.modelos['XGBoost A']
  const per: Metricas | undefined = v?.modelos.persistencia

  const control = (
    <Segmentos etiqueta="Periodo" valor={ventana} onCambio={setVentana}
      opciones={[{ valor: '7d', texto: 'Últimos 7 días' }, { valor: '30d', texto: 'Últimos 30 días' }]} />
  )
  if (!v || !xgb?.n) {
    return (
      <div className="space-y-4">
        {control}
        <p className="max-w-[68ch] text-sm leading-relaxed text-tinta-2">
          Todavía no hay pronósticos cuya hora ya se haya medido. El servicio guarda pronósticos desde{' '}
          {datos.desempeno.pronosticos_desde ? `el ${dia(datos.desempeno.pronosticos_desde)}` : 'su puesta en marcha'}; esta
          sección se completa sola a medida que pasan las horas.
        </p>
      </div>
    )
  }
  const mejora = xgb.mae != null && per?.mae ? (1 - xgb.mae / per.mae) : null
  const porHorizonte = Array.from({ length: 24 }, (_, i) => ({
    h: i + 1, 'XGBoost A': xgb.mae_por_horizonte?.[i] ?? null, persistencia: per?.mae_por_horizonte?.[i] ?? null,
  }))
  const cams = v.con_cams

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {control}
        <span className="cifra text-[0.8125rem] text-tinta-3">
          Desde {v.desde ? dia(v.desde) : '—'} · {xgb.n.toLocaleString('es-EC')} pronósticos comparados
        </span>
      </div>


      <dl className="caja grid gap-px overflow-hidden bg-regla-suave sm:grid-cols-2 lg:grid-cols-4">
        <Cifra rotulo="Error medio del modelo" valor={num(xgb.mae, 2)} unidad="µg/m³" nota="Promedio de la diferencia absoluta con lo medido" />
        <Cifra rotulo="Error de la persistencia" valor={num(per?.mae, 2)} unidad="µg/m³"
          nota={mejora != null ? `El modelo tiene ${mejora >= 0 ? `${pct(mejora)} menos` : `${pct(-mejora)} más`} de error` : undefined} />
        <Cifra rotulo="Categoría acertada" valor={xgb.categoria_correcta != null ? `${num(xgb.categoria_correcta, 0)} %` : '—'} nota="Horas en que la categoría pronosticada fue la real" />
        <Cifra rotulo="Episodios con aviso" valor={xgb.episodios ? pct(xgb.sensibilidad) : '—'}
          nota={xgb.episodios ? `${xgb.episodios} horas sobre 25 µg/m³; avisos acertados: ${pct(xgb.precision)}` : 'Sin horas sobre 25 µg/m³ en el periodo'} />
      </dl>

      <div>
        <h3 className="text-[1rem] font-semibold">Error medio por horizonte</h3>
        <p className="mt-1 text-[0.875rem] text-tinta-2">Cuántas horas antes se hizo el pronóstico (1 a 24 h)</p>
        <div className="caja mt-3">
          <div className="border-b border-regla-suave px-4 py-3">
            <Leyenda elementos={MODELOS.slice(0, 2).map((m) => ({ texto: m.nombre, marca: <span className="h-0.5 w-5" style={{ background: m.color }} /> }))} />
          </div>
          <div className="h-[240px] w-full px-2 pb-2 pt-3" role="img" aria-label="Error medio por horizonte del modelo y de la persistencia">
            <ResponsiveContainer>
              <LineChart data={porHorizonte} margin={MARGEN}>
                <CartesianGrid {...RETICULA} />
                <XAxis dataKey="h" ticks={[1, 3, 6, 9, 12, 15, 18, 21, 24]} tickFormatter={(h: number) => `${h} h`} {...EJE.x} />
                <YAxis {...EJE.y} />
                {MODELOS.slice(0, 2).map((m) => (
                  <Line key={m.clave} dataKey={m.clave} name={m.nombre} stroke={m.color} strokeWidth={2} isAnimationActive={false}
                    dot={{ r: 2.5, fill: m.color, strokeWidth: 0 }} activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
                ))}
                <Tooltip cursor={{ stroke: 'var(--color-tinta-3)', strokeWidth: 1 }}
                  content={({ active, payload, label }) => !active || !payload?.length ? null : (
                    <div className={TIP}>
                      <div className="mb-1 text-tinta-3">Pronóstico a {label} h</div>
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex justify-between gap-4"><span className="text-tinta-2">{p.name}</span><span className="cifra font-medium">{num(p.value as number, 2)} µg/m³</span></div>
                      ))}
                    </div>
                  )} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[1rem] font-semibold">Comparación con CAMS</h3>
        <p className="mt-1 text-[0.875rem] text-tinta-2">En las horas en que hay pronóstico de CAMS (el recolector lo guarda cada 3 horas)</p>
        <div className="caja mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[0.875rem]">
            <thead className="bg-hundido text-[0.8125rem] text-tinta-3">
              <tr className="border-b border-regla">
                <th className="px-4 py-2 font-medium">Pronóstico</th><th className="px-4 py-2 font-medium">Error medio (µg/m³)</th>
                <th className="px-4 py-2 font-medium">Sesgo (µg/m³)</th><th className="px-4 py-2 font-medium">Categoría acertada</th>
              </tr>
            </thead>
            <tbody>
              {MODELOS.map((m) => {
                const x = cams[m.clave]
                return (
                  <tr key={m.clave} className="border-b border-regla-suave last:border-0">
                    <td className="px-4 py-2"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: m.color }} />{m.nombre}</span></td>
                    <td className="cifra px-4 py-2">{x?.n ? num(x.mae, 2) : '—'}</td>
                    <td className="cifra px-4 py-2">{x?.n ? num(x.sesgo, 2) : '—'}</td>
                    <td className="cifra px-4 py-2">{x?.n && x.categoria_correcta != null ? `${num(x.categoria_correcta, 0)} %` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="max-w-[75ch] text-[0.8125rem] leading-relaxed text-tinta-3">
        Persistencia: repetir el último valor publicado. Error medio: promedio de la diferencia absoluta entre lo
        pronosticado y lo medido; sesgo: promedio de la diferencia (negativo: el pronóstico se quedó corto). Episodios:
        horas con más de 25 µg/m³; el modelo avisa cuando pronostica más de {datos.umbrales.aviso} µg/m³. Se calcula cada
        hora con las mediciones publicadas por AQICN.
      </p>
    </div>
  )
}
