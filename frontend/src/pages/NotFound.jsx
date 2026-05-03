import { Link } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

export default function NotFound() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div className={`flex min-h-[60vh] items-center justify-center px-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
      <div className="text-center">
        <div className={`text-8xl font-bold ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>404</div>
        <h1 className="mt-4 text-2xl font-semibold">页面不存在</h1>
        <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          您访问的页面不存在或已被移除。
        </p>
        <Link
          to="/dashboard"
          className={`mt-6 inline-block rounded-xl px-6 py-3 text-sm font-medium transition ${
            isDark
              ? 'bg-white text-slate-900 hover:bg-slate-200'
              : 'bg-slate-900 text-white hover:bg-slate-700'
          }`}
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
