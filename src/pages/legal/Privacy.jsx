import LegalPage from './LegalPage'
import { COMPANY } from '../../lib/legal'

const Mail = () => <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>

const sections = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          {COMPANY.product} is provided by {COMPANY.legalName}, {COMPANY.licenceType} No. {COMPANY.licenceNo}, Dubai
          (“Vantik”, “we”, “us”).
        </p>
        <p>
          We decide how account and billing data is used, so we are responsible for it. For the client data you
          enter (your prospects, contacts and their details), you are in charge and we process it on your behalf,
          only to run the Service.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <ul>
        <li><strong>Account data:</strong> your name, email address, business name and password (stored hashed). If you sign in with Google or Microsoft, we receive your name and email from them.</li>
        <li><strong>Team data:</strong> the members of your organisation, their roles and activity in the app.</li>
        <li><strong>Your content:</strong> prospects and contacts (names, phone numbers, emails, requirements), properties, notes, tasks, appointments, documents and invoices you create.</li>
        <li><strong>Calendar data:</strong> if you connect Google or Outlook calendar, access tokens and the details of events created or synced through Agent.</li>
        <li><strong>Billing data:</strong> your plan, subscription status and Stripe customer reference. Card details are handled by Stripe, not us.</li>
        <li><strong>Device and technical data:</strong> push notification subscriptions, IP address and request logs from our hosting providers, and browser storage used to keep you signed in.</li>
        <li><strong>Messages to us:</strong> support requests and Brokerage plan enquiries.</li>
      </ul>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use it',
    body: (
      <>
        <ul>
          <li>to provide the Service: store your pipeline, sync calendars, generate PDFs and share links;</li>
          <li>to send reminders, invitations, digests and push notifications you have turned on;</li>
          <li>to draft follow-up messages when you ask for one;</li>
          <li>to process payments and manage your subscription;</li>
          <li>to answer support requests and keep the Service secure;</li>
          <li>to meet legal, tax and accounting obligations.</li>
        </ul>
        <p>We do not sell personal data and we do not use it for advertising.</p>
      </>
    ),
  },
  {
    id: 'legal-basis',
    title: 'Legal basis',
    body: (
      <p>
        We process personal data in line with UAE Federal Decree-Law No. 45 of 2021 on Personal Data Protection and
        other laws that apply. We rely on the performance of our contract with you, our legitimate interest in running
        and securing the Service, your consent where we ask for it (push notifications, calendar connection), and our
        legal obligations.
      </p>
    ),
  },
  {
    id: 'google-data',
    title: 'Google user data',
    body: (
      <p>
        When you connect Google, we use your Google account email to sign you in and your Google Calendar access only
        to create, update and read the events you sync through Agent. Our use and transfer of information received from
        Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not use Google user data for advertising, sell it, or let
        people read it except where needed for security, legal compliance or with your permission.
      </p>
    ),
  },
  {
    id: 'providers',
    title: 'Service providers',
    body: (
      <>
        <p>We share data only with providers that help us run the Service, under contracts that limit their use of it:</p>
        <ul>
          <li><strong>Supabase:</strong> database, authentication, file storage and backend functions (hosted in Frankfurt, Germany).</li>
          <li><strong>Cloudflare:</strong> hosting and delivery of the app.</li>
          <li><strong>Resend:</strong> transactional emails.</li>
          <li><strong>Google and Microsoft:</strong> sign-in and calendar sync, when you choose to use them.</li>
          <li><strong>Stripe:</strong> payment processing.</li>
          <li><strong>Anthropic:</strong> AI model that writes follow-up drafts. Only when you ask for a draft, it receives the prospect’s name, pipeline stage, budget and preferences, the linked property’s details, the last few logged activities and your business name. Phone numbers and email addresses are not sent.</li>
          <li><strong>Google Fonts:</strong> serves the app’s typefaces, which exposes your IP address to Google.</li>
        </ul>
        <p>We may also disclose data where required by law or a competent authority.</p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'International transfers',
    body: (
      <p>
        Your data is stored in the European Union (Germany). Some providers may process it in other countries. When
        data leaves the UAE, we rely on providers that offer an adequate level of protection and contractual
        safeguards.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <p>
        We keep your data while your account is active. After your account is closed, we delete Your Data within 90
        days, apart from backups, which expire on their normal cycle, and billing records, which we keep as long as
        UAE law requires.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Data is encrypted in transit, access is restricted to what each role needs, and every organisation’s data is
        isolated at the database level. No system is completely secure, but if a breach affects your data, we will
        notify you and the relevant authorities as the law requires.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          You can ask to access, correct, export or delete your personal data, object to or restrict certain
          processing, and withdraw consent at any time. Write to <Mail />. We reply within 30 days.
        </p>
        <p>
          If an agent using Agent by Vantik holds your details as a client or prospect, contact that agent first. We
          will help them respond to your request.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and browser storage',
    body: (
      <p>
        We don’t use advertising or analytics cookies. The app uses your browser’s storage to keep you signed in and
        remember your preferences, and a service worker to deliver push notifications.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>The Service is for professionals aged 18 and over. We don’t knowingly collect data from children.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy. For material changes, we will notify you by email or in the app before they take
        effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Privacy questions and requests: <Mail />. Postal address: {COMPANY.legalName}, {COMPANY.address}.
      </p>
    ),
  },
]

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what personal data ${COMPANY.product} collects, why, and the choices you have.`}
      sections={sections}
    />
  )
}
