/**
 * 功能路由配置面板
 * 为每个 AI 功能单独指定专属模型 Provider
 */
import { useEffect, useState } from 'react';
import api from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
import logger from '../../utils/logger';

const FEATURE_DESC = {
  quiz: '随堂测验题目生成',
  paper: '完整试卷出题',
  learning_map: '知识图谱可视化',
  agent: 'AI 对话助手',
};

const FeatureModelRouting = () => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [configs, setConfigs] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  // { [feature_key]: { saving, saved, error } }
  const [rowState, setRowState] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cfgRes, modelsRes] = await Promise.all([
        api.get('/api/v1/admin/feature-model-configs'),
        api.get('/api/v1/admin/models'),
      ]);
      setConfigs(cfgRes.data);
      setProviders(modelsRes.data.filter(m => m.enabled));
    } catch (err) {
      logger.error('加载功能路由配置失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (featureKey, field, value) => {
    setConfigs(prev =>
      prev.map(c => (c.feature_key === featureKey ? { ...c, [field]: value } : c))
    );
    setRowState(prev => ({ ...prev, [featureKey]: {} }));
  };

  const handleSave = async (config) => {
    const key = config.feature_key;
    setRowState(prev => ({ ...prev, [key]: { saving: true } }));
    try {
      await api.put(`/api/v1/admin/feature-model-configs/${key}`, {
        provider_name: config.provider_name || null,
        enabled: config.enabled,
      });
      setRowState(prev => ({ ...prev, [key]: { saved: true } }));
      setTimeout(() => setRowState(prev => ({ ...prev, [key]: {} })), 2500);
    } catch (err) {
      const msg = err?.response?.data?.detail || '保存失败';
      setRowState(prev => ({ ...prev, [key]: { error: msg } }));
    }
  };

  const inputCls = `flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-white'
      : 'bg-white border-gray-300 text-gray-900'
  }`;

  if (loading) {
    return (
      <div className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        为每个 AI 功能指定专属模型 Provider。选择"系统默认"则按优先级自动选择。
      </p>

      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        {/* 表头 */}
        <div className={`grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase tracking-wider ${
          isDark ? 'bg-slate-800 text-slate-400 border-b border-slate-700' : 'bg-gray-50 text-gray-500 border-b border-gray-200'
        }`}>
          <span className="col-span-3">功能</span>
          <span className="col-span-3">说明</span>
          <span className="col-span-3">专属 Provider</span>
          <span className="col-span-1 text-center">启用</span>
          <span className="col-span-2 text-right">操作</span>
        </div>

        {configs.map((config, idx) => {
          const state = rowState[config.feature_key] || {};
          const isLast = idx === configs.length - 1;

          return (
            <div
              key={config.feature_key}
              className={`grid grid-cols-12 items-center px-5 py-4 gap-3 ${
                !isLast ? (isDark ? 'border-b border-slate-800' : 'border-b border-gray-100') : ''
              } ${isDark ? 'bg-slate-900' : 'bg-white'}`}
            >
              {/* 功能名 */}
              <div className="col-span-3">
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {config.feature_label}
                </span>
                <p className={`text-xs mt-0.5 font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {config.feature_key}
                </p>
              </div>

              {/* 说明 */}
              <div className="col-span-3">
                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {FEATURE_DESC[config.feature_key] || '—'}
                </span>
              </div>

              {/* Provider 下拉 */}
              <div className="col-span-3">
                <select
                  value={config.provider_name || ''}
                  onChange={e => handleChange(config.feature_key, 'provider_name', e.target.value || null)}
                  className={inputCls}
                >
                  <option value="">系统默认（按优先级）</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.provider_name}>
                      {p.provider_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 启用开关 */}
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => handleChange(config.feature_key, 'enabled', !config.enabled)}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${
                    config.enabled ? 'bg-blue-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                    config.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* 保存按钮 + 状态 */}
              <div className="col-span-2 flex items-center justify-end gap-2">
                {state.saved && (
                  <span className="text-xs text-green-500">已保存</span>
                )}
                {state.error && (
                  <span className="text-xs text-red-500 truncate max-w-[80px]" title={state.error}>
                    {state.error}
                  </span>
                )}
                <button
                  onClick={() => handleSave(config)}
                  disabled={state.saving}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    state.saving
                      ? isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {state.saving ? '保存中' : '保存'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
        注意：仅"启用"状态下的 Provider 可被选择。配置保存后立即生效（60 秒缓存）。
      </p>
    </div>
  );
};

export default FeatureModelRouting;
