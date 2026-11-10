import { useState } from 'react'
import { Categorias } from '@/componentes/Categorias'
import { Desempeno } from '@/componentes/Desempeno'
import { Encabezado } from '@/componentes/Encabezado'
import { GraficoPronostico } from '@/componentes/GraficoPronostico'
import { Mapa } from '@/componentes/Mapa'
import { PiePagina } from '@/componentes/PiePagina'
import { TarjetaEstacion } from '@/componentes/TarjetaEstacion'
import { Ultimos7Dias } from '@/componentes/Ultimos7Dias'
import { usarDatos } from '@/lib/usarDatos'
import { Seccion } from '@/ui/Seccion'

export default function App() {
  const { datos, error } = usarDatos()
  const [elegida, setElegida] = useState<string | null>(null)

  if (!datos) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 sm:px-6">
        <p className="text-tinta-2" role="status">
          {error ? `No se pudieron cargar los datos (${error}). Intenta recargar la página en unos minutos.` : 'Cargando el pronóstico…'}
        </p>
      </main>
    )
  }
  const clave = elegida ?? (datos.estaciones.find((e) => e.estado !== 'sin_datos') ?? datos.estaciones[0]).clave
  const estacion = datos.estaciones.find((e) => e.clave === clave)!

  return (
    <>
      <Encabezado datos={datos} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="caja grid overflow-hidden md:grid-cols-[1.45fr_1fr]">
          <Mapa estaciones={datos.estaciones} elegida={clave} onElegir={setElegida} />
          <div className="border-t border-regla md:border-l md:border-t-0">
            <p className="border-b border-regla-suave px-5 py-2.5 text-[0.8125rem] text-tinta-3">
              Elige una estación para ver su pronóstico
            </p>
            <div className="divide-y divide-regla-suave">
              {datos.estaciones.map((e) => (
                <TarjetaEstacion key={e.clave} e={e} activa={e.clave === clave} onElegir={() => setElegida(e.clave)} horaActual={datos.ahora} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-12">
          <Seccion titulo={`Próximas 24 horas en ${estacion.nombre}`}
            bajada="Valor pronosticado de cada hora con su categoría. Elige otra estación en el mapa o en la lista.">
            <GraficoPronostico e={estacion} umbral={datos.umbrales.aviso} />
          </Seccion>

          <Seccion titulo="Qué significa cada categoría">
            <Categorias />
          </Seccion>

          <Seccion titulo={`Últimos 7 días en ${estacion.nombre}`}
            bajada="Lo que se midió frente a lo que el modelo había pronosticado con 6 y con 24 horas de anticipación.">
            <Ultimos7Dias e={estacion} desde={datos.desempeno.pronosticos_desde} />
          </Seccion>

          <Seccion titulo="Qué tan bien está pronosticando"
            bajada="Comparación automática de los pronósticos guardados con las mediciones publicadas después, en las tres estaciones.">
            <Desempeno datos={datos} />
          </Seccion>
        </div>
      </main>

      <PiePagina datos={datos} />
    </>
  )
}
