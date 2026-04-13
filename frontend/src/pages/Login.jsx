import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { Motion } from '../components/ui/Motion';
import { Button } from '../components/ui/Button';
import { setAuthSession } from '../utils/auth';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const authBackgroundStyle = {
    backgroundImage: "url('/images/backgrounds/login-bg.jpg')",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/v1/auth/login-json', {
        email,
        password,
      });

      setAuthSession(response.data.access_token, response.data.user);

      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('请求超时，请检查网络连接或稍后重试');
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError('无法连接到服务器，请确认后端服务已启动（端口 8000）');
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
    <div className={`min-h-screen flex relative overflow-hidden ${isDark ? 'bg-[#0b1120]' : 'bg-[#f0f5ff]'}`}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={authBackgroundStyle}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 ${
          isDark ? 'bg-slate-950/68 backdrop-blur-[2px]' : 'bg-white/62 backdrop-blur-[2px]'
        }`}
        aria-hidden="true"
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40" aria-hidden="true">
        <div className={`absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl animate-[floatSlow_8s_ease-in-out_infinite] ${isDark ? 'bg-blue-600/10' : 'bg-blue-500/8'}`} />
        <div className={`absolute top-1/3 -right-40 h-80 w-80 rounded-full blur-3xl animate-[floatMedium_10s_ease-in-out_infinite] ${isDark ? 'bg-purple-600/10' : 'bg-purple-500/8'}`} />
        <div className={`absolute bottom-20 left-1/4 h-64 w-64 rounded-full blur-3xl animate-[floatSlow_12s_ease-in-out_infinite_reverse] ${isDark ? 'bg-emerald-600/8' : 'bg-emerald-500/5'}`} />
        <div className={`absolute inset-0 ${isDark ? 'text-white' : 'text-slate-400'} bg-dots opacity-20`} />
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="relative z-10 max-w-lg">
          <img
            src="/images/illustrations/login-hero.svg"
            alt="智学伴 AI 学习平台"
            className="h-auto w-full drop-shadow-2xl animate-[floatSlow_6s_ease-in-out_infinite]"
          />
          <div className="mt-8 text-center">
            <h1 className={`mb-3 text-3xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
              智学伴
            </h1>
            <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              AI 驱动的个性化学习平台
            </p>
            <div className="mt-6 flex items-center justify-center gap-6">
              <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm">智能学习计划</span>
              </div>
              <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-sm">智能组卷</span>
              </div>
              <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="text-sm">知识图谱</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-8">
        <Motion animation="fade-in-up" duration={560}>
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.18)] ring-1 ring-white/70">
            <div className="pointer-events-none absolute inset-0 bg-white" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_55%,#f3f7fd_100%)]" />
            <div className="pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full bg-blue-100 blur-2xl" />
            <div className="relative z-10">
              <div className="mb-8 text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold font-heading tracking-tight text-slate-900">
                  登录智学伴
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  开启你的智能学习之旅
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      邮箱
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/12"
                      placeholder="请输入邮箱"
                    />
                  </div>
                </div>

                <div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      密码
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/12"
                      placeholder="请输入密码"
                    />
                  </div>
                </div>

                {error && (
                  <div>
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="flex items-center gap-2 text-sm text-red-700">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    size="lg"
                  >
                    登录
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-600">
                  还没有账号？{' '}
                  <Link
                    to="/register"
                    className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    立即注册
                  </Link>
                </p>
              </div>
            </div>

            <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent" />
            <div className="pointer-events-none absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-200/80 to-transparent" />
          </div>
        </Motion>

        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            智学伴AI个性化学习平台
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
