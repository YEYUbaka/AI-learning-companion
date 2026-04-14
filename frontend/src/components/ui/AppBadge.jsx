/**
 * 徽章组件 - 用于状态标签、分类标记等
 */
import { useThemeStore } from '../../store/themeStore';

const variants = {
  primary: {
    light: 'bg-primary-100 text-primary-700 border-primary-200',
    dark: 'bg-primary-900/40 text-primary-300 border-primary-800/50',
  },
  success: {
    light: 'bg-success-50 text-success-700 border-success-200',
    dark: 'bg-success-500/10 text-success-400 border-success-800/30',
  },
  warning: {
    light: 'bg-warning-50 text-warning-700 border-warning-200',
    dark: 'bg-warning-500/10 text-warning-400 border-warning-800/30',
  },
  ai: {
    light: 'bg-ai-100 text-ai-700 border-ai-200',
    dark: 'bg-ai-500/10 text-ai-400 border-ai-800/30',
  },
  info: {
    light: 'bg-info-50 text-info-700 border-info-200',
    dark: 'bg-info-500/10 text-info-400 border-info-800/30',
  },
  neutral: {
    light: 'bg-gray-100 text-gray-600 border-gray-200',
    dark: 'bg-slate-700/50 text-slate-400 border-slate-600/50',
  },
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function AppBadge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const v = variants[variant]?.[isDark ? 'dark' : 'light'] || variants.neutral.light;
  const s = sizes[size] || sizes.md;

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium border rounded-full ${v} ${s} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-success-500' :
          variant === 'warning' ? 'bg-warning-500' :
          variant === 'ai' ? 'bg-ai-500' :
          variant === 'info' ? 'bg-info-500' :
          'bg-primary-500'
        }`} />
      )}
      {children}
    </span>
  );
}

export default AppBadge;
