'use client';

import { useState } from 'react';
import './landing.css';

const passengerSteps = [
  {
    num: 1,
    icon: '\uD83D\uDCF1',
    title: 'Request a Ride',
    description: 'Open the app, enter your destination, and get matched with a nearby driver in seconds.',
  },
  {
    num: 2,
    icon: '\uD83D\uDE97',
    title: 'Enjoy the Ride',
    description: 'Track your driver in real-time, with upfront pricing and no hidden fees.',
  },
  {
    num: 3,
    icon: '\u2B50',
    title: 'Rate & Go',
    description: 'Rate your experience, see exactly where your fare went, and earn loyalty rewards.',
  },
];

const driverSteps = [
  {
    num: 1,
    icon: '\u270D\uFE0F',
    title: 'Sign Up',
    description: 'Quick background check and vehicle verification. Start driving within 48 hours.',
  },
  {
    num: 2,
    icon: '\uD83D\uDEE3\uFE0F',
    title: 'Drive Your Way',
    description: 'Set your own hours, choose your zones, and drive on your terms.',
  },
  {
    num: 3,
    icon: '\uD83D\uDCB0',
    title: 'Earn More',
    description: 'Keep 90-95% of every fare. Get weekly payouts plus quarterly surplus sharing.',
  },
];

const whyCards = [
  {
    icon: '\uD83D\uDCB5',
    iconBg: 'rgba(46, 125, 50, 0.15)',
    title: 'Keep 90-95% of Fares',
    description: 'Our cooperative model means minimal platform fees. Drivers keep the vast majority of what passengers pay.',
    highlight: 'vs. 70-75% on traditional platforms',
  },
  {
    icon: '\uD83C\uDFDB\uFE0F',
    iconBg: 'rgba(25, 118, 210, 0.15)',
    title: 'Community Governance',
    description: 'Every driver and rider gets a vote. Platform policies, fee structures, and major decisions are made democratically.',
    highlight: 'One member, one vote',
  },
  {
    icon: '\uD83D\uDD0D',
    iconBg: 'rgba(156, 39, 176, 0.15)',
    title: 'Transparent Finances',
    description: 'Every dollar in, every dollar out. Real-time financial dashboards let you see exactly how the platform operates.',
    highlight: 'Public financial reports',
  },
  {
    icon: '\uD83D\uDCC8',
    iconBg: 'rgba(245, 124, 0, 0.15)',
    title: 'Fair Surge Caps',
    description: 'Community-voted maximum surge multiplier of 1.5x. No exploitative pricing during emergencies or bad weather.',
    highlight: 'Max 1.5x surge cap',
  },
  {
    icon: '\uD83D\uDD04',
    iconBg: 'rgba(0, 150, 136, 0.15)',
    title: 'Surplus Redistribution',
    description: 'When the platform earns more than it needs to operate, the surplus goes back to members through quarterly paybacks.',
    highlight: 'Quarterly surplus sharing',
  },
  {
    icon: '\uD83D\uDD13',
    iconBg: 'rgba(233, 30, 99, 0.15)',
    title: 'Open Source',
    description: 'Our entire codebase is open source. Audit the algorithms, verify the math, contribute improvements.',
    highlight: 'Fully auditable code',
  },
];

const driverBenefits = [
  {
    title: 'Higher Take-Home Pay',
    description: 'With only a 5-10% platform fee, you keep significantly more of every fare.',
  },
  {
    title: 'Ownership Stake',
    description: 'As a cooperative member, you own part of the platform. Your voice matters.',
  },
  {
    title: 'Flexible Schedule',
    description: 'No minimum hours, no forced acceptance. Drive when and where you want.',
  },
  {
    title: 'Benefits Access',
    description: 'Group insurance rates, vehicle maintenance discounts, and retirement savings plans.',
  },
];

const passengerFeatures = [
  {
    icon: '\uD83D\uDCCA',
    title: 'Fare Breakdown',
    description: 'See exactly where your fare goes: driver earnings, platform costs, and insurance.',
  },
  {
    icon: '\uD83D\uDEE1\uFE0F',
    title: 'Safety First',
    description: 'Background-checked drivers, real-time trip sharing, and emergency SOS button.',
  },
  {
    icon: '\uD83C\uDF0D',
    title: 'Eco Options',
    description: 'Choose hybrid or electric vehicles. Carbon offset tracking for every trip.',
  },
  {
    icon: '\u2764\uFE0F',
    title: 'Community Impact',
    description: 'Every ride supports fair wages and community programs, not corporate shareholders.',
  },
];

