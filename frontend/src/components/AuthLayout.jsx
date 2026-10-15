import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

/**
 * Editorial AuthLayout Component
 * Two-column asymmetrical composition for login and signup pages.
 * Features an editorial quote and brand manifesto on the left,
 * with clean, focused auth forms on the right.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  sideQuote = 'True enterprise AI adoption requires sovereign data guardrails.',
  sideAuthor = 'PrivacyGuard AI Architecture Whitepaper',
}) {
  return (
    <div className="pg-auth-root">
      {/* Left Column: Editorial Brand Panel (Desktop) */}
      <div className="pg-auth-brand-panel">
        <div className="pg-auth-panel-inner">
          <Link to="/" className="pg-auth-back-link">
            <ArrowLeft size={16} />
            <span>Return to PrivacyGuard AI</span>
          </Link>

          <div className="pg-auth-panel-hero">
            <div className="pg-auth-brand-mark">
              <Shield size={24} strokeWidth={2} />
              <span className="pg-auth-brand-name">PrivacyGuard AI</span>
            </div>

            <blockquote className="pg-auth-quote">
              &ldquo;{sideQuote}&rdquo;
            </blockquote>

            <cite className="pg-auth-cite">— {sideAuthor}</cite>
          </div>

          <div className="pg-auth-panel-footer">
            <div className="pg-auth-pill">
              <span className="pg-pulse-dot"></span>
              <span>Zero-Log Authentication Gateway</span>
            </div>
            <p className="pg-auth-notice">
              Protected by Supabase Auth with Row Level Security. Telemetry strictly adheres to zero-log policies.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Form */}
      <div className="pg-auth-form-panel">
        <div className="pg-auth-form-wrapper">
          <div className="pg-auth-mobile-header">
            <Link to="/" className="pg-auth-mobile-brand">
              <Shield size={20} />
              <span>PrivacyGuard AI</span>
            </Link>
          </div>

          <div className="pg-auth-form-header">
            <h1 className="pg-auth-title">{title}</h1>
            {subtitle && <p className="pg-auth-subtitle">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
