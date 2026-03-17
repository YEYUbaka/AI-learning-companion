import { create } from 'zustand';

const MODE_STORAGE_KEY = 'zhixueban_theme_mode';
const THEME_STORAGE_KEY = 'zhixueban_theme';

const canUseDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

export const resolveTheme = (mode) => {
  if (mode === 'auto') {
    if (!canUseDOM) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
};

const applyTheme = (theme) => {
  if (!canUseDOM) return;
  document.documentElement.dataset.theme = theme;
};

const getInitialMode = () => {
  if (!canUseDOM) return 'auto';
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  // 旧版本迁移：读取手动设置的主题
  const isManual = localStorage.getItem('zhixueban_theme_manual') === 'true';
  const oldTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (isManual && (oldTheme === 'light' || oldTheme === 'dark')) return oldTheme;
  return 'auto';
};

const initialMode = getInitialMode();
const initialTheme = resolveTheme(initialMode);

applyTheme(initialTheme);
if (canUseDOM) {
  localStorage.setItem(THEME_STORAGE_KEY, initialTheme);
}

export const useThemeStore = create((set, get) => {
  // 注册系统主题变化监听，auto 模式下自动响应
  if (canUseDOM) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (get().mode === 'auto') {
        const newTheme = mediaQuery.matches ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        set({ theme: newTheme });
      }
    });
  }

  return {
    mode: initialMode,
    theme: initialTheme,
    setMode: (newMode) => {
      const newTheme = resolveTheme(newMode);
      applyTheme(newTheme);
      if (canUseDOM) {
        localStorage.setItem(MODE_STORAGE_KEY, newMode);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
      set({ mode: newMode, theme: newTheme });
    },
    // 保留 toggleTheme 兼容旧代码
    toggleTheme: () => {
      const { theme: currentTheme } = get();
      const newMode = currentTheme === 'dark' ? 'light' : 'dark';
      const newTheme = newMode; // toggle 只在 dark/light 之间切换，mode === theme
      applyTheme(newTheme);
      if (canUseDOM) {
        localStorage.setItem(MODE_STORAGE_KEY, newMode);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
      set({ mode: newMode, theme: newTheme });
    },
  };
});
