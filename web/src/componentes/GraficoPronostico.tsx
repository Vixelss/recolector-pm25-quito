import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dia, hora, marcasY, num } from '@/lib/formato'
import { POR_CLAVE } from '@/lib/iqca'
import type { Estacion } from '@/lib/tipos'
import { AvisoLimite, InsigniaCategoria, Muestra } from '@/ui/Insignia'
import { Segmentos } from '@/ui/Segmentos'

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8rem] text-tinta-2">
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 rounded" style={{ background: AZUL }} />Pronóstico</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--color-serie-1) 16%, transparent)' }} />Rango probable (8 de cada 10 horas)</span>
          <span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-tinta" />Límite de 25 µg/m³</span>
          {avisos > 0 && <span className="inline-flex items-center gap-2"><svg width="12" height="12" aria-hidden><path d="M6 1 11 11H1Z" fill="var(--color-aviso)" /></svg>Cerca del límite</span>}
        </div>
        <Segmentos etiqueta="Vista del pronóstico" valor={vista} onCambio={setVista}
          opciones={[{ valor: 'grafico', texto: 'Gráfico' }, { valor: 'tabla', texto: 'Tabla' }]} />
      </div>

      {vista === 'grafico' ? (
        <div className="h-[320px] w-full" role="img"
          aria-label={`Pronóstico de PM2.5 para ${e.nombre} en las próximas 24 horas, de ${num(Math.min(...datos.map((d) => d.pm25)))} a ${num(Math.max(...datos.map((d) => d.pm25)))} µg/m³`}>
          <ResponsiveContainer>
            <ComposedChart data={datos} margin={{ top: 12, right: 12, bottom: 4, left: -14 }}>
              <ReferenceArea y1={25} y2={Math.min(50, tope)} fill={POR_CLAVE.aceptable.color} fillOpacity={0.07} ifOverflow="hidden" />
              <CartesianGrid vertical={false} stroke="var(--color-regla-suave)" />
              <XAxis dataKey="etiqueta" interval={2} tickLine={false} axisLine={{ stroke: 'var(--color-regla)' }}
                tick={{ fontSize: 11, fill: 'var(--color-tinta-3)', fontFamily: 'var(--font-mono)' }} />
              <YAxis domain={[0, tope]} ticks={marcasY(tope)} tickLine={false} axisLine={false} width={48}
                tick={{ fontSize: 11, fill: 'var(--color-tinta-3)', fontFamily: 'var(--font-mono)' }} />
              <Area dataKey="banda" stroke="none" fill={AZUL} fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
              <ReferenceLine y={25} stroke="var(--color-tinta)" strokeDasharray="5 4" strokeWidth={1.2}
                label={{ value: 'Deseable ≤ 25 · Aceptable >', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-tinta-2)' }} />
              <Line dataKey="pm25" stroke={AZUL} strokeWidth={2} isAnimationActive={false}
                activeDot={{ r: 5, stroke: 'var(--color-hoja)', strokeWidth: 2 }}
                dot={(p: { cx?: number; cy?: number; index?: number; payload?: { cerca_del_limite: boolean } }) =>
                  p.payload?.cerca_del_limite && p.cx != null && p.cy != null
                    ? <path key={p.index} d={`M${p.cx} ${p.cy - 7} L${p.cx + 6} ${p.cy + 4} L${p.cx - 6} ${p.cy + 4}Z`} fill="var(--color-aviso)" stroke="var(--color-hoja)" strokeWidth={1.5} />
                    : <g key={p.index} />} />
              <Tooltip cursor={{ stroke: 'var(--color-tinta-3)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof datos)[number]
                  return (
                    <div className="min-w-[12rem] rounded-lg border border-regla bg-hoja px-3 py-2.5 text-[0.8rem] shadow-lg">
                      <div className="text-tinta-3">{dia(d.hora)} · {hora(d.hora)} · dentro de {d.h} h</div>
                      <div className="mt-1 flex items-baseline gap-1.5"><span className="cifra text-xl">{num(d.pm25)}</span><span className="text-tinta-3">µg/m³</span></div>
                      <div className="text-tinta-2">Rango probable: <span className="cifra">{num(d.inferior)}–{num(d.superior)}</span></div>
                      <div className="mt-1.5 flex flex-wrap gap-1"><InsigniaCategoria categoria={d.categoria} />{d.cerca_del_limite && <AvisoLimite corto />}</div>
                    </div>
                  )
                }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto rounded-lg border border-regla bg-hoja">
          <table className="w-full text-left text-[0.85rem]">
            <caption className="sr-only">Pronóstico horario de {e.nombre}</caption>
            <thead className="sticky top-0 bg-hoja text-tinta-3">
              <tr className="border-b border-regla">
                <th className="px-3 py-2 font-medium">Hora</th><th className="px-3 py-2 font-medium">Pronóstico (µg/m³)</th>
                <th className="px-3 py-2 font-medium">Rango probable</th><th className="px-3 py-2 font-medium">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.h} className="border-b border-regla-suave last:border-0">
                  <td className="cifra px-3 py-1.5 text-tinta-2">{dia(d.hora)} {hora(d.hora)}</td>
                  <td className="cifra px-3 py-1.5">{num(d.pm25)}</td>
                  <td className="cifra px-3 py-1.5 text-tinta-2">{num(d.inferior)}–{num(d.superior)}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-2"><Muestra categoria={d.categoria} />{POR_CLAVE[d.categoria].nombre}
                      {d.cerca_del_limite && <AvisoLimite corto className="ml-1" />}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-[0.85rem] leading-relaxed text-tinta-2">
        El pronóstico es aproximado: en 8 de cada 10 horas el valor real queda dentro de la franja sombreada. En las
        horas más contaminadas el modelo suele quedarse corto. Por eso, las horas pronosticadas entre {umbral} y 25 µg/m³
        se marcan como «cerca del límite: podría ser aceptable».
      </p>
    </div>
  )
}
