/**
 * 模型管理页面
 * 作者：智学伴开发团队
 * 目的：管理AI模型配置
 */
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api, { testModelCall } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const ModelManagement = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const [formData, setFormData] = useState({
    provider_name: '',
    api_key: '',
    base_url: '',
    priority: 0,
    enabled: true,
    params: {},
  });

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchModels();
  }, []);

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
      api_key: '',
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
    const testPrompt = '你好，请用一句话介绍你自己';

    try {
      setTestResults(prev => ({ ...prev, [providerName]: { loading: true } }));
      const response = await testModelCall(providerName, testPrompt);
      setTestResults(prev => ({ ...prev, [providerName]: response.data }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [providerName]: {
          success: false,
          error: error.response?.data?.detail || error.message,
        }
      }));
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    setTestResults({});

    for (const model of models.filter(m => m.enabled)) {
      await handleTest(model.provider_name);
      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTestingAll(false);
  };

  return (
    <AdminLayout>
      <div>
        {/* 顶部操作栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            模型管理
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handleTestAll}
              disabled={testingAll || models.filter(m => m.enabled).length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isDark
                  ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500'
                  : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400'
              }`}
            >
              {testingAll ? '测试中...' : '一键测试所有模型'}
            </button>
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              添加模型
            </button>
          </div>
        </div>

        {/* 表单 */}
        {showForm && (
          <div className={`mb-6 rounded-lg p-6 border ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {editingModel ? '编辑模型' : '添加模型'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  提供商名称
                </label>
                <input
                  type="text"
                  value={formData.provider_name}
                  onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  API密钥
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder={editingModel ? '留空则不更新' : '请输入API密钥'}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="可选，使用默认URL"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  优先级
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
          <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>启用</label>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingModel(null);
                  }}
                  className={`px-4 py-2 rounded-lg transition ${
                    isDark
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 模型卡片列表 */}
        {loading ? (
          <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            加载中...
          </div>
        ) : models.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            暂无模型配置
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {models.map((model) => {
              const testResult = testResults[model.provider_name];
              return (
                <div
                  key={model.id}
                  className={`rounded-lg p-6 border transition ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {model.provider_name}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          model.enabled
                            ? isDark
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-green-100 text-green-800'
                            : isDark
                            ? 'bg-slate-700 text-slate-400'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {model.enabled ? '启用' : '禁用'}
                        </span>
                      </div>
                      <div className={`text-sm space-y-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        <p>Base URL: {model.base_url || '默认'}</p>
                        <p>优先级: {model.priority}</p>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {/* 测试结果 */}
                  {testResult && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${
                      testResult.loading
                        ? isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
                        : testResult.success
                        ? isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
                        : isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
                    }`}>
                      {testResult.loading ? (
                        <p className={isDark ? 'text-blue-300' : 'text-blue-700'}>测试中...</p>
                      ) : testResult.success ? (
                        <div className={isDark ? 'text-green-300' : 'text-green-700'}>
                          <p className="font-medium mb-1">测试成功</p>
                          <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                            延迟: {testResult.latency_ms?.toFixed(0)}ms
                          </p>
                          <p className={`mt-2 text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            {testResult.cleaned_text?.substring(0, 100)}...
                          </p>
                        </div>
                      ) : (
                        <div className={isDark ? 'text-red-300' : 'text-red-700'}>
                          <p className="font-medium mb-1">测试失败</p>
                   <p className="text-xs">{testResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTest(model.provider_name)}
                      disabled={testResult?.loading}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isDark
                          ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500'
                          : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400'
                      }`}
                    >
                      测试
                    </button>
                    <button
                      onClick={() => handleEdit(model)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isDark
                          ? 'bg-slate-700 text-white hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(model.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isDark
                          ? 'bg-red-600/20 text-red-300 hover:bg-red-600/30'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ModelManagement;
