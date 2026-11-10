import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dia, hora, marcasY, num } from '@/lib/formato'
import type { Estacion } from '@/lib/tipos'
import { EJE, Leyenda, MARGEN, RETICULA, TIP } from './comunes'

const SERIES = [
  { clave: 'medido', nombre: 'Medido (AQICN convertido)', color: 'var(--color-tinta)', ancho: 1.6 },
  { clave: 'pronostico_6h', nombre: 'Pronosticado 6 h antes', color: 'var(--color-serie-1)', ancho: 2 },
  { clave: 'pronostico_24h', nombre: 'Pronosticado 24 h antes', color: 'var(--color-serie-2)', ancho: 2 },
] as const

// RF5: medido frente a pronosticado con 6 y 24 h de anticipación, últimos 7 días
export function Ultimos7Dias({ e, desde }: { e: Estacion; desde: string | null }) {
  const datos = e.ultimos_7_dias
  const hayPronosticos = datos.some((d) => d.pronostico_6h != null || d.pronostico_24h != null)
  const valores = datos.flatMap((d) => [d.medido, d.pronostico_6h, d.pronostico_24h]).filter((v): v is number => v != null)
  const tope = Math.max(35, Math.ceil(Math.max(0, ...valores) / 5) * 5 + 5)
  const marcas = datos.filter((d) => d.hora.endsWith('T00:00')).map((d) => d.hora)

  return (
    <div>
      <div className="caja">
        <div className="border-b border-regla-suave px-4 py-3">
          <Leyenda elementos={SERIES.map((s) => ({ texto: s.nombre, marca: <span className="h-0.5 w-5" style={{ background: s.color }} /> }))} />
        </div>
        <div className="h-[280px] w-full px-2 pb-2 pt-3" role="img" aria-label={`PM2.5 medido y pronosticado en ${e.nombre} durante los últimos 7 días`}>
          <ResponsiveContainer>
            <LineChart data={datos} margin={MARGEN}>
              <CartesianGrid {...RETICULA} />
              <XAxis dataKey="hora" ticks={marcas} tickFormatter={(t: string) => dia(t)} {...EJE.x} />
              <YAxis domain={[0, tope]} ticks={marcasY(tope)} {...EJE.y} />
              <ReferenceLine y={25} stroke="var(--color-tinta-3)" strokeDasharray="5 4" />
              {SERIES.map((s) => (
                <Line key={s.clave} dataKey={s.clave} name={s.nombre} stroke={s.color} strokeWidth={s.ancho} dot={false}
                  connectNulls={false} isAnimationActive={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
              ))}
              <Tooltip cursor={{ stroke: 'var(--color-tinta-3)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof datos)[number]
                  return (
                    <div className={`${TIP} min-w-[13rem]`}>
                      <div className="mb-1 text-tinta-3">{dia(d.hora)}, {hora(d.hora)}</div>
                      {SERIES.map((s) => (
                        <div key={s.clave} className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-2 text-tinta-2"><span className="h-0.5 w-3" style={{ background: s.color }} />{s.nombre}</span>
                          <span className="cifra font-medium">{num(d[s.clave])}</span>
                        </div>
                      ))}
                    </div>
                  )
                }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="mt-3 max-w-[75ch] text-[0.875rem] leading-relaxed text-tinta-2">
        Para cada hora se muestran dos de los pronósticos que el modelo hizo sobre ella: el de 6 horas antes (corto
        plazo) y el de 24 horas antes (el más lejano). Las mediciones son datos en tiempo real, todavía sin validar.
        {!hayPronosticos && <> El servicio guarda pronósticos desde {desde ? `el ${dia(desde)}` : 'su puesta en marcha'}; las líneas de pronóstico aparecen a medida que se cumplen sus horas.</>}
      </p>
    </div>
  )
}
