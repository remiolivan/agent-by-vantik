// Server-side entry used only at build time (scripts/prerender.mjs).
// Renders the public pages to static HTML so search engines and AI crawlers
// (OAI-SearchBot, Claude-SearchBot, Bingbot...) read real content instead of
// an empty <div id="root">. The browser still boots the normal SPA (main.jsx).
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Landing, { FAQ } from './pages/Landing'
import Terms from './pages/legal/Terms'
import Privacy from './pages/legal/Privacy'
import Refunds from './pages/legal/Refunds'
import { SELF_SERVE_PLANS, BROKERAGE_FROM, TRIAL_DAYS } from './lib/pricing'
import { COMPANY } from './lib/legal'

const PAGES = {
  '/': Landing,
  '/legal/terms': Terms,
  '/legal/privacy': Privacy,
  '/legal/refunds': Refunds,
}

export function render(url) {
  const Page = PAGES[url]
  return renderToString(
    <StaticRouter location={url}>
      <Page />
    </StaticRouter>,
  )
}

export const data = { FAQ, SELF_SERVE_PLANS, BROKERAGE_FROM, TRIAL_DAYS, COMPANY }
