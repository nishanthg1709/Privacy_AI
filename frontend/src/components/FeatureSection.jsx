import { useState } from 'react';
import {
  Scan,
  Lock,
  FileCheck2,
  ArrowRight,
  Sparkles,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import FeatureCard from './FeatureCard';
import Button from './Button';
import { Link } from 'react-router-dom';

/**
 * Editorial FeatureSection Component
 * Contains the Core Capabilities, Interactive Redaction Visualizer,
 * and 4-Step Architecture Workflow.
 */
export default function FeatureSection() {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);

  const workflowSteps = [
    {
      step: 1,
      id: 'detect',
      title: 'Detect',
      subtitle: 'Multi-Pattern Entity Extraction',
      description:
        'Analyzes inbound prompts, files, and payload streams in real time. Flags emails, phone numbers, SSNs, payment credentials, and developer secrets before any external network hop.',
      latency: '4.2 ms',
      entitiesFound: 4,
      sampleRaw:
        'Customer Sarah Connor (SSN: 482-19-9481) requested account email update to sarah.connor@cyberdyne.org. Auth card ending in 4532.',
      samplePreview:
        'Customer [IDENTIFIED: NAME] (SSN: [IDENTIFIED: SSN]) requested account email update to [IDENTIFIED: EMAIL]. Auth card ending in [IDENTIFIED: CARD].',
    },
    {
      step: 2,
      id: 'minimize',
      title: 'Minimize',
      subtitle: 'Context-Aware Synthetic Masking',
      description:
        'Replaces identified sensitive tokens with semantically coherent synthetic faker entities or deterministic tags. LLM context windows retain full grammatical flow without ever ingesting real human data.',
      latency: '9.8 ms',
      entitiesFound: 4,
      sampleRaw:
        'Customer Sarah Connor (SSN: 482-19-9481) requested account email update to sarah.connor@cyberdyne.org. Auth card ending in 4532.',
      samplePreview:
        'Customer Jane Doe (SSN: [REDACTED_SSN]) requested account email update to user_491@anonymized.org. Auth card ending in **** 4532.',
    },
    {
      step: 3,
      id: 'review',
      title: 'Review',
      subtitle: 'Side-by-Side Diff & Compliance Audit',
      description:
        'Provides instant differential previews, confidence scoring, and cryptographic audit records. Ensures strict compliance with GDPR Article 25 and HIPAA Safe Harbor requirements.',
      latency: '2.1 ms',
      entitiesFound: 4,
      sampleRaw:
        'Customer Sarah Connor (SSN: 482-19-9481) requested account email update to sarah.connor@cyberdyne.org. Auth card ending in 4532.',
      samplePreview:
        'Confidence Score: 99.4% • Zero PII Leakage • Safe for LLM Dispatch',
    },
  ];

  const currentStepData = workflowSteps.find((s) => s.step === activeWorkflowStep) || workflowSteps[0];

  return (
    <div className="pg-features-wrapper">
      {/* Section 1: Core Feature Pillars */}
      <section id="features" className="pg-editorial-section" aria-labelledby="features-heading">
        <div className="pg-editorial-header">
          <div className="pg-eyebrow">
            <span className="pg-eyebrow-dot"></span>
            <span>Core Capabilities</span>
          </div>
          <h2 id="features-heading" className="pg-editorial-h2">
            Engineered for zero-leakage enterprise intelligence.
          </h2>
          <p className="pg-editorial-lead">
            PrivacyGuard AI sits between your corporate application layer and external AI model providers,
            enforcing data minimization at the protocol level.
          </p>
        </div>

        <div className="pg-pillars-grid">
          <FeatureCard
            number="01"
            tag="Detection"
            icon={Scan}
            title="High-Speed Entity Extraction"
            description="High-throughput regex and local NLP models identify over 40 categories of PII, financial identifiers, patient healthcare records, and developer credentials in under 15 milliseconds."
          >
            <div className="pg-card-specs-list">
              <span className="pg-spec-pill">Emails &amp; Phones</span>
              <span className="pg-spec-pill">SSN &amp; National IDs</span>
              <span className="pg-spec-pill">Credit Cards</span>
              <span className="pg-spec-pill">API Keys &amp; JWTs</span>
            </div>
          </FeatureCard>

          <FeatureCard
            number="02"
            tag="Transformation"
            icon={Lock}
            title="Context-Preserving Redaction"
            description="Unlike naive string strippers that break LLM prompt comprehension, PrivacyGuard generates synthetic substitutes that preserve semantic grammar, structure, and intent."
          >
            <div className="pg-card-specs-list">
              <span className="pg-spec-pill">Synthetic Faker</span>
              <span className="pg-spec-pill">Reversible Tokenization</span>
              <span className="pg-spec-pill">Strict Blackout</span>
              <span className="pg-spec-pill">Grammar Retained</span>
            </div>
          </FeatureCard>

          <FeatureCard
            number="03"
            tag="Governance"
            icon={FileCheck2}
            title="Verifiable Compliance Audits"
            description="Generate cryptographic proof of minimization for SOC 2, GDPR, and HIPAA audits. Maintain complete transparency with zero-retention ephemeral memory caches."
          >
            <div className="pg-card-specs-list">
              <span className="pg-spec-pill">GDPR Art. 25</span>
              <span className="pg-spec-pill">HIPAA Safe Harbor</span>
              <span className="pg-spec-pill">Side-by-Side Diffs</span>
              <span className="pg-spec-pill">JSON Log Exports</span>
            </div>
          </FeatureCard>
        </div>
      </section>

      {/* Section 2: Interactive Protection Workflow */}
      <section id="workflow" className="pg-editorial-section pg-section-workflow" aria-labelledby="workflow-heading">
        <div className="pg-editorial-header">
          <div className="pg-eyebrow">
            <span className="pg-eyebrow-dot"></span>
            <span>Guardrail Pipeline</span>
          </div>
          <h2 id="workflow-heading" className="pg-editorial-h2">
            The three-stage minimization protocol.
          </h2>
          <p className="pg-editorial-lead">
            Explore how raw, sensitive inputs are intercepted, masked, and verified before inference.
          </p>
        </div>

        <div className="pg-workflow-interactive-box">
          {/* Step Selector Tabs */}
          <div className="pg-workflow-tabs-bar" role="tablist" aria-label="Workflow stages">
            {workflowSteps.map((step) => (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={activeWorkflowStep === step.step}
                className={`pg-workflow-tab ${activeWorkflowStep === step.step ? 'pg-workflow-tab-active' : ''}`}
                onClick={() => setActiveWorkflowStep(step.step)}
              >
                <span className="pg-tab-num">Stage 0{step.step}</span>
                <span className="pg-tab-title">{step.title}</span>
                <span className="pg-tab-subtitle">{step.subtitle}</span>
              </button>
            ))}
          </div>

          {/* Active Step Visual Display */}
          <div className="pg-workflow-viewport">
            <div className="pg-viewport-header">
              <div className="pg-viewport-badge">
                <Sparkles size={14} />
                <span>Active Transformation Stage: {currentStepData.title}</span>
              </div>
              <div className="pg-viewport-stats">
                <span className="pg-stat-chip">Latency: {currentStepData.latency}</span>
                <span className="pg-stat-chip">Entities: {currentStepData.entitiesFound}</span>
              </div>
            </div>

            <div className="pg-viewport-body">
              <div className="pg-viewport-col">
                <span className="pg-col-header">Raw Sensitive Inbound (Pre-Guardrail)</span>
                <div className="pg-col-code pg-code-raw">
                  <code>{currentStepData.sampleRaw}</code>
                </div>
              </div>

              <div className="pg-viewport-divider">
                <ArrowRight size={20} className="pg-divider-arrow" />
              </div>

              <div className="pg-viewport-col">
                <span className="pg-col-header">
                  {currentStepData.step === 1 && 'Detection Highlighting'}
                  {currentStepData.step === 2 && 'Synthetic Masked Output (LLM Ready)'}
                  {currentStepData.step === 3 && 'Verification Audit Diff'}
                </span>
                <div className="pg-col-code pg-code-clean">
                  <code>{currentStepData.samplePreview}</code>
                </div>
              </div>
            </div>

            <div className="pg-viewport-footer">
              <p className="pg-viewport-description">{currentStepData.description}</p>
              <Link to="/app/scanner" className="pg-viewport-cta">
                <span>Test in Live Scanner</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: 4-Step How It Works */}
      <section id="how-it-works" className="pg-editorial-section" aria-labelledby="how-heading">
        <div className="pg-editorial-header">
          <div className="pg-eyebrow">
            <span className="pg-eyebrow-dot"></span>
            <span>Integration Lifecycle</span>
          </div>
          <h2 id="how-heading" className="pg-editorial-h2">
            How PrivacyGuard AI operates.
          </h2>
          <p className="pg-editorial-lead">
            Four simple phases designed to integrate effortlessly into any existing enterprise software architecture.
          </p>
        </div>

        <div className="pg-how-steps-grid">
          <div className="pg-step-item">
            <div className="pg-step-number-wrap">
              <span className="pg-step-number">01</span>
              <div className="pg-step-connector"></div>
            </div>
            <h4 className="pg-step-title">Ingest &amp; Intercept</h4>
            <p className="pg-step-text">
              Direct API payloads, customer correspondence, or prompt documents through the PrivacyGuard gateway
              or lightweight SDK adapter.
            </p>
          </div>

          <div className="pg-step-item">
            <div className="pg-step-number-wrap">
              <span className="pg-step-number">02</span>
              <div className="pg-step-connector"></div>
            </div>
            <h4 className="pg-step-title">Deep Classification</h4>
            <p className="pg-step-text">
              High-throughput deterministic regex and contextual NER models scan payload text, discovering
              structured IDs, credentials, and conversational PII.
            </p>
          </div>

          <div className="pg-step-item">
            <div className="pg-step-number-wrap">
              <span className="pg-step-number">03</span>
              <div className="pg-step-connector"></div>
            </div>
            <h4 className="pg-step-title">Contextual Anonymization</h4>
            <p className="pg-step-text">
              Transform sensitive entities into synthetic equivalents or reversible deterministic tags based
              on your workspace governance rules.
            </p>
          </div>

          <div className="pg-step-item">
            <div className="pg-step-number-wrap">
              <span className="pg-step-number">04</span>
              <div className="pg-step-connector"></div>
            </div>
            <h4 className="pg-step-title">Secure Dispatch &amp; Log</h4>
            <p className="pg-step-text">
              The clean, sanitized payload dispatches to OpenAI, Anthropic, or local LLM instances while a zero-leak
              audit record is logged.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Final Editorial CTA */}
      <section className="pg-editorial-cta-section" aria-label="Get Started with PrivacyGuard AI">
        <div className="pg-cta-inner">
          <span className="pg-cta-eyebrow">Ready for Sovereign AI?</span>
          <h2 className="pg-cta-headline">
            Start protecting enterprise payloads before your next inference call.
          </h2>
          <p className="pg-cta-description">
            Experience real-time PII detection, synthetic anonymization, and verifiable audit trails.
            No credit card or backend installation required for this interactive demonstration.
          </p>

          <div className="pg-cta-button-row">
            <Link to="/signup">
              <Button variant="primary" size="lg" iconAfter={ArrowRight}>
                Get Started with Demo Account
              </Button>
            </Link>
            <Link to="/app/scanner">
              <Button variant="secondary" size="lg" icon={Scan}>
                Open Privacy Scanner
              </Button>
            </Link>
          </div>

          <div className="pg-cta-reassurance">
            <span className="pg-reassurance-item">
              <CheckCircle2 size={15} />
              <span>Zero external data transmission</span>
            </span>
            <span className="pg-reassurance-item">
              <CheckCircle2 size={15} />
              <span>Full client-side simulation</span>
            </span>
            <span className="pg-reassurance-item">
              <CheckCircle2 size={15} />
              <span>Ready for backend integration</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
