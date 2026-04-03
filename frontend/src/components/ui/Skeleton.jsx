/**
 * 骨架屏组件
 * 用于加载状态占位，提升用户体验
 */
import { useThemeStore } from '../../store/themeStore';

/**
 * 基础骨架元素
 */
export function Skeleton({
  width,
  height,
  className = '',
  variant = 'text',
  animation = 'shimmer',
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // 变体样式
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-xl',
  };

  // 动画样式
  const animationStyles = {
    shimmer: 'skeleton-shimmer',
    pulse: 'animate-pulse bg-gray-200 dark:bg-slate-700',
    none: isDark ? 'bg-slate-700' : 'bg-gray-200',
  };

  // 基础样式
  const baseStyle = isDark
    ? 'bg-slate-700/50'
    : 'bg-gray-200/70';

  return (
    <div
      className={`
        ${baseStyle}
        ${variantStyles[variant]}
        ${animationStyles[animation]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      style={{ width, height }}
    />
  );
}

/**
 * 文本骨架
 */
export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = '60%',
  className = '',
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          className="rounded"
        />
      ))}
    </div>
  );
}

/**
 * 卡片骨架
 */
export function SkeletonCard({ className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div
      className={`
        rounded-xl p-6 space-y-4
        ${isDark ? 'bg-slate-800' : 'bg-white border border-gray-100'}
        ${className}
      `}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <Skeleton width={120} height={16} />
        <Skeleton width={40} height={40} variant="circular" />
      </div>
      {/* 数值 */}
      <Skeleton width={80} height={32} />
      {/* 底部文字 */}
      <Skeleton width={100} height={12} />
    </div>
  );
}

/**
 * 统计卡片骨架
 */
export function SkeletonStatCard({ className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div
      className={`
        rounded-xl p-5
        ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-card'}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton width={60} height={14} />
        <Skeleton width={40} height={40} variant="circular" />
      </div>
      <div className="flex items-baseline gap-2">
        <Skeleton width={60} height={28} />
        <Skeleton width={24} height={12} />
      </div>
    </div>
  );
}

/**
 * 列表项骨架
 */
export function SkeletonListItem({ className = '' }) {
  return (
    <div className={`flex items-center gap-4 p-4 ${className}`}>
      <Skeleton width={48} height={48} variant="circular" />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
  );
}

/**
 * 表格行骨架
 */
export function SkeletonTableRow({ columns = 4, className = '' }) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <Skeleton height={16} width={index === 0 ? '80%' : '60%'} />
        </td>
      ))}
    </tr>
  );
}

/**
 * 图表骨架
 */
export function SkeletonChart({ height = 240, className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div
      className={`
        rounded-xl p-6
        ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-card'}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={100} height={18} />
        <Skeleton width={60} height={12} />
      </div>
      <div style={{ height }}>
        {/* 模拟图表网格 */}
        <div className="h-full flex items-end justify-around gap-2 px-4">
          {[40, 60, 35, 80, 55, 70, 45].map((h, i) => (
            <Skeleton
              key={i}
              height={`${h}%`}
              width="12%"
              variant="rectangular"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 导航栏骨架
 */
export function SkeletonNavbar({ className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <nav
      className={`
        h-16 px-6 flex items-center justify-between
        ${isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-white border-b border-gray-100'}
        ${className}
      `}
    >
      {/* Logo */}
      <Skeleton width={80} height={24} />
      {/* 导航链接 */}
      <div className="hidden md:flex items-center gap-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={60} height={14} />
        ))}
      </div>
      {/* 用户区域 */}
      <div className="flex items-center gap-4">
        <Skeleton width={36} height={36} variant="circular" />
        <Skeleton width={80} height={32} variant="rectangular" />
      </div>
    </nav>
  );
}

/**
 * Dashboard 页面骨架
 */
export function SkeletonDashboard({ className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div
      className={`
        min-h-screen p-6 space-y-6
        ${isDark ? 'bg-slate-900' : 'bg-gray-50'}
        ${className}
      `}
    >
      {/* 欢迎区 */}
      <div
        className={`
          rounded-xl p-6
          ${isDark ? 'bg-slate-800' : 'bg-white border border-gray-100'}
        `}
      >
        <Skeleton width={160} height={28} />
        <Skeleton width={200} height={14} className="mt-2" />
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* 功能入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`
              rounded-xl p-6 flex items-center gap-4
              ${isDark ? 'bg-slate-800' : 'bg-white border border-gray-100'}
            `}
          >
            <Skeleton width={48} height={48} variant="circular" />
            <div className="flex-1 space-y-2">
              <Skeleton width="70%" height={16} />
              <Skeleton width="50%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;