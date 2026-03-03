export const metadata = {
  title: 'Driver Agreement — OpenRide',
  description:
    'Driver Partnership Agreement for the OpenRide community-owned ride-sharing cooperative platform.',
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
  { id: 'parties', label: '1. Parties & Recitals' },
  { id: 'relationship', label: '2. Independent Contractor Relationship' },
  { id: 'driver-requirements', label: '3. Driver Requirements' },
  { id: 'vehicle-requirements', label: '4. Vehicle Requirements' },
  { id: 'insurance', label: '5. Insurance Requirements' },
  { id: 'platform-fees', label: '6. Platform Fee Structure' },
  { id: 'earnings', label: '7. Earnings & Payout Schedule' },
  { id: 'governance', label: '8. Governance Rights' },
  { id: 'safety', label: '9. Safety Requirements' },
  { id: 'confidentiality', label: '10. Confidentiality' },
  { id: 'deactivation', label: '11. Deactivation Policy' },
  { id: 'termination', label: '12. Termination' },
  { id: 'indemnification', label: '13. Indemnification' },
  { id: 'general', label: '14. General Provisions' },
];

export default function DriverAgreementPage() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Driver Partnership Agreement</h1>
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
      <div style={{ marginBottom: 32 }}>
        <p style={styles.paragraph}>
          This Driver Partnership Agreement (&quot;Agreement&quot;) is entered into between
          OpenRide Cooperative, Inc. (&quot;OpenRide,&quot; &quot;Platform,&quot;
          &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) and you (&quot;Driver,&quot;
          &quot;you,&quot; or &quot;your&quot;), an individual who wishes to provide
          transportation services through the OpenRide platform.
        </p>
        <div style={styles.highlight}>
          <strong>What makes OpenRide different:</strong> This is not a typical
          ride-sharing driver agreement. As a community-owned cooperative, OpenRide exists
          to serve its drivers and riders — not to maximize profit for shareholders. This
          agreement reflects our commitment to fairness, transparency, and democratic
          governance. You have a voice in how this platform operates.
        </div>
      </div>

      {/* Section 1: Parties & Recitals */}
      <section id="parties" style={styles.section}>
        <h2 style={styles.sectionTitle}>1. Parties &amp; Recitals</h2>
        <p style={styles.paragraph}>
          <strong>WHEREAS,</strong> OpenRide Cooperative, Inc. operates a community-owned,
          non-profit cooperative ride-sharing technology platform that connects passengers
          with independent transportation providers; and
        </p>
        <p style={styles.paragraph}>
          <strong>WHEREAS,</strong> Driver desires to use the OpenRide platform to connect
          with passengers and provide transportation services as an independent contractor;
          and
        </p>
        <p style={styles.paragraph}>
          <strong>WHEREAS,</strong> both parties wish to establish the terms and conditions
          of their relationship;
        </p>
        <p style={styles.paragraph}>
          <strong>NOW, THEREFORE,</strong> in consideration of the mutual covenants and
          agreements set forth herein, and for other good and valuable consideration, the
          receipt and sufficiency of which are hereby acknowledged, the parties agree as
          follows:
        </p>
      </section>

      {/* Section 2: Independent Contractor Relationship */}
      <section id="relationship" style={styles.section}>
        <h2 style={styles.sectionTitle}>2. Independent Contractor Relationship</h2>

        <h3 style={styles.subheading}>2.1 Status</h3>
        <p style={styles.paragraph}>
          You are an <strong>independent contractor</strong> and not an employee, agent,
          joint venturer, partner, or franchisee of OpenRide. Nothing in this Agreement
          creates an employer-employee relationship between you and OpenRide.
        </p>

        <h3 style={styles.subheading}>2.2 Freedom of Operation</h3>
        <p style={styles.paragraph}>
          As an independent contractor, you retain complete control over:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>When you work:</strong> You decide when to log on and off the Platform.
            There are no minimum hours, shifts, or scheduling requirements.
          </li>
          <li style={styles.listItem}>
            <strong>Where you work:</strong> You choose your geographic area of operation
            within the Platform&apos;s service area.
          </li>
          <li style={styles.listItem}>
            <strong>Which rides to accept:</strong> You may accept or decline any ride
            request without penalty. Acceptance rates are not used in deactivation
            decisions.
          </li>
          <li style={styles.listItem}>
            <strong>Other platforms:</strong> You are free to use other ride-sharing
            platforms, delivery services, or engage in other work simultaneously.
          </li>
          <li style={styles.listItem}>
            <strong>Your vehicle:</strong> You own or lease your vehicle and are
            responsible for all associated costs.
          </li>
        </ul>

        <h3 style={styles.subheading}>2.3 Tax Responsibilities</h3>
        <p style={styles.paragraph}>
          As an independent contractor, you are solely responsible for:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Reporting and paying all applicable federal, state, and local income taxes.
          </li>
          <li style={styles.listItem}>
            Paying self-employment taxes (Social Security and Medicare).
          </li>
          <li style={styles.listItem}>
            Filing quarterly estimated tax payments as required.
          </li>
          <li style={styles.listItem}>
            OpenRide will provide a 1099-NEC (or equivalent) form if your earnings exceed
            the IRS reporting threshold during a calendar year.
          </li>
        </ul>

        <h3 style={styles.subheading}>2.4 No Benefits</h3>
        <p style={styles.paragraph}>
          As an independent contractor, you are not entitled to employee benefits from
          OpenRide, including but not limited to health insurance, retirement plans,
          paid time off, workers&apos; compensation, or unemployment insurance. However,
          OpenRide&apos;s governance body may vote to establish cooperative benefit programs
          for drivers in the future.
        </p>
      </section>

      {/* Section 3: Driver Requirements */}
      <section id="driver-requirements" style={styles.section}>
        <h2 style={styles.sectionTitle}>3. Driver Requirements</h2>
        <p style={styles.paragraph}>
          To drive on the OpenRide platform, you must meet and continue to meet the
          following requirements:
        </p>

        <h3 style={styles.subheading}>3.1 Age and Licensing</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            You must be at least <strong>21 years of age</strong>.
          </li>
          <li style={styles.listItem}>
            You must hold a valid driver&apos;s license in the jurisdiction where you intend
            to provide services. The license must have been held for a minimum of 1 year
            (3 years if under age 25).
          </li>
          <li style={styles.listItem}>
            If required by your jurisdiction, you must hold any applicable for-hire,
            chauffeur, or Transportation Network Company (TNC) license or permit.
          </li>
        </ul>

        <h3 style={styles.subheading}>3.2 Background Check</h3>
        <p style={styles.paragraph}>
          You must consent to and successfully pass a comprehensive background check, which
          includes:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Criminal history check:</strong> Multi-state criminal records search
            covering a minimum of 7 years.
          </li>
          <li style={styles.listItem}>
            <strong>Sex offender registry:</strong> National sex offender registry search.
          </li>
          <li style={styles.listItem}>
            <strong>Motor vehicle records:</strong> Review of your driving history for
            major violations, DUI/DWI convictions, and at-fault accidents.
          </li>
          <li style={styles.listItem}>
            <strong>Ongoing monitoring:</strong> Continuous monitoring for relevant
            criminal convictions or serious traffic violations.
          </li>
        </ul>
        <div style={styles.infoBox}>
          <strong>Fair process:</strong> Background checks are conducted by a licensed
          third-party provider in full compliance with the Fair Credit Reporting Act
          (FCRA). You have the right to review the results, dispute inaccuracies, and
          receive a copy of the report. A criminal record does not automatically
          disqualify you — each case is reviewed individually.
        </div>

        <h3 style={styles.subheading}>3.3 Clean Driving Record</h3>
        <p style={styles.paragraph}>
          You must maintain a clean driving record. The following may result in
          disqualification:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Any DUI/DWI conviction within the past 7 years.
          </li>
          <li style={styles.listItem}>
            More than 3 moving violations within the past 3 years.
          </li>
          <li style={styles.listItem}>
            Any conviction for reckless driving, hit-and-run, or driving with a suspended
            or revoked license within the past 7 years.
          </li>
          <li style={styles.listItem}>
            Any conviction for a violent crime, sexual offense, or felony involving a
            motor vehicle.
          </li>
        </ul>

        <h3 style={styles.subheading}>3.4 Ongoing Obligations</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            You must immediately notify OpenRide of any changes to your driver&apos;s
            license status, insurance coverage, vehicle condition, or if you are charged
            with or convicted of any criminal offense or serious traffic violation.
          </li>
          <li style={styles.listItem}>
            You must maintain accurate and current information in your driver profile.
          </li>
          <li style={styles.listItem}>
            You must comply with all applicable local, state, and federal laws and
            regulations related to transportation services.
          </li>
        </ul>
      </section>

      {/* Section 4: Vehicle Requirements */}
      <section id="vehicle-requirements" style={styles.section}>
        <h2 style={styles.sectionTitle}>4. Vehicle Requirements</h2>
        <p style={styles.paragraph}>
          Your vehicle must meet the following requirements at all times while providing
          services on the Platform:
        </p>

        <h3 style={styles.subheading}>4.1 Vehicle Age and Type</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Vehicle must be no more than <strong>15 model years old</strong> (or as
            required by local regulations, whichever is stricter).
          </li>
          <li style={styles.listItem}>
            Vehicle must have <strong>4 doors</strong> and seat at least{' '}
            <strong>4 passengers</strong> (excluding the driver).
          </li>
          <li style={styles.listItem}>
            Salvage-title vehicles are not permitted.
          </li>
          <li style={styles.listItem}>
            Commercially branded or wrapped vehicles (e.g., taxi livery) may be subject to
            additional local regulations.
          </li>
        </ul>

        <h3 style={styles.subheading}>4.2 Vehicle Condition</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Vehicle must be in <strong>good mechanical condition</strong> with all safety
            features (airbags, seatbelts, mirrors, lights, brakes, tires) in proper
            working order.
          </li>
          <li style={styles.listItem}>
            Vehicle must have a clean and well-maintained interior and exterior.
          </li>
          <li style={styles.listItem}>
            Vehicle must have functioning air conditioning and heating.
          </li>
          <li style={styles.listItem}>
            No significant cosmetic damage that would compromise passenger comfort or
            safety.
          </li>
        </ul>

        <h3 style={styles.subheading}>4.3 Registration and Compliance</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Vehicle must have <strong>valid registration</strong> and <strong>current
            license plates</strong> in the jurisdiction where you provide services.
          </li>
          <li style={styles.listItem}>
            Vehicle must pass all applicable <strong>emissions tests and safety
            inspections</strong> required by your jurisdiction.
          </li>
          <li style={styles.listItem}>
            If required by your jurisdiction, vehicle must display a TNC trade dress or
            emblem.
          </li>
        </ul>

        <h3 style={styles.subheading}>4.4 Vehicle Inspection</h3>
        <p style={styles.paragraph}>
          OpenRide may require periodic vehicle inspections. Inspections may be conducted
          by OpenRide staff, an authorized third-party mechanic, or through a self-
          inspection checklist with photographic documentation.
        </p>
      </section>

      {/* Section 5: Insurance Requirements */}
      <section id="insurance" style={styles.section}>
        <h2 style={styles.sectionTitle}>5. Insurance Requirements</h2>

        <h3 style={styles.subheading}>5.1 Personal Auto Insurance</h3>
        <p style={styles.paragraph}>
          You must maintain personal auto insurance that meets or exceeds the minimum
          coverage requirements of your state or jurisdiction. You are responsible for
          ensuring your insurance policy permits rideshare activity.
        </p>

        <h3 style={styles.subheading}>5.2 Rideshare Insurance</h3>
        <p style={styles.paragraph}>
          We strongly recommend that you carry a rideshare endorsement or commercial auto
          insurance policy. Many personal auto insurance policies exclude coverage during
          rideshare activity. OpenRide is not responsible for gaps in your personal
          insurance coverage.
        </p>

        <h3 style={styles.subheading}>5.3 Platform Insurance Coverage</h3>
        <p style={styles.paragraph}>
          OpenRide maintains supplemental contingent liability coverage that applies during
          different phases of your activity:
        </p>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Phase</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Coverage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Period 1: App On, Waiting for Request</td>
              <td style={styles.td}>You are online and available but have not accepted a ride</td>
              <td style={styles.td}>Contingent liability coverage if your personal policy does not apply</td>
            </tr>
            <tr>
              <td style={styles.td}>Period 2: En Route to Pickup</td>
              <td style={styles.td}>You have accepted a ride and are driving to the pickup location</td>
              <td style={styles.td}>Commercial auto liability coverage</td>
            </tr>
            <tr>
              <td style={styles.td}>Period 3: During Ride</td>
              <td style={styles.td}>Passenger is in the vehicle, ride in progress</td>
              <td style={styles.td}>Commercial auto liability coverage, uninsured/underinsured motorist coverage</td>
            </tr>
          </tbody>
        </table>
        <p style={styles.paragraph}>
          Specific coverage limits and details are available in the Insurance Summary
          document provided during onboarding. Coverage limits are set to meet or exceed
          all applicable state and local requirements.
        </p>

        <h3 style={styles.subheading}>5.4 Documentation</h3>
        <p style={styles.paragraph}>
          You must upload and maintain current proof of insurance in your driver profile.
          You will be notified before your insurance documentation expires and must update
          it promptly. Failure to maintain valid insurance documentation will result in
          temporary suspension until updated documentation is provided.
        </p>
      </section>

      {/* Section 6: Platform Fee Structure */}
      <section id="platform-fees" style={styles.section}>
        <h2 style={styles.sectionTitle}>6. Platform Fee Structure</h2>

        <div style={styles.highlight}>
          <strong>Transparency commitment:</strong> Unlike traditional ride-sharing
          platforms, OpenRide charges only a cost-recovery fee — not a profit-maximizing
          commission. Every cent of the platform fee is accounted for publicly on our
          transparency dashboard.
        </div>

        <h3 style={styles.subheading}>6.1 Fee Range</h3>
        <p style={styles.paragraph}>
          OpenRide charges a platform fee of <strong>5-10%</strong> of the total fare. The
          exact percentage is determined through the governance process and applies equally
          to all drivers.
        </p>

        <h3 style={styles.subheading}>6.2 What the Fee Covers</h3>
        <p style={styles.paragraph}>
          The platform fee is a cost-only fee that covers:
        </p>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Payment processing</td>
              <td style={styles.td}>Stripe transaction fees for passenger charges and driver payouts</td>
            </tr>
            <tr>
              <td style={styles.td}>Insurance</td>
              <td style={styles.td}>Platform supplemental insurance coverage (Periods 1-3)</td>
            </tr>
            <tr>
              <td style={styles.td}>Infrastructure</td>
              <td style={styles.td}>Server hosting, mapping services, SMS/call routing</td>
            </tr>
            <tr>
              <td style={styles.td}>Support</td>
              <td style={styles.td}>Customer support operations and dispute resolution</td>
            </tr>
            <tr>
              <td style={styles.td}>Safety</td>
              <td style={styles.td}>Background checks, safety monitoring, incident response</td>
            </tr>
            <tr>
              <td style={styles.td}>Operating reserves</td>
              <td style={styles.td}>Maintaining a financial buffer for platform stability</td>
            </tr>
          </tbody>
        </table>

        <h3 style={styles.subheading}>6.3 Fee Transparency</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            The current platform fee percentage is publicly displayed on the transparency
            dashboard.
          </li>
          <li style={styles.listItem}>
            A detailed breakdown of how platform fees are spent is published quarterly.
          </li>
          <li style={styles.listItem}>
            Changes to the fee percentage require a governance vote with community approval.
          </li>
          <li style={styles.listItem}>
            You will be notified at least 30 days before any fee change takes effect.
          </li>
        </ul>

        <h3 style={styles.subheading}>6.4 No Hidden Fees</h3>
        <p style={styles.paragraph}>
          OpenRide does not charge drivers any additional fees beyond the platform fee
          percentage. There are no activation fees, monthly subscription fees, equipment
          rental fees, or deactivation fees.
        </p>
      </section>

      {/* Section 7: Earnings & Payout Schedule */}
      <section id="earnings" style={styles.section}>
        <h2 style={styles.sectionTitle}>7. Earnings &amp; Payout Schedule</h2>

        <h3 style={styles.subheading}>7.1 Earnings Calculation</h3>
        <p style={styles.paragraph}>
          For each completed ride, your earnings are calculated as:
        </p>
        <div style={styles.infoBox}>
          <strong>Driver Earnings</strong> = Total Fare - Platform Fee - Payment Processing
          Fee
          <br />
          <br />
          Tips are always passed through to you at 100% with no platform deduction.
        </div>

        <h3 style={styles.subheading}>7.2 Payout Methods (Stripe Connect)</h3>
        <p style={styles.paragraph}>
          All driver payouts are processed through <strong>Stripe Connect</strong>. You
          must set up and maintain an active Stripe Connect account linked to a valid bank
          account.
        </p>

        <h3 style={styles.subheading}>7.3 Payout Schedule</h3>
        <table style={styles.dataTable}>
          <thead>
            <tr>
              <th style={styles.th}>Payout Option</th>
              <th style={styles.th}>Timing</th>
              <th style={styles.th}>Additional Fee</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}><strong>Weekly (Default)</strong></td>
              <td style={styles.td}>Every Monday for the previous week&apos;s earnings (Mon-Sun)</td>
              <td style={styles.td}>None</td>
            </tr>
            <tr>
              <td style={styles.td}>Instant Payout</td>
              <td style={styles.td}>Within minutes of request, available 24/7</td>
              <td style={styles.td}>Stripe&apos;s instant payout fee (currently 1% with $0.50 minimum, set by Stripe)</td>
            </tr>
            <tr>
              <td style={styles.td}>Daily Payout</td>
              <td style={styles.td}>Each business day for the previous day&apos;s earnings</td>
              <td style={styles.td}>None</td>
            </tr>
          </tbody>
        </table>

        <h3 style={styles.subheading}>7.4 Earnings Transparency</h3>
        <p style={styles.paragraph}>
          Your driver dashboard provides complete transparency into your earnings:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Real-time earnings tracker showing each ride&apos;s fare breakdown.
          </li>
          <li style={styles.listItem}>
            Weekly, monthly, and annual earnings summaries.
          </li>
          <li style={styles.listItem}>
            Complete breakdown showing the base fare, distance charge, time charge,
            tips, platform fee deducted, and your net earnings for every ride.
          </li>
          <li style={styles.listItem}>
            Exportable earning statements for tax preparation (CSV and PDF formats).
          </li>
        </ul>

        <h3 style={styles.subheading}>7.5 Minimum Earnings</h3>
        <p style={styles.paragraph}>
          OpenRide does not guarantee a minimum level of earnings. Your earnings depend on
          the number and type of rides you complete, local demand, and your availability.
          However, the governance body may vote to implement minimum fare guarantees or
          earnings floors in the future.
        </p>
      </section>

      {/* Section 8: Governance Rights */}
      <section id="governance" style={styles.section}>
        <h2 style={styles.sectionTitle}>8. Governance Rights</h2>

        <div style={styles.highlight}>
          <strong>Your voice matters:</strong> As a cooperative platform, every eligible
          driver has an equal vote in platform governance decisions. One driver, one vote.
          No matter how many rides you complete.
        </div>

        <h3 style={styles.subheading}>8.1 Voting Eligibility</h3>
        <p style={styles.paragraph}>
          You become eligible to vote on governance proposals after completing{' '}
          <strong>10 rides</strong> on the Platform. Once eligible, your voting rights
          continue as long as your account is active.
        </p>

        <h3 style={styles.subheading}>8.2 What You Can Vote On</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Platform fee adjustments:</strong> Any change to the platform fee
            percentage.
          </li>
          <li style={styles.listItem}>
            <strong>Fare structure changes:</strong> Modifications to base fares, per-km
            rates, per-minute rates, or surge pricing caps.
          </li>
          <li style={styles.listItem}>
            <strong>Policy changes:</strong> Updates to Terms of Service, Privacy Policy,
            or this Driver Agreement.
          </li>
          <li style={styles.listItem}>
            <strong>Surplus allocation:</strong> How to use any operational surplus (fee
            reductions, driver bonuses, community investments).
          </li>
          <li style={styles.listItem}>
            <strong>Feature prioritization:</strong> Influence which features and
            improvements the development team focuses on.
          </li>
          <li style={styles.listItem}>
            <strong>Board elections:</strong> Electing representatives to the
            cooperative&apos;s board of directors.
          </li>
        </ul>

        <h3 style={styles.subheading}>8.3 Submitting Proposals</h3>
        <p style={styles.paragraph}>
          Any eligible driver may submit a governance proposal through the Platform. Proposals
          require a minimum number of endorsements (set by governance) before proceeding to a
          community-wide vote.
        </p>

        <h3 style={styles.subheading}>8.4 Participation Responsibilities</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Vote in good faith, considering the interests of the entire community.
          </li>
          <li style={styles.listItem}>
            Do not attempt to manipulate votes through multiple accounts or coordination
            schemes.
          </li>
          <li style={styles.listItem}>
            Respect the outcomes of governance decisions.
          </li>
        </ul>
      </section>

      {/* Section 9: Safety Requirements */}
      <section id="safety" style={styles.section}>
        <h2 style={styles.sectionTitle}>9. Safety Requirements</h2>

        <h3 style={styles.subheading}>9.1 Driving Standards</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Obey all traffic laws, speed limits, and road signs at all times.
          </li>
          <li style={styles.listItem}>
            Never drive under the influence of alcohol, drugs, or any substance that
            impairs your ability to drive safely.
          </li>
          <li style={styles.listItem}>
            Minimize use of your mobile device while driving. Use hands-free navigation
            and voice commands when possible.
          </li>
          <li style={styles.listItem}>
            Ensure all passengers wear seatbelts before beginning a trip.
          </li>
          <li style={styles.listItem}>
            Drive defensively and prioritize the safety of passengers, pedestrians, and
            other road users.
          </li>
        </ul>

        <h3 style={styles.subheading}>9.2 Passenger Safety</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Verify the passenger&apos;s identity matches the ride request before beginning
            the trip.
          </li>
          <li style={styles.listItem}>
            Do not discriminate against passengers for any reason (see{' '}
            <a href="/terms#user-conduct" style={{ color: '#2E7D32' }}>
              Terms of Service, Section 5
            </a>
            ).
          </li>
          <li style={styles.listItem}>
            Accommodate service animals at all times, as required by law.
          </li>
          <li style={styles.listItem}>
            Report any safety incidents or concerning passenger behavior through the
            Platform immediately.
          </li>
        </ul>

        <h3 style={styles.subheading}>9.3 Regulatory Compliance</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Comply with all applicable local, state, and federal transportation
            regulations.
          </li>
          <li style={styles.listItem}>
            Obtain and maintain any required licenses or permits for providing
            transportation services in your jurisdiction.
          </li>
          <li style={styles.listItem}>
            Display any required signage, trade dress, or permit stickers as mandated by
            local regulations.
          </li>
          <li style={styles.listItem}>
            Cooperate with law enforcement during lawful traffic stops or investigations.
          </li>
        </ul>

        <h3 style={styles.subheading}>9.4 Emergency Procedures</h3>
        <p style={styles.paragraph}>
          In case of an emergency:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Call 911 (or local emergency number) immediately for any medical emergency,
            accident, or safety threat.
          </li>
          <li style={styles.listItem}>
            Use the Platform&apos;s in-app emergency button to alert OpenRide&apos;s safety
            team.
          </li>
          <li style={styles.listItem}>
            Report all incidents, no matter how minor, through the Platform within 24
            hours.
          </li>
        </ul>
      </section>

      {/* Section 10: Confidentiality */}
      <section id="confidentiality" style={styles.section}>
        <h2 style={styles.sectionTitle}>10. Confidentiality of Passenger Information</h2>
        <p style={styles.paragraph}>
          You agree to maintain the confidentiality of all passenger information you
          receive through the Platform:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>No sharing:</strong> Do not share passenger names, phone numbers,
            addresses, destinations, or any other personal information with third parties.
          </li>
          <li style={styles.listItem}>
            <strong>No recording:</strong> Do not photograph, record audio or video of
            passengers without their explicit consent (except where required by law or
            local regulation for dashcam use, which must comply with applicable
            notification requirements).
          </li>
          <li style={styles.listItem}>
            <strong>No contact outside Platform:</strong> Do not contact passengers
            outside the Platform unless they have explicitly provided their contact
            information for that purpose.
          </li>
          <li style={styles.listItem}>
            <strong>Ride data:</strong> Do not share screenshots, ride details, or
            earnings information that could identify specific passengers on social media
            or public forums.
          </li>
        </ul>
        <p style={styles.paragraph}>
          This obligation survives termination of this Agreement.
        </p>
      </section>

      {/* Section 11: Deactivation Policy */}
      <section id="deactivation" style={styles.section}>
        <h2 style={styles.sectionTitle}>11. Deactivation Policy</h2>

        <div style={styles.highlight}>
          <strong>Human-centered process:</strong> Unlike traditional ride-sharing
          platforms, OpenRide does NOT use algorithmic deactivation. Your account will
          never be deactivated by an algorithm based on acceptance rates, ratings
          thresholds, or cancellation rates alone. All deactivation decisions involve
          human review.
        </div>

        <h3 style={styles.subheading}>11.1 Peer Review Panel</h3>
        <p style={styles.paragraph}>
          If a complaint or safety concern is raised about your account, it is reviewed
          by a <strong>peer review panel</strong> composed of experienced community members
          (both drivers and passengers). The process works as follows:
        </p>
        <ol style={styles.list}>
          <li style={styles.listItem}>
            <strong>Complaint received:</strong> A complaint, safety report, or policy
            violation report is submitted.
          </li>
          <li style={styles.listItem}>
            <strong>Initial triage:</strong> Platform staff reviews the complaint for
            validity and urgency within 24 hours.
          </li>
          <li style={styles.listItem}>
            <strong>Your response:</strong> You are notified of the complaint and given an
            opportunity to respond with your perspective and any supporting evidence.
          </li>
          <li style={styles.listItem}>
            <strong>Panel review:</strong> A panel of 3-5 community members reviews all
            evidence, including your response.
          </li>
          <li style={styles.listItem}>
            <strong>Decision:</strong> The panel may issue a warning, require additional
            training, impose a temporary suspension, or recommend permanent deactivation.
          </li>
          <li style={styles.listItem}>
            <strong>Notification:</strong> You are informed of the decision with a clear
            explanation.
          </li>
        </ol>

        <h3 style={styles.subheading}>11.2 Appeals Process</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            You may appeal any deactivation decision within <strong>14 days</strong> of
            notification.
          </li>
          <li style={styles.listItem}>
            Appeals are reviewed by a <strong>different panel</strong> that did not
            participate in the original decision.
          </li>
          <li style={styles.listItem}>
            The appeals panel may uphold, modify, or reverse the original decision.
          </li>
          <li style={styles.listItem}>
            You may submit additional evidence or context with your appeal.
          </li>
        </ul>

        <h3 style={styles.subheading}>11.3 Grounds for Immediate Suspension</h3>
        <p style={styles.paragraph}>
          OpenRide may immediately suspend your account (pending peer review) only in
          cases involving:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Credible reports of violent, threatening, or sexually inappropriate behavior.
          </li>
          <li style={styles.listItem}>
            Driving under the influence of alcohol or drugs.
          </li>
          <li style={styles.listItem}>
            Criminal charges related to driving or passenger safety.
          </li>
          <li style={styles.listItem}>
            Fraud, identity theft, or use of a fraudulent background check.
          </li>
          <li style={styles.listItem}>
            Lapsed insurance, expired driver&apos;s license, or vehicle safety failure.
          </li>
        </ul>

        <h3 style={styles.subheading}>11.4 What Deactivation Does NOT Consider</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Ride acceptance rate (declining rides is your right as an independent
            contractor).
          </li>
          <li style={styles.listItem}>
            Cancellation rate (within reasonable bounds).
          </li>
          <li style={styles.listItem}>
            Ratings below a threshold (ratings alone do not trigger deactivation).
          </li>
          <li style={styles.listItem}>
            Hours or days worked (no minimum activity requirement).
          </li>
          <li style={styles.listItem}>
            Use of competing platforms.
          </li>
        </ul>
      </section>

      {/* Section 12: Termination */}
      <section id="termination" style={styles.section}>
        <h2 style={styles.sectionTitle}>12. Termination</h2>

        <h3 style={styles.subheading}>12.1 Termination by You</h3>
        <p style={styles.paragraph}>
          You may terminate this Agreement and deactivate your driver account at any time,
          for any reason, by:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Using the account deactivation feature in the app settings.
          </li>
          <li style={styles.listItem}>
            Contacting OpenRide support to request deactivation.
          </li>
        </ul>
        <p style={styles.paragraph}>
          Upon termination, all outstanding earnings will be paid out within 30 days
          through your established payout method.
        </p>

        <h3 style={styles.subheading}>12.2 Termination by OpenRide</h3>
        <p style={styles.paragraph}>
          OpenRide may terminate this Agreement through the peer review panel process
          described in Section 11, or if:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            You fail to meet the ongoing driver requirements specified in Section 3.
          </li>
          <li style={styles.listItem}>
            You fail to maintain valid insurance as required by Section 5.
          </li>
          <li style={styles.listItem}>
            You breach a material term of this Agreement.
          </li>
          <li style={styles.listItem}>
            The peer review panel recommends permanent deactivation following the process
            in Section 11.
          </li>
        </ul>

        <h3 style={styles.subheading}>12.3 Effect of Termination</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            All outstanding earnings will be processed and paid within 30 days.
          </li>
          <li style={styles.listItem}>
            Your governance voting rights are suspended immediately upon termination.
          </li>
          <li style={styles.listItem}>
            Your personal data will be handled according to our{' '}
            <a href="/privacy" style={{ color: '#2E7D32' }}>
              Privacy Policy
            </a>
            .
          </li>
          <li style={styles.listItem}>
            Sections 10 (Confidentiality), 13 (Indemnification), and 14 (General
            Provisions) survive termination of this Agreement.
          </li>
        </ul>

        <h3 style={styles.subheading}>12.4 Reactivation</h3>
        <p style={styles.paragraph}>
          If you voluntarily deactivated your account, you may request reactivation within
          12 months without repeating the full onboarding process (subject to a current
          background check and verification that you still meet all requirements). After 12
          months, you must complete the full onboarding process again.
        </p>
      </section>

      {/* Section 13: Indemnification */}
      <section id="indemnification" style={styles.section}>
        <h2 style={styles.sectionTitle}>13. Indemnification</h2>
        <p style={styles.paragraph}>
          You agree to indemnify, defend, and hold harmless OpenRide Cooperative, Inc.,
          its officers, directors, employees, volunteers, and agents from and against any
          and all claims, demands, losses, liabilities, damages, costs, and expenses
          (including reasonable attorneys&apos; fees) arising out of or related to:
        </p>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            Your provision of transportation services through the Platform.
          </li>
          <li style={styles.listItem}>
            Your breach of this Agreement.
          </li>
          <li style={styles.listItem}>
            Your violation of any applicable law or regulation.
          </li>
          <li style={styles.listItem}>
            Your negligence, willful misconduct, or criminal activity.
          </li>
          <li style={styles.listItem}>
            Any dispute between you and a passenger arising from a ride.
          </li>
        </ul>
      </section>

      {/* Section 14: General Provisions */}
      <section id="general" style={styles.section}>
        <h2 style={styles.sectionTitle}>14. General Provisions</h2>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Governing Law:</strong> This Agreement shall be governed by the laws
            of [STATE/JURISDICTION], without regard to conflict of law principles.
          </li>
          <li style={styles.listItem}>
            <strong>Dispute Resolution:</strong> Disputes arising under this Agreement
            shall be resolved through the process described in the{' '}
            <a href="/terms#dispute-resolution" style={{ color: '#2E7D32' }}>
              Terms of Service, Section 14
            </a>{' '}
            (internal peer review, then mediation, then binding arbitration).
          </li>
          <li style={styles.listItem}>
            <strong>Entire Agreement:</strong> This Agreement, together with the Terms of
            Service and Privacy Policy, constitutes the entire agreement between you and
            OpenRide regarding your participation as a driver.
          </li>
          <li style={styles.listItem}>
            <strong>Severability:</strong> If any provision of this Agreement is found to
            be unenforceable, the remaining provisions shall continue in full force and
            effect.
          </li>
          <li style={styles.listItem}>
            <strong>Amendments:</strong> Material changes to this Agreement require
            approval through the OpenRide governance process. You will be notified at
            least 30 days before any changes take effect.
          </li>
          <li style={styles.listItem}>
            <strong>Waiver:</strong> The failure of either party to enforce any provision
            of this Agreement shall not constitute a waiver of that provision.
          </li>
          <li style={styles.listItem}>
            <strong>Assignment:</strong> You may not assign this Agreement without
            OpenRide&apos;s written consent. OpenRide may assign this Agreement to a
            successor cooperative through a governance vote.
          </li>
          <li style={styles.listItem}>
            <strong>Notices:</strong> All notices under this Agreement shall be sent to
            the email address associated with your account or through in-app notification.
          </li>
        </ul>

        {/* Contact */}
        <div
          style={{
            background: '#f8f9fb',
            border: '1px solid #e2e4ea',
            borderRadius: 8,
            padding: '20px 24px',
            fontSize: 15,
            lineHeight: 1.8,
            marginTop: 24,
          }}
        >
          <strong>Questions about this Agreement?</strong>
          <br />
          Email:{' '}
          <a href="mailto:drivers@openride.coop" style={{ color: '#2E7D32' }}>
            drivers@openride.coop
          </a>
          <br />
          General legal inquiries:{' '}
          <a href="mailto:legal@openride.coop" style={{ color: '#2E7D32' }}>
            legal@openride.coop
          </a>
          <br />
          <br />
          OpenRide Cooperative, Inc.
          <br />
          [STREET ADDRESS]
          <br />
          [CITY, STATE ZIP]
          <br />
          [COUNTRY]
        </div>
      </section>
    </div>
  );
}
