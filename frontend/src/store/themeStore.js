import { create } from 'zustand';

const THEME_STORAGE_KEY = 'zhixueban_theme';
const THEME_MANUAL_KEY = 'zhixueban_theme_manual'; // 标记用户是否手动设置过主题

const canUseDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * 根据当前时间判断应该使用日间还是夜间主题
 * 默认规则：18:00 - 次日 6:00 为夜间模式
 */
const getThemeByTime = () => {
  if (!canUseDOM) {
    return 'light';
  }
  const now = new Date();
  const hour = now.getHours();
  // 18:00 (18) 到 次日 6:00 (5) 为夜间模式
  return hour >= 18 || hour < 6 ? 'dark' : 'light';
};

const getInitialTheme = () => {
  if (!canUseDOM) {
    return 'light';
  }
  
  // 检查用户是否手动设置过主题
  const isManual = localStorage.getItem(THEME_MANUAL_KEY) === 'true';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  
  // 如果用户手动设置过，使用保存的主题
  if (isManual && (stored === 'dark' || stored === 'light')) {
    return stored;
  }
  
  // 如果用户没有手动设置过，根据当前时间自动判断
  // 每次访问都重新判断，确保时间变化时主题也会变化
  const timeBasedTheme = getThemeByTime();
  
  // 更新保存的主题（但不标记为手动），这样下次访问时如果时间相同会保持一致
  localStorage.setItem(THEME_STORAGE_KEY, timeBasedTheme);
  
  return timeBasedTheme;
};

const applyTheme = (theme) => {
  if (!canUseDOM) return;
  document.documentElement.dataset.theme = theme;
};

const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useThemeStore = create((set) => ({
  theme: initialTheme,
  setTheme: (nextTheme, isManual = true) => {
    applyTheme(nextTheme);
    if (canUseDOM) {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      // 标记为用户手动设置
      if (isManual) {
        localStorage.setItem(THEME_MANUAL_KEY, 'true');
      }
    }
    set({ theme: nextTheme });
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      if (canUseDOM) {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        // 用户手动切换，标记为手动设置
        localStorage.setItem(THEME_MANUAL_KEY, 'true');
      }
      return { theme: nextTheme };
    }),
  // 重置为自动模式（根据时间判断）
  resetToAuto: () => {
    const timeBasedTheme = getThemeByTime();
    applyTheme(timeBasedTheme);
    if (canUseDOM) {
      localStorage.setItem(THEME_STORAGE_KEY, timeBasedTheme);
      localStorage.removeItem(THEME_MANUAL_KEY);
    }
    set({ theme: timeBasedTheme });
  },
}));

