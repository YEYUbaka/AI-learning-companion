/**
 * 用户管理页面
 * 作者：智学伴开发团队
 * 目的：管理用户列表和角色
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { getUsers, updateUserRole } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
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
          },
    [isDark]
  );

  useEffect(() => {
    fetchUsers();
  }, [page]);

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
    try {
      await updateUserRole(userId, newRole);
      await fetchUsers(); // 刷新列表
    } catch (error) {
      console.error('更新用户角色失败:', error);
      alert('更新失败，请稍后重试');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${palette.heading}`}>用户管理</h2>
            <p className={`text-sm ${palette.label} mt-1`}>共 {total} 个用户</p>
          </div>
        </div>

        <div className={palette.card}>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className={palette.label}>加载中...</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={`w-full border-collapse ${palette.table}`}>
                  <thead>
                    <tr className={palette.tableHeader}>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">邮箱</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">姓名</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">角色</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">注册时间</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className={`${palette.tableRow} border-b`}>
                        <td className="px-4 py-3 text-sm">{user.id}</td>
                        <td className="px-4 py-3 text-sm">{user.email}</td>
                        <td className="px-4 py-3 text-sm">{user.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {user.role === 'admin' ? '管理员' : '普通用户'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(user.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`px-3 py-1 rounded border text-sm ${
                              isDark
                                ? 'bg-[#0a0f1f] border-white/20 text-white'
                                : 'bg-white border-gray-300 text-gray-700'
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

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className={`text-sm ${palette.label}`}>
                    第 {page} / {totalPages} 页，共 {total} 条记录
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        page === 1
                          ? 'opacity-50 cursor-not-allowed'
                          : palette.button
                      }`}
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        page === totalPages
                          ? 'opacity-50 cursor-not-allowed'
                          : palette.button
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
    </AdminLayout>
  );
};

export default UserManagement;

