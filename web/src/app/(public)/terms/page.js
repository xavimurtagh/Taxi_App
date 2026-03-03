export const metadata = {
  title: 'Terms of Service — OpenRide',
  description:
    'Terms of Service for the OpenRide community-owned ride-sharing cooperative platform.',
};

const styles = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '48px 32px',
  },
  header: {
    marginBottom: 40,
    paddingBottom: 32,
    borderBottom: '2px solid #e2e4ea',
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    color: '#1a1a2e',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#5a5a7a',
    lineHeight: 1.6,
  },
  effectiveDate: {
    display: 'inline-block',
    marginTop: 12,
    padding: '6px 14px',
    background: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
  },
  tocContainer: {
    background: '#f8f9fb',
    border: '1px solid #e2e4ea',
    borderRadius: 12,
    padding: '24px 32px',
    marginBottom: 48,
  },
  tocTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 16,
  },
  tocList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    columns: 2,
    columnGap: 32,
  },
  tocItem: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 1.5,
    breakInside: 'avoid',
  },
  tocLink: {
    color: '#2E7D32',
    textDecoration: 'none',
  },
  section: {
    marginBottom: 40,
    scrollMarginTop: 80,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1px solid #e2e4ea',
    letterSpacing: -0.3,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 1.8,
    color: '#333',
    marginBottom: 12,
  },
  list: {
    paddingLeft: 24,
    marginBottom: 16,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 1.8,
    color: '#333',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 17,
    fontWeight: 600,
    color: '#1a1a2e',
    marginTop: 20,
    marginBottom: 10,
  },
  highlight: {
    background: '#FFF3E0',
    border: '1px solid #FFE0B2',
    borderRadius: 8,
    padding: '16px 20px',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#e65100',
    marginBottom: 16,
  },
  infoBox: {
    background: '#E3F2FD',
    border: '1px solid #BBDEFB',
    borderRadius: 8,
    padding: '16px 20px',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#1565C0',
    marginBottom: 16,
  },
};

const tocItems = [
  { id: 'acceptance', label: '1. Acceptance of Terms' },
  { id: 'eligibility', label: '2. Eligibility' },
  { id: 'accounts', label: '3. Account Responsibilities' },
  { id: 'service-description', label: '4. Service Description' },
  { id: 'user-conduct', label: '5. User Conduct' },
  { id: 'driver-terms', label: '6. Driver-Specific Terms' },
  { id: 'passenger-terms', label: '7. Passenger-Specific Terms' },
  { id: 'fare-calculation', label: '8. Fare Calculation & Transparency' },
  { id: 'governance', label: '9. Governance Participation' },
  { id: 'surplus', label: '10. Surplus Redistribution' },
  { id: 'payment', label: '11. Payment Terms' },
  { id: 'intellectual-property', label: '12. Intellectual Property' },
  { id: 'privacy', label: '13. Privacy' },
  { id: 'dispute-resolution', label: '14. Dispute Resolution' },
  { id: 'liability', label: '15. Limitation of Liability' },
  { id: 'termination', label: '16. Termination & Deactivation' },
  { id: 'modifications', label: '17. Modifications to Terms' },
  { id: 'general', label: '18. General Provisions' },
  { id: 'contact', label: '19. Contact Information' },
];

