import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { COMPANY, LEGAL_DOCS } from '../lib/legal'
import { SELF_SERVE_PLANS, BROKERAGE_FROM, TRIAL_DAYS, TRIAL_DAYS_REFERRAL, aed } from '../lib/pricing'

// Public landing page shown at "/" to visitors who are not signed in.
// Signed-in users get the Dashboard at the same URL (see Home in App.jsx).

const BODY = 'text-[#3A3935]'
const SMALL = 'text-[#5B6270]'
const LABEL = 'font-mono text-[11px] sm:text-xs tracking-[0.12em] uppercase'

function Mark({ height = 32, on = 'dark' }) {
  const bar1 = on === 'dark' ? '#F7F5F0' : '#16213E'
  return (
    <svg height={height} width={height * (253 / 354)} viewBox="0 0 253 354" fill="none" aria-hidden="true">
      <rect x="0" y="234" width="65" height="120" rx="12" fill={bar1} />
      <rect x="89" y="174" width="64" height="180" rx="12" fill="#4C7BC9" />
      <rect x="177" y="91" width="64" height="263" rx="12" fill="#C9A868" />
      <circle cx="207" cy="45" r="30" fill="#E8963C" />
    </svg>
  )
}

function Lockup({ on = 'dark' }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <Mark height={30} on={on} />
        <div className={`font-display font-bold text-xl leading-none tracking-tight ${on === 'dark' ? 'text-white' : 'text-navy'}`}>Agent</div>
      </div>
      <div className={`font-display font-medium text-[8px] uppercase tracking-[0.18em] leading-none ${on === 'dark' ? 'text-navMuted' : 'text-muted'}`}>
        by Vantik
      </div>
    </div>
  )
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4C7BC9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-0.5">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

function SectionLabel({ children, onDark = false }) {
  return (
    <div className={`${LABEL} ${onDark ? 'text-gold' : 'text-mid'} flex items-center gap-3`}>
      {onDark && <span className="w-8 h-px bg-gold" />}
      {children}
    </div>
  )
}