const stats = [
  { value: '125K+', label: 'Rides Completed', sub: 'And counting' },
  { value: '8,400+', label: 'Drivers Onboarded', sub: 'Across 12 cities' },
  { value: '4.92', label: 'Avg Driver Rating', sub: 'Out of 5.0' },
  { value: '5-10%', label: 'Platform Fee', sub: 'Community-governed' },
];

const faqs = [
  {
    q: 'What is a cooperative ride-sharing platform?',
    a: 'A cooperative (co-op) is a business owned and governed by its members. Unlike traditional ride-sharing companies owned by shareholders and venture capitalists, OpenRide is owned by the people who use it: drivers and riders. This means decisions are made democratically, profits are shared equitably, and the platform exists to serve its community rather than maximize shareholder returns.',
  },
  {
    q: 'How is OpenRide different from Uber or Lyft?',
    a: 'The biggest differences are ownership and transparency. Uber and Lyft take 25-30% of every fare and are accountable to shareholders. OpenRide takes only 5-10%, and that money goes directly to platform operations. Our finances are fully transparent, our code is open source, and every member has a vote in how the platform is run.',
  },
  {
    q: 'How much do drivers actually keep?',
    a: 'Drivers on OpenRide keep 90-95% of every fare. On a $20 ride, a driver keeps $18-19 instead of the $14-15 they would keep on traditional platforms. Plus, drivers receive quarterly surplus distributions when the platform generates more revenue than it needs to operate.',
  },
  {
    q: 'How does community governance work?',
    a: 'Every verified member (driver or rider) can vote on platform proposals. This includes fee structure changes, surge pricing caps, new feature priorities, and budget allocations. Proposals are submitted by members, discussed openly, and voted on with a simple majority. One member equals one vote, regardless of how many rides they take or give.',
  },
  {
    q: 'Is OpenRide available in my city?',
    a: 'We are currently operating in select cities and expanding rapidly. Check our app for availability in your area, or sign up for our waitlist to be notified when we launch near you. Interested in bringing OpenRide to your city? Contact us about starting a local chapter.',
  },
  {
    q: 'How is the platform funded if fees are so low?',
    a: 'OpenRide operates on a lean, non-profit cooperative model. Our 5-10% platform fee covers server costs, insurance, payment processing, customer support, and ongoing development. We have no executive bonuses, no shareholder dividends, and no advertising spend. Any surplus beyond operating costs is returned to members.',
  },
  {
    q: 'Is the code really open source?',
    a: 'Yes, 100%. Our entire codebase is available on GitHub under the AGPL-3.0 license. You can audit the matching algorithm, verify the fare calculation, review the surge pricing logic, and even contribute improvements. Transparency is not just a value statement for us; it is how we operate.',
  },
];

