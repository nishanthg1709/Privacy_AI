import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import Button from './Button';

/**
 * Editorial SignupForm Component
 * Full registration flow with password strength calculation,
 * password matching confirmation, terms validation, and Supabase Auth integration.
 */
export default function SignupForm() {
  const { signup, isAuthenticated, isLoading, isCloudConfigured } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState('');
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to workspace
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Compute password strength
  const calculateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', color: 'none' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', class: 'pg-strength-weak' };
      case 2:
        return { score: 2, label: 'Fair', class: 'pg-strength-fair' };
      case 3:
        return { score: 3, label: 'Good', class: 'pg-strength-good' };
      case 4:
        return { score: 4, label: 'Strong', class: 'pg-strength-strong' };
      default:
        return { score: 0, label: 'Weak', class: 'pg-strength-weak' };
    }
  };

  const strength = calculateStrength(password);

  // Field validation checks
  const isNameValid = name.trim().length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 8;
  const isConfirmPasswordValid = confirmPassword.length >= 8 && confirmPassword === password;
  const isTermsValid = Boolean(agreeTerms);

  // Overall form validity and button readiness
  const isFormValid =
    isNameValid &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmPasswordValid &&
    isTermsValid &&
    Boolean(isCloudConfigured);

  const isSubmitDisabled = !isFormValid || isLoading || isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConfirmationNotice(null);

    if (!isCloudConfigured) {
      setError(
        'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.'
      );
      return;
    }

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid work email address.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    if (!agreeTerms) {
      setError('You must accept the terms of service.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await signup({ name: name.trim(), email: email.trim(), password });
      if (newUser?.emailConfirmationPending) {
        setConfirmationNotice(
          `Account registered for ${email.trim()}. A confirmation email has been sent. Please verify your email before signing in.`
        );
        setPassword('');
        setConfirmPassword('');
      } else if (newUser?.id) {
        navigate('/app/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pg-signup-form-root">

      {/* Confirmation Sent Banner */}
      {confirmationNotice && (
        <div className="pg-auth-info-banner" role="status">
          <CheckCircle2 size={16} />
          <div>
            <span>{confirmationNotice}</span>
            <div style={{ marginTop: '8px' }}>
              <Link to="/login" style={{ color: 'var(--pg-cream)', fontSize: '0.84rem', textDecoration: 'underline' }}>
                Go to Log In &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="pg-auth-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pg-auth-form" noValidate>
        {/* Full Name */}
        <div className="pg-auth-field">
          <label htmlFor="signup-name" className="pg-auth-label">
            Full Name
          </label>
          <div className="pg-auth-input-with-icon-wrap">
            <User size={16} className="pg-input-leading-icon" />
            <input
              id="signup-name"
              type="text"
              className="pg-auth-input pg-input-with-leading-icon"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="John Doe"
              autoComplete="name"
              required
            />
          </div>
        </div>

        {/* Work Email */}
        <div className="pg-auth-field">
          <label htmlFor="signup-email" className="pg-auth-label">
            Email
          </label>
          <div className="pg-auth-input-with-icon-wrap">
            <Mail size={16} className="pg-input-leading-icon" />
            <input
              id="signup-email"
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

        {/* Password */}
        <div className="pg-auth-field">
          <label htmlFor="signup-password" className="pg-auth-label">
            Password
          </label>
          <div className="pg-auth-input-with-icon-wrap">
            <Lock size={16} className="pg-input-leading-icon" />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              className="pg-auth-input pg-input-with-leading-icon"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Create a password"
              autoComplete="new-password"
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

          {/* Password Strength Meter */}
          {password && (
            <div className="pg-strength-container" aria-live="polite">
              <div className="pg-strength-bars">
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    className={`pg-strength-bar ${
                      strength.score >= bar ? strength.class : ''
                    }`}
                  />
                ))}
              </div>
              <span className="pg-strength-label">
                Strength: <strong>{strength.label}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="pg-auth-field">
          <label htmlFor="signup-confirm-password" className="pg-auth-label">
            Confirm Password
          </label>
          <div className="pg-auth-input-with-icon-wrap">
            <Lock size={16} className="pg-input-leading-icon" />
            <input
              id="signup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="pg-auth-input pg-input-with-leading-icon"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
            />
          </div>
          {confirmPassword && password !== confirmPassword && (
            <span
              className="pg-field-hint"
              style={{ color: 'var(--pg-cream-400)', marginTop: '4px', fontSize: '0.78rem' }}
            >
              Passwords do not match.
            </span>
          )}
        </div>

        {/* Terms & Conditions Checkbox */}
        <div className="pg-auth-checkbox-row">
          <label className="pg-auth-checkbox-label">
            <input
              type="checkbox"
              className="pg-auth-checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
            />
            <span>
              I agree to the{' '}
              <button
                type="button"
                className="pg-terms-modal-trigger"
                onClick={(e) => {
                  e.preventDefault();
                  setTermsModalOpen(true);
                }}
              >
                Terms &amp; Conditions
              </button>
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading || isSubmitting}
          disabled={isSubmitDisabled}
          iconAfter={ArrowRight}
          className="pg-w-full pg-auth-submit-btn"
          id="signup-create-account-btn"
        >
          Create Account
        </Button>
      </form>

      {/* Switch to Login */}
      <div className="pg-auth-switch-prompt">
        <span>Already have an account?</span>{' '}
        <Link to="/login" className="pg-auth-switch-link">
          Log In
        </Link>
      </div>

      {/* Terms Modal */}
      {termsModalOpen && (
        <div className="pg-modal-backdrop" onClick={() => setTermsModalOpen(false)}>
          <div
            className="pg-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="pg-modal-header">
              <h3>Terms of Service &amp; Privacy Governance</h3>
            </div>
            <div className="pg-modal-body">
              <p>
                PrivacyGuard AI minimizes sensitive tokens before payload dispatch to model providers.
                Accounts and scan telemetry are maintained in your designated Supabase PostgreSQL instance under strict
                Row Level Security (RLS).
              </p>
              <p>
                Original documents and raw detected PII values are never retained in cloud storage.
              </p>
            </div>
            <div className="pg-modal-footer">
              <Button variant="primary" size="sm" onClick={() => setTermsModalOpen(false)}>
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
