import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Editorial StatCard Component
 * Displays telemetry with oversized numbers, cream typography,
 * hairline borders, and transparent demo labels.
 */
export default function StatCard({
  title,
  value,
  trend,
  trendUp = true,
  icon: Icon,
  subtitle,
  isDemo = true,
  onClick,
}) {
  return (
    <div
      className={`pg-editorial-stat-card ${onClick ? 'pg-stat-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`${title}: ${value}`}
    >
      <div className="pg-stat-header">
        <div className="pg-stat-title-group">
          <span className="pg-stat-title">{title}</span>
          {isDemo && <span className="pg-stat-demo-pill">DEMO</span>}
        </div>
        {Icon && (
          <div className="pg-stat-icon-wrap" aria-hidden="true">
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
      </div>

      <div className="pg-stat-body">
        <div className="pg-stat-number">{value}</div>
        {trend && (
          <div
            className={`pg-stat-trend-chip ${trendUp ? 'pg-trend-positive' : 'pg-trend-neutral'}`}
            aria-label={`Trend: ${trend}`}
          >
            {trendUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            <span>{trend}</span>
          </div>
        )}
      </div>

      {subtitle && <p className="pg-stat-caption">{subtitle}</p>}
    </div>
  );
}
