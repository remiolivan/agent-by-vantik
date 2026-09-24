import LegalPage from './LegalPage'
import { COMPANY } from '../../lib/legal'

const Mail = () => <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>

const sections = [
  {
    id: 'trial',
    title: 'Free trial',
    body: (
      <p>
        Every account starts with a free trial (14 days, or 30 with a referral code). Nothing is charged during the
        trial, so there is nothing to refund.
      </p>
    ),
  },
  {
    id: 'cancel',
    title: 'Cancelling a subscription',
    body: (
      <p>
        You can cancel a monthly or annual subscription at any time from the Billing page. It stops renewing, and you
        keep full access until the end of the period you have already paid for.
      </p>
    ),
  },
  {
    id: 'no-partial',
    title: 'Partial periods',
    body: (
      <p>
        Subscriptions are paid in advance. We don’t refund or credit the unused part of a month or year, whether you
        cancel, downgrade or stop using the Service mid-period.
      </p>
    ),
  },
  {
    id: 'errors',
    title: 'Billing errors',
    body: (
      <>
        <p>We refund in full any amount charged by mistake, including:</p>
        <ul>
          <li>a duplicate charge for the same period;</li>
          <li>a renewal charged after your cancellation had taken effect;</li>
          <li>an amount that doesn’t match the price shown when you subscribed.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'request',
    title: 'How to request a refund',
    body: (
      <p>
        Email <Mail /> within 30 days of the charge, from your account email address, with the date and amount. We
        reply within 5 business days. Approved refunds go back to the original payment method in AED through Stripe.
        Depending on your bank, they appear on your statement 5 to 10 business days later.
      </p>
    ),
  },
  {
    id: 'brokerage',
    title: 'Brokerage plan',
    body: <p>Brokerage subscriptions follow the payment and cancellation terms of their individual agreement.</p>,
  },
  {
    id: 'rights',
    title: 'Your statutory rights',
    body: <p>This policy does not affect any rights you have under UAE consumer protection law.</p>,
  },
]

export default function Refunds() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={`How cancellations and refunds work for paid ${COMPANY.product} subscriptions. All prices and refunds are in UAE dirhams (AED).`}
      sections={sections}
    />
  )
}
