import '../globals.css';

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',     icon: '\u25A3', section: 'public' },
  { href: '/transparency',  label: 'Transparency',  icon: '\u25C8', section: 'public' },
  { href: '/governance',    label: 'Governance',    icon: '\u2691', section: 'public' },
  { href: '/vehicles',      label: 'Vehicles',      icon: '\u25CE', section: 'public' },
  { href: '/scheduling',    label: 'Schedule',      icon: '\u29D6', section: 'manage' },
  { href: '/chat',          label: 'Chat',          icon: '\u2709', section: 'manage' },
  { href: '/referrals',     label: 'Referrals',     icon: '\u2606', section: 'manage' },
  { href: '/disputes',      label: 'Disputes',      icon: '\u2696', section: 'manage' },
  { href: '/admin',         label: 'Admin',         icon: '\u2699', section: 'manage' },
];

export default function DashboardLayout({ children }) {
  const publicLinks = navItems.filter((n) => n.section === 'public');
  const manageLinks = navItems.filter((n) => n.section === 'manage');

  return (
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
  );
}
