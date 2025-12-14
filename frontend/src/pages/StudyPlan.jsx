import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function StudyPlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [completedDays, setCompletedDays] = useState(new Set());
  const [selectedView, setSelectedView] = useState('timeline'); // timeline, list, kanban
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'min-h-screen bg-gradient-to-b from-[#05060a] via-[#080b15] to-[#0c111f] text-white',
            card: 'bg-[#111729] border border-white/10 text-white',
            accentCard: 'bg-[#121b2f] border border-white/10 text-white shadow-[0_15px_50px_rgba(0,0,0,0.35)]',
            secondaryText: 'text-white/70',
            alertBg: 'bg-red-500/10 border border-red-500/40 text-red-200',
            buttonPrimary: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-900/30',
            planCard: 'bg-gradient-to-r from-[#10223f] via-[#101a30] to-[#111524] border border-white/10 text-white',
            dayBadge: 'bg-blue-500 text-white',
            divider: 'border-white/15',
            listText: 'text-white/80',
            empty: 'text-white/60',
            timelineDot: 'bg-blue-500',
            timelineLine: 'bg-white/20',
            suggestionCard: 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20',
          }
        : {
            page: 'min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900',
            card: 'bg-white border border-slate-100 text-slate-900 shadow-xl',
            accentCard: 'bg-white rounded-xl shadow-lg text-slate-900',
            secondaryText: 'text-slate-500',
            alertBg: 'bg-red-50 border border-red-200 text-red-800',
            buttonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-200',
            planCard: 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-slate-900',
            dayBadge: 'bg-blue-600 text-white',
            divider: 'border-gray-200',
            listText: 'text-gray-700',
            empty: 'text-gray-500',
            timelineDot: 'bg-blue-600',
            timelineLine: 'bg-slate-300',
            suggestionCard: 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200',
          },
    [isDark]
  );

  const getUserId = () => {
    const userInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        return user.id;
      } catch {
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    if (location.state?.plan) {
      setPlan(location.state.plan);
    } else {
      loadLatestPlan();
    }
  }, [location]);

  const loadLatestPlan = async () => {
    setLoading(true);
    setError('');

    try {
      const user_id = getUserId();
      const response = await api.get(`/api/v1/ai/plan/list/${user_id}`);
      
      if (response.data && response.data.length > 0) {
        setPlans(response.data);
        setPlan(response.data[0]);
        const savedCompleted = localStorage.getItem(`plan_${response.data[0].id}_completed`);
        if (savedCompleted) {
          try {
            setCompletedDays(new Set(JSON.parse(savedCompleted)));
          } catch (e) {
            console.error('Failed to load completed days:', e);
          }
        }
      } else {
        setError('暂无学习计划，请先上传文件并生成计划');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '加载学习计划失败');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!plan || !plan.plan) {
      return { totalDays: 0, completedDays: 0, progress: 0, estimatedHours: 0 };
    }
    const totalDays = plan.plan.length;
    const completed = completedDays.size;
    const progress = totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;
    const estimatedHours = totalDays * 2; // 假设每天2小时
    return { totalDays, completedDays: completed, progress, estimatedHours };
  }, [plan, completedDays]);

  const toggleDayCompletion = (day, e) => {
    e.stopPropagation();
    const newCompleted = new Set(completedDays);
    if (newCompleted.has(day)) {
      newCompleted.delete(day);
    } else {
      newCompleted.add(day);
    }
    setCompletedDays(newCompleted);
    if (plan) {
      localStorage.setItem(`plan_${plan.id}_completed`, JSON.stringify(Array.from(newCompleted)));
    }
  };

  const toggleDay = (day) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  // 获取当前学习阶段
  const getCurrentPhase = () => {
    if (!plan || !plan.plan) return null;
    const completed = completedDays.size;
    const total = plan.plan.length;
    const ratio = completed / total;
    
    if (ratio === 0) return { name: '准备阶段', desc: '开始你的学习之旅', color: 'blue' };
    if (ratio < 0.3) return { name: '入门阶段', desc: '打好基础，稳步前进', color: 'green' };
    if (ratio < 0.7) return { name: '进阶阶段', desc: '深入学习，持续提升', color: 'yellow' };
    if (ratio < 1) return { name: '冲刺阶段', desc: '即将完成，坚持到底', color: 'orange' };
    return { name: '完成阶段', desc: '恭喜完成学习计划！', color: 'purple' };
  };

  const currentPhase = getCurrentPhase();

  if (loading) {
    return (
      <div className={`${palette.page} flex items-center justify-center min-h-screen`}>
        <div className={`${palette.card} rounded-xl shadow-lg p-10 text-center space-y-4`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className={palette.secondaryText}>加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className={`${palette.page} py-10`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className={`${palette.card} rounded-3xl shadow-2xl p-10`}>
            <div className="text-center mb-8">
              <div className={`text-6xl mb-4 ${isDark ? 'text-white/20' : 'text-slate-300'}`}>📚</div>
              <h2 className="text-3xl font-bold mb-3">开始你的学习之旅</h2>
              <p className={`${palette.secondaryText} text-lg mb-8`}>
                上传学习文件，AI 将为你生成个性化的学习计划
              </p>
            </div>

            <div className={`p-4 rounded-lg mb-6 ${palette.alertBg}`}>
              <p className="font-medium">{error}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className={`${palette.accentCard} p-6 rounded-2xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="text-3xl mb-3">📄</div>
                <h3 className="font-semibold mb-2">上传文件</h3>
                <p className={`${palette.secondaryText} text-sm`}>支持 PDF、Word、PPT 等格式</p>
              </div>
              <div className={`${palette.accentCard} p-6 rounded-2xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="font-semibold mb-2">AI 生成计划</h3>
                <p className={`${palette.secondaryText} text-sm`}>智能分析内容，制定学习路径</p>
              </div>
              <div className={`${palette.accentCard} p-6 rounded-2xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold mb-2">跟踪进度</h3>
                <p className={`${palette.secondaryText} text-sm`}>实时查看学习进度和统计</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/upload-file')}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition ${palette.buttonPrimary}`}
            >
              🚀 去上传文件并生成计划
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className={`${palette.page} py-10`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className={`${palette.card} rounded-3xl shadow-2xl p-10 text-center`}>
            <div className={`text-6xl mb-6 ${isDark ? 'text-white/20' : 'text-slate-300'}`}>📚</div>
            <h2 className="text-3xl font-bold mb-4">暂无学习计划</h2>
            <p className={`${palette.secondaryText} text-lg mb-8`}>
              上传学习文件，让 AI 为你制定个性化学习计划
            </p>
            <button
              onClick={() => navigate('/upload-file')}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition ${palette.buttonPrimary}`}
            >
              🚀 生成学习计划
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${palette.page} py-10`}>
      <div className="max-w-7xl mx-auto px-4">
        {/* 顶部横幅 - 学习阶段 */}
        {currentPhase && (
          <div className={`${palette.suggestionCard} rounded-3xl p-6 mb-6 border-2 ${
            isDark ? 'border-purple-500/30' : 'border-purple-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`text-4xl ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  {currentPhase.name === '准备阶段' && '🎯'}
                  {currentPhase.name === '入门阶段' && '🌱'}
                  {currentPhase.name === '进阶阶段' && '🚀'}
                  {currentPhase.name === '冲刺阶段' && '⚡'}
                  {currentPhase.name === '完成阶段' && '🎉'}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">{currentPhase.name}</h3>
                  <p className={palette.secondaryText}>{currentPhase.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">{stats.progress}%</div>
                <div className={`text-sm ${palette.secondaryText}`}>完成进度</div>
              </div>
            </div>
          </div>
        )}

        {/* 核心指标卡片 */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className={`${palette.accentCard} rounded-2xl p-6 border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`text-sm ${palette.secondaryText} mb-2`}>学习进度</div>
            <div className="text-3xl font-bold text-blue-500">{stats.progress}%</div>
            <div className={`text-xs ${palette.secondaryText} mt-2`}>
              {stats.completedDays} / {stats.totalDays} 天
            </div>
          </div>
          <div className={`${palette.accentCard} rounded-2xl p-6 border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`text-sm ${palette.secondaryText} mb-2`}>预计时长</div>
            <div className="text-3xl font-bold text-green-500">{stats.estimatedHours}h</div>
            <div className={`text-xs ${palette.secondaryText} mt-2`}>完成全部计划</div>
          </div>
          <div className={`${palette.accentCard} rounded-2xl p-6 border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`text-sm ${palette.secondaryText} mb-2`}>剩余天数</div>
            <div className="text-3xl font-bold text-orange-500">{stats.totalDays - stats.completedDays}</div>
            <div className={`text-xs ${palette.secondaryText} mt-2`}>待完成</div>
          </div>
          <div className={`${palette.accentCard} rounded-2xl p-6 border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`text-sm ${palette.secondaryText} mb-2`}>计划总数</div>
            <div className="text-3xl font-bold text-purple-500">{plans.length}</div>
            <div className={`text-xs ${palette.secondaryText} mt-2`}>
              <button
                onClick={() => setSelectedView(selectedView === 'list' ? 'timeline' : 'list')}
                className="hover:underline"
              >
                切换视图
              </button>
            </div>
          </div>
        </div>

        {/* 视图切换和操作栏 */}
        <div className={`${palette.card} rounded-2xl p-4 mb-6 flex items-center justify-between`}>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedView('timeline')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedView === 'timeline'
                  ? isDark
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-white/10 text-white/70 hover:bg-white/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📅 时间线
            </button>
            <button
              onClick={() => setSelectedView('list')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedView === 'list'
                  ? isDark
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-white/10 text-white/70 hover:bg-white/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📋 列表
            </button>
          </div>
          <div className="flex gap-3">
            <Link
              to="/learning-map"
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              🗺️ 知识图谱
            </Link>
            <Link
              to="/quiz"
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              📝 开始测评
            </Link>
            <button
              onClick={() => navigate('/upload-file')}
              className={`px-4 py-2 rounded-lg font-medium transition ${palette.buttonPrimary}`}
            >
              ➕ 新建计划
            </button>
          </div>
        </div>

        {/* 学习路径可视化 */}
        <div className={`${palette.card} rounded-3xl shadow-2xl p-8`}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">学习路径</h1>
              <p className={palette.secondaryText}>
                {plan.goal || '个性化学习计划'} {plan.file_name && `· ${plan.file_name}`}
              </p>
            </div>
          </div>

          {/* 时间线视图 */}
          {selectedView === 'timeline' && plan.plan && plan.plan.length > 0 && (
            <div className="relative">
              {/* 时间线 */}
              <div className={`absolute left-6 top-0 bottom-0 w-0.5 ${palette.timelineLine}`}></div>
              
              <div className="space-y-8">
                {plan.plan.map((dayPlan, index) => {
                  const day = dayPlan.day || index + 1;
                  const isExpanded = expandedDays.has(day);
                  const isCompleted = completedDays.has(day);
                  
                  return (
                    <div key={index} className="relative pl-16">
                      {/* 时间点 */}
                      <div className={`absolute left-4 w-4 h-4 rounded-full ${palette.timelineDot} ${
                        isCompleted ? 'ring-4 ring-green-500/50' : ''
                      }`}>
                        {isCompleted && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* 内容卡片 */}
                      <div
                        className={`${palette.planCard} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer ${
                          isCompleted ? 'opacity-75' : ''
                        }`}
                        onClick={() => toggleDay(day)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`${palette.dayBadge} rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg`}>
                              {day}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold mb-1">
                                {dayPlan.topic || `Day ${day}: 学习内容`}
                              </h3>
                              {dayPlan.tasks && dayPlan.tasks.length > 0 && (
                                <p className={`text-sm ${palette.secondaryText}`}>
                                  {dayPlan.tasks.length} 个学习任务
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => toggleDayCompletion(day, e)}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                                isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : isDark
                                  ? 'border-white/30 hover:border-white/50'
                                  : 'border-slate-300 hover:border-slate-400'
                              }`}
                              title={isCompleted ? '标记为未完成' : '标记为已完成'}
                            >
                              {isCompleted && (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDay(day);
                              }}
                              className={`${isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-transform`}
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className={`mt-4 pt-4 border-t ${palette.divider}`}>
                            <ul className="list-disc ml-8 space-y-2">
                              {dayPlan.tasks && dayPlan.tasks.length > 0 ? (
                                dayPlan.tasks.map((task, taskIndex) => (
                                  <li key={taskIndex} className={`${palette.listText} text-base`}>
                                    {task}
                                  </li>
                                ))
                              ) : (
                                <li className={`${palette.empty} italic`}>暂无任务</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 列表视图 */}
          {selectedView === 'list' && plan.plan && plan.plan.length > 0 && (
            <div className="space-y-4">
              {plan.plan.map((dayPlan, index) => {
                const day = dayPlan.day || index + 1;
                const isExpanded = expandedDays.has(day);
                const isCompleted = completedDays.has(day);
                
                return (
                  <div
                    key={index}
                    className={`${palette.planCard} rounded-2xl p-6 shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer ${
                      isCompleted ? 'opacity-75' : ''
                    }`}
                    onClick={() => toggleDay(day)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className={`${palette.dayBadge} rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg mr-4 relative`}>
                          {day}
                          {isCompleted && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">
                            Day {day}: {dayPlan.topic || '学习内容'}
                          </h3>
                          {dayPlan.tasks && dayPlan.tasks.length > 0 && (
                            <p className={`text-sm ${palette.secondaryText}`}>
                              {dayPlan.tasks.length} 个任务
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => toggleDayCompletion(day, e)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                            isCompleted
                              ? 'bg-green-500 border-green-500 text-white'
                              : isDark
                              ? 'border-white/30 hover:border-white/50'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                          title={isCompleted ? '标记为未完成' : '标记为已完成'}
                        >
                          {isCompleted && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDay(day);
                          }}
                          className={`ml-2 ${isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-transform`}
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className={`mt-4 pt-4 border-t ${palette.divider}`}>
                        <ul className="list-disc ml-8 space-y-2">
                          {dayPlan.tasks && dayPlan.tasks.length > 0 ? (
                            dayPlan.tasks.map((task, taskIndex) => (
                              <li key={taskIndex} className={`${palette.listText} text-base`}>
                                {task}
                              </li>
                            ))
                          ) : (
                            <li className={`${palette.empty} italic`}>暂无任务</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部信息 */}
        {plan.created_at && (
          <div className={`mt-6 ${palette.card} rounded-2xl p-6`}>
            <div className={`flex flex-col md:flex-row justify-between items-center gap-4 text-sm ${palette.secondaryText}`}>
              <div className="text-center md:text-left">
                <p>📅 创建时间: {new Date(plan.created_at).toLocaleString('zh-CN')}</p>
              </div>
              <div className="flex gap-4">
                <Link
                  to="/learning-map"
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  🗺️ 查看知识图谱
                </Link>
                <Link
                  to="/quiz"
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  📝 开始测评
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudyPlan;
