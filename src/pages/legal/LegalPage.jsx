import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from '../../components/Logo'
import { COMPANY, LEGAL_DOCS, LEGAL_EFFECTIVE_DATE } from '../../lib/legal'

// Public (no auth) layout shared by Terms, Privacy and Refund pages.
// sections: [{ id, title, body: <JSX> }] — ids feed the in-page contents list.
export default function LegalPage({ title, intro, sections }) {
  useEffect(() => {
    document.title = `${title} | Agent by Vantik`
    return () => { document.title = 'Agent by Vantik' }
  }, [title])

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-5 lg:px-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" aria-label="Agent by Vantik">
            <Logo size={26} on="dark" />
          </Link>
          <Link to="/" className="text-[13px] font-semibold text-navLight hover:text-white">
            Back to Agent
          </Link>
        </div>
      </header>

      <nav aria-label="Legal documents" className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 flex gap-1 overflow-x-auto">
          {LEGAL_DOCS.map((doc) => (
            <NavLink
              key={doc.to}
              to={doc.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-3 text-[13px] border-b-2 -mb-px ${
                  isActive ? 'border-amber text-navy font-semibold' : 'border-transparent text-muted hover:text-navy'
                }`
              }
            >
              {doc.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 lg:px-8 py-10 lg:py-14">
        <div className="max-w-[68ch] mb-10">
          <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-navy tracking-tight leading-tight">
            {title}
          </h1>
          <p className="mt-2 text-[13px] text-muted">Effective {LEGAL_EFFECTIVE_DATE}</p>
          {intro && <p className="mt-5 text-[15px] text-ink leading-relaxed">{intro}</p>}
        </div>

        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted mb-3">Contents</div>
              <ol className="space-y-2">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-[13px] text-muted hover:text-navy leading-snug block">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <article className="bg-white border border-border rounded-md px-5 py-7 sm:px-9 sm:py-9">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6 max-w-[68ch] [&:not(:first-child)]:mt-9">
                <h2 className="font-display text-[17px] font-semibold text-navy mb-3">
                  <span className="text-mid mr-2">{i + 1}.</span>{s.title}
                </h2>
                <div className="text-[15px] text-ink leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-mid [&_a]:font-semibold [&_strong]:font-semibold">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>

        <EntityPanel />
      </main>

      <footer className="border-t border-border bg-white px-5 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto text-xs text-muted">
          © {new Date().getFullYear()} {COMPANY.legalName}. {COMPANY.product} is a product of {COMPANY.legalName}, Dubai.
        </div>
      </footer>
    </div>
  )
}

function EntityPanel() {
  const rows = [
    ['Legal name', COMPANY.legalName],
    ['Legal name (Arabic)', <span dir="rtl" lang="ar">{COMPANY.legalNameAr}</span>],
    ['Legal form', COMPANY.legalForm],
    ['Licence', `${COMPANY.licenceType} No. ${COMPANY.licenceNo}`],
    ['Commercial register', `No. ${COMPANY.registerNo}`],
    ['Issued by', COMPANY.authority],
    ['Registered address', COMPANY.address],
    ['Contact', COMPANY.email],
  ]
  return (
    <section aria-label="Company information" className="mt-10 bg-navy rounded-md px-5 py-7 sm:px-9 sm:py-8 lg:ml-[248px]">
      <div className="w-12 h-px bg-gold mb-4" />
      <h2 className="font-display text-[15px] font-semibold text-white mb-5">Who provides Agent by Vantik</h2>
      <dl className="grid sm:grid-cols-[180px_minmax(0,1fr)] gap-x-6 gap-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[13px] text-navFaint">{k}</dt>
            <dd className="text-[13px] text-paper mb-2 sm:mb-0 break-words">
              {k === 'Contact' ? <a href={`mailto:${v}`} className="text-white underline underline-offset-2">{v}</a> : v}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
