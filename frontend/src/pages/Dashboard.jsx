import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { BookOpenIcon } from '../components/icons/index.jsx';
import { AppBadge } from '../components/ui/AppBadge';
import { getUserId } from '../utils/auth';
import logger from '../utils/logger';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

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
        logger.error('加载数据失败', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const cardBase = `${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white border-gray-100 shadow-card'} border rounded-xl`;

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
      color: 'primary',
      bgLight: 'bg-primary-100',
      bgDark: 'bg-primary-900/30',
      textLight: 'text-primary-600',
      textDark: 'text-primary-400',
      hoverBorder: 'hover:border-primary-300',
      hoverBorderDark: 'hover:border-primary-600/50',
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
      color: 'ai',
      bgLight: 'bg-ai-100',
      bgDark: 'bg-ai-900/30',
      textLight: 'text-ai-600',
      textDark: 'text-ai-400',
      hoverBorder: 'hover:border-ai-300',
      hoverBorderDark: 'hover:border-ai-600/50',
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
      color: 'success',
      bgLight: 'bg-success-50',
      bgDark: 'bg-success-500/10',
      textLight: 'text-success-600',
      textDark: 'text-success-400',
      hoverBorder: 'hover:border-success-300',
      hoverBorderDark: 'hover:border-success-600/50',
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
      color: 'warning',
      bgLight: 'bg-warning-50',
      bgDark: 'bg-warning-500/10',
      textLight: 'text-warning-600',
      textDark: 'text-warning-400',
      hoverBorder: 'hover:border-warning-300',
      hoverBorderDark: 'hover:border-warning-600/50',
    },
  ];

  const statItems = stats ? [
    { label: '平均得分', value: stats.average_score || 0, unit: '分', variant: 'primary' },
    { label: '完成率', value: stats.completion_rate || 0, unit: '%', variant: 'success' },
    { label: '已完成测验', value: stats.total_tests || 0, unit: '次', variant: 'ai' },
    { label: '学习计划', value: stats.total_plans || 0, unit: '个', variant: 'warning' },
  ] : [];

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#0b1120]' : 'bg-[#f0f5ff]'}`}>
        <div className="container-xl px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className={`h-40 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl`} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-40 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0b1120]' : 'bg-[#f0f5ff]'}`}>
      <div className="container-xl px-4 py-8 space-y-8">
        {/* Hero 区域 - 渐变背景 */}
        <div
          className={`rounded-2xl p-8 relative overflow-hidden border ${
            isDark
              ? 'hero-gradient text-white border-transparent'
              : 'bg-[linear-gradient(135deg,#f7f2e8_0%,#f2eadb_55%,#ebe1cf_100%)] text-slate-900 border-[#e5d8bc] shadow-sm'
          }`}
        >
          {/* 装饰性背景元素 */}
          <div className={`absolute top-0 right-0 w-64 h-64 ${isDark ? 'opacity-10' : 'opacity-30'}`}>
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="100" r="80" stroke={isDark ? 'white' : '#b89c6c'} strokeWidth="2" />
              <circle cx="100" cy="100" r="60" stroke={isDark ? 'white' : '#b89c6c'} strokeWidth="1.5" />
              <circle cx="100" cy="100" r="40" stroke={isDark ? 'white' : '#b89c6c'} strokeWidth="1" />
              <circle cx="100" cy="100" r="20" fill={isDark ? 'white' : '#c9ab77'} opacity="0.22" />
            </svg>
          </div>
          <div className="relative z-10">
            <AppBadge
              variant="ai"
              size="sm"
              className={`mb-4 ${
                isDark
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/70 text-[#7b6240] border-[#dcc9a6]'
              }`}
            >
              AI 驱动
            </AppBadge>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 font-heading">
              欢迎来到智学伴
            </h1>
            <p className={`text-lg max-w-xl ${isDark ? 'text-white/80' : 'text-slate-600'}`}>
              AI 驱动的个性化学习平台，根据你的学习进度和目标，智能生成学习计划和测验
            </p>
          </div>
        </div>

        {/* 核心功能卡片 */}
        <div>
          <h2 className={`text-xl font-semibold mb-4 font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
            核心功能
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature) => (
              <Link
                key={feature.title}
                to={feature.link}
                className={`${cardBase} p-6 group cursor-pointer transition-all duration-250 ease-smooth ${isDark ? feature.hoverBorderDark : feature.hoverBorder} hover:shadow-lg hover:-translate-y-1`}
              >
                <div className={`w-12 h-12 rounded-xl ${isDark ? feature.bgDark : feature.bgLight} flex items-center justify-center mb-4 ${isDark ? feature.textDark : feature.textLight} group-hover:scale-110 transition-transform duration-200`}>
                  {feature.icon}
                </div>
                <h3 className={`text-base font-semibold mb-1.5 font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {feature.desc}
                </p>
                <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${isDark ? 'text-slate-500 group-hover:text-primary-400' : 'text-gray-400 group-hover:text-primary-600'} transition-colors`}>
                  开始使用
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 数据统计 */}
        {statItems.length > 0 && (
          <div>
            <h2 className={`text-xl font-semibold mb-4 font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
              学习数据
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statItems.map(({ label, value, unit, variant }) => {
                const colorMap = {
                  primary: { text: isDark ? 'text-primary-400' : 'text-primary-600', bg: isDark ? 'bg-primary-900/20' : 'bg-primary-50' },
                  success: { text: isDark ? 'text-success-400' : 'text-success-600', bg: isDark ? 'bg-success-500/10' : 'bg-success-50' },
                  ai: { text: isDark ? 'text-ai-400' : 'text-ai-600', bg: isDark ? 'bg-ai-500/10' : 'bg-ai-50' },
                  warning: { text: isDark ? 'text-warning-400' : 'text-warning-600', bg: isDark ? 'bg-warning-500/10' : 'bg-warning-50' },
                };
                const c = colorMap[variant] || colorMap.primary;
                return (
                  <div key={label} className={`${cardBase} p-5`}>
                    <div className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {label}
                    </div>
                    <div className={`text-3xl font-bold font-heading ${c.text}`}>
                      {value}<span className="text-lg font-normal ml-1 opacity-70">{unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 快速开始 */}
        <div className={cardBase}>
          <div className="p-6">
            <h2 className={`text-xl font-semibold mb-5 font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
              快速开始
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/agent"
                className={`p-5 rounded-xl border transition-all duration-200 group ${
                  isDark
                    ? 'border-slate-700/50 hover:border-primary-600/50 hover:bg-slate-700/30'
                    : 'border-gray-100 hover:border-primary-200 hover:bg-primary-50/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-100 text-primary-600'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <span className={`font-medium font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    开始对话
                  </span>
                </div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  向AI助手提问学习问题
                </div>
              </Link>
              <Link
                to="/quiz"
                className={`p-5 rounded-xl border transition-all duration-200 group ${
                  isDark
                    ? 'border-slate-700/50 hover:border-ai-600/50 hover:bg-slate-700/30'
                    : 'border-gray-100 hover:border-ai-200 hover:bg-ai-50/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-ai-900/30 text-ai-400' : 'bg-ai-100 text-ai-600'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <span className={`font-medium font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    创建测验
                  </span>
                </div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  生成个性化练习题
                </div>
              </Link>
              <Link
                to="/study-plan"
                className={`p-5 rounded-xl border transition-all duration-200 group ${
                  isDark
                    ? 'border-slate-700/50 hover:border-success-600/50 hover:bg-slate-700/30'
                    : 'border-gray-100 hover:border-success-200 hover:bg-success-50/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-success-500/10 text-success-400' : 'bg-success-50 text-success-600'}`}>
                    <BookOpenIcon className="w-4 h-4" />
                  </div>
                  <span className={`font-medium font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    制定计划
                  </span>
                </div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  规划你的学习路径
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