function PrimaryCta({ to, children, className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center justify-center bg-amber text-ink font-bold rounded-md px-6 py-3.5 min-h-[48px] hover:brightness-95 ${className}`}>
      {children}
    </Link>
  )
}

function Tag({ children }) {
  return <span className="font-mono text-[10px] text-navy bg-[#EAF0FA] px-2 py-1 rounded whitespace-nowrap">{children}</span>
}

function ProspectRow({ name, detail, tag, last }) {
  return (
    <div className={`px-4 py-3.5 flex items-center justify-between gap-3 ${last ? '' : 'border-b border-borderSoft'}`}>
      <div className="min-w-0">
        <div className="font-semibold text-sm text-navy">{name}</div>
        <div className={`text-xs ${SMALL} mt-0.5 truncate`}>{detail}</div>
      </div>
      <Tag>{tag}</Tag>
    </div>
  )
}

function ProductPreview() {
  return (
    <div className="relative lg:h-[520px]" aria-label="Preview of the Agent dashboard with sample data">
      <div className="lg:absolute lg:left-0 lg:top-0 lg:right-10 bg-paper rounded-[10px] border border-[#2C3A5E] overflow-hidden">
        <div className="h-11 bg-white border-b border-border flex items-center justify-between px-5">
          <div className={`font-mono text-[10px] tracking-[0.1em] uppercase ${SMALL}`}>Today</div>
          <div className="w-[26px] h-[26px] rounded-full bg-navy text-white font-display text-[11px] font-semibold flex items-center justify-center">AG</div>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[['Follow-ups due', 6], ['Viewings', 3], ['Active prospects', 41]].map(([label, n]) => (
            <div key={label} className="bg-white border border-border rounded-md p-3 sm:p-3.5">
              <div className={`font-mono text-[8px] sm:text-[9px] tracking-[0.1em] uppercase ${SMALL} leading-tight`}>{label}</div>
              <div className="font-mono text-xl sm:text-[26px] text-navy mt-1.5">{n}</div>
            </div>
          ))}
        </div>
        <div className="mx-4 sm:mx-5 mb-4 sm:mb-5 bg-white border border-border rounded-md">
          <div className={`px-4 py-3 border-b border-border font-mono text-[9px] tracking-[0.1em] uppercase ${SMALL}`}>Call first</div>
          <ProspectRow name="Sara M." detail="Buy · 2BR Dubai Marina · up to AED 2.4M" tag="VIEWING DONE" />
          <ProspectRow name="Karim A." detail="Rent · Villa, Al Furjan · AED 220k/yr" tag="NO REPLY 3D" />
          <ProspectRow name="Olga V." detail="Buy · Off-plan, JVC · up to AED 1.2M" tag="NEW LEAD" last />
        </div>
      </div>
      <div className="relative mt-4 mx-4 sm:mx-auto sm:max-w-[340px] lg:absolute lg:mt-0 lg:mx-0 lg:right-0 lg:bottom-0 lg:w-[330px] bg-white rounded-lg border border-border shadow-[0_18px_40px_rgba(10,16,34,0.35)] p-[18px] flex flex-col gap-3">
        <div className={`font-mono text-[9px] tracking-[0.1em] uppercase ${SMALL}`}>Follow-up draft · Sara M.</div>
        <p className="text-sm leading-relaxed text-ink">
          Hi Sara, thanks again for visiting the Marina apartment yesterday. The owner is open to offers around AED 2.3M. Would you like to see the unit on the 24th floor too?
        </p>
        <div className="flex gap-2">
          <div className="flex-1 text-center text-[13px] font-semibold text-white bg-mid rounded-md py-2.5">Open in WhatsApp</div>
          <div className="text-[13px] font-semibold text-navy border border-navy rounded-md py-2.5 px-3.5">Edit</div>
        </div>
      </div>
    </div>
  )
}

function Feature({ n, title, children, visual, flip = false }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-8 lg:gap-20 items-center">
      <div className={`flex flex-col gap-3 sm:gap-4 ${flip ? 'lg:order-2' : ''}`}>
        <div className={`font-mono text-[13px] ${SMALL}`}>{n}</div>
        <h3 className="font-display font-semibold text-2xl sm:text-[28px] leading-tight text-navy">{title}</h3>
        <p className={`text-base sm:text-[17px] leading-relaxed ${BODY}`}>{children}</p>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>{visual}</div>
    </div>
  )
}

function PipelineVisual() {
  // Sample data, illustrative only.
  const cols = [
    ['New', 12, [['Olga V.', 'JVC · 1.2M'], ['Daniel K.', 'Marina · rent'], ['Priya S.', 'Downtown · 3M']]],
    ['Contacted', 9, [['Karim A.', 'Al Furjan · rent'], ['Lina H.', 'JLT · 950k']]],
    ['Viewing', 5, [['Sara M.', 'Marina · 2.4M'], ['Tom B.', 'Arabian Ranches']]],
    ['Offer', 2, [['Nadia R.', 'Palm · 6.8M']]],
  ]
  return (
    <div className="bg-white border border-border rounded-md p-3 sm:p-6 grid grid-cols-4 gap-1.5 sm:gap-3" aria-hidden="true">
      {cols.map(([label, count, cards]) => (
        <div key={label} className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
          <div className={`font-mono text-[8px] sm:text-[9px] tracking-[0.1em] uppercase ${SMALL} truncate`}>{label} · {count}</div>
          {cards.map(([name, detail], i) => {
            const active = label === 'Viewing' && i === 0
            return (
              <div key={name} className={`rounded-md border px-2 py-2 sm:px-3 sm:py-2.5 min-w-0 ${active ? 'border-mid bg-[#EAF0FA]' : 'border-border bg-paper'}`}>
                <div className="text-[11px] sm:text-[13px] font-semibold text-navy truncate">{name}</div>
                <div className={`text-[10px] sm:text-[11px] ${SMALL} mt-0.5 truncate`}>{detail}</div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function DraftVisual() {
  return (
    <div className="bg-navy rounded-md p-5 sm:p-7 flex flex-col gap-3.5" aria-hidden="true">
      <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-gold">Draft ready · review before sending</div>
      <div className="bg-white rounded-md p-4 text-sm leading-relaxed text-ink">
        Hi Karim, just checking in on the Al Furjan villa. The landlord has confirmed it is available from the 1st. Shall I book a second viewing this weekend?
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="text-[13px] font-semibold text-white bg-mid rounded-md py-2.5 px-3.5">Open in WhatsApp</div>
        <div className="text-[13px] font-semibold text-white border border-[#5A6788] rounded-md py-2.5 px-3.5">Send by email</div>
      </div>
    </div>
  )
}

function MorningVisual() {
  const rows = [['10:30', 'Viewing · 2BR Marina Gate, with Sara M.'], ['14:00', 'Viewing · Villa, Al Furjan, with Karim A.'], ['Due', '4 follow-ups waiting']]
  return (
    <div className="bg-white border border-border rounded-md p-4 sm:p-6 flex flex-col gap-2.5" aria-hidden="true">
      <div className={`font-mono text-[9px] tracking-[0.1em] uppercase ${SMALL}`}>Your morning digest</div>
      {rows.map(([t, label], i) => (
        <div key={t} className={`flex gap-3.5 items-center p-3 border border-border rounded-md ${i === 2 ? 'bg-paper' : ''}`}>
          <div className="font-mono text-[13px] text-navy w-12 shrink-0">{t}</div>
          <div className="text-sm text-ink">{label}</div>
        </div>
      ))}
    </div>
  )
}

function IntervalToggle({ annual, setAnnual }) {
  const base = 'font-display text-sm font-semibold rounded px-4 min-h-[40px]'
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex bg-paper border border-border rounded-md p-1" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)} className={`${base} ${!annual ? 'bg-navy text-white' : SMALL}`}>Monthly</button>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)} className={`${base} ${annual ? 'bg-navy text-white' : SMALL}`}>Annual</button>
      </div>
      <span className="font-mono text-[11px] tracking-[0.06em] uppercase text-navy bg-[#F4E6CF] px-2.5 py-1.5 rounded">2 months free</span>
    </div>
  )
}

function PlanCard({ name, tagline, price, per, note, features, cta, highlight = false, muted = false }) {
  return (
    <div className={`relative rounded-md p-6 sm:p-8 flex flex-col gap-5 ${highlight ? 'border-2 border-navy bg-white' : 'border border-border'} ${muted ? 'bg-paper' : highlight ? '' : 'bg-white'}`}>
      {highlight && (
        <div className="absolute -top-3 left-6 sm:left-8 font-mono text-[10px] tracking-[0.1em] uppercase text-white bg-navy px-2.5 py-1 rounded">For small teams</div>
      )}
      <div>
        <div className="font-display font-semibold text-[22px] text-navy">{name}</div>
        <div className={`text-[15px] ${SMALL} mt-1`}>{tagline}</div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {price.from && <span className={`text-[15px] ${SMALL}`}>from</span>}
          <span className="font-mono text-4xl sm:text-[40px] text-navy">{price.value}</span>
          <span className={`text-[15px] ${SMALL}`}>{per}</span>
        </div>
        <div className={`font-mono text-xs ${SMALL} mt-1 min-h-[16px]`}>{note}</div>
      </div>
      <ul className="flex flex-col gap-3 text-[15px] text-ink flex-1">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5"><Check />{f}</li>
        ))}
      </ul>
      {cta}
    </div>
  )
}

const FAQ = [
  ['Do I need a card for the trial?', `No. The trial lasts ${TRIAL_DAYS} days, or ${TRIAL_DAYS_REFERRAL} with a referral code. Choose a plan only if you want to keep going.`],
  ['Does Agent send messages to my clients on its own?', 'Never. Agent prepares the draft; you review it and send it from your own WhatsApp or email.'],
  ['Can I cancel anytime?', 'Yes, from the Billing page. You keep access until the end of the period you paid for.'],
]

export default function Landing() {
  const [annual, setAnnual] = useState(false)
  const [searchParams] = useSearchParams()

  // Keep a referral code (?ref=…) on every signup link so the 30-day trial applies.
  const ref = searchParams.get('ref')
  const signupTo = ref ? `/signup?ref=${encodeURIComponent(ref)}` : '/signup'

  useEffect(() => {
    document.title = 'Agent by Vantik | CRM for Dubai real estate agents'
  }, [])

  const [solo, team] = SELF_SERVE_PLANS
  const per = annual ? '/year' : '/month'
  const priceOf = (p) => ({ value: aed(annual ? p.annual : p.monthly) })
  const noteOf = (p) => (annual ? `about ${aed(Math.round(p.annual / 12))}/month` : '')

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      {/* Nav + hero */}
      <div className="bg-navy">
        <header className="max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 lg:h-[84px] lg:pt-0 lg:pb-0 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Agent by Vantik, home"><Lockup /></Link>
          <nav aria-label="Main" className="flex items-center gap-5 lg:gap-9">
            <a href="#features" className="hidden md:inline text-[15px] text-[#D5DAE5] hover:text-white">Features</a>
            <a href="#pricing" className="hidden md:inline text-[15px] text-[#D5DAE5] hover:text-white">Pricing</a>
            <a href="#faq" className="hidden md:inline text-[15px] text-[#D5DAE5] hover:text-white">FAQ</a>
            <Link to="/login" className="text-[15px] font-semibold text-white">Log in</Link>
            <Link to={signupTo} className="hidden sm:inline-flex items-center bg-amber text-ink font-bold text-[15px] rounded-md px-5 min-h-[44px]">Start free trial</Link>
          </nav>
        </header>

        <section className="max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 pb-14 lg:pt-[72px] lg:pb-24 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[520px_minmax(0,1fr)] gap-12 lg:gap-[72px] items-center">
          <div className="flex flex-col gap-6 lg:gap-7">
            <SectionLabel onDark>CRM for Dubai real estate agents</SectionLabel>
            <h1 className="font-display font-semibold text-[38px] sm:text-5xl lg:text-[56px] leading-[1.08] tracking-[-0.02em] text-white">
              Every lead followed up. Every viewing on time.
            </h1>
            <p className="text-[17px] lg:text-[19px] leading-relaxed text-[#D5DAE5]">
              Agent keeps your prospects, properties, viewings and follow-ups in one place. It tells you each morning who to call, drafts the WhatsApp message, and keeps your Google or Outlook calendar in sync.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mt-1">
              <PrimaryCta to={signupTo} className="text-[17px] px-7 py-4">Start your {TRIAL_DAYS}-day free trial</PrimaryCta>
              <a href="#pricing" className="text-white font-semibold underline underline-offset-4 text-center sm:text-left py-2">See pricing</a>
            </div>
            <div className="text-sm text-navMuted text-center sm:text-left">No card required. Prices in AED.</div>
          </div>
          <ProductPreview />
        </section>
      </div>

      {/* Works with */}
      <div className="bg-white border-b border-border">
        <div className="max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 py-6 lg:py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className={`text-[15px] ${SMALL}`}>Works with the tools you already use</div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 lg:gap-12 font-display font-semibold text-[15px] lg:text-base text-navy">
            <span>WhatsApp</span><span>Google Calendar</span><span>Outlook</span><span>Google &amp; Microsoft sign-in</span><span>PDF invoices</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="scroll-mt-4 max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 pt-20 lg:pt-[120px] pb-10 flex flex-col gap-16 lg:gap-24">
        <div className="max-w-[720px] flex flex-col gap-4">
          <SectionLabel>What Agent does</SectionLabel>
          <h2 className="font-display font-semibold text-[30px] sm:text-[40px] leading-[1.15] tracking-[-0.015em] text-navy">
            Built around the day of an agent, not a sales team.
          </h2>
        </div>

        <Feature n="01" title="A pipeline you actually keep up to date" visual={<PipelineVisual />}>
          Log a prospect in seconds: intent, budget, areas they want. Move them from new lead to viewing to offer. Agent flags who has gone quiet so nobody slips through.
        </Feature>
        <Feature n="02" title="Follow-ups written for you, sent by you" visual={<DraftVisual />} flip>
          Agent drafts the next message from the prospect's history and the property they saw. You read it, adjust it, and it opens in WhatsApp or your email. Nothing is ever sent without you.
        </Feature>
        <Feature n="03" title="Your calendar and your morning, sorted" visual={<MorningVisual />}>
          Viewings sync with Google Calendar or Outlook, with invites sent to the client. Every morning, a short email lists your follow-ups and viewings, and push reminders keep you on time.
        </Feature>

        <div className="grid md:grid-cols-3 gap-6 md:gap-6 border-t border-border">
          {[
            ['Properties and brochures', 'Keep your listings with owner details, and turn any property into a branded PDF brochure or a share link.'],
            ['Invoices with your logo', 'Issue commission invoices as PDF, track what is due, and get reminded before the due date.'],
            ['Works on your phone', 'Install Agent on your home screen and use it between viewings, with notifications, like a native app.'],
          ].map(([t, d]) => (
            <div key={t} className="pt-7 flex flex-col gap-2.5">
              <h3 className="font-display font-semibold text-lg text-navy">{t}</h3>
              <p className={`text-[15px] leading-relaxed ${BODY}`}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-4 mt-10 lg:mt-20 bg-white border-y border-border">
        <div className="max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 py-20 lg:py-[120px] flex flex-col gap-10 lg:gap-12">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex flex-col gap-4 max-w-[640px]">
              <SectionLabel>Pricing</SectionLabel>
              <h2 className="font-display font-semibold text-[30px] sm:text-[40px] leading-[1.15] tracking-[-0.015em] text-navy">
                Simple pricing in AED. Start free for {TRIAL_DAYS} days.
              </h2>
            </div>
            <IntervalToggle annual={annual} setAnnual={setAnnual} />
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            <PlanCard
              name={solo.name}
              tagline="For the independent agent"
              price={priceOf(solo)} per={per} note={noteOf(solo)}
              features={['1 agent', 'Prospects, properties, tasks', 'Follow-up drafts for WhatsApp and email', 'Google or Outlook calendar sync', 'PDF invoices and brochures']}
              cta={<Link to={signupTo} className="text-center font-semibold text-navy border border-navy rounded-md py-3.5 min-h-[48px]">Start free trial</Link>}
            />
            <PlanCard
              highlight
              name={team.name}
              tagline="Up to 5 agents working together"
              price={priceOf(team)} per={per} note={noteOf(team)}
              features={['Everything in Solo', 'Up to 5 agents', 'Invite your team, assign roles', 'Shared prospects and properties']}
              cta={<PrimaryCta to={signupTo} className="w-full">Start free trial</PrimaryCta>}
            />
            <PlanCard
              muted
              name="Brokerage"
              tagline="For agencies with larger teams"
              price={{ value: aed(BROKERAGE_FROM), from: true }} per="/month" note="Custom quote"
              features={['Everything in Team', 'More than 5 agents', 'Portal integrations and API', 'Dedicated support']}
              cta={<a href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('Agent by Vantik: Brokerage plan')}`} className="text-center font-semibold text-navy border border-navy bg-white rounded-md py-3.5 min-h-[48px]">Talk to us</a>}
            />
          </div>
          <p className={`text-sm ${SMALL}`}>
            Prices in AED, billed in advance. No VAT charged. Cancel anytime; your plan runs until the end of the period you paid for.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-4 max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 py-20 lg:py-[120px] grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[400px_minmax(0,1fr)] gap-8 lg:gap-20">
        <div className="flex flex-col gap-4">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="font-display font-semibold text-[30px] sm:text-[40px] leading-[1.15] tracking-[-0.015em] text-navy">Before you start</h2>
        </div>
        <div className="flex flex-col">
          {FAQ.map(([q, a]) => (
            <div key={q} className="py-6 border-t border-border">
              <h3 className="font-display font-semibold text-lg text-navy mb-2">{q}</h3>
              <p className={`text-base leading-relaxed ${BODY}`}>{a}</p>
            </div>
          ))}
          <div className="py-6 border-y border-border">
            <h3 className="font-display font-semibold text-lg text-navy mb-2">Who can see my clients' data?</h3>
            <p className={`text-base leading-relaxed ${BODY}`}>
              Only you and the teammates you invite. Each agency's data is isolated, and we never sell it. Details in our{' '}
              <Link to="/legal/privacy" className="text-mid font-semibold underline underline-offset-2">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <div className="max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12">
        <div className="bg-navy rounded-lg px-6 py-10 sm:px-12 lg:px-[72px] lg:py-16 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex flex-col gap-3">
            <span className="w-8 h-px bg-gold" />
            <h2 className="font-display font-semibold text-[28px] lg:text-[34px] leading-tight text-white">Try Agent on your next lead.</h2>
            <p className="text-[17px] text-[#D5DAE5]">{TRIAL_DAYS} days free, no card. Set up in a few minutes.</p>
          </div>
          <PrimaryCta to={signupTo} className="text-[17px] px-7 py-4 whitespace-nowrap">Start your free trial</PrimaryCta>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 lg:mt-24 bg-white border-t border-border">
        <div className="max-w-[1248px] mx-auto px-5 sm:px-8 lg:px-12 py-10 lg:py-12 pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex flex-col lg:flex-row lg:justify-between lg:items-start gap-8">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-end gap-2">
              <Mark height={28} on="light" />
              <div className="font-display font-bold text-lg leading-none text-navy">Agent</div>
            </div>
            <p className={`text-[13px] leading-relaxed ${SMALL}`}>
              © {new Date().getFullYear()} {COMPANY.legalName}, Dubai.<br />
              {COMPANY.licenceType} No. {COMPANY.licenceNo}.
            </p>
          </div>
          <nav aria-label="Legal" className="flex flex-col sm:flex-row sm:flex-wrap gap-x-10 gap-y-3 text-sm">
            {LEGAL_DOCS.map((d) => (
              <Link key={d.to} to={d.to} className={`${BODY} hover:text-navy`}>{d.label}</Link>
            ))}
            <a href={`mailto:${COMPANY.email}`} className={`${BODY} hover:text-navy`}>{COMPANY.email}</a>
          </nav>
        </div>
      </footer>

      {/* Mobile sticky CTA: the header hides its trial button below 640px */}
      <div className="sm:hidden sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <PrimaryCta to={signupTo} className="w-full">Start your {TRIAL_DAYS}-day free trial</PrimaryCta>
      </div>
    </div>
  )
}
