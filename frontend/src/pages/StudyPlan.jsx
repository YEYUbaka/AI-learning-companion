import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { getUserId } from '../utils/auth';
import logger from '../utils/logger';

function StudyPlan() {
  const location = useLocation();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedDays, setCompletedDays] = useState(new Set());
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formGoal, setFormGoal] = useState('');
  const [formDays, setFormDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (location.state?.plan) {
      setPlan(location.state.plan);
      loadCompletedDays(location.state.plan.id);
    } else {
      loadLatestPlan();
    }
  }, [location]);

  const loadLatestPlan = async () => {
    setLoading(true);
    setError('');
    try {
      const userId = getUserId();
      const response = await api.get(`/api/v1/ai/plan/list/${userId}`);
      if (response.data && response.data.length > 0) {
        setPlan(response.data[0]);
        loadCompletedDays(response.data[0].id);
      } else {
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
        duration_days: formDays
      }, { timeout: 120000 });
      setPlan(response.data);
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
    if (saved) {
      try {
        setCompletedDays(new Set(JSON.parse(saved)));
      } catch (e) {
        logger.error('加载完成状态失败', e);
      }
    }
  };

  const toggleDayCompletion = (day) => {
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

  const getCurrentTask = () => {
    if (!plan || !plan.plan) return null;
    for (let i = 0; i < plan.plan.length; i++) {
      if (!completedDays.has(plan.plan[i].day)) {
        return plan.plan[i];
      }
    }
    return null;
  };

  const cardBase = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg`;

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className={`h-32 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
            <div className={`h-48 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className={`${cardBase} p-8 text-center`}>
              <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-100 text-primary-600'}`}>
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              暂无学习计划
            </h2>
            <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              请先创建学习计划
            </p>
            <button
              onClick={() => { setError(''); setShowCreateForm(true); }}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
            >
              创建学习计划
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!plan && !showCreateForm) return null;

  const planData = plan?.plan || [];
  const totalDays = planData.length;
  const completed = completedDays.size;
  const progress = totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;
  const currentTask = planData.length > 0 ? getCurrentTask() : null;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* 创建表单 */}
        {showCreateForm && (
          <div className={`${cardBase} p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              创建学习计划
            </h2>
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  学习目标
                </label>
                <input
                  type="text"
                  value={formGoal}
                  onChange={(e) => setFormGoal(e.target.value)}
                  placeholder="例如：三天掌握 Python 基础"
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  计划天数
                </label>
                <input
                  type="number"
                  value={formDays}
                  onChange={(e) => setFormDays(Number(e.target.value))}
                  min={1}
                  max={60}
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  建议 7-30 天，最长不超过 60 天
                </p>
              </div>
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={generating}
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {generating ? '生成中...' : '生成计划'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setError(''); }}
                  className={`px-6 py-2 rounded-lg transition-colors font-medium ${
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

        {/* 计划概览 */}
        {plan && (
          <div className={`${cardBase} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {plan.goal || '学习计划'}
              </h1>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                新建计划
              </button>
            </div>

            {/* 进度条 */}
            <div className={`h-3 rounded-full mb-4 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>总天数</div>
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalDays}</div>
              </div>
              <div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>已完成</div>
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{completed}</div>
              </div>
              <div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>剩余</div>
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalDays - completed}</div>
              </div>
            </div>
          </div>
        )}

        {/* 当前任务 */}
        {currentTask && (
          <div className={`${cardBase} p-6 border-2 ${isDark ? 'border-blue-500' : 'border-blue-600'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  当前任务
                </div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  第 {currentTask.day} 天：{currentTask.topic}
                </h2>
              </div>
              <button
                onClick={() => toggleDayCompletion(currentTask.day)}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                标记完成
              </button>
            </div>
            {currentTask.tasks && currentTask.tasks.length > 0 && (
              <ul className={`space-y-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                {currentTask.tasks.map((task, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 学习路径 */}
        <div className={`${cardBase} p-6`}>
          <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            学习路径
          </h2>
          <div className="space-y-3">
            {planData.map((item) => {
              const isCompleted = completedDays.has(item.day);
              const isExpanded = expandedDays.has(item.day);
              const isCurrent = currentTask && currentTask.day === item.day;

              return (
                <div
                  key={item.day}
                  className={`${cardBase} p-4 ${isCurrent ? 'ring-2 ring-blue-600' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleDayCompletion(item.day)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-green-600 border-green-600'
                            : isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {isCompleted && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1">
                        <div className={`font-medium ${isCompleted ? 'line-through opacity-60' : ''} ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          第 {item.day} 天：{item.topic}
                        </div>
                      </div>
                      {item.tasks && item.tasks.length > 0 && (
                        <button
                          onClick={() => toggleDay(item.day)}
                          className={`p-1 rounded hover:bg-opacity-10 ${isDark ? 'hover:bg-white' : 'hover:bg-black'}`}
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-gray-600'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && item.tasks && item.tasks.length > 0 && (
                    <ul className={`mt-3 ml-9 space-y-1 ${isDark ? 'text-slate-400' : 'text-gray-600'} text-sm`}>
                      {item.tasks.map((task, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudyPlan;
