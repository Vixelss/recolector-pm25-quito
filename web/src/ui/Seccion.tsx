import type { ReactNode } from 'react'
import { cn } from './cn'

// Bloque de contenido con título, descripción breve y regla superior
export function Seccion({ titulo, bajada, children, className, id }: {
  titulo: string; bajada?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return (
    <section id={id} className={cn('border-t border-regla pt-8', className)}>
      <header className="mb-5">
        <h2 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">{titulo}</h2>
        {bajada && <p className="mt-1.5 max-w-[68ch] text-[0.95rem] leading-relaxed text-tinta-2">{bajada}</p>}
      </header>
      {children}
    </section>
  )
}
