import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { BookOpenIcon } from '../components/icons/index.jsx';


function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const getUserId = () => {
    const userInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        return JSON.parse(userInfo).id;
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
          setLoading(false);
          return;
        }
        const response = await api.get(`/api/v1/analytics/progress/${userId}`);
        setStats(response.data);
      } catch (err) {
        console.error('加载数据失败:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const cardBase = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg`;

  // 核心功能卡片
  const features = [
    {
      title: 'AI 智能助手',
      desc: '与AI对话，解答学习疑问',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      link: '/agent',
      color: 'blue',
    },
    {
      title: '智能组卷',
      desc: '自动生成个性化测验',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      link: '/quiz',
      color: 'purple',
    },
    {
      title: '学习计划',
      desc: '制定科学的学习路径',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      link: '/study-plan',
      color: 'green',
    },
    {
      title: '知识图谱',
      desc: '可视化知识结构',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      link: '/learning-map',
      color: 'orange',
    },
  ];

  const colorClasses = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:bg-blue-50' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', hover: 'hover:bg-purple-50' },
    green: { bg: 'bg-green-100', text: 'text-green-600', hover: 'hover:bg-green-50' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', hover: 'hover:bg-orange-50' },
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className={`h-32 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-40 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero 区域 */}
        <div className={`${cardBase} p-8 mb-8`}>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            欢迎来到智学伴
          </h1>
          <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            AI 驱动的个性化学习平台，让学习更高效
          </p>
        </div>

        {/* 核心功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {features.map((feature) => {
            const colors = colorClasses[feature.color];
            return (
              <Link
                key={feature.title}
                to={feature.link}
                className={`${cardBase} p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group`}
              >
                <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center mb-4 ${colors.text} group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  {feature.desc}
                </p>
              </Link>
            );
          })}
        </div>

        {/* 数据统计 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: '平均得分', value: stats.average_score || 0, unit: '分', color: 'blue' },
              { label: '完成率', value: stats.completion_rate || 0, unit: '%', color: 'green' },
              { label: '已完成测验', value: stats.total_tests || 0, unit: '次', color: 'purple' },
              { label: '学习计划', value: stats.total_plans || 0, unit: '个', color: 'orange' },
            ].map(({ label, value, unit, color }) => {
              const colors = colorClasses[color];
              return (
                <div key={label} className={`${cardBase} p-5`}>
                  <div className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    {label}
                  </div>
                  <div className={`text-3xl font-bold ${colors.text}`}>
                    {value}<span className="text-lg font-normal ml-1">{unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 快速开始 */}
        <div className={`${cardBase} p-6`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            快速开始
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/agent"
              className={`p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
            >
              <div className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                💬 开始对话
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                向AI助手提问学习问题
              </div>
            </Link>
            <Link
              to="/quiz"
              className={`p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
            >
              <div className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                📝 创建测验
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                生成个性化练习题
              </div>
            </Link>
            <Link
              to="/study-plan"
              className={`p-4 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
            >
              <div className={`font-medium mb-1 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <BookOpenIcon className="w-4 h-4" />
                制定计划
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                规划你的学习路径
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
