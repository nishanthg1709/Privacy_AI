import { Shield, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Editorial Footer Component
 * Minimal hairline borders, cream typography, compliance readiness chips,
 * and transparent milestone status.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="pg-editorial-footer" role="contentinfo">
      <div className="pg-footer-container">
        {/* Top Editorial Row */}
        <div className="pg-footer-top-grid">
          <div className="pg-footer-brand-col">
            <div className="pg-footer-brand">
              <div className="pg-brand-symbol">
                <Shield size={18} strokeWidth={2.2} />
              </div>
              <span className="pg-brand-title">PrivacyGuard AI</span>
            </div>
            <p className="pg-footer-tagline">
              Autonomous data minimization, context-preserving synthetic anonymization, and
              verifiable compliance for modern enterprise LLM pipelines.
            </p>
            <div className="pg-footer-compliance-badges">
              <span className="pg-compliance-chip">GDPR Art. 25</span>
              <span className="pg-compliance-chip">HIPAA Safe Harbor</span>
              <span className="pg-compliance-chip">Zero-Retention Gateway</span>
            </div>
          </div>

          <div className="pg-footer-nav-col">
            <h4 className="pg-footer-nav-title">Architecture</h4>
            <ul className="pg-footer-nav-list">
              <li><a href="#about" className="pg-footer-nav-link">Design Philosophy</a></li>
              <li><a href="#features" className="pg-footer-nav-link">Entity Detection Models</a></li>
              <li><a href="#workflow" className="pg-footer-nav-link">Synthetic Redaction Engine</a></li>
              <li><a href="#how-it-works" className="pg-footer-nav-link">Latency Benchmarks</a></li>
            </ul>
          </div>

          <div className="pg-footer-nav-col">
            <h4 className="pg-footer-nav-title">Workspace</h4>
            <ul className="pg-footer-nav-list">
              <li><Link to="/app/dashboard" className="pg-footer-nav-link">Dashboard</Link></li>
              <li><Link to="/app/scanner" className="pg-footer-nav-link">Privacy Scanner</Link></li>
              <li><Link to="/app/results" className="pg-footer-nav-link">Diff Inspection</Link></li>
              <li><Link to="/app/history" className="pg-footer-nav-link">Audit Trail Records</Link></li>
              <li><Link to="/app/settings" className="pg-footer-nav-link">Policy Tuning</Link></li>
            </ul>
          </div>

          <div className="pg-footer-nav-col">
            <h4 className="pg-footer-nav-title">Access</h4>
            <ul className="pg-footer-nav-list">
              <li><Link to="/login" className="pg-footer-nav-link">Enterprise Sign In</Link></li>
              <li><Link to="/signup" className="pg-footer-nav-link">Create Account</Link></li>
              <li>
                <a
                  href="https://github.com/nishanthg1709/Prg_AI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pg-footer-nav-link pg-footer-link-external"
                >
                  <span>GitHub Repository</span>
                  <ArrowUpRight size={13} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="pg-footer-bottom">
          <div className="pg-footer-copyright">
            &copy; {currentYear} PrivacyGuard AI. All rights reserved. Built for sovereign AI governance.
          </div>
          <div className="pg-footer-notice">
            <span>Document processing and entity detection run locally. Telemetry complies with zero-log privacy standards.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
