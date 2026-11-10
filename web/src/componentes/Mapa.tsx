import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { hora, num } from '@/lib/formato'
import { POR_CLAVE, SIN_DATOS } from '@/lib/iqca'
import type { Estacion } from '@/lib/tipos'

// RF1: un punto por estación, con el color de la categoría del pronóstico para la hora en curso
// (W22). Sin interpolar entre estaciones. Clic → muestra el pronóstico de esa estación.
export function Mapa({ estaciones, elegida, onElegir }: {
  estaciones: Estacion[]; elegida: string; onElegir: (clave: string) => void
}) {
  return (
    <div className="mapa-sobrio relative h-[340px] overflow-hidden rounded-xl border border-regla md:h-full md:min-h-[440px]">
      <MapContainer
        center={[-0.165, -78.455]} zoom={11} scrollWheelZoom={false} className="h-full w-full"
        attributionControl
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={17}
        />
        {estaciones.map((e) => {
          const sin = e.estado === 'sin_datos' || !e.ahora
          const c = sin ? SIN_DATOS : POR_CLAVE[e.ahora!.categoria]
          const activa = e.clave === elegida
          return (
            <CircleMarker
              key={e.clave}
              center={[e.lat, e.lon]}
              radius={activa ? 15 : 11}
              pathOptions={{ color: activa ? '#14181f' : c.borde, weight: activa ? 3 : 1.5, fillColor: c.color, fillOpacity: 1 }}
              eventHandlers={{ click: () => onElegir(e.clave) }}
            >
              <Tooltip direction="top" offset={[0, -12]} className="etiqueta-estacion" permanent={activa}>
                <strong>{e.nombre}</strong>
                <br />
                {sin
                  ? 'Sin datos recientes'
                  : `${num(e.ahora!.pm25)} µg/m³ · ${POR_CLAVE[e.ahora!.categoria].nombre} · ${hora(e.ahora!.hora)}`}
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
