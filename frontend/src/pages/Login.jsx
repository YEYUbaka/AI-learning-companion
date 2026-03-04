import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 调用登录API
      const response = await api.post('/api/v1/auth/login-json', {
        email: email,
        password: password
      });

      // 保存token和用户信息到sessionStorage（遵循规范，不使用localStorage）
      sessionStorage.setItem('token', response.data.access_token);
      sessionStorage.setItem('userInfo', JSON.stringify(response.data.user));

      // 跳转到首页
      navigate('/dashboard');
    } catch (err) {
      // 处理不同类型的错误
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('请求超时，请检查网络连接或稍后重试');
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError('无法连接到服务器，请确保后端服务已启动（端口8000）');
      } else if (err.response) {
        // 服务器返回了错误响应
        setError(err.response?.data?.detail || '登录失败，请检查邮箱和密码');
      } else {
        // 其他错误
        setError('登录失败，请检查网络连接或稍后重试');
      }
      console.error('登录错误:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 ${
      isDark 
        ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      <div className={`max-w-md w-full space-y-8 p-8 rounded-lg shadow-xl ${
        isDark 
          ? 'bg-slate-800/90 border border-slate-700' 
          : 'bg-white'
      }`}>
        <div>
          <h2 className={`text-center text-3xl font-extrabold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            登录智学伴
          </h2>
          <p className={`mt-2 text-center text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            或 <Link 
              to="/register" 
              className={`font-medium ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              注册新账号
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                邮箱
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1 block w-full px-3 py-2 rounded-md ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                    : 'border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500'
                } focus:outline-none focus:ring-1`}
                placeholder="请输入邮箱"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                密码
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1 block w-full px-3 py-2 rounded-md ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                    : 'border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500'
                } focus:outline-none focus:ring-1`}
                placeholder="请输入密码"
              />
            </div>
          </div>
          {error && (
            <div className={`border rounded-md p-3 ${
              isDark
                ? 'bg-red-900/30 border-red-700'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm ${
                isDark ? 'text-red-200' : 'text-red-800'
              }`}>
                {error}
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

