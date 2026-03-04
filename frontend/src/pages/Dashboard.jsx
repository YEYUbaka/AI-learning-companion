import { Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function Dashboard() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            pageBg: 'bg-slate-900',
            accentGlow: 'bg-blue-900/20',
            heroCard: 'bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-700',
            heroText: 'text-white',
            heroSub: 'text-slate-300',
            secondaryCard: 'bg-slate-800 text-white',
            statsCard: 'bg-slate-800 border border-slate-700 text-white',
            sectionCard: 'bg-slate-800 border border-slate-700 text-white',
            sectionText: 'text-slate-300',
            actionButton: 'bg-blue-600 text-white hover:bg-blue-700',
            cardBase: 'bg-slate-800 border border-slate-700 text-white shadow-lg',
            linkAccent: 'text-blue-400 hover:text-blue-300',
            listBg: 'bg-slate-700 border border-slate-600 text-white',
            listText: 'text-slate-300',
            chartCard: 'bg-slate-800 border border-slate-700 text-white',
            chip: 'text-slate-400',
          }
        : {
            pageBg: 'bg-gray-50',
            accentGlow: 'bg-blue-50',
            heroCard: 'bg-white rounded-2xl p-8 shadow-lg border border-gray-200',
            heroText: 'text-gray-900',
            heroSub: 'text-gray-600',
            secondaryCard: 'bg-blue-600 text-white',
            statsCard: 'bg-white rounded-2xl shadow-lg p-8 border border-gray-200',
            sectionCard: 'bg-white rounded-2xl shadow-lg p-8 border border-gray-200',
            sectionText: 'text-gray-600',
            actionButton: 'bg-blue-600 text-white hover:bg-blue-700',
            cardBase: 'bg-white rounded-xl shadow-md p-6 border border-gray-200',
            linkAccent: 'text-blue-600 hover:text-blue-700',
            listBg: 'bg-amber-50 border border-amber-200',
            listText: 'text-gray-700',
            chartCard: 'bg-white rounded-xl p-5 border border-gray-200',
            chip: 'text-gray-600',
          },
    [isDark]
  );

  // 获取用户ID
  const getUserId = () => {
    // 优先从sessionStorage获取，如果没有则从localStorage（向后兼容）
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
    setMounted(true);
  }, []);

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
    if (!userId) {
      alert('请先登录');
      return;
    }
    try {
      // 使用fetch先触发请求，确保后端日志能记录
      const response = await fetch(`${api.defaults.baseURL}/api/v1/analytics/report/${userId}`);
      
      if (response.ok) {
        // 创建blob并下载
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
    } catch (error) {
      alert('PDF下载失败: ' + error.message);
    }
  };

  // 图表颜色配置
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className={`min-h-screen ${palette.pageBg} relative overflow-hidden`}>
        <div className="absolute inset-0 -z-10">
          <div className={`absolute -top-16 -left-10 w-72 h-72 ${palette.accentGlow} rounded-full blur-3xl opacity-70`} />
          <div className={`absolute top-20 right-0 w-96 h-96 ${palette.accentGlow} rounded-full blur-3xl opacity-40`} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white/70 rounded-3xl p-8 shadow-xl border border-slate-100 animate-pulse">
              <div className="h-6 w-32 bg-slate-200 rounded mb-6" />
              <div className="h-10 w-3/4 bg-slate-200 rounded mb-4" />
              <div className="h-4 w-full bg-slate-200 rounded mb-2" />
              <div className="h-4 w-5/6 bg-slate-200 rounded mb-8" />
              <div className="flex gap-4">
                <div className="h-12 flex-1 bg-slate-200 rounded-2xl" />
                <div className="h-12 flex-1 bg-slate-200 rounded-2xl" />
              </div>
            </div>
            <div className="bg-slate-900/80 rounded-3xl p-8 shadow-xl border border-slate-800 animate-pulse">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="bg-white/10 rounded-2xl h-24" />
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 animate-pulse">
            <div className="h-6 w-40 bg-slate-200 rounded mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-28 bg-slate-200 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-slate-200 rounded-2xl" />
              <div className="h-64 bg-slate-200 rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-48 bg-white rounded-2xl shadow-lg border border-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  // 准备图表数据
  const pieData = progress ? [
    { name: '平均得分', value: progress.average_score || 0 },
    { name: '完成率', value: progress.completion_rate || 0 },
  ] : [];

  const lineData = progress?.score_trend || [];

  return (
    <div className={`min-h-screen ${palette.pageBg} relative overflow-hidden`}>
      <div className="absolute inset-0 -z-10">
        <div className={`absolute -top-20 -left-10 w-96 h-96 ${palette.accentGlow} rounded-full blur-3xl opacity-60 animate-pulse`} />
        <div className={`absolute top-20 right-0 w-[420px] h-[420px] ${palette.accentGlow} rounded-full blur-3xl opacity-40 animate-[pulse_10s_ease-in-out_infinite]`} />
        <div className={`absolute bottom-0 left-1/3 w-80 h-80 ${palette.accentGlow} rounded-full blur-3xl opacity-30`} />
      </div>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-12 space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Hero */}
        <section className={`grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className={`${palette.heroCard} p-4 sm:p-6 lg:p-8`}>
            <p className={`text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.3em] ${isDark ? 'text-cyan-300' : 'text-primary'} mb-3 sm:mb-4`}>智学伴 · AI 驱动</p>
            <h1 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold ${palette.heroText} leading-tight mb-4 sm:mb-6`}>
              欢迎回来，
              <span className={`block sm:inline ${isDark ? 'text-cyan-300' : 'text-primary'}`}>开启今日的高效学习</span>
            </h1>
            <p className={`text-sm sm:text-base lg:text-lg ${palette.heroSub} mb-6 sm:mb-8`}>
              上传资料、生成学习计划、实时监控掌握度。AI 助手随时待命，陪你攻克每一个知识点。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/upload-file"
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base lg:text-lg font-semibold transition-transform active:scale-95 ${palette.actionButton}`}
              >
                <span className="text-base sm:text-lg">📤</span>
                <span className="hidden sm:inline">上传资料 · 秒变图谱</span>
                <span className="sm:hidden">上传资料</span>
              </Link>
              <Link
                to="/ai"
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold transition active:scale-95 ${
                  isDark
                    ? 'border border-white/15 bg-transparent text-white hover:border-cyan-400 hover:bg-white/5'
                    : 'border border-slate-200 bg-white text-primary hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <span className="text-base sm:text-lg">💬</span>
                <span className="hidden sm:inline">进入 AI 助手</span>
                <span className="sm:hidden">AI 助手</span>
              </Link>
            </div>
          </div>
          <div className={`${palette.secondaryCard} rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_rgba(255,255,255,0.4)_1px,_transparent_1px)] bg-[length:24px_24px]" />
            <div className="relative z-10 space-y-4 sm:space-y-6">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold">今日学习概览</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="rounded-xl sm:rounded-2xl bg-white/10 p-2 sm:p-4">
                  <p className="text-xs sm:text-sm text-blue-100">计划完成率</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2">{progress?.completion_rate || 0}%</p>
                  <p className="text-xs text-slate-200 mt-1 hidden sm:block">较昨日 +8%</p>
                </div>
                <div className="rounded-xl sm:rounded-2xl bg-white/10 p-2 sm:p-4">
                  <p className="text-xs sm:text-sm text-blue-100">平均得分</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2">{progress?.average_score || 0}</p>
                  <p className="text-xs text-slate-200 mt-1 hidden sm:block">近五次测验</p>
                </div>
                <div className="rounded-xl sm:rounded-2xl bg-white/10 p-2 sm:p-4">
                  <p className="text-xs sm:text-sm text-blue-100">学习时长</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2">{progress?.study_minutes || 0}m</p>
                  <p className="text-xs text-slate-200 mt-1 hidden sm:block">连续打卡</p>
                </div>
                <div className="rounded-xl sm:rounded-2xl bg-white/10 p-2 sm:p-4">
                  <p className="text-xs sm:text-sm text-blue-100">知识图谱</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2">{progress?.map_sessions || 0}</p>
                  <p className="text-xs text-slate-200 mt-1 hidden sm:block">已生成次数</p>
                </div>
              </div>
              <Link
                to="/learning-map"
                className="inline-flex items-center gap-2 text-sm font-medium text-cyan-100 hover:text-white transition"
              >
                进入最新知识图谱 →
              </Link>
            </div>
          </div>
        </section>

        {/* 学习可视化统计 */}
        {progress && (
          <section
            className={`${palette.sectionCard} transition-all duration-700 delay-100 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
              <div>
                <h2 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>📊 学习仪表盘</h2>
                <p className={`${palette.sectionText} mt-1 sm:mt-2 text-sm sm:text-base`}>跟踪你的掌握度、弱项和学习效率</p>
              </div>
              <button
                onClick={handleDownloadReport}
                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold transition active:scale-95 ${palette.actionButton}`}
              >
                <span>📄</span>
                <span className="hidden sm:inline">导出学习报告</span>
                <span className="sm:hidden">导出报告</span>
              </button>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
              <div
                className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 border ${
                  isDark ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-100'
                }`}
              >
                <div className={`text-xs sm:text-sm ${palette.chip} mb-1`}>平均得分</div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-400">{progress.average_score || 0}</div>
                <div className={`text-xs ${palette.chip} mt-1`}>分</div>
              </div>
              <div
                className={`rounded-2xl p-5 border ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-gradient-to-br from-green-50 to-green-100 border-green-100'
                }`}
              >
                <div className={`text-sm ${palette.chip} mb-1`}>完成率</div>
                <div className="text-3xl font-bold text-emerald-400">{progress.completion_rate || 0}%</div>
                <div className={`text-xs ${palette.chip} mt-1`}>学习进度</div>
              </div>
              <div
                className={`rounded-2xl p-5 border ${
                  isDark ? 'bg-purple-500/10 border-purple-500/30 text-white' : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-100'
                }`}
              >
                <div className={`text-sm ${palette.chip} mb-1`}>已完成测验</div>
                <div className="text-3xl font-bold text-purple-400">{progress.total_tests || 0}</div>
                <div className={`text-xs ${palette.chip} mt-1`}>次</div>
              </div>
              <div
                className={`rounded-2xl p-5 border ${
                  isDark ? 'bg-amber-500/10 border-amber-500/30 text-white' : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-100'
                }`}
              >
                <div className={`text-sm ${palette.chip} mb-1`}>学习计划</div>
                <div className="text-3xl font-bold text-amber-400">{progress.total_plans || 0}</div>
                <div className={`text-xs ${palette.chip} mt-1`}>个</div>
              </div>
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 得分趋势折线图 */}
              {lineData.length > 0 && (
                <div className={palette.chartCard}>
                  <h3 className="text-lg font-semibold mb-4">得分趋势</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="index" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 学习进度饼图 */}
              {pieData.length > 0 && (
                <div className={palette.chartCard}>
                  <h3 className="text-lg font-semibold mb-4">学习进度</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* 弱项分析 */}
            {progress.weak_topics && progress.weak_topics.length > 0 && (
              <div className={`${palette.listBg} rounded-2xl p-6 mb-6`}>
                <h3 className="text-lg font-semibold mb-3">⚠️ 需要加强的方面</h3>
                <ul className="list-disc ml-5 space-y-1">
                  {progress.weak_topics.map((topic, index) => (
                    <li key={index} className={`${palette.listText}`}>{topic}</li>
                  ))}
                </ul>
                <p className={`text-sm mt-3 ${palette.listText}`}>
                  建议针对这些方面进行重点学习和练习。
                </p>
              </div>
            )}
          </section>
        )}

        {/* 功能卡片 */}
        <section className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 transition-all duration-700 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Link
            to="/ai"
            className={`group ${palette.cardBase} hover:border-primary/40 transition`}
          >
            <div className="flex flex-col gap-3">
              <div className="text-4xl">🤖</div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI助手</h3>
              <p className={`${palette.sectionText} flex-1`}>智能问答，随时解锁解题思路与学习建议。</p>
              <span className={`${palette.linkAccent} font-semibold group-hover:translate-x-1 transition`}>立即进入 →</span>
            </div>
          </Link>

          <Link
            to="/study-plan"
            className={`group ${palette.cardBase} hover:border-primary/40 transition`}
          >
            <div className="flex flex-col gap-3">
              <div className="text-4xl">📚</div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>学习计划</h3>
              <p className={`${palette.sectionText} flex-1`}>查看 AI 自动拆解的每日任务与关键知识点。</p>
              <span className={`${palette.linkAccent} font-semibold group-hover:translate-x-1 transition`}>查看计划 →</span>
            </div>
          </Link>

          <Link
            to="/quiz"
            className={`group ${palette.cardBase} hover:border-primary/40 transition`}
          >
            <div className="flex flex-col gap-3">
              <div className="text-4xl">📝</div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI测评</h3>
              <p className={`${palette.sectionText} flex-1`}>智能出题、自动批改，精准定位弱项。</p>
              <span className={`${palette.linkAccent} font-semibold group-hover:translate-x-1 transition`}>开始测评 →</span>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;

