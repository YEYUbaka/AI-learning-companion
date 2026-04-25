/**
 * 管理后台布局组件
 * 目的：提供管理后台统一布局，并为移动端使用抽屉导航
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

const IconDashboard = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);

const IconModels = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
  </svg>
);

const IconPrompts = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h10M4 18h14" />
    <path d="M18 14l4 4m0-4l-4 4" />
  </svg>
);

const IconKnowledge = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
);

const IconQuestionBank = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 3H20v14H6.5A2.5 2.5 0 014 14.5v-9A2.5 2.5 0 016.5 3z" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
);

const IconLogs = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </svg>
);

const IconConfig = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

const IconMenu = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const IconClose = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const menuItems = [
    { path: '/admin/dashboard', label: '仪表盘', Icon: IconDashboard },
    { path: '/admin/users', label: '用户管理', Icon: IconUsers },
    { path: '/admin/models', label: '模型管理', Icon: IconModels },
    { path: '/admin/prompts', label: 'Prompt管理', Icon: IconPrompts },
    { path: '/admin/knowledge', label: '知识库', Icon: IconKnowledge },
    { path: '/admin/question-bank', label: '题库管理', Icon: IconQuestionBank },
    { path: '/admin/api-logs', label: 'API调用日志', Icon: IconLogs },
    { path: '/admin/config', label: '系统配置', Icon: IconConfig },
  ];

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userInfo');
    navigate('/login');
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
  const userName = userInfo.name || userInfo.nickname || 'Admin';

  const navItemClass = (path) =>
    `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition ${
      location.pathname === path
        ? isDark
          ? 'bg-white/10 text-white border border-white/15 shadow-[0_10px_30px_rgba(15,23,42,0.24)]'
          : 'bg-gray-100 text-gray-900 border border-gray-200 shadow-sm'
        : isDark
          ? 'text-white/70 hover:bg-white/5 hover:text-white'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  const sidebarShell = isDark
    ? 'bg-[#0f1527] border-r border-white/10'
    : 'bg-white border-r border-gray-200';

  return (
    <div className={`h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#05060a]' : 'bg-gray-50'}`}>
      <nav
        className={`h-16 border-b shadow-sm transition-colors duration-300 ${
          isDark ? 'bg-[#0f1527] border-white/10' : 'bg-white border-gray-200'
        }`}
      >
        <div className="h-full px-3 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors lg:hidden ${
                  isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
                aria-label="打开菜单"
              >
                <IconMenu />
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                className={`hidden items-center justify-center rounded-lg p-2 transition-colors lg:inline-flex ${
                  isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
                aria-label="切换侧边栏"
              >
                <IconMenu />
              </button>
              <button
                type="button"
                onClick={handleBackToMain}
                className="min-w-0 text-left"
              >
                <div className={`truncate text-lg font-semibold sm:text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  智学伴管理后台
                </div>
                <div className={`hidden text-xs sm:block ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
                  管理内容、模型与系统配置
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right sm:block">
                <div className={`max-w-[160px] truncate text-sm font-medium ${isDark ? 'text-white/90' : 'text-gray-700'}`}>
                  {userName}
                </div>
                <div className={`text-xs ${isDark ? 'text-white/45' : 'text-gray-500'}`}>管理员控制台</div>
              </div>
              <button
                type="button"
                onClick={handleBackToMain}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  isDark
                    ? 'border-white/15 text-white/80 hover:bg-white/10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="sm:hidden">返回</span>
                <span className="hidden sm:inline">返回前台</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">退出</span>
                <span className="hidden sm:inline">退出登录</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative flex h-[calc(100vh-4rem)]">
        <div
          className={`absolute inset-0 z-30 bg-slate-950/45 transition-opacity duration-300 lg:hidden ${
            mobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <aside
          className={`absolute inset-y-0 left-0 z-40 w-72 max-w-[85vw] transform shadow-2xl transition-transform duration-300 lg:hidden ${sidebarShell} ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`flex items-center justify-between border-b px-4 py-4 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <div>
              <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>导航菜单</div>
              <div className={`text-xs ${isDark ? 'text-white/45' : 'text-gray-500'}`}>移动端使用抽屉式导航</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className={`rounded-lg p-2 transition-colors ${isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              aria-label="关闭菜单"
            >
              <IconClose />
            </button>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {menuItems.map((item) => (
              <Link key={item.path} to={item.path} className={navItemClass(item.path)}>
                <span className="mr-3 flex-shrink-0">
                  <item.Icon />
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <aside
          className={`${sidebarOpen ? 'lg:w-64' : 'lg:w-0'} hidden overflow-hidden shadow-sm transition-all duration-300 lg:block ${sidebarShell}`}
        >
          <nav className="space-y-1 px-3 py-5">
            {menuItems.map((item) => (
              <Link key={item.path} to={item.path} className={navItemClass(item.path)}>
                <span className="mr-3 flex-shrink-0">
                  <item.Icon />
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className={`min-w-0 flex-1 overflow-hidden ${isDark ? 'bg-[#05060a] text-white' : 'bg-gray-50 text-gray-900'}`}>
          <div className="h-full overflow-y-auto overflow-x-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
