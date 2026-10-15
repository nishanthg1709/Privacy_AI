import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  Eye,
  Scan,
  History,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Button from '../components/Button';

/**
 * Editorial ScanHistory Page Component
 * Searchable, filterable audit log populated from Supabase RLS database and active session scans.
 * If no scans exist, presents an honest empty state.
 * Never fabricates mock records.
 */
export default function ScanHistory({
  onNavigate,
  onSelectScan,
  scanHistory = [],
  isLoadingHistory = false,
  cloudSyncError = null,
  isCloud = false,
}) {
  const navigate = useNavigate();

  const handleGo = (pageId, data) => {
    if (pageId === 'results' && onSelectScan) {
      onSelectScan(data);
      navigate('/app/results', { state: { scanData: data } });
    } else if (onNavigate) {
      onNavigate(pageId);
    } else {
      navigate(`/app/${pageId}`, { state: { scanData: data } });
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL'); // 'ALL' | 'High' | 'Medium' | 'Low' | 'Clean'
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Filter actual session records
  const filteredRecords = useMemo(() => {
    return scanHistory.filter((item) => {
      const task = (item.taskName || '').toLowerCase();
      const id = (item.scanId || '').toLowerCase();
      const categories = (item.categories || []).join(' ').toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !query ||
        task.includes(query) ||
        id.includes(query) ||
        categories.includes(query);

      const findingsCount = item.findings?.length ?? item.counts?.total ?? 0;
      const hasHighRisk = item.findings?.some((f) => f.risk === 'High' || f.risk === 'Critical');
      const hasMedRisk = item.findings?.some((f) => f.risk === 'Medium');

      let itemRisk = 'Clean';
      if (hasHighRisk) itemRisk = 'High';
      else if (hasMedRisk) itemRisk = 'Medium';
      else if (findingsCount > 0) itemRisk = 'Low';

      const matchesRisk =
        filterRisk === 'ALL' || itemRisk.toLowerCase() === filterRisk.toLowerCase();

      return matchesSearch && matchesRisk;
    });
  }, [scanHistory, searchQuery, filterRisk]);

  // Export CSV of actual session records
  const handleExportCSV = () => {
    if (scanHistory.length === 0) return;

    const headers = [
      'Scan ID',
      'Task Name',
      'Timestamp',
      'Mode',
      'Findings Count',
      'Categories',
      'Privacy Score',
    ];

    const rows = scanHistory.map((r) => [
      `"${r.scanId || ''}"`,
      `"${(r.taskName || '').replace(/"/g, '""')}"`,
      `"${r.timestamp || ''}"`,
      `"${r.mode || ''}"`,
      r.findings?.length ?? r.counts?.total ?? 0,
      `"${(r.categories || []).join('; ')}"`,
      r.privacyScore ?? 100,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `privacyguard_session_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="pg-editorial-workspace-page">
      {/* Header */}
      <div className="pg-workspace-page-header">
        <div>
          <h1 className="pg-workspace-page-title">Privacy Audit History &amp; Logs</h1>
          <p className="pg-workspace-page-subtitle">
            Immutable session audit records of prompts, API payloads, and minimization actions.
          </p>
        </div>

        <div className="pg-header-action-group">
          <Button
            variant="primary"
            size="sm"
            icon={Scan}
            onClick={() => handleGo('scanner')}
          >
            New Scan
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={handleExportCSV}
            disabled={scanHistory.length === 0}
            title="Download CSV report of current session audit logs"
          >
            {downloadSuccess ? 'Downloaded CSV' : 'Export Audit CSV'}
          </Button>
        </div>
      </div>

      {/* Supabase Cloud Sync Warning Notice */}
      {cloudSyncError && (
        <div className="pg-auth-error-banner pg-mb-4" role="alert">
          <AlertCircle size={16} />
          <span>
            Supabase history notice: {cloudSyncError}. If you haven&rsquo;t run the database migration yet, please execute <code>supabase/schema.sql</code> in your Supabase SQL Editor. Session records are preserved.
          </span>
        </div>
      )}

      {/* Loading State or Honest Empty State */}
      {isLoadingHistory ? (
        <div className="pg-empty-state-card" role="status" aria-live="polite">
          <div className="pg-empty-icon-wrap">
            <RefreshCw size={36} className="pg-text-cream-subtle pg-spin" />
          </div>
          <h2 className="pg-empty-title">Loading Audit History...</h2>
          <p className="pg-empty-desc">
            Retrieving authenticated scan telemetry from your Supabase PostgreSQL database.
          </p>
        </div>
      ) : scanHistory.length === 0 ? (
        <div className="pg-empty-state-card" role="region" aria-label="No Historical Scans">
          <div className="pg-empty-icon-wrap">
            <History size={36} className="pg-text-cream-subtle" />
          </div>
          <h2 className="pg-empty-title">No Audit Logs Recorded in Current Session</h2>
          <p className="pg-empty-desc">
            Audit logs are generated each time a prompt or document is analyzed through the Privacy Scanner endpoint.
            No scans have been executed in this session yet.
          </p>
          <div className="pg-empty-actions">
            <Button
              variant="primary"
              size="md"
              icon={Scan}
              onClick={() => handleGo('scanner')}
            >
              Start First Scan
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Controls Bar: Search and Risk Filter Pills */}
          <div className="pg-history-controls-card">
            <div className="pg-search-input-wrap">
              <Search size={16} className="pg-search-icon" />
              <input
                type="text"
                className="pg-search-input"
                placeholder="Search audit records by task title, scan ID, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search scan records"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="pg-search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="pg-filter-pills" role="radiogroup" aria-label="Filter by Risk">
              <span className="pg-filter-label">
                <Filter size={13} />
                <span>Filter:</span>
              </span>
              {['ALL', 'High', 'Medium', 'Low', 'Clean'].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`pg-filter-pill ${
                    filterRisk === level ? 'pg-filter-pill-active' : ''
                  }`}
                  onClick={() => setFilterRisk(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="pg-table-card">
            <div className="pg-section-header">
              <div>
                <h2 className="pg-section-title">Audit Records</h2>
                <p className="pg-section-subtitle">
                  Showing {filteredRecords.length} of {scanHistory.length} active records
                </p>
              </div>
              <span className="pg-badge-status-inline">
                {isCloud ? 'Supabase Cloud RLS' : 'Live Session Storage'}
              </span>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="pg-table-empty-row">
                <span>No audit records matched your search query or filter.</span>
              </div>
            ) : (
              <div className="pg-table-responsive">
                <table className="pg-table" aria-label="Audit Records Table">
                  <thead>
                    <tr>
                      <th scope="col">Scan ID &amp; Task</th>
                      <th scope="col">Timestamp</th>
                      <th scope="col">Minimization Strategy</th>
                      <th scope="col">Entities Detected</th>
                      <th scope="col">Categories</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="pg-text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((item) => {
                      const count = item.findings?.length ?? item.counts?.total ?? 0;
                      return (
                        <tr key={item.scanId} className="pg-table-row">
                          <td>
                            <div className="pg-scan-primary-cell">
                              <span className="pg-scan-id">{item.scanId}</span>
                              <span className="pg-scan-name">{item.taskName}</span>
                            </div>
                          </td>
                          <td className="pg-table-muted">
                            {new Date(item.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <span className="pg-mode-badge">{item.mode}</span>
                          </td>
                          <td>
                            <span className="pg-entities-count-pill">
                              {count} {count === 1 ? 'entity' : 'entities'}
                            </span>
                          </td>
                          <td className="pg-table-muted">
                            <span className="pg-entities-list-truncated">
                              {(item.categories || []).slice(0, 2).join(', ') || (count === 0 ? 'None' : 'Sensitive')}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`pg-status-pill ${
                                count === 0 ? 'pg-status-clean' : 'pg-status-protected'
                              }`}
                            >
                              {count === 0 ? 'Clean' : 'Protected'}
                            </span>
                          </td>
                          <td className="pg-text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              onClick={() => handleGo('results', item)}
                              aria-label={`Inspect ${item.taskName} results`}
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
