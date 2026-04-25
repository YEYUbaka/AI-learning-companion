import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/apiClient';
import { AppBadge } from '../components/ui/AppBadge';
import { useThemeStore } from '../store/themeStore';
import { getUserId } from '../utils/auth';
import logger from '../utils/logger';

function StudyPlan() {
  const location = useLocation();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedDays, setCompletedDays] = useState(new Set());
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formGoal, setFormGoal] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (location.state?.plan) {
      setPlan(location.state.plan);
      loadCompletedDays(location.state.plan.id);
    } else {
      loadLatestPlan();
    }
  }, [location]);

  useEffect(() => {
    setExpandedDays(new Set());
  }, [plan?.id]);

  const scrollToSection = (id) => {
    if (typeof document === 'undefined') return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const loadLatestPlan = async () => {
    setLoading(true);
    setError('');
    try {
      const userId = getUserId();
      const response = await api.get(`/api/v1/ai/plan/list/${userId}`);
      if (response.data?.length > 0) {
        setPlan(response.data[0]);
        loadCompletedDays(response.data[0].id);
      } else {
        setPlan(null);
        setCompletedDays(new Set());
        setShowCreateForm(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!formGoal.trim()) {
      setError('请输入学习目标');
      return;
    }

    setGenerating(true);
    setError('');
    try {
      const userId = getUserId();
      const response = await api.post(
        '/api/v1/ai/plan/generate',
        {
          user_id: userId,
          goals: formGoal.trim(),
        },
        { timeout: 120000 },
      );

      setPlan(response.data);
      setCompletedDays(new Set());
      setExpandedDays(new Set());
      setShowCreateForm(false);
      setFormGoal('');
    } catch (err) {
      setError(err.response?.data?.detail || '生成失败，请检查 AI 模型配置');
    } finally {
      setGenerating(false);
    }
  };

  const loadCompletedDays = (planId) => {
    const saved = localStorage.getItem(`plan_${planId}_completed`);
    if (!saved) {
      setCompletedDays(new Set());
      return;
    }

    try {
      setCompletedDays(new Set(JSON.parse(saved)));
    } catch (e) {
      logger.error('加载完成状态失败', e);
      setCompletedDays(new Set());
    }
  };

  const toggleDayCompletion = (day) => {
    const next = new Set(completedDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setCompletedDays(next);

    if (plan) {
      localStorage.setItem(`plan_${plan.id}_completed`, JSON.stringify(Array.from(next)));
    }
  };

  const toggleDay = (day) => {
    const next = new Set(expandedDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setExpandedDays(next);
  };

  const getCurrentTask = () => {
    if (!plan?.plan) return null;
    for (const item of plan.plan) {
      if (!completedDays.has(item.day)) return item;
    }
    return null;
  };

  const planData = plan?.plan || [];
  const totalDays = planData.length;
  const completed = completedDays.size;
  const remaining = Math.max(totalDays - completed, 0);
  const progress = totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;
  const totalTasks = planData.reduce((sum, item) => sum + (item.tasks?.length || 0), 0);
  const currentTask = getCurrentTask();
  const nextTask = currentTask
    ? planData.find((item) => item.day > currentTask.day && !completedDays.has(item.day))
    : null;
  const previousTask = [...planData].reverse().find((item) => completedDays.has(item.day)) || null;
  const upcomingDays = planData.filter((item) => !completedDays.has(item.day)).slice(0, 3);

  const getTaskPreview = (tasks = [], count = 2) => tasks.slice(0, count).join('、');
  const currentPreview = getTaskPreview(currentTask?.tasks);
  const previousPreview = getTaskPreview(previousTask?.tasks);
  const nextPreview = getTaskPreview(nextTask?.tasks);

  const heroTitle = plan?.goal || '把学习目标整理成一条更清晰、更容易执行的学习路径';
  const heroText = plan
    ? progress === 100
      ? '这一轮已经完整收尾，现在更适合做一次回顾总结，或者顺势开启下一轮更进阶的学习计划。'
      : currentTask
        ? `系统已经把目标拆成 ${totalDays} 天的节奏。现在只需要盯住第 ${currentTask.day} 天，把今天的重点先完成。`
        : '学习路径已经生成完成，可以直接从第一天开始推进。'
    : '输入目标后，系统会自动识别周期信息，把教材内容整理成更有节奏感的每日学习计划。';

  const heroHighlights = [
    { label: '学习周期', value: plan ? `${totalDays} 天` : '自动规划' },
    { label: '累计任务', value: plan ? `${totalTasks} 项` : '拆分重点' },
    { label: '当前进度', value: plan ? `${progress}%` : '待开始' },
  ];

  const overviewStats = [
    { label: '已完成', value: completed },
    { label: '剩余天数', value: remaining },
    { label: '任务总数', value: totalTasks },
    { label: '当前焦点', value: currentTask ? `Day ${currentTask.day}` : (plan ? '已完成' : '--') },
  ];

  const knowledgeSuggestions = plan
    ? progress === 100
      ? [
        {
          label: '知识回收',
          title: planData.at(-1)?.topic || '整轮内容复盘',
          detail: '把这轮学过的主题压缩成一页自己的知识清单，优先记录真正掌握的方法和易错点。',
        },
        {
          label: '重点回忆',
          title: previousTask?.topic || '回看整轮关键节点',
          detail: previousPreview
            ? `优先回想 ${previousPreview}，确认自己不是做完任务，而是真的记住了知识。`
            : '从最后完成的一天开始回忆，把已经模糊的概念先补齐。',
        },
        {
          label: '下一轮入口',
          title: '挑一个薄弱点继续深入',
          detail: '下一轮不要重做整页内容，而是从这轮最不稳的一个知识点继续往下走。',
        },
      ]
      : currentTask
        ? [
          {
            label: '当前知识点',
            title: currentTask.topic,
            detail: currentPreview
              ? `今天先吃透 ${currentPreview}，把注意力收在这一个主题里。`
              : '先把今天这一块主题学透，再看后面的内容。',
          },
          {
            label: '衔接复习',
            title: previousTask?.topic || '补上前置知识',
            detail: previousTask
              ? (previousPreview
                ? `开始新内容前，先用 5 分钟回忆 ${previousPreview}，把旧知识接起来。`
                : `先快速回顾上一天的「${previousTask.topic}」，再进入今天主题。`)
              : '这是当前计划的起点，先把基础概念和任务顺序建立起来。',
          },
          {
            label: '提前预热',
            title: nextTask?.topic || '完成后做收尾复盘',
            detail: nextTask
              ? (nextPreview
                ? `今天完成后会切到 ${nextPreview}，提前知道下一跳会更顺。`
                : `今天结束后会进入「${nextTask.topic}」，可以先知道知识会怎么展开。`)
              : '今天完成后，顺手写 3 条笔记，明天接续时会更轻松。',
          },
        ]
        : [
          {
            label: '起步建议',
            title: '先执行第一天',
            detail: '学习路径已经生成，先从第一天开始，不要一上来就展开所有任务。',
          },
          {
            label: '记录方式',
            title: '边学边留痕',
            detail: '每完成一天就勾选，并顺手写一句自己的理解，后面复习会轻松很多。',
          },
          {
            label: '计划调整',
            title: '目标变化就重生',
            detail: '如果教材或目标变了，重新生成一份更贴合的新计划，比硬改旧路径更清晰。',
          },
        ]
    : [
      {
        label: '目标描述',
        title: '先写清教材和周期',
        detail: '教材范围、时间周期、预期结果越清楚，系统拆出来的知识点就越贴合你。',
      },
      {
        label: '拆解方式',
        title: '让计划按知识点切开',
        detail: '可以直接写“先学什么、再学什么”，这样生成结果会更像真实课程结构。',
      },
      {
        label: '迭代节奏',
        title: '先生成第一版再微调',
        detail: '先拿到一版路径，再根据你真实的学习反馈调整，会比一开始追求完美更有效。',
      },
    ];

  const pageBg = isDark ? 'bg-[#0b1220]' : 'bg-[#f3f7fc]';
  const pageGlow = isDark
    ? 'bg-[radial-gradient(circle_at_top,_rgba(53,91,141,0.22),_transparent_42%)]'
    : 'bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_42%)]';
  const shellCard = isDark
    ? 'border-slate-800 bg-[#0f1728]/92 shadow-[0_24px_60px_rgba(0,0,0,0.32)]'
    : 'border-white/70 bg-white/92 shadow-[0_18px_50px_rgba(15,23,42,0.08)]';
  const panelCard = isDark
    ? 'border-slate-700/80 bg-slate-900/70'
    : 'border-slate-200/80 bg-slate-50/85';
  const timelineCard = isDark
    ? 'border-slate-700/70 bg-slate-900/65'
    : 'border-slate-200 bg-white';
  const activeTimelineCard = isDark
    ? 'border-sky-500/30 bg-sky-500/10'
    : 'border-sky-200 bg-sky-50/80';
  const doneTimelineCard = isDark
    ? 'border-emerald-500/25 bg-emerald-500/10'
    : 'border-emerald-200 bg-emerald-50/80';
  const titleText = isDark ? 'text-slate-50' : 'text-slate-900';
  const bodyText = isDark ? 'text-slate-300' : 'text-slate-600';
  const mutedText = isDark ? 'text-slate-500' : 'text-slate-400';
  const primaryButton = isDark
    ? 'bg-[#325a79] text-white hover:bg-[#3d6b8e]'
    : 'bg-slate-900 text-white hover:bg-slate-800';
  const secondaryButton = isDark
    ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800'
    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
  const progressTrack = isDark ? 'bg-slate-800' : 'bg-slate-200';
  const progressFill = progress === 100 ? 'bg-emerald-500' : 'bg-sky-600';
  const badgeClass = isDark
    ? 'border-slate-700 bg-slate-900/80 text-slate-200'
    : 'border-slate-200 bg-white text-slate-600';
  const warmBadgeClass = isDark
    ? 'border-amber-700/40 bg-amber-500/10 text-amber-200'
    : 'border-amber-200 bg-amber-50 text-amber-700';
  const successBadgeClass = isDark
    ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const heroAccent = isDark
    ? 'bg-[linear-gradient(135deg,rgba(50,90,121,0.28),rgba(13,24,40,0.08))]'
    : 'bg-[linear-gradient(135deg,rgba(219,234,254,0.9),rgba(255,255,255,0.82))]';
  const shellRadius = 'rounded-[22px]';
  const heroRadius = 'rounded-[24px]';
  const panelRadius = 'rounded-[16px]';
  const itemRadius = 'rounded-[14px]';

  if (loading) {
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <div className={`min-h-screen ${pageGlow}`}>
          <div className="container-xl px-4 py-6 sm:py-8">
            <div className="animate-pulse space-y-6">
              <div className={`h-72 ${heroRadius} ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div className={`h-80 ${shellRadius} ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  <div className={`h-[44rem] ${shellRadius} ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                </div>
                <div className="space-y-6">
                  <div className={`h-56 ${shellRadius} ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  <div className={`h-72 ${shellRadius} ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !plan && !showCreateForm) {
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <div className={`min-h-screen ${pageGlow}`}>
          <div className="container-xl px-4 py-8">
            <div className={`${shellCard} ${shellRadius} mx-auto max-w-2xl border p-8 text-center`}>
              <h2 className={`text-2xl font-bold ${titleText}`}>暂时还没有学习计划</h2>
              <p className={`mt-3 ${bodyText}`}>{error}</p>
              <button
                onClick={() => {
                  setError('');
                  setShowCreateForm(true);
                }}
                className={`mt-6 rounded-2xl px-6 py-3 text-sm font-semibold transition-colors ${primaryButton}`}
              >
                创建学习计划
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!plan && !showCreateForm) return null;

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className={`min-h-screen ${pageGlow}`}>
        <div className="container-xl px-4 py-5 sm:py-8">
          <div className="space-y-6">
            <section
              id="study-plan-hero"
              className={`${shellCard} ${heroAccent} ${heroRadius} relative overflow-hidden border px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10`}
            >
              <div className={`absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl ${isDark ? 'bg-sky-500/15' : 'bg-sky-200/50'}`} />
              <div className={`absolute bottom-0 left-0 h-32 w-32 rounded-full blur-3xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-100/70'}`} />

              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:items-start">
                <div className="min-w-0">
                  <AppBadge variant="neutral" size="md" className={badgeClass}>
                    学习计划
                  </AppBadge>
                  <h1 className={`mt-4 max-w-4xl text-3xl font-bold leading-tight break-words sm:text-4xl lg:text-[3.1rem] lg:leading-[1.08] ${titleText}`}>
                    {heroTitle}
                  </h1>
                  <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${bodyText}`}>
                    {heroText}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {heroHighlights.map((item) => (
                      <div key={item.label} className={`${panelCard} ${panelRadius} border px-4 py-3`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mutedText}`}>
                          {item.label}
                        </div>
                        <div className={`mt-1 text-lg font-semibold ${titleText}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => {
                        if (!plan) {
                          setShowCreateForm(true);
                          scrollToSection('study-plan-form');
                        } else if (progress === 100 || !currentTask) {
                          scrollToSection('study-path-section');
                        } else {
                          scrollToSection('current-task-section');
                        }
                      }}
                      className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${primaryButton}`}
                    >
                      {!plan ? '创建学习计划' : progress === 100 ? '回顾完整路径' : currentTask ? '继续今天的学习' : '查看学习路径'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(true);
                        setError('');
                        scrollToSection('study-plan-form');
                      }}
                      className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${secondaryButton}`}
                    >
                      新建计划
                    </button>
                  </div>
                </div>

                <aside className={`${shellCard} ${shellRadius} border p-5 sm:p-6`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-sm font-medium ${mutedText}`}>当前焦点</div>
                      <div className={`mt-2 text-2xl font-bold ${titleText}`}>
                        {currentTask ? `第 ${currentTask.day} 天` : (plan ? '本轮完成' : '等待生成')}
                      </div>
                    </div>
                    <AppBadge
                      variant={progress === 100 ? 'success' : 'warning'}
                      size="md"
                      className={progress === 100 ? successBadgeClass : warmBadgeClass}
                    >
                      {plan ? `${progress}%` : '未开始'}
                    </AppBadge>
                  </div>

                  <p className={`mt-4 text-sm leading-7 ${bodyText}`}>
                    {currentTask?.topic || (plan ? '当前计划已经全部完成，可以直接开始下一轮目标。' : '先输入一个明确的学习目标，系统会自动帮你拆分节奏。')}
                  </p>

                  <div className={`mt-5 h-2 rounded-full ${progressTrack}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressFill}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className={`${panelCard} ${panelRadius} border p-4`}>
                      <div className={`text-xs font-medium ${mutedText}`}>今日建议</div>
                      <div className={`mt-2 text-sm leading-7 ${titleText}`}>
                        {currentTask ? '先完成今天的重点，再决定是否提前看后面的内容。' : '这轮内容已经结束，适合做一次完整复盘。'}
                      </div>
                    </div>
                    <div className={`${panelCard} ${panelRadius} border p-4`}>
                      <div className={`text-xs font-medium ${mutedText}`}>下一步</div>
                      <div className={`mt-2 text-sm leading-7 ${titleText}`}>
                        {nextTask ? `完成后进入「${nextTask.topic}」` : (plan ? '可以新建下一轮计划' : '生成后这里会显示下一步')}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            {showCreateForm && (
              <section id="study-plan-form" className={`${shellCard} ${shellRadius} overflow-hidden border`}>
                <div className={`border-b px-5 py-5 sm:px-6 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <AppBadge variant="neutral" size="md" className={badgeClass}>
                        创建计划
                      </AppBadge>
                      <h2 className={`mt-3 text-2xl font-bold ${titleText}`}>先把目标说清楚，再让系统帮你整理节奏</h2>
                      <p className={`mt-2 text-sm leading-6 ${bodyText}`}>
                        这块只保留最必要的信息输入，避免把创建过程做成又长又碎的配置表。
                      </p>
                    </div>
                    {plan && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setError('');
                        }}
                        className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${secondaryButton}`}
                      >
                        收起表单
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-5 sm:px-6 sm:py-6">
                  <form onSubmit={handleCreatePlan} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div>
                      <label className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        学习目标
                      </label>
                      <textarea
                        value={formGoal}
                        onChange={(e) => setFormGoal(e.target.value)}
                        placeholder="例如：根据 Python 教材，在 3 天内掌握基础语法；两周完成数据分析入门；也可以只写目标，由系统自动判断周期。"
                        className={`min-h-40 ${shellRadius} w-full border px-4 py-3 text-sm leading-7 transition-colors focus:outline-none focus:ring-2 ${
                          isDark
                            ? 'border-slate-600 bg-slate-800/70 text-white placeholder-slate-400 focus:border-sky-500 focus:ring-sky-500/20'
                            : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                        required
                      />
                      <p className={`mt-2 text-xs ${mutedText}`}>
                        支持自动识别“分钟 / 小时 / 天 / 周 / 月 / 年”等时间关键词，不写时间也可以。
                      </p>
                    </div>

                    <div className={`${panelCard} ${panelRadius} border p-4 sm:p-5`}>
                      <div className={`${itemRadius} border px-4 py-4 ${isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-white'}`}>
                        <div className={`text-sm font-medium ${titleText}`}>系统会自动拆节奏</div>
                        <p className={`mt-2 text-sm leading-6 ${bodyText}`}>
                          有明确周期时优先按周期规划，没有明确周期时会自动估算合理天数，再按天拆出主题。
                        </p>
                      </div>

                      {error && (
                        <div className={`mt-4 rounded-2xl px-3 py-2 text-sm ${isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-600'}`}>
                          {error}
                        </div>
                      )}

                      <div className="mt-5 flex flex-col gap-3">
                        <button
                          type="submit"
                          disabled={generating}
                          className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${primaryButton}`}
                        >
                          {generating ? '正在生成学习计划...' : '生成学习计划'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateForm(false);
                            setError('');
                          }}
                          className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${secondaryButton}`}
                        >
                          暂时取消
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                {plan && (
                  currentTask ? (
                    <section id="current-task-section" className={`${shellCard} ${shellRadius} border p-5 sm:p-6 lg:p-8`}>
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <AppBadge variant="success" size="md" className={successBadgeClass}>
                              今日聚焦
                            </AppBadge>
                            <AppBadge variant="neutral" size="md" className={badgeClass}>
                              第 {currentTask.day} 天
                            </AppBadge>
                            <AppBadge variant="neutral" size="md" className={badgeClass}>
                              {currentTask.tasks?.length || 0} 个任务项
                            </AppBadge>
                          </div>

                          <h2 className={`mt-4 text-2xl font-bold break-words sm:text-3xl ${titleText}`}>
                            {currentTask.topic}
                          </h2>
                          <p className={`mt-3 max-w-3xl text-sm leading-7 sm:text-base ${bodyText}`}>
                            这块只展示今天真正要做的事，把页面从“信息很多”切回“当下该做什么”。
                          </p>
                        </div>

                        <div className={`${panelCard} ${panelRadius} w-full border p-5 lg:max-w-[280px]`}>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className={`text-xs font-medium ${mutedText}`}>已完成</div>
                              <div className={`mt-2 text-2xl font-bold ${titleText}`}>{completed}</div>
                            </div>
                            <div>
                              <div className={`text-xs font-medium ${mutedText}`}>剩余</div>
                              <div className={`mt-2 text-2xl font-bold ${titleText}`}>{remaining}</div>
                            </div>
                          </div>

                          <div className={`mt-5 h-2 rounded-full ${progressTrack}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progressFill}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <p className={`mt-4 text-sm leading-6 ${bodyText}`}>
                            {nextTask ? `完成今天后，会切到「${nextTask.topic}」。` : '完成今天后，这轮计划也就结束了。'}
                          </p>

                          <button
                            onClick={() => toggleDayCompletion(currentTask.day)}
                            className={`mt-5 min-h-12 w-full rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${primaryButton}`}
                          >
                            标记今天已完成
                          </button>
                        </div>
                      </div>

                      {!!currentTask.tasks?.length && (
                        <div className="mt-6 grid gap-3">
                          {currentTask.tasks.map((task, idx) => (
                            <div key={`${currentTask.day}-${idx}`} className={`${panelCard} ${itemRadius} flex items-start gap-3 border px-4 py-4`}>
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                                {idx + 1}
                              </div>
                              <div className={`min-w-0 text-sm leading-7 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {task}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : (
                    <section id="current-task-section" className={`${shellCard} ${shellRadius} border border-emerald-200/70 p-5 sm:p-6 lg:p-8`}>
                      <AppBadge variant="success" size="md" className={successBadgeClass}>
                        本轮完成
                      </AppBadge>
                      <h2 className={`mt-4 text-3xl font-bold ${titleText}`}>这一轮学习计划已经全部完成</h2>
                      <p className={`mt-3 max-w-2xl text-sm leading-7 sm:text-base ${bodyText}`}>
                        现在这页更适合用来回顾，而不是继续堆叠新的数据。你可以先复盘，再决定是否开启下一轮。
                      </p>
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                          onClick={() => scrollToSection('study-path-section')}
                          className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${primaryButton}`}
                        >
                          回顾学习路径
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateForm(true);
                            setError('');
                            scrollToSection('study-plan-form');
                          }}
                          className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${secondaryButton}`}
                        >
                          生成下一轮计划
                        </button>
                      </div>
                    </section>
                  )
                )}

                <section id="study-path-section" className={`${shellCard} ${shellRadius} border p-5 sm:p-6 lg:p-8`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <AppBadge variant="neutral" size="md" className={badgeClass}>
                        学习路径
                      </AppBadge>
                      <h2 className={`mt-3 text-2xl font-bold ${titleText}`}>整轮计划收成一条主线，不再把信息打散</h2>
                      <p className={`mt-2 max-w-2xl text-sm leading-7 ${bodyText}`}>
                        时间线只保留状态、主题和任务详情三个层级，减少重复统计对视线的干扰。
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <div className={`${panelCard} ${panelRadius} border px-4 py-3`}>
                        <div className={`text-xs font-medium ${mutedText}`}>总天数</div>
                        <div className={`mt-1 text-lg font-semibold ${titleText}`}>{totalDays}</div>
                      </div>
                      <div className={`${panelCard} ${panelRadius} border px-4 py-3`}>
                        <div className={`text-xs font-medium ${mutedText}`}>已完成</div>
                        <div className={`mt-1 text-lg font-semibold ${titleText}`}>{completed}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {planData.length === 0 ? (
                      <div className={`${panelCard} ${panelRadius} border p-6 text-center ${bodyText}`}>
                        当前还没有可展示的学习路径。
                      </div>
                    ) : (
                      planData.map((item, index) => {
                        const done = completedDays.has(item.day);
                        const active = currentTask && currentTask.day === item.day;
                        const open = expandedDays.has(item.day);
                        const cardTone = done ? doneTimelineCard : active ? activeTimelineCard : timelineCard;
                        const markerTone = done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : active
                            ? 'border-sky-600 bg-sky-600 text-white'
                            : isDark
                              ? 'border-slate-600 bg-slate-800 text-slate-200'
                              : 'border-slate-300 bg-white text-slate-700';
                        const lineTone = done
                          ? (isDark ? 'bg-emerald-500/30' : 'bg-emerald-200')
                          : active
                            ? (isDark ? 'bg-sky-500/30' : 'bg-sky-200')
                            : (isDark ? 'bg-slate-700' : 'bg-slate-200');

                        return (
                          <article key={item.day} className="relative pl-14">
                            {index !== planData.length - 1 && (
                              <div className={`absolute left-[1.15rem] top-12 h-[calc(100%+1rem)] w-px ${lineTone}`} />
                            )}

                            <button
                              onClick={() => toggleDayCompletion(item.day)}
                              className={`absolute left-0 top-2 flex h-9 w-9 items-center justify-center rounded-2xl border-2 text-sm font-semibold transition-colors ${markerTone}`}
                            >
                              {done ? (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                item.day
                              )}
                            </button>

                            <div className={`${cardTone} ${panelRadius} border p-4 sm:p-5`}>
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <AppBadge
                                      variant={done ? 'success' : active ? 'warning' : 'neutral'}
                                      size="md"
                                      className={done ? successBadgeClass : active ? warmBadgeClass : badgeClass}
                                    >
                                      {done ? '已完成' : active ? '当前进行中' : '待开始'}
                                    </AppBadge>
                                    <span className={`text-xs ${mutedText}`}>Day {item.day}</span>
                                    <span className={`text-xs ${mutedText}`}>{item.tasks?.length || 0} 个任务项</span>
                                  </div>

                                  <h3 className={`mt-3 text-lg font-semibold break-words sm:text-xl ${titleText}`}>
                                    {item.topic}
                                  </h3>
                                </div>

                                {!!item.tasks?.length && (
                                  <button
                                    onClick={() => toggleDay(item.day)}
                                    className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${secondaryButton}`}
                                  >
                                    {open ? '收起详情' : '展开详情'}
                                  </button>
                                )}
                              </div>

                              {open && !!item.tasks?.length && (
                                <div className={`${panelCard} ${itemRadius} mt-4 border p-4`}>
                                  <div className="space-y-3">
                                    {item.tasks.map((task, idx) => (
                                      <div key={`${item.day}-${idx}`} className="flex items-start gap-3">
                                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                                          {idx + 1}
                                        </div>
                                        <div className={`text-sm leading-7 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                          {task}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                <section className={`${shellCard} ${shellRadius} border p-5 sm:p-6`}>
                  <AppBadge variant="neutral" size="md" className={badgeClass}>
                    本轮概览
                  </AppBadge>
                  <h3 className={`mt-3 text-xl font-bold ${titleText}`}>把统计收进侧栏，不再抢主内容</h3>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {overviewStats.map((stat) => (
                      <div key={stat.label} className={`${panelCard} ${panelRadius} border p-4`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${mutedText}`}>
                          {stat.label}
                        </div>
                        <div className={`mt-2 text-2xl font-bold ${titleText}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-5 h-2 rounded-full ${progressTrack}`}>
                    <div className={`h-full rounded-full ${progressFill}`} style={{ width: `${progress}%` }} />
                  </div>
                </section>

                <section className={`${shellCard} ${shellRadius} border p-5 sm:p-6`}>
                  <AppBadge variant="warning" size="md" className={warmBadgeClass}>
                    接下来
                  </AppBadge>
                  <h3 className={`mt-3 text-xl font-bold ${titleText}`}>未来几步比整页重复统计更有用</h3>
                  <div className="mt-5 space-y-3">
                    {upcomingDays.length > 0 ? (
                      upcomingDays.map((item) => (
                        <div key={item.day} className={`${panelCard} ${itemRadius} flex items-start gap-3 border px-4 py-4`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${item.day === currentTask?.day ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700')}`}>
                            {item.day}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold ${titleText}`}>{item.topic}</div>
                            <div className={`mt-1 text-xs ${bodyText}`}>{item.tasks?.length || 0} 个任务项</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`${panelCard} ${itemRadius} border px-4 py-4 text-sm leading-7 ${bodyText}`}>
                        当前没有待执行内容了，可以复盘本轮计划，或者新建下一轮学习目标。
                      </div>
                    )}
                  </div>
                </section>

                <section className={`${shellCard} ${shellRadius} border p-5 sm:p-6`}>
                  <AppBadge variant="warning" size="md" className={warmBadgeClass}>
                    知识点建议
                  </AppBadge>
                  <h3 className={`mt-3 text-xl font-bold ${titleText}`}>右侧只给和你当前计划相关的知识提醒</h3>
                  <div className="mt-5 space-y-3">
                    {knowledgeSuggestions.map((item) => (
                      <div key={item.title} className={`${panelCard} ${itemRadius} border px-4 py-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${mutedText}`}>
                            {item.label}
                          </div>
                          <div className={`h-2 w-2 shrink-0 ${isDark ? 'bg-sky-400' : 'bg-sky-500'}`} />
                        </div>
                        <div className={`mt-2 text-sm font-semibold leading-6 ${titleText}`}>{item.title}</div>
                        <div className={`mt-2 text-sm leading-7 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudyPlan;