export default function LandingPage() {
  const [hiwMode, setHiwMode] = useState('passenger');
  const [openFaq, setOpenFaq] = useState(null);

  const currentSteps = hiwMode === 'passenger' ? passengerSteps : driverSteps;

  return (
    <div>
      {/* =========== HERO =========== */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">
            <span className="landing-hero-badge-dot" />
            Open Source &middot; Community Owned &middot; Fully Transparent
          </div>

          <h1>
            Ride-Sharing,<br />
            <span>Owned by the Community</span>
          </h1>

          <p className="landing-hero-sub">
            OpenRide is a driver-owned cooperative ride-sharing platform. Transparent
            finances, democratic governance, and 90-95% of every fare goes directly
            to your driver.
          </p>

          <div className="landing-hero-actions">
            <a href="#get-started" className="landing-btn-primary">
              Download the App
            </a>
            <a href="#for-drivers" className="landing-btn-secondary">
              Become a Driver
            </a>
          </div>

          <div className="landing-hero-metrics">
            <div className="landing-hero-metric">
              <div className="landing-hero-metric-value">5-10%</div>
              <div className="landing-hero-metric-label">Platform fee</div>
            </div>
            <div className="landing-hero-metric">
              <div className="landing-hero-metric-value">125K+</div>
              <div className="landing-hero-metric-label">Rides completed</div>
            </div>
            <div className="landing-hero-metric">
              <div className="landing-hero-metric-value">$2.1M</div>
              <div className="landing-hero-metric-label">Returned to drivers</div>
            </div>
            <div className="landing-hero-metric">
              <div className="landing-hero-metric-value">4.92</div>
              <div className="landing-hero-metric-label">Average rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========== HOW IT WORKS =========== */}
      <section className="landing-section landing-section-gray" id="how-it-works">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-label">How It Works</span>
            <h2>Simple for Everyone</h2>
            <p>
              Whether you are requesting a ride or earning behind the wheel,
              OpenRide keeps things straightforward.
            </p>
          </div>

          <div className="landing-hiw-tabs">
            <button
              className={`landing-hiw-tab${hiwMode === 'passenger' ? ' active' : ''}`}
              onClick={() => setHiwMode('passenger')}
            >
              For Passengers
            </button>
            <button
              className={`landing-hiw-tab${hiwMode === 'driver' ? ' active' : ''}`}
              onClick={() => setHiwMode('driver')}
            >
              For Drivers
            </button>
          </div>

          <div className="landing-hiw-steps">
            {currentSteps.map((step) => (
              <div className="landing-hiw-step" key={step.num}>
                <span className="landing-hiw-step-icon">{step.icon}</span>
                <div className="landing-hiw-step-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== WHY OPENRIDE =========== */}
      <section className="landing-section landing-section-dark" id="why-openride">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-label">Why OpenRide?</span>
            <h2>Built Different, on Purpose</h2>
            <p>
              We are not another ride-sharing app. We are a movement to make
              transportation fair, transparent, and community-driven.
            </p>
          </div>

          <div className="landing-why-grid">
            {whyCards.map((card) => (
              <div className="landing-why-card" key={card.title}>
                <div
                  className="landing-why-card-icon"
                  style={{ background: card.iconBg }}
                >
                  {card.icon}
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="landing-why-card-highlight">{card.highlight}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== FOR DRIVERS =========== */}
      <section className="landing-section landing-section-light" id="for-drivers">
        <div className="landing-section-inner">
          <div className="landing-drivers-grid">
            <div className="landing-drivers-content">
              <span className="landing-section-label">For Drivers</span>
              <h2>Your Work, Your Worth</h2>
              <p>
                Stop subsidizing corporate profits. On OpenRide, you keep what you
                earn, own a piece of the platform, and have a real say in how
                things are run.
              </p>

              <div className="landing-drivers-benefits">
                {driverBenefits.map((b) => (
                  <div className="landing-drivers-benefit" key={b.title}>
                    <div className="landing-drivers-benefit-icon">{'\u2713'}</div>
                    <div className="landing-drivers-benefit-text">
                      <h4>{b.title}</h4>
                      <p>{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a href="#get-started" className="landing-btn-primary">
                Start Driving Today
              </a>
            </div>

            <div className="landing-earnings-card">
              <h3>Earnings Comparison</h3>
              <p className="landing-earnings-card-sub">
                Based on a $20 fare
              </p>

              <div className="landing-earnings-compare">
                <div className="landing-earnings-bar">
                  <div className="landing-earnings-bar-header">
                    <span className="landing-earnings-bar-label">OpenRide Driver</span>
                    <span className="landing-earnings-bar-value" style={{ color: '#2E7D32' }}>
                      $18.00 - $19.00
                    </span>
                  </div>
                  <div className="landing-earnings-bar-track">
                    <div
                      className="landing-earnings-bar-fill openride"
                      style={{ width: '92.5%' }}
                    />
                  </div>
                  <span className="landing-earnings-bar-note">90-95% of fare</span>
                </div>

                <div className="landing-earnings-bar">
                  <div className="landing-earnings-bar-header">
                    <span className="landing-earnings-bar-label">Traditional Platform Driver</span>
                    <span className="landing-earnings-bar-value" style={{ color: '#8888a0' }}>
                      $14.00 - $15.00
                    </span>
                  </div>
                  <div className="landing-earnings-bar-track">
                    <div
                      className="landing-earnings-bar-fill competitor"
                      style={{ width: '72.5%' }}
                    />
                  </div>
                  <span className="landing-earnings-bar-note">70-75% of fare</span>
                </div>

                <div style={{
                  marginTop: 12,
                  padding: '16px 20px',
                  background: '#E8F5E9',
                  borderRadius: 12,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#1B5E20', fontWeight: 600 }}>
                    OpenRide drivers earn up to
                  </div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: '#2E7D32',
                    letterSpacing: -1,
                    marginTop: 4,
                  }}>
                    $4,000+ more per year
                  </div>
                  <div style={{ fontSize: 12, color: '#5a5a7a', marginTop: 4 }}>
                    Based on average full-time driving hours
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========== FOR PASSENGERS =========== */}
      <section className="landing-section landing-section-dark" id="for-passengers">
        <div className="landing-section-inner">
          <div className="landing-passengers-grid">
            <div className="landing-passengers-features">
              {passengerFeatures.map((f) => (
                <div className="landing-passengers-feature" key={f.title}>
                  <span className="landing-passengers-feature-icon">{f.icon}</span>
                  <h4>{f.title}</h4>
                  <p>{f.description}</p>
                </div>
              ))}
            </div>

            <div className="landing-passengers-content">
              <span className="landing-section-label">For Passengers</span>
              <h2>Ride with Purpose</h2>
              <p>
                Same convenience, same reliability, but with full transparency into
                pricing and the knowledge that your fare supports fair wages, not
                corporate excess.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                marginBottom: 32,
              }}>
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                    Transparency Promise
                  </div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>
                    For every ride, you will see exactly how your fare is distributed:
                    driver earnings, platform operations, insurance, and community fund
                    contributions.
                  </div>
                </div>

                <div style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                    Surge Cap Guarantee
                  </div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>
                    Our community-voted surge cap means you will never pay more than
                    1.5x the base fare, even during peak hours.
                  </div>
                </div>
              </div>

              <a href="#get-started" className="landing-btn-primary">
                Start Riding
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========== STATS / SOCIAL PROOF =========== */}
      <section className="landing-section landing-section-gray" id="stats">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-label">Platform Metrics</span>
            <h2>Growing Every Day</h2>
            <p>
              Real numbers from a real community. All metrics are publicly
              verifiable on our{' '}
              <a href="/transparency" style={{ color: '#2E7D32', fontWeight: 600 }}>
                transparency dashboard
              </a>.
            </p>
          </div>

          <div className="landing-stats-grid">
            {stats.map((stat) => (
              <div className="landing-stat-item" key={stat.label}>
                <div className="landing-stat-value">{stat.value}</div>
                <div className="landing-stat-label">{stat.label}</div>
                <div className="landing-stat-sub">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== FAQ =========== */}
      <section className="landing-section landing-section-light" id="faq">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-label">FAQ</span>
            <h2>Common Questions</h2>
            <p>
              Everything you need to know about OpenRide and the cooperative model.
            </p>
          </div>

          <div className="landing-faq-list">
            {faqs.map((faq, idx) => (
              <div
                className={`landing-faq-item${openFaq === idx ? ' open' : ''}`}
                key={idx}
              >
                <button
                  className="landing-faq-question"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                >
                  <span>{faq.q}</span>
                  <span className="landing-faq-chevron">
                    {'\u25BE'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="landing-faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== CTA / GET STARTED =========== */}
      <section className="landing-cta" id="get-started">
        <div className="landing-cta-inner">
          <h2>Ready to Ride Different?</h2>
          <p>
            Join thousands of drivers and riders who believe transportation should
            be fair, transparent, and community-owned.
          </p>

          <div className="landing-cta-actions">
            <a href="#" className="landing-btn-primary">
              Download for iOS
            </a>
            <a href="#" className="landing-btn-primary" style={{ background: '#16213e' }}>
              Download for Android
            </a>
          </div>

          <p className="landing-cta-trust">
            No credit card required &middot; Free to join &middot; Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
}
