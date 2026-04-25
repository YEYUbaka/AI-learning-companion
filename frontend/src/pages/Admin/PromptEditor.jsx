/**
 * Prompt 编辑器页面
 * 目的：按系统/AI功能管理 Prompt，并支持移动端分段查看
 */
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
import logger from '../../utils/logger';

const getIsMobileLayout = () => typeof window !== 'undefined' && window.innerWidth < 1280;

const PROMPT_FEATURE_META = {
  system_prompt: {
    system: 'Agent系统',
    feature: '结构化 Agent',
    summary: '负责工具执行后的最终回答整合与通用兜底。',
    scene: 'Agent 执行 / Function Calling / 通用 AI 入口',
  },
  chat_system_prompt: {
    system: 'AI对话',
    feature: '聊天问答',
    summary: '负责前台 AI 对话、学科答疑和 Markdown 友好输出。',
    scene: 'AI 聊天 / 学科解释 / 学习建议',
  },
  study_plan_generator_prompt: {
    system: '学习计划',
    feature: '计划生成',
    summary: '把学习目标拆解成按天执行的任务清单。',
    scene: '学习计划页 / 学习目标拆解',
  },
  learning_map_system: {
    system: '知识图谱',
    feature: '学习地图生成',
    summary: '约束知识图谱结果只返回稳定的结构化 JSON。',
    scene: '知识图谱 / 学习地图',
  },
  quiz_generator_prompt: {
    system: '智能测试',
    feature: '常规测评组题',
    summary: '生成在线答题场景下的小型测验或练习题。',
    scene: '常规测评 / 章节练习 / 在线答题',
  },
  paper_question_generation_prompt: {
    system: '智能组卷',
    feature: '试卷题目生成',
    summary: '根据试卷蓝图批量生成正式题目与答案信息。',
    scene: '教师卷 / 练习卷 / 智能组卷',
  },
  answer_evaluation_prompt: {
    system: '智能测试',
    feature: '交卷后复盘',
    summary: '统一输出得分、逐题解析和学习建议。',
    scene: '测评结果页 / AI 复盘',
  },
};

const getPromptMeta = (name, description = '') => {
  if (PROMPT_FEATURE_META[name]) {
    return PROMPT_FEATURE_META[name];
  }

  if (name.includes('plan')) {
    return {
      system: '学习计划',
      feature: '未归类计划能力',
      summary: description || '与学习计划相关的提示词。',
      scene: '学习目标规划',
    };
  }

  if (name.includes('map')) {
    return {
      system: '知识图谱',
      feature: '未归类图谱能力',
      summary: description || '与知识图谱或学习地图相关的提示词。',
      scene: '知识结构整理',
    };
  }

  if (name.includes('paper')) {
    return {
      system: '智能组卷',
      feature: '未归类组卷能力',
      summary: description || '与试卷生成或组卷相关的提示词。',
      scene: '组卷流程',
    };
  }

  if (name.includes('quiz') || name.includes('evaluation')) {
    return {
      system: '智能测试',
      feature: '未归类测评能力',
      summary: description || '与测评出题或结果分析相关的提示词。',
      scene: '在线测评',
    };
  }

  return {
    system: '未归类',
    feature: '待补充归属',
    summary: description || '这条提示词尚未配置系统归属说明。',
    scene: '待确认',
  };
};

