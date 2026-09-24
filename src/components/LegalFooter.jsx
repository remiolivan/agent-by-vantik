import { Link } from 'react-router-dom'
import { COMPANY, LEGAL_DOCS } from '../lib/legal'

// Small entity line + links to the three legal pages.
// newTab: open links in a new tab (use on forms so typed input isn't lost).
export default function LegalFooter({ newTab = false, className = '' }) {
  const tabProps = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <div className={`text-[11px] leading-relaxed text-muted ${className}`}>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {LEGAL_DOCS.map((doc) => (
          <Link key={doc.to} to={doc.to} {...tabProps} className="hover:text-navy underline-offset-2 hover:underline">
            {doc.label}
          </Link>
        ))}
      </div>
      <p className="mt-1.5">
        © {new Date().getFullYear()} {COMPANY.legalName}, Dubai. {COMPANY.licenceType} No. {COMPANY.licenceNo}.
      </p>
    </div>
  )
}
