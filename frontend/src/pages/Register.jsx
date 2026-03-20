import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

/**
 * 表单校验规则说明：
 * 
 * 邮箱校验：参考常见邮箱格式规范
 * - 支持字母、数字、下划线、减号、点
 * - 必须包含 @ 符号
 * - 域名部分必须包含至少一个点
 * - 顶级域名至少2个字母
 * 
 * 昵称校验：
 * - 支持：中文、英文、数字、下划线、减号
 * - 长度：2-20个字符
 * - 不能全是数字
 * 
 * 密码校验：
 * - 至少6位
 * - 必须包含：大写字母、小写字母、数字、特殊字符
 * - 不能包含空格
 */

// 邮箱校验正则（参考CSDN文章常见格式）
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 昵称校验：支持中文、英文、数字、下划线、减号
const NICKNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_-]{2,20}$/;

// 密码校验：至少6位，包含大小写字母、数字、特殊字符，无空格
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[^\s]{6,}$/;

// 密码强度正则表达式
// 强密码：8位及以上，包含大小写字母、数字、特殊字符四项
const STRONG_PASSWORD_REGEX = /^(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*\W).*$/;
// 中等密码：8位及以上，包含大小写字母、数字、特殊字符中的两项
const MEDIUM_PASSWORD_REGEX = /^(?=.{8,})(((?=.*[A-Z])(?=.*[a-z]))|((?=.*[A-Z])(?=.*[0-9]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[a-z])(?=.*\W))|((?=.*[0-9])(?=.*\W))|((?=.*[A-Z])(?=.*\W))).*/;
// 基本密码：8位及以上
const ENOUGH_PASSWORD_REGEX = /^(?=.{8,}).*/;

/**
 * 检测密码强度
 * @param {string} password 
 * @returns {{level: number, text: string, colorClass: string, bars: number[]}}
 * level: 0-3 分别对应 无/弱/中/强
 */
function checkPasswordStrength(password) {
  if (!password) {
    return { 
      level: 0, 
      text: '', 
      colorClass: '',
      bgClass: '',
      bars: []
    };
  }
  
  // 强密码：8位及以上，包含大小写字母、数字、特殊字符四项
  if (STRONG_PASSWORD_REGEX.test(password)) {
    return {
      level: 3,
      text: '强',
      colorClass: 'text-green-500',
      bgClass: 'bg-green-500',
      bars: [1, 2, 3]
    };
  }
  
  // 中等密码：8位及以上，包含两项
  if (MEDIUM_PASSWORD_REGEX.test(password)) {
    return {
      level: 2,
      text: '中',
      colorClass: 'text-yellow-500',
      bgClass: 'bg-yellow-500',
      bars: [1, 2]
    };
  }
  
  // 弱密码：8位及以上但只有一项
  if (ENOUGH_PASSWORD_REGEX.test(password)) {
    return {
      level: 1,
      text: '弱',
      colorClass: 'text-red-500',
      bgClass: 'bg-red-500',
      bars: [1]
    };
  }
  
  // 密码长度不足8位
  return {
    level: 0,
    text: '太短',
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-400',
    bars: []
  };
}

/**
 * 密码强度指示器组件 - 参考张鑫旭设计风格
 */
function PasswordStrengthMeter({ password, isDark }) {
  const strength = checkPasswordStrength(password);
  
  if (!password) {
    return null;
  }
  
  // 根据强度级别返回提示信息
  const getHint = () => {
    switch (strength.level) {
      case 3:
        return '密码强度很高，可以放心使用';
      case 2:
        return '密码强度中等，建议添加更多字符类型';
      case 1:
        return '密码强度较弱，建议使用大小写字母、数字和符号组合';
      default:
        return '密码长度不足，请至少输入8个字符';
    }
  };
  
  return (
    <div className="password-strength-meter mt-2">
      {/* 强度分段指示条 */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} min-w-[60px]`}>
          密码强度
        </span>
        <div className="flex gap-1 flex-1">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                strength.bars.includes(bar)
                  ? strength.bgClass
                  : isDark ? 'bg-slate-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium min-w-[32px] text-right ${strength.colorClass}`}>
          {strength.text}
        </span>
      </div>
      {/* 强度提示文字 */}
      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {getHint()}
      </p>
    </div>
  );
}

/**
 * 校验邮箱格式
 * @param {string} email 
 * @returns {string|null} 错误信息，null表示校验通过
 */
function validateEmail(email) {
  if (!email) {
    return '请输入邮箱地址';
  }
  
  // 基本格式检查
  if (!EMAIL_REGEX.test(email)) {
    return '邮箱格式不正确，请输入有效的邮箱地址';
  }
  
  // 检查邮箱长度
  if (email.length > 100) {
    return '邮箱地址过长';
  }
  
  // 检查是否包含连续的点
  if (/\.{2,}/.test(email)) {
    return '邮箱地址不能包含连续的点';
  }
  
  // 检查用户名部分是否以点开头或结尾
  const [username] = email.split('@');
  if (username.startsWith('.') || username.endsWith('.')) {
    return '邮箱用户名部分不能以点开头或结尾';
  }
  
  return null;
}

/**
 * 校验昵称格式
 * @param {string} name 
 * @returns {string|null} 错误信息，null表示校验通过
 */
