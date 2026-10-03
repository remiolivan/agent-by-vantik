// Runs after `vite build` and `vite build --ssr src/prerender.jsx` (see the
// "build" script in package.json). For each public page it writes a static
// HTML file containing the real rendered content plus page-specific <head>
// tags (title, description, canonical, Open Graph, JSON-LD), so crawlers that
// do not run JavaScript (OAI-SearchBot, Claude-SearchBot, Bingbot) can read it.
//
// The SPA still boots normally on top: createRoot() replaces the prerendered
// markup on first render. A tiny inline script hides the prerendered markup
// when it is not the page being shown (dist/index.html is also Cloudflare's
// SPA fallback for /login, /prospects... and signed-in users get the
// dashboard at "/"), so nobody sees a flash of the wrong page.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')
const SITE = 'https://agent.getvantik.com'
const OG_IMAGE = `${SITE}/og-image.png`

const ssrEntry = fs.readdirSync(ssrDir).find((f) => /^prerender\.(m?js)$/.test(f))
const { render, data } = await import(pathToFileURL(path.join(ssrDir, ssrEntry)).href)
const { FAQ, SELF_SERVE_PLANS, BROKERAGE_FROM, TRIAL_DAYS, COMPANY } = data

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------- Structured data (one source: pricing.js, legal.js, Landing FAQ)
const [solo, team] = SELF_SERVE_PLANS
const DESCRIPTION_LONG =
  'Agent by Vantik is a CRM for real estate agents and brokerages in Dubai. It keeps prospects, properties, viewings and follow-ups in one place, drafts WhatsApp and email follow-ups for the agent to review and send, syncs viewings with Google Calendar or Outlook, and issues commission invoices and property brochures as PDF.'

const offer = (name, price, period) => ({
  '@type': 'Offer',
  name,
  price: String(price),
  priceCurrency: 'AED',
  url: `${SITE}/#pricing`,
  priceSpecification: {
    '@type': 'UnitPriceSpecification',
    price: String(price),
    priceCurrency: 'AED',
    unitText: period,
  },
})

const orgId = 'https://getvantik.com/#organization'
const jsonLdHome = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': orgId,
      name: COMPANY.legalName,
      alternateName: 'Vantik',
      url: 'https://getvantik.com',
      logo: `${SITE}/pwa-512x512.png`,
      email: COMPANY.email,
      address: { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: `${SITE}/`,
      name: 'Agent by Vantik',
      publisher: { '@id': orgId },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE}/#software`,
      name: 'Agent by Vantik',
      alternateName: 'Agent',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Real estate CRM',
      operatingSystem: 'Web browser; installable on iOS and Android',
      url: `${SITE}/`,
      image: OG_IMAGE,
      description: DESCRIPTION_LONG,
      publisher: { '@id': orgId },
      areaServed: [
        { '@type': 'City', name: 'Dubai' },
        { '@type': 'Country', name: 'United Arab Emirates' },
      ],
      audience: { '@type': 'BusinessAudience', audienceType: 'Real estate agents and brokerages' },
      featureList: [
        'Prospect pipeline from new lead to viewing to offer',
        'WhatsApp and email follow-up drafts, reviewed and sent by the agent',
        'Google Calendar and Outlook sync for viewings, with client invites',
        'Daily morning email and push reminders',
        'Property listings with owner details, PDF brochures and share links',
        'Commission invoices as PDF',
        'Team plan for up to 5 agents',
      ],
      offers: [
        offer(`${solo.name} (monthly)`, solo.monthly, 'MONTH'),
        offer(`${solo.name} (annual)`, solo.annual, 'YEAR'),
        offer(`${team.name} (monthly)`, team.monthly, 'MONTH'),
        offer(`${team.name} (annual)`, team.annual, 'YEAR'),
        { ...offer('Brokerage (from)', BROKERAGE_FROM, 'MONTH'), description: 'Custom quote for agencies with more than 5 agents' },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE}/#faq`,
      mainEntity: FAQ.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
}

// ---------- Pages
const PAGES = [
  {
    url: '/',
    file: 'index.html',
    title: 'Agent by Vantik | CRM for Dubai real estate agents',
    description: `CRM for Dubai real estate agents: prospects, properties, viewings and WhatsApp follow-ups in one place. From AED ${solo.monthly}/month, ${TRIAL_DAYS}-day free trial.`,
    jsonLd: jsonLdHome,
  },
  {
    url: '/legal/terms',
    file: 'legal/terms.html',
    title: 'Terms of Service | Agent by Vantik',
    description: `Terms of Service for Agent by Vantik, the CRM for Dubai real estate agents, operated by ${COMPANY.legalName}.`,
  },
  {
    url: '/legal/privacy',
    file: 'legal/privacy.html',
    title: 'Privacy Policy | Agent by Vantik',
    description: `How ${COMPANY.legalName} collects, uses and protects personal data in Agent by Vantik.`,
  },
  {
    url: '/legal/refunds',
    file: 'legal/refunds.html',
    title: 'Refund Policy | Agent by Vantik',
    description: 'Cancellation and refund policy for Agent by Vantik subscriptions.',
  },
]

function headFor(page) {
  const canonical = `${SITE}${page.url === '/' ? '/' : page.url}`
  // Hide the prerendered markup when it is not the page being displayed
  // (SPA fallback routes, or a signed-in user opening "/").
  const guard = `<script>(function(){try{var p=location.pathname.replace(/\\/+$/,'')||'/';var s=Object.keys(localStorage).some(function(k){return /^sb-.*-auth-token$/.test(k)});if(p!==${JSON.stringify(page.url)}||(s&&p==='/'))document.documentElement.classList.add('np')}catch(e){}})()</script><style>.np [data-prerender]{display:none}</style>`
  const tags = [
    guard,
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Agent by Vantik" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="en_AE" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ]
  if (page.jsonLd) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`)
  }
  return tags.join('\n  ')
}

for (const page of PAGES) {
  const markup = render(page.url)
  if (!markup || markup.length < 500) throw new Error(`Prerender of ${page.url} looks empty`)
  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n  ${headFor(page)}`)
    .replace('<div id="root"></div>', `<div id="root"><div data-prerender>${markup}</div></div>`)
  if (!html.includes('data-prerender')) throw new Error(`Could not inject markup for ${page.url}`)
  const out = path.join(dist, page.file)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, html)
  console.log(`prerendered ${page.url} -> dist/${page.file} (${Math.round(markup.length / 1024)} kB of HTML)`)
}

fs.rmSync(ssrDir, { recursive: true, force: true })
