import { CATEGORIAS } from '@/lib/iqca'

// RF3: significado oficial de cada categoría del IQCA (sin recomendaciones propias)
export function Categorias() {
  return (
    <div>
      <div className="caja overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-[0.875rem]">
          <thead className="bg-hundido text-[0.8125rem] text-tinta-3">
            <tr className="border-b border-regla">
              <th className="px-4 py-2.5 font-medium">Categoría</th>
              <th className="px-4 py-2.5 font-medium">Índice</th>
              <th className="px-4 py-2.5 font-medium">PM2.5 (µg/m³)</th>
              <th className="px-4 py-2.5 font-medium">Significado para la salud</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map((c) => (
              <tr key={c.clave} className="border-b border-regla-suave last:border-0">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2.5 font-medium">
                    <span aria-hidden className="h-3 w-3 rounded-[2px] border" style={{ background: c.color, borderColor: c.borde }} />
                    {c.nombre}
                  </span>
                </td>
                <td className="cifra px-4 py-2.5 text-tinta-2">{c.indice}</td>
                <td className="cifra px-4 py-2.5 text-tinta-2">{c.rango}</td>
                <td className="px-4 py-2.5 text-tinta-2">{c.significado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[75ch] text-[0.8125rem] leading-relaxed text-tinta-3">
        Índice Quiteño de Calidad del Aire (IQCA) para PM2.5, según la normativa del Distrito Metropolitano de Quito.
        Las categorías oficiales se definen para promedios de 24 horas; aquí se aplican a cada hora como referencia.
      </p>
    </div>
  )
}
