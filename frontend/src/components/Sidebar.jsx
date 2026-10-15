import {
  Home,
  Scan,
  History,
  BarChart3,
  FileCheck2,
  Settings,
  Shield,
  X,
  LogOut,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Editorial Sidebar Component
 * Near-black background, hairline cream borders, active-state indicator,
 * and user session summary with quick logout.
 */
export default function Sidebar({
  currentPage,
  onNavigate,
  isMobileOpen,
  onCloseMobile,
  onShowSpecs,
  onLogout,
  user
}) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: Home,
      badge: null,
      description: 'Overview & quick actions',
    },
    {
      id: 'scanner',
      label: 'Privacy Scanner',
      icon: Scan,
      badge: 'Core',
      badgeColor: 'cream',
      description: 'Payload minimization studio',
    },
    {
      id: 'results',
      label: 'Diff Inspection',
      icon: FileCheck2,
      badge: 'Preview',
      badgeColor: 'subtle',
      description: 'Side-by-side verification',
    },
    {
      id: 'history',
      label: 'Scan History',
      icon: History,
      badge: null,
      description: 'Verifiable audit records',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
      description: 'Usage & category telemetry',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null,
      description: 'Minimization defaults',
    },
  ];

  const handleNavClick = (pageId) => {
    onNavigate(pageId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="pg-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`pg-editorial-sidebar ${isMobileOpen ? 'pg-sidebar-open' : ''}`}
        aria-label="Workspace Navigation"
      >
        {/* Brand Header */}
        <div className="pg-sidebar-brand">
          <Link to="/" className="pg-sidebar-brand-link" title="Return to Home">
            <div className="pg-brand-symbol">
              <Shield size={18} strokeWidth={2.2} />
            </div>
            <div className="pg-sidebar-brand-text">
              <span className="pg-brand-title">PrivacyGuard</span>
              <span className="pg-brand-edition">AI</span>
            </div>
          </Link>

          {onCloseMobile && (
            <button
              type="button"
              className="pg-sidebar-close-btn"
              onClick={onCloseMobile}
              aria-label="Close navigation drawer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Workspace Label & Status */}
        <div className="pg-sidebar-status-box">
          <div className="pg-status-indicator-group">
            <span className="pg-pulse-dot" aria-hidden="true"></span>
            <span className="pg-sidebar-status-title">Privacy Workspace</span>
          </div>
          <span className="pg-sidebar-status-pill">Active</span>
        </div>

        {/* Navigation Items */}
        <nav className="pg-sidebar-nav">
          <ul className="pg-sidebar-nav-list" role="list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <li key={item.id} className="pg-sidebar-nav-item">
                  <button
                    type="button"
                    className={`pg-sidebar-nav-link ${isActive ? 'pg-sidebar-link-active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="pg-nav-icon-wrap">
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="pg-nav-label-stack">
                      <span className="pg-nav-label">{item.label}</span>
                      <span className="pg-nav-description">{item.description}</span>
                    </span>

                    {item.badge && (
                      <span className={`pg-sidebar-badge pg-badge-${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}

                    {isActive && <ChevronRight size={13} className="pg-nav-active-arrow" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer matching reference panel 4 */}
        <div className="pg-sidebar-footer">
          <div className="pg-sidebar-utility-links">
            {onShowSpecs && (
              <button
                type="button"
                className="pg-sidebar-util-btn"
                onClick={onShowSpecs}
                title="PrivacyGuard AI Architecture & Help"
              >
                <HelpCircle size={16} />
                <span>Help</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                className="pg-sidebar-util-btn pg-util-logout"
                onClick={onLogout}
                title="Sign out of workspace session"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            )}
          </div>

          {/* User Profile Bar */}
          <div className="pg-sidebar-user-card">
            <div className="pg-user-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
            </div>
            <div className="pg-user-details">
              <span className="pg-user-name">{user?.name || (user?.email ? user.email.split('@')[0] : 'Security Officer')}</span>
              <span className="pg-user-role">{user?.role || 'Security Officer'}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
