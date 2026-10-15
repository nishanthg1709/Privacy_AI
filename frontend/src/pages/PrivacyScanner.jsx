import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Upload,
  FileText,
  AlertCircle,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  Sliders,
  Server,
  AlertTriangle
} from 'lucide-react';
import Button from '../components/Button';
import scannerService, { checkBackendHealth } from '../services/scannerService';

/**
 * Editorial PrivacyScanner Page Component
 * Preserves all scanning inputs, sample presets, and interaction logic.
 * Integrates with live backend via POST http://localhost:8000/api/scan (or VITE_API_BASE_URL).
 * Strict zero-log policy for sensitive documents or detected values.
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

  const [taskName, setTaskName] = useState('Customer Support Prompt Audit #104');
  const [privacyMode, setPrivacyMode] = useState('synthetic'); // 'synthetic' | 'tokenized' | 'redaction'
  const [strictnessLevel, setStrictnessLevel] = useState('gdpr-hipaa'); // 'gdpr-hipaa' | 'standard' | 'secrets-only'
  const [content, setContent] = useState(
    `Hello Support,\nMy name is Sarah Connor (SSN: 482-19-9481). Please update my billing email from sarah.connor@cyberdyne.org to s.connor@personalmail.com. You can call me at +1 (555) 234-5678.\nFor authentication, my card on file ends in 4532 (Exp 08/28).\nAlso here is my temp service token: sk-live_51M0demo00000000000000000000\nThanks!`
  );

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanResultNotice, setScanResultNotice] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Backend health status
  const [backendStatus, setBackendStatus] = useState({
    isOnline: false,
    checking: true,
    url: scannerService.getBaseUrl(),
  });

  const checkConnectivity = useCallback(async () => {
    setBackendStatus((prev) => ({ ...prev, checking: true }));
    try {
      const health = await checkBackendHealth();
      setBackendStatus({
        isOnline: health.isOnline,
        checking: false,
        url: health.url,
      });
    } catch {
      setBackendStatus((prev) => ({
        ...prev,
        isOnline: false,
        checking: false,
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    checkBackendHealth()
      .then((health) => {
        if (active) {
          setBackendStatus({
            isOnline: health.isOnline,
            checking: false,
            url: health.url,
          });
        }
      })
      .catch(() => {
        if (active) {
          setBackendStatus((prev) => ({
            ...prev,
            isOnline: false,
            checking: false,
          }));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Quick sample presets for testing
  const samplePresets = {
    pii: `Hello Support,\nMy name is Sarah Connor (SSN: 482-19-9481). Please update my billing email from sarah.connor@cyberdyne.org to s.connor@personalmail.com. You can call me at +1 (555) 234-5678.\nFor authentication, my card on file ends in 4532 (Exp 08/28).\nAlso here is my temp service token: sk-live_51M0demo00000000000000000000\nThanks!`,
    apiKeys: `// Application environment configuration template\nconst config = {\n  DATABASE_HOST: process.env.DB_HOST || "db.internal.apexdev.io",\n  DATABASE_PORT: process.env.DB_PORT || "5432",\n  AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",\n  API_KEY: "sk-live_51M0demo00000000000000000000",\n  NOTIFICATION_URL: "https://api.internal.apexdev.io/v1/alerts"\n};`,
    healthcare: `Patient Clinical Summary:\nPatient: Robert J. Miller, DOB: 04/12/1974. MRN #849103.\nAdmitted to St. Jude Regional Hospital with acute respiratory symptoms.\nPrimary Physician: Dr. Allison Green (Phone: 212-555-0199).\nInsurance ID: BCBS-NY-9021-X99.\nPrescribed 50mg Lisinopril daily. Discharged on 10/12/2026.`,
  };

  const handleLoadPreset = (key) => {
    setContent(samplePresets[key]);
    if (key === 'pii') setTaskName('Customer Support PII Redaction');
    if (key === 'apiKeys') setTaskName('DevOps Config Secret Sanitization');
    if (key === 'healthcare') setTaskName('HIPAA Patient Record Minimization');
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
    // Audit limits: Task 14 - safe text-file upload capability
    const maxSizeBytes = 500 * 1024; // 500 KB limit
    if (file.size > maxSizeBytes) {
      setScanError(`File exceeds maximum size limit (500 KB). Uploaded file is ${(file.size / 1024).toFixed(1)} KB. PrivacyGuard AI processes documents strictly in-memory.`);
      return;
    }

    const allowedExtensions = ['.txt', '.md', '.json', '.csv', '.log'];
    const fileNameLower = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!isAllowed) {
      setScanError(`Unsupported file type. PrivacyGuard AI accepts plain-text documents (${allowedExtensions.join(', ')}). Executables and binary documents are rejected.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setContent(text);
        setTaskName(`Uploaded: ${file.name}`);
        setScanResultNotice({
          type: 'info',
          title: 'File Ingested Locally',
          message: `Loaded ${file.name} (${text.length} characters). Ready for local privacy scanning.`,
        });
        setScanError(null);
      }
    };
    reader.onerror = () => {
      setScanError('Failed to read the selected file. Please verify file permissions or paste the text directly.');
    };
    reader.readAsText(file);
  };

  // Perform Real Backend Scan
  const handleAnalyzeAndProtect = async (e) => {
    if (e) e.preventDefault();

    // Prevent duplicate submissions while a scan is running (Task 2 & Task 16)
    if (isScanning) {
      return;
    }

    if (!content.trim()) {
      setScanError('Input Required: Please paste prompt text or load a sample document before analyzing.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanResultNotice(null);

    try {
      // Calls POST http://localhost:8000/api/scan (or VITE_API_BASE_URL)
      const scanResult = await scannerService.scanPayload({
        text: content,
        task: taskName,
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
      // Transparent error handling with retry option. Never substitute fake results.
      setScanError(
        err.message ||
          `Unable to connect to PrivacyGuard AI backend at ${backendStatus.url}. Please ensure the backend is running.`
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
      {/* Header */}
      <div className="pg-workspace-page-header">
        <div>
          <h1 className="pg-workspace-page-title">Privacy Scanner &amp; Redaction Studio</h1>
          <p className="pg-workspace-page-subtitle">
            Submit raw prompts, API requests, or documents to identify sensitive entities and
            test minimization policies before model dispatch.
          </p>
        </div>

        <div className="pg-header-action-group">
          {/* Backend Connectivity Badge */}
          <div
            className={`pg-backend-status-badge ${
              backendStatus.isOnline
                ? 'pg-backend-online'
                : 'pg-backend-offline'
            }`}
            title={`Configured endpoint: ${backendStatus.url}/api/scan`}
          >
            <span className="pg-status-dot"></span>
            <span className="pg-status-text">
              {backendStatus.checking
                ? 'Checking backend...'
                : backendStatus.isOnline
                ? `Backend Online (${backendStatus.url})`
                : `Backend Offline (${backendStatus.url})`}
            </span>
            <button
              type="button"
              className="pg-status-refresh-btn"
              onClick={checkConnectivity}
              title="Test backend connection"
              aria-label="Test backend connection"
            >
              <RefreshCw size={12} className={backendStatus.checking ? 'pg-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Scanner Grid */}
      <form onSubmit={handleAnalyzeAndProtect} className="pg-scanner-layout">
        {/* Left Column: Configuration Controls */}
        <div className="pg-scanner-sidebar">
          {/* Task Info Card */}
          <div className="pg-card">
            <h2 className="pg-card-title">
              <Sliders size={16} />
              <span>Scan Parameters</span>
            </h2>

            <div className="pg-form-group">
              <label htmlFor="scan-task-name" className="pg-label">
                Task / Audit Label
              </label>
              <input
                id="scan-task-name"
                type="text"
                className="pg-input"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Chatbot Transcript #204"
                required
              />
              <span className="pg-field-hint">Used for compliance audit tracking</span>
            </div>

            {/* Privacy Mode Selector */}
            <div className="pg-form-group">
              <label className="pg-label">Minimization Strategy</label>
              <div className="pg-radio-cards" role="radiogroup" aria-label="Minimization Strategy">
                <label
                  className={`pg-radio-card ${privacyMode === 'synthetic' ? 'pg-radio-card-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="privacyMode"
                    value="synthetic"
                    checked={privacyMode === 'synthetic'}
                    onChange={() => setPrivacyMode('synthetic')}
                    className="pg-sr-only"
                  />
                  <div className="pg-radio-content">
                    <div className="pg-radio-title">
                      <Sparkles size={15} className="pg-radio-icon" />
                      <span>Synthetic Data</span>
                      <span className="pg-pill-tag">Recommended</span>
                    </div>
                    <p className="pg-radio-desc">
                      Substitutes PII with realistic fake data. Keeps LLM prompt semantics natural.
                    </p>
                  </div>
                </label>

                <label
                  className={`pg-radio-card ${privacyMode === 'tokenized' ? 'pg-radio-card-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="privacyMode"
                    value="tokenized"
                    checked={privacyMode === 'tokenized'}
                    onChange={() => setPrivacyMode('tokenized')}
                    className="pg-sr-only"
                  />
                  <div className="pg-radio-content">
                    <div className="pg-radio-title">
                      <Lock size={15} className="pg-radio-icon" />
                      <span>Tokenized Mask</span>
                    </div>
                    <p className="pg-radio-desc">
                      Replaces entities with deterministic tags like <code>[EMAIL_1]</code> or <code>[PHONE_1]</code>.
                    </p>
                  </div>
                </label>

                <label
                  className={`pg-radio-card ${privacyMode === 'redaction' ? 'pg-radio-card-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="privacyMode"
                    value="redaction"
                    checked={privacyMode === 'redaction'}
                    onChange={() => setPrivacyMode('redaction')}
                    className="pg-sr-only"
                  />
                  <div className="pg-radio-content">
                    <div className="pg-radio-title">
                      <ShieldCheck size={15} className="pg-radio-icon" />
                      <span>Full Redaction</span>
                    </div>
                    <p className="pg-radio-desc">
                      Strict blackout redaction: completely strips or replaces with <code>[REDACTED]</code>.
                    </p>
                  </div>
                </label>

                <label
                  className={`pg-radio-card ${privacyMode === 'task-aware' ? 'pg-radio-card-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="privacyMode"
                    value="task-aware"
                    checked={privacyMode === 'task-aware'}
                    onChange={() => setPrivacyMode('task-aware')}
                    className="pg-sr-only"
                  />
                  <div className="pg-radio-content">
                    <div className="pg-radio-title">
                      <CheckCircle2 size={15} className="pg-radio-icon" />
                      <span>Task-Aware</span>
                    </div>
                    <p className="pg-radio-desc">
                      Applies context-specific minimization rules and flags ambiguous decisions.
                    </p>
                  </div>
                </label>

                <label
                  className={`pg-radio-card ${privacyMode === 'user-approved' ? 'pg-radio-card-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="privacyMode"
                    value="user-approved"
                    checked={privacyMode === 'user-approved'}
                    onChange={() => setPrivacyMode('user-approved')}
                    className="pg-sr-only"
                  />
                  <div className="pg-radio-content">
                    <div className="pg-radio-title">
                      <Eye size={15} className="pg-radio-icon" />
                      <span>User-Approved Review</span>
                    </div>
                    <p className="pg-radio-desc">
                      Flags candidate redactions for interactive human review without altering source text.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Strictness Level */}
            <div className="pg-form-group">
              <label htmlFor="strictness-select" className="pg-label">
                Compliance Policy
              </label>
              <select
                id="strictness-select"
                className="pg-select"
                value={strictnessLevel}
                onChange={(e) => setStrictnessLevel(e.target.value)}
              >
                <option value="gdpr-hipaa">Strict: GDPR + HIPAA + Financial (Default)</option>
                <option value="standard">Standard: Common PII (Email, Phone, Names)</option>
                <option value="secrets-only">Developer Only: API Keys &amp; Credentials</option>
              </select>
            </div>
          </div>

          {/* Quick Presets Box */}
          <div className="pg-card pg-card-compact">
            <h3 className="pg-card-title-sm">Quick Sample Payloads</h3>
            <p className="pg-text-secondary-sm">
              Preload synthetic test documents to evaluate detection policies:
            </p>
            <div className="pg-preset-buttons">
              <button
                type="button"
                className="pg-btn-preset"
                onClick={() => handleLoadPreset('pii')}
              >
                Customer PII Sample
              </button>
              <button
                type="button"
                className="pg-btn-preset"
                onClick={() => handleLoadPreset('apiKeys')}
              >
                API Credentials Sample
              </button>
              <button
                type="button"
                className="pg-btn-preset"
                onClick={() => handleLoadPreset('healthcare')}
              >
                HIPAA Medical Record
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Input Area and Action Bar */}
        <div className="pg-scanner-main">
          <div className="pg-card pg-card-grow">
            <div className="pg-input-toolbar">
              <div className="pg-toolbar-left">
                <FileText size={16} className="pg-toolbar-icon" />
                <span className="pg-toolbar-title">Payload Content / Prompt Document</span>
              </div>
              <div className="pg-toolbar-stats">
                <span>{content.length} characters</span>
                <span className="pg-toolbar-divider">•</span>
                <span>~{Math.ceil(content.length / 4)} tokens</span>
                {content.length > 0 && (
                  <>
                    <span className="pg-toolbar-divider">•</span>
                    <button
                      type="button"
                      className="pg-btn-link-sm"
                      onClick={handleClear}
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Textarea */}
            <div className="pg-textarea-wrap">
              <textarea
                id="scanner-content-input"
                className="pg-textarea"
                rows={12}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (scanError) setScanError(null);
                }}
                placeholder="Paste prompt, JSON body, logs, or customer correspondence here..."
                aria-label="Input content to scan for privacy violations"
              />
            </div>

            {/* File Drag and Drop Zone */}
            <div
              className={`pg-dropzone ${dragActive ? 'pg-dropzone-active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <Upload size={20} className="pg-drop-icon" />
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
              <span className="pg-drop-formats">Supports .txt, .json, .csv, and .log files</span>
            </div>

            {/* Honest Error State with Retry Button */}
            {scanError && (
              <div className="pg-error-retry-card" role="alert">
                <div className="pg-error-card-header">
                  <AlertTriangle size={18} className="pg-text-amber" />
                  <h4>Backend Scan Service Notice</h4>
                </div>
                <p className="pg-error-card-body">{scanError}</p>
                <div className="pg-error-card-meta">
                  <span className="pg-meta-label">Target Endpoint:</span>
                  <code>POST {backendStatus.url}/api/scan</code>
                </div>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Server}
                    onClick={checkConnectivity}
                  >
                    Test Backend Reachability
                  </Button>
                </div>
              </div>
            )}

            {/* Success Notice Banner */}
            {scanResultNotice && (
              <div
                className={`pg-scan-notice pg-scan-notice-${scanResultNotice.type}`}
                role="status"
              >
                <div className="pg-notice-header">
                  {scanResultNotice.type === 'success' ? (
                    <CheckCircle2 size={17} className="pg-text-cream" />
                  ) : (
                    <AlertCircle size={17} className="pg-text-cream" />
                  )}
                  <strong>{scanResultNotice.title}</strong>
                </div>
                <p className="pg-notice-body">{scanResultNotice.message}</p>
                {scanResultNotice.type === 'success' && (
                  <div className="pg-notice-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Eye}
                      iconAfter={ArrowRight}
                      onClick={handleGoToResults}
                    >
                      Inspect Redacted Output
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScanResultNotice(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action Footer */}
            <div className="pg-scanner-footer">
              <div className="pg-engine-pill">
                <span
                  className={
                    backendStatus.isOnline
                      ? 'pg-pulse-dot pg-pulse-green'
                      : 'pg-pulse-dot pg-pulse-amber'
                  }
                ></span>
                <span>
                  API: {backendStatus.url}/api/scan{' '}
                  {backendStatus.isOnline ? '(Connected)' : '(Offline / Awaiting Server)'}
                </span>
              </div>

              <div className="pg-footer-actions">
                <Button
                  variant="ghost"
                  size="md"
                  icon={RefreshCw}
                  onClick={handleClear}
                  disabled={isScanning || !content}
                >
                  Reset Form
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isScanning}
                  icon={ShieldCheck}
                  iconAfter={ArrowRight}
                  disabled={isScanning || !content.trim()}
                  id="scanner-analyze-btn"
                >
                  Analyze and Protect
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
