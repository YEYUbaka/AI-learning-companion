/**
 * 管理后台布局组件
 * 作者：智学伴开发团队
 * 目的：提供管理后台的统一布局（侧边栏+顶部栏）
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

// 仪表盘 - 简洁网格图标
const IconDashboard = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

// 用户管理 - 简洁人物图标
const IconUsers = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);

// 模型管理 - 简洁芯片图标
const IconModels = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
  </svg>
);

// Prompt管理 - 简洁文本图标
const IconPrompts = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h10M4 18h14" />
    <path d="M18 14l4 4m0-4l-4 4" />
  </svg>
);

// 知识库 - 简洁数据库图标
const IconKnowledge = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
);

// API日志 - 简洁列表图标
const IconLogs = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </svg>
);

// 系统配置 - 简洁齿轮图标
const IconConfig = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

// 菜单按钮
const IconMenu = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const menuItems = [
    { path: '/admin/dashboard', label: '仪表盘', Icon: IconDashboard },
    { path: '/admin/users', label: '用户管理', Icon: IconUsers },
    { path: '/admin/models', label: '模型管理', Icon: IconModels },
    { path: '/admin/prompts', label: 'Prompt管理', Icon: IconPrompts },
    { path: '/admin/knowledge', label: '知识库', Icon: IconKnowledge },
    { path: '/admin/api-logs', label: 'API调用日志', Icon: IconLogs },
    { path: '/admin/config', label: '系统配置', Icon: IconConfig },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userInfo');
    navigate('/login');
  };

  const handleBackToMain = () => {
    // 返回前台首页，但保留当前登录态
    navigate('/');
  };

  const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');

  return (
    <div className={`h-screen overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#05060a]' : 'bg-gray-50'
    }`}>
      {/* 顶部导航栏 */}
      <nav className={`shadow-sm border-b transition-colors duration-300 ${
        isDark ? 'bg-[#0f1527] border-white/10' : 'bg-white border-gray-200'
      }`}>
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-2 rounded-md transition-colors ${
                  isDark
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100'
                }`}
              >
                <IconMenu />
              </button>
              <button
                type="button"
                onClick={handleBackToMain}
                className={`ml-4 text-xl font-semibold transition-colors ${
                  isDark 
                    ? 'text-white hover:text-cyan-400' 
                    : 'text-gray-800 hover:text-blue-600'
                }`}
              >
                智学伴管理后台
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={handleBackToMain}
                className={`px-3 py-1.5 text-xs sm:text-sm border rounded-lg transition-colors ${
                  isDark
                    ? 'border-white/20 text-white/80 hover:bg-white/10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                返回前台
              </button>
              <span className={`text-sm ${
                isDark ? 'text-white/80' : 'text-gray-600'
              }`}>
                {userInfo.name || '管理员'}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* 侧边栏 */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } shadow-sm transition-all duration-300 overflow-hidden ${
            isDark ? 'bg-[#0f1527] border-r border-white/10' : 'bg-white border-r border-gray-200'
          }`}
        >
          <nav className="mt-5 px-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg mb-1 transition ${
                  location.pathname === item.path
                    ? isDark
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-gray-100 text-gray-900 border border-gray-200'
                    : isDark
                    ? 'text-white/60 hover:bg-white/5 hover:text-white/80'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="mr-3 flex-shrink-0"><item.Icon /></span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className={`flex-1 overflow-hidden ${isDark ? 'bg-[#05060a] text-white' : 'bg-gray-50 text-gray-900'}`}>
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

