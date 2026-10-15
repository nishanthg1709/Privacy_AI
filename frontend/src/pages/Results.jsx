import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Download,
  FileText,
  Scan,
  Sparkles,
  Lock,
  Layers,
  Split,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  CheckSquare
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Button from '../components/Button';

/**
 * Editorial Results Page Component
 * Renders actual scan outputs returned from the PrivacyGuard backend.
 * Never displays hardcoded fake results. If no scan has been performed,
 * presents an honest empty state prompting the user to launch a scan.
 */
export default function Results({ onNavigate, scanData: propScanData }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Allow scan data from router state or props
  const scanData = propScanData || location.state?.scanData;

  const handleGo = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    } else {
      navigate(`/app/${pageId}`);
    }
  };

  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('sideBySide'); // 'sideBySide' | 'tabbed'
  const [activeTab, setActiveTab] = useState('sanitized'); // for tabbed view
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [userApproved, setUserApproved] = useState(false);

  // If no scan data is available, render an honest empty state
  if (!scanData) {
    return (
      <div className="pg-editorial-workspace-page">
        <div className="pg-workspace-page-header">
          <div>
            <h1 className="pg-workspace-page-title">Sanitized Payload &amp; Audit Report</h1>
            <p className="pg-workspace-page-subtitle">
              Side-by-side inspection of intercepted PII and transformed outputs ready for LLM consumption.
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
      {/* Header and Actions */}
      <div className="pg-workspace-page-header">
        <div>
          <button
            type="button"
            className="pg-breadcrumb-back"
            onClick={() => handleGo('scanner')}
          >
            <ArrowLeft size={14} />
            <span>Back to Scanner Studio</span>
          </button>
          <h1 className="pg-workspace-page-title">Sanitized Payload &amp; Audit Report</h1>
          <p className="pg-workspace-page-subtitle">
            Side-by-side inspection of intercepted PII and transformed outputs ready for LLM consumption.
          </p>
        </div>

        <div className="pg-header-action-group">
          <Button
            variant="secondary"
            size="sm"
            icon={Scan}
            onClick={() => handleGo('scanner')}
          >
            Scan Another
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={handleCopySanitized}
            id="results-copy-btn"
          >
            {copied ? 'Copied Clean Text' : 'Copy Sanitized Output'}
          </Button>
        </div>
      </div>

      {/* User-Approved Mode Review Action Banner (Task 6.4 & Task 11.4) */}
      {payload.mode === 'user-approved' && (
        <div className="pg-approval-banner" role="region" aria-label="User Approval Controls">
          <div className="pg-approval-text">
            <h3>
              {userApproved ? 'Redactions Confirmed by User' : 'Proposed Redactions Awaiting Confirmation'}
            </h3>
            <p>
              {userApproved
                ? 'Proposed candidate entities have been explicitly reviewed and approved for this session.'
                : 'User-approved mode displays proposed candidate tokens without destructive replacement. Confirm proposed redactions to finalize sanitization.'}
            </p>
          </div>
          {!userApproved ? (
            <Button
              variant="primary"
              size="sm"
              icon={CheckSquare}
              onClick={() => setUserApproved(true)}
            >
              Approve All Proposed Redactions
            </Button>
          ) : (
            <span className="pg-verification-passed-badge">
              <CheckCircle2 size={13} />
              <span>Approved</span>
            </span>
          )}
        </div>
      )}

      {/* Real Scan Summary Banner */}
      <div className="pg-banner pg-banner-info" role="region" aria-label="Scan summary">
        <div className="pg-banner-icon">
          <CheckCircle2 size={17} className="pg-text-cream" />
        </div>
        <div className="pg-banner-content">
          <strong>Backend Analysis Summary:</strong> {payload.summary}
        </div>
      </div>

      {/* Contextual Linkage Combination Risks (Task 11.2) */}
      {combinationRisks.length > 0 && (
        <div className="pg-combination-card" role="region" aria-label="Combination Risks">
          <div className="pg-combination-header">
            <ShieldAlert size={20} className="pg-text-amber" />
            <h3 className="pg-combination-title">
              Contextual Linkage &amp; Re-Identification Combination Risks ({combinationRisks.length})
            </h3>
          </div>
          <p className="pg-text-secondary-sm" style={{ margin: '0 0 10px 0', color: 'var(--pg-cream-300)' }}>
            Individual non-secret entities can become identifying when co-occurring with other traits. Automated contextual analysis detected the following linkage patterns:
          </p>
          {combinationRisks.map((cr, idx) => (
            <div key={idx} className="pg-combination-item">
              <div className="pg-combination-item-header">
                <strong style={{ color: '#fca5a5', fontSize: '0.86rem' }}>{cr.risk_type}</strong>
                <span className={`pg-risk-badge pg-risk-${String(cr.severity).toLowerCase()}`}>{cr.severity}</span>
              </div>
              <p className="pg-combination-item-desc">{cr.description}</p>
              <div className="pg-combination-mitigation">
                <strong>Recommended Mitigation:</strong> {cr.mitigation}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary KPI Cards populated from actual scan */}
      <div className="pg-stats-grid">
        <StatCard
          title="Privacy Guardrail Score"
          value={`${payload.privacyScore} / 100`}
          trend={payload.findingsCount === 0 ? 'Zero Sensitive Findings' : `${payload.findingsCount} Protected`}
          trendUp={true}
          icon={ShieldCheck}
          subtitle="Real-time compliance rating"
        />

        <StatCard
          title="Sensitive Entities Detected"
          value={payload.findingsCount}
          trend={payload.findingsCount === 0 ? 'Clean Prompt' : 'Neutralized before model'}
          trendUp={true}
          icon={Lock}
          subtitle={`Categories: ${payload.categories.slice(0, 2).join(', ') || 'None'}`}
        />

        <StatCard
          title="LLM Ingestion Readiness"
          value={payload.findingsCount === 0 ? 'SAFE TO SEND' : 'READY (PROTECTED)'}
          trend={`Strategy: ${payload.mode}`}
          trendUp={true}
          icon={Sparkles}
          subtitle="Prompt sanitized for inference dispatch"
        />

        <StatCard
          title="Audit Record ID"
          value={payload.scanId}
          trend={payload.isLiveBackend ? 'Live Backend API' : 'Session Scan'}
          trendUp={true}
          icon={FileText}
          subtitle={`Logged: ${new Date(payload.timestamp).toLocaleTimeString()}`}
        />
      </div>

      {/* Secondary Verification Audit Card (Task 6 & Task 13) */}
      {verification && (
        <div className="pg-verification-card" role="region" aria-label="Verification Audit">
          <div className="pg-verification-header">
            <div className="pg-verification-title-group">
              <ShieldCheck size={18} className={verification.passed ? 'pg-text-mint' : 'pg-text-amber'} />
              <h3 className="pg-verification-title">Secondary Verification &amp; Residual Risk Audit</h3>
            </div>
            {verification.passed ? (
              <span className="pg-verification-passed-badge">
                <CheckCircle2 size={13} />
                <span>Verification Passed (0 Residual Findings)</span>
              </span>
            ) : (
              <span className="pg-verification-alert-badge">
                <AlertTriangle size={13} />
                <span>Residual Findings ({verification.residual_findings_count})</span>
              </span>
            )}
          </div>
          <p className="pg-verification-explanation">{verification.explanation}</p>
          {verification.residual_risks && verification.residual_risks.length > 0 && (
            <ul className="pg-verification-risks-list">
              {verification.residual_risks.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          )}
          <p className="pg-verification-disclaimer">
            {verification.guarantee_disclaimer}
          </p>
        </div>
      )}

      {/* Inspection View Controls */}
      <div className="pg-results-inspect-card">
        <div className="pg-inspect-header">
          <div className="pg-inspect-title-group">
            <h2 className="pg-inspect-title">
              <span>Inspection View:</span>{' '}
              <strong className="pg-text-cream">{payload.taskName}</strong>
            </h2>
            <span className="pg-badge-mode">{payload.mode}</span>
          </div>

          <div className="pg-inspect-actions">
            <div className="pg-view-toggle-group" role="group" aria-label="View Mode">
              <button
                type="button"
                className={`pg-toggle-btn ${viewMode === 'sideBySide' ? 'pg-toggle-active' : ''}`}
                onClick={() => setViewMode('sideBySide')}
                aria-pressed={viewMode === 'sideBySide'}
              >
                <Split size={14} />
                <span>Side by Side</span>
              </button>
              <button
                type="button"
                className={`pg-toggle-btn ${viewMode === 'tabbed' ? 'pg-toggle-active' : ''}`}
                onClick={() => setViewMode('tabbed')}
                aria-pressed={viewMode === 'tabbed'}
              >
                <Layers size={14} />
                <span>Tabbed</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleDownloadAudit}
              title="Download audit JSON log"
            >
              {downloadSuccess ? 'Downloaded JSON' : 'Export Audit JSON'}
            </Button>
          </div>
        </div>

        {/* Side-by-Side Comparison Container */}
        {viewMode === 'sideBySide' ? (
          <div className="pg-diff-grid">
            {/* Raw Input Column */}
            <div className="pg-diff-col">
              <div className="pg-diff-col-header pg-diff-raw">
                <span className="pg-diff-status-dot pg-dot-amber"></span>
                <span>Original Payload (Raw Inbound)</span>
                {payload.findingsCount > 0 ? (
                  <span className="pg-diff-tag pg-diff-tag-amber">Contains Sensitive PII</span>
                ) : (
                  <span className="pg-diff-tag pg-diff-tag-mint">Clean</span>
                )}
              </div>
              <div className="pg-diff-content pg-code-view">
                <pre>{payload.originalText}</pre>
              </div>
            </div>

            {/* Sanitized Output Column */}
            <div className="pg-diff-col">
              <div className="pg-diff-col-header pg-diff-clean">
                <span className="pg-diff-status-dot pg-dot-mint"></span>
                <span>Sanitized Output (Safe for LLM)</span>
                <span className="pg-diff-tag pg-diff-tag-mint">Protected</span>
              </div>
              <div className="pg-diff-content pg-code-view pg-code-clean">
                <pre>{payload.sanitizedText}</pre>
              </div>
            </div>
          </div>
        ) : (
          /* Tabbed View */
          <div className="pg-tabbed-diff-view">
            <div className="pg-tabs-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sanitized'}
                className={`pg-tab-btn ${activeTab === 'sanitized' ? 'pg-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('sanitized')}
              >
                Sanitized Output (Safe)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'original'}
                className={`pg-tab-btn ${activeTab === 'original' ? 'pg-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('original')}
              >
                Original Raw Input
              </button>
            </div>

            <div className="pg-tab-panel pg-code-view">
              <pre>
                {activeTab === 'sanitized' ? payload.sanitizedText : payload.originalText}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Detected Entities Breakdown Table */}
      <div className="pg-table-card">
        <div className="pg-section-header">
          <div>
            <h2 className="pg-section-title">Detected Entities Breakdown</h2>
            <p className="pg-section-subtitle">
              Inventory of flagged tokens, contextual risk reasons, and explainable minimization recommendations
            </p>
          </div>
          <span className="pg-badge-status-inline">
            {payload.findings.length} Entit{payload.findings.length === 1 ? 'y' : 'ies'} Found
          </span>
        </div>

        {payload.findings.length === 0 ? (
          <div className="pg-table-empty-row">
            <CheckCircle2 size={18} className="pg-text-mint" />
            <span>No sensitive items or secrets detected. The input was verified clean.</span>
          </div>
        ) : (
          <div className="pg-table-responsive">
            <table className="pg-table" aria-label="Detected Entities Table">
              <thead>
                <tr>
                  <th scope="col">Entity Category &amp; Source</th>
                  <th scope="col">Classification Type</th>
                  <th scope="col">Original Snippet</th>
                  <th scope="col">Sanitized Equivalent</th>
                  <th scope="col">Minimization Advice</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Risk Level</th>
                  <th scope="col">Action Taken</th>
                </tr>
              </thead>
              <tbody>
                {payload.findings.map((item, idx) => (
                  <tr key={item.id || idx} className="pg-table-row">
                    <td>
                      <div>
                        <span className="pg-entity-category">{item.category || 'General'}</span>
                        <div className="pg-source-tag">Source: {item.source || 'gliner_ai'}</div>
                      </div>
                    </td>
                    <td>
                      <strong className="pg-text-primary">{item.type}</strong>
                    </td>
                    <td>
                      <code className="pg-code-snippet pg-code-danger">
                        {item.originalSnippet || '[REDACTED]'}
                      </code>
                    </td>
                    <td>
                      <code className="pg-code-snippet pg-code-success">
                        {item.sanitizedSnippet || '[PROTECTED]'}
                      </code>
                    </td>
                    <td>
                      {item.recommendation ? (
                        <div title={item.recommendation_reason || ''}>
                          <span className={`pg-recommendation-pill ${
                            item.recommendation === 'Remove'
                              ? 'pg-recommendation-remove'
                              : item.recommendation === 'Generalize'
                              ? 'pg-recommendation-generalize'
                              : ''
                          }`}>
                            {item.recommendation}
                          </span>
                        </div>
                      ) : (
                        <span className="pg-text-secondary-sm">—</span>
                      )}
                    </td>
                    <td>
                      <div>
                        <span className="pg-confidence-badge">{item.confidence}</span>
                        {item.is_uncertain && (
                          <div className="pg-uncertainty-tag" title={item.uncertainty_reason || 'Borderline confidence'}>
                            <span>Review</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span
                          className={`pg-risk-badge pg-risk-${String(item.risk).toLowerCase()}`}
                        >
                          {item.risk}
                        </span>
                        {item.risk_reason && (
                          <div className="pg-source-tag" style={{ maxWidth: '180px', lineHeight: 1.3 }}>
                            {item.risk_reason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="pg-action-badge">{item.action || 'Protected'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
