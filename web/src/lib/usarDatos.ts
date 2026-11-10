import { useEffect, useState } from 'react'
import type { Datos } from './tipos'

const URL_DATOS = `${import.meta.env.BASE_URL}datos.json`
const REFRESCO_MS = 10 * 60 * 1000   // el pronóstico cambia una vez por hora

export function usarDatos() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const cargar = () =>
      fetch(URL_DATOS, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json() as Promise<Datos>
        })
        .then((d) => { if (vivo) { setDatos(d); setError(null) } })
        .catch((e: Error) => { if (vivo) setError(e.message) })
    cargar()
    const id = setInterval(cargar, REFRESCO_MS)
    return () => { vivo = false; clearInterval(id) }
  }, [])

  return { datos, error }
}
