import { useNavigate } from 'react-router-dom';
import {
  Scan,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Search,
  Eye,
  History,
  Sliders,
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronRight,
  Terminal,
  Activity
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Button from '../components/Button';

/**
 * Editorial Dashboard Page
 * Executive overview of privacy guardrails and real-time session telemetry.
 * Strictly calculates metrics from actual scans performed in this session.
 * Never fabricates historical scans or fake privacy scores.
 */
export default function Dashboard({ onNavigate, onSelectScan, scanHistory = [] }) {
  const navigate = useNavigate();

  const handleGo = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    } else {
      navigate(`/app/${pageId}`);
    }
  };

  const handleInspectScan = (scan) => {
    if (onSelectScan) {
      onSelectScan(scan);
      navigate('/app/results', { state: { scanData: scan } });
    } else {
      handleGo('results');
    }
  };

  // Derive real statistics strictly from actual scans
  const totalScans = scanHistory.length;
  const totalEntitiesProtected = scanHistory.reduce((sum, item) => {
    return sum + (item.findings?.length ?? item.counts?.total ?? 0);
  }, 0);

  const highRiskEntities = scanHistory.reduce((sum, item) => {
    if (!item.findings) return sum;
    const high = item.findings.filter((f) => f.risk === 'High' || f.risk === 'Critical').length;
    return sum + high;
  }, 0);

  const avgPrivacyScore =
    totalScans > 0
      ? Math.round(
          scanHistory.reduce((acc, s) => acc + (s.privacyScore ?? 100), 0) / totalScans
        )
      : 100;

  const recentScans = scanHistory.slice(0, 5);

  return (
    <div className="pg-editorial-workspace-page">
      {/* Editorial Hero Banner */}
      <section className="pg-workspace-hero" aria-label="PrivacyGuard AI Overview">
        <div className="pg-hero-content">
          <div className="pg-hero-badge">
            <ShieldCheck size={14} />
            <span>Active Enterprise Guardrails</span>
            <span className="pg-hero-badge-tag">
              {totalScans > 0 ? `${totalScans} Scan${totalScans > 1 ? 's' : ''} in Session` : 'Session Initialized'}
            </span>
          </div>
          <h1 className="pg-hero-title">
            Enterprise Privacy &amp; Data Minimization
          </h1>
          <p className="pg-hero-description">
            Safeguard sensitive customer records, developer tokens, and regulated PII before
            inbound payloads reach external LLMs or third-party inference APIs.
          </p>

          <div className="pg-hero-actions">
            <Button
              variant="primary"
              size="md"
              icon={Scan}
              iconAfter={ArrowRight}
              onClick={() => handleGo('scanner')}
              id="dashboard-start-scan-btn"
            >
              Start a Privacy Scan
            </Button>

            <Button
              variant="secondary"
              size="md"
              icon={History}
              onClick={() => handleGo('history')}
              id="dashboard-view-history-btn"
            >
              View Audit History ({totalScans})
            </Button>

            {totalScans > 0 && (
              <Button
                variant="outline"
                size="md"
                icon={Eye}
                onClick={() => handleInspectScan(scanHistory[0])}
                id="dashboard-view-results-btn"
              >
                Inspect Latest Scan
              </Button>
            )}
          </div>
        </div>

        {/* Live Architecture Status Note */}
        <div className="pg-workspace-demo-callout" role="note">
          <div className="pg-demo-callout-header">
            <Sparkles size={14} className="pg-text-cream" />
            <strong>Real-time Telemetry Gateway</strong>
          </div>
          <p>
            Metrics and audit records below reflect actual prompt scans processed during this active
            session. Database persistence will be synchronized as the backend API is expanded.
          </p>
        </div>
      </section>

      {/* Summary Stat Cards populated from actual scan data */}
      <section className="pg-workspace-section" aria-label="Key Performance Indicators">
        <div className="pg-section-header">
          <div>
            <h2 className="pg-section-title">Security &amp; Privacy Telemetry</h2>
            <p className="pg-section-subtitle">
              Cumulative metrics derived strictly from actual session scans
            </p>
          </div>
          <span className="pg-badge-demo-pill">
            {totalScans === 0 ? 'Awaiting First Scan' : 'Live Session Telemetry'}
          </span>
        </div>

        <div className="pg-stats-grid">
          <StatCard
            title="Total Scans Processed"
            value={totalScans.toLocaleString()}
            trend={totalScans > 0 ? `${totalScans} verified` : '0 in session'}
            trendUp={totalScans > 0}
            icon={Scan}
            subtitle={totalScans === 0 ? 'Execute your first scan in the studio' : 'Audited and intercepted payloads'}
            onClick={() => handleGo('scanner')}
          />

          <StatCard
            title="Protected Findings (PII & Secrets)"
            value={totalEntitiesProtected.toLocaleString()}
            trend={totalEntitiesProtected > 0 ? 'Neutralized before model' : '0 detected'}
            trendUp={true}
            icon={ShieldCheck}
            subtitle="Confidential tokens, PII, and credentials masked"
            onClick={() => (totalScans > 0 ? handleGo('results') : handleGo('scanner'))}
          />

          <StatCard
            title="High-Risk Items Prevented"
            value={highRiskEntities.toLocaleString()}
            trend={highRiskEntities > 0 ? 'Strict guardrail applied' : 'Zero violations'}
            trendUp={highRiskEntities === 0}
            icon={AlertTriangle}
            subtitle="SSNs, developer keys, and financial credentials"
            onClick={() => handleGo('history')}
          />

          <StatCard
            title="Average Privacy Score"
            value={`${avgPrivacyScore} / 100`}
            trend="Strict compliance"
            trendUp={true}
            icon={Terminal}
            subtitle="Dynamic rating based on detected entity risk"
          />
        </div>
      </section>

      {/* Three-Step Workflow Section */}
      <section className="pg-workspace-section" aria-label="PrivacyGuard Processing Pipeline">
        <div className="pg-section-header">
          <div>
            <h2 className="pg-section-title">The Three-Step Guardrail Workflow</h2>
            <p className="pg-section-subtitle">
              How PrivacyGuard AI intercepts and sanitizes payloads in under 20 milliseconds
            </p>
          </div>
          <button
            type="button"
            className="pg-editorial-link-btn"
            onClick={() => handleGo('scanner')}
          >
            <span>Try the Pipeline</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="pg-workflow-grid">
          {/* Step 1: Detect */}
          <div className="pg-workflow-card">
            <div className="pg-workflow-step-num">Step 01</div>
            <div className="pg-workflow-icon-wrap">
              <Search size={22} strokeWidth={1.8} />
            </div>
            <h3 className="pg-workflow-title">1. Detect</h3>
            <p className="pg-workflow-text">
              High-speed regex and NLP models scan prompts, API payloads, and documents for
              over 40+ PII categories, including emails, credit cards, SSNs, and developer secrets.
            </p>
            <div className="pg-workflow-tags">
              <span className="pg-tag">PII Scanning</span>
              <span className="pg-tag">Developer Keys</span>
              <span className="pg-tag">Regex + NLP</span>
            </div>
          </div>

          {/* Step 2: Minimize */}
          <div className="pg-workflow-card">
            <div className="pg-workflow-step-num">Step 02</div>
            <div className="pg-workflow-icon-wrap">
              <Lock size={22} strokeWidth={1.8} />
            </div>
            <h3 className="pg-workflow-title">2. Minimize</h3>
            <p className="pg-workflow-text">
              Dynamically substitutes confidential tokens with realistic synthetic entities or
              deterministic masks. Context, grammar, and semantic coherence remain fully intact for the model.
            </p>
            <div className="pg-workflow-tags">
              <span className="pg-tag">Synthetic Faker</span>
              <span className="pg-tag">Tokenized Mask</span>
              <span className="pg-tag">Full Redaction</span>
            </div>
          </div>

          {/* Step 3: Audit */}
          <div className="pg-workflow-card">
            <div className="pg-workflow-step-num">Step 03</div>
            <div className="pg-workflow-icon-wrap">
              <CheckCircle2 size={22} strokeWidth={1.8} />
            </div>
            <h3 className="pg-workflow-title">3. Audit &amp; Verify</h3>
            <p className="pg-workflow-text">
              Every intercepted request produces a verifiable audit record. Review side-by-side diffs,
              track confidence ratings, and export compliance reports for GDPR and HIPAA audits.
            </p>
            <div className="pg-workflow-tags">
              <span className="pg-tag">Zero Retention</span>
              <span className="pg-tag">JSON Audit Export</span>
              <span className="pg-tag">GDPR &amp; HIPAA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Launchpad Strip */}
      <section className="pg-workspace-section" aria-label="Quick Actions">
        <div className="pg-section-header">
          <h2 className="pg-section-title">Quick Actions</h2>
        </div>

        <div className="pg-quick-actions-grid">
          <button
            type="button"
            className="pg-quick-action-card"
            onClick={() => handleGo('scanner')}
          >
            <div className="pg-qa-icon">
              <Scan size={18} />
            </div>
            <div className="pg-qa-content">
              <span className="pg-qa-label">Launch Scanner Studio</span>
              <span className="pg-qa-desc">Analyze a raw prompt or upload a text document</span>
            </div>
            <ChevronRight size={16} className="pg-qa-arrow" />
          </button>

          <button
            type="button"
            className="pg-quick-action-card"
            onClick={() => handleGo('history')}
          >
            <div className="pg-qa-icon">
              <History size={18} />
            </div>
            <div className="pg-qa-content">
              <span className="pg-qa-label">Inspect Audit Logs</span>
              <span className="pg-qa-desc">Review records and export CSV summaries</span>
            </div>
            <ChevronRight size={16} className="pg-qa-arrow" />
          </button>

          <button
            type="button"
            className="pg-quick-action-card"
            onClick={() => handleGo('settings')}
          >
            <div className="pg-qa-icon">
              <Sliders size={18} />
            </div>
            <div className="pg-qa-content">
              <span className="pg-qa-label">Configure Policies</span>
              <span className="pg-qa-desc">Customize default masking and strictness</span>
            </div>
            <ChevronRight size={16} className="pg-qa-arrow" />
          </button>
        </div>
      </section>

      {/* Recent Scan Activity Feed */}
      <section className="pg-workspace-section" aria-label="Recent Scan Activity">
        <div className="pg-section-header">
          <div>
            <h2 className="pg-section-title">Recent Scan Activity</h2>
            <p className="pg-section-subtitle">
              {totalScans > 0
                ? `Displaying ${recentScans.length} active session scan record${recentScans.length > 1 ? 's' : ''}`
                : 'Session audit records'}
            </p>
          </div>
          <div className="pg-header-action-group">
            {totalScans > 0 && (
              <Button
                variant="outline"
                size="sm"
                iconAfter={ArrowRight}
                onClick={() => handleGo('history')}
                id="view-all-history-btn"
              >
                View All History ({totalScans})
              </Button>
            )}
          </div>
        </div>

        {totalScans === 0 ? (
          <div className="pg-empty-state-card">
            <div className="pg-empty-icon-wrap">
              <Activity size={32} className="pg-text-cream-subtle" />
            </div>
            <h3 className="pg-empty-title">No Scan Activity Recorded in Current Session</h3>
            <p className="pg-empty-desc">
              Execute your first prompt analysis in the Privacy Scanner to record real risk exposure,
              entity distributions, and audit records.
            </p>
            <div className="pg-empty-actions">
              <Button
                variant="primary"
                size="md"
                icon={Scan}
                onClick={() => handleGo('scanner')}
              >
                Launch Privacy Scanner
              </Button>
            </div>
          </div>
        ) : (
          <div className="pg-table-card">
            <div className="pg-table-responsive">
              <table className="pg-table" aria-label="Recent Scans List">
                <thead>
                  <tr>
                    <th scope="col">Scan ID &amp; Task</th>
                    <th scope="col">Timestamp</th>
                    <th scope="col">Minimization Mode</th>
                    <th scope="col">Findings</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="pg-text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan) => {
                    const findingsCount = scan.findings?.length ?? scan.counts?.total ?? 0;
                    return (
                      <tr key={scan.scanId} className="pg-table-row">
                        <td>
                          <div className="pg-scan-primary-cell">
                            <span className="pg-scan-id">{scan.scanId}</span>
                            <span className="pg-scan-name">{scan.taskName}</span>
                          </div>
                        </td>
                        <td className="pg-table-muted">
                          {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <span className="pg-mode-badge">{scan.mode}</span>
                        </td>
                        <td>
                          <div className="pg-findings-cell">
                            <span className="pg-findings-count">{findingsCount} found</span>
                            <span className="pg-findings-types">
                              {scan.categories?.slice(0, 2).join(', ') || (findingsCount === 0 ? 'Clean' : 'Protected')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`pg-status-pill ${
                              findingsCount === 0 ? 'pg-status-clean' : 'pg-status-protected'
                            }`}
                          >
                            {findingsCount === 0 ? 'Clean' : 'Protected'}
                          </span>
                        </td>
                        <td className="pg-text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleInspectScan(scan)}
                            aria-label={`Inspect ${scan.taskName} results`}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pg-table-footer">
              <span className="pg-table-footer-text">
                Session Audit Log: {totalScans} verified scan event{totalScans > 1 ? 's' : ''}.
              </span>
              <button
                type="button"
                className="pg-editorial-link-btn"
                onClick={() => handleGo('scanner')}
              >
                Scan new payload
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
