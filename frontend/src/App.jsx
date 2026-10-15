import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import historyService from './services/historyService';
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
 * Inner Application Controller
 * Has direct access to useAuth() context, manages scan telemetry state,
 * synchronizes with Supabase scan_history when authenticated, and coordinates notifications.
 */
function AppContent() {
  const { user, isCloudConfigured } = useAuth();
  const [selectedScanData, setSelectedScanData] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState(null);

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

  // Persistent session scan history state (populated from actual scans)
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pg_session_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Reset session history on logout
  useEffect(() => {
    if (!user) {
      Promise.resolve().then(() => {
        setScanHistory((prev) => (prev.length > 0 ? [] : prev));
      });
      try {
        sessionStorage.removeItem('pg_session_scan_history');
      } catch {
        // storage unavailable
      }
    }
  }, [user]);

  // Sync scan history from Supabase when an authenticated user is active
  useEffect(() => {
    let active = true;

    if (user && isCloudConfigured) {
      Promise.resolve().then(async () => {
        if (!active) return;
        setIsLoadingHistory(true);
        try {
          const res = await historyService.fetchScanHistory(user);
          if (!active) return;
          if (res.fromCloud) {
            setCloudSyncError(null);
            setScanHistory((prev) => {
              // Merge cloud records with local session scans without duplicate IDs
              const cloudIds = new Set(res.records.map((r) => r.scanId));
              const localOnly = prev.filter((item) => !cloudIds.has(item.scanId));
              return [...res.records, ...localOnly];
            });
          } else if (res.error) {
            setCloudSyncError(res.error);
          }
        } catch (err) {
          if (!active) return;
          setCloudSyncError(err.message || 'Failed to sync scan history from Supabase');
        } finally {
          if (active) setIsLoadingHistory(false);
        }
      });
    }

    return () => {
      active = false;
    };
  }, [user, isCloudConfigured]);

  const handleSaveSettings = (newSettings) => {
    setAppSettings(newSettings);
    try {
      localStorage.setItem('pg_app_settings', JSON.stringify(newSettings));
    } catch {
      // storage unavailable
    }
    showToast('Preferences updated and persisted.', 'success');
  };

  const handleScannerFinished = async (scanResult) => {
    setSelectedScanData(scanResult);

    // 1. Always preserve the full scan result locally in memory and session storage
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

    // 2. If user is authenticated via Supabase, synchronize minimal telemetry metadata
    if (user && isCloudConfigured) {
      const saveRes = await historyService.saveScanHistory(scanResult, user);
      if (saveRes.saved) {
        showToast('Privacy scan complete! Telemetry metadata recorded to Supabase.', 'success');
        setScanHistory((prev) =>
          prev.map((item) =>
            item.scanId === scanResult.scanId ? { ...item, persistedToCloud: true } : item
          )
        );
      } else {
        // Transparent feedback: Scan results remain 100% intact locally
        const detail = saveRes.error ? ` (${saveRes.error})` : '';
        showToast(
          `Scan completed locally. Note: Cloud history sync unavailable${detail}. Result is preserved.`,
          'info'
        );
      }
    } else {
      showToast('Privacy scan completed successfully! Viewing inspected payload.', 'success');
    }
  };

  const handleSelectScanForInspection = (scan) => {
    setSelectedScanData(scan);
  };

  const isCloudActive = Boolean(user && isCloudConfigured);

  return (
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
              isCloud={isCloudActive}
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
              isLoadingHistory={isLoadingHistory}
              cloudSyncError={cloudSyncError}
              isCloud={isCloudActive}
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
  );
}

/**
 * Main Application Root
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
