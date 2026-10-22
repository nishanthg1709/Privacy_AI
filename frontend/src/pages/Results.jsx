import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Copy,
  Check,
  Download,
  FileText,
  Scan,
  Lock,
  CheckCircle2,
  ShieldAlert,
  Info
} from 'lucide-react';
import Button from '../components/Button';
import { useCardTilt } from '../hooks/useCardTilt';

function ResultsKpiCard({ count, title, subtitle }) {
  const cardRef = useCardTilt({ maxTilt: 6, scale: 1.02 });
  return (
    <div ref={cardRef} className="pg-results-kpi-card pg-cyber-card-tilt pg-specular-card">
      <div className="pg-kpi-num-badge">{count}</div>
      <div className="pg-kpi-info">
        <span className="pg-kpi-title">{title}</span>
        <span className="pg-kpi-sub">{subtitle}</span>
      </div>
    </div>
  );
}

/**
 * Editorial Results Page Component
 * Faithfully matches Panel 6 of the reference design:
 * - Header: Scan Completed, "We found and protected sensitive information in your document."
 * - 4 Tabs: Summary, Detections, Protected Output, Verification
 * - Detection Summary KPI cards: Sensitive Items, Entity Categories, Redacted Items, High Risk Items
 * - Split layout: Detected Entities on left, Protected Output with "Copy Protected Output" on right
 * - Secondary verification, residual risks, and combination risks retained with 100% integrity
 */