const MobilePanelTabs = ({ active, onChange, isDark }) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {[
      { key: 'features', label: '功能' },
      { key: 'versions', label: '版本' },
      { key: 'detail', label: '详情' },
    ].map((panel) => (
      <button
        key={panel.key}
        type="button"
        onClick={() => onChange(panel.key)}
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          active === panel.key
            ? 'bg-blue-600 text-white'
            : isDark
              ? 'bg-slate-900 text-slate-300'
              : 'bg-white border border-slate-200 text-slate-600'
        }`}
      >
        {panel.label}
      </button>
    ))}
  </div>
);

const PromptEditor = () => {
  const [prompts, setPrompts] = useState([]);
  const [selectedPromptName, setSelectedPromptName] = useState('');
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
  const [mobilePanel, setMobilePanel] = useState('features');
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    description: '',
    enabled: true,
  });
  const [editData, setEditData] = useState({
    description: '',
    content: '',
    enabled: true,
  });

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            pageNote: 'text-slate-400',
            heading: 'text-slate-50',
            card: 'border border-slate-800 bg-slate-900/85 text-white',
            cardSoft: 'border border-slate-800 bg-slate-950/40',
            buttonPrimary:
              'inline-flex items-center rounded-md bg-[#325a79] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3b688c]',
            buttonGhost:
              'inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800',
            listActive: 'border-[#5b85a5] bg-[#132334] text-white',
            listInactive: 'border-slate-800 bg-slate-950/40 text-white hover:border-slate-700 hover:bg-slate-900/70',
            badgePrimary: 'border border-sky-700/40 bg-sky-500/10 text-sky-200',
            badgeNeutral: 'border border-slate-700 bg-slate-900/80 text-slate-300',
            input:
              'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-[#5b85a5] focus:outline-none focus:ring-2 focus:ring-[#5b85a5]/15',
            textarea:
              'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-[#5b85a5] focus:outline-none focus:ring-2 focus:ring-[#5b85a5]/15',
            muted: 'text-slate-500',
            empty: 'text-slate-400',
            divider: 'border-slate-800',
            danger: 'text-red-300 hover:text-red-100',
            code: 'border-slate-800 bg-slate-950/70 text-slate-100',
          }
        : {
            pageNote: 'text-slate-500',
            heading: 'text-slate-900',
            card: 'border border-slate-200 bg-white text-slate-900',
            cardSoft: 'border border-slate-200 bg-slate-50/70',
            buttonPrimary:
              'inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700',
            buttonGhost:
              'inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50',
            listActive: 'border-blue-500 bg-blue-50 text-slate-900',
            listInactive: 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50',
            badgePrimary: 'border border-blue-200 bg-blue-50 text-blue-700',
            badgeNeutral: 'border border-slate-200 bg-slate-100 text-slate-600',
            input:
              'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/12',
            textarea:
              'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/12',
            muted: 'text-slate-400',
            empty: 'text-slate-500',
            divider: 'border-slate-200',
            danger: 'text-red-600 hover:text-red-800',
            code: 'border-slate-200 bg-slate-50 text-slate-800',
          },
    [isDark]
  );

  const fetchPrompts = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.get('/api/v1/admin/prompts');
      setPrompts(response.data || []);
    } catch (err) {
      logger.error('获取 Prompt 列表失败', err);
      setError(err.response?.data?.detail || err.message || '获取 Prompt 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async (name) => {
    try {
      const response = await api.get(`/api/v1/admin/prompts/name/${name}`);
      const nextVersions = (response.data || []).sort((a, b) => b.version - a.version);
      setVersions(nextVersions);

      if (nextVersions.length > 0) {
        const current = nextVersions.find((item) => item.enabled) || nextVersions[0];
        setSelectedVersion(current);
        setEditData({
          description: current.description || '',
          content: current.content || '',
          enabled: current.enabled,
        });
      } else {
        setSelectedVersion(null);
        setEditData({ description: '', content: '', enabled: true });
      }
    } catch (err) {
      logger.error('获取 Prompt 版本失败', err);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobileLayout(getIsMobileLayout());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const promptGroups = useMemo(() => {
    const grouped = prompts.reduce((acc, prompt) => {
      if (!acc[prompt.name]) {
        acc[prompt.name] = [];
      }
      acc[prompt.name].push(prompt);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, items]) => {
        const ordered = [...items].sort((a, b) => b.version - a.version);
        const latest = ordered[0];
        const activeVersion = ordered.find((item) => item.enabled) || latest;
        const meta = getPromptMeta(name, latest?.description);
        return {
          name,
          items: ordered,
          latest,
          activeVersion,
          versionCount: ordered.length,
          meta,
        };
      })
      .sort((a, b) => {
        const systemCompare = a.meta.system.localeCompare(b.meta.system, 'zh-CN');
        if (systemCompare !== 0) return systemCompare;
        return a.meta.feature.localeCompare(b.meta.feature, 'zh-CN');
      });
  }, [prompts]);

  const groupedBySystem = useMemo(
    () =>
      promptGroups.reduce((acc, item) => {
        if (!acc[item.meta.system]) {
          acc[item.meta.system] = [];
        }
        acc[item.meta.system].push(item);
        return acc;
      }, {}),
    [promptGroups]
  );

  const coverageStats = useMemo(() => {
    const systems = new Set(promptGroups.map((item) => item.meta.system));
    const activeFeatures = promptGroups.filter((item) => item.activeVersion?.enabled).length;
    return {
      totalFeatures: promptGroups.length,
      totalVersions: prompts.length,
      totalSystems: systems.size,
      activeFeatures,
    };
  }, [promptGroups, prompts]);

  useEffect(() => {
    if (!promptGroups.length) return;

    const stillExists = promptGroups.some((item) => item.name === selectedPromptName);
    if (!selectedPromptName || !stillExists) {
      const fallback = promptGroups[0];
      setSelectedPromptName(fallback.name);
      setSelectedVersion(null);
      setIsEditing(false);
      void fetchVersions(fallback.name);
    }
  }, [promptGroups, selectedPromptName]);

  const selectedPrompt = useMemo(
    () => promptGroups.find((item) => item.name === selectedPromptName) || null,
    [promptGroups, selectedPromptName]
  );

  const handleSelectPrompt = (promptName) => {
    setSelectedPromptName(promptName);
    setSelectedVersion(null);
    setIsEditing(false);
    if (getIsMobileLayout()) {
      setMobilePanel('versions');
    }
    void fetchVersions(promptName);
  };

  const handleSelectVersion = (version) => {
    setSelectedVersion(version);
    setIsEditing(false);
    if (getIsMobileLayout()) {
      setMobilePanel('detail');
    }
    setEditData({
      description: version.description || '',
      content: version.content || '',
      enabled: version.enabled,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/admin/prompts', formData);
      setShowForm(false);
      setFormData({ name: '', content: '', description: '', enabled: true });
      await fetchPrompts();
    } catch (err) {
      alert('创建失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEnableVersion = async (name, version) => {
    try {
      await api.post(`/api/v1/admin/prompts/${name}/enable/${version}`);
      await fetchVersions(name);
      await fetchPrompts();
      alert('已启用该版本');
    } catch (err) {
      alert('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个 Prompt 版本吗？')) return;
    try {
      await api.delete(`/api/v1/admin/prompts/${id}`);
      await fetchPrompts();
      if (selectedPromptName) {
        await fetchVersions(selectedPromptName);
      }
    } catch (err) {
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateVersion = async (e) => {
    e.preventDefault();
    if (!selectedVersion) return;

    try {
      setSaving(true);
      await api.put(`/api/v1/admin/prompts/${selectedVersion.id}`, {
        description: editData.description,
        content: editData.content,
        enabled: editData.enabled,
      });
      await fetchVersions(selectedVersion.name);
      await fetchPrompts();
      setIsEditing(false);
    } catch (err) {
      alert('保存失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: '功能提示词', value: coverageStats.totalFeatures, hint: '按功能去重后统计' },
    { label: '提示词版本', value: coverageStats.totalVersions, hint: '包含所有历史版本' },
    { label: '覆盖系统', value: coverageStats.totalSystems, hint: `${coverageStats.activeFeatures} 条功能当前启用中` },
  ];

  const renderFeatureList = () => (
    <div className={`flex flex-col rounded-md ${palette.card}`}>
      <div className={`border-b px-4 py-4 ${palette.divider}`}>
        <h3 className="font-semibold">功能清单</h3>
        <p className={`mt-1 text-sm ${palette.pageNote}`}>按系统归类查看当前已管理的提示词</p>
      </div>

      <div className="space-y-5 p-4">
        {loading ? (
          <div className={`py-8 text-center ${palette.empty}`}>加载中...</div>
        ) : error ? (
          <div className={`space-y-3 py-8 text-center ${palette.empty}`}>
            <p className="text-red-500">错误：{error}</p>
            <button onClick={fetchPrompts} className={palette.buttonPrimary}>
              重试
            </button>
          </div>
        ) : promptGroups.length === 0 ? (
          <div className={`py-8 text-center ${palette.empty}`}>
            <p>暂无 Prompt</p>
            <p className="mt-2 text-xs">创建后会自动按系统归档显示</p>
          </div>
        ) : (
          Object.entries(groupedBySystem).map(([system, items]) => (
            <section key={system}>
              <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>
                {system}
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectPrompt(item.name)}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selectedPromptName === item.name ? palette.listActive : palette.listInactive
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{item.meta.feature}</div>
                        <div className={`mt-1 break-all font-mono text-[11px] ${palette.pageNote}`}>
                          {item.name}
                        </div>
                        <div className={`mt-2 text-xs leading-5 ${palette.pageNote}`}>
                          {item.meta.summary}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${item.activeVersion?.enabled ? palette.badgePrimary : palette.badgeNeutral}`}>
                        {item.activeVersion?.enabled ? '启用中' : '未启用'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-md px-2 py-1 text-[11px] ${palette.badgeNeutral}`}>
                        {item.versionCount} 个版本
                      </span>
                      <span className={`rounded-md px-2 py-1 text-[11px] ${palette.badgeNeutral}`}>
                        {item.meta.scene}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );

  const renderVersionList = () => (
    <div className={`rounded-md ${palette.card}`}>
      <div className={`border-b px-4 py-4 ${palette.divider}`}>
        <h3 className="font-semibold">
          {selectedPrompt ? `${selectedPrompt.meta.feature} · 版本` : '版本列表'}
        </h3>
        <p className={`mt-1 text-sm ${palette.pageNote}`}>查看历史版本并切换当前启用版本</p>
      </div>

      <div className="max-h-[42rem] space-y-3 overflow-y-auto p-4">
        {selectedPrompt ? (
          versions.length > 0 ? (
            versions.map((version) => (
              <div
                key={version.id}
                className={`rounded-md border p-4 transition ${
                  selectedVersion?.id === version.id ? palette.listActive : palette.listInactive
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectVersion(version)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">版本 {version.version}</div>
                      <div className={`mt-1 text-xs ${palette.pageNote}`}>
                        {version.description || '未填写描述'}
                      </div>
                    </div>
                    <span className={`rounded-md px-2 py-1 text-[11px] ${version.enabled ? palette.badgePrimary : palette.badgeNeutral}`}>
                      {version.enabled ? '当前版本' : '历史版本'}
                    </span>
                  </div>

                  <div className={`mt-3 text-xs ${palette.pageNote}`}>
                    {new Date(version.updated_at || version.created_at).toLocaleString()}
                  </div>
                </button>

                {!version.enabled && (
                  <button
                    type="button"
                    onClick={() => handleEnableVersion(version.name, version.version)}
                    className="mt-3 w-full rounded-md border border-blue-500/30 px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  >
                    启用该版本
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className={`py-8 text-center ${palette.empty}`}>暂无版本记录</div>
          )
        ) : (
          <div className={`py-8 text-center ${palette.empty}`}>请先从左侧选择一个功能 Prompt</div>
        )}
      </div>
    </div>
  );

  const renderDetailPanel = () => (
    <div className={`rounded-md ${palette.card}`}>
      <div className={`border-b px-4 py-4 ${palette.divider}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-semibold">版本详情</h3>
            <p className={`mt-1 text-sm ${palette.pageNote}`}>
              {selectedPrompt
                ? `当前查看：${selectedPrompt.meta.system} / ${selectedPrompt.meta.feature}`
                : '选择左侧 Prompt 查看详情'}
            </p>
          </div>

          {selectedVersion && (
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className={palette.buttonGhost}
            >
              {isEditing ? '取消编辑' : '编辑内容'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {selectedPrompt && (
          <div className={`rounded-md p-4 ${palette.cardSoft}`}>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>所属系统</div>
                <div className="mt-2 text-sm font-semibold">{selectedPrompt.meta.system}</div>
              </div>
              <div>
                <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>功能名称</div>
                <div className="mt-2 text-sm font-semibold">{selectedPrompt.meta.feature}</div>
              </div>
              <div>
                <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>使用场景</div>
                <div className="mt-2 text-sm font-semibold">{selectedPrompt.meta.scene}</div>
              </div>
            </div>

            <div className={`mt-4 border-t pt-4 ${palette.divider}`}>
              <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>Prompt 名称</div>
              <div className={`mt-2 break-all font-mono text-sm ${palette.pageNote}`}>{selectedPrompt.name}</div>
              <div className={`mt-3 text-sm leading-6 ${palette.pageNote}`}>{selectedPrompt.meta.summary}</div>
            </div>
          </div>
        )}

        {selectedVersion ? (
          isEditing ? (
            <form onSubmit={handleUpdateVersion} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">描述</label>
                <input
                  type="text"
                  value={editData.description}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className={palette.input}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">内容</label>
                <textarea
                  value={editData.content}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, content: e.target.value }))
                  }
                  rows={18}
                  className={`${palette.textarea} font-mono text-sm`}
                  required
                />
              </div>

              <label className={`flex items-center gap-2 text-sm ${palette.pageNote}`}>
                <input
                  type="checkbox"
                  checked={editData.enabled}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
                启用该版本
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className={palette.buttonPrimary}>
                  {saving ? '保存中...' : '保存修改'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({
                      description: selectedVersion.description || '',
                      content: selectedVersion.content || '',
                      enabled: selectedVersion.enabled,
                    });
                  }}
                  className={palette.buttonGhost}
                >
                  取消
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-md p-4 ${palette.cardSoft}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>版本说明</div>
                    <div className="mt-2 text-sm leading-6">
                      {selectedVersion.description || '未填写描述'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-md px-2 py-1 text-[11px] ${selectedVersion.enabled ? palette.badgePrimary : palette.badgeNeutral}`}>
                      {selectedVersion.enabled ? '已启用' : '未启用'}
                    </span>
                    <span className={`rounded-md px-2 py-1 text-[11px] ${palette.badgeNeutral}`}>
                      版本 {selectedVersion.version}
                    </span>
                  </div>
                </div>

                <div className={`mt-4 border-t pt-4 text-xs ${palette.pageNote} ${palette.divider}`}>
                  最近更新：{new Date(selectedVersion.updated_at || selectedVersion.created_at).toLocaleString()}
                </div>
              </div>

              <div>
                <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>Prompt 内容</div>
                <pre
                  className={`mt-2 max-h-[32rem] overflow-auto rounded-md border p-4 text-sm whitespace-pre-wrap ${palette.code}`}
                >
                  {selectedVersion.content}
                </pre>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!selectedVersion.enabled && (
                  <button
                    type="button"
                    onClick={() => handleEnableVersion(selectedVersion.name, selectedVersion.version)}
                    className={palette.buttonPrimary}
                  >
                    启用该版本
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(selectedVersion.id)}
                  className={`text-sm font-medium ${palette.danger}`}
                >
                  删除当前版本
                </button>
              </div>
            </div>
          )
        ) : (
          <div className={`py-8 text-center ${palette.empty}`}>请选择一个版本查看详情</div>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className={`text-sm ${palette.pageNote}`}>系统 Prompt 与 AI 功能提示词管理</p>
            <h2 className={`text-2xl font-bold ${palette.heading}`}>Prompt 管理</h2>
            <p className={`mt-2 max-w-3xl text-sm ${palette.pageNote}`}>
              后台不再只是显示一个 prompt name，而是按“系统 / 功能 / 场景”来管理，方便后续针对单个 AI 功能独立调优。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowForm(true)} className={palette.buttonPrimary}>
              创建 Prompt
            </button>
            <button onClick={fetchPrompts} className={palette.buttonGhost}>
              刷新
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {statCards.map((item) => (
            <div key={item.label} className={`rounded-md p-4 ${palette.card}`}>
              <div className={`text-xs uppercase tracking-[0.16em] ${palette.muted}`}>{item.label}</div>
              <div className={`mt-2 text-3xl font-bold ${palette.heading}`}>{item.value}</div>
              <div className={`mt-2 text-sm ${palette.pageNote}`}>{item.hint}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className={`rounded-md p-5 ${palette.card}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">创建新 Prompt</h3>
                <p className={`mt-1 text-sm ${palette.pageNote}`}>
                  建议先确认功能归属，再创建对应名称，避免不同功能复用同一条提示词。
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Prompt 名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={palette.input}
                    placeholder="例如：paper_question_generation_prompt"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={palette.input}
                    placeholder="说明这条提示词属于哪个功能、解决什么问题"
                  />
                </div>

                <label className={`flex items-center gap-2 text-sm ${palette.pageNote}`}>
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  创建后立即启用
                </label>

                <div className="flex flex-wrap gap-3">
                  <button type="submit" className={palette.buttonPrimary}>
                    创建
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className={palette.buttonGhost}>
                    取消
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className={`${palette.textarea} min-h-[280px] font-mono text-sm`}
                  placeholder="在这里输入 Prompt 内容"
                  required
                />
              </div>
            </form>
          </div>
        )}

        {isMobileLayout ? (
          <div className="space-y-4">
            <MobilePanelTabs active={mobilePanel} onChange={setMobilePanel} isDark={isDark} />
            {(mobilePanel === 'features' || !selectedPrompt) && renderFeatureList()}
            {mobilePanel === 'versions' && renderVersionList()}
            {mobilePanel === 'detail' && renderDetailPanel()}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_280px_minmax(0,1fr)] xl:items-start">
            {renderFeatureList()}
            {renderVersionList()}
            {renderDetailPanel()}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default PromptEditor;
