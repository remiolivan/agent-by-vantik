import { Link } from 'react-router-dom'
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
          {COMPANY.product} (the “Service”) is provided by <strong>{COMPANY.legalName}</strong>, a {COMPANY.legalForm.toLowerCase()} registered
          in Dubai under {COMPANY.licenceType} No. {COMPANY.licenceNo} and commercial register No. {COMPANY.registerNo}, issued by
          the {COMPANY.authority} (“Vantik”, “we”, “us”).
        </p>
        <p>
          These Terms form a binding agreement between Vantik and you. If you use the Service on behalf of an agency or
          other business, “you” means that business, and you confirm you are authorised to accept these Terms for it.
        </p>
      </>
    ),
  },
  {
    id: 'the-service',
    title: 'The Service and who can use it',
    body: (
      <>
        <p>
          The Service is a CRM for real estate professionals, available at {COMPANY.appHost}. It lets you manage
          prospects, properties, tasks, appointments, calendar sync, documents and invoices, and follow-ups.
        </p>
        <p>
          The Service is for business use only. You must be at least 18 years old and legally able to enter into a
          contract under the laws of the United Arab Emirates.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>Give accurate information when you sign up and keep it up to date.</li>
        <li>Keep your login details secure. You are responsible for everything done through your account and by the team members you invite.</li>
        <li>Tell us straight away at <Mail /> if you think someone has accessed your account without permission.</li>
      </ul>
    ),
  },
  {
    id: 'trial',
    title: 'Free trial',
    body: (
      <p>
        New accounts start with a free trial of 14 days, or 30 days with a valid referral code. No payment details are
        needed to start. At the end of the trial, you need to choose a paid plan to keep using the Service. If you
        don’t, we may restrict access to your account.
      </p>
    ),
  },
  {
    id: 'plans-payment',
    title: 'Plans, prices and payment',
    body: (
      <>
        <p>
          The Solo and Team plans are sold online. Current prices are shown on the Billing page, in UAE dirhams (AED).
          The Brokerage plan is quoted individually and covered by a separate agreement.
        </p>
        <ul>
          <li>Subscriptions are billed in advance, monthly or annually, and renew automatically at the end of each period until cancelled.</li>
          <li>Payments are processed by Stripe. We never see or store your full card details.</li>
          <li>{COMPANY.legalName} is not currently registered for VAT, so no VAT is charged. If we register, VAT will be added at the applicable rate and we will tell you beforehand.</li>
          <li>We give at least 30 days’ notice of any price change. New prices apply from your next renewal.</li>
          <li>If a payment fails, we may suspend paid features until it is settled.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: 'Cancellation and refunds',
    body: (
      <p>
        You can cancel at any time from the Billing page. Cancellation takes effect at the end of the current billing
        period, and you keep full access until then. Refunds are handled under our{' '}
        <Link to="/legal/refunds">Refund Policy</Link>.
      </p>
    ),
  },
  {
    id: 'your-data',
    title: 'Your data',
    body: (
      <>
        <p>
          You own the content you put into the Service: prospects, contacts, properties, notes, documents and invoices
          (“Your Data”). You allow us to host, copy and process Your Data only as needed to run the Service for you.
          How we handle personal data is described in our <Link to="/legal/privacy">Privacy Policy</Link>.
        </p>
        <p>
          You are responsible for having a lawful basis to store your clients’ personal data in the Service, and for
          the messages you send them. Messages sent by WhatsApp or email leave from your own accounts, not ours.
        </p>
      </>
    ),
  },
  {
    id: 'ai-drafts',
    title: 'AI-drafted messages',
    body: (
      <p>
        The Service can draft follow-up messages automatically. Drafts are never sent without your action. They may
        contain mistakes, so review and edit each one before sending. You are responsible for what you send.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Connected services',
    body: (
      <p>
        You can sign in with Google or Microsoft and connect a Google or Outlook calendar. Your use of those services
        is governed by their own terms. We are not responsible for their availability or for changes they make that
        affect the connection.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use the Service to send spam or unsolicited bulk messages;</li>
          <li>break any law or regulation that applies to you, including rules on real estate brokerage and property advertising in the UAE;</li>
          <li>upload malware or content that infringes someone else’s rights;</li>
          <li>try to access other customers’ data, probe or bypass our security, or overload the Service;</li>
          <li>copy, resell or reverse engineer the Service, or scrape it by automated means.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We work to keep the Service available and secure, but we can’t promise it will be uninterrupted or error-free.
        We may carry out maintenance and improve, add or remove features. If we remove a feature you pay for in a way
        that materially reduces the Service, we will tell you in advance.
      </p>
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    body: (
      <p>
        The Service, its software, design and the Agent by Vantik and Vantik names and logos belong to {COMPANY.legalName}.
        While your subscription is active, we grant you a limited, non-exclusive, non-transferable right to use the
        Service for your business.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <p>
        We may suspend or close your account if you seriously or repeatedly break these Terms, or if payment remains
        overdue. Where possible, we will warn you first. You can close your account at any time by writing to <Mail />.
        After closure, Your Data is deleted as described in the <Link to="/legal/privacy">Privacy Policy</Link>. Ask us
        before closing if you want an export.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        The Service is a software tool. It does not provide legal, financial or brokerage advice. Except as stated in
        these Terms, it is provided “as is” and “as available”.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the extent permitted by UAE law, Vantik is not liable for indirect or consequential losses, including lost
        profits, lost deals or lost data. Our total liability for any claim related to the Service is limited to the
        fees you paid us in the 12 months before the event giving rise to the claim. Nothing in these Terms limits
        liability that cannot be limited under applicable law.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <p>
        We may update these Terms. For material changes, we will notify you by email or in the app at least 15 days
        before they take effect. Continuing to use the Service after that date means you accept the new Terms.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These Terms are governed by the laws of the Emirate of Dubai and the applicable federal laws of the United
        Arab Emirates. The courts of Dubai have exclusive jurisdiction over any dispute.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these Terms: <Mail />. Postal address: {COMPANY.legalName}, {COMPANY.address}.
      </p>
    ),
  },
]

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These Terms govern your use of ${COMPANY.product}. By creating an account or using the Service, you accept them.`}
      sections={sections}
    />
  )
}
