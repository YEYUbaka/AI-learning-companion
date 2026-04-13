import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../store/themeStore';
import { Motion } from './ui/Motion';
import { clearAuthSession } from '../utils/auth';

const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 3v1m0 16v1m8.66-9H21M3 12H2m15.07-6.07l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const MonitorIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const THEME_OPTIONS = [
  { key: 'light', label: '浅色模式', sub: '始终使用浅色主题', Icon: SunIcon },
  { key: 'dark',  label: '深色模式', sub: '始终使用深色主题', Icon: MoonIcon },
  { key: 'auto',  label: '自动模式', sub: '跟随系统主题设置', Icon: MonitorIcon },
];

function ThemeDropdown({ isDark, mode, setMode, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const CurrentIcon = mode === 'light' ? SunIcon : mode === 'dark' ? MoonIcon : MonitorIcon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`p-2 rounded-lg border transition-colors ${
          isDark
            ? 'bg-white/5 text-white border-white/15 hover:bg-white/10'
            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
        }`}
        title="切换主题"
      >
        <CurrentIcon />
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-lg z-[60] overflow-hidden ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
        }`}>
          {THEME_OPTIONS.map(({ key, label, sub, Icon }) => (
            <button
              key={key}
              onClick={() => { setMode(key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                mode === key
                  ? isDark
                    ? 'bg-blue-900/30 text-blue-400'
                    : 'bg-blue-50 text-blue-600'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-700/60'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex-shrink-0"><Icon /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{label}</div>
                <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{sub}</div>
              </div>
              {mode === key && (
                <span className="flex-shrink-0 ml-1"><CheckIcon /></span>
              )}
            </button>
          ))}
          {mode === 'auto' && (
            <div className={`px-4 py-2 border-t text-xs ${
              isDark ? 'border-slate-700 text-slate-500' : 'border-gray-100 text-gray-400'
            }`}>
              当前跟随系统：{theme === 'dark' ? '深色' : '浅色'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, mode, setMode } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === 'dark';
  let userInfo = {};
  try {
    userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
  } catch {
    userInfo = {};
  }
  const isAdmin = userInfo?.role === 'admin';

  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const navLinkClass = (path) => {
    const isActive =
      path === '/study-plan'
        ? location.pathname === '/study-plan' || location.pathname === '/upload-file'
        : path === '/quiz'
        ? location.pathname === '/quiz' || location.pathname === '/quiz-result'
        : path === '/admin'
        ? location.pathname.startsWith('/admin')
        : location.pathname === path;

    return `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
      isActive
        ? isDark
          ? 'border-cyan-400 text-white'
          : 'border-primary text-gray-900'
        : isDark
        ? 'border-transparent text-white/60 hover:text-white hover:border-white/30'
        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
    }`;
  };

  return (
    <nav
      className={`border-b sticky top-0 z-50 ${
        isDark ? 'bg-[#0f121b] border-white/10 text-white' : 'bg-white border-slate-100 text-gray-900 shadow-lg'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16 items-center">
          <div className="flex items-center flex-1">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-primary'}`}>智学伴</h1>
              </div>
            </Link>

            {/* 桌面导航链接 */}
            <div className="hidden md:ml-6 md:flex md:space-x-4 lg:space-x-8">
              <button onClick={() => location.pathname !== '/dashboard' && navigate('/dashboard')} className={navLinkClass('/dashboard')}>
                首页
              </button>
              <button onClick={() => location.pathname !== '/agent' && navigate('/agent')} className={navLinkClass('/agent')}>
                智学助手
              </button>
              <button onClick={() => !['/study-plan', '/upload-file'].includes(location.pathname) && navigate('/study-plan')} className={navLinkClass('/study-plan')}>
                学习计划
              </button>
              <button onClick={() => !['/quiz', '/quiz-result'].includes(location.pathname) && navigate('/quiz')} className={navLinkClass('/quiz')}>
                AI测评
              </button>
              <button onClick={() => location.pathname !== '/learning-map' && navigate('/learning-map')} className={navLinkClass('/learning-map')}>
                知识图谱
              </button>
              {isAdmin && (
                <button onClick={() => !location.pathname.startsWith('/admin') && navigate('/admin/dashboard')} className={navLinkClass('/admin')}>
                  管理后台
                </button>
              )}
            </div>
          </div>

          {/* 桌面端用户信息与按钮 */}
          <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">
            <ThemeDropdown isDark={isDark} mode={mode} setMode={setMode} theme={theme} />
            <div className="text-right hidden lg:block">
              <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {userInfo?.name || userInfo?.nickname || userInfo?.email || '学习者'}
              </p>
              {userInfo?.email && (
                <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{userInfo.email}</p>
              )}
            </div>
            <button
              onClick={() => navigate('/change-password')}
              className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border text-xs sm:text-sm font-medium rounded-md focus:outline-none focus:ring-2 ${
                isDark
                  ? 'text-white bg-white/5 hover:bg-white/10 border-white/15 focus:ring-white/20'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200 focus:ring-slate-200'
              }`}
            >
              修改密码
            </button>
            <button
              onClick={handleLogout}
              className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border text-xs sm:text-sm font-medium rounded-md focus:outline-none focus:ring-2 ${
                isDark
                  ? 'text-white bg-red-600 hover:bg-red-700 border-red-500 focus:ring-red-400'
                  : 'text-white bg-red-600 hover:bg-red-700 border-red-600 focus:ring-red-500'
              }`}
            >
              退出
            </button>
          </div>

          {/* 移动端菜单按钮 */}
          <div className="flex sm:hidden items-center space-x-2">
            <ThemeDropdown isDark={isDark} mode={mode} setMode={setMode} theme={theme} />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg ${
                isDark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className={`sm:hidden border-t ${
            isDark ? 'border-white/10 bg-[#0f121b]' : 'border-slate-200 bg-white'
          }`}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/dashboard'
                    ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                    : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                首页
              </Link>
              <Link
                to="/agent"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/agent'
                    ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                    : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                智学助手
              </Link>
              <Link
                to="/study-plan"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/study-plan' || location.pathname === '/upload-file'
                    ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                    : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                学习计划
              </Link>
              <Link
                to="/quiz"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/quiz' || location.pathname === '/quiz-result'
                    ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                    : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                AI测评
              </Link>
              <Link
                to="/learning-map"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/learning-map'
                    ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                    : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                知识图谱
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-base font-medium ${
                    location.pathname.startsWith('/admin')
                      ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                      : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  管理后台
                </Link>
              )}
              <Link
                to="/change-password"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/change-password'
                    ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-primary'
                    : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                淇敼瀵嗙爜
              </Link>
              <div className="pt-2 border-t border-white/10">
                <div className="px-3 py-2">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {userInfo?.name || userInfo?.nickname || userInfo?.email || '学习者'}
                  </p>
                  {userInfo?.email && (
                    <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{userInfo.email}</p>
                  )}
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full mt-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700"
                >
                  退出登录
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
