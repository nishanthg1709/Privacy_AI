import AuthLayout from '../components/AuthLayout';
import LoginForm from '../components/LoginForm';

/**
 * Dedicated LoginPage Component
 */
export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your PrivacyGuard AI workspace to manage live minimization guardrails."
      sideQuote="Privacy is not merely compliance; it is the fundamental prerequisite of scalable AI utility."
      sideAuthor="Zero-Retention Architecture Standard"
    >
      <LoginForm />
    </AuthLayout>
  );
}
