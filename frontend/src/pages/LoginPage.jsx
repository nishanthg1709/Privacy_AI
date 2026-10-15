import AuthLayout from '../components/AuthLayout';
import LoginForm from '../components/LoginForm';

/**
 * Dedicated LoginPage Component
 * Matches Panel 2 of the reference design:
 * - Centered floating card with Welcome Back
 * - Atmospheric dark space horizon background
 */
export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to continue to your workspace."
      variant="centered"
    >
      <LoginForm />
    </AuthLayout>
  );
}
