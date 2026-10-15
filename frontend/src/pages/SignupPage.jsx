import AuthLayout from '../components/AuthLayout';
import SignupForm from '../components/SignupForm';

/**
 * Dedicated SignupPage Component
 * Matches Panel 3 of the reference design:
 * - Split layout: registration card on left, monumental security gateway on right
 */
export default function SignupPage() {
  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Get started with privacy-first AI protection."
      variant="split"
    >
      <SignupForm />
    </AuthLayout>
  );
}
