import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Eye,
  Scan,
  History,
  RefreshCw,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Button from '../components/Button';

/**
 * Editorial ScanHistory Page Component
 * Faithfully matches Panel 7 of the reference design:
 * - Search bar with filter dropdowns: All Tasks, All Status
 * - Clean monochrome audit table: Document / Task, Findings, Status, Date, Actions
 * - Functional pagination controls (< 1 2 3 ... >)
 * - Real Supabase / Session synchronization
 * - Truthful empty and error states
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
  const [taskFilter, setTaskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const itemsPerPage = 8;

  // Derive unique tasks for filter
  const taskOptions = useMemo(() => {
    const set = new Set();
    scanHistory.forEach((item) => {
      if (item.taskName) set.add(item.taskName);
    });
    return Array.from(set);
  }, [scanHistory]);

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

      const matchesTask =
        taskFilter === 'ALL' || item.taskName === taskFilter;

      const findingsCount = item.findings?.length ?? item.counts?.total ?? 0;
      const status = findingsCount > 0 ? 'Protected' : 'Clean';
      const matchesStatus =
        statusFilter === 'ALL' || status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesTask && matchesStatus;
    });
  }, [scanHistory, searchQuery, taskFilter, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

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
    link.setAttribute(
      'download',
      `privacyguard_audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="pg-editorial-workspace-page">
      {/* Top Header */}
      <div className="pg-workspace-page-header">
        <div>
          <div className="pg-eyebrow">
            <span className="pg-eyebrow-dot"></span>
            <span>Verifiable Audit Log</span>
          </div>
          <h1 className="pg-workspace-page-title">Scan History</h1>
          <p className="pg-workspace-page-subtitle">
            Immutable {isCloud ? 'Supabase cloud' : 'session'} audit records of prompts, API payloads, and minimization actions.
          </p>
        </div>

        <div className="pg-header-action-group">
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={handleExportCSV}
            disabled={scanHistory.length === 0}
            title="Download CSV report of current session audit logs"
          >
            {downloadSuccess ? 'Downloaded CSV' : 'Export CSV'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Scan}
            onClick={() => handleGo('scanner')}
          >
            New Scan
          </Button>
        </div>
      </div>

      {/* Cloud Sync Notice */}
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
          {/* Reference Panel 7 Filter Controls Bar */}
          <div className="pg-history-filter-bar">
            {/* Search Input */}
            <div className="pg-search-input-wrap">
              <Search size={15} className="pg-search-icon" />
              <input
                type="text"
                className="pg-search-input"
                placeholder="Search scans..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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

            {/* All Tasks Dropdown */}
            <div className="pg-filter-select-wrap">
              <select
                className="pg-history-filter-select"
                value={taskFilter}
                onChange={(e) => {
                  setTaskFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by Task"
              >
                <option value="ALL">All Tasks</option>
                {taskOptions.map((task) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </select>
            </div>

            {/* All Status Dropdown */}
            <div className="pg-filter-select-wrap">
              <select
                className="pg-history-filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by Status"
              >
                <option value="ALL">All Status</option>
                <option value="protected">Protected</option>
                <option value="clean">Clean</option>
              </select>
            </div>
          </div>

          {/* Table Container (Matching Reference Panel 7) */}
          <div className="pg-card pg-p-0">
            {filteredRecords.length === 0 ? (
              <div className="pg-table-empty-row">
                <span>No audit records matched your filter criteria.</span>
              </div>
            ) : (
              <div className="pg-table-responsive">
                <table className="pg-table" aria-label="Audit Records Table">
                  <thead>
                    <tr>
                      <th scope="col">Document / Task</th>
                      <th scope="col">Findings</th>
                      <th scope="col">Status</th>
                      <th scope="col">Date</th>
                      <th scope="col" className="pg-text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((item, index) => {
                      const count = item.findings?.length ?? item.counts?.total ?? 0;
                      return (
                        <tr key={item.scanId || item.id || `scan-${index}`} className="pg-table-row">
                          <td>
                            <div className="pg-table-task-cell">
                              <FileText size={16} className="pg-table-icon" />
                              <div>
                                <span className="pg-task-name">{item.taskName || 'Prompt Privacy Audit'}</span>
                                <span className="pg-task-id">{item.scanId || 'SCN-LOCAL'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="pg-mono-val">{count}</span>
                          </td>
                          <td>
                            <span className="pg-badge-status-pill">Protected</span>
                          </td>
                          <td className="pg-table-muted">
                            <span className="pg-time-val">{item.timestamp || 'Recent'}</span>
                          </td>
                          <td className="pg-text-right">
                            <button
                              type="button"
                              className="pg-btn-inspect-sm"
                              onClick={() => handleGo('results', item)}
                              aria-label={`Inspect ${item.taskName} results`}
                            >
                              <Eye size={13} />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Bar (Matching Reference Panel 7 bottom) */}
            {totalPages > 1 && (
              <div className="pg-pagination-bar">
                <button
                  type="button"
                  className="pg-pagination-arrow"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="pg-pagination-numbers">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i + 1}
                      type="button"
                      className={`pg-pagination-num ${
                        currentPage === i + 1 ? 'pg-pagination-active' : ''
                      }`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="pg-pagination-arrow"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
