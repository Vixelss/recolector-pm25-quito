import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dia, hora, marcasY, num } from '@/lib/formato'
import { POR_CLAVE } from '@/lib/iqca'
import type { Estacion } from '@/lib/tipos'
import { AvisoLimite, InsigniaCategoria, Muestra } from '@/ui/Insignia'
import { Segmentos } from '@/ui/Segmentos'
import { EJE, Leyenda, MARGEN, RETICULA, TIP } from './comunes'

const AZUL = 'var(--color-serie-1)'

// RF2 (24 h con valor y categoría) y RF9 (banda del 80 %, nota fija y aviso 20–25 µg/m³)
export function GraficoPronostico({ e, umbral }: { e: Estacion; umbral: number }) {
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico')
  const datos = e.pronostico.map((p) => ({ ...p, etiqueta: hora(p.hora), banda: [p.inferior, p.superior] as [number, number] }))
  const tope = Math.max(35, Math.ceil(Math.max(...datos.map((d) => d.superior)) / 5) * 5 + 5)
  const avisos = datos.filter((d) => d.cerca_del_limite).length

  if (!datos.length) {
    return <p className="text-sm text-tinta-2">No hay pronóstico publicado para {e.nombre} (sin datos recientes).</p>
  }
  return (
    <div>
      <div className="caja">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-regla-suave px-4 py-3">
          <Leyenda elementos={[
            { texto: 'Pronóstico', marca: <span className="h-0.5 w-5" style={{ background: AZUL }} /> },
            { texto: 'Rango probable (8 de cada 10 horas)', marca: <span className="h-3 w-5" style={{ background: 'color-mix(in srgb, var(--color-serie-1) 16%, transparent)' }} /> },
            { texto: 'Límite de 25 µg/m³', marca: <span className="w-5 border-t-2 border-dashed border-tinta" /> },
            ...(avisos > 0 ? [{ texto: 'Cerca del límite', marca: <svg width="11" height="11" aria-hidden><path d="M5.5 1 10.5 10H.5Z" fill="var(--color-aviso)" /></svg> }] : []),
          ]} />
          <Segmentos etiqueta="Vista del pronóstico" valor={vista} onCambio={setVista}
            opciones={[{ valor: 'grafico', texto: 'Gráfico' }, { valor: 'tabla', texto: 'Tabla' }]} />
        </div>

        {vista === 'grafico' ? (
          <div className="h-[320px] w-full px-2 pb-2 pt-3" role="img"
            aria-label={`Pronóstico de PM2.5 para ${e.nombre} en las próximas 24 horas, de ${num(Math.min(...datos.map((d) => d.pm25)))} a ${num(Math.max(...datos.map((d) => d.pm25)))} µg/m³`}>
            <ResponsiveContainer>
              <ComposedChart data={datos} margin={MARGEN}>
                <ReferenceArea y1={25} y2={Math.min(50, tope)} fill={POR_CLAVE.aceptable.color} fillOpacity={0.06} ifOverflow="hidden" />
                <CartesianGrid {...RETICULA} />
                <XAxis dataKey="etiqueta" interval={2} {...EJE.x} />
                <YAxis domain={[0, tope]} ticks={marcasY(tope)} {...EJE.y} />
                <Area dataKey="banda" stroke="none" fill={AZUL} fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
                <ReferenceLine y={25} stroke="var(--color-tinta)" strokeDasharray="5 4" strokeWidth={1.2}
                  label={{ value: 'Deseable ≤ 25 · Aceptable >', position: 'insideTopRight', fontSize: 11, fill: 'var(--color-tinta-2)' }} />
                <Line dataKey="pm25" stroke={AZUL} strokeWidth={2} isAnimationActive={false}
                  activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }}
                  dot={(p: { cx?: number; cy?: number; index?: number; payload?: { cerca_del_limite: boolean } }) =>
                    p.payload?.cerca_del_limite && p.cx != null && p.cy != null
                      ? <path key={p.index} d={`M${p.cx} ${p.cy - 7} L${p.cx + 6} ${p.cy + 4} L${p.cx - 6} ${p.cy + 4}Z`} fill="var(--color-aviso)" stroke="#fff" strokeWidth={1.5} />
                      : <g key={p.index} />} />
                <Tooltip cursor={{ stroke: 'var(--color-tinta-3)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as (typeof datos)[number]
                    return (
                      <div className={`${TIP} min-w-[12rem]`}>
                        <div className="text-tinta-3">{dia(d.hora)}, {hora(d.hora)} · dentro de {d.h} h</div>
                        <div className="mt-1 flex items-baseline gap-1.5"><span className="cifra text-xl font-semibold">{num(d.pm25)}</span><span className="text-tinta-3">µg/m³</span></div>
                        <div className="text-tinta-2">Rango probable: <span className="cifra">{num(d.inferior)}–{num(d.superior)}</span></div>
                        <div className="mt-1.5 flex flex-wrap gap-1"><InsigniaCategoria categoria={d.categoria} />{d.cerca_del_limite && <AvisoLimite corto />}</div>
                      </div>
                    )
                  }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-left text-[0.875rem]">
              <caption className="sr-only">Pronóstico horario de {e.nombre}</caption>
              <thead className="sticky top-0 bg-hundido text-[0.8125rem] text-tinta-3">
                <tr className="border-b border-regla">
                  <th className="px-4 py-2 font-medium">Hora</th><th className="px-4 py-2 font-medium">Pronóstico (µg/m³)</th>
                  <th className="px-4 py-2 font-medium">Rango probable</th><th className="px-4 py-2 font-medium">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((d) => (
                  <tr key={d.h} className="border-b border-regla-suave last:border-0">
                    <td className="cifra px-4 py-1.5 text-tinta-2">{dia(d.hora)} {hora(d.hora)}</td>
                    <td className="cifra px-4 py-1.5 font-medium">{num(d.pm25)}</td>
                    <td className="cifra px-4 py-1.5 text-tinta-2">{num(d.inferior)}–{num(d.superior)}</td>
                    <td className="px-4 py-1.5">
                      <span className="inline-flex items-center gap-2"><Muestra categoria={d.categoria} size={10} />{POR_CLAVE[d.categoria].nombre}
                        {d.cerca_del_limite && <AvisoLimite corto className="ml-1" />}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 max-w-[75ch] text-[0.875rem] leading-relaxed text-tinta-2">
        El pronóstico es aproximado: en 8 de cada 10 horas el valor real queda dentro de la franja sombreada. En las
        horas más contaminadas el modelo suele quedarse corto. Por eso, las horas pronosticadas entre {umbral} y 25 µg/m³
        se marcan como «cerca del límite: podría ser aceptable».
      </p>
    </div>
  )
}
