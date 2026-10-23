export function Panel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string
  eyebrow?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text-strong)]">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  )
}
