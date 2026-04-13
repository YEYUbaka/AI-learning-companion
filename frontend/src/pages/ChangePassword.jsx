import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { changePassword } from '../api/apiClient';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { Button } from '../components/ui/Button';
import { Motion } from '../components/ui/Motion';
import { useThemeStore } from '../store/themeStore';
import { setAuthSession } from '../utils/auth';
import { validatePasswordForSubmission } from '../utils/passwordPolicy';


function ChangePassword() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.currentPassword) return '请输入当前密码';
    const nextPasswordError = validatePasswordForSubmission(formData.newPassword);
    if (nextPasswordError) return nextPasswordError;
    if (formData.newPassword === formData.currentPassword) return '新密码不能与当前密码相同';
    if (formData.newPassword !== formData.confirmPassword) return '两次输入的新密码不一致';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await changePassword(formData.currentPassword, formData.newPassword);
      setAuthSession(response.data.access_token, response.data.user);
      setSuccess('密码修改成功，请使用新密码继续访问。');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      setError(err.response?.data?.detail || '密码修改失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-[calc(100vh-4rem)] px-4 py-8 ${isDark ? 'bg-[#05060a]' : 'bg-gray-50'}`}>
      <div className="mx-auto max-w-2xl">
        <Motion animation="fade-in-up" duration={420}>
          <div className={`rounded-3xl border p-8 shadow-sm ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
            <div className="mb-8">
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>修改密码</h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                密码只校验合法性，页面会持续提示当前强度。
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white/80' : 'text-slate-700'}`}>当前密码</label>
                <input
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className={`block w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-4 ${
                    isDark
                      ? 'border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-cyan-400 focus:ring-cyan-500/10'
                      : 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-blue-500/10'
                  }`}
                  placeholder="请输入当前密码"
                />
              </div>

              <div>
                <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white/80' : 'text-slate-700'}`}>新密码</label>
                <input
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={`block w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-4 ${
                    isDark
                      ? 'border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-cyan-400 focus:ring-cyan-500/10'
                      : 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-blue-500/10'
                  }`}
                  placeholder="6-50 位，不能包含空格"
                />
                <PasswordStrengthMeter password={formData.newPassword} />
              </div>

              <div>
                <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white/80' : 'text-slate-700'}`}>确认新密码</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`block w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-4 ${
                    isDark
                      ? 'border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-cyan-400 focus:ring-cyan-500/10'
                      : 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-blue-500/10'
                  }`}
                  placeholder="再次输入新密码"
                />
              </div>

              {error && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  {error}
                </div>
              )}

              {success && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {success}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" loading={loading} size="lg">
                  保存新密码
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  返回首页
                </button>
              </div>
            </form>
          </div>
        </Motion>
      </div>
    </div>
  );
}


export default ChangePassword;
