import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import Button from './Button';

/**
 * Editorial LoginForm Component
 * Handles Supabase email/password authentication, loading/error states,
 * and redirecting authenticated users to the workspace.
 */
export default function LoginForm() {
  const { login, isAuthenticated, isLoading, isCloudConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);

  // Where to redirect after login (defaults to /app/dashboard)
  const from = location.state?.from?.pathname || '/app/dashboard';

  // If already authenticated, redirect to workspace
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your work email.');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    if (!isCloudConfigured) {
      setError(
        'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password, rememberMe });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pg-login-form-root">

      {/* Error Message */}
      {error && (
        <div className="pg-auth-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Forgot Password Feedback Banner */}
      {forgotPasswordNotice && (
        <div className="pg-auth-info-banner" role="status">
          <CheckCircle2 size={16} />
          <span>
            Password reset instructions can be triggered through your Supabase project dashboard for{' '}
            {email || 'your email'}.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pg-auth-form" noValidate>
        {/* Email Field with Mail Icon */}
        <div className="pg-auth-field">
          <label htmlFor="login-email" className="pg-auth-label">
            Email
          </label>
          <div className="pg-auth-input-with-icon-wrap">
            <Mail size={16} className="pg-input-leading-icon" />
            <input
              id="login-email"
              type="email"
              className="pg-auth-input pg-input-with-leading-icon"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        {/* Password Field with Lock Icon and Eye Toggle */}
        <div className="pg-auth-field">
          <div className="pg-auth-label-row">
            <label htmlFor="login-password" className="pg-auth-label">
              Password
            </label>
            <button
              type="button"
              className="pg-auth-forgot-btn"
              onClick={() => setForgotPasswordNotice(true)}
            >
              Forgot password?
            </button>
          </div>

          <div className="pg-auth-input-with-icon-wrap">
            <Lock size={16} className="pg-input-leading-icon" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="pg-auth-input pg-input-with-leading-icon"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="pg-password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="pg-auth-checkbox-row">
          <label className="pg-auth-checkbox-label">
            <input
              type="checkbox"
              className="pg-auth-checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
        </div>

        {/* Primary Submit Button matching Reference Panel 2 */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading || isSubmitting}
          disabled={isLoading || isSubmitting || !isCloudConfigured || !email.trim() || !password}
          iconAfter={ArrowRight}
          className="pg-w-full pg-auth-submit-btn"
          id="login-submit-btn"
        >
          Log In
        </Button>
      </form>

      {/* Switch to Signup */}
      <div className="pg-auth-switch-prompt">
        <span>New to PrivacyGuard AI?</span>{' '}
        <Link to="/signup" className="pg-auth-switch-link">
          Create an account
        </Link>
      </div>
    </div>
  );
}
