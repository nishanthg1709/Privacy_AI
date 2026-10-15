import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  ShieldCheck,
  Lock,
  Sparkles,
  ChevronRight,
  FileText,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Button from '../components/Button';
import useScrollReveal from '../hooks/useScrollReveal';
import heroSecurityImg from '../assets/landing-hero-security.jpg';
import planetHorizonImg from '../assets/planet-security-horizon.jpg';

/**
 * Editorial Landing Page
 * Faithfully reproduces Panel 1 from the reference design:
 * - A. Minimal Navbar (Home, About, Features, How It Works, Contact, Sign In, Get Started)
 * - B. Cinematic Multi-Layered Hero (Eyebrow: YOUR DATA. YOUR CONTROL. Headline: Share Ideas Without Risk.)
 * - C. 4 Feature Cards (AI-Powered Detection, Smart Redaction, Task-Aware Privacy, Privacy Verification)
 * - D. Privacy-First Section (BUILT FOR A PRIVACY-FIRST TOMORROW with lunar planet horizon)
 * - E. How It Works (4 Connected Steps: 01 Upload or Paste, 02 AI Detection, 03 Smart Redaction, 04 Share Confidently)
 * - F. Final Call to Action (YOUR DATA. YOUR RULES.)
 * - G. Minimal Editorial Footer
 */
