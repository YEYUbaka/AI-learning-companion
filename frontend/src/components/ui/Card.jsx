/**
 * 卡片组件系统
 * 提供统一的卡片样式和交互效果
 */
import { Link } from 'react-router-dom';
import { useThemeStore } from '../../store/themeStore';

/**
 * 基础卡片组件
 * @param {boolean} hover - 是否启用悬停效果
 * @param {boolean} glow - 是否启用边框光效
 * @param {string} variant - 卡片变体: 'default' | 'elevated' | 'outlined' | 'gradient'
 */
export function Card({
  children,
  className = '',
  hover = true,
  glow = false,
  variant = 'default',
  padding = 'p-6',
  ...props
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // 基础样式
  const baseStyles = 'rounded-xl transition-all duration-250 ease-smooth';

  // 变体样式
  const variantStyles = {
    default: isDark
      ? 'bg-slate-800/80 border border-slate-700/50'
      : 'bg-white border border-gray-100 shadow-card',
    elevated: isDark
      ? 'bg-slate-800 shadow-lg shadow-black/20'
      : 'bg-white shadow-lg shadow-gray-200/50',
    outlined: isDark
      ? 'bg-transparent border-2 border-slate-700'
      : 'bg-transparent border-2 border-gray-200',
    gradient: isDark
      ? 'bg-gradient-to-br from-slate-800 to-slate-800/50 border border-slate-700/50'
      : 'bg-gradient-to-br from-white to-blue-50/30 border border-gray-100',
  };

  // 悬停效果
  const hoverStyles = hover
    ? isDark
      ? 'hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 hover:border-blue-500/30'
      : 'hover:shadow-card-hover hover:-translate-y-0.5 hover:border-blue-200'
    : '';

  // 光效样式
  const glowStyles = glow
    ? 'card-glow'
    : '';

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${glowStyles} ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 统计数据卡片
 * 用于展示数字统计，带有图标和标签
 */
export function StatCard({
  label,
  value,
  unit = '',
  icon,
  iconBg = 'bg-blue-100',
  iconColor = 'text-blue-600',
  trend,
  trendUp = true,
  className = '',
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <Card className={`group ${className}`} hover>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
          {label}
        </span>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {value}
        {unit && (
          <span className={`text-sm font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {unit}
          </span>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-xs flex items-center gap-1 ${
          trendUp
            ? isDark ? 'text-emerald-400' : 'text-emerald-600'
            : isDark ? 'text-red-400' : 'text-red-500'
        }`}>
          {trendUp ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {trend}
        </div>
      )}
    </Card>
  );
}

/**
 * 功能入口卡片
 * 用于 Dashboard 的功能快捷入口
 */
export function FeatureCard({
  title,
  description,
  icon,
  iconBg = 'bg-blue-100',
  iconColor = 'text-blue-600',
  to,
  onClick,
  className = '',
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const content = (
    <>
      <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`text-sm truncate ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
          {description}
        </p>
      </div>
      <svg
        className={`w-5 h-5 flex-shrink-0 transition-all duration-200 ${
          isDark ? 'text-slate-600 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-600'
        } group-hover:translate-x-1`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  );

  const cardClass = `group flex items-center gap-4 ${className} ${
    isDark
      ? 'bg-slate-800 border-slate-700 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5'
      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-card-hover'
  } border rounded-xl p-6 transition-all duration-250 cursor-pointer`;

  if (to) {
    return (
      <Link to={to} className={cardClass}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClass} onClick={onClick}>
      {content}
    </div>
  );
}

/**
 * 卡片头部
 */
export function CardHeader({ title, subtitle, action, className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        {subtitle && (
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * 卡片内容区
 */
export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

/**
 * 卡片底部
 */
export function CardFooter({ children, className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'} ${className}`}>
      {children}
    </div>
  );
}

export default Card;