export default function TermsOfServicePage() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Terms of Service</h1>
        <p style={styles.subtitle}>
          OpenRide Cooperative, Inc. — Community-Owned Ride-Sharing Platform
        </p>
        <span style={styles.effectiveDate}>Effective Date: [DATE]</span>
      </div>

      {/* Table of Contents */}
      <nav style={styles.tocContainer}>
        <h2 style={styles.tocTitle}>Table of Contents</h2>
        <ol style={styles.tocList}>
          {tocItems.map((item) => (
            <li key={item.id} style={styles.tocItem}>
              <a href={`#${item.id}`} style={styles.tocLink}>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Introduction */}
      <div style={{ ...styles.paragraph, marginBottom: 32 }}>
        <p style={styles.paragraph}>
          Welcome to OpenRide. These Terms of Service (&quot;Terms&quot;) govern your
          access to and use of the OpenRide platform, including our mobile applications,
          websites, and related services (collectively, the &quot;Platform&quot;). OpenRide
          is operated by OpenRide Cooperative, Inc. (&quot;OpenRide,&quot; &quot;we,&quot;
          &quot;us,&quot; or &quot;our&quot;), a community-owned, non-profit cooperative.
        </p>
        <p style={styles.paragraph}>
          Please read these Terms carefully before using the Platform. By accessing or
          using the Platform, you agree to be bound by these Terms. If you do not agree to
          these Terms, do not use the Platform.
        </p>
      </div>

      {/* Section 1: Acceptance of Terms */}
      <section id="acceptance" style={styles.section}>
        <h2 style={styles.sectionTitle}>1. Acceptance of Terms</h2>
        <p style={styles.paragraph}>
          By creating an account, accessing, or using the OpenRide Platform in any manner,
          you acknowledge that you have read, understood, and agree to be bound by these
          Terms of Service, our{' '}
          <a href="/privacy" style={{ color: '#2E7D32' }}>
            Privacy Policy
          </a>
          , and any additional terms or policies referenced herein.
        </p>
        <p style={styles.paragraph}>
          Your continued use of the Platform after any modifications to these Terms
          constitutes your acceptance of such changes. Material changes to these Terms
          require approval through the OpenRide governance process as described in Section
          17.
        </p>
      </section>

      {/* Section 2: Eligibility */}
      <section id="eligibility" style={styles.section}>
        <h2 style={styles.sectionTitle}>2. Eligibility</h2>
        <p style={styles.paragraph}>
          To use the OpenRide Platform, you must meet the following requirements:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            You must be at least <strong>18 years of age</strong> to create an account and
            use the Platform as a passenger.
          </li>
          <li style={styles.listItem}>
            You must be at least <strong>21 years of age</strong> to register as a driver
            on the Platform.
          </li>
          <li style={styles.listItem}>
            You must have the legal capacity to enter into a binding agreement in your
            jurisdiction.
          </li>
          <li style={styles.listItem}>
            You must not have been previously banned or removed from the Platform through
            the peer review process.
          </li>
          <li style={styles.listItem}>
            You must provide accurate, current, and complete information during
            registration and keep your account information updated.
          </li>
        </ul>
      </section>

      {/* Section 3: Account Responsibilities */}
      <section id="accounts" style={styles.section}>
        <h2 style={styles.sectionTitle}>3. Account Responsibilities</h2>
        <p style={styles.paragraph}>
          When you create an account on OpenRide, you agree to the following:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Account Security:</strong> You are responsible for maintaining the
            confidentiality of your account credentials and for all activities that occur
            under your account. You must immediately notify OpenRide of any unauthorized
            use of your account.
          </li>
          <li style={styles.listItem}>
            <strong>Accurate Information:</strong> You must provide truthful, accurate, and
            complete information during registration. Providing false or misleading
            information may result in account suspension or termination.
          </li>
          <li style={styles.listItem}>
            <strong>Single Account:</strong> You may only maintain one active account. You
            may not create or operate multiple accounts.
          </li>
          <li style={styles.listItem}>
            <strong>Non-Transferable:</strong> Your account is personal to you and may not
            be transferred, sold, or assigned to any other person or entity.
          </li>
          <li style={styles.listItem}>
            <strong>Communications:</strong> By creating an account, you consent to
            receiving service-related communications from OpenRide via email, SMS, or push
            notifications. You may opt out of non-essential communications at any time.
          </li>
        </ul>
      </section>

      {/* Section 4: Service Description */}
      <section id="service-description" style={styles.section}>
        <h2 style={styles.sectionTitle}>4. Service Description</h2>
        <p style={styles.paragraph}>
          OpenRide is a <strong>community-owned, non-profit cooperative</strong>{' '}
          ride-sharing platform that connects passengers who need rides with drivers who
          provide transportation services. Key aspects of our service include:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Cooperative Structure:</strong> OpenRide is owned and governed by its
            community of drivers and passengers. All members have the right to participate
            in governance decisions.
          </li>
          <li style={styles.listItem}>
            <strong>Technology Platform:</strong> We provide the technology that facilitates
            ride matching, fare calculation, navigation, payment processing, and
            communication between drivers and passengers.
          </li>
          <li style={styles.listItem}>
            <strong>Not a Transportation Provider:</strong> OpenRide does not provide
            transportation services directly. Drivers are independent service providers who
            use the Platform to connect with passengers.
          </li>
          <li style={styles.listItem}>
            <strong>Transparency:</strong> All platform financials, fee structures, and
            governance decisions are publicly visible on our transparency dashboard.
          </li>
          <li style={styles.listItem}>
            <strong>Open Source:</strong> The OpenRide Platform software is open source and
            available for public review under the AGPL-3.0 license.
          </li>
        </ul>
      </section>

      {/* Section 5: User Conduct */}
      <section id="user-conduct" style={styles.section}>
        <h2 style={styles.sectionTitle}>5. User Conduct</h2>
        <p style={styles.paragraph}>
          All users of the OpenRide Platform agree to the following standards of conduct:
        </p>

        <h3 style={styles.subheading}>5.1 General Conduct</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Treat all other users with respect, courtesy, and dignity.
          </li>
          <li style={styles.listItem}>
            Comply with all applicable local, state, and federal laws and regulations.
          </li>
          <li style={styles.listItem}>
            Provide accurate information and act in good faith in all interactions on the
            Platform.
          </li>
          <li style={styles.listItem}>
            Do not use the Platform for any unlawful, harmful, or fraudulent purpose.
          </li>
        </ul>

        <h3 style={styles.subheading}>5.2 Non-Discrimination Policy</h3>
        <p style={styles.paragraph}>
          OpenRide is committed to providing a platform free from discrimination. Users
          must not discriminate against others based on race, color, religion, national
          origin, sex, gender identity, sexual orientation, age, disability, veteran
          status, or any other protected characteristic under applicable law.
        </p>
        <div style={styles.highlight}>
          <strong>Zero Tolerance:</strong> Discrimination, harassment, hate speech, or any
          form of abusive behavior toward other users will result in immediate review by
          the peer review panel and may lead to permanent deactivation.
        </div>

        <h3 style={styles.subheading}>5.3 Safety Compliance</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Always wear seatbelts during rides (both drivers and passengers).
          </li>
          <li style={styles.listItem}>
            Do not transport illegal substances, weapons (except where legally permitted),
            or hazardous materials.
          </li>
          <li style={styles.listItem}>
            Do not use the Platform while under the influence of drugs or alcohol.
          </li>
          <li style={styles.listItem}>
            Report any safety concerns immediately through the Platform&apos;s emergency
            features or by contacting local authorities.
          </li>
        </ul>

        <h3 style={styles.subheading}>5.4 Prohibited Activities</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Attempting to manipulate the fare calculation system or ratings.
          </li>
          <li style={styles.listItem}>
            Soliciting rides or transactions outside the Platform to circumvent fees.
          </li>
          <li style={styles.listItem}>
            Reverse engineering, decompiling, or attempting to extract source code from the
            Platform (the source is freely available under AGPL-3.0).
          </li>
          <li style={styles.listItem}>
            Impersonating another user or misrepresenting your identity.
          </li>
          <li style={styles.listItem}>
            Interfering with or disrupting the Platform&apos;s infrastructure or services.
          </li>
          <li style={styles.listItem}>
            Creating fake accounts, fake rides, or artificial demand.
          </li>
        </ul>
      </section>

      {/* Section 6: Driver-Specific Terms */}
      <section id="driver-terms" style={styles.section}>
        <h2 style={styles.sectionTitle}>6. Driver-Specific Terms</h2>
        <p style={styles.paragraph}>
          If you register as a driver on the OpenRide Platform, the following additional
          terms apply. Please also review the full{' '}
          <a href="/driver-agreement" style={{ color: '#2E7D32' }}>
            Driver Agreement
          </a>{' '}
          for detailed requirements.
        </p>

        <h3 style={styles.subheading}>6.1 Independent Contractor Status</h3>
        <p style={styles.paragraph}>
          Drivers on the OpenRide Platform are <strong>independent contractors</strong>,
          not employees, agents, or representatives of OpenRide. As an independent
          contractor, you:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Retain full control over when, where, and how long you use the Platform.
          </li>
          <li style={styles.listItem}>
            Are free to use other ride-sharing platforms simultaneously.
          </li>
          <li style={styles.listItem}>
            Are responsible for your own taxes, insurance, and business expenses.
          </li>
          <li style={styles.listItem}>
            Are not entitled to employee benefits, workers&apos; compensation, or
            unemployment insurance from OpenRide.
          </li>
        </ul>

        <h3 style={styles.subheading}>6.2 Vehicle Requirements</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Vehicle must be no more than 15 years old (or as required by local
            regulations, whichever is stricter).
          </li>
          <li style={styles.listItem}>
            Vehicle must pass a safety inspection and be maintained in good working
            condition.
          </li>
          <li style={styles.listItem}>
            Vehicle must have four doors and seat at least four passengers.
          </li>
          <li style={styles.listItem}>
            Vehicle must have valid registration, license plates, and pass all applicable
            emissions tests.
          </li>
        </ul>

        <h3 style={styles.subheading}>6.3 Insurance Requirements</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Drivers must carry personal auto insurance that meets or exceeds the minimum
            coverage required by their state or jurisdiction.
          </li>
          <li style={styles.listItem}>
            Drivers are strongly encouraged to carry commercial or rideshare-specific
            insurance coverage.
          </li>
          <li style={styles.listItem}>
            OpenRide provides supplemental contingent liability coverage during active
            rides. Details are available in the{' '}
            <a href="/driver-agreement" style={{ color: '#2E7D32' }}>
              Driver Agreement
            </a>
            .
          </li>
        </ul>

        <h3 style={styles.subheading}>6.4 Background Check Requirements</h3>
        <p style={styles.paragraph}>
          All drivers must consent to and successfully pass a background check before being
          activated on the Platform. Background checks include:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>Criminal history check (multi-state).</li>
          <li style={styles.listItem}>Sex offender registry check (national).</li>
          <li style={styles.listItem}>Motor vehicle records check.</li>
          <li style={styles.listItem}>
            Ongoing monitoring for relevant convictions or violations.
          </li>
        </ul>
        <p style={styles.paragraph}>
          Background checks are conducted by a third-party provider in compliance with the
          Fair Credit Reporting Act (FCRA). Drivers have the right to review and dispute
          results.
        </p>
      </section>

      {/* Section 7: Passenger-Specific Terms */}
      <section id="passenger-terms" style={styles.section}>
        <h2 style={styles.sectionTitle}>7. Passenger-Specific Terms</h2>

        <h3 style={styles.subheading}>7.1 Payment Obligations</h3>
        <p style={styles.paragraph}>
          By requesting a ride, you agree to pay the fare displayed at the time of booking
          (or the metered fare if applicable). Payment is processed automatically through
          the Platform upon ride completion. You are responsible for ensuring your payment
          method is valid and has sufficient funds.
        </p>

        <h3 style={styles.subheading}>7.2 Cancellation Policy</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Free cancellation:</strong> You may cancel a ride at no charge within 2
            minutes of requesting the ride or before the driver has arrived at the pickup
            location, whichever comes first.
          </li>
          <li style={styles.listItem}>
            <strong>Late cancellation fee:</strong> A cancellation fee may apply if you
            cancel after the free cancellation window. This fee compensates the driver for
            their time and fuel.
          </li>
          <li style={styles.listItem}>
            <strong>No-show fee:</strong> If the driver arrives at the pickup location and
            you do not appear within 5 minutes, the ride may be cancelled and a no-show fee
            may apply.
          </li>
          <li style={styles.listItem}>
            <strong>Fee amounts:</strong> Cancellation and no-show fees are set
            transparently through the governance process and are visible in the Platform
            before booking.
          </li>
        </ul>

        <h3 style={styles.subheading}>7.3 Passenger Behavior</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Respect the driver&apos;s vehicle. You may be charged a cleaning fee for
            excessive messes, spills, or damage.
          </li>
          <li style={styles.listItem}>
            Do not ask drivers to violate traffic laws or speed.
          </li>
          <li style={styles.listItem}>
            Do not transport open containers of alcohol (where prohibited by law).
          </li>
          <li style={styles.listItem}>
            Children under applicable age and weight requirements must be in an appropriate
            child safety seat that you provide.
          </li>
          <li style={styles.listItem}>
            Service animals are always welcome. Emotional support animals are welcome at
            the driver&apos;s discretion.
          </li>
        </ul>
      </section>

      {/* Section 8: Fare Calculation & Transparency */}
      <section id="fare-calculation" style={styles.section}>
        <h2 style={styles.sectionTitle}>8. Fare Calculation &amp; Transparency</h2>
        <p style={styles.paragraph}>
          OpenRide is committed to full transparency in fare calculation. Our fares are
          determined by a clear, publicly auditable formula:
        </p>

        <div style={styles.infoBox}>
          <strong>Fare Formula:</strong>
          <br />
          Total Fare = Base Fare + (Per Kilometer Rate x Distance) + (Per Minute Rate x
          Duration) + Applicable Tolls + Platform Fee
        </div>

        <h3 style={styles.subheading}>8.1 Fare Components</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Base Fare:</strong> A fixed amount charged at the start of each ride.
            The current base fare is publicly visible on the transparency dashboard.
          </li>
          <li style={styles.listItem}>
            <strong>Per Kilometer Rate:</strong> A distance-based charge calculated using
            GPS data. Rates vary by city and ride type.
          </li>
          <li style={styles.listItem}>
            <strong>Per Minute Rate:</strong> A time-based charge to compensate drivers for
            time spent in traffic or waiting.
          </li>
          <li style={styles.listItem}>
            <strong>Platform Fee:</strong> A cost-recovery fee of 5-10% that covers
            Platform operations, insurance, payment processing, and reserves. The exact
            percentage is set through the governance process and is publicly disclosed.
          </li>
          <li style={styles.listItem}>
            <strong>Tolls &amp; Surcharges:</strong> Any applicable tolls, airport fees, or
            regulatory surcharges are passed through at cost.
          </li>
        </ul>

        <h3 style={styles.subheading}>8.2 Surge Pricing Caps</h3>
        <p style={styles.paragraph}>
          During periods of high demand, fares may increase to incentivize more drivers to
          become available. However, OpenRide caps surge pricing:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Maximum surge multiplier:</strong> Fare increases are capped at a
            maximum multiplier set through the governance process (default: 2.0x).
          </li>
          <li style={styles.listItem}>
            Passengers are always shown the estimated fare (including any surge) before
            confirming a ride.
          </li>
          <li style={styles.listItem}>
            The Platform will never engage in &quot;price gouging&quot; during declared
            emergencies or natural disasters.
          </li>
        </ul>

        <h3 style={styles.subheading}>8.3 Fare Estimates</h3>
        <p style={styles.paragraph}>
          Fare estimates provided before booking are based on expected distance and
          duration. Actual fares may differ due to route changes, traffic conditions, or
          detours. If the actual fare differs significantly from the estimate, you may
          request a fare review through the dispute resolution process.
        </p>
      </section>

      {/* Section 9: Governance Participation */}
      <section id="governance" style={styles.section}>
        <h2 style={styles.sectionTitle}>9. Governance Participation</h2>
        <p style={styles.paragraph}>
          As a cooperative platform, OpenRide gives its community members the right to
          participate in platform governance.
        </p>

        <h3 style={styles.subheading}>9.1 Voting Eligibility</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Drivers:</strong> Eligible to vote after completing 10 rides on the
            Platform.
          </li>
          <li style={styles.listItem}>
            <strong>Passengers:</strong> Eligible to vote after completing 5 rides on the
            Platform.
          </li>
          <li style={styles.listItem}>
            Each eligible member receives one vote per proposal, regardless of their usage
            volume.
          </li>
        </ul>

        <h3 style={styles.subheading}>9.2 Governance Rights</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Submit proposals for platform changes, including fee adjustments, policy
            changes, and feature requests.
          </li>
          <li style={styles.listItem}>
            Vote on proposals submitted by other community members.
          </li>
          <li style={styles.listItem}>
            Review and comment on all active proposals.
          </li>
          <li style={styles.listItem}>
            Access the full transparency dashboard, including financial reports, fee
            breakdowns, and operational metrics.
          </li>
        </ul>

        <h3 style={styles.subheading}>9.3 Governance Responsibilities</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Participate in good faith and with the best interests of the community in
            mind.
          </li>
          <li style={styles.listItem}>
            Do not attempt to manipulate votes through multiple accounts or vote-buying.
          </li>
          <li style={styles.listItem}>
            Respect the outcome of governance votes, even if you disagree with the result.
          </li>
        </ul>
      </section>

      {/* Section 10: Surplus Redistribution */}
      <section id="surplus" style={styles.section}>
        <h2 style={styles.sectionTitle}>10. Surplus Redistribution</h2>
        <p style={styles.paragraph}>
          OpenRide operates as a non-profit cooperative. Any operating surplus (revenue
          exceeding costs) is handled transparently:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Operating Reserves:</strong> A portion of surplus is maintained as
            operating reserves to ensure platform stability and cover unexpected expenses.
            The reserve target is set through governance.
          </li>
          <li style={styles.listItem}>
            <strong>Fee Reduction:</strong> When reserves exceed the target, the governance
            body may vote to reduce platform fees.
          </li>
          <li style={styles.listItem}>
            <strong>Driver Bonuses:</strong> Surplus may be redistributed to drivers as
            bonuses, proportional to completed rides during the surplus period.
          </li>
          <li style={styles.listItem}>
            <strong>Community Investment:</strong> Surplus may be allocated to platform
            improvements, community programs, or charitable contributions as determined by
            governance vote.
          </li>
        </ul>
        <p style={styles.paragraph}>
          All surplus allocation decisions are made through the governance process and are
          publicly recorded on the transparency dashboard. No surplus is distributed to
          external shareholders or investors, as there are none.
        </p>
      </section>

      {/* Section 11: Payment Terms */}
      <section id="payment" style={styles.section}>
        <h2 style={styles.sectionTitle}>11. Payment Terms</h2>

        <h3 style={styles.subheading}>11.1 Payment Processing</h3>
        <p style={styles.paragraph}>
          All payments on the OpenRide Platform are processed through{' '}
          <strong>Stripe</strong>, a PCI-DSS Level 1 certified payment processor. OpenRide
          does not store your full credit card number, CVV, or other sensitive payment card
          data on our servers.
        </p>

        <h3 style={styles.subheading}>11.2 Passenger Payments</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Fares are automatically charged to your default payment method upon ride
            completion.
          </li>
          <li style={styles.listItem}>
            Accepted payment methods include credit cards, debit cards, and other methods
            supported by Stripe in your region.
          </li>
          <li style={styles.listItem}>
            You may add, update, or remove payment methods at any time through the app.
          </li>
        </ul>

        <h3 style={styles.subheading}>11.3 Driver Payouts</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Driver earnings are processed through <strong>Stripe Connect</strong>.
          </li>
          <li style={styles.listItem}>
            <strong>Weekly payouts:</strong> By default, earnings are deposited to your
            bank account on a weekly basis (every Monday for the previous week&apos;s
            earnings).
          </li>
          <li style={styles.listItem}>
            <strong>Instant payouts:</strong> Drivers may opt for instant payouts (subject
            to a small processing fee set by Stripe).
          </li>
          <li style={styles.listItem}>
            Detailed earnings breakdowns are available in the driver dashboard, showing
            each ride&apos;s fare, the platform fee deducted, and your net earnings.
          </li>
        </ul>

        <h3 style={styles.subheading}>11.4 Refund Policy</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Overcharges:</strong> If you were charged more than the estimated fare
            due to a route error or Platform malfunction, you may request a fare review
            within 48 hours. Verified overcharges will be refunded in full.
          </li>
          <li style={styles.listItem}>
            <strong>Service issues:</strong> If a ride did not meet reasonable service
            standards (e.g., driver took an unreasonable route, unsafe driving), you may
            submit a complaint and request a partial or full refund.
          </li>
          <li style={styles.listItem}>
            <strong>Processing time:</strong> Approved refunds are typically processed
            within 5-10 business days.
          </li>
          <li style={styles.listItem}>
            <strong>Dispute process:</strong> If your refund request is denied, you may
            escalate through the dispute resolution process described in Section 14.
          </li>
        </ul>
      </section>

      {/* Section 12: Intellectual Property */}
      <section id="intellectual-property" style={styles.section}>
        <h2 style={styles.sectionTitle}>12. Intellectual Property</h2>

        <h3 style={styles.subheading}>12.1 Open Source License</h3>
        <p style={styles.paragraph}>
          The OpenRide Platform software is licensed under the{' '}
          <strong>GNU Affero General Public License, Version 3.0 (AGPL-3.0)</strong>. This
          means:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            The source code is publicly available and may be freely studied, modified, and
            redistributed in accordance with the AGPL-3.0 license terms.
          </li>
          <li style={styles.listItem}>
            Any modifications to the OpenRide software that are deployed as a network
            service must also be made available under the AGPL-3.0 license.
          </li>
          <li style={styles.listItem}>
            The full license text is available at{' '}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              style={{ color: '#2E7D32' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              gnu.org/licenses/agpl-3.0.html
            </a>
            .
          </li>
        </ul>

        <h3 style={styles.subheading}>12.2 Trademarks</h3>
        <p style={styles.paragraph}>
          The OpenRide name, logo, and associated branding are trademarks of OpenRide
          Cooperative, Inc. While the software is open source, use of the OpenRide
          trademarks is subject to our trademark policy. You may not use the OpenRide name
          or logo to imply endorsement or affiliation without written permission.
        </p>

        <h3 style={styles.subheading}>12.3 User Content</h3>
        <p style={styles.paragraph}>
          By submitting content to the Platform (such as reviews, ratings, profile
          information, or governance proposals), you grant OpenRide a non-exclusive,
          royalty-free license to use, display, and distribute that content as necessary to
          operate the Platform. You retain ownership of your content.
        </p>
      </section>

      {/* Section 13: Privacy */}
      <section id="privacy" style={styles.section}>
        <h2 style={styles.sectionTitle}>13. Privacy</h2>
        <p style={styles.paragraph}>
          Your privacy is important to us. Our collection, use, and protection of your
          personal data is governed by our{' '}
          <a href="/privacy" style={{ color: '#2E7D32' }}>
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>
        <p style={styles.paragraph}>
          Key privacy commitments:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            We do <strong>not</strong> sell your personal data to third parties.
          </li>
          <li style={styles.listItem}>
            We do <strong>not</strong> build advertising profiles from your data.
          </li>
          <li style={styles.listItem}>
            Location data is only collected during active rides and is not tracked
            otherwise.
          </li>
          <li style={styles.listItem}>
            You have the right to access, correct, delete, and port your data.
          </li>
        </ul>
      </section>

      {/* Section 14: Dispute Resolution */}
      <section id="dispute-resolution" style={styles.section}>
        <h2 style={styles.sectionTitle}>14. Dispute Resolution</h2>
        <p style={styles.paragraph}>
          OpenRide is committed to fair and transparent dispute resolution. We follow a
          multi-step process:
        </p>

        <h3 style={styles.subheading}>14.1 Step 1: Internal Peer Review</h3>
        <p style={styles.paragraph}>
          All disputes are first reviewed by an internal peer review panel composed of
          experienced community members (both drivers and passengers). The panel reviews
          the evidence and reaches a decision within 7 business days. This process is free
          for all parties.
        </p>

        <h3 style={styles.subheading}>14.2 Step 2: Mediation</h3>
        <p style={styles.paragraph}>
          If either party is unsatisfied with the peer review outcome, they may request
          mediation. OpenRide will facilitate mediation through a neutral third-party
          mediator. Mediation costs, if any, are shared equally between the parties and
          OpenRide.
        </p>

        <h3 style={styles.subheading}>14.3 Step 3: Binding Arbitration</h3>
        <p style={styles.paragraph}>
          If mediation does not resolve the dispute, either party may submit the matter to
          binding arbitration in accordance with the rules of the American Arbitration
          Association (AAA). Arbitration shall take place in the jurisdiction where the
          affected user resides or, by mutual agreement, virtually.
        </p>

        <h3 style={styles.subheading}>14.4 Class Action Waiver</h3>
        <p style={styles.paragraph}>
          To the extent permitted by law, all disputes must be brought in the
          parties&apos; individual capacity and not as a class action, class arbitration,
          or representative proceeding. If this waiver is found unenforceable, then the
          entirety of this arbitration provision shall be null and void.
        </p>

        <h3 style={styles.subheading}>14.5 Exceptions</h3>
        <p style={styles.paragraph}>
          Nothing in this section prevents you from filing a complaint with a government
          agency (such as the FTC, state attorney general, or local consumer protection
          office) or seeking injunctive relief in a court of competent jurisdiction for
          intellectual property or safety matters.
        </p>
      </section>

      {/* Section 15: Limitation of Liability */}
      <section id="liability" style={styles.section}>
        <h2 style={styles.sectionTitle}>15. Limitation of Liability</h2>

        <h3 style={styles.subheading}>15.1 Platform Provided &quot;As Is&quot;</h3>
        <p style={styles.paragraph}>
          THE OPENRIDE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>

        <h3 style={styles.subheading}>15.2 Limitation of Damages</h3>
        <p style={styles.paragraph}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OPENRIDE SHALL NOT BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING
          OUT OF OR IN CONNECTION WITH YOUR USE OF THE PLATFORM.
        </p>

        <h3 style={styles.subheading}>15.3 Maximum Liability</h3>
        <p style={styles.paragraph}>
          OPENRIDE&apos;S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR
          RELATING TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER
          OF (A) THE AMOUNT YOU PAID TO OPENRIDE IN THE 12 MONTHS PRECEDING THE CLAIM, OR
          (B) ONE HUNDRED DOLLARS ($100 USD).
        </p>

        <h3 style={styles.subheading}>15.4 Third-Party Services</h3>
        <p style={styles.paragraph}>
          OpenRide is not responsible for the actions, omissions, or negligence of drivers,
          passengers, or any third-party service providers. Drivers provide transportation
          services as independent contractors, and OpenRide does not supervise, direct, or
          control their services.
        </p>
      </section>

      {/* Section 16: Termination & Deactivation */}
      <section id="termination" style={styles.section}>
        <h2 style={styles.sectionTitle}>16. Termination &amp; Deactivation</h2>

        <h3 style={styles.subheading}>16.1 Voluntary Termination</h3>
        <p style={styles.paragraph}>
          You may deactivate your account at any time through the app settings or by
          contacting support. Upon deactivation, you will retain access to your data export
          for 30 days.
        </p>

        <h3 style={styles.subheading}>16.2 Peer Review Panel Process</h3>
        <p style={styles.paragraph}>
          Unlike traditional ride-sharing platforms, OpenRide does{' '}
          <strong>not use automated algorithmic deactivation</strong>. Account
          deactivation by OpenRide follows a human-centered peer review process:
        </p>
        <ol style={styles.list}>
          <li style={styles.listItem}>
            <strong>Complaint Filed:</strong> A complaint or safety report is submitted
            against your account.
          </li>
          <li style={styles.listItem}>
            <strong>Initial Review:</strong> Platform staff reviews the complaint for
            validity and urgency. In cases of immediate safety threats, temporary
            suspension may be applied pending review.
          </li>
          <li style={styles.listItem}>
            <strong>Peer Review Panel:</strong> A panel of 3-5 experienced community
            members reviews the case, including all evidence and the affected user&apos;s
            response.
          </li>
          <li style={styles.listItem}>
            <strong>Decision:</strong> The panel may issue a warning, temporary suspension,
            mandatory retraining, or permanent deactivation.
          </li>
          <li style={styles.listItem}>
            <strong>Appeal:</strong> Users may appeal the decision within 14 days. Appeals
            are reviewed by a different panel.
          </li>
        </ol>

        <h3 style={styles.subheading}>16.3 Immediate Suspension</h3>
        <p style={styles.paragraph}>
          OpenRide reserves the right to immediately suspend an account (pending peer
          review) in cases involving:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>Credible safety threats or violent behavior.</li>
          <li style={styles.listItem}>Criminal activity reported to law enforcement.</li>
          <li style={styles.listItem}>Fraud or identity theft.</li>
          <li style={styles.listItem}>
            Serious violations of the non-discrimination policy.
          </li>
        </ul>

        <h3 style={styles.subheading}>16.4 Effect of Termination</h3>
        <p style={styles.paragraph}>
          Upon account termination, all outstanding payments owed to you will be processed
          within 30 days. Your governance voting rights are suspended immediately. Personal
          data will be handled in accordance with our Privacy Policy and applicable data
          retention requirements.
        </p>
      </section>

      {/* Section 17: Modifications to Terms */}
      <section id="modifications" style={styles.section}>
        <h2 style={styles.sectionTitle}>17. Modifications to Terms</h2>
        <p style={styles.paragraph}>
          As a community-governed platform, changes to these Terms of Service follow a
          democratic process:
        </p>

        <h3 style={styles.subheading}>17.1 Material Changes</h3>
        <p style={styles.paragraph}>
          Material changes to these Terms (including changes to fees, liability provisions,
          dispute resolution, or governance rights) require approval through the OpenRide
          governance voting process. A proposal must receive a majority vote from
          participating eligible members.
        </p>

        <h3 style={styles.subheading}>17.2 Non-Material Changes</h3>
        <p style={styles.paragraph}>
          Minor, non-material changes (such as clarifications, formatting, or updates to
          reflect legal requirements) may be made by OpenRide staff with notification to
          the community.
        </p>

        <h3 style={styles.subheading}>17.3 Notice</h3>
        <p style={styles.paragraph}>
          Users will be notified of any changes to these Terms at least 30 days before
          they take effect. Notifications will be sent via email and in-app notification.
          The updated Terms will be posted with a new effective date.
        </p>
      </section>

      {/* Section 18: General Provisions */}
      <section id="general" style={styles.section}>
        <h2 style={styles.sectionTitle}>18. General Provisions</h2>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Governing Law:</strong> These Terms shall be governed by and construed
            in accordance with the laws of [STATE/JURISDICTION], without regard to conflict
            of law principles.
          </li>
          <li style={styles.listItem}>
            <strong>Severability:</strong> If any provision of these Terms is found to be
            unenforceable, the remaining provisions shall continue in full force and effect.
          </li>
          <li style={styles.listItem}>
            <strong>Entire Agreement:</strong> These Terms, together with the Privacy
            Policy and Driver Agreement (if applicable), constitute the entire agreement
            between you and OpenRide regarding your use of the Platform.
          </li>
          <li style={styles.listItem}>
            <strong>No Waiver:</strong> The failure of OpenRide to enforce any right or
            provision of these Terms shall not constitute a waiver of such right or
            provision.
          </li>
          <li style={styles.listItem}>
            <strong>Assignment:</strong> You may not assign or transfer these Terms or your
            rights or obligations hereunder without OpenRide&apos;s written consent.
            OpenRide may assign these Terms to a successor cooperative or organization
            through a governance vote.
          </li>
          <li style={styles.listItem}>
            <strong>Force Majeure:</strong> OpenRide shall not be liable for any failure or
            delay in performing its obligations due to causes beyond its reasonable control,
            including natural disasters, pandemics, government actions, or infrastructure
            failures.
          </li>
        </ul>
      </section>

      {/* Section 19: Contact Information */}
      <section id="contact" style={styles.section}>
        <h2 style={styles.sectionTitle}>19. Contact Information</h2>
        <p style={styles.paragraph}>
          If you have questions about these Terms of Service, please contact us:
        </p>
        <div
          style={{
            background: '#f8f9fb',
            border: '1px solid #e2e4ea',
            borderRadius: 8,
            padding: '20px 24px',
            fontSize: 15,
            lineHeight: 1.8,
          }}
        >
          <strong>OpenRide Cooperative, Inc.</strong>
          <br />
          Email:{' '}
          <a href="mailto:legal@openride.coop" style={{ color: '#2E7D32' }}>
            legal@openride.coop
          </a>
          <br />
          Address: [STREET ADDRESS]
          <br />
          [CITY, STATE ZIP]
          <br />
          [COUNTRY]
          <br />
          <br />
          For urgent safety concerns:{' '}
          <a href="mailto:safety@openride.coop" style={{ color: '#2E7D32' }}>
            safety@openride.coop
          </a>
          <br />
          For privacy-related inquiries:{' '}
          <a href="mailto:privacy@openride.coop" style={{ color: '#2E7D32' }}>
            privacy@openride.coop
          </a>
        </div>
      </section>
    </div>
  );
}
