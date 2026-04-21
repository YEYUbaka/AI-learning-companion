/**
 * 模型管理页面
 * 作者：智学伴开发团队
 * 目的：管理AI模型配置（左右分栏布局，左侧模型列表，右侧配置表单）
 */
import { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
import logger from '../../utils/logger';
import { DEFAULT_AI_MAX_TOKENS } from '../../constants/aiDefaults';
import FeatureModelRouting from './FeatureModelRouting';

// ─── 默认表单状态 ───────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  provider_name: '',
  api_key: '',
  base_url: '',
  priority: 0,
  enabled: true,
  model_name: '',
  temperature: 0.7,
  max_tokens: DEFAULT_AI_MAX_TOKENS,
  top_p: 1.0,
  timeout: 60,
  extra_headers: {},
};

const ADMIN_PROVIDER_ORDER = ['siliconflow', 'zhipu', 'moonshot', 'openrouter'];

const FALLBACK_PROVIDER_TEMPLATES = [
  {
    key: 'siliconflow',
    display_name: '硅基流动',
    default_base_url: 'https://api.siliconflow.cn/v1',
    default_model: 'Qwen/Qwen2.5-7B-Instruct',
    default_max_tokens: DEFAULT_AI_MAX_TOKENS,
    available_models: [
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
    ],
    requires_extra_headers: false,
    extra_header_keys: [],
    capabilities: {
      streaming: true,
      tool_calling: true,
      reasoning: true,
      long_output: true,
    },
  },
  {
    key: 'zhipu',
    display_name: '智谱AI',
    default_base_url: 'https://open.bigmodel.cn/api/paas/v4',
    default_model: 'glm-4-flash',
    default_max_tokens: DEFAULT_AI_MAX_TOKENS,
    available_models: ['glm-4.7-flash', 'glm-4-flash', 'glm-4-air', 'glm-4', 'glm-z1-flash'],
    requires_extra_headers: false,
    extra_header_keys: [],
    capabilities: {
      streaming: true,
      tool_calling: true,
      reasoning: true,
      long_output: true,
    },
  },
  {
    key: 'moonshot',
    display_name: '月之暗面',
    default_base_url: 'https://api.moonshot.cn/v1',
    default_model: 'moonshot-v1-32k',
    default_max_tokens: DEFAULT_AI_MAX_TOKENS,
    available_models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    requires_extra_headers: false,
    extra_header_keys: [],
    capabilities: {
      streaming: true,
      tool_calling: false,
      reasoning: true,
      long_output: true,
    },
  },
  {
    key: 'openrouter',
    display_name: 'OpenRouter',
    default_base_url: 'https://openrouter.ai/api/v1',
    default_model: '',
    default_max_tokens: DEFAULT_AI_MAX_TOKENS,
    available_models: [],
    requires_extra_headers: true,
    extra_header_keys: ['HTTP-Referer', 'X-Title'],
    capabilities: {
      streaming: true,
      tool_calling: true,
      reasoning: true,
      long_output: true,
    },
  },
];

const normalizeProviderTemplates = (templates = []) => {
  const templateMap = new Map();
  [...FALLBACK_PROVIDER_TEMPLATES, ...(Array.isArray(templates) ? templates : [])].forEach((template) => {
    if (template?.key && ADMIN_PROVIDER_ORDER.includes(template.key)) {
      templateMap.set(template.key, template);
    }
  });
  return ADMIN_PROVIDER_ORDER.map(key => templateMap.get(key)).filter(Boolean);
};

