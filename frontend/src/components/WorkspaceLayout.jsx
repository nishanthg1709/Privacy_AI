import { useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Shield,
  Scan,
  LogOut,
  X,
  CheckCircle2,
  AlertCircle,
  Home,
  ChevronDown,
  Search,
  Bell
} from 'lucide-react';
import Sidebar from './Sidebar';
import Button from './Button';
import { useAuth } from '../context/useAuth';
import planetHorizonImg from '../assets/planet-security-horizon.jpg';

/**
 * Reusable Editorial WorkspaceLayout Component
 * Provides unified sidebar, top navigation, user dropdown, logout,
 * mobile drawer, and outlet for dashboard, scanner, results, history, settings.
 */
export default function WorkspaceLayout({
  toast,
  setToast,
  settings
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  // Compute active page id from pathname
  const currentPath = location.pathname;
  let currentPageId = 'dashboard';
  if (currentPath.includes('/scanner')) currentPageId = 'scanner';
  else if (currentPath.includes('/results')) currentPageId = 'results';
  else if (currentPath.includes('/history')) currentPageId = 'history';
  else if (currentPath.includes('/analytics')) currentPageId = 'analytics';
  else if (currentPath.includes('/settings')) currentPageId = 'settings';

  const handleNavigate = (pageId) => {
    navigate(`/app/${pageId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/app/history', { state: { search: searchQuery.trim() } });
    }
  };

  const handleLogout = () => {
    logout();
    if (setToast) {
      setToast({ message: 'Logged out successfully. Returning to home.', type: 'info' });
    }
    navigate('/');
  };

  return (
    <div className={`pg-workspace-root ${settings?.compactMode ? 'pg-compact-mode' : ''}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPageId}
        onNavigate={handleNavigate}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onShowSpecs={() => setShowSpecsModal(true)}
        onLogout={handleLogout}
        user={user}
      />

      {/* Main Column Wrapper */}
      <div className="pg-workspace-main">
        {/* Atmospheric Cinematic Workspace Background Stage */}
        <div className="pg-workspace-bg-stage" aria-hidden="true">
          {/* Layer 1: Ambient Radial Gradients (Slowly Moving Atmospheric Spotlights) */}
          <div className="pg-workspace-ambient-light light-primary" />
          <div className="pg-workspace-ambient-light light-secondary" />

          {/* Layer 2: Animated Cybernetic Security Mesh Grid */}
          <div className="pg-workspace-mesh-grid" />

          {/* Layer 3: Atmospheric Space Horizon Silhouette */}
          <div
            className="pg-workspace-horizon-silhouette"
            style={{ backgroundImage: `url(${planetHorizonImg})` }}
          />

          {/* Layer 4: Floating Security Data Particles */}
          <div className="pg-workspace-particles">
            <span className="pg-ws-particle p1" />
            <span className="pg-ws-particle p2" />
            <span className="pg-ws-particle p3" />
            <span className="pg-ws-particle p4" />
            <span className="pg-ws-particle p5" />
            <span className="pg-ws-particle p6" />
          </div>

          {/* Layer 5: Subtle Vignette Overlay for Atmospheric Depth */}
          <div className="pg-workspace-vignette" />
        </div>

        {/* Workspace Topbar */}
        <header className="pg-workspace-topbar">
          <div className="pg-topbar-left">
            <button
              type="button"
              className="pg-mobile-toggle-btn"
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              aria-label="Toggle navigation drawer"
            >
              <Menu size={20} />
            </button>

            <div className="pg-topbar-breadcrumb">
              <Link to="/" className="pg-crumb-home" title="Return to Landing Page">
                <Home size={14} />
              </Link>
              <span className="pg-crumb-sep">/</span>
              <span className="pg-crumb-tenant">Workspace</span>
              <span className="pg-crumb-sep">/</span>
              <span className="pg-crumb-current">
                {currentPageId === 'dashboard' && 'Your Workspace'}
                {currentPageId === 'scanner' && 'Privacy Scanner'}
                {currentPageId === 'results' && 'Scan Results'}
                {currentPageId === 'history' && 'Scan History'}
                {currentPageId === 'analytics' && 'Analytics'}
                {currentPageId === 'settings' && 'Settings'}
              </span>
            </div>
          </div>

          <div className="pg-topbar-center pg-hide-mobile">
            {/* Real Search Bar matching reference Panel 4 */}
            <form onSubmit={handleSearchSubmit} className="pg-topbar-search-form">
              <Search size={15} className="pg-search-icon" />
              <input
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pg-topbar-search-input"
                aria-label="Search scan history"
              />
            </form>
          </div>

          <div className="pg-topbar-right">
            {/* Notification Bell matching reference */}
            <div className="pg-notif-wrap">
              <button
                type="button"
                className="pg-topbar-icon-btn"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={17} />
              </button>

              {notifOpen && (
                <>
                  <div className="pg-dropdown-backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="pg-notif-dropdown" role="region" aria-label="Notifications list">
                    <div className="pg-notif-header">
                      <span className="pg-notif-title">Notifications</span>
                      <span className="pg-mono-badge">System</span>
                    </div>
                    <div className="pg-notif-content">
                      <div className="pg-notif-item">
                        <CheckCircle2 size={14} />
                        <div>
                          <p className="pg-notif-text">GLiNER + Presidio engine active</p>
                          <span className="pg-notif-time">In-memory CPU inference ready</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {currentPageId !== 'scanner' && (
              <Button
                variant="primary"
                size="sm"
                icon={Scan}
                onClick={() => handleNavigate('scanner')}
              >
                New Scan
              </Button>
            )}

            {/* User Dropdown Menu */}
            <div className="pg-user-dropdown-wrap">
              <button
                type="button"
                className="pg-user-menu-trigger"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-label="User account menu"
              >
                <div className="pg-user-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'N')}
                </div>
                <div className="pg-user-menu-text pg-hide-mobile">
                  <span className="pg-user-menu-name">{user?.name || (user?.email ? user.email.split('@')[0] : 'Nishanth')}</span>
                </div>
                <ChevronDown size={14} className="pg-text-cream-subtle" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="pg-dropdown-backdrop"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="pg-user-dropdown-menu" role="menu">
                    <div className="pg-dropdown-header">
                      <div className="pg-dropdown-user-name">{user?.name || (user?.email ? user.email.split('@')[0] : 'Security Officer')}</div>
                      <div className="pg-dropdown-user-email">{user?.email || 'Authenticated User'}</div>
                      <div className="pg-dropdown-badge">{user?.email ? 'Supabase Authenticated' : 'Active Session'}</div>
                    </div>

                    <div className="pg-dropdown-divider" />

                    <button
                      type="button"
                      role="menuitem"
                      className="pg-dropdown-item"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleNavigate('settings');
                      }}
                    >
                      Workspace Settings
                    </button>

                    <Link
                      to="/"
                      role="menuitem"
                      className="pg-dropdown-item"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Landing Page
                    </Link>

                    <div className="pg-dropdown-divider" />

                    <button
                      type="button"
                      role="menuitem"
                      className="pg-dropdown-item pg-dropdown-item-danger"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Toast Alert */}
        {toast && (
          <aside className="pg-toast-container" aria-live="polite">
            <div className={`pg-toast pg-toast-${toast.type || 'info'}`}>
              {toast.type === 'success' ? (
                <CheckCircle2 size={17} className="pg-text-cream" />
              ) : (
                <AlertCircle size={17} className="pg-text-cream" />
              )}
              <span className="pg-toast-message">{toast.message}</span>
              <button
                type="button"
                className="pg-toast-close"
                onClick={() => setToast(null)}
                aria-label="Dismiss alert"
              >
                <X size={14} />
              </button>
            </div>
          </aside>
        )}

        {/* Content Outlet */}
        <main className="pg-workspace-content" id="workspace-main">
          <Outlet />
        </main>
      </div>

      {/* Architecture Specs Modal */}
      {showSpecsModal && (
        <div className="pg-modal-backdrop" onClick={() => setShowSpecsModal(false)}>
          <div
            className="pg-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="pg-modal-header">
              <div className="pg-modal-title-group">
                <Shield size={20} />
                <h2>PrivacyGuard AI — Architecture Status</h2>
              </div>
              <button
                type="button"
                className="pg-modal-close"
                onClick={() => setShowSpecsModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="pg-modal-body">
              <div className="pg-milestone-step">
                <span className="pg-step-badge pg-step-current">Local AI Engine</span>
                <h4>GLiNER + Presidio Neural Detection Pipeline</h4>
                <p>
                  Contextual entity detection powered by local GLiNER (<code>urchade/gliner_small-v2.1</code>)
                  coupled with Microsoft Presidio and deterministic credential recognizers running entirely on CPU.
                </p>
              </div>

              <div className="pg-milestone-step">
                <span className="pg-step-badge pg-step-current">Zero-Log Architecture</span>
                <h4>In-Memory Sanitization &amp; Privacy Verification</h4>
                <p>
                  Documents are processed in-memory. Original text, protected text, and detected PII values are never
                  persisted to database storage or logged to disk.
                </p>
              </div>

              <div className="pg-milestone-step">
                <span className="pg-step-badge pg-step-current">Security &amp; Compliance</span>
                <h4>Supabase Auth &amp; Row Level Security</h4>
                <p>
                  Telemetry records are restricted strictly to authenticated owners using PostgreSQL Row Level Security
                  policies (<code>auth.uid() = user_id</code>).
                </p>
              </div>
            </div>

            <div className="pg-modal-footer">
              <span className="pg-text-muted-sm">All detection and minimization executes locally on your machine.</span>
              <Button variant="primary" size="sm" onClick={() => setShowSpecsModal(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
