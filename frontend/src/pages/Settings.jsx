import { useState } from 'react';
import {
  Shield,
  Eye,
  Save,
  RotateCcw,
  CheckCircle2,
  Download,
  Info
} from 'lucide-react';
import Button from '../components/Button';

/**
 * Editorial Settings Page Component
 * Allows user to configure privacy guardrail defaults and interface preferences.
 * All toggles and buttons are functional and persist state.
 */
export default function Settings({ settings, onSaveSettings }) {
  // Local editable form state
  const [formData, setFormData] = useState({
    defaultMode: settings?.defaultMode || 'synthetic',
    strictnessPolicy: settings?.strictnessPolicy || 'gdpr-hipaa',
    detectSecrets: settings?.detectSecrets ?? true,
    autoSanitizeClipboard: settings?.autoSanitizeClipboard ?? false,
    confidenceThreshold: settings?.confidenceThreshold || 85,
    retentionPolicy: settings?.retentionPolicy || 'ephemeral-zero',
    compactMode: settings?.compactMode ?? false,
    showConfidenceBadges: settings?.showConfidenceBadges ?? true,
    soundAlerts: settings?.soundAlerts ?? false,
  });

  const [saveStatus, setSaveStatus] = useState(null);

  const defaultValues = {
    defaultMode: 'synthetic',
    strictnessPolicy: 'gdpr-hipaa',
    detectSecrets: true,
    autoSanitizeClipboard: false,
    confidenceThreshold: 85,
    retentionPolicy: 'ephemeral-zero',
    compactMode: false,
    showConfidenceBadges: true,
    soundAlerts: false,
  };

  const handleToggle = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSaveSettings) {
      onSaveSettings(formData);
    }
    setSaveStatus({
      type: 'success',
      message: 'Privacy & Interface preferences saved successfully.',
    });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setFormData(defaultValues);
    if (onSaveSettings) {
      onSaveSettings(defaultValues);
    }
    setSaveStatus({
      type: 'info',
      message: 'Settings have been reset to factory defaults.',
    });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleExportConfig = () => {
    const configBlob = new Blob([JSON.stringify(formData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(configBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privacyguard_policy_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pg-editorial-workspace-page">
      {/* Header */}
      <div className="pg-workspace-page-header">
        <div>
          <h1 className="pg-workspace-page-title">Privacy Guardrail &amp; Policy Settings</h1>
          <p className="pg-workspace-page-subtitle">
            Customize automated minimization defaults, confidence scoring thresholds, and display preferences.
          </p>
        </div>

        <div className="pg-header-action-group">
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={handleExportConfig}
            title="Download settings JSON config"
          >
            Export Config JSON
          </Button>
        </div>
      </div>

      {/* Save Status Notification */}
      {saveStatus && (
        <div
          className={`pg-banner ${saveStatus.type === 'success' ? 'pg-banner-success' : 'pg-banner-info'}`}
          role="status"
        >
          <div className="pg-banner-icon">
            <CheckCircle2 size={17} />
          </div>
          <div className="pg-banner-content">
            <strong>{saveStatus.message}</strong>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pg-settings-layout">
        {/* Section 1: Privacy & Minimization Defaults */}
        <div className="pg-card">
          <div className="pg-card-header-with-icon">
            <div className="pg-card-icon-badge">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="pg-card-title">Minimization Strategy Defaults</h2>
              <p className="pg-card-subtitle">
                Default behavior applied to inbound prompts and payloads
              </p>
            </div>
          </div>

          <div className="pg-form-group">
            <label htmlFor="settings-default-mode" className="pg-label">
              Default Minimization Strategy
            </label>
            <select
              id="settings-default-mode"
              className="pg-select"
              value={formData.defaultMode}
              onChange={(e) => handleChange('defaultMode', e.target.value)}
            >
              <option value="synthetic">Synthetic Replacement (Context-Preserving Faker)</option>
              <option value="tokenized">Tokenized Masking (Reversible [TAG_1] format)</option>
              <option value="redaction">Strict Redaction (Full Blackout [REDACTED])</option>
            </select>
            <span className="pg-field-hint">
              Synthetic is recommended for generative AI pipelines to maintain conversational grammar.
            </span>
          </div>

          <div className="pg-form-group">
            <label htmlFor="settings-retention" className="pg-label">
              Data Retention Policy
            </label>
            <select
              id="settings-retention"
              className="pg-select"
              value={formData.retentionPolicy}
              onChange={(e) => handleChange('retentionPolicy', e.target.value)}
            >
              <option value="ephemeral-zero">Zero Retention (RAM Only • Discard immediately)</option>
              <option value="24h-ephemeral">24-Hour Ephemeral Cache (For manual auditing)</option>
              <option value="30d-compliance">30-Day Encrypted Audit Trail (HIPAA/GDPR)</option>
            </select>
          </div>

          <div className="pg-form-group">
            <div className="pg-slider-header">
              <label htmlFor="confidence-slider" className="pg-label">
                Detection Confidence Threshold: <strong>{formData.confidenceThreshold}%</strong>
              </label>
            </div>
            <input
              id="confidence-slider"
              type="range"
              min="50"
              max="99"
              step="1"
              className="pg-slider"
              value={formData.confidenceThreshold}
              onChange={(e) => handleChange('confidenceThreshold', Number(e.target.value))}
              aria-label="Detection confidence threshold"
            />
            <div className="pg-slider-labels">
              <span>50% (Catch all potential PII)</span>
              <span>85% (Balanced)</span>
              <span>99% (Strict zero false-positives)</span>
            </div>
          </div>

          <div className="pg-toggle-list">
            <label className="pg-toggle-row">
              <div className="pg-toggle-info">
                <span className="pg-toggle-label">Auto-Detect Developer Credentials</span>
                <span className="pg-toggle-desc">
                  Scan for API keys, tokens, JWTs, and database hosts by default
                </span>
              </div>
              <input
                type="checkbox"
                className="pg-checkbox-switch"
                checked={formData.detectSecrets}
                onChange={() => handleToggle('detectSecrets')}
              />
            </label>

            <label className="pg-toggle-row">
              <div className="pg-toggle-info">
                <span className="pg-toggle-label">Auto-Sanitize System Clipboard</span>
                <span className="pg-toggle-desc">
                  Prompt to sanitize whenever sensitive text is copied inside the app
                </span>
              </div>
              <input
                type="checkbox"
                className="pg-checkbox-switch"
                checked={formData.autoSanitizeClipboard}
                onChange={() => handleToggle('autoSanitizeClipboard')}
              />
            </label>
          </div>
        </div>

        {/* Section 2: Interface & Display Preferences */}
        <div className="pg-card">
          <div className="pg-card-header-with-icon">
            <div className="pg-card-icon-badge">
              <Eye size={18} />
            </div>
            <div>
              <h2 className="pg-card-title">Display &amp; Inspection Preferences</h2>
              <p className="pg-card-subtitle">
                Fine-tune the diff viewer appearance and UI density
              </p>
            </div>
          </div>

          <div className="pg-toggle-list">
            <label className="pg-toggle-row">
              <div className="pg-toggle-info">
                <span className="pg-toggle-label">Show Confidence Badges in Diff View</span>
                <span className="pg-toggle-desc">
                  Display entity tags with percentage accuracy badges in the Results panel
                </span>
              </div>
              <input
                type="checkbox"
                className="pg-checkbox-switch"
                checked={formData.showConfidenceBadges}
                onChange={() => handleToggle('showConfidenceBadges')}
              />
            </label>

            <label className="pg-toggle-row">
              <div className="pg-toggle-info">
                <span className="pg-toggle-label">Compact Table &amp; Card Density</span>
                <span className="pg-toggle-desc">
                  Reduces vertical spacing in tables and telemetry cards for high-density monitors
                </span>
              </div>
              <input
                type="checkbox"
                className="pg-checkbox-switch"
                checked={formData.compactMode}
                onChange={() => handleToggle('compactMode')}
              />
            </label>

            <label className="pg-toggle-row">
              <div className="pg-toggle-info">
                <span className="pg-toggle-label">Audible Notification on High-Risk Detections</span>
                <span className="pg-toggle-desc">
                  Play subtle alert sound when credentials or health PII are discovered
                </span>
              </div>
              <input
                type="checkbox"
                className="pg-checkbox-switch"
                checked={formData.soundAlerts}
                onChange={() => handleToggle('soundAlerts')}
              />
            </label>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="pg-settings-actions-card">
          <div className="pg-settings-actions-info">
            <Info size={16} />
            <span>Settings apply to all subsequent scans during this browser session.</span>
          </div>

          <div className="pg-footer-actions">
            <Button
              type="button"
              variant="ghost"
              size="md"
              icon={RotateCcw}
              onClick={handleReset}
              id="settings-reset-btn"
            >
              Reset to Defaults
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Save}
              id="settings-save-btn"
            >
              Save Preferences
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
