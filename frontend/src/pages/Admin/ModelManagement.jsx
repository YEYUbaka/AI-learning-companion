/**
 * 模型管理页面
 * 作者：智学伴开发团队
 * 目的：管理AI模型配置
 */
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api, { testModelCall } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const ModelManagement = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [formData, setFormData] = useState({
    provider_name: '',
    api_key: '',
    base_url: '',
    priority: 0,
    enabled: true,
    params: {},
  });

  useEffect(() => {
    fetchModels();
  }, []);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            buttonPrimary:
              'px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg shadow-lg shadow-cyan-900/40 hover:shadow-cyan-900/60',
            buttonSecondary:
              'px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 hover:bg-white/20',
            alertSuccess: 'mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-white',
            alertError: 'mb-6 p-4 rounded-lg bg-red-500/10 border border-red-400/40 text-red-100',
            formCard: 'mb-6 bg-[#111a2f] rounded-2xl shadow-2xl border border-white/10 p-6 text-white',
            input:
              'w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-cyan-400 focus:border-transparent',
            checkboxLabel: 'text-sm text-white/70',
            tableCard: 'bg-[#101629] rounded-2xl shadow-2xl border border-white/10 overflow-hidden',
            tableHead: 'bg-white/5 text-white/60',
            tableText: 'text-white/80',
            badgeEnabled: 'bg-emerald-500/15 text-emerald-200',
            badgeDisabled: 'bg-white/10 text-white/60',
            linkPrimary: 'text-cyan-300 hover:text-white',
            linkEdit: 'text-emerald-300 hover:text-white',
            linkDelete: 'text-red-300 hover:text-red-100',
            empty: 'text-white/60',
          }
        : {
            heading: 'text-gray-800',
            buttonPrimary: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
            buttonSecondary: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            alertSuccess: 'mb-6 p-4 rounded-lg bg-green-50 border border-green-200',
            alertError: 'mb-6 p-4 rounded-lg bg-red-50 border border-red-200',
            formCard: 'mb-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100',
            input: 'w-full px-3 py-2 border border-gray-300 rounded-lg',
            checkboxLabel: 'text-sm text-gray-700',
            tableCard: 'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden',
            tableHead: 'bg-gray-50 text-gray-500',
            tableText: 'text-gray-700',
            badgeEnabled: 'bg-green-100 text-green-800',
            badgeDisabled: 'bg-gray-100 text-gray-800',
            linkPrimary: 'text-blue-600 hover:text-blue-800',
            linkEdit: 'text-green-600 hover:text-green-800',
            linkDelete: 'text-red-600 hover:text-red-800',
            empty: 'text-gray-500',
          },
    [isDark]
  );

  const fetchModels = async () => {
    try {
      const response = await api.get('/api/v1/admin/models');
      setModels(response.data);
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingModel) {
        await api.put(`/api/v1/admin/models/${editingModel.id}`, formData);
      } else {
        await api.post('/api/v1/admin/models', formData);
      }
      setShowForm(false);
      setEditingModel(null);
      setFormData({
        provider_name: '',
        api_key: '',
        base_url: '',
        priority: 0,
        enabled: true,
        params: {},
      });
      fetchModels();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEdit = (model) => {
    setEditingModel(model);
    setFormData({
      provider_name: model.provider_name,
      api_key: '', // 不显示已加密的密钥
      base_url: model.base_url || '',
      priority: model.priority,
      enabled: model.enabled,
      params: model.params || {},
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个模型配置吗？')) return;
    try {
      await api.delete(`/api/v1/admin/models/${id}`);
      fetchModels();
    } catch (error) {
      alert('删除失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleTest = async (providerName) => {
    const testPrompt = prompt('请输入测试提示词:', '你好，请介绍一下你自己');
    if (!testPrompt) return;

    try {
      setTestResult({ loading: true });
      const response = await testModelCall(providerName, testPrompt);
      setTestResult(response.data);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.response?.data?.detail || error.message,
      });
    }
  };

  return (
    <AdminLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold ${palette.heading}`}>模型管理</h2>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingModel(null);
              setFormData({
                provider_name: '',
                api_key: '',
                base_url: '',
                priority: 0,
                enabled: true,
                params: {},
              });
            }}
            className={palette.buttonPrimary}
          >
            添加模型
          </button>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div className={testResult.success ? palette.alertSuccess : palette.alertError}>
            <h3 className="font-semibold mb-2">测试结果</h3>
            {testResult.loading ? (
              <p>测试中...</p>
            ) : testResult.success ? (
              <div>
                <p className={`text-sm ${palette.tableText}`}>提供商: {testResult.provider}</p>
                <p className={`text-sm ${palette.tableText}`}>延迟: {testResult.latency_ms?.toFixed(2)}ms</p>
                <p className={`text-sm ${palette.tableText} mt-2`}>原始响应:</p>
                <pre className="bg-black/20 p-2 rounded text-xs overflow-auto max-h-32">
                  {testResult.raw_response}
                </pre>
                <p className={`text-sm ${palette.tableText} mt-2`}>清理后:</p>
                <pre className="bg-black/20 p-2 rounded text-xs overflow-auto max-h-32">
                  {testResult.cleaned_text}
                </pre>
              </div>
            ) : (
              <p className="text-sm">错误: {testResult.error}</p>
            )}
            <button
              onClick={() => setTestResult(null)}
              className={`mt-2 text-sm ${palette.tableText} hover:text-white`}
            >
              关闭
            </button>
          </div>
        )}

        {/* 表单 */}
        {showForm && (
          <div className={palette.formCard}>
            <h3 className="text-lg font-semibold mb-4">
              {editingModel ? '编辑模型' : '添加模型'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  提供商名称
                </label>
                <input
                  type="text"
                  value={formData.provider_name}
                  onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  className={palette.input}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  API密钥
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className={palette.input}
                  placeholder={editingModel ? '留空则不更新' : '请输入API密钥'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className={palette.input}
                  placeholder="可选，使用默认URL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  优先级
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className={palette.input}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="mr-2"
                />
                <label className={palette.checkboxLabel}>启用</label>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className={palette.buttonPrimary}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingModel(null);
                  }}
                  className={palette.buttonSecondary}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 模型列表 */}
        {loading ? (
          <div className={`text-center py-8 ${palette.empty}`}>加载中...</div>
        ) : (
          <div className={palette.tableCard}>
            <table className="w-full">
              <thead className={palette.tableHead}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">提供商</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">Base URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">优先级</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase">操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/10' : 'divide-gray-200'}`}>
                {models.map((model) => (
                  <tr key={model.id}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${palette.tableText}`}>
                      {model.provider_name}
                    </td>
                    <td className={`px-6 py-4 text-sm ${palette.tableText}`}>
                      {model.base_url || '默认'}
                    </td>
                    <td className={`px-6 py-4 text-sm ${palette.tableText}`}>{model.priority}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        model.enabled ? palette.badgeEnabled : palette.badgeDisabled
                      }`}>
                        {model.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleTest(model.provider_name)}
                        className={palette.linkPrimary}
                      >
                        测试
                      </button>
                      <button
                        onClick={() => handleEdit(model)}
                        className={palette.linkEdit}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(model.id)}
                        className={palette.linkDelete}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {models.length === 0 && (
              <div className={`text-center py-8 ${palette.empty}`}>暂无模型配置</div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ModelManagement;