// ─── 滑块组件 ───────────────────────────────────────────────────────────────────
const Slider = ({ label, value, min, max, step, onChange, isDark }) => (
  <div className="flex items-center gap-3">
    <label className={`w-24 text-sm shrink-0 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
      {label}
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="flex-1 h-1.5 rounded accent-blue-600 cursor-pointer"
    />
    <span className={`w-12 text-right text-sm font-mono ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
      {value}
    </span>
  </div>
);

// ─── Section 标题组件 ────────────────────────────────────────────────────────────
const SectionTitle = ({ children, isDark }) => (
  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
    {children}
  </p>
);

// ─── 主组件 ─────────────────────────────────────────────────────────────────────
const ModelManagement = () => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // tab: 'providers' | 'routing'
  const [activeTab, setActiveTab] = useState('providers');
  const [templates, setTemplates] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 模型选择相关
  const [customModelInput, setCustomModelInput] = useState(false);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // 测试状态 { [providerName]: { loading, text, latency, model, error, done } }
  const [testResults, setTestResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const abortControllers = useRef({});

  // 测试详情模态框
  const [testDetailModal, setTestDetailModal] = useState(null); // providerName or null

  // ─── 错误消息格式化 ──────────────────────────────────────────────────────────
  const formatTestError = (errMsg) => {
    if (!errMsg) return '未知错误';
    if (errMsg.includes('429')) return '请求频率超限 (429)，请稍后重试';
    if (errMsg.includes('401') || errMsg.includes('Unauthorized')) return '认证失败，请检查 API 密钥';
    if (errMsg.includes('403')) return '权限不足 (403)，请检查账户权限';
    if (errMsg.includes('timeout') || errMsg.includes('timed out')) return '请求超时，请检查网络或增大 timeout';
    if (errMsg.includes('Connection') || errMsg.includes('connect')) return '连接失败，请检查 Base URL 是否正确';
    // 截断过长的原始错误（保留关键信息）
    return errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg;
  };

  // ─── 生命周期 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTemplates();
    fetchModels();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/v1/admin/models/templates');
      setTemplates(normalizeProviderTemplates(res.data));
    } catch (err) {
      setTemplates(FALLBACK_PROVIDER_TEMPLATES);
      logger.error('获取提供商模板失败', err);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await api.get('/api/v1/admin/models');
      setModels([...res.data].sort((a, b) => b.priority - a.priority));
    } catch (err) {
      logger.error('获取模型列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── 工具方法 ──────────────────────────────────────────────────────────────
  const getTemplate = (providerName) =>
    templates.find(t => t.key === providerName) || null;

  const getDisplayName = (providerName) => {
    const tpl = getTemplate(providerName);
    return tpl ? tpl.display_name : providerName;
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setCustomModelInput(false);
    setFetchedModels([]);
    setShowAdvanced(false);
    setEditingModel(null);
    setShowForm(false);
  };

  // ─── 提供商选择 ────────────────────────────────────────────────────────────
  const handleProviderChange = (key) => {
    const tpl = templates.find(t => t.key === key);
    if (!tpl) return;
    setFormData(prev => ({
      ...prev,
      provider_name: key,
      base_url: tpl.default_base_url,
      model_name: tpl.default_model,
      max_tokens: tpl.default_max_tokens ?? DEFAULT_AI_MAX_TOKENS,
      extra_headers: tpl.extra_header_keys.reduce((acc, k) => ({ ...acc, [k]: '' }), {}),
    }));
    setCustomModelInput(false);
    setFetchedModels([]);
  };

  // ─── 动态拉取模型列表 ─────────────────────────────────────────────────────
  const handleFetchModelList = async () => {
    if (!formData.base_url || !formData.api_key) {
      alert('请先填写 Base URL 和 API 密钥');
      return;
    }
    setFetchingModels(true);
    try {
      const res = await api.post('/api/v1/admin/models/fetch-model-list', {
        base_url: formData.base_url,
        api_key: formData.api_key,
      });
      const list = res.data.models || [];
      setFetchedModels(list);
      if (list.length > 0 && !formData.model_name) {
        setFormData(prev => ({ ...prev, model_name: list[0] }));
      }
    } catch (err) {
      logger.error('拉取模型列表失败', err);
      alert('拉取模型列表失败，请检查 URL 和密钥');
    } finally {
      setFetchingModels(false);
    }
  };

  // ─── 表单提交 ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      provider_name: formData.provider_name,
      api_key: formData.api_key || undefined,
      base_url: formData.base_url || undefined,
      priority: formData.priority,
      enabled: formData.enabled,
      params: {
        model_name: formData.model_name,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        top_p: formData.top_p,
        timeout: formData.timeout,
        extra_headers: formData.extra_headers,
      },
    };
    try {
      if (editingModel) {
        await api.put(`/api/v1/admin/models/${editingModel.id}`, payload);
      } else {
        await api.post('/api/v1/admin/models', payload);
      }
      resetForm();
      fetchModels();
    } catch (err) {
      alert('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // ─── 编辑 ──────────────────────────────────────────────────────────────────
  const handleEdit = (model) => {
    const p = model.params || {};
    setFormData({
      provider_name: model.provider_name,
      api_key: '',
      base_url: model.base_url || '',
      priority: model.priority,
      enabled: model.enabled,
      model_name: p.model_name || '',
      temperature: p.temperature ?? 0.7,
      max_tokens: p.max_tokens ?? getTemplate(model.provider_name)?.default_max_tokens ?? DEFAULT_AI_MAX_TOKENS,
      top_p: p.top_p ?? 1.0,
      timeout: p.timeout ?? 60,
      extra_headers: p.extra_headers || {},
    });
    const tpl = getTemplate(model.provider_name);
    const savedModel = p.model_name || '';
    const isCustom = savedModel !== '' &&
      tpl && tpl.available_models.length > 0 &&
      !tpl.available_models.includes(savedModel);
    setCustomModelInput(isCustom);
    setFetchedModels([]);
    setShowAdvanced(false);
    setEditingModel(model);
    setShowForm(true);
  };

  // ─── 删除 ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个模型配置吗？')) return;
    try {
      await api.delete(`/api/v1/admin/models/${id}`);
      if (editingModel?.id === id) resetForm();
      fetchModels();
    } catch (err) {
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // ─── 流式测试 ──────────────────────────────────────────────────────────────
  const handleStreamTest = async (configId) => {
    if (abortControllers.current[configId]) {
      abortControllers.current[configId].abort();
    }
    const controller = new AbortController();
    abortControllers.current[configId] = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
      setTestResults(prev => ({
        ...prev,
        [configId]: { loading: false, done: true, error: '测试超时（150秒），请检查 API Key 和模型名称是否正确', text: '' },
      }));
    }, 150000);

    setTestResults(prev => ({
      ...prev,
      [configId]: { loading: true, text: '', latency: null, model: '', error: null, done: false },
    }));

    try {
      const rawToken = sessionStorage.getItem('token');
      const token = rawToken ? `Bearer ${rawToken}` : api.defaults.headers.common['Authorization'];
      const hostname = window.location.hostname;
      const baseURL = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8000'
        : '';
      const response = await fetch(`${baseURL}/api/v1/admin/models/test-stream/${configId}`, {
        headers: { Authorization: token },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'token') {
              setTestResults(prev => ({
                ...prev,
                [configId]: {
                  ...prev[configId],
                  text: (prev[configId]?.text || '') + data.content,
                },
              }));
            } else if (data.type === 'done') {
              setTestResults(prev => ({
                ...prev,
                [configId]: {
                  ...prev[configId],
                  loading: false,
                  done: true,
                  latency: data.latency_ms,
                  model: data.model,
                },
              }));
            } else if (data.type === 'error') {
              setTestResults(prev => ({
                ...prev,
                [configId]: { loading: false, done: true, error: data.message, text: '' },
              }));
            }
          } catch {
            // ignore parse errors
          }
        }
      }
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') return;
      setTestResults(prev => ({
        ...prev,
        [configId]: { loading: false, done: true, error: err.message, text: '' },
      }));
    }
  };

  // ─── 一键测试所有 ─────────────────────────────────────────────────────────
  const handleTestAll = async () => {
    setTestingAll(true);
    setTestResults({});
    const enabled = models.filter(m => m.enabled);
    for (const model of enabled) {
      await handleStreamTest(model.id);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setTestingAll(false);
  };

  // ─── 当前表单对应的模板 ────────────────────────────────────────────────────
  const currentTemplate = getTemplate(formData.provider_name);
  const hasPresetModels = currentTemplate && currentTemplate.available_models.length > 0;
  const needsFetch = currentTemplate && (
    !hasPresetModels || currentTemplate.key === 'openrouter' || currentTemplate.key === 'openai_compat'
  );

  // ─── 通用输入框样式 ───────────────────────────────────────────────────────
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
      : 'bg-white border-gray-300 text-gray-900'
  }`;

  // ─── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="flex flex-col h-full">

        {/* ── 顶部标题栏 ── */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            模型管理
          </h2>
          {activeTab === 'providers' && (
            <button
              onClick={handleTestAll}
              disabled={testingAll || models.filter(m => m.enabled).length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isDark
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300'
              }`}
            >
              {testingAll ? '测试中...' : '一键测试所有'}
            </button>
          )}
        </div>

        {/* ── Tab 切换器 ── */}
        <div className={`flex gap-1 mb-4 shrink-0 p-1 rounded-lg w-fit ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
          {[
            { key: 'providers', label: 'Provider 配置' },
            { key: 'routing', label: '功能路由' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── 功能路由面板 ── */}
        {activeTab === 'routing' && <FeatureModelRouting />}

        {/* ── Provider 配置主区域 ── */}
        {activeTab === 'providers' && (
          <div className="flex gap-5 min-h-0 flex-1">

          {/* ════ 左侧：模型列表面板 ════ */}
          <div className={`w-80 shrink-0 flex flex-col rounded-xl border overflow-hidden ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
          }`}>
            {/* 左侧头部：添加按钮 */}
            <div className={`px-4 py-3 border-b shrink-0 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <button
                onClick={() => {
                  setFormData(DEFAULT_FORM);
                  setCustomModelInput(false);
                  setFetchedModels([]);
                  setShowAdvanced(false);
                  setEditingModel(null);
                  setShowForm(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                添加模型
              </button>
            </div>

            {/* 左侧：模型列表 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className={`text-center py-10 text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  加载中...
                </div>
              ) : models.length === 0 ? (
                <div className={`text-center py-12 px-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  <p className="text-sm mb-1">暂无模型配置</p>
                  <p className="text-xs">点击上方按钮添加</p>
                </div>
              ) : (
                <ul>
                  {models.map(model => {
                    const tpl = getTemplate(model.provider_name);
                    const displayName = tpl ? tpl.display_name : model.provider_name;
                    const params = model.params || {};
                    const modelName = params.model_name || '';
                    const temperature = params.temperature ?? 0.7;
    const maxTokens = params.max_tokens ?? DEFAULT_AI_MAX_TOKENS;
                    const timeout = params.timeout ?? 60;
                    const testResult = testResults[model.id];
                    const isSelected = editingModel?.id === model.id;

                    return (
                      <li
                        key={model.id}
                        onClick={() => handleEdit(model)}
                        className={`group relative px-4 py-3.5 cursor-pointer transition-colors border-l-2 ${
                          isSelected
                            ? isDark
                              ? 'border-blue-500 bg-blue-600/10'
                              : 'border-blue-500 bg-blue-50'
                            : isDark
                              ? 'border-transparent hover:bg-slate-800'
                              : 'border-transparent hover:bg-gray-50'
                        } ${isDark ? 'border-b border-slate-800' : 'border-b border-gray-100'}`}
                      >
                        {/* 行 1：提供商显示名 + 启用状态徽章 */}
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold truncate ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {displayName}
                          </span>
                          <span className={`ml-2 shrink-0 px-1.5 py-0.5 text-xs rounded ${
                            model.enabled
                              ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                              : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {model.enabled ? '启用' : '禁用'}
                          </span>
                        </div>

                        {/* 行 2：model_name (mono 蓝色) + 优先级 */}
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs font-mono truncate ${
                            isDark ? 'text-blue-400' : 'text-blue-600'
                          }`}>
                            {modelName || '—'}
                          </span>
                          <span className={`ml-2 shrink-0 text-xs ${
                            isDark ? 'text-slate-500' : 'text-gray-400'
                          }`}>
                            优先级 {model.priority}
                          </span>
                        </div>

                        {/* 行 3：关键参数摘要 */}
                        <p className={`mt-1 text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                          temp {temperature} &middot; max {maxTokens} &middot; {timeout}s
                        </p>

                        {/* 行 4：操作区 */}
                        <div
                          className="mt-2.5 flex items-center gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* 测试按钮 */}
                          <button
                            onClick={() => handleStreamTest(model.id)}
                            disabled={testResult?.loading}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                              isDark
                                ? 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40'
                                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40'
                            }`}
                          >
                            {testResult?.loading ? '...' : '测试'}
                          </button>

                          {/* 测试结果 */}
                          <div className="flex-1 min-w-0">
                            {testResult && (
                              <div className="flex items-center gap-1.5 min-w-0">
                                {/* 状态指示点 */}
                                {testResult.loading ? (
                                  <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>测试中...</span>
                                ) : testResult.error ? (
                                  <>
                                    <span className={`text-xs shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                                      失败
                                    </span>
                                    <button
                                      onClick={() => setTestDetailModal(model.id)}
                                      className={`text-xs underline underline-offset-2 truncate ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                      查看详情
                                    </button>
                                  </>
                                ) : testResult.done ? (
                                  <>
                                    <span className={`text-xs shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                      {testResult.latency ? testResult.latency.toFixed(0) + ' ms' : '成功'}
                                    </span>
                                    <button
                                      onClick={() => setTestDetailModal(model.id)}
                                      className={`text-xs underline underline-offset-2 truncate ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                      查看回复
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>

                          {/* 删除图标（hover 显示） */}
                          <button
                            onClick={() => handleDelete(model.id)}
                            className={`ml-auto p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                              isDark
                                ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title="删除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ════ 右侧：配置表单面板 ════ */}
          <div className={`flex-1 min-w-0 rounded-xl border flex flex-col overflow-hidden ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
          }`}>
            {!showForm ? (
              /* 空态引导 */
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-slate-800' : 'bg-gray-50'
                }`}>
                  <svg className={`w-7 h-7 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    点击左侧模型卡片查看配置
                  </p>
                  <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                    或者新建一个模型配置
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFormData(DEFAULT_FORM);
                    setCustomModelInput(false);
                    setFetchedModels([]);
                    setShowAdvanced(false);
                    setEditingModel(null);
                    setShowForm(true);
                  }}
                  className="mt-1 px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  添加模型配置
                </button>
              </div>
            ) : (
              <>
                {/* ── 右侧顶部操作栏 ── */}
                <div className={`px-6 py-4 border-b shrink-0 flex items-center justify-between ${
                  isDark ? 'border-slate-700' : 'border-gray-100'
                }`}>
                  <div>
                    <h3 className={`text-base font-semibold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {editingModel ? getDisplayName(editingModel.provider_name) : '添加模型配置'}
                    </h3>
                    {editingModel && (
                      <p className={`text-xs font-mono mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {editingModel.provider_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      form="model-form"
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                        isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      取消
                    </button>
                  </div>
                </div>

                {/* ── 表单内容（可滚动） ── */}
                <div className="flex-1 overflow-y-auto">
                  <form id="model-form" onSubmit={handleSubmit} className="p-6 space-y-0">

                    {/* ── Section 1：基本配置 ── */}
                    <div className="pb-6">
                      <SectionTitle isDark={isDark}>基本配置</SectionTitle>
                      <div className="grid grid-cols-2 gap-4">
                        {/* 提供商 */}
                        <div>
                          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            提供商
                          </label>
                          <select
                            value={formData.provider_name}
                            onChange={e => handleProviderChange(e.target.value)}
                            required
                            className={inputCls}
                          >
                            <option value="">-- 选择提供商 --</option>
                            {templates.map(tpl => (
                              <option key={tpl.key} value={tpl.key}>{tpl.display_name}</option>
                            ))}
                          </select>
                        </div>

                        {/* 优先级 + 启用开关 */}
                        <div>
                          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            优先级
                          </label>
                          <div className="flex gap-3 items-center">
                            <input
                              type="number"
                              value={formData.priority}
                              onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                              className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDark
                                  ? 'bg-slate-800 border-slate-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>启用</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 分割线 */}
                    <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />

                    {/* ── Section 2：连接配置 ── */}
                    <div className="py-6">
                      <SectionTitle isDark={isDark}>连接配置</SectionTitle>
                      <div className="space-y-4">
                        {/* API 密钥 */}
                        <div>
                          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            API 密钥
                          </label>
                          <input
                            type="password"
                            value={formData.api_key}
                            onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                            placeholder={
                              editingModel
                                ? (formData.provider_name === 'wenxin' ? '留空则保留原密钥（格式：API Key:Secret Key）' : '留空则保留原密钥')
                                : (formData.provider_name === 'wenxin' ? '请输入百度 API Key:Secret Key（冒号分隔）' : '请输入 API 密钥')
                            }
                            className={inputCls}
                          />
                        </div>

                        {/* Base URL */}
                        <div>
                          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={formData.base_url}
                            onChange={e => setFormData({ ...formData, base_url: e.target.value })}
                            placeholder={currentTemplate?.default_base_url || '可选，留空使用默认'}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 分割线 */}
                    <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />

                    {/* ── Section 3：模型选择 ── */}
                    {formData.provider_name && (
                      <>
                        <div className="py-6">
                          <SectionTitle isDark={isDark}>模型选择</SectionTitle>

                          {/* 有预设模型且非 OpenRouter */}
                          {hasPresetModels && !needsFetch && (
                            <div className="space-y-2">
                              {!customModelInput ? (
                                <div className="flex gap-2">
                                  <select
                                    value={formData.model_name}
                                    onChange={e => {
                                      if (e.target.value === '__custom__') {
                                        setCustomModelInput(true);
                                        setFormData(prev => ({ ...prev, model_name: '' }));
                                      } else {
                                        setFormData(prev => ({ ...prev, model_name: e.target.value }));
                                      }
                                    }}
                                    className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      isDark
                                        ? 'bg-slate-800 border-slate-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                  >
                                    {currentTemplate.available_models.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                    <option value="__custom__">自定义...</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={formData.model_name}
                                    onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                                    placeholder="输入自定义模型 ID"
                                    autoFocus
                                    className={inputCls}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomModelInput(false);
                                      setFormData(prev => ({ ...prev, model_name: currentTemplate.default_model }));
                                    }}
                                    className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                                      isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                  >
                                    返回列表
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* OpenRouter 或无预设：文本输入 + 获取列表按钮 */}
                          {(needsFetch || (hasPresetModels && currentTemplate?.key === 'openrouter')) && (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={formData.model_name}
                                  onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                                  placeholder="输入或从下方选择模型 ID"
                                  className={inputCls}
                                />
                                <button
                                  type="button"
                                  onClick={handleFetchModelList}
                                  disabled={fetchingModels}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                                    isDark
                                      ? 'bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                                  }`}
                                >
                                  {fetchingModels ? '获取中...' : '获取模型列表'}
                                </button>
                              </div>

                              {fetchedModels.length > 0 && (
                                <select
                                  value={formData.model_name}
                                  onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isDark
                                      ? 'bg-slate-800 border-slate-600 text-white'
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                >
                                  <option value="">-- 从列表选择 --</option>
                                  {fetchedModels.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 分割线 */}
                        <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />
                      </>
                    )}

                    {/* ── Section 4：扩展请求头（条件显示） ── */}
                    {currentTemplate?.requires_extra_headers && currentTemplate.extra_header_keys.length > 0 && (
                      <>
                        <div className="py-6">
                          <SectionTitle isDark={isDark}>扩展请求头</SectionTitle>
                          <div className="space-y-2">
                            {currentTemplate.extra_header_keys.map(headerKey => (
                              <div key={headerKey} className="flex items-center gap-2">
                                <span className={`w-36 text-xs shrink-0 font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                  {headerKey}
                                </span>
                                <input
                                  type="text"
                                  value={formData.extra_headers[headerKey] || ''}
                                  onChange={e =>
                                    setFormData(prev => ({
                                      ...prev,
                                      extra_headers: { ...prev.extra_headers, [headerKey]: e.target.value },
                                    }))
                                  }
                                  placeholder={`请输入 ${headerKey}`}
                                  className={inputCls}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 分割线 */}
                        <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />
                      </>
                    )}

                    {/* ── Section 5：高级参数（折叠） ── */}
                    <div className="py-6">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`w-full flex items-center justify-between text-left group`}
                      >
                        <SectionTitle isDark={isDark}>
                          高级参数
                        </SectionTitle>
                        <svg
                          className={`w-3.5 h-3.5 mb-3 transition-transform ${
                            isDark ? 'text-slate-600' : 'text-gray-300'
                          } ${showAdvanced ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showAdvanced && (
                        <div className="space-y-4 mt-1">
                          <Slider
                            label="temperature"
                            value={formData.temperature}
                            min={0} max={2} step={0.05}
                            onChange={v => setFormData(prev => ({ ...prev, temperature: v }))}
                            isDark={isDark}
                          />
                          <Slider
                            label="top_p"
                            value={formData.top_p}
                            min={0} max={1} step={0.05}
                            onChange={v => setFormData(prev => ({ ...prev, top_p: v }))}
                            isDark={isDark}
                          />
                          <div className="flex items-center gap-3">
                            <label className={`w-24 text-sm shrink-0 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                              max_tokens
                            </label>
                            <input
                              type="number"
                              value={formData.max_tokens}
                              min={1} max={128000} step={256}
                              onChange={e => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value, 10) || DEFAULT_AI_MAX_TOKENS }))}
                              className={`w-32 px-2 py-1.5 rounded-lg border text-sm text-right font-mono ${
                                isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <label className={`w-24 text-sm shrink-0 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                              timeout (s)
                            </label>
                            <input
                              type="number"
                              value={formData.timeout}
                              min={5} max={300} step={5}
                              onChange={e => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) || 60 }))}
                              className={`w-32 px-2 py-1.5 rounded-lg border text-sm text-right font-mono ${
                                isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </form>
                </div>
              </>
            )}
          </div>

        </div>
        )}

      </div>

      {/* ════ 测试结果详情模态框 ════ */}
      {testDetailModal && (() => {
        const result = testResults[testDetailModal];
        if (!result) return null;
        const modalModel = models.find(m => m.id === testDetailModal);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setTestDetailModal(null)}
          >
            <div
              className={`w-full max-w-lg rounded-xl shadow-xl overflow-hidden ${
                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
              }`}
              onClick={e => e.stopPropagation()}
            >
              {/* 模态框头部 */}
              <div className={`flex items-center justify-between px-5 py-4 border-b ${
                isDark ? 'border-slate-700' : 'border-gray-100'
              }`}>
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    测试结果详情
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {modalModel?.provider_name ?? testDetailModal}
                  </p>
                </div>
                <button
                  onClick={() => setTestDetailModal(null)}
                  className={`p-1.5 rounded-md ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 模态框内容 */}
              <div className="px-5 py-4 space-y-3">
                {/* 状态行 */}
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    result.error
                      ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                      : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-600'
                  }`}>
                    {result.error ? '测试失败' : '测试成功'}
                  </span>
                  {result.latency && (
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      响应耗时 {result.latency.toFixed(0)} ms
                    </span>
                  )}
                  {result.model && (
                    <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {result.model}
                    </span>
                  )}
                </div>

                {/* 错误详情 */}
                {result.error && (
                  <div className={`rounded-lg p-4 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      错误信息
                    </p>
                    <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                      {formatTestError(result.error)}
                    </p>
                    <details className="mt-2">
                      <summary className={`text-xs cursor-pointer ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        原始输出
                      </summary>
                      <pre className={`mt-1 text-xs whitespace-pre-wrap break-all ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {result.error}
                      </pre>
                    </details>
                  </div>
                )}

                {/* AI 回复内容 */}
                {result.text && (
                  <div className={`rounded-lg p-4 ${isDark ? 'bg-slate-700/50 border border-slate-600' : 'bg-gray-50 border border-gray-100'}`}>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      AI 回复内容
                    </p>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      {result.text}
                    </p>
                  </div>
                )}
              </div>

              {/* 模态框底部 */}
              <div className={`px-5 py-3 flex justify-end border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                  onClick={() => setTestDetailModal(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </AdminLayout>
  );
};

export default ModelManagement;
