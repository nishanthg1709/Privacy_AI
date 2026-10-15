import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import Button from './Button';

/**
 * Editorial LoginForm Component
 * Handles form validation, password visibility toggling, remember-me persistence,
 * error presentation, and instant demo sign in.
 */
export default function LoginForm() {
  const { login, demoLogin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('alex.morgan@privacyguard.ai');
  const [password, setPassword] = useState('demoPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);

  // Where to redirect after login (defaults to /app/dashboard)
  const from = location.state?.from?.pathname || '/app/dashboard';

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

    try {
      await login({ email, password, rememberMe });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    try {
      await demoLogin();
      navigate(from, { replace: true });
    } catch {
      setError('Failed to initiate demo session.');
    }
  };

  return (
    <div className="pg-login-form-root">
      {/* Demo Notification Banner */}
      <div className="pg-auth-demo-banner" role="status">
        <div className="pg-auth-demo-header">
          <Sparkles size={14} className="pg-text-cream" />
          <span>Local Demo Authentication</span>
        </div>
        <p className="pg-auth-demo-desc">
          Click &ldquo;Demo Instant Sign In&rdquo; below or enter any sample email to access the workspace.
        </p>
      </div>

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
            Demo Mode: Password reset instructions simulated for {email || 'your email'}.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pg-auth-form" noValidate>
        {/* Email Field */}
        <div className="pg-auth-field">
          <label htmlFor="login-email" className="pg-auth-label">
            Work Email Address
          </label>
          <input
            id="login-email"
            type="email"
            className="pg-auth-input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="name@company.com"
            autoComplete="email"
            required
          />
        </div>

        {/* Password Field with Show/Hide */}
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

          <div className="pg-auth-password-wrap">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="pg-auth-input pg-input-with-icon"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="••••••••••••"
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
            <span>Remember this device for 30 days</span>
          </label>
        </div>

        {/* Primary Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          iconAfter={ArrowRight}
          className="pg-w-full"
        >
          Sign In to Workspace
        </Button>

        {/* Instant Demo Sign In Button */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          icon={Sparkles}
          onClick={handleDemoSignIn}
          disabled={isLoading}
          className="pg-w-full pg-mt-3"
        >
          Demo Instant Sign In (1-Click)
        </Button>
      </form>

      {/* Switch to Signup */}
      <div className="pg-auth-switch-prompt">
        <span>Don&rsquo;t have a PrivacyGuard account?</span>{' '}
        <Link to="/signup" className="pg-auth-switch-link">
          Create an account
        </Link>
      </div>
    </div>
  );
}
