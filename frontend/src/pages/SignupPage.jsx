import AuthLayout from '../components/AuthLayout';
import SignupForm from '../components/SignupForm';

/**
 * Dedicated SignupPage Component
 */
export default function SignupPage() {
  return (
    <AuthLayout
      title="Create account."
      subtitle="Establish a secure local workspace to test real-time PII interception and anonymization."
      sideQuote="Protect confidential context before the prompt leaves your perimeter."
      sideAuthor="Enterprise Data Minimization Manifesto"
    >
      <SignupForm />
    </AuthLayout>
  );
}
