import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { Motion } from '../components/ui/Motion';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

// 邮箱格式校验正则
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// 昵称格式：中文、英文、数字、下划线、减号
const NICKNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;

// 密码强度正则
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

function PasswordStrengthMeter({ password, isDark }) {
  const strength = checkPasswordStrength(password);
  if (!password) return null;

  const getHint = () => {
    switch (strength.level) {
      case 3: return '密码强度很高，可以放心使用';
      case 2: return '密码强度中等，建议添加更多字符类型';
      case 1: return '密码强度较弱，建议使用大小写字母、数字和符号组合';
      default: return '密码长度不足，请至少输入8个字符';
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 mb-1.5">
        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'} min-w-[60px]`}>密码强度</span>
        <div className="flex gap-1 flex-1">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                strength.bars.includes(bar) ? strength.bgClass : isDark ? 'bg-slate-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium min-w-[32px] text-right ${strength.colorClass}`}>
          {strength.text}
        </span>
      </div>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{getHint()}</p>
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
  if (name.length < 2) return '昵称至少需要2个字符';
  if (name.length > 20) return '昵称不能超过20个字符';
  if (!NICKNAME_REGEX.test(name)) return '昵称只能包含中文、英文、数字、下划线和减号';
  return null;
}

function validatePassword(password) {
  if (!password) return '请输入密码';
  if (password.length < 6) return '密码长度至少6位';
  if (password.length > 50) return '密码长度不能超过50位';
  if (/\s/.test(password)) return '密码不能包含空格';
  
  const errors = [];
  if (!/[a-z]/.test(password)) errors.push('小写字母');
  if (!/[A-Z]/.test(password)) errors.push('大写字母');
  if (!/\d/.test(password)) errors.push('数字');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('特殊字符');
  
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
    let error = null;
    switch (fieldName) {
      case 'email': error = validateEmail(formData.email); break;
      case 'name': error = validateNickname(formData.name); break;
      case 'password': error = validatePassword(formData.password); break;
      default: break;
    }
    setErrors(prev => ({ ...prev, [fieldName]: error || '' }));
    return error === null;
  };

  const validateAllFields = () => {
    return validateField('email') && validateField('name') && validateField('password');
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
        alert('注册成功！');
        navigate('/login');
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/25 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              注册账号
            </h2>
            <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              开启你的智能学习之旅
            </p>
          </Motion>

          {/* 表单 */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* 全局错误 */}
            {error && (
              <Motion animation="fade-in" duration={200}>
                <div className={`rounded-lg p-3 ${
                  isDark ? 'bg-red-900/30 border border-red-700/50' : 'bg-red-50 border border-red-200'
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

            {/* 邮箱 */}
            <Motion animation="fade-in-up" delay={200}>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  邮箱地址
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`
                    block w-full px-4 py-2.5 rounded-lg
                    ${errors.email
                      ? isDark
                        ? 'bg-slate-700/50 border-2 border-red-500 text-white placeholder-slate-400'
                        : 'bg-white border-2 border-red-500 text-gray-900 placeholder-gray-400'
                      : isDark
                        ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                    }
                    border transition-all duration-200
                    focus:outline-none focus:ring-2
                  `}
                  placeholder="请输入邮箱"
                />
                {errors.email && (
                  <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{errors.email}</p>
                )}
              </div>
            </Motion>

            {/* 昵称 */}
            <Motion animation="fade-in-up" delay={280}>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  昵称
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`
                    block w-full px-4 py-2.5 rounded-lg
                    ${errors.name
                      ? isDark
                        ? 'bg-slate-700/50 border-2 border-red-500 text-white placeholder-slate-400'
                        : 'bg-white border-2 border-red-500 text-gray-900 placeholder-gray-400'
                      : isDark
                        ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                    }
                    border transition-all duration-200
                    focus:outline-none focus:ring-2
                  `}
                  placeholder="2-20个字符，支持中英文、数字"
                />
                {errors.name && (
                  <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{errors.name}</p>
                )}
              </div>
            </Motion>

            {/* 密码 */}
            <Motion animation="fade-in-up" delay={360}>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  密码
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`
                      block w-full px-4 py-2.5 pr-12 rounded-lg
                      ${errors.password
                        ? isDark
                          ? 'bg-slate-700/50 border-2 border-red-500 text-white placeholder-slate-400'
                          : 'bg-white border-2 border-red-500 text-gray-900 placeholder-gray-400'
                        : isDark
                          ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                      }
                      border transition-all duration-200
                      focus:outline-none focus:ring-2
                    `}
                    placeholder="至少6位，含大小写字母、数字和特殊字符"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute inset-y-0 right-0 flex items-center pr-3 ${
                      isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'
                    }`}
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
                  <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{errors.password}</p>
                )}
                <PasswordStrengthMeter password={formData.password} isDark={isDark} />
              </div>
            </Motion>

            <Motion animation="fade-in-up" delay={440}>
              <Button type="submit" fullWidth loading={loading} size="lg">
                注册
              </Button>
            </Motion>
          </form>

          {/* 登录链接 */}
          <Motion animation="fade-in-up" delay={520} className="mt-6 text-center">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              已有账号？{' '}
              <Link 
                to="/login" 
                className={`font-medium transition-colors ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                立即登录
              </Link>
            </p>
          </Motion>

          {/* 装饰性元素 */}
          <div className="absolute -top-px left-8 right-8 h-px bg-blue-600/20" />
          <div className="absolute -bottom-px left-8 right-8 h-px bg-blue-600/10" />
        </Card>
      </Motion>

      {/* 底部版权 */}
      <Motion animation="fade-in" delay={600} className="absolute bottom-4 left-0 right-0 text-center">
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          智学伴 AI 学习助手 - 全国大学生计算机设计大赛作品
        </p>
      </Motion>
    </div>
  );
}

export default Register;