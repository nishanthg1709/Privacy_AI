import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X, LayoutDashboard } from 'lucide-react';
import ShieldKeyholeIcon from './ShieldKeyholeIcon';
import { useAuth } from '../context/useAuth';
import Button from './Button';

/**
 * Editorial Landing Page Navbar
 * Features minimalist typography, brand mark, navigation anchors,
 * mobile drawer, and dynamic auth state.
 */
export default function Navbar() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', href: '#hero' },
    { label: 'About', href: '#about' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Contact', href: '#contact' },
  ];

  const handleScrollTo = (e, id) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <header
        className={`pg-editorial-nav ${isScrolled ? 'pg-nav-scrolled' : ''}`}
        aria-label="Main Navigation"
      >
        <div className="pg-nav-inner">
          {/* Brand Mark with Refined Shield-and-Keyhole */}
          <Link to="/" className="pg-brand-link">
            <div className="pg-brand-symbol">
              <ShieldKeyholeIcon size={18} />
            </div>
            <div className="pg-brand-title-wrap">
              <span className="pg-brand-title">PrivacyGuard</span>
              <span className="pg-brand-edition">AI</span>
            </div>
          </Link>

          {/* Desktop Nav Links matching Reference Panel 1 */}
          <nav className="pg-nav-desktop-links" aria-label="Sections">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleScrollTo(e, link.href)}
                className="pg-nav-anchor"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Auth Actions matching Reference Panel 1 */}
          <div className="pg-nav-desktop-actions">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                icon={LayoutDashboard}
                onClick={() => navigate('/app/dashboard')}
              >
                Workspace ({user?.name?.split(' ')[0] || 'User'})
              </Button>
            ) : (
              <>
                <Link to="/login" className="pg-nav-login-link">
                  Sign In
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  iconAfter={ArrowRight}
                  onClick={() => navigate('/signup')}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="pg-nav-mobile-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="pg-mobile-nav-drawer" role="dialog" aria-modal="true">
          <div className="pg-mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="pg-mobile-nav-content">
            <div className="pg-mobile-nav-header">
              <span className="pg-brand-title">PrivacyGuard AI</span>
              <button
                type="button"
                className="pg-mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="pg-mobile-nav-list">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleScrollTo(e, link.href)}
                  className="pg-mobile-nav-anchor"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="pg-mobile-nav-auth">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="md"
                  icon={LayoutDashboard}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/app/dashboard');
                  }}
                  className="pg-w-full"
                >
                  Enter Workspace
                </Button>
              ) : (
                <div className="pg-mobile-auth-stack">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/signup');
                    }}
                    className="pg-w-full"
                  >
                    Create Account
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/login');
                    }}
                    className="pg-w-full"
                  >
                    Log In
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
