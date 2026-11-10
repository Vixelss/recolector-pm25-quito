import type { ReactNode } from 'react'
import { cn } from './cn'

// Bloque con número de sección, al estilo de un boletín impreso
export function Seccion({ numero, titulo, bajada, children, className, id, retraso = 0 }: {
  numero: string; titulo: string; bajada?: ReactNode; children: ReactNode; className?: string; id?: string; retraso?: number
}) {
  return (
    <section id={id} className={cn('border-t border-tinta pt-5', className)} data-retraso={retraso}>
      <header className="mb-6 grid gap-2 md:grid-cols-[7rem_1fr]">
        <span className="cifra text-sm text-tinta-3">{numero}</span>
        <div>
          <h2 className="titulo text-[1.75rem] leading-tight md:text-[2.1rem]">{titulo}</h2>
          {bajada && <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-tinta-2">{bajada}</p>}
        </div>
      </header>
      <div className="md:pl-[7rem]">{children}</div>
    </section>
  )
}
