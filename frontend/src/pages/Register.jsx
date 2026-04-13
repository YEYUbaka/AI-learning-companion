import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../api/apiClient';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { Button } from '../components/ui/Button';
import { Motion } from '../components/ui/Motion';
import { useThemeStore } from '../store/themeStore';
import { validatePasswordForSubmission } from '../utils/passwordPolicy';


const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NICKNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;


function validateEmail(email) {
  if (!email) return '请输入邮箱地址';
  if (!EMAIL_REGEX.test(email)) return '邮箱格式不正确';
  return null;
}


function validateNickname(name) {
  if (!name) return '请输入昵称';
  if (name.length < 2) return '昵称至少需要 2 个字符';
  if (name.length > 20) return '昵称不能超过 20 个字符';
  if (!NICKNAME_REGEX.test(name)) return '昵称只能包含中文、英文、数字、下划线和减号';
  return null;
}


function Register() {
  const [formData, setFormData] = useState({ email: '', name: '', password: '' });
  const [errors, setErrors] = useState({ email: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateField = (fieldName) => {
    let fieldError = null;

    switch (fieldName) {
      case 'email':
        fieldError = validateEmail(formData.email);
        break;
      case 'name':
        fieldError = validateNickname(formData.name);
        break;
      case 'password':
        fieldError = validatePasswordForSubmission(formData.password);
        break;
      default:
        break;
    }

    setErrors((prev) => ({ ...prev, [fieldName]: fieldError || '' }));
    return fieldError === null;
  };

  const validateAllFields = () => {
    const emailValid = validateField('email');
    const nameValid = validateField('name');
    const passwordValid = validateField('password');
    return emailValid && nameValid && passwordValid;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!validateAllFields()) return;

    setLoading(true);

    try {
      await api.post('/api/v1/auth/register', formData);
      alert('注册成功');
      navigate('/login');
    } catch (err) {
      if (err.response?.data) {
        setError(err.response.data.detail || '注册失败，请重试');
      } else if (err.message) {
        setError(`错误：${err.message}`);
      } else {
        setError('网络错误，请检查后端服务是否已启动');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/backgrounds/login-bg.jpg')" }}
      />
      <div
        className={`absolute inset-0 ${
          isDark ? 'bg-slate-900/70 backdrop-blur-sm' : 'bg-white/60 backdrop-blur-sm'
        }`}
      />

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
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">注册账号</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">创建你的智学伴账户</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-red-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">邮箱地址</label>
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => validateField('email')}
                  className={`block w-full rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.email
                      ? 'border border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/10'
                      : 'border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-blue-500/12'
                  }`}
                  placeholder="请输入邮箱"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">昵称</label>
                <input
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={() => validateField('name')}
                  className={`block w-full rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.name
                      ? 'border border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/10'
                      : 'border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-blue-500/12'
                  }`}
                  placeholder="2-20 个字符，支持中文、英文、数字"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">密码</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => validateField('password')}
                    className={`block w-full rounded-xl px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 ${
                      errors.password
                        ? 'border border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/10'
                        : 'border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-blue-500/12'
                    }`}
                    placeholder="6-50 位，不能包含空格"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 transition-colors hover:text-slate-700"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                <PasswordStrengthMeter password={formData.password} />
              </div>

              <Button type="submit" fullWidth loading={loading} size="lg">
                注册
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                已有账户？{' '}
                <Link to="/login" className="font-medium text-blue-600 transition-colors hover:text-blue-700">
                  立即登录
                </Link>
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent" />
          <div className="pointer-events-none absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-200/80 to-transparent" />
        </div>
      </Motion>

      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>智学伴 AI 个性化学习平台</p>
      </div>
    </div>
  );
}


export default Register;
