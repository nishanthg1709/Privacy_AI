import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import WorkspaceLayout from './components/WorkspaceLayout';
import Dashboard from './pages/Dashboard';
import PrivacyScanner from './pages/PrivacyScanner';
import Results from './pages/Results';
import ScanHistory from './pages/ScanHistory';
import Settings from './pages/Settings';

/**
 * Main Application Root
 * Sets up routing, AuthProvider, shared workspace telemetry state,
 * and toast alert notifications.
 */
function App() {
  const [selectedScanData, setSelectedScanData] = useState(null);
  const [toast, setToast] = useState(null);

  // App settings state with local persistence
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pg_app_settings');
      return saved
        ? JSON.parse(saved)
        : {
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
    } catch {
      return {
        defaultMode: 'synthetic',
        confidenceThreshold: 85,
        compactMode: false,
      };
    }
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Persistent session scan history state (populated strictly from actual scans)
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pg_session_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSaveSettings = (newSettings) => {
    setAppSettings(newSettings);
    try {
      localStorage.setItem('pg_app_settings', JSON.stringify(newSettings));
    } catch {
      // storage unavailable
    }
    showToast('Preferences updated and persisted.', 'success');
  };

  const handleScannerFinished = (scanResult) => {
    setSelectedScanData(scanResult);
    setScanHistory((prev) => {
      const filtered = prev.filter((item) => item.scanId !== scanResult.scanId);
      const updated = [scanResult, ...filtered];
      try {
        sessionStorage.setItem('pg_session_scan_history', JSON.stringify(updated));
      } catch {
        // quota exceeded or private browsing
      }
      return updated;
    });
    showToast('Privacy scan completed successfully! Viewing inspected payload.', 'success');
  };

  const handleSelectScanForInspection = (scan) => {
    setSelectedScanData(scan);
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Workspace Routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <WorkspaceLayout
                  toast={toast}
                  setToast={setToast}
                  settings={appSettings}
                />
              </ProtectedRoute>
            }
          >
            {/* Workspace Child Views */}
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <Dashboard
                  scanHistory={scanHistory}
                  onSelectScan={handleSelectScanForInspection}
                />
              }
            />
            <Route
              path="scanner"
              element={
                <PrivacyScanner
                  onViewResults={handleScannerFinished}
                />
              }
            />
            <Route
              path="results"
              element={
                <Results
                  scanData={selectedScanData}
                />
              }
            />
            <Route
              path="history"
              element={
                <ScanHistory
                  scanHistory={scanHistory}
                  onSelectScan={handleSelectScanForInspection}
                />
              }
            />
            <Route
              path="settings"
              element={
                <Settings
                  settings={appSettings}
                  onSaveSettings={handleSaveSettings}
                />
              }
            />
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
