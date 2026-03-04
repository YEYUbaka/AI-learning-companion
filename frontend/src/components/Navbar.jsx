import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useThemeStore } from '../store/themeStore';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === 'dark';
  const storedUser =
    sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
  let userInfo = {};
  try {
    userInfo = storedUser ? JSON.parse(storedUser) : {};
  } catch {
    userInfo = {};
  }
  const isAdmin =
    userInfo?.role === 'admin' || userInfo?.email?.toLowerCase().startsWith('admin');

  // 如果在登录或注册页面，不显示导航栏
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const handleLogout = () => {
    // 清除所有存储的认证信息
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
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
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                首页
              </Link>
              <Link to="/ai" className={navLinkClass('/ai')}>
                AI助手
              </Link>
              <Link
                to="/study-plan"
                className={navLinkClass('/study-plan')}
              >
                学习计划
              </Link>
              <Link to="/quiz" className={navLinkClass('/quiz')}>
                AI测评
              </Link>
              <Link
                to="/learning-map"
                className={navLinkClass('/learning-map')}
              >
                知识图谱
              </Link>
              {isAdmin && (
                <Link to="/admin/dashboard" className={navLinkClass('/admin')}>
                  管理后台
                </Link>
              )}
            </div>
          </div>

          {/* 桌面端用户信息与退出按钮 */}
          <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">
            <button
              onClick={toggleTheme}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium border transition ${
                isDark
                  ? 'bg-white/5 text-white border-white/15 hover:bg-white/10'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {isDark ? '日间' : '夜间'}
            </button>
            <div className="text-right hidden lg:block">
              <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {userInfo?.name || userInfo?.nickname || userInfo?.email || '学习者'}
              </p>
              {userInfo?.email && (
                <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{userInfo.email}</p>
              )}
            </div>
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
            <button
              onClick={toggleTheme}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium border ${
                isDark
                  ? 'bg-white/5 text-white border-white/15'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              {isDark ? '日间' : '夜间'}
            </button>
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
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-blue-50 text-primary'
                    : isDark
                    ? 'text-white/70 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                首页
              </Link>
              <Link
                to="/ai"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/ai'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-blue-50 text-primary'
                    : isDark
                    ? 'text-white/70 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                AI助手
              </Link>
              <Link
                to="/study-plan"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/study-plan' || location.pathname === '/upload-file'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-blue-50 text-primary'
                    : isDark
                    ? 'text-white/70 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                学习计划
              </Link>
              <Link
                to="/quiz"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/quiz' || location.pathname === '/quiz-result'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-blue-50 text-primary'
                    : isDark
                    ? 'text-white/70 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                AI测评
              </Link>
              <Link
                to="/learning-map"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  location.pathname === '/learning-map'
                    ? isDark
                      ? 'bg-white/10 text-white'
                      : 'bg-blue-50 text-primary'
                    : isDark
                    ? 'text-white/70 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
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
                      ? isDark
                        ? 'bg-white/10 text-white'
                        : 'bg-blue-50 text-primary'
                      : isDark
                      ? 'text-white/70 hover:bg-white/5'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  管理后台
                </Link>
              )}
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
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full mt-2 px-3 py-2 text-sm font-medium rounded-lg ${
                    isDark
                      ? 'text-white bg-red-600 hover:bg-red-700'
                      : 'text-white bg-red-600 hover:bg-red-700'
                  }`}
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

