import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
import logger from '../../utils/logger';
import { DEFAULT_AI_MAX_TOKENS, MAX_AI_TOKEN_LIMIT } from '../../constants/aiDefaults';
import FeatureModelRouting from './FeatureModelRouting';

const DEFAULT_FORM = {
  provider_name: '',
  api_key: '',
  base_url: '',
  priority: 0,
  enabled: true,
  supports_vision: false,
  model_name: '',
  temperature: 0.7,
  max_tokens: DEFAULT_AI_MAX_TOKENS,
  top_p: 1.0,
  timeout: 60,
  extra_headers: {},
  web_search_host: '',
  workspace_name: '',
  search_service_id: '',
};

const ADMIN_PROVIDER_ORDER = ['siliconflow', 'zhipu', 'qwen', 'moonshot', 'doubao', 'openrouter'];

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
      supports_responses_api: false,
      supports_vision: false,
      supports_previous_response_id: false,
      native_tools: [],
      native_search_mode: 'none',
    },
  },
  {
    key: 'zhipu',
    display_name: '智谱 AI',
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
      supports_responses_api: false,
      supports_vision: false,
      supports_previous_response_id: false,
      native_tools: [],
      native_search_mode: 'none',
    },
  },
  {
    key: 'qwen',
    display_name: '千问',
    default_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    default_model: 'qwen-turbo',
    default_max_tokens: DEFAULT_AI_MAX_TOKENS,
    available_models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    requires_extra_headers: false,
    extra_header_keys: [],
    capabilities: {
      streaming: true,
      tool_calling: true,
      reasoning: true,
      long_output: true,
      supports_responses_api: false,
      supports_vision: false,
      supports_previous_response_id: false,
      native_tools: [],
      native_search_mode: 'qwen_chat_enable_search',
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
      supports_responses_api: false,
      supports_vision: false,
      supports_previous_response_id: false,
      native_tools: [],
      native_search_mode: 'none',
    },
  },
  {
    key: 'doubao',
    display_name: '豆包（火山方舟）',
    default_base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    default_model: '',
    default_max_tokens: DEFAULT_AI_MAX_TOKENS,
    available_models: [],
    requires_extra_headers: false,
    extra_header_keys: [],
    capabilities: {
      streaming: true,
      tool_calling: true,
      reasoning: true,
      long_output: true,
      supports_responses_api: true,
      supports_vision: false,
      supports_previous_response_id: true,
      native_tools: ['web_search', 'knowledge_search', 'image_process', 'mcp'],
      native_search_mode: 'responses_builtin_tools',
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
      supports_responses_api: false,
      supports_vision: false,
      supports_previous_response_id: false,
      native_tools: [],
      native_search_mode: 'none',
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

const getIsMobileLayout = () => typeof window !== 'undefined' && window.innerWidth < 1024;

const createDefaultForm = () => ({
  ...DEFAULT_FORM,
  extra_headers: { ...DEFAULT_FORM.extra_headers },
});

const getQwenOfficialSearchConfig = (params = {}) => ({
  web_search_host:
    params.web_search_host || params.search_service_host || params.opensearch_host || params.search_host || '',
  workspace_name: params.workspace_name || '',
  search_service_id: params.search_service_id || params.web_search_service_id || '',
});

const buildProviderSpecificParams = (formData) => {
  if (formData.provider_name !== 'qwen') {
    return {};
  }

  const nextParams = {};
  const webSearchHost = String(formData.web_search_host || '').trim();
  const workspaceName = String(formData.workspace_name || '').trim();
  const searchServiceId = String(formData.search_service_id || '').trim();

  if (webSearchHost) nextParams.web_search_host = webSearchHost;
  if (workspaceName) nextParams.workspace_name = workspaceName;
  if (searchServiceId) nextParams.search_service_id = searchServiceId;

  return nextParams;
};

const inferQwenSupportsResponses = (modelName = '') => {
  const lower = String(modelName || '').toLowerCase();
  if (lower === 'qwen3-max') return true;
  if (/^qwen3-max-\d{4}-\d{2}-\d{2}$/.test(lower)) return true;
  return ['qwen3.6-plus', 'qwen3.6-flash', 'qwen3.5-plus', 'qwen3.5-flash'].some(prefix => lower.startsWith(prefix));
};

const inferDoubaoSupportsResponses = (modelName = '') => {
  const value = String(modelName || '');
  if (!value) return true;
  if (value === 'doubao-1-5-pro-32k-character-250715') return false;
  const match = value.match(/(\d{6})$/);
  if (!match) return true;
  return Number(match[1]) >= 250615;
};

const getProviderCapabilities = (template, modelName = '') => {
  const base = { ...(template?.capabilities || {}) };
  const providerKey = template?.key;

  if (providerKey === 'qwen') {
    const supportsResponses = inferQwenSupportsResponses(modelName);
    base.supports_responses_api = supportsResponses;
    if (supportsResponses) {
      base.native_search_mode = 'responses_builtin_tools';
      base.native_tools = ['web_search', 'web_extractor', 'code_interpreter'];
    } else {
      base.native_search_mode = 'qwen_chat_enable_search';
      base.native_tools = [];
    }
  } else if (providerKey === 'doubao') {
    const supportsResponses = inferDoubaoSupportsResponses(modelName);
    base.supports_responses_api = supportsResponses;
    if (!supportsResponses) {
      base.native_search_mode = 'none';
      base.native_tools = [];
    }
  }

  return base;
};

const getNativeSearchSummary = (capabilities = {}) => {
  const mode = capabilities.native_search_mode || 'none';
  if (mode === 'qwen_chat_enable_search') {
    return '联网搜索通过 Chat Completions 的 enable_search / search_options 启用，不走通用 built-in tools。';
  }
  if (mode === 'responses_builtin_tools') {
    return '联网搜索通过 Responses API 内建工具启用，只适用于支持 Responses 的模型。';
  }
  return '当前不提供 provider 原生联网搜索，实时检索通常需要走本地工具链或其他显式能力。';
};

const getProviderCapabilityNotes = (template, modelName = '') => {
  const capabilities = getProviderCapabilities(template, modelName);
  const notes = [
    capabilities.tool_calling ? '支持原生 function calling。' : '不强调原生 function calling。',
    capabilities.supports_responses_api ? '支持 Responses API。' : '默认走 Chat Completions 接口。',
    getNativeSearchSummary(capabilities),
  ];

  if (template?.key === 'qwen') {
    notes.push('Qwen 只有部分新模型支持 Responses 内建 web_search / web_extractor / code_interpreter。');
  } else if (template?.key === 'doubao') {
    notes.push('火山方舟的 chat/completions 以函数调用为主，原生联网搜索应理解为 Responses 能力，不是通用 chat tool。');
  }

  return notes;
};

const getProviderCapabilityBadges = (template, modelName = '') => {
  const capabilities = getProviderCapabilities(template, modelName);
  const badges = [capabilities.tool_calling ? '函数调用' : '基础对话'];

  if (capabilities.supports_responses_api) badges.push('Responses API');
  if (capabilities.supports_vision) badges.push('视觉');

  const mode = capabilities.native_search_mode || 'none';
  if (mode === 'qwen_chat_enable_search') {
    badges.push('联网搜索: enable_search');
  } else if (mode === 'responses_builtin_tools') {
    badges.push('联网搜索: Responses 内建工具');
  } else {
    badges.push('联网搜索: 无原生入口');
  }

  return badges;
};

const getProviderParamHints = (providerKey) => {
  if (providerKey !== 'qwen') {
    return [];
  }

  return [
    '阿里官方联网搜索推荐填写 `web_search_host`、`workspace_name`、`search_service_id`。',
    '其中 `web_search_host` 兼容后端别名：`search_service_host`、`opensearch_host`、`search_host`。',
    '`workspace_name` 默认可留空走 `default`，`search_service_id` 默认可留空走 `ops-web-search-001`。',
  ];
};

const Slider = ({ label, value, min, max, step, onChange, isDark }) => (
  <div className="flex items-center gap-3">
    <label className={`w-24 shrink-0 text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="h-1.5 flex-1 cursor-pointer rounded accent-blue-600"
    />
    <span className={`w-12 text-right text-sm font-mono ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
      {value}
    </span>
  </div>
);

const SectionTitle = ({ children, isDark }) => (
  <p className={`mb-3 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
    {children}
  </p>
);

const ModelManagement = () => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('providers');
  const [templates, setTemplates] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState(createDefaultForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customModelInput, setCustomModelInput] = useState(false);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const [testDetailModal, setTestDetailModal] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
  const [mobileProviderPanel, setMobileProviderPanel] = useState('catalog');
  const [toastMsg, setToastMsg] = useState(null);
  const abortControllers = useRef({});

  useEffect(() => {
    fetchTemplates();
    fetchModels();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const nextMobile = getIsMobileLayout();
      setIsMobileLayout(nextMobile);
      if (!nextMobile) {
        setMobileProviderPanel('catalog');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/v1/admin/models/templates');
      setTemplates(normalizeProviderTemplates(res.data));
    } catch (err) {
      setTemplates(FALLBACK_PROVIDER_TEMPLATES);
      logger.error('获取模型模板失败', err);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await api.get('/api/v1/admin/models');
      setModels([...(res.data || [])].sort((a, b) => b.priority - a.priority));
    } catch (err) {
      logger.error('获取模型列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const getTemplate = (providerName) => templates.find(t => t.key === providerName) || null;
  const getDisplayName = (providerName) => getTemplate(providerName)?.display_name || providerName;

  const formatTestError = (errMsg) => {
    if (!errMsg) return '未知错误';
    if (errMsg.includes('429')) return '请求频率超限 (429)，请稍后重试';
    if (errMsg.includes('401') || errMsg.includes('Unauthorized')) return '认证失败，请检查 API Key';
    if (errMsg.includes('403')) return '权限不足 (403)，请检查账号权限';
    if (errMsg.includes('timeout') || errMsg.includes('timed out')) return '请求超时，请检查网络或适当增大 timeout';
    if (errMsg.includes('Connection') || errMsg.includes('connect')) return '连接失败，请检查 Base URL 是否正确';
    return errMsg.length > 100 ? `${errMsg.slice(0, 100)}...` : errMsg;
  };

  const resetForm = () => {
    setFormData(createDefaultForm());
    setCustomModelInput(false);
    setFetchedModels([]);
    setShowAdvanced(false);
    setEditingModel(null);
    setShowForm(false);
    if (getIsMobileLayout()) {
      setMobileProviderPanel('catalog');
    }
  };

  const openCreateForm = () => {
    setFormData(createDefaultForm());
    setCustomModelInput(false);
    setFetchedModels([]);
    setShowAdvanced(false);
    setEditingModel(null);
    setShowForm(true);
    if (getIsMobileLayout()) {
      setMobileProviderPanel('editor');
    }
  };

  const handleProviderChange = (key) => {
    const template = templates.find(t => t.key === key);
    if (!template) return;
    const capabilities = getProviderCapabilities(template, template.default_model);

    setFormData(prev => ({
      ...prev,
      provider_name: key,
      base_url: template.default_base_url,
      model_name: template.default_model,
      supports_vision: Boolean(capabilities.supports_vision),
      max_tokens: template.default_max_tokens ?? DEFAULT_AI_MAX_TOKENS,
      extra_headers: template.extra_header_keys.reduce((acc, headerKey) => ({ ...acc, [headerKey]: '' }), {}),
      web_search_host: '',
      workspace_name: '',
      search_service_id: '',
    }));
    setCustomModelInput(false);
    setFetchedModels([]);
  };

  const handleFetchModelList = async () => {
    if (!formData.base_url || !formData.api_key) {
      setToastMsg({ type: 'error', text: '请先填写 Base URL 和 API Key' });
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
      setToastMsg({ type: 'error', text: '拉取模型列表失败，请检查 URL 和密钥' });
    } finally {
      setFetchingModels(false);
    }
  };

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
        supports_vision: formData.supports_vision,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        top_p: formData.top_p,
        timeout: formData.timeout,
        extra_headers: formData.extra_headers,
        ...buildProviderSpecificParams(formData),
      },
    };

    try {
      if (editingModel) {
        await api.put(`/api/v1/admin/models/${editingModel.id}`, payload);
      } else {
        await api.post('/api/v1/admin/models', payload);
      }
      await fetchModels();
      resetForm();
    } catch (err) {
      setToastMsg({ type: 'error', text: `操作失败: ${err.response?.data?.detail || err.message}` });
    }
  };

  const handleEdit = (model) => {
    const params = model.params || {};
    const qwenOfficialSearchConfig = getQwenOfficialSearchConfig(params);
    const template = getTemplate(model.provider_name);
    const savedModel = params.model_name || '';
    const isCustom =
      savedModel !== '' &&
      template &&
      template.available_models.length > 0 &&
      !template.available_models.includes(savedModel);
    const capabilities = getProviderCapabilities(template, savedModel);

    setFormData({
      provider_name: model.provider_name,
      api_key: '',
      base_url: model.base_url || '',
      priority: model.priority,
      enabled: model.enabled,
      supports_vision: params.supports_vision ?? Boolean(capabilities.supports_vision),
      model_name: savedModel,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? template?.default_max_tokens ?? DEFAULT_AI_MAX_TOKENS,
      top_p: params.top_p ?? 1.0,
      timeout: params.timeout ?? 60,
      extra_headers: { ...(params.extra_headers || {}) },
      web_search_host: qwenOfficialSearchConfig.web_search_host,
      workspace_name: qwenOfficialSearchConfig.workspace_name,
      search_service_id: qwenOfficialSearchConfig.search_service_id,
    });
    setCustomModelInput(isCustom);
    setFetchedModels([]);
    setShowAdvanced(false);
    setEditingModel(model);
    setShowForm(true);
    if (getIsMobileLayout()) {
      setMobileProviderPanel('editor');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个模型配置吗？')) return;

    try {
      await api.delete(`/api/v1/admin/models/${id}`);
      if (editingModel?.id === id) {
        resetForm();
      }
      await fetchModels();
    } catch (err) {
      setToastMsg({ type: 'error', text: `删除失败: ${err.response?.data?.detail || err.message}` });
    }
  };

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
        [configId]: {
          loading: false,
          done: true,
          error: '测试超时（150 秒），请检查 API Key、Base URL 和模型名称是否正确',
          text: '',
        },
      }));
    }, 150000);

    setTestResults(prev => ({
      ...prev,
      [configId]: { loading: true, text: '', latency: null, model: '', error: null, done: false },
    }));

    try {
      const rawToken = sessionStorage.getItem('token');
      const token = rawToken ? `Bearer ${rawToken}` : api.defaults.headers.common.Authorization;
      const hostname = window.location.hostname;
      const baseURL =
        hostname === 'localhost' || hostname === '127.0.0.1' ? 'http://127.0.0.1:8000' : '';
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
        buffer = lines.pop() || '';

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
                  text: `${prev[configId]?.text || ''}${data.content}`,
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
                [configId]: {
                  loading: false,
                  done: true,
                  error: data.message,
                  text: '',
                },
              }));
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setTestResults(prev => ({
          ...prev,
          [configId]: { loading: false, done: true, error: err.message, text: '' },
        }));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    setTestResults({});
    const enabledModels = models.filter(model => model.enabled);

    for (const model of enabledModels) {
      await handleStreamTest(model.id);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setTestingAll(false);
  };

  const currentTemplate = getTemplate(formData.provider_name);
  const providerParamHints = getProviderParamHints(currentTemplate?.key);
  const hasPresetModels = currentTemplate && currentTemplate.available_models.length > 0;
  const needsFetch =
    currentTemplate &&
    (!hasPresetModels || currentTemplate.key === 'openrouter' || currentTemplate.key === 'openai_compat');

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark
      ? 'border-slate-600 bg-slate-800 text-white placeholder-slate-500'
      : 'border-gray-300 bg-white text-gray-900'
  }`;

  const renderModelList = () => (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border ${
        isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'
      } ${isMobileLayout ? 'w-full' : 'w-80 shrink-0'}`}
    >
      <div className={`shrink-0 border-b px-4 py-3 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
        <button
          type="button"
          onClick={openCreateForm}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          新增模型
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className={`py-10 text-center text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>加载中...</div>
        ) : models.length === 0 ? (
          <div className={`px-4 py-12 text-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <p className="mb-1 text-sm">暂无模型配置</p>
            <p className="text-xs">点击上方按钮创建第一条配置</p>
          </div>
        ) : (
          <ul>
            {models.map(model => {
              const params = model.params || {};
              const testResult = testResults[model.id];
              const isSelected = editingModel?.id === model.id;
              const template = getTemplate(model.provider_name);
              const capabilityBadges = getProviderCapabilityBadges(template, params.model_name);

              return (
                <li
                  key={model.id}
                  onClick={() => handleEdit(model)}
                  className={`group cursor-pointer border-b border-l-2 px-4 py-3.5 transition-colors ${
                    isDark ? 'border-b-slate-800' : 'border-b-gray-100'
                  } ${
                    isSelected
                      ? isDark
                        ? 'border-l-blue-500 bg-blue-600/10'
                        : 'border-l-blue-500 bg-blue-50'
                      : isDark
                        ? 'border-l-transparent hover:bg-slate-800'
                        : 'border-l-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {getDisplayName(model.provider_name)}
                      </p>
                      <p className={`mt-1 truncate font-mono text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                        {params.model_name || '--'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                        model.enabled
                          ? isDark
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-green-100 text-green-700'
                          : isDark
                            ? 'bg-slate-700 text-slate-400'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {model.enabled ? '启用' : '停用'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>优先级 {model.priority}</span>
                    <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>temp {params.temperature ?? 0.7}</span>
                    <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>
                      max {params.max_tokens ?? DEFAULT_AI_MAX_TOKENS}
                    </span>
                    <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>{params.timeout ?? 60}s</span>
                    {params.supports_vision ? (
                      <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>视觉</span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {capabilityBadges.map((badge) => (
                      <span
                        key={badge}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleStreamTest(model.id)}
                      disabled={testResult?.loading}
                      className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
                    >
                      {testResult?.loading ? '测试中...' : '测试'}
                    </button>

                    <div className="min-w-0 flex-1">
                      {testResult && (
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {testResult.loading ? (
                            <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>测试中...</span>
                          ) : testResult.error ? (
                            <>
                              <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-500'}`}>失败</span>
                              <button
                                type="button"
                                onClick={() => setTestDetailModal(model.id)}
                                className={`truncate text-xs underline underline-offset-2 ${
                                  isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                查看详情
                              </button>
                            </>
                          ) : testResult.done ? (
                            <>
                              <span className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                {testResult.latency ? `${testResult.latency.toFixed(0)} ms` : '成功'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setTestDetailModal(model.id)}
                                className={`truncate text-xs underline underline-offset-2 ${
                                  isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                查看回复
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(model.id)}
                      className={`ml-auto rounded-md p-1 transition-opacity ${
                        isDark
                          ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400'
                          : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                      } opacity-100 lg:opacity-0 lg:group-hover:opacity-100`}
                      title="删除"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
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
  );

  const renderEmptyEditor = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-xl ${
          isDark ? 'bg-slate-800' : 'bg-gray-50'
        }`}
      >
        <svg
          className={`h-7 w-7 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div>
        <p className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
          {isMobileLayout ? '从列表中选择模型查看配置' : '点击左侧模型卡片查看配置'}
        </p>
        <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>也可以直接新建一条模型配置</p>
      </div>
      <button
        type="button"
        onClick={openCreateForm}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        新建模型配置
      </button>
    </div>
  );

  const renderEditor = () => (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border ${
        isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'
      }`}
    >
      {!showForm ? (
        renderEmptyEditor()
      ) : (
        <>
          <div
            className={`shrink-0 border-b px-4 py-4 sm:px-6 ${
              isDark ? 'border-slate-700' : 'border-gray-100'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className={`text-base font-semibold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {editingModel ? getDisplayName(editingModel.provider_name) : '新增模型配置'}
                </h3>
                {editingModel && (
                  <p className={`mt-0.5 text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {editingModel.provider_name}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  form="model-form"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  取消
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <form id="model-form" onSubmit={handleSubmit} className="space-y-0 p-4 sm:p-6">
              <div className="pb-6">
                <SectionTitle isDark={isDark}>基本配置</SectionTitle>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      提供商
                    </label>
                    <select
                      value={formData.provider_name}
                      onChange={e => handleProviderChange(e.target.value)}
                      required
                      className={inputCls}
                    >
                      <option value="">-- 选择提供商 --</option>
                      {templates.map(template => (
                        <option key={template.key} value={template.key}>
                          {template.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      优先级
                    </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          type="number"
                          value={formData.priority}
                        onChange={e =>
                          setFormData(prev => ({ ...prev, priority: parseInt(e.target.value, 10) || 0 }))
                        }
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300 bg-white text-gray-900'
                        }`}
                      />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.enabled}
                            onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>启用</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.supports_vision}
                            onChange={e => setFormData(prev => ({ ...prev, supports_vision: e.target.checked }))}
                            className="h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>支持视觉</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

              {currentTemplate ? (
                <div
                  className={`mb-6 rounded-xl border px-4 py-4 ${
                    isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap gap-2">
                    {getProviderCapabilityBadges(currentTemplate, formData.model_name).map((badge) => (
                      <span
                        key={badge}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          isDark ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-700'
                        }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      Provider 能力说明
                    </p>
                    {getProviderCapabilityNotes(currentTemplate, formData.model_name).map((note) => (
                      <p
                        key={note}
                        className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                      >
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {currentTemplate?.key === 'qwen' && (
                <>
                  <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />

                  <div className="py-6">
                    <SectionTitle isDark={isDark}>阿里官方联网搜索</SectionTitle>
                    <div className="space-y-4">
                      <div
                        className={`rounded-xl border px-4 py-3 ${
                          isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1.5">
                          {providerParamHints.map((hint) => (
                            <p
                              key={hint}
                              className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                            >
                              {hint}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                          web_search_host
                        </label>
                        <input
                          type="text"
                          value={formData.web_search_host}
                          onChange={e => setFormData(prev => ({ ...prev, web_search_host: e.target.value }))}
                          placeholder="例如 https://xxx-hangzhou.opensearch.aliyuncs.com"
                          className={inputCls}
                        />
                        <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                          用于直连阿里官方 Web Search API；后端也兼容 `search_service_host` / `opensearch_host` / `search_host`。
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            workspace_name
                          </label>
                          <input
                            type="text"
                            value={formData.workspace_name}
                            onChange={e => setFormData(prev => ({ ...prev, workspace_name: e.target.value }))}
                            placeholder="default"
                            className={inputCls}
                          />
                        </div>

                        <div>
                          <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                            search_service_id
                          </label>
                          <input
                            type="text"
                            value={formData.search_service_id}
                            onChange={e => setFormData(prev => ({ ...prev, search_service_id: e.target.value }))}
                            placeholder="ops-web-search-001"
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />

              <div className="py-6">
                <SectionTitle isDark={isDark}>连接配置</SectionTitle>
                <div className="space-y-4">
                  <div>
                    <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={formData.api_key}
                      onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                      placeholder={editingModel ? '留空则保留原密钥' : '请输入 API 密钥'}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={formData.base_url}
                      onChange={e => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                      placeholder={currentTemplate?.default_base_url || '可选，留空使用默认地址'}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />

              {formData.provider_name && (
                <>
                  <div className="py-6">
                    <SectionTitle isDark={isDark}>模型选择</SectionTitle>

                    {hasPresetModels && !needsFetch && (
                      <div className="space-y-2">
                        {!customModelInput ? (
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
                            className={inputCls}
                          >
                            {currentTemplate.available_models.map(modelName => (
                              <option key={modelName} value={modelName}>
                                {modelName}
                              </option>
                            ))}
                            <option value="__custom__">自定义...</option>
                          </select>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              value={formData.model_name}
                              onChange={e => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
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
                              className={`rounded-lg px-3 py-2 text-sm ${
                                isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              返回列表
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {(needsFetch || (hasPresetModels && currentTemplate?.key === 'openrouter')) && (
                      <div className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={formData.model_name}
                            onChange={e => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
                            placeholder="输入模型 ID，或从下方列表选择"
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={handleFetchModelList}
                            disabled={fetchingModels}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
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
                            onChange={e => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
                            className={inputCls}
                          >
                            <option value="">-- 从列表选择 --</option>
                            {fetchedModels.map(modelName => (
                              <option key={modelName} value={modelName}>
                                {modelName}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />
                </>
              )}

              {currentTemplate?.requires_extra_headers && currentTemplate.extra_header_keys.length > 0 && (
                <>
                  <div className="py-6">
                    <SectionTitle isDark={isDark}>扩展请求头</SectionTitle>
                    <div className="space-y-3">
                      {currentTemplate.extra_header_keys.map(headerKey => (
                        <div key={headerKey} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span
                            className={`shrink-0 text-xs font-mono sm:w-36 ${
                              isDark ? 'text-slate-500' : 'text-gray-400'
                            }`}
                          >
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

                  <div className={`border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`} />
                </>
              )}

              <div className="py-6">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(prev => !prev)}
                  className="group flex w-full items-center justify-between text-left"
                >
                  <SectionTitle isDark={isDark}>高级参数</SectionTitle>
                  <svg
                    className={`mb-3 h-3.5 w-3.5 transition-transform ${
                      isDark ? 'text-slate-600' : 'text-gray-300'
                    } ${showAdvanced ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAdvanced && (
                  <div className="mt-1 space-y-4">
                    <Slider
                      label="temperature"
                      value={formData.temperature}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={value => setFormData(prev => ({ ...prev, temperature: value }))}
                      isDark={isDark}
                    />
                    <Slider
                      label="top_p"
                      value={formData.top_p}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={value => setFormData(prev => ({ ...prev, top_p: value }))}
                      isDark={isDark}
                    />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className={`shrink-0 text-sm sm:w-24 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                        max_tokens
                      </label>
                      <input
                        type="number"
                        value={formData.max_tokens}
                        min={1}
                        max={MAX_AI_TOKEN_LIMIT}
                        step={256}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            max_tokens: parseInt(e.target.value, 10) || DEFAULT_AI_MAX_TOKENS,
                          }))
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-mono sm:w-40 ${
                          isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300 bg-white text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className={`shrink-0 text-sm sm:w-24 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                        timeout (s)
                      </label>
                      <input
                        type="number"
                        value={formData.timeout}
                        min={5}
                        max={300}
                        step={5}
                        onChange={e =>
                          setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value, 10) || 60 }))
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-mono sm:w-40 ${
                          isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300 bg-white text-gray-900'
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
  );

  return (
    <AdminLayout>
      <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
        {toastMsg && (
          <div className={`rounded-lg px-3 py-2 text-sm ${
            isDark ? 'bg-rose-400/10 text-rose-200' : 'bg-rose-50 text-rose-700'
          }`}>
            {toastMsg.text}
            <button type="button" onClick={() => setToastMsg(null)} className="ml-3 text-xs underline">&times;</button>
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>模型管理</h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              管理模型接入配置、连通性测试和功能路由。
            </p>
          </div>

          {activeTab === 'providers' && (
            <button
              type="button"
              onClick={handleTestAll}
              disabled={testingAll || models.filter(model => model.enabled).length === 0}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                isDark
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300'
              }`}
            >
              {testingAll ? '测试中...' : '一键测试全部'}
            </button>
          )}
        </div>

        <div
          className={`flex flex-wrap gap-1 rounded-lg p-1 ${
            isDark ? 'bg-slate-800' : 'bg-gray-100'
          } ${isMobileLayout ? 'w-full' : 'w-fit'}`}
        >
          {[
            { key: 'providers', label: 'Provider 配置' },
            { key: 'routing', label: '功能路由' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                isMobileLayout ? 'flex-1' : ''
              } ${
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

        {activeTab === 'routing' && <FeatureModelRouting />}

        {activeTab === 'providers' && (
          <>
            {isMobileLayout && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMobileProviderPanel('catalog')}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    mobileProviderPanel === 'catalog'
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  模型列表
                </button>
                <button
                  type="button"
                  onClick={() => setMobileProviderPanel('editor')}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    mobileProviderPanel === 'editor'
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  配置面板
                </button>
              </div>
            )}

            <div className={`min-h-0 flex-1 ${isMobileLayout ? 'space-y-4' : 'flex gap-5'}`}>
              {(!isMobileLayout || mobileProviderPanel === 'catalog') && renderModelList()}
              {(!isMobileLayout || mobileProviderPanel === 'editor') && renderEditor()}
            </div>
          </>
        )}
      </div>

      {testDetailModal && (() => {
        const result = testResults[testDetailModal];
        if (!result) return null;

        const modalModel = models.find(model => model.id === testDetailModal);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setTestDetailModal(null)}
          >
            <div
              className={`w-full max-w-lg overflow-hidden rounded-xl shadow-xl ${
                isDark ? 'border border-slate-700 bg-slate-800' : 'border border-gray-200 bg-white'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div
                className={`flex items-center justify-between border-b px-5 py-4 ${
                  isDark ? 'border-slate-700' : 'border-gray-100'
                }`}
              >
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>测试结果详情</h3>
                  <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {modalModel?.provider_name ?? testDetailModal}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTestDetailModal(null)}
                  className={`rounded-md p-1.5 ${
                    isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      result.error
                        ? isDark
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-red-50 text-red-600'
                        : isDark
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-green-50 text-green-600'
                    }`}
                  >
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

                {result.error && (
                  <div
                    className={`rounded-lg border p-4 ${
                      isDark ? 'border-red-500/20 bg-red-500/10' : 'border-red-100 bg-red-50'
                    }`}
                  >
                    <p className={`mb-2 text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      错误信息
                    </p>
                    <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                      {formatTestError(result.error)}
                    </p>
                    <details className="mt-2">
                      <summary className={`cursor-pointer text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        原始输出
                      </summary>
                      <pre
                        className={`mt-1 whitespace-pre-wrap break-all text-xs ${
                          isDark ? 'text-slate-400' : 'text-gray-500'
                        }`}
                      >
                        {result.error}
                      </pre>
                    </details>
                  </div>
                )}

                {result.text && (
                  <div
                    className={`rounded-lg border p-4 ${
                      isDark ? 'border-slate-600 bg-slate-700/50' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <p className={`mb-2 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      AI 回复内容
                    </p>
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      {result.text}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={`flex justify-end border-t px-5 py-3 ${
                  isDark ? 'border-slate-700' : 'border-gray-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setTestDetailModal(null)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
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