export default function LandingPage() {
  const [featuresRef, featuresRevealed] = useScrollReveal();
  const [privacyRef, privacyRevealed] = useScrollReveal();
  const [howRef, howRevealed] = useScrollReveal();
  const [ctaRef, ctaRevealed] = useScrollReveal();

  return (
    <div className="pg-landing-root">
      <Navbar />

      {/* Hero Section (Matching Reference Panel 1 with Multi-Layered Cinematic Environment) */}
      <section id="hero" className="pg-hero-section-reference" aria-label="PrivacyGuard AI Overview">
        {/* Layer 1: Cybernetic Security Mesh / Network Grid */}
        <div className="pg-hero-bg-network" aria-hidden="true" />

        {/* Layer 2: Atmospheric Lunar Horizon Silhouette at Base */}
        <div
          className="pg-hero-bg-horizon"
          style={{ backgroundImage: `url(${planetHorizonImg})` }}
          aria-hidden="true"
        />

        {/* Layer 3: Silver Ambient Spotlight Overlays */}
        <div className="pg-hero-bg-spotlight-left" aria-hidden="true" />
        <div className="pg-hero-bg-spotlight-right" aria-hidden="true" />

        {/* Layer 4: Floating Security Data Particles */}
        <div className="pg-hero-particles" aria-hidden="true">
          <span className="pg-particle p1" />
          <span className="pg-particle p2" />
          <span className="pg-particle p3" />
          <span className="pg-particle p4" />
          <span className="pg-particle p5" />
          <span className="pg-particle p6" />
        </div>

        {/* Layer 5: Seamless Bottom Mist Gradient */}
        <div className="pg-hero-bg-mist" aria-hidden="true" />

        <div className="pg-hero-container-reference">
          {/* Left Text Column with Staggered Entrances */}
          <div className="pg-hero-left-content">
            <div className="pg-eyebrow-reference pg-anim-stagger-1">
              <span className="pg-eyebrow-dot"></span>
              <span>YOUR DATA. YOUR CONTROL.</span>
            </div>

            <h1 className="pg-hero-headline-reference pg-anim-stagger-2">
              Share Ideas <br />
              Without Risk.
            </h1>

            <p className="pg-hero-subtext-reference pg-anim-stagger-3">
              AI-powered privacy protection for your documents and ideas. Detect sensitive information,
              protects what is unnecessary, and share confidently with AI tools, teams, and the world.
            </p>

            <div className="pg-hero-cta-row pg-anim-stagger-4">
              <Link to="/signup">
                <Button variant="primary" size="lg" iconAfter={ArrowRight} className="pg-btn-hero-primary">
                  Get Started
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" icon={ChevronRight} className="pg-btn-hero-secondary">
                  Explore How It Works
                </Button>
              </a>
            </div>
          </div>

          {/* Right Security Artwork: Translucent 3D Shield with Rotating Orbit Rings & Floating Badges */}
          <div className="pg-hero-artwork-wrap">
            <div className="pg-hero-artwork-stage">
              {/* Soft Ambient Volumetric Aura */}
              <div className="pg-hero-shield-aura" aria-hidden="true" />

              {/* Concentric Rotating Hairline Orbit Rings */}
              <div className="pg-orbit-ring pg-orbit-outer" aria-hidden="true">
                <span className="pg-orbit-node node-1" />
                <span className="pg-orbit-node node-2" />
              </div>
              <div className="pg-orbit-ring pg-orbit-inner" aria-hidden="true">
                <span className="pg-orbit-node node-3" />
              </div>

              {/* Floating Encrypted Security Badges */}
              <div className="pg-floating-badge badge-top-left" aria-hidden="true">
                <Lock size={12} className="pg-badge-icon" />
                <span>AES-256 GCM</span>
              </div>
              <div className="pg-floating-badge badge-top-right" aria-hidden="true">
                <Cpu size={12} className="pg-badge-icon" />
                <span>Local GLiNER</span>
              </div>
              <div className="pg-floating-badge badge-bottom-left" aria-hidden="true">
                <ShieldCheck size={12} className="pg-badge-icon" />
                <span>Zero Cloud Log</span>
              </div>

              {/* Central 3D Security Shield Artwork */}
              <div className="pg-hero-img-container">
                <img
                  src={heroSecurityImg}
                  alt="Translucent monochrome 3D security shield with digital lock and orbiting encrypted documents"
                  className="pg-hero-security-img"
                />
                <div className="pg-hero-img-glow" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section C: 4 Feature Cards Row (Directly below hero, matching Reference Panel 1) */}
      <section
        id="features"
        ref={featuresRef}
        className={`pg-features-bar-section ${featuresRevealed ? 'pg-revealed' : ''}`}
        aria-label="Core Capabilities"
      >
        <div className="pg-features-bar-container">
          <div className="pg-features-grid-reference">
            {/* Card 1: AI-Powered Detection */}
            <div className="pg-feature-card-ref pg-reveal-item pg-stagger-1">
              <div className="pg-feature-icon-box">
                <Shield size={20} />
              </div>
              <h3 className="pg-feature-title-ref">AI-Powered Detection</h3>
              <p className="pg-feature-desc-ref">
                Identify sensitive information using contextual entity detection and supporting recognizers.
              </p>
            </div>

            {/* Card 2: Smart Redaction */}
            <div className="pg-feature-card-ref pg-reveal-item pg-stagger-2">
              <div className="pg-feature-icon-box">
                <Lock size={20} />
              </div>
              <h3 className="pg-feature-title-ref">Smart Redaction</h3>
              <p className="pg-feature-desc-ref">
                Protect selected information while preserving useful document context and grammar.
              </p>
            </div>

            {/* Card 3: Task-Aware Privacy */}
            <div className="pg-feature-card-ref pg-reveal-item pg-stagger-3">
              <div className="pg-feature-icon-box">
                <Sparkles size={20} />
              </div>
              <h3 className="pg-feature-title-ref">Task-Aware Privacy</h3>
              <p className="pg-feature-desc-ref">
                Use the user&rsquo;s stated task and configured rules to help determine what information is necessary.
              </p>
            </div>

            {/* Card 4: Privacy Verification */}
            <div className="pg-feature-card-ref pg-reveal-item pg-stagger-4">
              <div className="pg-feature-icon-box">
                <ShieldCheck size={20} />
              </div>
              <h3 className="pg-feature-title-ref">Privacy Verification</h3>
              <p className="pg-feature-desc-ref">
                Review residual findings and understand limitations after protection before external sharing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section D: Privacy-First Section (Matching Reference Panel 1 middle) */}
      <section
        id="about"
        ref={privacyRef}
        className={`pg-privacy-first-section ${privacyRevealed ? 'pg-revealed' : ''}`}
        aria-label="Built for a Privacy-First Tomorrow"
      >
        <div
          className="pg-privacy-first-bg"
          style={{ backgroundImage: `url(${planetHorizonImg})` }}
          aria-hidden="true"
        />
        <div className="pg-privacy-first-overlay" aria-hidden="true" />

        <div className="pg-privacy-first-container">
          <div className="pg-privacy-first-content pg-reveal-item">
            <span className="pg-privacy-first-eyebrow">BUILT FOR A PRIVACY-FIRST TOMORROW</span>
            <h2 className="pg-privacy-first-heading">
              Give your documents and ideas the protection they deserve.
            </h2>
            <p className="pg-privacy-first-desc">
              Reducing unnecessary exposure before documents are shared with external systems is essential.
              PrivacyGuard AI enforces data minimization at the protocol layer with zero external API calls.
            </p>

            <div className="pg-privacy-first-cta">
              <Link to="/app/scanner">
                <Button variant="primary" size="md" iconAfter={ArrowRight}>
                  Explore Features &rarr;
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section E: How It Works (Matching Reference Panel 1 bottom) */}
      <section
        id="how-it-works"
        ref={howRef}
        className={`pg-how-it-works-reference ${howRevealed ? 'pg-revealed' : ''}`}
        aria-label="How It Works"
      >
        <div className="pg-how-container-reference">
          <div className="pg-how-header-reference pg-reveal-item">
            <h2 className="pg-how-title-reference">How It Works</h2>
            <p className="pg-how-sub-reference">
              From raw documents to safe, shareable content in minutes.
            </p>
          </div>

          <div className="pg-how-steps-connected-grid">
            {/* Step 01 */}
            <div className="pg-how-step-card pg-reveal-item pg-stagger-1">
              <div className="pg-step-badge-circle">
                <FileText size={18} />
              </div>
              <div className="pg-step-num-label">01 — Upload or Paste</div>
              <h4 className="pg-step-name">Input Content</h4>
              <p className="pg-step-expl">
                Enter text or provide supported document content and specify your stated task context.
              </p>
            </div>

            <div className="pg-how-step-arrow pg-reveal-item" aria-hidden="true">
              <ChevronRight size={20} />
            </div>

            {/* Step 02 */}
            <div className="pg-how-step-card pg-reveal-item pg-stagger-2">
              <div className="pg-step-badge-circle">
                <Cpu size={18} />
              </div>
              <div className="pg-step-num-label">02 — AI Detection</div>
              <h4 className="pg-step-name">Contextual Classification</h4>
              <p className="pg-step-expl">
                Identify sensitive entities and relevant privacy risks using local GLiNER and Presidio models.
              </p>
            </div>

            <div className="pg-how-step-arrow pg-reveal-item" aria-hidden="true">
              <ChevronRight size={20} />
            </div>

            {/* Step 03 */}
            <div className="pg-how-step-card pg-reveal-item pg-stagger-3">
              <div className="pg-step-badge-circle">
                <Lock size={18} />
              </div>
              <div className="pg-step-num-label">03 — Smart Redaction</div>
              <h4 className="pg-step-name">Context Minimization</h4>
              <p className="pg-step-expl">
                Review and protect unnecessary information with synthetic data, tags, or strict blackout.
              </p>
            </div>

            <div className="pg-how-step-arrow pg-reveal-item" aria-hidden="true">
              <ChevronRight size={20} />
            </div>

            {/* Step 04 */}
            <div className="pg-how-step-card pg-reveal-item pg-stagger-4">
              <div className="pg-step-badge-circle">
                <CheckCircle2 size={18} />
              </div>
              <div className="pg-step-num-label">04 — Share Confidently</div>
              <h4 className="pg-step-name">Verified Dispatch</h4>
              <p className="pg-step-expl">
                Review the protected output, understand remaining limitations, and share safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section F: Final Call to Action */}
      <section
        ref={ctaRef}
        className={`pg-final-cta-reference ${ctaRevealed ? 'pg-revealed' : ''}`}
        aria-label="Take Control of Your Data"
      >
        <div className="pg-final-cta-container pg-reveal-item">
          <span className="pg-final-cta-eyebrow">SOVEREIGN PRIVACY</span>
          <h2 className="pg-final-cta-heading">YOUR DATA. YOUR RULES.</h2>
          <p className="pg-final-cta-desc">
            Take control of sensitive information before prompts leave your device.
            Start auditing documents locally with zero cloud exposure.
          </p>

          <div className="pg-final-cta-button-row">
            <Link to="/signup">
              <Button variant="primary" size="lg" iconAfter={ArrowRight} className="pg-btn-hero-primary">
                Start Protecting Your Data
              </Button>
            </Link>
            <Link to="/app/scanner">
              <Button variant="outline" size="lg" icon={Shield}>
                Open Live Scanner Studio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Section G: Contact & Footer */}
      <div id="contact">
        <Footer />
      </div>
    </div>
  );
}
