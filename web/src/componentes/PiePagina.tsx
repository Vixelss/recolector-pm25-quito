import type { Datos } from '@/lib/tipos'

const FUENTES = [
  { texto: 'Red Metropolitana de Monitoreo Atmosférico de Quito (REMMAQ), Secretaría de Ambiente del DMQ', detalle: 'mediciones de las estaciones y registro histórico con que se entrenó el modelo' },
  { texto: 'World Air Quality Index Project', url: 'https://aqicn.org', detalle: 'publicación en tiempo real de las mediciones (índice AQI)' },
  { texto: 'Open-Meteo', url: 'https://open-meteo.com', detalle: 'acceso a los pronósticos meteorológicos y de CAMS' },
  { texto: 'Copernicus Atmosphere Monitoring Service (CAMS)', url: 'https://atmosphere.copernicus.eu', detalle: 'pronóstico global de calidad del aire usado como comparación' },
  { texto: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', detalle: 'cartografía del mapa' },
]

// RF6 (fuentes y aviso académico) y RF10 (datos preliminares)
export function PiePagina({ datos }: { datos: Datos }) {
  return (
    <footer className="mt-16 border-t border-regla bg-superficie">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-8 text-[0.875rem] leading-relaxed text-tinta-2 sm:px-6 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-[1rem] font-semibold text-tinta">Aviso</h2>
          <p>
            Este sistema es un proyecto académico de titulación y <strong className="font-semibold text-tinta">no sustituye la información oficial</strong> de
            la Secretaría de Ambiente del Distrito Metropolitano de Quito.
          </p>
          <p>
            Las mediciones en tiempo real son preliminares (sin validar). Se obtienen convirtiendo a µg/m³ el índice AQI
            de la EPA que publica AQICN para cada estación.
          </p>
          <p className="text-tinta-3">
            Modelo: XGBoost con un modelo por horizonte (1 a 24 h), entrenado con el registro validado de la REMMAQ de
            2018 al {datos.modelo.fin_entrenamiento.split('-').reverse().join('/')}. Rango probable: errores de la
            evaluación en vivo ({datos.modelo.banda}).
          </p>
        </div>
        <div>
          <h2 className="text-[1rem] font-semibold text-tinta">Fuentes de datos</h2>
          <ul className="mt-3 space-y-2">
            {FUENTES.map((f) => (
              <li key={f.texto}>
                {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="font-medium text-tinta underline decoration-regla underline-offset-4 hover:decoration-tinta">{f.texto}</a>
                  : <span className="font-medium text-tinta">{f.texto}</span>}
                <span className="text-tinta-3">: {f.detalle}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-regla-suave">
        <p className="cifra mx-auto max-w-6xl px-4 py-4 text-[0.75rem] text-tinta-3 sm:px-6">
          Datos actualizados cada hora · generado {datos.generado_en.replace('T', ' ')} (hora de Ecuador)
        </p>
      </div>
    </footer>
  )
}