function validateNickname(name) {
  if (!name) {
    return '请输入昵称';
  }
  
  // 长度检查（中文字符算1个字符）
  const length = name.length;
  if (length < 2) {
    return '昵称至少需要2个字符';
  }
  if (length > 20) {
    return '昵称不能超过20个字符';
  }
  
  // 格式检查
  if (!NICKNAME_REGEX.test(name)) {
    return '昵称只能包含中文、英文、数字、下划线和减号';
  }
  
  // 不能全是数字
  if (/^\d+$/.test(name)) {
    return '昵称不能全是数字';
  }
  
  // 不能全是符号
  if (/^[_-]+$/.test(name)) {
    return '昵称不能只包含符号';
  }
  
  return null;
}

/**
 * 校验密码格式
 * @param {string} password 
 * @returns {string|null} 错误信息，null表示校验通过
 */
function validatePassword(password) {
  if (!password) {
    return '请输入密码';
  }
  
  // 长度检查
  if (password.length < 6) {
    return '密码长度至少6位';
  }
  
  if (password.length > 50) {
    return '密码长度不能超过50位';
  }
  
  // 空格检查
  if (/\s/.test(password)) {
    return '密码不能包含空格';
  }
  
  // 复杂度检查
  const errors = [];
  
  if (!/[a-z]/.test(password)) {
    errors.push('小写字母');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('大写字母');
  }
  
  if (!/\d/.test(password)) {
    errors.push('数字');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('特殊字符（如：!@#$%^&*）');
  }
  
  if (errors.length > 0) {
    return `密码必须包含：${errors.join('、')}`;
  }
  
  return null;
}

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    name: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // 清除该字段的错误提示
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  /**
   * 验证单个字段
   */
  const validateField = (fieldName) => {
    let error = null;
    
    switch (fieldName) {
      case 'email':
        error = validateEmail(formData.email);
        break;
      case 'name':
        error = validateNickname(formData.name);
        break;
      case 'password':
        error = validatePassword(formData.password);
        break;
      default:
        break;
    }
    
    setErrors(prev => ({
      ...prev,
      [fieldName]: error || '',
    }));
    
    return error === null;
  };

  /**
   * 验证所有字段
   */
  const validateAllFields = () => {
    const emailValid = validateField('email');
    const nameValid = validateField('name');
    const passwordValid = validateField('password');
    
    return emailValid && nameValid && passwordValid;
  };

  /**
   * 处理输入框失去焦点事件
   */
  const handleBlur = (e) => {
    validateField(e.target.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // 前端校验
    if (!validateAllFields()) {
      return;
    }
    
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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景图片 */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/images/backgrounds/login-bg.jpg)',
        }}
      />
      {/* 背景遮罩层 */}
      <div className={`absolute inset-0 ${isDark ? 'bg-black/50' : 'bg-black/30'}`} />
      
      {/* 表单容器 */}
      <div className={`relative max-w-md w-full space-y-8 p-8 rounded-2xl shadow-2xl backdrop-blur-sm ${
        isDark 
          ? 'bg-slate-800/80 border border-slate-700/50' 
          : 'bg-white/90 border border-white/20'
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
            {/* 邮箱输入框 */}
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
                onBlur={handleBlur}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:z-10 sm:text-sm ${
                  errors.email
                    ? isDark
                      ? 'bg-slate-700 border-2 border-red-500 text-white placeholder-gray-400 focus:ring-red-500'
                      : 'border-2 border-red-500 placeholder-gray-500 text-gray-900 focus:ring-red-500'
                    : isDark
                      ? 'bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                      : 'border border-gray-300 placeholder-gray-500 text-gray-900 focus:ring-primary focus:border-primary'
                }`}
                placeholder="请输入邮箱"
              />
              {errors.email && (
                <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* 昵称输入框 */}
            <div>
              <label htmlFor="name" className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                昵称
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:z-10 sm:text-sm ${
                  errors.name
                    ? isDark
                      ? 'bg-slate-700 border-2 border-red-500 text-white placeholder-gray-400 focus:ring-red-500'
                      : 'border-2 border-red-500 placeholder-gray-500 text-gray-900 focus:ring-red-500'
                    : isDark
                      ? 'bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                      : 'border border-gray-300 placeholder-gray-500 text-gray-900 focus:ring-primary focus:border-primary'
                }`}
                placeholder="请输入昵称"
              />
              {errors.name && (
                <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {errors.name}
                </p>
              )}
            </div>

            {/* 密码输入框 */}
            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 pr-10 rounded-md focus:outline-none focus:ring-1 focus:z-10 sm:text-sm ${
                    errors.password
                      ? isDark
                        ? 'bg-slate-700 border-2 border-red-500 text-white placeholder-gray-400 focus:ring-red-500'
                        : 'border-2 border-red-500 placeholder-gray-500 text-gray-900 focus:ring-red-500'
                      : isDark
                        ? 'bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
                        : 'border border-gray-300 placeholder-gray-500 text-gray-900 focus:ring-primary focus:border-primary'
                  }`}
                  placeholder="至少6位，含大小写字母、数字和特殊字符"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 flex items-center pr-3 ${
                    isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
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
                <p className={`mt-1 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {errors.password}
                </p>
              )}
              
              {/* 密码强度指示器 - 分段式设计 */}
              <PasswordStrengthMeter password={formData.password} isDark={isDark} />
              
              {/* 密码要求提示 */}
              <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>密码要求：</p>
                <ul className="list-disc list-inside ml-1 space-y-0.5">
                  <li>长度至少8位（推荐）</li>
                  <li>至少包含大小写字母、数字、符号中的两种类型</li>
                  <li>不能包含空格</li>
                </ul>
              </div>
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

