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
      const response = await api.post('/api/v1/ai/plan/generate', {
        user_id: userId,
        goals: formGoal.trim(),
      }, { timeout: 120000 });
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

  const heroTitle = plan?.goal || '把学习目标整理成一份更清晰的学习计划';
  const heroText = plan
    ? (progress === 100
      ? '这一轮学习已经全部完成。现在可以回顾整条路径，或者继续生成下一轮更进阶的计划。'
      : currentTask
        ? `系统已将目标拆成 ${totalDays} 天路径。今天建议优先完成第 ${currentTask.day} 天，保持稳定推进。`
        : '学习路径已经准备好，接下来按顺序推进每一天即可。')
    : '输入目标后，系统会自动识别时间信息并整理为一条更可执行的学习路径，移动端优先看到当天重点。';

  const insightItems = plan
    ? (progress === 100
      ? [
        '这轮目标已经完成，可以顺势开始下一轮更进阶的学习。',
        '建议回顾所有任务，把关键知识点整理成一页笔记。',
        '如果目标有变化，重新生成一份新计划会更清晰。',
      ]
      : currentTask
        ? [
          `今天先完成「${currentTask.topic}」。`,
          `本轮还剩 ${remaining} 天，保持每天一个主题最稳。`,
          `目前已完成 ${completed}/${totalDays} 天，节奏已经建立起来了。`,
        ]
        : [
          '学习路径已经生成，下一步从第 1 天开始推进。',
          '每完成一天记得勾选，系统会保留你的进度。',
          '如果学习目标变化，可以重新生成更贴合的新计划。',
        ])
    : [
      '目标越具体，生成的路径越像一份真正可执行的课程表。',
      '可以把教材主题、周期和预期结果一起写进去。',
      '先跑出第一版，再根据真实学习反馈继续调整。',
    ];

  const heroStats = [
    { label: '完成进度', value: `${progress}%`, meta: `已完成 ${completed}/${totalDays || 0} 天` },
    {
      label: '当前重点',
      value: currentTask ? `第 ${currentTask.day} 天` : (plan ? '已收尾' : '待生成'),
      meta: currentTask?.topic || (plan ? '可以开启下一轮计划' : '先填写你的学习目标'),
    },
    { label: '任务总数', value: `${totalTasks}`, meta: '整轮学习任务的累计数量' },
    { label: '剩余天数', value: plan ? `${remaining}` : '--', meta: plan ? '按天推进更容易坚持' : '生成后自动显示' },
  ];

  const overviewStats = [
    { label: '总天数', value: totalDays },
    { label: '已完成', value: completed },
    { label: '剩余', value: remaining },
    { label: '任务项', value: totalTasks },
  ];

  const pageBg = isDark ? 'bg-[#0f1724]' : 'bg-gray-50';
  const pageGlow = isDark ? 'bg-[radial-gradient(circle_at_top,_rgba(61,88,115,0.18),_transparent_48%)]' : '';
  const cardBase = `${isDark ? 'border-slate-800 bg-[#111827]/92 shadow-[0_18px_48px_rgba(0,0,0,0.28)]' : 'border-gray-200 bg-white shadow-sm'} border rounded-[28px]`;
  const softCard = `${isDark ? 'border-slate-700/80 bg-slate-900/60' : 'border-gray-200 bg-gray-50'} border rounded-[24px]`;
  const heroShell = `${isDark ? 'border-slate-800 bg-[#121a28]' : 'border-gray-200 bg-white'} border rounded-[32px]`;
  const heroMetricCard = `${isDark ? 'border-slate-700/80 bg-slate-900/55' : 'border-gray-200 bg-gray-50'} border rounded-[24px]`;
  const titleText = isDark ? 'text-slate-50' : 'text-gray-900';
  const bodyText = isDark ? 'text-slate-300' : 'text-gray-600';
  const subduedText = isDark ? 'text-slate-500' : 'text-gray-400';
  const primaryButton = isDark
    ? 'bg-[#325a79] text-white hover:bg-[#3b688c]'
    : 'bg-blue-600 text-white hover:bg-blue-700';
  const secondaryButton = isDark
    ? 'border border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800'
    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  const progressTrack = isDark ? 'bg-slate-800' : 'bg-gray-200';
  const progressFill = progress === 100 ? 'bg-emerald-600' : 'bg-blue-600';
  const badgeClass = isDark
    ? 'border-slate-700 bg-slate-900/70 text-slate-200'
    : 'border-gray-200 bg-gray-100 text-gray-600';
  const warmBadgeClass = isDark
    ? 'border-amber-700/40 bg-amber-500/10 text-amber-200'
    : 'border-amber-200 bg-amber-50 text-amber-700';
  const successBadgeClass = isDark
    ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  if (loading) {
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <div className={`min-h-screen ${pageGlow}`}>
          <div className="container-xl px-4 py-6 sm:py-8">
            <div className="animate-pulse space-y-6">
              <div className={`h-72 rounded-[32px] ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`} />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
                <div className={`h-[42rem] rounded-[28px] ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`} />
                <div className="space-y-6">
                  <div className={`h-56 rounded-[28px] ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`} />
                  <div className={`h-72 rounded-[28px] ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`} />
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
            <div className={`${cardBase} mx-auto max-w-2xl p-8 text-center`}>
              <h2 className={`text-2xl font-bold ${titleText}`}>暂时还没有学习计划</h2>
              <p className={`mt-3 ${bodyText}`}>{error}</p>
              <button
                onClick={() => { setError(''); setShowCreateForm(true); }}
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
            <section id="study-plan-hero" className={`${heroShell} overflow-hidden px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10`}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.92fr)] lg:items-end">
                <div className="min-w-0">
                  <AppBadge variant="neutral" size="md" className={badgeClass}>学习计划</AppBadge>
                  <h1 className={`mt-4 text-3xl font-bold leading-tight break-words sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] ${titleText}`}>
                    {heroTitle}
                  </h1>
                  <p className={`mt-4 max-w-2xl text-sm leading-7 sm:text-base ${bodyText}`}>
                    {heroText}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <span className={`rounded-full border px-3 py-1.5 text-sm ${badgeClass}`}>
                      {plan ? `共 ${totalDays} 天路径` : '自动识别学习周期'}
                    </span>
                    <span className={`rounded-full border px-3 py-1.5 text-sm ${badgeClass}`}>
                      {plan ? `已完成 ${completed} 天` : '移动端优先展示今日重点'}
                    </span>
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
                      onClick={() => { setShowCreateForm(true); setError(''); scrollToSection('study-plan-form'); }}
                      className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${secondaryButton}`}
                    >
                      新建计划
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className={`${heroMetricCard} p-4 sm:p-5`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${subduedText}`}>{stat.label}</div>
                      <div className={`mt-3 text-3xl font-bold ${titleText}`}>{stat.value}</div>
                      <div className={`mt-2 text-sm break-words ${bodyText}`}>{stat.meta}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {showCreateForm && (
              <section id="study-plan-form" className={`${cardBase} overflow-hidden`}>
                <div className={`border-b px-5 py-5 sm:px-6 ${isDark ? 'border-slate-700/60' : 'border-gray-200'}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <AppBadge variant="neutral" size="md" className={badgeClass}>创建计划</AppBadge>
                      <h2 className={`mt-3 text-2xl font-bold ${titleText}`}>把目标整理成一份更像课程表的学习路径</h2>
                      <p className={`mt-2 text-sm leading-6 ${bodyText}`}>
                        把教材主题、周期和预期结果写清楚。像“3 天掌握 Python 基础”这种时间信息会自动识别；不写时间时也会交给 AI 判断合理周期。
                      </p>
                    </div>
                    {plan && (
                      <button
                        type="button"
                        onClick={() => { setShowCreateForm(false); setError(''); }}
                        className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${secondaryButton}`}
                      >
                        收起表单
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-5 py-5 sm:px-6 sm:py-6">
                  <form onSubmit={handleCreatePlan} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                      <label className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-[#314455]'}`}>学习目标</label>
                      <textarea
                        value={formGoal}
                        onChange={(e) => setFormGoal(e.target.value)}
                        placeholder="例如：根据 Python 教材，在 3 天内掌握基础语法；两周完成数据分析入门；也可以只写目标，由系统自动判断周期。"
                        className={`min-h-36 w-full rounded-[24px] border px-4 py-3 text-sm leading-7 transition-colors focus:outline-none focus:ring-2 ${
                          isDark
                            ? 'border-slate-600 bg-slate-800/70 text-white placeholder-slate-400 focus:border-[#5b85a5] focus:ring-[#5b85a5]/20'
                            : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-blue-600/15'
                        }`}
                        required
                      />
                      <p className={`mt-2 text-xs ${subduedText}`}>
                        支持自动识别“分钟 / 小时 / 天 / 周 / 月 / 年”等时间关键词；不写也可以。
                      </p>
                    </div>
                    <div className={`${softCard} p-4 sm:p-5`}>
                      <div className={`rounded-[20px] border px-4 py-4 ${isDark ? 'border-slate-700 bg-slate-800/80' : 'border-gray-200 bg-gray-50'}`}>
                        <div className={`text-sm font-medium ${titleText}`}>周期自动识别</div>
                        <p className={`mt-2 text-sm leading-6 ${bodyText}`}>
                          系统会优先识别目标里的时间表达，例如“3 天”“2 周”“1 个月”；如果没有明确周期，会自动分析更合适的学习节奏。
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
                          onClick={() => { setShowCreateForm(false); setError(''); }}
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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
              <div className="space-y-6">
                {plan && (currentTask ? (
                  <section id="current-task-section" className={`${cardBase} p-5 sm:p-6 lg:p-8`}>
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_280px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <AppBadge variant="success" size="md" className={successBadgeClass}>今日任务</AppBadge>
                          <AppBadge variant="neutral" size="md" className={badgeClass}>第 {currentTask.day} 天</AppBadge>
                          <AppBadge variant="neutral" size="md" className={badgeClass}>{currentTask.tasks?.length || 0} 个任务项</AppBadge>
                        </div>
                        <h2 className={`mt-4 text-2xl font-bold break-words sm:text-3xl ${titleText}`}>{currentTask.topic}</h2>
                        <p className={`mt-3 text-sm leading-7 sm:text-base ${bodyText}`}>
                          今天只盯住这一块内容，把大计划切成一个能完成的小目标，执行感会更强，也更容易在移动端快速进入状态。
                        </p>
                        {!!currentTask.tasks?.length && (
                          <div className="mt-6 grid gap-3">
                            {currentTask.tasks.map((task, idx) => (
                              <div key={`${currentTask.day}-${idx}`} className={`${softCard} flex items-start gap-3 px-4 py-4`}>
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-600'}`}>
                                  {idx + 1}
                                </div>
                                <div className={`min-w-0 text-sm leading-7 ${isDark ? 'text-slate-300' : 'text-[#3d4c57]'}`}>{task}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <aside className={`${softCard} p-5`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-[#3d586d]'}`}>当前推进</div>
                            <div className={`mt-1 text-3xl font-bold ${titleText}`}>{progress}%</div>
                          </div>
                          <div className={`rounded-2xl px-3 py-2 text-sm ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-50 text-gray-600'}`}>
                            还剩 {remaining} 天
                          </div>
                        </div>
                        <div className={`mt-5 h-2 rounded-full ${progressTrack}`}>
                          <div className={`h-full rounded-full transition-all duration-500 ${progressFill}`} style={{ width: `${progress}%` }} />
                        </div>
                        <button
                          onClick={() => toggleDayCompletion(currentTask.day)}
                          className="mt-5 min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                          标记今天已完成
                        </button>
                      </aside>
                    </div>
                  </section>
                ) : (
                  <section id="current-task-section" className={`${cardBase} border-emerald-200/70 p-5 sm:p-6 sm:py-8`}>
                    <AppBadge variant="success" size="md" className={successBadgeClass}>学习完成</AppBadge>
                    <h2 className={`mt-4 text-3xl font-bold ${titleText}`}>这一轮计划已经全部完成</h2>
                    <p className={`mt-3 max-w-2xl text-sm leading-7 sm:text-base ${bodyText}`}>
                      你已经把这轮学习路径完整走完。现在可以回顾整条路线，或者直接开始下一轮更进阶的计划。
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => scrollToSection('study-path-section')}
                        className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${primaryButton}`}
                      >
                        回顾学习路径
                      </button>
                      <button
                        onClick={() => { setShowCreateForm(true); setError(''); scrollToSection('study-plan-form'); }}
                        className={`min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${secondaryButton}`}
                      >
                        生成下一轮计划
                      </button>
                    </div>
                  </section>
                ))}

                <section id="study-path-section" className={`${cardBase} p-5 sm:p-6 lg:p-8`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <AppBadge variant="neutral" size="md" className={badgeClass}>学习路径</AppBadge>
                      <h2 className={`mt-3 text-2xl font-bold ${titleText}`}>每一天都只保留一个清晰重点</h2>
                      <p className={`mt-2 max-w-2xl text-sm leading-7 ${bodyText}`}>
                        已完成、进行中和待开始三种状态一眼可见。移动端先看重点，桌面端再快速浏览完整路线。
                      </p>
                    </div>
                    <div className={`${softCard} grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3`}>
                      <div>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${subduedText}`}>总天数</div>
                        <div className={`mt-2 text-2xl font-bold ${titleText}`}>{totalDays}</div>
                      </div>
                      <div>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${subduedText}`}>已完成</div>
                        <div className={`mt-2 text-2xl font-bold ${titleText}`}>{completed}</div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${subduedText}`}>任务项</div>
                        <div className={`mt-2 text-2xl font-bold ${titleText}`}>{totalTasks}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {planData.length === 0 ? (
                      <div className={`${softCard} p-6 text-center ${bodyText}`}>当前还没有可展示的学习路径。</div>
                    ) : planData.map((item) => {
                      const done = completedDays.has(item.day);
                      const active = currentTask && currentTask.day === item.day;
                      const open = expandedDays.has(item.day);
                      const tone = done
                        ? (isDark ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-[#d4e2d5] bg-[#f4faf4]')
                        : active
                          ? (isDark ? 'border-[#4f7391]/40 bg-[#132334]' : 'border-[#cfdae3] bg-[#f3f7fa]')
                          : (isDark ? 'border-slate-700/60 bg-slate-900/55' : 'border-gray-200 bg-white');
                      const marker = done
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isDark
                            ? 'border-slate-600 bg-slate-800 text-slate-200'
                            : 'border-[#d9cfbf] bg-[#f6efe3] text-[#526472]';
                      const statusBadgeClass = done
                        ? successBadgeClass
                        : active
                          ? badgeClass
                          : (isDark ? 'border-slate-700 bg-slate-900/65 text-slate-300' : 'border-[#e4dacb] bg-[#f7f2e8] text-[#667581]');
                      return (
                        <article key={item.day} className={`${tone} rounded-[24px] border p-4 sm:p-5`}>
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="flex min-w-0 flex-1 items-start gap-4">
                              <button
                                onClick={() => toggleDayCompletion(item.day)}
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 transition-colors ${marker}`}
                              >
                                {done ? (
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="text-sm font-semibold">{item.day}</span>
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <AppBadge variant="neutral" size="md" className={statusBadgeClass}>
                                    {done ? '已完成' : active ? '进行中' : '待开始'}
                                  </AppBadge>
                                  <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${subduedText}`}>Day {item.day}</span>
                                  <span className={`text-xs ${subduedText}`}>{item.tasks?.length || 0} 个任务项</span>
                                </div>
                                <h3 className={`mt-3 text-lg font-semibold break-words sm:text-xl ${done ? (isDark ? 'text-slate-300' : 'text-[#556571]') : titleText}`}>
                                  第 {item.day} 天：{item.topic}
                                </h3>
                              </div>
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
                            <div className={`${softCard} mt-4 p-4`}>
                              <div className="space-y-3">
                                {item.tasks.map((task, idx) => (
                                  <div key={`${item.day}-${idx}`} className="flex items-start gap-3">
                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-600'}`}>
                                      {idx + 1}
                                    </div>
                                    <div className={`text-sm leading-7 ${isDark ? 'text-slate-300' : 'text-[#3d4c57]'}`}>{task}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                <section className={`${cardBase} p-5 sm:p-6`}>
                  <AppBadge variant="neutral" size="md" className={badgeClass}>学习概览</AppBadge>
                  <h3 className={`mt-3 text-xl font-bold ${titleText}`}>本轮节奏</h3>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {overviewStats.map((stat) => (
                      <div key={stat.label} className={`${softCard} p-4`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${subduedText}`}>{stat.label}</div>
                        <div className={`mt-2 text-2xl font-bold ${titleText}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-5 h-2 rounded-full ${progressTrack}`}>
                    <div className={`h-full rounded-full ${progressFill}`} style={{ width: `${progress}%` }} />
                  </div>
                </section>

                <section className={`${cardBase} p-5 sm:p-6`}>
                  <AppBadge variant="warning" size="md" className={warmBadgeClass}>本轮建议</AppBadge>
                  <h3 className={`mt-3 text-xl font-bold ${titleText}`}>像学习产品一样推进学习</h3>
                  <div className="mt-5 space-y-3">
                    {insightItems.map((item, idx) => (
                      <div key={idx} className={`${softCard} flex items-start gap-3 px-4 py-4`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-[#fffdf8] text-[#50616f]'}`}>
                          {idx + 1}
                        </div>
                        <div className={`text-sm leading-7 ${isDark ? 'text-slate-300' : 'text-[#3d4c57]'}`}>{item}</div>
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
