/**
 * 用户管理页面
 * 目的：管理用户列表和角色，并适配移动端卡片视图
 */
import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { getUsers, updateUserRole } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const getIsMobileLayout = () => typeof window !== 'undefined' && window.innerWidth < 768;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
  const [roleError, setRoleError] = useState(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            card: 'bg-[#101629] border border-white/10 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] p-4 sm:p-6 text-white',
            label: 'text-white/60',
            table: 'bg-[#0f1527] border-white/10',
            tableHeader: 'bg-[#0a0f1f] text-white/80',
            tableRow: 'border-white/10 hover:bg-white/5',
            button: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40',
          }
        : {
            heading: 'text-gray-800',
            card: 'bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100',
            label: 'text-gray-600',
            table: 'bg-white border-gray-200',
            tableHeader: 'bg-gray-50 text-gray-700',
            tableRow: 'border-gray-200 hover:bg-gray-50',
            button: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200',
          },
    [isDark]
  );

  useEffect(() => {
    fetchUsers();
  }, [page]);

  useEffect(() => {
    const handleResize = () => setIsMobileLayout(getIsMobileLayout());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers((page - 1) * pageSize, pageSize);
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setRoleError(null);
    try {
      await updateUserRole(userId, newRole);
      await fetchUsers();
    } catch (error) {
      console.error('更新用户角色失败:', error);
      setRoleError('更新失败，请稍后重试');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const renderRoleBadge = (role) => (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        role === 'admin'
          ? isDark
            ? 'bg-purple-500/20 text-purple-300'
            : 'bg-purple-100 text-purple-700'
          : isDark
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-blue-100 text-blue-700'
      }`}
    >
      {role === 'admin' ? '管理员' : '普通用户'}
    </span>
  );

  return (
    <AdminLayout>
      <div className="space-y-5 p-4 sm:p-6">
        {roleError && (
          <div className={`rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-rose-400/10 text-rose-200' : 'bg-rose-50 text-rose-700'}`}>
            {roleError}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${palette.heading}`}>用户管理</h2>
            <p className={`mt-1 text-sm ${palette.label}`}>共 {total} 个用户</p>
          </div>
          <div className={`text-xs ${palette.label}`}>当前每页显示 {pageSize} 条记录</div>
        </div>

        <div className={palette.card}>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className={palette.label}>加载中...</div>
            </div>
          ) : isMobileLayout ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-[#0f1527]' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {user.name || '未命名用户'}
                      </div>
                      <div className={`mt-1 break-all text-xs ${palette.label}`}>{user.email}</div>
                    </div>
                    {renderRoleBadge(user.role)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className={`text-xs ${palette.label}`}>用户 ID</div>
                      <div className={`mt-1 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.id}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.label}`}>注册时间</div>
                      <div className={`mt-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={`mb-1.5 block text-xs font-medium ${palette.label}`}>角色切换</label>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                        isDark ? 'bg-[#0a0f1f] border-white/20 text-white' : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
                      <td className="px-4 py-3 text-sm">{user.name}</td>
                      <td className="px-4 py-3 text-sm">{renderRoleBadge(user.role)}</td>
                      <td className="px-4 py-3 text-sm">{new Date(user.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className={`rounded-lg border px-3 py-1 text-sm ${
                            isDark ? 'bg-[#0a0f1f] border-white/20 text-white' : 'bg-white border-gray-300 text-gray-700'
                          }`}
                        >
                          <option value="user">普通用户</option>
                          <option value="admin">管理员</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && !loading ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={`text-sm ${palette.label}`}>
                第 {page} / {totalPages} 页，共 {total} 条记录
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`rounded-lg px-4 py-2 text-sm ${
                    page === 1 ? 'opacity-50 cursor-not-allowed' : palette.button
                  }`}
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`rounded-lg px-4 py-2 text-sm ${
                    page === totalPages ? 'opacity-50 cursor-not-allowed' : palette.button
                  }`}
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
};

export default UserManagement;
