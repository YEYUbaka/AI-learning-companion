import { useThemeStore } from '../store/themeStore';

/**
 * 背景装饰组件 - 浮动几何图形 + 光晕
 * 用于页面背景增加视觉层次感
 */
export function FloatingOrbs({ count = 3 }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  
  const orbs = [
    { size: 'w-96 h-96', color: isDark ? 'bg-blue-600/10' : 'bg-blue-500/5', pos: '-top-48 -left-48', anim: 'animate-[floatSlow_8s_ease-in-out_infinite]' },
    { size: 'w-80 h-80', color: isDark ? 'bg-purple-600/10' : 'bg-purple-500/5', pos: 'top-1/3 -right-40', anim: 'animate-[floatMedium_10s_ease-in-out_infinite]' },
    { size: 'w-64 h-64', color: isDark ? 'bg-emerald-600/8' : 'bg-emerald-500/5', pos: 'bottom-20 left-1/4', anim: 'animate-[floatSlow_12s_ease-in-out_infinite_reverse]' },
    { size: 'w-48 h-48', color: isDark ? 'bg-amber-600/8' : 'bg-amber-500/5', pos: 'top-20 right-1/3', anim: 'animate-[floatMedium_9s_ease-in-out_infinite_reverse]' },
    { size: 'w-72 h-72', color: isDark ? 'bg-cyan-600/8' : 'bg-cyan-500/5', pos: 'bottom-0 -right-36', anim: 'animate-[floatSlow_11s_ease-in-out_infinite]' },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {orbs.slice(0, count).map((orb, i) => (
        <div
          key={i}
          className={`absolute ${orb.size} ${orb.color} rounded-full blur-3xl ${orb.pos} ${orb.anim}`}
        />
      ))}
    </div>
  );
}

/**
 * 网格点阵背景
 */
export function DotGrid({ className = '' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${isDark ? 'text-white' : 'text-slate-400'} bg-dots opacity-30 ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * 径向光晕背景
 */
export function GlowBackground({ className = '' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none bg-glow ${className}`} aria-hidden="true" />
  );
}

/**
 * 组合背景装饰 - 光晕 + 浮动球
 */
export function PageDecorations({ orbs = 3 } = {}) {
  return (
    <>
      <GlowBackground />
      <FloatingOrbs count={orbs} />
    </>
  );
}

export default PageDecorations;
