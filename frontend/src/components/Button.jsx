import { forwardRef } from 'react';

/**
 * Reusable Editorial Button Component
 * Supports variants: 'primary' (cream bg with near-black text),
 * 'secondary' (dark slate surface with subtle cream border),
 * 'outline' (hairline border), 'ghost' (transparent hover).
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconAfter: IconAfter,
    isLoading = false,
    disabled = false,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  const baseClasses = 'pg-btn-editorial';
  const variantClass = `pg-btn-${variant}`;
  const sizeClass = `pg-btn-sz-${size}`;
  const disabledState = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabledState}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="pg-btn-spinner" aria-hidden="true"></span>
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="pg-btn-icon-leading" />
      ) : null}

      <span className="pg-btn-text">{children}</span>

      {!isLoading && IconAfter && (
        <IconAfter size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="pg-btn-icon-trailing" />
      )}
    </button>
  );
});

export default Button;
