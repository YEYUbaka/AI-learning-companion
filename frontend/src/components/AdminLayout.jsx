/**
 * 管理后台布局组件
 * 作者：智学伴开发团队
 * 目的：提供管理后台的统一布局（侧边栏+顶部栏）
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const menuItems = [
    { path: '/admin/dashboard', label: '仪表盘', icon: '📊' },
    { path: '/admin/users', label: '用户管理', icon: '👥' },
    { path: '/admin/models', label: '模型管理', icon: '🤖' },
    { path: '/admin/prompts', label: 'Prompt管理', icon: '📝' },
    { path: '/admin/api-logs', label: 'API调用日志', icon: '📋' },
    { path: '/admin/config', label: '系统配置', icon: '⚙️' },
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
                <span className="text-2xl">☰</span>
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
                <span className="mr-3 text-lg">{item.icon}</span>
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

