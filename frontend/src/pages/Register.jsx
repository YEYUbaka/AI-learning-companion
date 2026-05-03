import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { Motion } from '../components/ui/Motion';
import { Button } from '../components/ui/Button';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NICKNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;

const STRONG_PASSWORD_REGEX = /^(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*\W).*$/;
const MEDIUM_PASSWORD_REGEX = /^(?=.{8,})(((?=.*[A-Z])(?=.*[a-z]))|((?=.*[A-Z])(?=.*[0-9]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[a-z])(?=.*\W))|((?=.*[0-9])(?=.*\W))|((?=.*[A-Z])(?=.*\W))).*/;
const ENOUGH_PASSWORD_REGEX = /^(?=.{8,}).*/;

function checkPasswordStrength(password) {
  if (!password) return { level: 0, text: '', colorClass: '', bgClass: '', bars: [] };

  if (STRONG_PASSWORD_REGEX.test(password)) {
    return { level: 3, text: '强', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500', bars: [1, 2, 3] };
  }
  if (MEDIUM_PASSWORD_REGEX.test(password)) {
    return { level: 2, text: '中', colorClass: 'text-amber-500', bgClass: 'bg-amber-500', bars: [1, 2] };
  }
  if (ENOUGH_PASSWORD_REGEX.test(password)) {
    return { level: 1, text: '弱', colorClass: 'text-red-500', bgClass: 'bg-red-500', bars: [1] };
  }
  return { level: 0, text: '太短', colorClass: 'text-gray-400', bgClass: 'bg-gray-400', bars: [] };
}

function PasswordStrengthMeter({ password }) {
  const strength = checkPasswordStrength(password);

  if (!password) return null;

  const getHint = () => {
    switch (strength.level) {
      case 3:
        return '密码强度很高，可以放心使用';
      case 2:
        return '密码强度中等，建议再增加字符类型';
      case 1:
        return '密码强度较弱，建议混合使用大小写字母、数字和符号';
      default:
        return '密码长度不足，请至少输入 8 个字符';
    }
  };

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="min-w-[60px] text-xs text-gray-500">密码强度</span>
        <div className="flex flex-1 gap-1">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                strength.bars.includes(bar) ? strength.bgClass : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className={`min-w-[32px] text-right text-xs font-medium ${strength.colorClass}`}>
          {strength.text}
        </span>
      </div>
      <p className="text-xs text-gray-500">{getHint()}</p>
    </div>
  );
}

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

function validatePassword(password) {
  if (!password) return '请输入密码';
  if (password.length < 6) return '密码长度至少 6 位';
  if (password.length > 50) return '密码长度不能超过 50 位';
  if (/\s/.test(password)) return '密码不能包含空格';

  const errors = [];
  if (!/[a-z]/.test(password)) errors.push('小写字母');
  if (!/[A-Z]/.test(password)) errors.push('大写字母');
  if (!/\d/.test(password)) errors.push('数字');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) errors.push('特殊字符');

  if (errors.length > 0) return `密码必须包含：${errors.join('、')}`;
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
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
        fieldError = validatePassword(formData.password);
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

  const handleBlur = (e) => {
    validateField(e.target.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateAllFields()) return;

    setLoading(true);

    try {
      const response = await api.post('/api/v1/auth/register', formData);

      if (response.data) {
        navigate('/login', { state: { registered: true } });
      }
    } catch (err) {
      if (err.response?.data) {
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
    <div className={`relative flex min-h-screen overflow-hidden ${isDark ? 'bg-[#0b1120]' : 'bg-[#f0f5ff]'}`}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/backgrounds/login-bg.jpg')" }}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 ${
          isDark ? 'bg-slate-950/68 backdrop-blur-[2px]' : 'bg-white/62 backdrop-blur-[2px]'
        }`}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40" aria-hidden="true">
        <div className={`absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl animate-[floatSlow_8s_ease-in-out_infinite] ${isDark ? 'bg-blue-600/10' : 'bg-blue-500/8'}`} />
        <div className={`absolute top-1/3 -right-40 h-80 w-80 rounded-full blur-3xl animate-[floatMedium_10s_ease-in-out_infinite] ${isDark ? 'bg-purple-600/10' : 'bg-purple-500/8'}`} />
        <div className={`absolute bottom-20 left-1/4 h-64 w-64 rounded-full blur-3xl animate-[floatSlow_12s_ease-in-out_infinite_reverse] ${isDark ? 'bg-emerald-600/8' : 'bg-emerald-500/5'}`} />
      </div>

      <div className="relative hidden items-center justify-center p-12 lg:flex lg:w-1/2">
        <div className="relative z-10 max-w-lg">
          <img
            src="/images/illustrations/login-hero.svg"
            alt="智学伴 AI 学习平台"
            className="h-auto w-full animate-[floatSlow_6s_ease-in-out_infinite] drop-shadow-2xl"
          />
          <div className="mt-8 text-center">
            <h1 className={`mb-3 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
          <div className="relative w-full max-w-md overflow-hidden rounded-none border border-slate-200 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.18)] ring-1 ring-white/70">
            <div className="pointer-events-none absolute inset-0 bg-white/90 backdrop-blur-xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_55%,#f3f7fd_100%)]" />
            <div className="pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full bg-blue-100 blur-2xl" />

            <div className="relative z-10">
              <div className="mb-8 text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  注册账号
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  开启你的智能学习之旅
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <Motion animation="fade-in" duration={200}>
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="flex items-center gap-2 text-sm text-red-700">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                      </p>
                    </div>
                  </Motion>
                )}

                <Motion animation="fade-in-up" delay={200}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      邮箱地址
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`block w-full rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:bg-white focus:outline-none ${
                        errors.email
                          ? 'border-2 border-red-500 bg-white'
                          : 'border border-slate-200 bg-slate-50 focus:border-slate-200'
                      }`}
                      placeholder="请输入邮箱"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
                </Motion>

                <Motion animation="fade-in-up" delay={280}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      昵称
                    </label>
                    <input
                      name="name"
                      type="text"
                      required
                      autoComplete="nickname"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`block w-full rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:bg-white focus:outline-none ${
                        errors.name
                          ? 'border-2 border-red-500 bg-white'
                          : 'border border-slate-200 bg-slate-50 focus:border-slate-200'
                      }`}
                      placeholder="2-20个字符，支持中英文、数字"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>
                </Motion>

                <Motion animation="fade-in-up" delay={360}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      密码
                    </label>
                    <div className="relative">
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`block w-full rounded-xl px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:bg-white focus:outline-none ${
                          errors.password
                            ? 'border-2 border-red-500 bg-white'
                            : 'border border-slate-200 bg-slate-50 focus:border-slate-200'
                        }`}
                        placeholder="至少6位，含大小写字母、数字和特殊字符"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 transition-colors hover:text-gray-700"
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
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                    )}
                    <PasswordStrengthMeter password={formData.password} />
                  </div>
                </Motion>

                <Motion animation="fade-in-up" delay={440}>
                  <Button type="submit" fullWidth loading={loading} size="lg" className="rounded-xl">
                    注册
                  </Button>
                </Motion>
              </form>

              <Motion animation="fade-in-up" delay={520} className="mt-6 text-center">
                <p className="text-sm text-slate-600">
                  已有账号？{' '}
                  <Link
                    to="/login"
                    className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    立即登录
                  </Link>
                </p>
              </Motion>
            </div>

            <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent" />
            <div className="pointer-events-none absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-200/80 to-transparent" />
          </div>
        </Motion>

        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            智学伴 AI 学习助手
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
