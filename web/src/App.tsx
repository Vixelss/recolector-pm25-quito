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
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      <Encabezado datos={datos} />

      <div className="aparece grid gap-4 md:grid-cols-[1.35fr_1fr]" style={{ animationDelay: '90ms' }}>
        <Mapa estaciones={datos.estaciones} elegida={clave} onElegir={setElegida} />
        <div className="grid content-start gap-3">
          {datos.estaciones.map((e) => (
            <TarjetaEstacion key={e.clave} e={e} activa={e.clave === clave} onElegir={() => setElegida(e.clave)} />
          ))}
        </div>
      </div>

      <div className="mt-16 space-y-16">
        <Seccion numero="01" titulo={`Próximas 24 horas en ${estacion.nombre}`} retraso={160}
          bajada="Valor pronosticado de cada hora con su categoría. Elige otra estación en el mapa o en las tarjetas.">
          <GraficoPronostico e={estacion} umbral={datos.umbrales.aviso} />
        </Seccion>

        <Seccion numero="02" titulo="Qué significa cada categoría" retraso={200}>
          <Categorias />
        </Seccion>

        <Seccion numero="03" titulo={`Últimos 7 días en ${estacion.nombre}`} retraso={240}
          bajada="Lo que se midió frente a lo que el modelo había pronosticado con 6 y con 24 horas de anticipación.">
          <Ultimos7Dias e={estacion} desde={datos.desempeno.pronosticos_desde} />
        </Seccion>

        <Seccion numero="04" titulo="Qué tan bien está pronosticando" retraso={280}
          bajada="Comparación automática de los pronósticos guardados con las mediciones publicadas después, en las tres estaciones.">
          <Desempeno datos={datos} />
        </Seccion>
      </div>

      <PiePagina datos={datos} />
    </main>
  )
}
