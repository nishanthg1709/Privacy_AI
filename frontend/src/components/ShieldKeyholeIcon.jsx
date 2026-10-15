/**
 * Custom Monochrome PrivacyGuard AI Brand Mark
 * Refined shield with integrated security keyhole
 * Optimized for navbar size and crisp vector rendering
 */
export default function ShieldKeyholeIcon({ size = 18, className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Refined Shield Perimeter */}
      <path
        d="M12 2.5L19.5 5.5V11C19.5 16.8 16.2 20 12 21.8C7.8 20 4.5 16.8 4.5 11V5.5L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(245, 243, 238, 0.05)"
      />
      {/* Integrated Security Keyhole */}
      <path
        d="M12 8.2A2 2 0 0 1 13.6 11.6L13.8 14.6A0.6 0.6 0 0 1 13.2 15.2H10.8A0.6 0.6 0 0 1 10.2 14.6L10.4 11.6A2 2 0 0 1 12 8.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
