/**
 * API调用日志查询页面
 * 作者：智学伴开发团队
 * 目的：查询和查看API调用日志
 */
import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { getAPILogs } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const APICallLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState({
    provider: '',
    source: '',
    start_date: '',
    end_date: '',
  });
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            card: 'bg-[#101629] border border-white/10 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] p-6 text-white',
            label: 'text-white/60',
            input: 'bg-[#0a0f1f] border-white/20 text-white placeholder-white/40',
            table: 'bg-[#0f1527] border-white/10',
            tableHeader: 'bg-[#0a0f1f] text-white/80',
            tableRow: 'border-white/10 hover:bg-white/5',
            button: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40',
            buttonActive: 'bg-cyan-500 text-white border-cyan-500',
            success: 'text-green-400',
            error: 'text-red-400',
          }
        : {
            heading: 'text-gray-800',
            card: 'bg-white rounded-xl shadow-sm p-6 border border-gray-100',
            label: 'text-gray-600',
            input: 'bg-white border-gray-300 text-gray-700 placeholder-gray-400',
            table: 'bg-white border-gray-200',
            tableHeader: 'bg-gray-50 text-gray-700',
            tableRow: 'border-gray-200 hover:bg-gray-50',
            button: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200',
            buttonActive: 'bg-blue-600 text-white border-blue-600',
            success: 'text-green-600',
            error: 'text-red-600',
          },
    [isDark]
  );

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
      };
      
      if (filters.provider) params.provider = filters.provider;
      if (filters.source) params.source = filters.source;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await getAPILogs(params);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取API调用日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // 重置到第一页
  };

  const handleResetFilters = () => {
    setFilters({
      provider: '',
      source: '',
      start_date: '',
      end_date: '',
    });
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  // 获取所有唯一的 provider 和 source 用于筛选
  const uniqueProviders = useMemo(() => {
    const providers = new Set();
    logs.forEach((log) => {
      if (log.provider) providers.add(log.provider);
    });
    return Array.from(providers).sort();
  }, [logs]);

  const uniqueSources = useMemo(() => {
    const sources = new Set();
    logs.forEach((log) => {
      if (log.source) sources.add(log.source);
    });
    return Array.from(sources).sort();
  }, [logs]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${palette.heading}`}>API调用日志</h2>
            <p className={`text-sm ${palette.label} mt-1`}>共 {total} 条记录</p>
          </div>
        </div>

        {/* 筛选条件 */}
        <div className={palette.card}>
          <h3 className={`text-lg font-semibold mb-4 ${palette.heading}`}>筛选条件</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${palette.label}`}>模型提供商</label>
              <input
                type="text"
                value={filters.provider}
                onChange={(e) => handleFilterChange('provider', e.target.value)}
                placeholder="输入提供商名称"
                className={`w-full px-3 py-2 rounded-lg border ${palette.input}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${palette.label}`}>调用来源</label>
              <select
                value={filters.source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${palette.input}`}
              >
                <option value="">全部</option>
                {uniqueSources.map((source) => (
                  <option key={source} value={source}>
                    {source === 'user' ? '用户对话' : 
                     source === 'admin_test' ? '管理员测试' :
                     source === 'quiz' ? 'AI测评' :
                     source === 'learning_map' ? '知识图谱' :
                     source === 'study_plan' ? '学习计划' : source}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-sm mb-2 ${palette.label}`}>开始日期</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${palette.input}`}
                onFocus={(e) => e.target.showPicker?.()}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${palette.label}`}>结束日期</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${palette.input}`}
                onFocus={(e) => e.target.showPicker?.()}
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleResetFilters}
              className={`px-4 py-2 rounded-lg text-sm ${palette.button}`}
            >
              重置筛选
            </button>
          </div>
        </div>

        {/* 日志列表 */}
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
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">模型提供商</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">调用来源</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">状态</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold border-b">调用时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className={`${palette.tableRow} border-b`}>
                        <td className="px-4 py-3 text-sm">{log.id}</td>
                        <td className="px-4 py-3 text-sm">{log.provider || '未知'}</td>
                        <td className="px-4 py-3 text-sm">
                          {log.source === 'user' ? '用户对话' : 
                           log.source === 'admin_test' ? '管理员测试' :
                           log.source === 'quiz' ? 'AI测评' :
                           log.source === 'learning_map' ? '知识图谱' :
                           log.source === 'study_plan' ? '学习计划' : log.source}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.success
                                ? palette.success
                                : palette.error
                            }`}
                          >
                            {log.success ? '✓ 成功' : '✗ 失败'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            try {
                              const date = new Date(log.created_at);
                              return isNaN(date.getTime())
                                ? log.created_at || '-'
                                : date.toLocaleString('zh-CN', { hour12: false });
                            } catch {
                              return log.created_at || '-';
                            }
                          })()}
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

export default APICallLogs;

