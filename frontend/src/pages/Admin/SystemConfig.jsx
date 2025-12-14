/**
 * 系统配置页面
 * 作者：智学伴开发团队
 * 目的：管理系统配置
 */
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const SystemConfig = () => {
  const [config, setConfig] = useState({
    max_upload_size: 10485760,
    ai_response_token_limit: 8000,
    markdown_rendering_mode: 'react-markdown',
    logging_level: 'INFO',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            label: 'text-white/70',
            input:
              'w-full px-3 py-2 rounded-lg bg-[#0f172a] border border-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-cyan-400 focus:border-transparent',
            note: 'text-sm text-white/50',
            button:
              'px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 disabled:opacity-50',
            card: 'bg-[#101629] border border-white/10 text-white',
            divider: 'border-white/10',
            loading: 'text-white/60',
          }
        : {
            heading: 'text-gray-800',
            label: 'text-gray-700',
            input: 'w-full px-3 py-2 border border-gray-300 rounded-lg',
            note: 'text-sm text-gray-600',
            button: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50',
            card: 'bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-gray-900',
            divider: 'border-gray-200',
            loading: 'text-gray-500',
          },
    [isDark]
  );

  const fetchConfig = async () => {
    try {
      const response = await api.get('/api/v1/admin/system-config');
      setConfig(response.data);
    } catch (error) {
      console.error('获取系统配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/v1/admin/system-config', config);
      alert('配置保存成功');
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className={palette.loading}>加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        <h2 className={`text-2xl font-bold mb-6 ${palette.heading}`}>系统配置</h2>

        <form onSubmit={handleSubmit} className={`rounded-xl shadow-sm p-6 ${palette.card}`}>
          <div className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${palette.label}`}>
                最大上传文件大小
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={config.max_upload_size}
                  onChange={(e) => setConfig({ ...config, max_upload_size: parseInt(e.target.value) })}
                  className={`${palette.input} flex-1`}
                />
                <span className={palette.note}>
                  ({formatFileSize(config.max_upload_size)})
                </span>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${palette.label}`}>
                AI响应Token限制
              </label>
              <input
                type="number"
                value={config.ai_response_token_limit}
                onChange={(e) => setConfig({ ...config, ai_response_token_limit: parseInt(e.target.value) })}
                className={palette.input}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${palette.label}`}>
                Markdown渲染模式
              </label>
              <select
                value={config.markdown_rendering_mode}
                onChange={(e) => setConfig({ ...config, markdown_rendering_mode: e.target.value })}
                className={palette.input}
              >
                <option value="react-markdown">react-markdown</option>
                <option value="marked">marked</option>
                <option value="markdown-it">markdown-it</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${palette.label}`}>
                日志级别
              </label>
              <select
                value={config.logging_level}
                onChange={(e) => setConfig({ ...config, logging_level: e.target.value })}
                className={palette.input}
              >
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div className={`pt-4 border-t ${palette.divider}`}>
              <button
                type="submit"
                disabled={saving}
                className={palette.button}
              >
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default SystemConfig;

