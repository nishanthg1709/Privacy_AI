import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * ProtectedRoute Component
 * Guards workspace routes. If user is not authenticated in the demo flow,
 * redirects to the Login page while preserving target path.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="pg-auth-loading-screen">
        <div className="pg-spinner-circle" aria-label="Loading workspace..."></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
