import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import planetImg from '../assets/planet-security-horizon.jpg';
import gatewayImg from '../assets/signup-gateway-trail.jpg';

/**
 * Editorial AuthLayout Component
 * Supports both:
 * - variant="centered" (Login page, matching Reference Panel 2)
 * - variant="split" (Signup page, matching Reference Panel 3)
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  variant = 'centered',
}) {
  if (variant === 'centered') {
    return (
      <div className="pg-auth-centered-root">
        {/* Background Artwork */}
        <div
          className="pg-auth-bg-horizon"
          style={{ backgroundImage: `url(${planetImg})` }}
          aria-hidden="true"
        />
        <div className="pg-auth-bg-overlay" aria-hidden="true" />

        {/* Top Branding Header */}
        <header className="pg-auth-top-header">
          <Link to="/" className="pg-brand-link">
            <div className="pg-brand-symbol">
              <Shield size={18} strokeWidth={2.2} />
            </div>
            <div className="pg-brand-title-wrap">
              <span className="pg-brand-title">PrivacyGuard</span>
              <span className="pg-brand-edition">AI</span>
            </div>
          </Link>

          <Link to="/" className="pg-auth-return-link">
            <ArrowLeft size={14} />
            <span>Return to Home</span>
          </Link>
        </header>

        {/* Centered Floating Card */}
        <main className="pg-auth-centered-container">
          <div className="pg-auth-centered-card">
            <div className="pg-auth-form-header">
              <h1 className="pg-auth-title">{title}</h1>
              {subtitle && <p className="pg-auth-subtitle">{subtitle}</p>}
            </div>
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Split variant for Signup (Panel 3)
  return (
    <div className="pg-auth-split-root">
      {/* Left Column: Form Panel */}
      <div className="pg-auth-split-form-panel">
        <header className="pg-auth-split-header">
          <Link to="/" className="pg-brand-link">
            <div className="pg-brand-symbol">
              <Shield size={18} strokeWidth={2.2} />
            </div>
            <div className="pg-brand-title-wrap">
              <span className="pg-brand-title">PrivacyGuard</span>
              <span className="pg-brand-edition">AI</span>
            </div>
          </Link>
        </header>

        <main className="pg-auth-split-form-container">
          <div className="pg-auth-form-header">
            <h1 className="pg-auth-title">{title}</h1>
            {subtitle && <p className="pg-auth-subtitle">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>

      {/* Right Column: Monumental Gateway Artwork (Matching Reference Panel 3) */}
      <div className="pg-auth-split-visual-panel" aria-hidden="true">
        <img
          src={gatewayImg}
          alt="Monochrome security gateway with glowing pathway"
          className="pg-auth-gateway-img"
        />
        <div className="pg-auth-split-visual-overlay" />
      </div>
    </div>
  );
}
