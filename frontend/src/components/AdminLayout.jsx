/**
 * 管理后台布局组件
 * 作者：智学伴开发团队
 * 目的：提供管理后台的统一布局（侧边栏+顶部栏）
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

const IconDashboard = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IconModels = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
  </svg>
);

const IconPrompts = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconKnowledge = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IconLogs = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IconConfig = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
                      ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-400/40'
                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                    : isDark
                    ? 'text-white/70 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
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

