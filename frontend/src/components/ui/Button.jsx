/**
 * 按钮组件系统
 * 提供统一的按钮样式和交互效果
 */
import { useThemeStore } from '../../store/themeStore';

/**
 * 按钮变体样式
 */
const buttonVariants = {
  primary: {
    light: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md',
    dark: 'bg-blue-600 text-white shadow-sm hover:bg-blue-500 hover:shadow-md',
  },
  secondary: {
    light: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
    dark: 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 hover:border-slate-500',
  },
  success: {
    light: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
    dark: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500',
  },
  danger: {
    light: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
    dark: 'bg-red-600 text-white shadow-sm hover:bg-red-500',
  },
  ghost: {
    light: 'bg-transparent text-gray-700 hover:bg-gray-100',
    dark: 'bg-transparent text-slate-300 hover:bg-slate-700/50',
  },
  outline: {
    light: 'bg-transparent text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
    dark: 'bg-transparent text-blue-400 border-2 border-blue-400 hover:bg-blue-900/20',
  },
};

/**
 * 按钮尺寸
 */
const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
  xl: 'px-8 py-3 text-lg',
};

/**
 * 基础按钮组件
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // 基础样式
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-medium rounded-lg
    transition-all duration-200 ease-smooth
    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
  `;

  // 变体样式
  const variantStyle = buttonVariants[variant]?.[isDark ? 'dark' : 'light'] || buttonVariants.primary.light;

  // 尺寸样式
  const sizeStyle = buttonSizes[size] || buttonSizes.md;

  // 宽度样式
  const widthStyle = fullWidth ? 'w-full' : '';

  // 悬停动效
  const hoverAnimation = !disabled && !loading ? 'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]' : '';

  // 加载图标
  const LoadingSpinner = () => (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        ${baseStyles}
        ${variantStyle}
        ${sizeStyle}
        ${widthStyle}
        ${hoverAnimation}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner />
          <span>处理中...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

/**
 * 图标按钮
 */
export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}) {
  const sizeMap = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
    xl: 'p-3',
  };

  return (
    <Button
      variant={variant}
      className={`${sizeMap[size]} ${className}`}
      {...props}
    >
      {icon}
    </Button>
  );
}

/**
 * 按钮组
 */
export function ButtonGroup({ children, className = '' }) {
  return (
    <div className={`inline-flex rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/**
 * 导出变体类型供外部使用
 */
export { buttonVariants, buttonSizes };

export default Button;