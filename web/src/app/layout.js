import './globals.css';

export const metadata = {
  title: 'OpenRide — Community-Owned Ride Sharing',
  description: 'Transparent, community-governed ride-sharing platform. View real-time platform data, financial reports, and governance proposals.',
};

const navItems = [
  { href: '/',              label: 'Dashboard',     icon: '\u25A3', section: 'public' },
  { href: '/transparency',  label: 'Transparency',  icon: '\u25C8', section: 'public' },
  { href: '/governance',    label: 'Governance',    icon: '\u2691', section: 'public' },
  { href: '/disputes',      label: 'Disputes',      icon: '\u2696', section: 'manage' },
  { href: '/admin',         label: 'Admin',         icon: '\u2699', section: 'manage' },
];

export default function RootLayout({ children }) {
  const publicLinks = navItems.filter((n) => n.section === 'public');
  const manageLinks = navItems.filter((n) => n.section === 'manage');

  return (
    <html lang="en">
      <head />
      <body>
        <div className="layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">OR</div>
              <div>
                <div className="sidebar-logo-text">OpenRide</div>
                <div className="sidebar-logo-sub">Community Platform</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <div className="sidebar-section-label">Public</div>
              {publicLinks.map((item) => (
                <a key={item.href} href={item.href} className="sidebar-link">
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </a>
              ))}

              <div className="sidebar-section-label" style={{ marginTop: 12 }}>Management</div>
              {manageLinks.map((item) => (
                <a key={item.href} href={item.href} className="sidebar-link">
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="sidebar-footer">
              OpenRide v1.0 &mdash; Open Source
            </div>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
