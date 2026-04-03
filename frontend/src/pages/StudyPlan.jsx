import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { getUserId } from '../utils/auth';

function StudyPlan() {
  const location = useLocation();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedDays, setCompletedDays] = useState(new Set());
  const [expandedDays, setExpandedDays] = useState(new Set());
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
        setError('暂无学习计划');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedDays = (planId) => {
    const saved = localStorage.getItem(`plan_${planId}_completed`);
    if (saved) {
      try {
        setCompletedDays(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('加载完成状态失败:', e);
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
            <div className="text-6xl mb-4">📚</div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              暂无学习计划
            </h2>
            <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              请先创建学习计划
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan || !plan.plan) return null;

  const totalDays = plan.plan.length;
  const completed = completedDays.size;
  const progress = totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;
  const currentTask = getCurrentTask();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* 计划概览 */}
        <div className={`${cardBase} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {plan.goal || '学习计划'}
            </h1>
            <span className={`text-3xl font-bold ${progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>
              {progress}%
            </span>
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
            {plan.plan.map((item) => {
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
