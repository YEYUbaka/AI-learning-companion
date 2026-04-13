import { useEffect, useMemo, useState } from 'react';

import { adminResetUserPassword, getUsers, updateUserRole } from '../../api/apiClient';
import AdminLayout from '../../components/AdminLayout';
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter';
import { useThemeStore } from '../../store/themeStore';
import logger from '../../utils/logger';
import { validatePasswordForSubmission } from '../../utils/passwordPolicy';

const INITIAL_MODAL_STATE = {
  open: false,
  user: null,
  newPassword: '',
  submitting: false,
  error: '',
  success: '',
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [resetModal, setResetModal] = useState(INITIAL_MODAL_STATE);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            card: 'bg-[#101629] border border-white/10 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] p-6 text-white',
            label: 'text-white/60',
            table: 'bg-[#0f1527] border-white/10',
            tableHeader: 'bg-[#0a0f1f] text-white/80',
            tableRow: 'border-white/10 hover:bg-white/5',
            button: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40',
            buttonActive: 'bg-cyan-500 text-white border-cyan-500',
            secondaryButton: 'bg-white/5 hover:bg-white/10 text-white border border-white/10',
            modal: 'bg-[#0b1020] border-white/10 text-white shadow-[0_20px_70px_rgba(0,0,0,0.55)]',
            input: 'bg-[#060a16] border-white/15 text-white placeholder:text-white/30 focus:border-cyan-400',
          }
        : {
            heading: 'text-gray-800',
            card: 'bg-white rounded-xl shadow-sm p-6 border border-gray-100',
            label: 'text-gray-600',
            table: 'bg-white border-gray-200',
            tableHeader: 'bg-gray-50 text-gray-700',
            tableRow: 'border-gray-200 hover:bg-gray-50',
            button: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200',
            buttonActive: 'bg-blue-600 text-white border-blue-600',
            secondaryButton: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
            modal: 'bg-white border-slate-200 text-slate-900 shadow-2xl',
            input: 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500',
          },
    [isDark]
  );

  const totalPages = Math.ceil(total / pageSize);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers((page - 1) * pageSize, pageSize);
      setUsers(response.data.users || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      logger.error('获取用户列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      await fetchUsers();
    } catch (error) {
      logger.error('更新用户角色失败', error);
      alert('更新失败，请稍后重试');
    }
  };

  const openResetModal = (user) => {
    setResetModal({
      open: true,
      user,
      newPassword: '',
      submitting: false,
      error: '',
      success: '',
    });
  };

  const closeResetModal = () => {
    if (resetModal.submitting) return;
    setResetModal(INITIAL_MODAL_STATE);
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    const validationError = validatePasswordForSubmission(resetModal.newPassword);
    if (validationError) {
      setResetModal((prev) => ({ ...prev, error: validationError, success: '' }));
      return;
    }

    try {
      setResetModal((prev) => ({
        ...prev,
        submitting: true,
        error: '',
        success: '',
      }));

      await adminResetUserPassword(resetModal.user.id, resetModal.newPassword);
      setResetModal((prev) => ({
        ...prev,
        submitting: false,
        success: '密码已更新，目标用户旧登录态会立即失效。',
      }));
      await fetchUsers();
    } catch (error) {
      logger.error('管理员重置密码失败', error);
      setResetModal((prev) => ({
        ...prev,
        submitting: false,
        error: error.response?.data?.detail || '重置密码失败，请稍后重试',
      }));
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${palette.heading}`}>用户管理</h2>
            <p className={`mt-1 text-sm ${palette.label}`}>共 {total} 个用户</p>
          </div>
        </div>

        <div className={palette.card}>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className={palette.label}>加载中...</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={`w-full border-collapse ${palette.table}`}>
                  <thead>
                    <tr className={palette.tableHeader}>
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold">ID</th>
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold">邮箱</th>
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold">姓名</th>
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold">角色</th>
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold">注册时间</th>
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className={`${palette.tableRow} border-b`}>
                        <td className="px-4 py-3 text-sm">{user.id}</td>
                        <td className="px-4 py-3 text-sm">{user.email}</td>
                        <td className="px-4 py-3 text-sm">{user.name || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              user.role === 'admin'
                                ? isDark
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-purple-100 text-purple-700'
                                : isDark
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {user.role === 'admin' ? '管理员' : '普通用户'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {user.created_at ? new Date(user.created_at).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={user.role}
                              onChange={(event) => handleRoleChange(user.id, event.target.value)}
                              className={`rounded border px-3 py-1 text-sm ${
                                isDark
                                  ? 'border-white/20 bg-[#0a0f1f] text-white'
                                  : 'border-gray-300 bg-white text-gray-700'
                              }`}
                            >
                              <option value="user">普通用户</option>
                              <option value="admin">管理员</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => openResetModal(user)}
                              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${palette.button}`}
                            >
                              修改密码
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className={`text-sm ${palette.label}`}>
                    第 {page} / {totalPages} 页，共 {total} 条记录
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className={`rounded-lg px-4 py-2 text-sm ${
                        page === 1 ? 'cursor-not-allowed opacity-50' : palette.button
                      }`}
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className={`rounded-lg px-4 py-2 text-sm ${
                        page === totalPages ? 'cursor-not-allowed opacity-50' : palette.button
                      }`}
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {resetModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 ${palette.modal}`}>
            <div className="mb-5">
              <h3 className="text-xl font-semibold">修改用户密码</h3>
              <p className={`mt-2 text-sm ${palette.label}`}>
                目标账号：{resetModal.user?.email}
              </p>
              <p className={`mt-1 text-sm ${palette.label}`}>
                只校验最小合法规则，不强制强密码；保存后旧 token 会立即失效。
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div>
                <label className={`mb-1.5 block text-sm font-medium ${palette.label}`}>
                  新密码
                </label>
                <input
                  type="password"
                  value={resetModal.newPassword}
                  onChange={(event) =>
                    setResetModal((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                      error: '',
                      success: '',
                    }))
                  }
                  placeholder="6-50 位，不能包含空格"
                  className={`block w-full rounded-xl border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-4 ${
                    isDark
                      ? `${palette.input} focus:ring-cyan-500/10`
                      : `${palette.input} focus:bg-white focus:ring-blue-500/10`
                  }`}
                />
                <PasswordStrengthMeter password={resetModal.newPassword} />
              </div>

              {resetModal.error && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isDark
                      ? 'border-red-400/30 bg-red-500/10 text-red-200'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {resetModal.error}
                </div>
              )}

              {resetModal.success && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isDark
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {resetModal.success}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeResetModal}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${palette.secondaryButton}`}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={resetModal.submitting}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    resetModal.submitting
                      ? 'cursor-not-allowed bg-slate-400 text-white opacity-70'
                      : palette.buttonActive
                  }`}
                >
                  {resetModal.submitting ? '保存中...' : '保存新密码'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default UserManagement;
