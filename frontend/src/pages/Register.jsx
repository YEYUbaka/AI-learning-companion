import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 调用后端注册接口
      const response = await api.post('/api/v1/auth/register', formData);
      
      if (response.data) {
        alert('注册成功！');
        navigate('/login');
      }
    } catch (err) {
      console.error('Registration error:', err);
      console.error('Error details:', err.response?.data || err.message);
      if (err.response && err.response.data) {
        setError(err.response.data.detail || '注册失败，请重试');
      } else if (err.message) {
        setError(`错误：${err.message}`);
      } else {
        setError('网络错误，请检查后端服务是否启动');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${
      isDark 
        ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
        : 'bg-gradient-to-br from-purple-50 to-pink-100'
    }`}>
      <div className={`max-w-md w-full space-y-8 p-8 rounded-lg shadow-xl ${
        isDark 
          ? 'bg-slate-800/90 border border-slate-700' 
          : 'bg-white'
      }`}>
        <div>
          <h2 className={`mt-6 text-center text-3xl font-extrabold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            注册账号
          </h2>
          <p className={`mt-2 text-center text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            已有账号？{' '}
            <Link
              to="/login"
              className={`font-medium ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-secondary'
              }`}
            >
              立即登录
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className={`rounded-md p-4 ${
              isDark
                ? 'bg-red-900/30 border border-red-700'
                : 'bg-red-50'
            }`}>
              <p className={`text-sm ${
                isDark ? 'text-red-200' : 'text-red-800'
              }`}>
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                邮箱地址
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:z-10 sm:text-sm ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                    : 'border border-gray-300 placeholder-gray-500 text-gray-900 focus:ring-primary focus:border-primary'
                }`}
                placeholder="请输入邮箱"
              />
            </div>

            <div>
              <label htmlFor="name" className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                姓名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:z-10 sm:text-sm ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                    : 'border border-gray-300 placeholder-gray-500 text-gray-900 focus:ring-primary focus:border-primary'
                }`}
                placeholder="请输入姓名"
              />
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:z-10 sm:text-sm ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                    : 'border border-gray-300 placeholder-gray-500 text-gray-900 focus:ring-primary focus:border-primary'
                }`}
                placeholder="请输入密码（至少6位）"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;

