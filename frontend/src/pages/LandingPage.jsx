import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import Navbar from '../components/Navbar';
import FeatureSection from '../components/FeatureSection';
import Footer from '../components/Footer';
import Button from '../components/Button';

/**
 * Editorial Landing Page
 * Features oversized bold typography, cream on near-black contrast,
 * sophisticated asymmetrical layouts, and complete narrative flow.
 */
export default function LandingPage() {
  return (
    <div className="pg-landing-root">
      <Navbar />

      {/* Hero Section */}
      <section id="hero" className="pg-hero-section" aria-label="PrivacyGuard AI Overview">
        <div className="pg-hero-container">
          <div className="pg-hero-tagline-wrap">
            <span className="pg-hero-tagline-badge">
              <ShieldCheck size={14} className="pg-text-cream" />
              <span>Autonomous Data Minimization for Generative AI</span>
            </span>
          </div>

          <h1 className="pg-hero-giant-headline">
            Zero PII in prompts. <br className="pg-hero-br" />
            <em className="pg-headline-em">Total context</em> retained.
          </h1>

          <p className="pg-hero-lead-text">
            Protect confidential customer records, developer secrets, and regulated PII before
            prompts and files reach public or private LLM inference endpoints. Without destroying
            conversational intelligence.
          </p>

          <div className="pg-hero-cta-group">
            <Link to="/signup">
              <Button variant="primary" size="lg" iconAfter={ArrowRight}>
                Get Started Free
              </Button>
            </Link>
            <a href="#about" className="pg-hero-secondary-action">
              <Button variant="outline" size="lg" icon={ChevronDown}>
                Read Philosophy
              </Button>
            </a>
          </div>

          {/* Editorial Metric Strip */}
          <div className="pg-hero-metric-strip">
            <div className="pg-metric-cell">
              <span className="pg-metric-value">&lt; 15ms</span>
              <span className="pg-metric-label">Minimization Latency Target</span>
            </div>
            <div className="pg-metric-divider"></div>
            <div className="pg-metric-cell">
              <span className="pg-metric-value">40+</span>
              <span className="pg-metric-label">PII, HIPAA &amp; Secret Categories</span>
            </div>
            <div className="pg-metric-divider"></div>
            <div className="pg-metric-cell">
              <span className="pg-metric-value">100%</span>
              <span className="pg-metric-label">Client-Side Demo Simulation</span>
            </div>
          </div>
        </div>
      </section>

      {/* About Section: The Philosophy of Data Sovereignty */}
      <section id="about" className="pg-about-section" aria-labelledby="about-heading">
        <div className="pg-editorial-container">
          <div className="pg-about-grid">
            <div className="pg-about-left">
              <div className="pg-eyebrow">
                <span className="pg-eyebrow-dot"></span>
                <span>The Core Problem</span>
              </div>
              <h2 id="about-heading" className="pg-about-title">
                Generative AI demands data. <br />
                Regulations demand discretion.
              </h2>
            </div>

            <div className="pg-about-right">
              <p className="pg-about-lead">
                Every prompt sent to an external model provider is a potential compliance and privacy breach.
                Traditional data loss prevention (DLP) tools simply block requests or replace text with crude
                blackouts—blinding the model and ruining inference reasoning.
              </p>
              <p className="pg-about-body">
                PrivacyGuard AI pioneers context-preserving minimization. Sensitive emails, national IDs,
                and credentials are dynamically substituted with realistic synthetic equivalents or deterministic
                tokens. The LLM understands syntax, grammar, and user intent perfectly—while never observing
                an authentic piece of customer data.
              </p>

              <div className="pg-about-highlights">
                <div className="pg-highlight-item">
                  <div className="pg-highlight-icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="pg-highlight-title">Semantic Fidelity</h4>
                    <p className="pg-highlight-desc">Synthetic faker tokens maintain parts of speech and natural conversational tone.</p>
                  </div>
                </div>

                <div className="pg-highlight-item">
                  <div className="pg-highlight-icon">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h4 className="pg-highlight-title">Sovereign Governance</h4>
                    <p className="pg-highlight-desc">Pre-inference interception guarantees zero retention and verifiable compliance.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections, Workflow, How It Works, and Final CTA */}
      <FeatureSection />

      <Footer />
    </div>
  );
}
