'use client';

import { useState, useEffect } from 'react';

export default function PublicLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#why-openride', label: 'Why OpenRide' },
    { href: '#for-drivers', label: 'For Drivers' },
    { href: '#for-passengers', label: 'For Passengers' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <>
      <style>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html {
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          scroll-behavior: smooth;
        }

        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a2e;
          line-height: 1.6;
          overflow-x: hidden;
          background: #ffffff;
        }

        a {
          text-decoration: none;
          color: inherit;
        }

        .pub-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 0 24px;
          transition: background 0.3s ease, backdrop-filter 0.3s ease, border-bottom 0.3s ease;
        }

        .pub-nav.scrolled {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .pub-nav:not(.scrolled) {
          background: transparent;
        }

        .pub-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
        }

        .pub-nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .pub-nav-logo-icon {
          width: 38px;
          height: 38px;
          background: #2E7D32;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .pub-nav-logo-text {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .pub-nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
          list-style: none;
        }

        .pub-nav-links a {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.75);
          transition: color 0.2s;
          text-decoration: none;
        }

        .pub-nav-links a:hover {
          color: #fff;
        }

        .pub-nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pub-nav-signin {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.85);
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s;
          border: none;
          background: none;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }

        .pub-nav-signin:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
        }

        .pub-nav-cta {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #2E7D32;
          padding: 9px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-block;
        }

        .pub-nav-cta:hover {
          background: #1B5E20;
        }

        .pub-nav-mobile-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          color: #fff;
          font-size: 24px;
          line-height: 1;
        }

        .pub-mobile-menu {
          display: none;
          position: fixed;
          top: 72px;
          left: 0;
          right: 0;
          background: rgba(26, 26, 46, 0.98);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 16px 24px 24px;
          z-index: 999;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-direction: column;
          gap: 4px;
        }

        .pub-mobile-menu.open {
          display: flex;
        }

        .pub-mobile-menu a {
          display: block;
          padding: 12px 16px;
          color: rgba(255,255,255,0.8);
          font-size: 15px;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s;
          text-decoration: none;
        }

        .pub-mobile-menu a:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }

        .pub-mobile-actions {
          display: flex;
          gap: 12px;
          margin-top: 12px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .pub-mobile-actions a {
          flex: 1;
          text-align: center;
        }

        /* Footer */
        .pub-footer {
          background: #0d0d1a;
          color: rgba(255,255,255,0.6);
          padding: 64px 24px 32px;
        }

        .pub-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        .pub-footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 48px;
        }

        .pub-footer-brand h3 {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pub-footer-brand p {
          font-size: 14px;
          line-height: 1.7;
          max-width: 320px;
        }

        .pub-footer-social {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .pub-footer-social a {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s;
          color: rgba(255,255,255,0.6);
          text-decoration: none;
        }

        .pub-footer-social a:hover {
          background: #2E7D32;
          color: #fff;
        }

        .pub-footer-col h4 {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 20px;
        }

        .pub-footer-col ul {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pub-footer-col a {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
          transition: color 0.2s;
          text-decoration: none;
        }

        .pub-footer-col a:hover {
          color: #fff;
        }

        .pub-footer-bottom {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }

        .pub-footer-bottom-links {
          display: flex;
          gap: 24px;
        }

        .pub-footer-bottom-links a {
          color: rgba(255,255,255,0.4);
          transition: color 0.2s;
          text-decoration: none;
        }

        .pub-footer-bottom-links a:hover {
          color: rgba(255,255,255,0.8);
        }

        @media (max-width: 768px) {
          .pub-nav-links {
            display: none;
          }

          .pub-nav-actions {
            display: none;
          }

          .pub-nav-mobile-toggle {
            display: block;
          }

          .pub-footer-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          .pub-footer-bottom {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }
        }
      `}</style>

      {/* Navigation */}
      <nav className={`pub-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="pub-nav-inner">
          <a href="/" className="pub-nav-logo">
            <div className="pub-nav-logo-icon">OR</div>
            <span className="pub-nav-logo-text">OpenRide</span>
          </a>

          <ul className="pub-nav-links">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>

          <div className="pub-nav-actions">
            <a href="/dashboard" className="pub-nav-signin">Sign In</a>
            <a href="#get-started" className="pub-nav-cta">Get Started</a>
          </div>

          <button
            className="pub-nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '\u2715' : '\u2630'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`pub-mobile-menu${mobileMenuOpen ? ' open' : ''}`}>
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMobileMenuOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <div className="pub-mobile-actions">
          <a href="/dashboard" className="pub-nav-signin">Sign In</a>
          <a href="#get-started" className="pub-nav-cta">Get Started</a>
        </div>
      </div>

      {/* Page Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="pub-footer">
        <div className="pub-footer-inner">
          <div className="pub-footer-grid">
            <div className="pub-footer-brand">
              <h3>
                <span style={{
                  width: 32,
                  height: 32,
                  background: '#2E7D32',
                  borderRadius: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#fff',
                }}>OR</span>
                OpenRide
              </h3>
              <p>
                Community-owned ride sharing. By drivers, for riders.
                Transparent finances, democratic governance, and fair
                compensation for everyone.
              </p>
              <div className="pub-footer-social">
                <a href="#" aria-label="Twitter">X</a>
                <a href="#" aria-label="GitHub">GH</a>
                <a href="#" aria-label="Discord">DC</a>
                <a href="#" aria-label="LinkedIn">LI</a>
              </div>
            </div>

            <div className="pub-footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#for-drivers">For Drivers</a></li>
                <li><a href="#for-passengers">For Passengers</a></li>
                <li><a href="/transparency">Transparency</a></li>
                <li><a href="/governance">Governance</a></li>
              </ul>
            </div>

            <div className="pub-footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Press Kit</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>

            <div className="pub-footer-col">
              <h4>Resources</h4>
              <ul>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">Open Source</a></li>
                <li><a href="#">Community</a></li>
                <li><a href="#">Support</a></li>
              </ul>
            </div>
          </div>

          <div className="pub-footer-bottom">
            <span>&copy; 2026 OpenRide Cooperative. All rights reserved.</span>
            <div className="pub-footer-bottom-links">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
