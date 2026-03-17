import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

// 数字递增动画 hook
function useCountUp(target, duration = 900) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) { setCount(0); return; }
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(end * eased));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

function Dashboard() {
  const [progress, setProgress] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

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
    async function fetchData() {
      try {
        const userId = getUserId();
        if (!userId) {
          setError('请先登录');
          setLoading(false);
          return;
        }
        const response = await api.get(`/api/v1/analytics/progress/${userId}`);
        setProgress(response.data);

        // 获取详细统计（非阻塞，失败不影响主界面）
        try {
          const statsResponse = await api.get(`/api/v1/analytics/stats/${userId}`);
          setStats(statsResponse.data);
        } catch {
          // 详细统计不可用时静默忽略
        }
      } catch (err) {
        setError(err.response?.data?.detail || '加载数据失败');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleDownloadReport = async () => {
    const userId = getUserId();
    if (!userId) { alert('请先登录'); return; }
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/v1/analytics/report/${userId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `智学伴_学习报告_${userId}_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('PDF下载失败，请稍后重试');
      }
    } catch (err) {
      alert('PDF下载失败: ' + err.message);
    }
  };

  // 动画计数值
  const animatedScore = useCountUp(progress?.average_score);
  const animatedRate = useCountUp(progress?.completion_rate);
  const animatedTests = useCountUp(progress?.total_tests);
  const animatedPlans = useCountUp(progress?.total_plans);

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className={`h-24 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-28 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`h-72 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
              <div className={`h-72 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  // 得分趋势数据（优先使用 date 字段）
  const lineData = (progress?.score_trend || []).map((item, i) => ({
    ...item,
    label: item.date
      ? new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      : `第${i + 1}次`,
  }));

  // 近5次得分（优先用 recent_scores，否则取 score_trend 最后5条）
  const recentScores = (() => {
    if (progress?.recent_scores && Array.isArray(progress.recent_scores)) {
      return progress.recent_scores.map((s, i) => ({
        name: `第${i + 1}次`,
        score: typeof s === 'number' ? s : s.score,
      }));
    }
    return lineData.slice(-5).map((d, i) => ({ name: d.label || `第${i + 1}次`, score: d.score }));
  })();

  // 主题统计数据
  const topicData = (() => {
    const source = stats?.topic_statistics || progress?.topic_statistics;
    if (!source || !Array.isArray(source)) return [];
    return source.slice(0, 8).map((t) => ({
      name: t.topic || t.name || '未知',
      score: t.average_score ?? t.score ?? 0,
      count: t.count ?? 1,
    }));
  })();

  const chartColors = {
    grid: isDark ? '#334155' : '#e5e7eb',
    axis: isDark ? '#94a3b8' : '#6b7280',
    tooltip: {
      bg: isDark ? '#1e293b' : '#ffffff',
      border: isDark ? '#475569' : '#e5e7eb',
      text: isDark ? '#f1f5f9' : '#111827',
    },
  };

  const cardBase = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 顶部欢迎区 */}
        <div className={`${cardBase} p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                学习中心
              </h1>
              <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                欢迎回来，继续你的学习之旅
              </p>
            </div>
            <button
              onClick={handleDownloadReport}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              导出学习报告
            </button>
          </div>
        </div>

        {/* 数据统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: '平均得分',
              value: animatedScore,
              unit: '分',
              icon: (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              iconBg: 'bg-blue-100',
            },
            {
              label: '完成率',
              value: animatedRate,
              unit: '%',
              icon: (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              iconBg: 'bg-green-100',
            },
            {
              label: '已完成测验',
              value: animatedTests,
              unit: '次',
              icon: (
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ),
              iconBg: 'bg-purple-100',
            },
            {
              label: '学习计划',
              value: animatedPlans,
              unit: '个',
              icon: (
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              ),
              iconBg: 'bg-orange-100',
            },
          ].map(({ label, value, unit, icon, iconBg }) => (
            <div
              key={label}
              className={`${cardBase} p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{label}</span>
                <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                  {icon}
                </div>
              </div>
              <div className={`text-3xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {value}<span className={`text-sm font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        {progress && (
          <div className="space-y-6 mb-6">
            {/* 第一行：得分趋势 + 近5次得分 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 得分趋势折线图 */}
              {lineData.length > 0 && (
                <div className={`${cardBase} p-6`}>
                  <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    得分趋势
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis
                        dataKey="label"
                        stroke={chartColors.axis}
                        style={{ fontSize: '11px' }}
                        tick={{ fill: chartColors.axis }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke={chartColors.axis}
                        style={{ fontSize: '11px' }}
                        tick={{ fill: chartColors.axis }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartColors.tooltip.bg,
                          border: `1px solid ${chartColors.tooltip.border}`,
                          borderRadius: '8px',
                          color: chartColors.tooltip.text,
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        name="得分"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ fill: '#3b82f6', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 近5次得分柱状图 */}
              {recentScores.length > 0 && (
                <div className={`${cardBase} p-6`}>
                  <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    近期得分
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={recentScores} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke={chartColors.axis}
                        style={{ fontSize: '11px' }}
                        tick={{ fill: chartColors.axis }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke={chartColors.axis}
                        style={{ fontSize: '11px' }}
                        tick={{ fill: chartColors.axis }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartColors.tooltip.bg,
                          border: `1px solid ${chartColors.tooltip.border}`,
                          borderRadius: '8px',
                          color: chartColors.tooltip.text,
                          fontSize: '12px',
                        }}
                        formatter={(v) => [`${v} 分`, '得分']}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {recentScores.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.score >= 80 ? '#22c55e' : entry.score >= 60 ? '#3b82f6' : '#f59e0b'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    {[
                      { color: 'bg-green-500', label: '优秀 (≥80)' },
                      { color: 'bg-blue-500', label: '良好 (≥60)' },
                      { color: 'bg-amber-500', label: '待提升 (<60)' },
                    ].map(({ color, label }) => (
                      <span key={label} className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        <span className={`w-2.5 h-2.5 rounded-sm inline-block ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 第二行：各主题得分分布（如有数据） */}
            {topicData.length > 0 && (
              <div className={`${cardBase} p-6`}>
                <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  各主题得分分布
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicData} barSize={28} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      stroke={chartColors.axis}
                      style={{ fontSize: '11px' }}
                      tick={{ fill: chartColors.axis }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      stroke={chartColors.axis}
                      style={{ fontSize: '11px' }}
                      tick={{ fill: chartColors.axis }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartColors.tooltip.bg,
                        border: `1px solid ${chartColors.tooltip.border}`,
                        borderRadius: '8px',
                        color: chartColors.tooltip.text,
                        fontSize: '12px',
                      }}
                      formatter={(v) => [`${v} 分`, '平均得分']}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 弱项分析 */}
            {progress.weak_topics && progress.weak_topics.length > 0 && (
              <div className={`${cardBase} p-6`}>
                <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  需要加强的方面
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {progress.weak_topics.map((topic, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        isDark ? 'bg-slate-700/50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {topic}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={`text-xs mt-4 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  建议针对这些方面进行重点学习和练习
                </p>
              </div>
            )}
          </div>
        )}

        {/* 快捷功能入口 */}
        <div>
          <h2 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            学习工具
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                to: '/agent',
                hoverBorder: 'hover:border-blue-500',
                iconBg: 'bg-blue-100',
                iconColor: 'text-blue-600',
                arrowHover: 'group-hover:text-blue-600',
                title: '智学助手',
                desc: '智能问答，搜索资源，自主完成学习任务',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                ),
              },
              {
                to: '/study-plan',
                hoverBorder: 'hover:border-green-500',
                iconBg: 'bg-green-100',
                iconColor: 'text-green-600',
                arrowHover: 'group-hover:text-green-600',
                title: '学习计划',
                desc: '个性化学习路径',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                ),
              },
              {
                to: '/quiz',
                hoverBorder: 'hover:border-purple-500',
                iconBg: 'bg-purple-100',
                iconColor: 'text-purple-600',
                arrowHover: 'group-hover:text-purple-600',
                title: '智能测评',
                desc: '智能出题，精准定位薄弱环节',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                ),
              },
              {
                to: '/learning-map',
                hoverBorder: 'hover:border-orange-500',
                iconBg: 'bg-orange-100',
                iconColor: 'text-orange-600',
                arrowHover: 'group-hover:text-orange-600',
                title: '知识图谱',
                desc: '可视化知识结构，理清学习脉络',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                ),
              },
              {
                to: '/upload-file',
                hoverBorder: 'hover:border-cyan-500',
                iconBg: 'bg-cyan-100',
                iconColor: 'text-cyan-600',
                arrowHover: 'group-hover:text-cyan-600',
                title: '上传资料',
                desc: '上传学习资料，生成知识图谱',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                ),
              },
            ].map(({ to, hoverBorder, iconBg, iconColor, arrowHover, title, desc, icon }) => (
              <Link
                key={to}
                to={to}
                className={`group ${
                  isDark
                    ? `bg-slate-800 border-slate-700 ${hoverBorder}`
                    : `bg-white border-gray-200 ${hoverBorder}`
                } border rounded-lg p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {icon}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {title}
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{desc}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${isDark ? 'text-slate-600' : 'text-gray-400'} ${arrowHover}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
