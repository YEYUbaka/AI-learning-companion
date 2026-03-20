import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import IconFontSymbol from './icons/IconFontSymbol.jsx';
import { HOMEPAGE_ICON_NAMES } from './icons/homepageIconNames.js';
import BrandMark from './homepage/BrandMark.jsx';

const THEME_OPTIONS = [
  { key: 'light', label: '浅色模式', sub: '始终使用浅色主题', Icon: SunIcon },
  { key: 'dark', label: '深色模式', sub: '始终使用深色主题', Icon: MoonIcon },
  { key: 'auto', label: '跟随系统', sub: '根据系统外观自动切换', Icon: MonitorIcon },
];

const NAV_ITEMS = [
  { key: 'home', label: '首页', path: '/dashboard', icon: HOMEPAGE_ICON_NAMES.home },
  { key: 'agent', label: '学习助手', path: '/agent', icon: HOMEPAGE_ICON_NAMES.agent },
  {
    key: 'plan',
    label: '学习计划',
    path: '/study-plan',
    icon: HOMEPAGE_ICON_NAMES.plan,
    activePaths: ['/study-plan', '/upload-file'],
  },
  {
    key: 'quiz',
    label: '专项测评',
    path: '/quiz',
    icon: HOMEPAGE_ICON_NAMES.quiz,
    activePaths: ['/quiz', '/quiz-result'],
  },
  {
    key: 'map',
    label: '知识图谱',
    path: '/learning-map',
    icon: HOMEPAGE_ICON_NAMES.map,
  },
];

const ADMIN_ITEM = {
  key: 'admin',
  label: '管理后台',
  path: '/admin/dashboard',
  icon: null,
  activePrefix: '/admin',
};

function SunIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m8.66-9H21M3 12H2m15.07-6.07l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function NavIcon({ name }) {
  return (
    <span
      data-testid="nav-icon"
      className="academy-nav-icon inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] text-[var(--academy-text)]"
      aria-hidden="true"
    >
      <IconFontSymbol
        name={name}
        className="h-4 w-4"
        fallback={
          <span
            data-testid="nav-icon-fallback"
            className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--academy-accent)]"
            aria-hidden="true"
          />
        }
      />
    </span>
  );
}

function matchesNavItem(pathname, item) {
  if (item.activePrefix) return pathname.startsWith(item.activePrefix);
  if (item.activePaths) return item.activePaths.includes(pathname);
  return pathname === item.path;
}

function navLinkClass(isActive, isMobile = false) {
  if (isMobile) {
    return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors ${
      isActive
        ? 'bg-[var(--academy-surface-soft)] text-[var(--academy-text)]'
        : 'text-[var(--academy-text-muted)] hover:bg-[var(--academy-surface-soft)] hover:text-[var(--academy-text)]'
    }`;
  }

  return `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
    isActive
      ? 'border-[color:var(--academy-accent)] bg-[var(--academy-surface-soft)] text-[var(--academy-text)] shadow-sm'
      : 'border-transparent text-[var(--academy-text-muted)] hover:border-[color:var(--academy-border)] hover:bg-[var(--academy-surface-soft)] hover:text-[var(--academy-text)]'
  }`;
}

function ThemeDropdown({ mode, setMode, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const CurrentIcon = mode === 'light' ? SunIcon : mode === 'dark' ? MoonIcon : MonitorIcon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--academy-border)] bg-[var(--academy-surface)] text-[var(--academy-text)] transition-colors hover:bg-[var(--academy-surface-soft)]"
        title="切换主题"
        aria-label="切换主题"
      >
        <CurrentIcon />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-56 overflow-hidden rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface)] shadow-[0_20px_50px_rgba(44,35,29,0.14)]">
          {THEME_OPTIONS.map(({ key, label, sub, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                mode === key
                  ? 'bg-[var(--academy-surface-soft)] text-[var(--academy-text)]'
                  : 'text-[var(--academy-text)] hover:bg-[var(--academy-surface-soft)]'
              }`}
            >
              <span className="flex-shrink-0">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-tight">{label}</span>
                <span className="mt-0.5 block text-xs text-[var(--academy-text-muted)]">{sub}</span>
              </span>
              {mode === key ? (
                <span className="ml-1 flex-shrink-0">
                  <CheckIcon />
                </span>
              ) : null}
            </button>
          ))}
          {mode === 'auto' ? (
            <div className="border-t border-[color:var(--academy-border)] px-4 py-2 text-xs text-[var(--academy-text-muted)]">
              当前跟随系统：{theme === 'dark' ? '深色' : '浅色'}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, mode, setMode } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  let userInfo = {};
  try {
    userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
  } catch {
    userInfo = {};
  }

  const isAdmin = userInfo?.role === 'admin';
  const currentUserName = userInfo?.name || userInfo?.nickname || userInfo?.email || '学习者';
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userInfo');
    navigate('/login');
  };

  const renderNavItem = (item, isMobile = false) => {
    const active = matchesNavItem(location.pathname, item);
    return (
      <Link
        key={item.key}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className={navLinkClass(active, isMobile)}
        onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
      >
        {item.icon ? <NavIcon name={item.icon} /> : null}
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--academy-border)] bg-[var(--academy-surface)] text-[var(--academy-text)] shadow-[0_16px_40px_rgba(44,35,29,0.08)]">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link to="/dashboard" className="shrink-0">
              <BrandMark />
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto md:flex lg:gap-3">
              {navItems.map((item) => renderNavItem(item))}
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex lg:gap-4">
            <ThemeDropdown mode={mode} setMode={setMode} theme={theme} />
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium text-[var(--academy-text)]">{currentUserName}</p>
              {userInfo?.email ? (
                <p className="text-xs text-[var(--academy-text-muted)]">{userInfo.email}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center rounded-full border border-[color:var(--academy-border)] bg-[var(--academy-accent)] px-4 py-2 text-sm font-medium text-[var(--academy-surface)] transition-colors hover:bg-[var(--academy-accent-soft)]"
            >
              退出登录
            </button>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <ThemeDropdown mode={mode} setMode={setMode} theme={theme} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="rounded-full border border-[color:var(--academy-border)] bg-[var(--academy-surface)] p-2 text-[var(--academy-text)] transition-colors hover:bg-[var(--academy-surface-soft)]"
              aria-label={mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div id="mobile-nav-menu" className="border-t border-[color:var(--academy-border)] py-3 sm:hidden">
            <div className="space-y-1">
              {navItems.map((item) => renderNavItem(item, true))}

              <div className="mt-2 border-t border-[color:var(--academy-border)] pt-3">
                <div className="px-3 pb-2">
                  <p className="text-sm font-medium text-[var(--academy-text)]">{currentUserName}</p>
                  {userInfo?.email ? (
                    <p className="text-xs text-[var(--academy-text-muted)]">{userInfo.email}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full rounded-xl bg-[var(--academy-accent)] px-3 py-2.5 text-sm font-medium text-[var(--academy-surface)] transition-colors hover:bg-[var(--academy-accent-soft)]"
                >
                  退出登录
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export default Navbar;
