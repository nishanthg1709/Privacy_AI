import { useNavigate } from 'react-router-dom';
import {
  Scan,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Eye,
  History,
  BarChart3,
  Settings,
  ChevronRight,
  Terminal,
  FileText,
  Sparkles
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Button from '../components/Button';
import dashboardTechImg from '../assets/dashboard-workspace-tech.jpg';

/**
 * Editorial Dashboard Page
 * Matches Panel 4 of the reference design:
 * - Welcome Back, Your Workspace hero banner with laptop security artwork
 * - 4 Workspace Action Cards: New Scan, Scan History, Analytics, Settings
 * - Real activity and statistics strictly derived from actual scans
 * - Truthful empty state when no scans exist
 */
export default function Dashboard({ onNavigate, onSelectScan, scanHistory = [], isCloud = false }) {
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
      {/* Welcome Hero Area (Matching Reference Panel 4) */}
      <section className="pg-workspace-hero-panel" aria-label="Privacy Workspace Welcome">
        <div className="pg-workspace-hero-body">
          <span className="pg-workspace-greeting">Welcome Back,</span>
          <h1 className="pg-workspace-heading">Your Workspace</h1>
          <p className="pg-workspace-subheading">
            Scan, protect, and review your documents with privacy in mind.
          </p>

          <div className="pg-hero-actions-row">
            <Button
              variant="primary"
              size="md"
              icon={Scan}
              iconAfter={ArrowRight}
              onClick={() => handleGo('scanner')}
              id="dashboard-start-scan-btn"
            >
              New Privacy Scan
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={History}
              onClick={() => handleGo('history')}
              id="dashboard-view-history-btn"
            >
              Audit History ({totalScans})
            </Button>
          </div>
        </div>

        <div className="pg-workspace-hero-graphic">
          <img
            src={dashboardTechImg}
            alt="Monochrome security workstation with protected documents"
            className="pg-workspace-laptop-img"
          />
        </div>
      </section>

      {/* 4 Workspace Action Cards (Matching Reference Panel 4) */}
      <section className="pg-workspace-action-cards-grid" aria-label="Workspace Actions">
        <div
          className="pg-action-card"
          onClick={() => handleGo('scanner')}
          role="button"
          tabIndex={0}
        >
          <div className="pg-action-card-icon">
            <Scan size={20} />
          </div>
          <div className="pg-action-card-text">
            <h3 className="pg-action-card-title">New Scan</h3>
            <p className="pg-action-card-desc">Scan a document or paste text</p>
          </div>
          <ChevronRight size={16} className="pg-action-card-arrow" />
        </div>

        <div
          className="pg-action-card"
          onClick={() => handleGo('history')}
          role="button"
          tabIndex={0}
        >
          <div className="pg-action-card-icon">
            <History size={20} />
          </div>
          <div className="pg-action-card-text">
            <h3 className="pg-action-card-title">Scan History</h3>
            <p className="pg-action-card-desc">View your scan history</p>
          </div>
          <ChevronRight size={16} className="pg-action-card-arrow" />
        </div>

        <div
          className="pg-action-card"
          onClick={() => handleGo('analytics')}
          role="button"
          tabIndex={0}
        >
          <div className="pg-action-card-icon">
            <BarChart3 size={20} />
          </div>
          <div className="pg-action-card-text">
            <h3 className="pg-action-card-title">Analytics</h3>
            <p className="pg-action-card-desc">Track your usage and insights</p>
          </div>
          <ChevronRight size={16} className="pg-action-card-arrow" />
        </div>

        <div
          className="pg-action-card"
          onClick={() => handleGo('settings')}
          role="button"
          tabIndex={0}
        >
          <div className="pg-action-card-icon">
            <Settings size={20} />
          </div>
          <div className="pg-action-card-text">
            <h3 className="pg-action-card-title">Settings</h3>
            <p className="pg-action-card-desc">Manage your preferences</p>
          </div>
          <ChevronRight size={16} className="pg-action-card-arrow" />
        </div>
      </section>

      {/* Real Statistics Section */}
      <section className="pg-workspace-section" aria-label="Key Performance Indicators">
        <div className="pg-section-header">
          <div>
            <h2 className="pg-section-title">Telemetry &amp; Findings</h2>
            <p className="pg-section-subtitle">
              Cumulative metrics derived strictly from actual authenticated scans
            </p>
          </div>
          <span className="pg-badge-status-pill">
            {totalScans === 0
              ? 'Awaiting First Scan'
              : isCloud
              ? 'Supabase RLS Active'
              : 'Session Initialized'}
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

      {/* Activity and Recent Scans Section */}
      <section className="pg-workspace-section" aria-label="Recent Activity">
        <div className="pg-section-header">
          <div>
            <h2 className="pg-section-title">Recent Activity</h2>
            <p className="pg-section-subtitle">
              Verified executions and protected document logs
            </p>
          </div>
          {totalScans > 0 && (
            <button
              type="button"
              className="pg-editorial-link-btn"
              onClick={() => handleGo('history')}
            >
              <span>View Full History ({totalScans})</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {totalScans === 0 ? (
          /* Well-designed empty state */
          <div className="pg-empty-state-card" role="region" aria-label="No Recent Scans">
            <div className="pg-empty-icon-wrap">
              <Scan size={36} className="pg-text-cream-subtle" />
            </div>
            <h3 className="pg-empty-title">No Scan Activity Recorded Yet</h3>
            <p className="pg-empty-desc">
              Your recent scans and telemetry logs will display here as you audit documents.
              Paste a prompt or upload a text document in the Privacy Scanner to begin.
            </p>
            <div className="pg-empty-actions">
              <Button
                variant="primary"
                size="md"
                icon={Scan}
                onClick={() => handleGo('scanner')}
              >
                Start a Privacy Scan
              </Button>
            </div>
          </div>
        ) : (
          <div className="pg-card pg-p-0">
            <div className="pg-table-responsive">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Task &amp; Document</th>
                    <th>Entities Detected</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan, idx) => (
                    <tr key={scan.scanId || `recent-${idx}`}>
                      <td>
                        <div className="pg-table-task-cell">
                          <FileText size={16} className="pg-table-icon" />
                          <div>
                            <span className="pg-task-name">{scan.taskName || 'Prompt Privacy Audit'}</span>
                            <span className="pg-task-id">{scan.scanId || 'SCN-LOCAL'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="pg-mono-val">
                          {scan.findings?.length ?? scan.counts?.total ?? 0} sensitive items
                        </span>
                      </td>
                      <td>
                        <span className="pg-badge-status-pill">Protected</span>
                      </td>
                      <td>
                        <span className="pg-time-val">{scan.timestamp || 'Just now'}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pg-btn-inspect-sm"
                          onClick={() => handleInspectScan(scan)}
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Architecture Transparency Note */}
      <section className="pg-workspace-status-callout" role="note">
        <div className="pg-status-callout-header">
          <Sparkles size={14} className="pg-text-cream" />
          <strong>Local Neural Inference &amp; Zero-Log Storage</strong>
        </div>
        <p>
          PrivacyGuard AI processes prompts entirely in-memory using local GLiNER and Microsoft Presidio models.
          Raw source text and detected entity values are never written to disk, sent to external cloud APIs,
          or persisted in database records.
        </p>
      </section>
    </div>
  );
}
