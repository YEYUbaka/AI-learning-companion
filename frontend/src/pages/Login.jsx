import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { Motion } from '../components/ui/Motion';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

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
      const response = await api.post('/api/v1/auth/login-json', {
        email: email,
        password: password
      });

      sessionStorage.setItem('token', response.data.access_token);
      sessionStorage.setItem('userInfo', JSON.stringify(response.data.user));

      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('请求超时，请检查网络连接或稍后重试');
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError('无法连接到服务器，请确保后端服务已启动（端口8000）');
      } else if (err.response) {
        setError(err.response?.data?.detail || '登录失败，请检查邮箱和密码');
      } else {
        setError('登录失败，请检查网络连接或稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景图片 */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/images/backgrounds/login-bg.jpg')`,
        }}
      />
      {/* 遮罩层 */}
      <div 
        className={`absolute inset-0 ${
          isDark 
            ? 'bg-slate-900/70 backdrop-blur-sm' 
            : 'bg-white/60 backdrop-blur-sm'
        }`}
      />

      {/* 表单容器 */}
      <Motion animation="fade-in-up" duration={500}>
        <Card 
          variant="elevated" 
          className={`relative max-w-md w-full p-8 ${
            isDark 
              ? 'bg-slate-800/90 backdrop-blur-xl border-slate-700/50' 
              : 'bg-white/90 backdrop-blur-xl border-white/20'
          }`}
          hover={false}
        >
          {/* Logo 区域 */}
          <Motion animation="fade-in-down" delay={100} className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              登录智学伴
            </h2>
            <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              开启你的智能学习之旅
            </p>
          </Motion>

          {/* 表单 */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Motion animation="fade-in-up" delay={200}>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  邮箱
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`
                    block w-full px-4 py-2.5 rounded-lg
                    ${isDark
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                    }
                    border transition-all duration-200
                    focus:outline-none focus:ring-2
                  `}
                  placeholder="请输入邮箱"
                />
              </div>
            </Motion>

            <Motion animation="fade-in-up" delay={280}>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  密码
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`
                    block w-full px-4 py-2.5 rounded-lg
                    ${isDark
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                    }
                    border transition-all duration-200
                    focus:outline-none focus:ring-2
                  `}
                  placeholder="请输入密码"
                />
              </div>
            </Motion>

            {/* 错误提示 */}
            {error && (
              <Motion animation="fade-in" duration={200}>
                <div className={`rounded-lg p-3 ${
                  isDark
                    ? 'bg-red-900/30 border border-red-700/50'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm flex items-center gap-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              </Motion>
            )}

            <Motion animation="fade-in-up" delay={360}>
              <Button
                type="submit"
                fullWidth
                loading={loading}
                size="lg"
              >
                登录
              </Button>
            </Motion>
          </form>

          {/* 注册链接 */}
          <Motion animation="fade-in-up" delay={440} className="mt-6 text-center">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              还没有账号？{' '}
              <Link 
                to="/register" 
                className={`font-medium transition-colors ${
                  isDark 
                    ? 'text-blue-400 hover:text-blue-300' 
                    : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                立即注册
              </Link>
            </p>
          </Motion>

          {/* 装饰性元素 */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        </Card>
      </Motion>

      {/* 底部版权 */}
      <Motion animation="fade-in" delay={500} className="absolute bottom-4 left-0 right-0 text-center">
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          智学伴 AI 学习助手 - 全国大学生计算机设计大赛作品
        </p>
      </Motion>
    </div>
  );
}

export default Login;
