export const metadata = {
  title: 'Privacy Policy — OpenRide',
  description:
    'Privacy Policy for the OpenRide community-owned ride-sharing cooperative platform. GDPR and CCPA compliant.',
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
    background: '#E8F5E9',
    border: '1px solid #C8E6C9',
    borderRadius: 8,
    padding: '16px 20px',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#1B5E20',
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
  warningBox: {
    background: '#FFF3E0',
    border: '1px solid #FFE0B2',
    borderRadius: 8,
    padding: '16px 20px',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#e65100',
    marginBottom: 16,
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: 20,
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: '#f8f9fb',
    borderBottom: '2px solid #e2e4ea',
    fontWeight: 600,
    color: '#5a5a7a',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e4ea',
    verticalAlign: 'top',
    lineHeight: 1.6,
  },
};

const tocItems = [
  { id: 'overview', label: '1. Overview & Our Commitment' },
  { id: 'data-collect', label: '2. Data We Collect' },
  { id: 'data-use', label: '3. How We Use Your Data' },
  { id: 'data-not-collect', label: '4. Data We Do NOT Collect or Sell' },
  { id: 'data-retention', label: '5. Data Retention Periods' },
  { id: 'third-party', label: '6. Third-Party Sharing' },
  { id: 'user-rights', label: '7. Your Rights' },
  { id: 'cookies', label: '8. Cookie Policy' },
  { id: 'children', label: '9. Children\'s Privacy' },
  { id: 'security', label: '10. Data Security' },
  { id: 'international', label: '11. International Transfers' },
  { id: 'ccpa', label: '12. California Privacy Rights (CCPA)' },
  { id: 'gdpr', label: '13. European Privacy Rights (GDPR)' },
  { id: 'changes', label: '14. Changes to This Policy' },
  { id: 'contact', label: '15. Contact Information & DPO' },
];

