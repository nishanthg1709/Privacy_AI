import { useState, useEffect, useRef } from 'react';
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
  Layers,
  X,
  FileCheck
} from 'lucide-react';
import Button from '../components/Button';
import scannerService from '../services/scannerService';
import { formatFileSize, validateFile, inspectDecodedText } from '../utils/fileValidation';

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

  // Staged file state and accessible file input ref
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);

  // Animate progress steps and track duration during active real scanning
  useEffect(() => {
    if (!isScanning) return;
    const t1 = setTimeout(() => setScanStep(2), 350);
    const t2 = setTimeout(() => setScanStep(3), 700);
    const interval = setInterval(() => {
      setScanElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
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
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    setUploadedFile(null);
    setScanResultNotice(null);
    setScanError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setContent('');
    setTaskName('General Document Sharing');
    setScanResultNotice(null);
    setScanError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop or file upload handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      readFile(files[0]);
    }
  };

  const readFile = (file) => {
    if (!file) return;

    setScanError(null);
    setScanResultNotice(null);

    const validation = validateFile(file);
    if (!validation.isValid) {
      setScanError(validation.error);
      return;
    }

    setIsReadingFile(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIsReadingFile(false);
      const text = event.target?.result;

      const inspection = inspectDecodedText(text, file.name);
      if (!inspection.isValid) {
        setScanError(inspection.error);
        return;
      }

      setUploadedFile({
        name: file.name,
        size: file.size,
        formattedSize: formatFileSize(file.size),
        lineCount: inspection.lineCount,
        charCount: inspection.charCount,
        preview: inspection.preview,
        isTruncated: inspection.isTruncated,
      });

      setContent(text);
      setTaskName(`Uploaded File: ${file.name}`);
      setScanError(null);
    };

    reader.onerror = () => {
      setIsReadingFile(false);
      setScanError(`Failed to read "${file.name}". Please ensure the file is readable and try again.`);
    };

    reader.onabort = () => {
      setIsReadingFile(false);
      setScanError(`File reading was cancelled.`);
    };

    try {
      reader.readAsText(file, 'UTF-8');
    } catch (err) {
      setIsReadingFile(false);
      setScanError(`Error reading file: ${err.message || 'Unknown error'}`);
    }
  };

  // Real backend submission
  const handleAnalyzeAndProtect = async (e) => {
    if (e) e.preventDefault();
    if (isScanning || isReadingFile) return;

    if (!content.trim()) {
      setScanError('Please provide document text or upload a supported file.');
      return;
    }

    setIsScanning(true);
    setScanElapsedSeconds(0);
    setScanStep(1);
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
      setScanError(
        err.message ||
        'Unable to connect to the PrivacyGuard AI backend. Please verify that the backend service is running and accessible.'
      );
    } finally {
      setIsScanning(false);
      setScanStep(1);
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
            ) : uploadedFile ? (
              /* STAGED UPLOADED FILE CARD */
              <div className="pg-uploaded-file-card" role="region" aria-label="Selected file details">
                <div className="pg-uploaded-file-header">
                  <div className="pg-uploaded-file-info">
                    <div className="pg-uploaded-file-icon-wrap">
                      <FileCheck size={20} className="pg-text-cream" />
                    </div>
                    <div className="pg-uploaded-file-meta">
                      <span className="pg-uploaded-filename" title={uploadedFile.name}>
                        {uploadedFile.name}
                      </span>
                      <div className="pg-uploaded-file-tags">
                        <span className="pg-file-tag">{uploadedFile.formattedSize}</span>
                        <span className="pg-file-tag">{uploadedFile.lineCount} lines</span>
                        <span className="pg-file-tag">{uploadedFile.charCount} characters</span>
                        <span className="pg-file-tag pg-file-tag-ready">
                          <CheckCircle2 size={11} /> Ready to Scan
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="pg-uploaded-file-actions">
                    <button
                      type="button"
                      className="pg-file-action-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Choose a different file to replace this one"
                      disabled={isScanning || isReadingFile}
                    >
                      <RefreshCw size={12} />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      className="pg-file-action-btn pg-file-action-clear"
                      onClick={handleClearFile}
                      title="Remove selected file"
                      disabled={isScanning || isReadingFile}
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                {/* Content snippet preview */}
                <div className="pg-uploaded-file-preview-wrap">
                  <div className="pg-preview-header">
                    <span className="pg-preview-label">Document Content Preview</span>
                    <span className="pg-preview-badge">UTF-8 Verified</span>
                  </div>
                  <pre className="pg-file-preview-content">
                    {uploadedFile.preview}
                    {uploadedFile.isTruncated && '\n... [Remaining content loaded and ready for scanning]'}
                  </pre>
                </div>
              </div>
            ) : (
              /* INTERACTIVE ACCESSIBLE DROPZONE */
              <div
                className={`pg-dropzone ${dragActive ? 'pg-dropzone-active' : ''} ${isReadingFile ? 'pg-dropzone-loading' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                tabIndex={0}
                role="button"
                aria-label="Upload document by clicking or dropping a file here"
              >
                {isReadingFile ? (
                  <div className="pg-drop-loading-state">
                    <RefreshCw size={24} className="pg-spin pg-text-cream" />
                    <span className="pg-drop-text">Reading document...</span>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="pg-drop-icon" />
                    <div className="pg-drop-text">
                      <span>Drag &amp; drop document or </span>
                      <button
                        type="button"
                        className="pg-drop-browse-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        browse files
                      </button>
                    </div>
                    <span className="pg-drop-formats">
                      Supports plain-text .txt, .json, .csv, and .log files (max 500 KB)
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Hidden native file input accessible from anywhere */}
            <input
              ref={fileInputRef}
              type="file"
              className="pg-sr-only"
              accept=".txt,.json,.csv,.log,.md,text/plain,text/csv,application/json"
              onChange={handleFileUpload}
              tabIndex={-1}
              aria-hidden="true"
            />

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
                    {scanElapsedSeconds >= 6
                      ? `Connecting to backend (${scanElapsedSeconds}s)... On free hosting, waking the server from cold sleep can take up to 60-90s.`
                      : 'AI is analyzing your content for sensitive information...'}
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
                  Microsoft Presidio and spaCy <code>en_core_web_sm</code> with custom privacy rules
                  are active in CPU memory (free-tier degraded mode; GLiNER neural AI is disabled to fit within 512MB RAM). No document data is ever sent to external cloud APIs.
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