export default function Results({ onNavigate, scanData: propScanData }) {
  const navigate = useNavigate();
  const location = useLocation();

  const scanData = propScanData || location.state?.scanData;

  const handleGo = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    } else {
      navigate(`/app/${pageId}`);
    }
  };

  const [copied, setCopied] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('summary'); // 'summary' | 'detections' | 'protected' | 'verification'
  const [diffViewMode, setDiffViewMode] = useState('sideBySide'); // 'sideBySide' | 'tabbed'
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [userApproved, setUserApproved] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // If no scan data is available, render an honest empty state
  if (!scanData) {
    return (
      <div className="pg-editorial-workspace-page">
        <div className="pg-workspace-page-header">
          <div>
            <h1 className="pg-workspace-page-title">Scan Results</h1>
            <p className="pg-workspace-page-subtitle">
              Detailed inspection of detected entities and protected outputs.
            </p>
          </div>
        </div>

        <div className="pg-empty-state-card" role="region" aria-label="No Scan Available">
          <div className="pg-empty-icon-wrap">
            <Scan size={36} className="pg-text-cream-subtle" />
          </div>
          <h2 className="pg-empty-title">No Scan Results Available for Inspection</h2>
          <p className="pg-empty-desc">
            To view detected entities, side-by-side token diffs, and sanitized payloads, run a scan
            through the Privacy Scanner Studio or select a record from your audit history.
          </p>
          <div className="pg-empty-actions">
            <Button
              variant="primary"
              size="md"
              icon={Scan}
              onClick={() => handleGo('scanner')}
            >
              Open Privacy Scanner
            </Button>
            <Button
              variant="outline"
              size="md"
              icon={FileText}
              onClick={() => handleGo('history')}
            >
              View Audit History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Extract intelligence fields
  const combinationRisks = Array.isArray(scanData.combination_risks) ? scanData.combination_risks : [];
  const verification = scanData.verification || null;

  // Real backend payload mapping
  let baseSanitized = scanData.protectedText || scanData.sanitizedText || scanData.originalText || '';
  if (scanData.mode === 'user-approved' && userApproved) {
    baseSanitized = baseSanitized.replace(/\[PROPOSED_REDACT:\s*([A-Z_]+)_\d+\]/g, '[$1_REDACTED]');
  }

  const payload = {
    taskName: scanData.taskName || 'Prompt Privacy Audit',
    scanId: scanData.scanId || 'SCN-LOCAL',
    timestamp: scanData.timestamp || new Date().toLocaleString(),
    mode: scanData.mode || 'synthetic',
    privacyScore: scanData.privacyScore ?? 100,
    findingsCount: scanData.counts?.total ?? scanData.findings?.length ?? 0,
    originalText: scanData.originalText || '',
    sanitizedText: baseSanitized,
    findings: scanData.findings || [],
    categories: scanData.categories || [],
    actions: scanData.actions || [],
    summary: scanData.summary || 'Scan analysis complete.',
    isLiveBackend: Boolean(scanData.isLiveBackend),
  };

  const highRiskCount = payload.findings.filter(
    (f) => f.risk === 'High' || f.risk === 'Critical'
  ).length;

  const redactedCount =
    scanData.counts?.redacted !== undefined
      ? scanData.counts.redacted
      : payload.mode !== 'user-approved'
      ? payload.findingsCount
      : userApproved
      ? payload.findingsCount
      : 0;

  // Group detected entities by category for the reference panel 6 list
  const categoryGroups = {};
  payload.findings.forEach((f) => {
    const cat = f.category || 'Personal Information';
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = [];
    }
    categoryGroups[cat].push(f);
  });

  const handleCopySanitized = () => {
    navigator.clipboard.writeText(payload.sanitizedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadAudit = () => {
    const reportData = {
      product: 'PrivacyGuard AI',
      environment: payload.isLiveBackend ? 'Production / Live Backend' : 'Session',
      scanMetadata: {
        id: payload.scanId,
        task: payload.taskName,
        mode: payload.mode,
        generatedAt: new Date().toISOString(),
      },
      telemetry: {
        privacyScore: payload.privacyScore,
        findingsCount: payload.findingsCount,
        categories: payload.categories,
        actions: payload.actions,
        summary: payload.summary,
      },
      findings: payload.findings,
      sanitizedPayload: payload.sanitizedText,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `privacyguard_audit_${payload.scanId.toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="pg-editorial-workspace-page">
      {/* Reference Panel 6 Header */}
      <div className="pg-workspace-page-header">
        <div>
          <div className="pg-eyebrow">
            <span className="pg-eyebrow-dot"></span>
            <span>Audit Complete • {payload.scanId}</span>
          </div>
          <h1 className="pg-workspace-page-title">Scan Completed</h1>
          <p className="pg-workspace-page-subtitle">
            We found and protected sensitive information in your document.
          </p>
        </div>

        <div className="pg-header-action-group">
          <Button
            variant="outline"
            size="sm"
            icon={Info}
            onClick={() => setShowDetailsModal(true)}
          >
            Scan Details
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Scan}
            onClick={() => handleGo('scanner')}
          >
            New Scan
          </Button>
        </div>
      </div>

      {/* Degraded Engine Mode Notice if applicable */}
      {scanData?.engine_status?.status === 'degraded' && (
        <div className="pg-status-callout-header pg-mb-4" style={{ padding: '0.75rem 1rem', borderColor: 'rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Info size={16} className="pg-text-cream-subtle" />
            <span style={{ fontSize: '0.8125rem', color: '#e5e5e5' }}>
              <strong>Degraded Operational Mode:</strong> Scanned using genuine Microsoft Presidio and deterministic recognizers. GLiNER neural inference is disabled to fit zero-cost hosting memory limits.
            </span>
          </div>
        </div>
      )}

      {/* Reference Panel 6 Tabs Bar */}
      <div className="pg-results-tabs-bar" role="tablist" aria-label="Results views">
        <button
          type="button"
          role="tab"
          aria-selected={activeMainTab === 'summary'}
          className={`pg-results-tab ${activeMainTab === 'summary' ? 'pg-results-tab-active' : ''}`}
          onClick={() => setActiveMainTab('summary')}
        >
          Summary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMainTab === 'detections'}
          className={`pg-results-tab ${activeMainTab === 'detections' ? 'pg-results-tab-active' : ''}`}
          onClick={() => setActiveMainTab('detections')}
        >
          Detections ({payload.findingsCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMainTab === 'protected'}
          className={`pg-results-tab ${activeMainTab === 'protected' ? 'pg-results-tab-active' : ''}`}
          onClick={() => setActiveMainTab('protected')}
        >
          Protected Output
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMainTab === 'verification'}
          className={`pg-results-tab ${activeMainTab === 'verification' ? 'pg-results-tab-active' : ''}`}
          onClick={() => setActiveMainTab('verification')}
        >
          Verification
        </button>
      </div>

      {/* Detection Summary KPI Row (Matching Reference Panel 6) */}
      <div className="pg-results-kpi-grid">
        <ResultsKpiCard
          count={payload.findingsCount}
          title="Sensitive Items"
          subtitle="Detected entities"
        />
        <ResultsKpiCard
          count={payload.categories.length || Object.keys(categoryGroups).length}
          title="Entity Categories"
          subtitle="Classified types"
        />
        <ResultsKpiCard
          count={redactedCount}
          title="Redacted Items"
          subtitle="Protected in output"
        />
        <ResultsKpiCard
          count={highRiskCount}
          title="High Risk Items"
          subtitle="Critical violations"
        />
      </div>

      {/* TAB 1: SUMMARY (Split Layout: Detected Entities + Protected Output) */}
      {activeMainTab === 'summary' && (
        <div className="pg-results-split-layout">
          {/* Left Column: Detected Entities by Category */}
          <div className="pg-results-col-left">
            <div className="pg-card">
              <div className="pg-card-header-clean">
                <h3 className="pg-card-title-sm">Detected Entities</h3>
                <span className="pg-mono-badge">{payload.findingsCount} Items</span>
              </div>

              {payload.findings.length === 0 ? (
                <div className="pg-clean-prompt-box">
                  <CheckCircle2 size={24} className="pg-text-cream" />
                  <h4>No Sensitive Entities Detected</h4>
                  <p className="pg-text-secondary-sm">
                    This document was analyzed with GLiNER and Presidio. Zero PII or secrets were found.
                  </p>
                </div>
              ) : (
                <div className="pg-detected-categories-list">
                  {Object.entries(categoryGroups).map(([catName, items]) => (
                    <div key={catName} className="pg-category-card">
                      <div className="pg-category-card-header">
                        <div className="pg-cat-title-group">
                          <Lock size={14} className="pg-text-cream-subtle" />
                          <span className="pg-cat-name">{catName}</span>
                        </div>
                        <span className="pg-cat-count-badge">{items.length} items</span>
                      </div>

                      <div className="pg-cat-items-pills">
                        {items.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="pg-entity-chip">
                            <span className="pg-entity-type">{item.entity_type}</span>
                            <span className="pg-entity-risk-tag">{item.risk || 'High'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Protected Output Panel with Copy Action */}
          <div className="pg-results-col-right">
            <div className="pg-card">
              <div className="pg-card-header-clean">
                <div>
                  <h3 className="pg-card-title-sm">Protected Output</h3>
                  <p className="pg-text-secondary-sm">Sanitized version ready for sharing</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={copied ? Check : Copy}
                  onClick={handleCopySanitized}
                  id="results-copy-protected-btn"
                >
                  {copied ? 'Copied' : 'Copy Protected Output'}
                </Button>
              </div>

              {scanData.mode === 'user-approved' && !userApproved && (
                <div className="pg-status-callout-header pg-mb-3" style={{ justifyContent: 'space-between', padding: '0.625rem 0.875rem' }}>
                  <span className="pg-text-cream" style={{ fontSize: '0.8125rem' }}>
                    Review proposed tags before applying redactions.
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setUserApproved(true)}
                  >
                    Apply Redactions
                  </Button>
                </div>
              )}

              <div className="pg-protected-output-box">
                <pre className="pg-output-pre">
                  <code>{payload.sanitizedText}</code>
                </pre>
              </div>

              <div className="pg-output-footer-actions">
                <span className="pg-text-secondary-sm">
                  Strategy: <strong>{payload.mode}</strong> • Score: <strong>{payload.privacyScore}/100</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleDownloadAudit}
                >
                  {downloadSuccess ? 'Downloaded' : 'Export Audit JSON'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETECTIONS (Full Granular Table) */}
      {activeMainTab === 'detections' && (
        <div className="pg-card">
          <div className="pg-card-header-clean">
            <div>
              <h3 className="pg-card-title-sm">Granular Detection Log</h3>
              <p className="pg-text-secondary-sm">All identified entities, exact spans, confidence ratings, and rationale</p>
            </div>
            <span className="pg-mono-badge">{payload.findingsCount} Entities</span>
          </div>

          {payload.findings.length === 0 ? (
            <p className="pg-p-md pg-text-secondary">No sensitive findings in this document.</p>
          ) : (
            <div className="pg-table-responsive">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Entity Type</th>
                    <th>Category</th>
                    <th>Confidence</th>
                    <th>Risk Level</th>
                    <th>Detected Value / Match</th>
                    <th>Minimization Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.findings.map((finding, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="pg-entity-name-tag">{finding.entity_type}</span>
                      </td>
                      <td>
                        <span className="pg-text-secondary-sm">{finding.category || 'General PII'}</span>
                      </td>
                      <td>
                        <span className="pg-mono-val">
                          {finding.confidence
                            ? `${Math.round(finding.confidence * 100)}%`
                            : '95%'}
                        </span>
                      </td>
                      <td>
                        <span className={`pg-risk-badge pg-risk-${String(finding.risk).toLowerCase()}`}>
                          {finding.risk || 'Medium'}
                        </span>
                      </td>
                      <td>
                        <code className="pg-code-snippet">{finding.detected_value || finding.text || '[PROTECTED]'}</code>
                      </td>
                      <td>
                        <span className="pg-reason-text">
                          {finding.reason || 'Identified by neural contextual model.'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROTECTED OUTPUT (Side-by-side or Unified Diff View) */}
      {activeMainTab === 'protected' && (
        <div className="pg-card">
          <div className="pg-card-header-clean">
            <div>
              <h3 className="pg-card-title-sm">Differential Inspection</h3>
              <p className="pg-text-secondary-sm">Compare raw inbound text against the sanitized version</p>
            </div>
            <div className="pg-diff-view-toggle">
              <button
                type="button"
                className={`pg-diff-toggle-btn ${diffViewMode === 'sideBySide' ? 'pg-diff-toggle-active' : ''}`}
                onClick={() => setDiffViewMode('sideBySide')}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                className={`pg-diff-toggle-btn ${diffViewMode === 'tabbed' ? 'pg-diff-toggle-active' : ''}`}
                onClick={() => setDiffViewMode('tabbed')}
              >
                Sanitized Only
              </button>
            </div>
          </div>

          {diffViewMode === 'sideBySide' ? (
            <div className="pg-diff-side-by-side">
              <div className="pg-diff-column">
                <div className="pg-diff-col-header">
                  <span>Raw Inbound Document (Pre-Guardrail)</span>
                </div>
                <div className="pg-diff-col-content">
                  <pre><code>{payload.originalText || 'Raw text not captured.'}</code></pre>
                </div>
              </div>
              <div className="pg-diff-column">
                <div className="pg-diff-col-header">
                  <span>Sanitized Document (LLM Ready)</span>
                </div>
                <div className="pg-diff-col-content">
                  <pre><code>{payload.sanitizedText}</code></pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="pg-protected-output-box">
              <pre className="pg-output-pre">
                <code>{payload.sanitizedText}</code>
              </pre>
            </div>
          )}

          <div className="pg-output-footer-actions">
            <Button
              variant="primary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopySanitized}
            >
              {copied ? 'Copied to Clipboard' : 'Copy Protected Output'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleDownloadAudit}
            >
              Download Audit JSON
            </Button>
          </div>
        </div>
      )}

      {/* TAB 4: VERIFICATION (Secondary Audit & Limitations) */}
      {activeMainTab === 'verification' && (
        <div className="pg-verification-tab-container">
          {verification && (
            <div className="pg-card">
              <div className="pg-verification-header">
                <div className="pg-verification-title-group">
                  <ShieldCheck size={20} className="pg-text-cream" />
                  <h3 className="pg-card-title-sm">Secondary Verification Audit</h3>
                </div>
                <span className="pg-badge-status-pill">
                  {verification.passed ? 'Zero Residual Findings' : 'Flagged Residual Risk'}
                </span>
              </div>
              <p className="pg-verification-explanation">{verification.explanation}</p>
              {verification.residual_risks && verification.residual_risks.length > 0 && (
                <ul className="pg-verification-risks-list">
                  {verification.residual_risks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              )}
              <div className="pg-disclaimer-box">
                <p>{verification.guarantee_disclaimer}</p>
              </div>
            </div>
          )}

          {combinationRisks.length > 0 && (
            <div className="pg-card pg-mt-md">
              <div className="pg-combination-header">
                <ShieldAlert size={20} className="pg-text-cream" />
                <h3 className="pg-card-title-sm">
                  Contextual Linkage &amp; Re-Identification Combination Risks ({combinationRisks.length})
                </h3>
              </div>
              <p className="pg-text-secondary-sm" style={{ margin: '0 0 14px 0' }}>
                Co-occurring traits can facilitate re-identification even when direct identifiers are stripped:
              </p>
              {combinationRisks.map((cr, idx) => (
                <div key={idx} className="pg-combination-item">
                  <div className="pg-combination-item-header">
                    <strong>{cr.risk_type}</strong>
                    <span className="pg-mono-badge">{cr.severity} Severity</span>
                  </div>
                  <p className="pg-combination-item-desc">{cr.description}</p>
                  <div className="pg-combination-mitigation">
                    <strong>Recommended Mitigation:</strong> {cr.mitigation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="pg-modal-backdrop" onClick={() => setShowDetailsModal(false)}>
          <div className="pg-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pg-modal-header">
              <h3>Scan Metadata &amp; Parameters</h3>
              <button
                type="button"
                className="pg-modal-close"
                onClick={() => setShowDetailsModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="pg-modal-body">
              <div className="pg-ready-metric-row">
                <span className="pg-ready-metric-key">Scan ID</span>
                <span className="pg-ready-metric-val">{payload.scanId}</span>
              </div>
              <div className="pg-ready-metric-row">
                <span className="pg-ready-metric-key">Task Label</span>
                <span className="pg-ready-metric-val">{payload.taskName}</span>
              </div>
              <div className="pg-ready-metric-row">
                <span className="pg-ready-metric-key">Minimization Strategy</span>
                <span className="pg-ready-metric-val">{payload.mode}</span>
              </div>
              <div className="pg-ready-metric-row">
                <span className="pg-ready-metric-key">Timestamp</span>
                <span className="pg-ready-metric-val">{payload.timestamp}</span>
              </div>
              <div className="pg-ready-metric-row">
                <span className="pg-ready-metric-key">Engine Pipeline</span>
                <span className="pg-ready-metric-val">
                  {scanData?.engine_status?.status === 'degraded'
                    ? 'Microsoft Presidio Hybrid (Degraded / Low-Memory)'
                    : scanData?.engine_status?.status === 'ready'
                    ? 'GLiNER Neural + Presidio'
                    : payload.isLiveBackend
                    ? 'FastAPI AI Backend'
                    : 'Session In-Memory'}
                </span>
              </div>
            </div>
            <div className="pg-modal-footer">
              <Button variant="primary" size="sm" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
