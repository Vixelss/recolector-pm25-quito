// Revisión automática de la página con un navegador real (Playwright, Chromium sin ventana).
// Uso: npm run build && node pruebas/revisar.mjs [carpeta_capturas] [url]
// Sin url, levanta `vite preview` con el datos.json que haya en public/ (o dist/).
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const carpeta = process.argv[2] ?? 'pruebas/capturas'
const urlExterna = process.argv[3]
mkdirSync(carpeta, { recursive: true })

let servidor
const url = urlExterna ?? 'http://localhost:4173/recolector-pm25-quito/'
if (!urlExterna) {
  servidor = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { shell: true, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* aún no responde */ }
    await new Promise((r) => setTimeout(r, 200))
  }
}

const fallas = []
const ok = (cond, texto) => { console.log(`${cond ? '✔' : '✘'} ${texto}`); if (!cond) fallas.push(texto) }
const navegador = await chromium.launch()

for (const [nombre, vista] of [['computadora', { width: 1440, height: 900 }], ['celular', { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }]]) {
  console.log(`\n— ${nombre} (${vista.width}×${vista.height})`)
  const pagina = await navegador.newPage({ viewport: { width: vista.width, height: vista.height }, isMobile: vista.isMobile, deviceScaleFactor: vista.deviceScaleFactor ?? 1 })
  const errores = []
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()) })
  pagina.on('pageerror', (e) => errores.push(e.message))

  const t0 = Date.now()
  await pagina.goto(url, { waitUntil: 'load' })
  await pagina.getByRole('heading', { name: 'Aire de Quito' }).waitFor()
  await pagina.locator('.recharts-surface').first().waitFor()
  ok(Date.now() - t0 < 5000, `carga con datos y gráfico en ${Date.now() - t0} ms (< 5 s)`)

  const tarjetas = pagina.locator('button[aria-pressed]').filter({ hasText: 'Último medido' })
  ok(await tarjetas.count() === 3, `3 tarjetas de estación (${await tarjetas.count()})`)
  ok(await pagina.locator('path.leaflet-interactive').count() === 3, '3 puntos en el mapa')
  await pagina.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0, null, { timeout: 8000 }).catch(() => {})   // teselas del mapa
  ok(await pagina.locator('.leaflet-tile-loaded').count() > 0, 'teselas de OpenStreetMap cargadas')
  ok(await pagina.getByText('OpenStreetMap', { exact: false }).first().isVisible(), 'crédito de OpenStreetMap visible')
  ok(await pagina.getByText('Pronóstico emitido').isVisible(), 'hora de emisión visible (RF7)')
  ok(await pagina.getByText('En las horas más contaminadas el modelo suele quedarse corto', { exact: false }).isVisible(), 'nota de incertidumbre (RF9 b)')
  ok(await pagina.getByText('no sustituye la información oficial', { exact: false }).isVisible(), 'aviso académico (RF6)')
  ok(await pagina.getByText('World Air Quality Index Project').isVisible(), 'atribución a AQICN (RF6)')
  ok(await pagina.getByText('Las mediciones en tiempo real son preliminares', { exact: false }).isVisible(), 'aviso de datos preliminares (RF10)')
  ok(await pagina.locator('table').filter({ hasText: 'Significado para la salud' }).locator('tbody tr').count() === 6, '6 categorías del IQCA (RF3)')

  await pagina.waitForTimeout(1000)   // fin de la animación de entrada
  await pagina.screenshot({ path: `${carpeta}/${nombre}_completa.png`, fullPage: true })
  await pagina.screenshot({ path: `${carpeta}/${nombre}_inicio.png` })

  // Elegir otra estación
  await tarjetas.nth(1).click()
  const nombre2 = (await tarjetas.nth(1).locator('h3').textContent())?.trim()
  ok(await pagina.getByRole('heading', { name: `Próximas 24 horas en ${nombre2}` }).isVisible(), `al elegir ${nombre2} cambia el pronóstico`)

  // Vista de tabla del pronóstico
  await pagina.getByRole('group', { name: 'Vista del pronóstico' }).getByRole('button', { name: 'Tabla' }).click()
  const filas = await pagina.locator('table').filter({ hasText: 'Rango probable' }).locator('tbody tr').count()
  const esperadas = await pagina.evaluate(async (n) => {
    const d = await (await fetch('datos.json', { cache: 'no-store' })).json()
    return d.estaciones.find((e) => e.nombre === n).pronostico.length
  }, nombre2)
  ok(filas === esperadas, `tabla del pronóstico con las ${esperadas} horas de datos.json (${filas})`)
  await pagina.locator('table').filter({ hasText: 'Rango probable' }).scrollIntoViewIfNeeded().catch(() => {})
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: `${carpeta}/${nombre}_tabla.png` })

  // Desempeño, 30 días
  const periodo = pagina.getByRole('group', { name: 'Periodo' })
  await periodo.getByRole('button', { name: 'Últimos 30 días' }).click()
  ok(await periodo.getByRole('button', { name: 'Últimos 30 días' }).getAttribute('aria-pressed') === 'true', 'cambio a 30 días en desempeño')
  await pagina.getByRole('heading', { name: 'Qué tan bien está pronosticando' }).scrollIntoViewIfNeeded()
  await pagina.mouse.move(0, 0)
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: `${carpeta}/${nombre}_desempeno.png` })

  // Sin desbordes horizontales
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth)
  ok(ancho <= vista.width, `sin desplazamiento horizontal (ancho ${ancho})`)
  ok(errores.length === 0, `sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`)
  await pagina.close()
}

await navegador.close()
servidor?.kill()
console.log(fallas.length ? `\n${fallas.length} comprobaciones fallaron` : '\nTodas las comprobaciones pasaron')
process.exit(fallas.length ? 1 : 0)
