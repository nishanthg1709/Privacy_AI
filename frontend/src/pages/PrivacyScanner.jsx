import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Upload,
  FileText,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertTriangle,
  Cpu,
  Layers
} from 'lucide-react';
import Button from '../components/Button';
import scannerService from '../services/scannerService';

/**
 * Editorial PrivacyScanner Page Component
 * Faithfully matches Panel 5 of the reference design:
 * - Left Pane: Task or Purpose, Additional Context, Privacy Mode chips, Text Input / File Upload tabs, Textarea, Scan and Protect button
 * - Right Pane: Interactive Scanner Visualizer with active laser beam scanning animation during real scan
 * - Strict zero-log policy for sensitive documents or detected values
 * - Real FastAPI backend integration via POST /api/scan
 */
export default function PrivacyScanner({ onNavigate, onViewResults }) {
  const navigate = useNavigate();

  const handleGo = (pageId, data) => {
    if (pageId === 'results' && onViewResults) {
      onViewResults(data);
      navigate('/app/results', { state: { scanData: data } });
    } else if (onNavigate) {
      onNavigate(pageId);
    } else {
      navigate(`/app/${pageId}`, { state: { scanData: data } });
    }
  };

  const [taskName, setTaskName] = useState('General Document Sharing');
  const [additionalContext, setAdditionalContext] = useState('');
  const [privacyMode, setPrivacyMode] = useState('synthetic'); // 'synthetic' | 'redaction' | 'balanced' | 'task-aware'
  const [inputTab, setInputTab] = useState('text'); // 'text' | 'file'
  const [strictnessLevel, setStrictnessLevel] = useState('gdpr-hipaa');

  const [content, setContent] = useState(
    `Hello Support,\nMy name is Sarah Connor (SSN: 482-19-9481). Please update my billing email from sarah.connor@cyberdyne.org to s.connor@personalmail.com. You can call me at +1 (555) 234-5678.\nFor authentication, my card on file ends in 4532 (Exp 08/28).\nAlso here is my temp service token: sk-live_51M0demo00000000000000000000\nThanks!`
  );

  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(1);
  const [scanError, setScanError] = useState(null);
  const [scanResultNotice, setScanResultNotice] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Animate progress steps during active real scanning
  useEffect(() => {
    let t1, t2;
    if (isScanning) {
      t1 = setTimeout(() => setScanStep(2), 350);
      t2 = setTimeout(() => setScanStep(3), 700);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isScanning]);

  // Quick sample presets for testing
  const samplePresets = {
    general: `Please find the attached project notes for the Q3 audit. Contact Lead Engineer Alex Mercer at alex.m@apexsecurity.io or direct line +1-415-555-0182. Internal database credentials: db_user_svc with temp key api_live_94827101848201.`,
    pii: `Hello Support,\nMy name is Sarah Connor (SSN: 482-19-9481). Please update my billing email from sarah.connor@cyberdyne.org to s.connor@personalmail.com. You can call me at +1 (555) 234-5678.\nFor authentication, my card on file ends in 4532 (Exp 08/28).\nAlso here is my temp service token: sk-live_51M0demo00000000000000000000\nThanks!`,
    apiKeys: `// Application environment configuration template\nconst config = {\n  DATABASE_HOST: process.env.DB_HOST || "db.internal.apexdev.io",\n  DATABASE_PORT: process.env.DB_PORT || "5432",\n  AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",\n  API_KEY: "sk-live_51M0demo00000000000000000000",\n  NOTIFICATION_URL: "https://api.internal.apexdev.io/v1/alerts"\n};`,
    healthcare: `Patient Clinical Summary:\nPatient: Robert J. Miller, DOB: 04/12/1974. MRN #849103.\nAdmitted to St. Jude Regional Hospital with acute respiratory symptoms.\nPrimary Physician: Dr. Allison Green (Phone: 212-555-0199).\nInsurance ID: BCBS-NY-9021-X99.\nPrescribed 50mg Lisinopril daily. Discharged on 10/12/2026.`,
  };

  const handleLoadPreset = (key) => {
    setContent(samplePresets[key]);
    if (key === 'general') {
      setTaskName('General Document Sharing');
      setAdditionalContext('Sharing audit notes with external advisory team');
    } else if (key === 'pii') {
      setTaskName('Customer Support Prompt Audit');
      setAdditionalContext('Redact consumer PII before LLM agent triage');
    } else if (key === 'apiKeys') {
      setTaskName('DevOps Config Secret Sanitization');
      setAdditionalContext('Sanitize environment configs before git commit');
    } else if (key === 'healthcare') {
      setTaskName('HIPAA Patient Record Minimization');
      setAdditionalContext('Anonymize clinical identifiers for medical research');
    }
    setScanResultNotice(null);
    setScanError(null);
  };

  const handleClear = () => {
    setContent('');
    setScanResultNotice(null);
    setScanError(null);
  };

  // Drag and drop or file upload handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      readFile(e.dataTransfer.files[0]);
    }
  };

  const readFile = (file) => {
    const maxSizeBytes = 500 * 1024; // 500 KB limit
    if (file.size > maxSizeBytes) {
      setScanError(`File exceeds maximum size limit (500 KB). Uploaded file is ${(file.size / 1024).toFixed(1)} KB.`);
      return;
    }

    const allowedExtensions = ['.txt', '.md', '.json', '.csv', '.log'];
    const fileNameLower = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!isAllowed) {
      setScanError(`Unsupported file type. PrivacyGuard AI accepts plain-text documents (${allowedExtensions.join(', ')}).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target.result);
      setTaskName(`Uploaded File: ${file.name}`);
      setScanError(null);
    };
    reader.onerror = () => {
      setScanError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  // Real backend submission
  const handleAnalyzeAndProtect = async (e) => {
    if (e) e.preventDefault();
    if (!content.trim()) {
      setScanError('Please provide document text or upload a supported file.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanResultNotice(null);

    try {
      const fullTaskDesc = additionalContext
        ? `${taskName} [Context: ${additionalContext}]`
        : taskName;

      const scanResult = await scannerService.scanDocument({
        text: content,
        task: fullTaskDesc,
        privacy_mode: privacyMode,
        strictness: strictnessLevel,
      });

      setIsScanning(false);
      setScanResultNotice({
        type: 'success',
        title: 'Backend Scan Complete',
        message:
          scanResult.summary ||
          `Scan completed. Protected ${scanResult.findings.length} sensitive items.`,
        payload: scanResult,
      });

      // Forward directly to Results inspection
      handleGo('results', scanResult);
    } catch (err) {
      setIsScanning(false);
      setScanError(
        err.message ||
        'Unable to connect to the PrivacyGuard AI backend. Please verify that the backend service is running and accessible.'
      );
    }
  };

  const handleGoToResults = () => {
    if (scanResultNotice?.payload) {
      handleGo('results', scanResultNotice.payload);
    }
  };

  return (
    <div className="pg-editorial-workspace-page">
      {/* Top Header */}
      <div className="pg-workspace-page-header">
        <div>
          <div className="pg-eyebrow">
            <span className="pg-eyebrow-dot"></span>
            <span>Local AI Pipeline</span>
          </div>
          <h1 className="pg-workspace-page-title">Privacy Scanner</h1>
          <p className="pg-workspace-page-subtitle">
            Configure task context, select minimization rules, and detect sensitive entities in-memory.
          </p>
        </div>
      </div>

      {/* Main Scanner Two-Column Layout (Matching Reference Panel 5) */}
      <form onSubmit={handleAnalyzeAndProtect} className="pg-scanner-reference-layout">
        {/* Left Column: Form Controls and Textarea */}
        <div className="pg-scanner-left-panel">
          <div className="pg-card">
            {/* Task or Purpose */}
            <div className="pg-form-group">
              <label htmlFor="scan-task-select" className="pg-label">
                Task or Purpose
              </label>
              <div className="pg-task-select-row">
                <input
                  id="scan-task-name"
                  type="text"
                  className="pg-input"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g. General Document Sharing"
                  required
                />
              </div>
            </div>

            {/* Additional Context (Optional) */}
            <div className="pg-form-group">
              <label htmlFor="scan-context-input" className="pg-label">
                Additional Context <span className="pg-label-opt">(Optional)</span>
              </label>
              <input
                id="scan-context-input"
                type="text"
                className="pg-input"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="E.g., sharing with team, research, job application..."
              />
            </div>

            {/* Compliance Policy Standard */}
            <div className="pg-form-group">
              <label htmlFor="scan-strictness-select" className="pg-label">
                Compliance Framework
              </label>
              <select
                id="scan-strictness-select"
                className="pg-input pg-select"
                value={strictnessLevel}
                onChange={(e) => setStrictnessLevel(e.target.value)}
              >
                <option value="gdpr-hipaa">Standard (GDPR &amp; HIPAA Baseline)</option>
                <option value="strict-zero-leak">Strict Minimization (Zero False-Negative)</option>
                <option value="pci-dss">Financial &amp; Cardholder (PCI-DSS)</option>
              </select>
            </div>

            {/* Privacy Mode Chips (Matching Reference Panel 5) */}
            <div className="pg-form-group">
              <label className="pg-label">Privacy Mode</label>
              <div className="pg-chips-row" role="radiogroup" aria-label="Privacy Mode Selection">
                <button
                  type="button"
                  className={`pg-chip-btn ${privacyMode === 'synthetic' ? 'pg-chip-active' : ''}`}
                  onClick={() => setPrivacyMode('synthetic')}
                >
                  <Sparkles size={13} />
                  <span>Balanced (Recommended)</span>
                </button>

                <button
                  type="button"
                  className={`pg-chip-btn ${privacyMode === 'redaction' ? 'pg-chip-active' : ''}`}
                  onClick={() => setPrivacyMode('redaction')}
                >
                  <Lock size={13} />
                  <span>Strict Redaction</span>
                </button>

                <button
                  type="button"
                  className={`pg-chip-btn ${privacyMode === 'task-aware' ? 'pg-chip-active' : ''}`}
                  onClick={() => setPrivacyMode('task-aware')}
                >
                  <CheckCircle2 size={13} />
                  <span>Task-Aware</span>
                </button>

                <button
                  type="button"
                  className={`pg-chip-btn ${privacyMode === 'tokenized' ? 'pg-chip-active' : ''}`}
                  onClick={() => setPrivacyMode('tokenized')}
                >
                  <Layers size={13} />
                  <span>Deterministic Tags</span>
                </button>
              </div>
            </div>

            {/* Input Mode Tabs: Text Input / File Upload */}
            <div className="pg-input-tabs-bar">
              <div className="pg-input-tabs-group" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputTab === 'text'}
                  className={`pg-input-tab-btn ${inputTab === 'text' ? 'pg-input-tab-active' : ''}`}
                  onClick={() => setInputTab('text')}
                >
                  <FileText size={14} />
                  <span>Text Input</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputTab === 'file'}
                  className={`pg-input-tab-btn ${inputTab === 'file' ? 'pg-input-tab-active' : ''}`}
                  onClick={() => setInputTab('file')}
                >
                  <Upload size={14} />
                  <span>File Upload</span>
                </button>
              </div>

              <div className="pg-char-count-meta">
                <span>{content.length} characters</span>
                <span className="pg-toolbar-divider">•</span>
                <span>~{Math.ceil(content.length / 4)} tokens</span>
              </div>
            </div>

            {/* Document Content Input */}
            {inputTab === 'text' ? (
              <div className="pg-textarea-wrap">
                <textarea
                  id="scanner-content-input"
                  className="pg-textarea pg-textarea-reference"
                  rows={9}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (scanError) setScanError(null);
                  }}
                  placeholder="Paste your text here..."
                  aria-label="Input text to scan and protect"
                  required
                />
              </div>
            ) : (
              <div
                className={`pg-dropzone ${dragActive ? 'pg-dropzone-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <Upload size={22} className="pg-drop-icon" />
                <div className="pg-drop-text">
                  <span>Drag &amp; drop document or </span>
                  <label className="pg-drop-browse">
                    <span>browse files</span>
                    <input
                      type="file"
                      className="pg-sr-only"
                      accept=".txt,.json,.csv,.log"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <span className="pg-drop-formats">Supports plain-text .txt, .json, .csv, and .log files</span>
              </div>
            )}

            {/* Quick Sample Preset Buttons */}
            <div className="pg-scanner-presets-row">
              <span className="pg-presets-label">Sample Presets:</span>
              <button
                type="button"
                className="pg-preset-chip"
                onClick={() => handleLoadPreset('general')}
              >
                General Sharing
              </button>
              <button
                type="button"
                className="pg-preset-chip"
                onClick={() => handleLoadPreset('pii')}
              >
                Customer PII
              </button>
              <button
                type="button"
                className="pg-preset-chip"
                onClick={() => handleLoadPreset('apiKeys')}
              >
                API Credentials
              </button>
              <button
                type="button"
                className="pg-preset-chip"
                onClick={() => handleLoadPreset('healthcare')}
              >
                HIPAA Record
              </button>
              {content && (
                <button
                  type="button"
                  className="pg-preset-chip pg-preset-clear"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Honest Error State */}
            {scanError && (
              <div className="pg-error-retry-card" role="alert">
                <div className="pg-error-card-header">
                  <AlertTriangle size={18} className="pg-text-cream" />
                  <h4>Backend Scan Notice</h4>
                </div>
                <p className="pg-error-card-body">{scanError}</p>
                <div className="pg-error-card-actions">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={RefreshCw}
                    isLoading={isScanning}
                    onClick={handleAnalyzeAndProtect}
                  >
                    Retry Scan
                  </Button>
                </div>
              </div>
            )}

            {/* Successful Previous Scan Banner */}
            {scanResultNotice && (
              <div className="pg-status-callout-header pg-mb-3" style={{ justifyContent: 'space-between', padding: '0.625rem 0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={15} className="pg-text-cream" />
                  <span className="pg-text-cream" style={{ fontSize: '0.8125rem' }}>{scanResultNotice.message}</span>
                </div>
                <button
                  type="button"
                  className="pg-table-action-link"
                  onClick={handleGoToResults}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  View Results &rarr;
                </button>
              </div>
            )}

            {/* Scan and Protect CTA */}
            <div className="pg-scanner-submit-bar">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isScanning}
                icon={ShieldCheck}
                iconAfter={ArrowRight}
                disabled={isScanning || !content.trim()}
                id="scanner-scan-protect-btn"
                className="pg-w-full"
              >
                Scan and Protect &rarr;
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Scanner Visualizer (Matching Reference Panel 5) */}
        <div className="pg-scanner-right-panel">
          <div className="pg-card pg-visualizer-card">
            {isScanning ? (
              /* ACTIVE SCANNING BEAM & PROGRESS (Section 12.F & Panel 5) */
              <div className="pg-scanner-active-view" role="status" aria-live="polite">
                <div className="pg-active-header">
                  <h3 className="pg-active-title">Scanning Your Document</h3>
                  <p className="pg-active-sub">
                    AI is analyzing your content for sensitive information...
                  </p>
                </div>

                {/* Animated Central Document Diagram with Scanning Laser Beam */}
                <div className="pg-scanner-beam-stage">
                  {/* Floating Connected Entity Badges */}
                  <div className="pg-beam-badge pg-badge-tl">
                    <span className="pg-badge-code">SSN</span>
                  </div>
                  <div className="pg-beam-badge pg-badge-tr">
                    <span className="pg-badge-code">Email</span>
                  </div>
                  <div className="pg-beam-badge pg-badge-bl">
                    <span className="pg-badge-code">Address</span>
                  </div>
                  <div className="pg-beam-badge pg-badge-br">
                    <span className="pg-badge-code">Financial</span>
                  </div>

                  {/* Document Card with Scanning Line */}
                  <div className="pg-beam-doc-card">
                    {/* Active White Laser Beam */}
                    <div className="pg-scanner-laser-line" aria-hidden="true" />

                    <div className="pg-beam-doc-lines">
                      <div className="pg-beam-line pg-beam-line-title" />
                      <div className="pg-beam-line pg-beam-line-1" />
                      <div className="pg-beam-line pg-beam-line-2" />
                      <div className="pg-beam-line pg-beam-line-3" />
                      <div className="pg-beam-line pg-beam-line-4" />
                      <div className="pg-beam-line pg-beam-line-5" />
                    </div>

                    <div className="pg-beam-center-shield">
                      <Lock size={22} className="pg-text-cream" />
                    </div>
                  </div>
                </div>

                {/* 3 Real Progress Checklist Steps (Matching Reference Panel 5) */}
                <div className="pg-scan-checklist">
                  <div className={`pg-checklist-step ${scanStep >= 1 ? 'pg-step-active' : ''}`}>
                    <span className="pg-step-indicator">
                      {scanStep > 1 ? <CheckCircle2 size={14} /> : <span className="pg-pulse-dot" />}
                    </span>
                    <span className="pg-step-label">Analyzing content</span>
                  </div>

                  <div className={`pg-checklist-step ${scanStep >= 2 ? 'pg-step-active' : ''}`}>
                    <span className="pg-step-indicator">
                      {scanStep > 2 ? <CheckCircle2 size={14} /> : scanStep === 2 ? <span className="pg-pulse-dot" /> : <span className="pg-dot-idle" />}
                    </span>
                    <span className="pg-step-label">Detecting sensitive information</span>
                  </div>

                  <div className={`pg-checklist-step ${scanStep >= 3 ? 'pg-step-active' : ''}`}>
                    <span className="pg-step-indicator">
                      {scanStep === 3 ? <span className="pg-pulse-dot" /> : <span className="pg-dot-idle" />}
                    </span>
                    <span className="pg-step-label">Preparing results</span>
                  </div>
                </div>
              </div>
            ) : (
              /* IDLE STATE: READY INSPECTOR & ENGINE TELEMETRY */
              <div className="pg-scanner-ready-view">
                <div className="pg-ready-shield-graphic">
                  <div className="pg-ready-shield-ring">
                    <ShieldCheck size={38} className="pg-text-cream" />
                  </div>
                </div>

                <h3 className="pg-ready-title">Privacy Engine Ready</h3>
                <p className="pg-ready-description">
                  Local neural model <code>urchade/gliner_small-v2.1</code> combined with Presidio recognizers
                  is loaded in CPU memory. No document data is ever sent to external cloud APIs.
                </p>

                <div className="pg-ready-metrics-box">
                  <div className="pg-ready-metric-row">
                    <span className="pg-ready-metric-key">Inference Target</span>
                    <span className="pg-ready-metric-val">Local CPU (In-Memory)</span>
                  </div>
                  <div className="pg-ready-metric-row">
                    <span className="pg-ready-metric-key">Retention Policy</span>
                    <span className="pg-ready-metric-val">Zero-Log Ephemeral</span>
                  </div>
                  <div className="pg-ready-metric-row">
                    <span className="pg-ready-metric-key">Entities Monitored</span>
                    <span className="pg-ready-metric-val">40+ PII, Secret &amp; Healthcare</span>
                  </div>
                  <div className="pg-ready-metric-row">
                    <span className="pg-ready-metric-key">Active Mode</span>
                    <span className="pg-ready-metric-val">
                      {privacyMode === 'synthetic'
                        ? 'Synthetic Faker Substitution'
                        : privacyMode === 'redaction'
                          ? 'Strict Blackout Redaction'
                          : privacyMode === 'task-aware'
                            ? 'Task-Aware Minimization'
                            : 'Deterministic Tokenization'}
                    </span>
                  </div>
                </div>

                <div className="pg-ready-footer-tip">
                  <Cpu size={14} />
                  <span>Click &ldquo;Scan and Protect&rdquo; to launch live entity detection.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