export default function PrivacyPolicyPage() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Privacy Policy</h1>
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

      {/* Section 1: Overview */}
      <section id="overview" style={styles.section}>
        <h2 style={styles.sectionTitle}>1. Overview &amp; Our Commitment</h2>
        <p style={styles.paragraph}>
          OpenRide Cooperative, Inc. (&quot;OpenRide,&quot; &quot;we,&quot; &quot;us,&quot;
          or &quot;our&quot;) is committed to protecting your privacy. As a
          community-owned, non-profit cooperative, we have no incentive to monetize your
          personal data. This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use the OpenRide platform, including our
          mobile applications, website, and related services (collectively, the
          &quot;Platform&quot;).
        </p>
        <div style={styles.highlight}>
          <strong>Our Privacy Promise:</strong> We collect only the minimum data necessary
          to provide our ride-sharing service. We do not sell your data. We do not build
          advertising profiles. We do not track you when you are not using the service.
          Our code is open source — you can verify our practices yourself.
        </div>
        <p style={styles.paragraph}>
          This policy applies to all users of the Platform, including passengers, drivers,
          and governance participants. By using the Platform, you consent to the practices
          described in this Privacy Policy. If you do not agree, please do not use the
          Platform.
        </p>
      </section>

      {/* Section 2: Data We Collect */}
      <section id="data-collect" style={styles.section}>
        <h2 style={styles.sectionTitle}>2. Data We Collect</h2>
        <p style={styles.paragraph}>
          We collect the following categories of data, each for a specific, disclosed
          purpose:
        </p>

        <h3 style={styles.subheading}>2.1 Account Information</h3>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Data Type</th>
              <th style={styles.th}>Purpose</th>
              <th style={styles.th}>Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Full name</td>
              <td style={styles.td}>Account identification, safety</td>
              <td style={styles.td}>Yes</td>
            </tr>
            <tr>
              <td style={styles.td}>Email address</td>
              <td style={styles.td}>Account login, notifications, governance</td>
              <td style={styles.td}>Yes</td>
            </tr>
            <tr>
              <td style={styles.td}>Phone number</td>
              <td style={styles.td}>Two-factor authentication, ride communication</td>
              <td style={styles.td}>Yes</td>
            </tr>
            <tr>
              <td style={styles.td}>Profile photo</td>
              <td style={styles.td}>Identity verification during rides</td>
              <td style={styles.td}>No</td>
            </tr>
          </tbody>
        </table>

        <h3 style={styles.subheading}>2.2 Location Data</h3>
        <div style={styles.infoBox}>
          <strong>Important:</strong> We only collect location data during active rides
          (from pickup request to ride completion). We do not track your location in the
          background when you are not using the service. Drivers who are online and
          accepting rides share their approximate location to enable ride matching.
        </div>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Data Type</th>
              <th style={styles.th}>Purpose</th>
              <th style={styles.th}>When Collected</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Pickup location</td>
              <td style={styles.td}>Ride matching, fare calculation</td>
              <td style={styles.td}>When ride is requested</td>
            </tr>
            <tr>
              <td style={styles.td}>Destination</td>
              <td style={styles.td}>Route planning, fare estimation</td>
              <td style={styles.td}>When ride is requested</td>
            </tr>
            <tr>
              <td style={styles.td}>GPS route during ride</td>
              <td style={styles.td}>Fare calculation, safety, dispute resolution</td>
              <td style={styles.td}>During active ride only</td>
            </tr>
            <tr>
              <td style={styles.td}>Driver approximate location</td>
              <td style={styles.td}>Ride matching, ETA calculation</td>
              <td style={styles.td}>While driver is online</td>
            </tr>
          </tbody>
        </table>

        <h3 style={styles.subheading}>2.3 Payment Information</h3>
        <p style={styles.paragraph}>
          Payment information is processed and stored by our payment processor,{' '}
          <strong>Stripe</strong>. OpenRide does not store your full credit card number,
          CVV, or bank account details on our servers. We retain only:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>Last four digits of your payment card (for display purposes).</li>
          <li style={styles.listItem}>Card type and expiration date (for display purposes).</li>
          <li style={styles.listItem}>Stripe customer ID (to process payments).</li>
          <li style={styles.listItem}>Transaction history (amounts, dates, ride references).</li>
        </ul>

        <h3 style={styles.subheading}>2.4 Device Information</h3>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Data Type</th>
              <th style={styles.th}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Device type and model</td>
              <td style={styles.td}>App compatibility, bug resolution</td>
            </tr>
            <tr>
              <td style={styles.td}>Operating system and version</td>
              <td style={styles.td}>App compatibility, bug resolution</td>
            </tr>
            <tr>
              <td style={styles.td}>App version</td>
              <td style={styles.td}>Update notifications, compatibility</td>
            </tr>
            <tr>
              <td style={styles.td}>Push notification token</td>
              <td style={styles.td}>Sending ride notifications</td>
            </tr>
          </tbody>
        </table>
        <p style={styles.paragraph}>
          We do <strong>not</strong> collect: device advertising identifiers, browser
          fingerprints, contact lists, call logs, or SMS messages.
        </p>

        <h3 style={styles.subheading}>2.5 Driver-Specific Data</h3>
        <p style={styles.paragraph}>
          If you register as a driver, we additionally collect:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>Driver&apos;s license number and expiration (for verification).</li>
          <li style={styles.listItem}>Vehicle registration, make, model, year, and license plate.</li>
          <li style={styles.listItem}>Proof of insurance documentation.</li>
          <li style={styles.listItem}>Background check consent and results (conducted by a third-party provider).</li>
          <li style={styles.listItem}>Bank account details (via Stripe Connect, for payout processing).</li>
        </ul>
      </section>

      {/* Section 3: How We Use Data */}
      <section id="data-use" style={styles.section}>
        <h2 style={styles.sectionTitle}>3. How We Use Your Data</h2>
        <p style={styles.paragraph}>
          We use your data only for the following specific purposes:
        </p>

        <h3 style={styles.subheading}>3.1 Ride Matching &amp; Operations</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>Connecting passengers with nearby available drivers.</li>
          <li style={styles.listItem}>Calculating estimated arrival times and routes.</li>
          <li style={styles.listItem}>Facilitating in-ride communication between driver and passenger.</li>
          <li style={styles.listItem}>Enabling navigation and turn-by-turn directions for drivers.</li>
        </ul>

        <h3 style={styles.subheading}>3.2 Fare Calculation</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>Computing fares based on distance traveled and time elapsed.</li>
          <li style={styles.listItem}>Applying applicable tolls, surcharges, and platform fees.</li>
          <li style={styles.listItem}>Generating receipts and transaction records.</li>
        </ul>

        <h3 style={styles.subheading}>3.3 Safety</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>Verifying driver identity and eligibility through background checks.</li>
          <li style={styles.listItem}>Recording ride routes for dispute resolution and safety investigations.</li>
          <li style={styles.listItem}>Detecting and preventing fraudulent activity.</li>
          <li style={styles.listItem}>Responding to safety incidents and law enforcement requests (when legally required).</li>
        </ul>

        <h3 style={styles.subheading}>3.4 Governance</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>Verifying eligibility to vote on governance proposals.</li>
          <li style={styles.listItem}>Recording governance votes (your vote choices are kept confidential; only aggregate results are published).</li>
          <li style={styles.listItem}>Communicating governance proposals and results.</li>
        </ul>

        <h3 style={styles.subheading}>3.5 Platform Improvement</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>Aggregated, anonymized analytics to understand usage patterns and improve the Platform.</li>
          <li style={styles.listItem}>Diagnosing technical issues and bugs.</li>
          <li style={styles.listItem}>Developing new features based on community feedback.</li>
        </ul>
      </section>

      {/* Section 4: Data We Do NOT Collect */}
      <section id="data-not-collect" style={styles.section}>
        <h2 style={styles.sectionTitle}>4. Data We Do NOT Collect or Sell</h2>
        <div style={styles.highlight}>
          <strong>As a non-profit cooperative, we have fundamentally different incentives
          than for-profit ride-sharing companies.</strong> We exist to serve our community,
          not to extract value from your data.
        </div>
        <p style={styles.paragraph}>
          We explicitly commit to the following:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>We do NOT sell your personal data</strong> to any third party, under
            any circumstances. There are no data brokers, no advertising partners, no data
            monetization.
          </li>
          <li style={styles.listItem}>
            <strong>We do NOT build advertising profiles.</strong> We do not track your
            browsing behavior, purchasing habits, or interests for advertising purposes.
          </li>
          <li style={styles.listItem}>
            <strong>We do NOT use tracking pixels, third-party analytics scripts, or
            behavioral tracking tools.</strong> Our analytics are first-party, aggregated,
            and anonymized.
          </li>
          <li style={styles.listItem}>
            <strong>We do NOT track your location in the background.</strong> Location
            data is only collected during active rides or when a driver is online and
            accepting rides.
          </li>
          <li style={styles.listItem}>
            <strong>We do NOT access your contacts, photos, camera, or microphone</strong>{' '}
            without your explicit action (e.g., uploading a profile photo requires camera
            access that you initiate).
          </li>
          <li style={styles.listItem}>
            <strong>We do NOT use your data for automated decision-making or profiling</strong>{' '}
            that has legal or significant effects on you, including algorithmic
            deactivation.
          </li>
        </ul>
      </section>

      {/* Section 5: Data Retention */}
      <section id="data-retention" style={styles.section}>
        <h2 style={styles.sectionTitle}>5. Data Retention Periods</h2>
        <p style={styles.paragraph}>
          We retain your data only for as long as necessary to fulfill the purposes for
          which it was collected, comply with legal obligations, and resolve disputes.
        </p>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Data Category</th>
              <th style={styles.th}>Retention Period</th>
              <th style={styles.th}>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Account information</td>
              <td style={styles.td}>Duration of account + 30 days after deletion request</td>
              <td style={styles.td}>Account operation, grace period for reactivation</td>
            </tr>
            <tr>
              <td style={styles.td}>Ride history (route data)</td>
              <td style={styles.td}>90 days</td>
              <td style={styles.td}>Dispute resolution, safety investigations</td>
            </tr>
            <tr>
              <td style={styles.td}>Ride history (summary)</td>
              <td style={styles.td}>3 years</td>
              <td style={styles.td}>Tax and financial records, user reference</td>
            </tr>
            <tr>
              <td style={styles.td}>Location data (GPS routes)</td>
              <td style={styles.td}>90 days (then anonymized)</td>
              <td style={styles.td}>Dispute resolution, fare verification</td>
            </tr>
            <tr>
              <td style={styles.td}>Payment transaction records</td>
              <td style={styles.td}>7 years</td>
              <td style={styles.td}>Tax compliance, financial auditing</td>
            </tr>
            <tr>
              <td style={styles.td}>Driver documents (license, insurance)</td>
              <td style={styles.td}>Duration of driver status + 1 year</td>
              <td style={styles.td}>Regulatory compliance</td>
            </tr>
            <tr>
              <td style={styles.td}>Background check results</td>
              <td style={styles.td}>Duration of driver status + 1 year</td>
              <td style={styles.td}>Safety compliance</td>
            </tr>
            <tr>
              <td style={styles.td}>Governance votes</td>
              <td style={styles.td}>Permanently (anonymized after account deletion)</td>
              <td style={styles.td}>Governance integrity and audit trail</td>
            </tr>
            <tr>
              <td style={styles.td}>Support communications</td>
              <td style={styles.td}>2 years</td>
              <td style={styles.td}>Service quality, dispute reference</td>
            </tr>
            <tr>
              <td style={styles.td}>Device information</td>
              <td style={styles.td}>Duration of account</td>
              <td style={styles.td}>Push notifications, compatibility</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Section 6: Third-Party Sharing */}
      <section id="third-party" style={styles.section}>
        <h2 style={styles.sectionTitle}>6. Third-Party Sharing</h2>
        <p style={styles.paragraph}>
          We share your data only with the following third parties, and only to the extent
          necessary to provide our services:
        </p>

        <h3 style={styles.subheading}>6.1 Stripe (Payment Processing)</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Data shared:</strong> Name, email, payment card details, bank account
            details (drivers), transaction amounts.
          </li>
          <li style={styles.listItem}>
            <strong>Purpose:</strong> Processing ride payments, driver payouts, refunds.
          </li>
          <li style={styles.listItem}>
            <strong>Privacy policy:</strong>{' '}
            <a href="https://stripe.com/privacy" style={{ color: '#2E7D32' }} target="_blank" rel="noopener noreferrer">
              stripe.com/privacy
            </a>
          </li>
        </ul>

        <h3 style={styles.subheading}>6.2 Twilio (Communications)</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Data shared:</strong> Phone numbers (masked), SMS content for ride
            notifications.
          </li>
          <li style={styles.listItem}>
            <strong>Purpose:</strong> Sending ride status SMS notifications, enabling
            masked phone calls between drivers and passengers, two-factor authentication
            codes.
          </li>
          <li style={styles.listItem}>
            <strong>Privacy policy:</strong>{' '}
            <a href="https://www.twilio.com/legal/privacy" style={{ color: '#2E7D32' }} target="_blank" rel="noopener noreferrer">
              twilio.com/legal/privacy
            </a>
          </li>
        </ul>

        <h3 style={styles.subheading}>6.3 Background Check Provider (Drivers Only)</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Data shared:</strong> Driver name, date of birth, Social Security
            Number (or equivalent), driver&apos;s license number.
          </li>
          <li style={styles.listItem}>
            <strong>Purpose:</strong> Conducting criminal background checks and motor
            vehicle record checks for driver applicants.
          </li>
          <li style={styles.listItem}>
            <strong>Applies to:</strong> Driver applicants only, with explicit consent.
          </li>
          <li style={styles.listItem}>
            <strong>Compliance:</strong> All background checks comply with the Fair Credit
            Reporting Act (FCRA). Drivers have the right to review and dispute results.
          </li>
        </ul>

        <h3 style={styles.subheading}>6.4 Other Disclosures</h3>
        <p style={styles.paragraph}>
          We may also disclose your information in the following limited circumstances:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Legal compliance:</strong> When required by law, court order, or
            government regulation.
          </li>
          <li style={styles.listItem}>
            <strong>Safety emergencies:</strong> To protect the safety of users or the
            public when there is an immediate threat.
          </li>
          <li style={styles.listItem}>
            <strong>With your consent:</strong> When you have explicitly authorized the
            disclosure.
          </li>
        </ul>
        <div style={styles.warningBox}>
          <strong>Transparency commitment:</strong> We publish an annual transparency
          report disclosing the number and nature of law enforcement requests received
          and our responses to them.
        </div>
      </section>

      {/* Section 7: User Rights */}
      <section id="user-rights" style={styles.section}>
        <h2 style={styles.sectionTitle}>7. Your Rights</h2>
        <p style={styles.paragraph}>
          Regardless of where you live, OpenRide grants all users the following data
          rights:
        </p>

        <h3 style={styles.subheading}>7.1 Right of Access</h3>
        <p style={styles.paragraph}>
          You have the right to request a copy of all personal data we hold about you. You
          can access most of your data directly through the app settings. For a complete
          data export, submit a request through the app or contact our privacy team.
          We will respond within 30 days.
        </p>

        <h3 style={styles.subheading}>7.2 Right to Deletion</h3>
        <p style={styles.paragraph}>
          You have the right to request deletion of your personal data. Upon request, we
          will delete your data within 30 days, except for data we are legally required
          to retain (e.g., financial records for tax compliance). You can initiate
          account deletion directly through the app settings.
        </p>

        <h3 style={styles.subheading}>7.3 Right to Data Portability</h3>
        <p style={styles.paragraph}>
          You have the right to receive your personal data in a structured, commonly used,
          machine-readable format (JSON or CSV). This includes your ride history, account
          information, and payment history. You can request a data export through the app
          settings.
        </p>

        <h3 style={styles.subheading}>7.4 Right to Correction</h3>
        <p style={styles.paragraph}>
          You have the right to correct inaccurate personal data. You can update most
          information directly in your account settings. For data you cannot edit directly,
          contact our support team.
        </p>

        <h3 style={styles.subheading}>7.5 Right to Restriction</h3>
        <p style={styles.paragraph}>
          You have the right to request that we restrict the processing of your personal
          data in certain circumstances, such as when you contest the accuracy of your data
          or object to our processing of it.
        </p>

        <h3 style={styles.subheading}>7.6 Right to Object</h3>
        <p style={styles.paragraph}>
          You have the right to object to processing of your personal data for certain
          purposes. If you object, we will cease processing unless we have compelling
          legitimate grounds or the processing is necessary for legal claims.
        </p>

        <h3 style={styles.subheading}>7.7 Right to Withdraw Consent</h3>
        <p style={styles.paragraph}>
          Where processing is based on your consent, you have the right to withdraw that
          consent at any time. Withdrawing consent does not affect the lawfulness of
          processing performed before the withdrawal.
        </p>

        <div style={styles.infoBox}>
          <strong>Exercising your rights:</strong> You can exercise most rights directly
          through the app settings. For any request, you can also email{' '}
          <a href="mailto:privacy@openride.coop" style={{ color: '#1565C0' }}>
            privacy@openride.coop
          </a>
          . We will respond to all requests within 30 days. We will not charge a fee for
          reasonable requests. We will never discriminate against you for exercising your
          privacy rights.
        </div>
      </section>

      {/* Section 8: Cookie Policy */}
      <section id="cookies" style={styles.section}>
        <h2 style={styles.sectionTitle}>8. Cookie Policy</h2>
        <p style={styles.paragraph}>
          OpenRide uses a minimal cookie approach. We believe in respecting your browsing
          privacy.
        </p>

        <h3 style={styles.subheading}>8.1 Cookies We Use</h3>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Cookie</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Purpose</th>
              <th style={styles.th}>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Authentication token</td>
              <td style={styles.td}>Strictly necessary</td>
              <td style={styles.td}>Keeping you logged in</td>
              <td style={styles.td}>Session / 30 days</td>
            </tr>
            <tr>
              <td style={styles.td}>CSRF token</td>
              <td style={styles.td}>Strictly necessary</td>
              <td style={styles.td}>Protecting against cross-site request forgery</td>
              <td style={styles.td}>Session</td>
            </tr>
            <tr>
              <td style={styles.td}>Cookie consent preference</td>
              <td style={styles.td}>Strictly necessary</td>
              <td style={styles.td}>Remembering your cookie preferences</td>
              <td style={styles.td}>1 year</td>
            </tr>
          </tbody>
        </table>

        <h3 style={styles.subheading}>8.2 Cookies We Do NOT Use</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>No advertising or tracking cookies.</li>
          <li style={styles.listItem}>No third-party analytics cookies (Google Analytics, etc.).</li>
          <li style={styles.listItem}>No social media tracking pixels.</li>
          <li style={styles.listItem}>No cross-site tracking cookies.</li>
        </ul>
      </section>

      {/* Section 9: Children's Privacy */}
      <section id="children" style={styles.section}>
        <h2 style={styles.sectionTitle}>9. Children&apos;s Privacy</h2>
        <p style={styles.paragraph}>
          OpenRide is not directed at children and we do not knowingly collect personal
          data from children.
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>United States:</strong> In accordance with the Children&apos;s Online
            Privacy Protection Act (COPPA), we do not knowingly collect personal
            information from children under the age of 13.
          </li>
          <li style={styles.listItem}>
            <strong>European Union:</strong> In accordance with the GDPR, we do not
            knowingly collect personal data from individuals under the age of 16 without
            verifiable parental consent.
          </li>
          <li style={styles.listItem}>
            <strong>Account requirement:</strong> Users must be at least 18 years old to
            create an account on OpenRide.
          </li>
        </ul>
        <p style={styles.paragraph}>
          If we become aware that we have inadvertently collected personal data from a
          child under the applicable age threshold, we will take immediate steps to delete
          that data. If you believe a child has provided us with personal data, please
          contact us at{' '}
          <a href="mailto:privacy@openride.coop" style={{ color: '#2E7D32' }}>
            privacy@openride.coop
          </a>
          .
        </p>
      </section>

      {/* Section 10: Data Security */}
      <section id="security" style={styles.section}>
        <h2 style={styles.sectionTitle}>10. Data Security</h2>
        <p style={styles.paragraph}>
          We implement robust technical and organizational measures to protect your
          personal data:
        </p>

        <h3 style={styles.subheading}>10.1 Technical Measures</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Encryption in transit:</strong> All data transmitted between your
            device and our servers is encrypted using TLS 1.2 or higher.
          </li>
          <li style={styles.listItem}>
            <strong>Encryption at rest:</strong> Sensitive personal data is encrypted at
            rest using AES-256 encryption.
          </li>
          <li style={styles.listItem}>
            <strong>Password hashing:</strong> User passwords are hashed using bcrypt with
            appropriate salt rounds. We never store plain-text passwords.
          </li>
          <li style={styles.listItem}>
            <strong>Access controls:</strong> Strict role-based access controls limit who
            can access personal data within our organization.
          </li>
          <li style={styles.listItem}>
            <strong>Infrastructure security:</strong> Our infrastructure follows industry
            best practices including firewalls, intrusion detection, and regular security
            updates.
          </li>
        </ul>

        <h3 style={styles.subheading}>10.2 Organizational Measures</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Regular security audits and penetration testing.
          </li>
          <li style={styles.listItem}>
            Employee training on data privacy and security practices.
          </li>
          <li style={styles.listItem}>
            Incident response plan for data breaches.
          </li>
          <li style={styles.listItem}>
            Data processing agreements with all third-party service providers.
          </li>
        </ul>

        <h3 style={styles.subheading}>10.3 Open Source Security</h3>
        <p style={styles.paragraph}>
          Because our Platform software is open source (AGPL-3.0), security researchers
          and community members can review our code and report vulnerabilities. We maintain
          a responsible disclosure policy and welcome security reports at{' '}
          <a href="mailto:security@openride.coop" style={{ color: '#2E7D32' }}>
            security@openride.coop
          </a>
          .
        </p>

        <h3 style={styles.subheading}>10.4 Breach Notification</h3>
        <p style={styles.paragraph}>
          In the event of a data breach that poses a risk to your rights and freedoms, we
          will:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>Notify affected users within 72 hours of becoming aware of the breach.</li>
          <li style={styles.listItem}>Notify the relevant supervisory authority as required by law.</li>
          <li style={styles.listItem}>Provide clear information about what data was affected and what steps we are taking.</li>
          <li style={styles.listItem}>Offer guidance on steps you can take to protect yourself.</li>
        </ul>
      </section>

      {/* Section 11: International Transfers */}
      <section id="international" style={styles.section}>
        <h2 style={styles.sectionTitle}>11. International Transfers</h2>
        <p style={styles.paragraph}>
          OpenRide primarily processes and stores data in the United States. If you are
          located outside the United States, please be aware that your data may be
          transferred to, stored, and processed in the United States.
        </p>
        <p style={styles.paragraph}>
          For users in the European Economic Area (EEA), United Kingdom, or Switzerland,
          we ensure that any international transfers of personal data are subject to
          appropriate safeguards, including:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Standard Contractual Clauses (SCCs) approved by the European Commission.
          </li>
          <li style={styles.listItem}>
            Data processing agreements with all service providers that include adequate
            data protection provisions.
          </li>
          <li style={styles.listItem}>
            Where applicable, reliance on an adequacy decision by the European Commission.
          </li>
        </ul>
      </section>

      {/* Section 12: CCPA */}
      <section id="ccpa" style={styles.section}>
        <h2 style={styles.sectionTitle}>12. California Privacy Rights (CCPA/CPRA)</h2>
        <p style={styles.paragraph}>
          If you are a California resident, the California Consumer Privacy Act (CCPA)
          and the California Privacy Rights Act (CPRA) provide you with additional rights
          regarding your personal information:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Right to Know:</strong> You have the right to request disclosure of the
            categories and specific pieces of personal information we have collected about
            you, the categories of sources, the business purpose for collection, and the
            categories of third parties with whom we share it.
          </li>
          <li style={styles.listItem}>
            <strong>Right to Delete:</strong> You have the right to request deletion of
            your personal information, subject to certain legal exceptions.
          </li>
          <li style={styles.listItem}>
            <strong>Right to Opt-Out of Sale:</strong> We do <strong>not</strong> sell
            your personal information. As such, there is no need to opt out, but we
            respect this right and affirm our commitment.
          </li>
          <li style={styles.listItem}>
            <strong>Right to Non-Discrimination:</strong> We will not discriminate against
            you for exercising any of your CCPA rights.
          </li>
          <li style={styles.listItem}>
            <strong>Right to Correct:</strong> You have the right to request correction of
            inaccurate personal information.
          </li>
          <li style={styles.listItem}>
            <strong>Right to Limit Use of Sensitive Personal Information:</strong> You have
            the right to limit the use and disclosure of sensitive personal information to
            only what is necessary for the purposes for which it was collected.
          </li>
        </ul>
        <p style={styles.paragraph}>
          To exercise your CCPA rights, you may email{' '}
          <a href="mailto:privacy@openride.coop" style={{ color: '#2E7D32' }}>
            privacy@openride.coop
          </a>{' '}
          or use the in-app privacy controls. We will verify your identity before
          processing your request.
        </p>
      </section>

      {/* Section 13: GDPR */}
      <section id="gdpr" style={styles.section}>
        <h2 style={styles.sectionTitle}>13. European Privacy Rights (GDPR)</h2>
        <p style={styles.paragraph}>
          If you are located in the European Economic Area (EEA), United Kingdom, or
          Switzerland, the General Data Protection Regulation (GDPR) provides you with
          additional rights and protections.
        </p>

        <h3 style={styles.subheading}>13.1 Legal Basis for Processing</h3>
        <p style={styles.paragraph}>
          We process your personal data under the following legal bases:
        </p>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Purpose</th>
              <th style={styles.th}>Legal Basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Providing ride-sharing services</td>
              <td style={styles.td}>Contractual necessity (Art. 6(1)(b))</td>
            </tr>
            <tr>
              <td style={styles.td}>Payment processing</td>
              <td style={styles.td}>Contractual necessity (Art. 6(1)(b))</td>
            </tr>
            <tr>
              <td style={styles.td}>Safety and fraud prevention</td>
              <td style={styles.td}>Legitimate interest (Art. 6(1)(f))</td>
            </tr>
            <tr>
              <td style={styles.td}>Legal and tax compliance</td>
              <td style={styles.td}>Legal obligation (Art. 6(1)(c))</td>
            </tr>
            <tr>
              <td style={styles.td}>Background checks (drivers)</td>
              <td style={styles.td}>Consent (Art. 6(1)(a))</td>
            </tr>
            <tr>
              <td style={styles.td}>Platform improvements (analytics)</td>
              <td style={styles.td}>Legitimate interest (Art. 6(1)(f))</td>
            </tr>
            <tr>
              <td style={styles.td}>Governance participation</td>
              <td style={styles.td}>Contractual necessity (Art. 6(1)(b))</td>
            </tr>
          </tbody>
        </table>

        <h3 style={styles.subheading}>13.2 Additional GDPR Rights</h3>
        <p style={styles.paragraph}>
          In addition to the rights listed in Section 7, EEA/UK users also have:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Right to lodge a complaint:</strong> You have the right to lodge a
            complaint with your local data protection authority if you believe we have
            violated your data protection rights.
          </li>
          <li style={styles.listItem}>
            <strong>Right to object to profiling:</strong> You have the right to object to
            any automated decision-making, including profiling. OpenRide does not engage in
            automated decision-making that produces legal effects.
          </li>
        </ul>
      </section>

      {/* Section 14: Changes */}
      <section id="changes" style={styles.section}>
        <h2 style={styles.sectionTitle}>14. Changes to This Policy</h2>
        <p style={styles.paragraph}>
          As a cooperatively governed platform, material changes to this Privacy Policy
          require approval through the OpenRide governance process:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Material changes</strong> (expanding data collection, adding new
            third-party sharing, changing retention periods) must be proposed and approved
            through a governance vote.
          </li>
          <li style={styles.listItem}>
            <strong>Non-material changes</strong> (clarifications, legal updates, formatting)
            may be made by OpenRide staff with community notification.
          </li>
          <li style={styles.listItem}>
            All users will be notified of any changes at least <strong>30 days</strong>{' '}
            before they take effect via email and in-app notification.
          </li>
          <li style={styles.listItem}>
            The updated policy will be posted with a new effective date and a summary of
            changes.
          </li>
          <li style={styles.listItem}>
            Previous versions of this policy will be archived and publicly accessible.
          </li>
        </ul>
      </section>

      {/* Section 15: Contact */}
      <section id="contact" style={styles.section}>
        <h2 style={styles.sectionTitle}>15. Contact Information &amp; Data Protection Officer</h2>
        <p style={styles.paragraph}>
          If you have questions about this Privacy Policy or wish to exercise your privacy
          rights, please contact us:
        </p>
        <div
          style={{
            background: '#f8f9fb',
            border: '1px solid #e2e4ea',
            borderRadius: 8,
            padding: '20px 24px',
            fontSize: 15,
            lineHeight: 1.8,
            marginBottom: 20,
          }}
        >
          <strong>Privacy Team</strong>
          <br />
          OpenRide Cooperative, Inc.
          <br />
          Email:{' '}
          <a href="mailto:privacy@openride.coop" style={{ color: '#2E7D32' }}>
            privacy@openride.coop
          </a>
          <br />
          Address: [STREET ADDRESS]
          <br />
          [CITY, STATE ZIP]
          <br />
          [COUNTRY]
        </div>

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
          <strong>Data Protection Officer (DPO)</strong>
          <br />
          Name: [DPO NAME]
          <br />
          Email:{' '}
          <a href="mailto:dpo@openride.coop" style={{ color: '#2E7D32' }}>
            dpo@openride.coop
          </a>
          <br />
          <br />
          <em>
            Our DPO is responsible for overseeing compliance with this Privacy Policy and
            applicable data protection laws. The DPO operates independently and reports
            directly to the cooperative&apos;s governance board.
          </em>
        </div>

        <p style={{ ...styles.paragraph, marginTop: 20 }}>
          <strong>EU Representative:</strong> For users in the European Union, our
          designated EU representative can be contacted at{' '}
          <a href="mailto:eu-representative@openride.coop" style={{ color: '#2E7D32' }}>
            eu-representative@openride.coop
          </a>
          .
        </p>
      </section>
    </div>
  );
}
