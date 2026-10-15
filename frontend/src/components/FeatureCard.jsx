/**
 * Editorial FeatureCard Component
 * Displays a feature with subtle hairline borders, cream typography,
 * index numbering, and restrained hover elevations.
 */
export default function FeatureCard({
  number,
  title,
  description,
  tag,
  icon: Icon,
  className = '',
  children,
}) {
  return (
    <div className={`pg-editorial-card ${className}`}>
      <div className="pg-card-top-row">
        {number && <span className="pg-card-num">{number}</span>}
        {tag && <span className="pg-card-tag">{tag}</span>}
        {Icon && (
          <div className="pg-card-icon-container" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <h3 className="pg-card-headline">{title}</h3>
      <p className="pg-card-description">{description}</p>

      {children && <div className="pg-card-body-extra">{children}</div>}
    </div>
  );
}
