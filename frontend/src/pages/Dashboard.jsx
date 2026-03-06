import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function Dashboard() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // 获取用户ID
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
    } catch (error) {
      alert('PDF下载失败: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className={`h-48 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-32 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
              ))}
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

  const lineData = progress?.score_trend || [];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 顶部欢迎区 */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                学习中心
              </h1>
              <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                欢迎回来，继续你的学习之旅
              </p>
            </div>
            <button
              onClick={handleDownloadReport}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              导出学习报告
            </button>
          </div>
        </div>

        {/* 数据统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>平均得分</span>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {progress?.average_score || 0}
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>分</div>
          </div>

          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>完成率</span>
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {progress?.completion_rate || 0}%
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>学习进度</div>
          </div>

          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>已完成测验</span>
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {progress?.total_tests || 0}
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>次</div>
          </div>

          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>学习计划</span>
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {progress?.total_plans || 0}
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>个</div>
          </div>
        </div>

        {/* 图表区域 */}
        {progress && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 得分趋势 */}
            {lineData.length > 0 && (
              <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  得分趋势
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis
                      dataKey="index"
                      stroke={isDark ? '#9ca3af' : '#6b7280'}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke={isDark ? '#9ca3af' : '#6b7280'}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDark ? '#475569' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 弱项分析 */}
            {progress.weak_topics && progress.weak_topics.length > 0 && (
              <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  需要加强的方面
                </h3>
                <div className="space-y-3">
                  {progress.weak_topics.map((topic, index) => (
                    <div             key={index}
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
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            学习工具
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/agent"
              className={`group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-white border-gray-200 hover:border-blue-500'} border rounded-lg p-6 transition`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    AI 助手
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    智能问答，搜索资源，自主完成学习任务
                  </p>
                </div>
                <svg className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-gray-400'} group-hover:text-blue-600 transition`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/study-plan"
              className={`group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-green-500' : 'bg-white border-gray-200 hover:border-green-500'} border rounded-lg p-6 transition`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    学习计划
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    个性化学习路径
                  </p>
                </div>
                <svg className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-gray-400'} group-hover:text-green-600 transition`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/quiz"
              className={`group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-purple-500' : 'bg-white border-gray-200 hover:border-purple-500'} border rounded-lg p-6 transition`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    智能测评
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    智能出题，精准定位薄弱环节
                  </p>
                </div>
                <svg className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-gray-400'} group-hover:text-purple-600 transition`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/learning-map"
              className={`group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-orange-500' : 'bg-white border-gray-200 hover:border-orange-500'} border rounded-lg p-6 transition`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    知识图谱
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    可视化知识结构，理清学习脉络
                  </p>
                </div>
                <svg className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-gray-400'} group-hover:text-orange-600 transition`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/upload-file"
              className={`group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-cyan-500' : 'bg-white border-gray-200 hover:border-cyan-500'} border rounded-lg p-6 transition`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    上传资料
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    上传学习资料，生成知识图谱
                  </p>
                </div>
                <svg className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-gray-400'} group-hover:text-cyan-600 transition`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
