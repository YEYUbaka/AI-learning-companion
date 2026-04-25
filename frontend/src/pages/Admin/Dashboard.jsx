/**
 * 管理后台仪表盘
 * 统一 EdTech Modern 风格，并补齐移动端布局适配
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { getDashboardStats, getChartData } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
import { AppBadge } from '../../components/ui/AppBadge';
import logger from '../../utils/logger';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_users: 0,
    active_models: 0,
    total_prompts: 0,
    api_calls_today: 0,
    api_calls_total: 0,
  });
  const [chartData, setChartData] = useState({
    provider_stats: [],
    source_stats: [],
    daily_stats: [],
    is_hourly: false,
  });
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            subheading: 'text-slate-400',
            card: 'bg-slate-800/80 border border-slate-700/50 rounded-2xl',
            cardHover: 'hover:border-slate-600/50',
            label: 'text-slate-400',
            value: 'text-white',
            button: 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600',
            buttonActive: 'bg-primary-600 text-white border-primary-600',
            bg: 'bg-[#0b1120]',
            chartGrid: 'rgba(255,255,255,0.06)',
            chartText: 'rgba(255,255,255,0.5)',
            tooltipBg: '#1e293b',
            tooltipBorder: 'rgba(255,255,255,0.1)',
          }
        : {
            heading: 'text-gray-900',
            subheading: 'text-gray-500',
            card: 'bg-white border border-gray-100 rounded-2xl shadow-card',
            cardHover: 'hover:border-gray-200',
            label: 'text-gray-500',
            value: 'text-gray-900',
            button: 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200',
            buttonActive: 'bg-primary-600 text-white border-primary-600',
            bg: 'bg-[#f0f5ff]',
            chartGrid: 'rgba(0,0,0,0.06)',
            chartText: '#6b7280',
            tooltipBg: '#fff',
            tooltipBorder: '#e5e7eb',
          },
    [isDark]
  );

  const PIE_COLORS = ['#2563eb', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b'];

  useEffect(() => {
    fetchStats();
    fetchChartData();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (error) {
      logger.error('获取统计数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      setChartLoading(true);
      const response = await getChartData(timeRange);
      setChartData(response.data);
    } catch (error) {
      logger.error('获取图表数据失败', error);
    } finally {
      setChartLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className={palette.label}>加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    {
      label: '总用户数',
      value: stats.total_users,
      variant: 'primary',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      link: '/admin/users',
    },
    {
      label: '活跃模型',
      value: stats.active_models,
      variant: 'success',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      ),
      link: '/admin/models',
    },
    {
      label: 'Prompt总数',
      value: stats.total_prompts,
      variant: 'ai',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      link: '/admin/prompts',
    },
    {
      label: '今日API调用',
      value: stats.api_calls_today,
      variant: 'warning',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      link: '/admin/api-logs',
    },
    {
      label: '总API调用',
      value: stats.api_calls_total,
      variant: 'info',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
      link: '/admin/api-logs',
    },
  ];

  const handleCardClick = (link) => {
    if (link) navigate(link);
  };

  return (
    <AdminLayout>
      <div className={`${palette.bg} min-h-full p-4 sm:p-6`}>
        <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className={`text-2xl font-bold font-heading ${palette.heading}`}>系统概览</h1>
              <p className={`mt-1 text-sm ${palette.subheading}`}>实时监控系统运行状态</p>
            </div>
            <AppBadge variant="success" dot>运行正常</AppBadge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((card, index) => {
              const iconBgMap = {
                primary: isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-100 text-primary-600',
                success: isDark ? 'bg-success-500/10 text-success-400' : 'bg-success-50 text-success-600',
                ai: isDark ? 'bg-ai-500/10 text-ai-400' : 'bg-ai-50 text-ai-600',
                warning: isDark ? 'bg-warning-500/10 text-warning-400' : 'bg-warning-50 text-warning-600',
                info: isDark ? 'bg-info-500/10 text-info-400' : 'bg-info-50 text-info-600',
              };

              return (
                <div
                  key={index}
                  onClick={() => handleCardClick(card.link)}
                  className={`${palette.card} ${card.link ? palette.cardHover : ''} group cursor-pointer p-4 transition-all duration-200 sm:p-5`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className={`text-sm font-medium ${palette.label}`}>{card.label}</p>
                    {card.link ? (
                      <svg
                        className={`w-4 h-4 flex-shrink-0 ${palette.label} transition-colors group-hover:text-primary-500`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <p className={`text-3xl font-bold font-heading leading-none ${palette.value}`}>
                      {card.value.toLocaleString()}
                    </p>
                    <div className={`${iconBgMap[card.variant]} flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl`}>
                      {card.icon}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:gap-6 lg:grid-cols-2">
            <div className={`${palette.card} p-4 sm:p-6`}>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className={`text-base font-semibold font-heading ${palette.heading}`}>API调用趋势</h3>
                  <p className={`mt-0.5 text-xs ${palette.subheading}`}>
                    {chartData.is_hourly ? '周期：1小时' : `最近 ${timeRange} 天`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 7, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => setTimeRange(days)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        timeRange === days ? palette.buttonActive : palette.button
                      }`}
                    >
                      {days}天
                    </button>
                  ))}
                </div>
              </div>

              {chartLoading ? (
                <div className="flex h-72 items-center justify-center">
                  <div className={palette.label}>加载中...</div>
                </div>
              ) : chartData.daily_stats.length === 0 ? (
                <div className="flex h-72 items-center justify-center">
                  <div className={palette.label}>暂无数据</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData.daily_stats} margin={{ top: 5, right: 10, left: 0, bottom: chartData.is_hourly ? 50 : timeRange === 30 ? 50 : 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.chartGrid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke={palette.chartText}
                      fontSize={10}
                      angle={chartData.is_hourly ? -45 : timeRange === 30 ? -45 : 0}
                      textAnchor={chartData.is_hourly ? 'end' : timeRange === 30 ? 'end' : 'middle'}
                      height={chartData.is_hourly ? 60 : timeRange === 30 ? 60 : 30}
                      interval={chartData.is_hourly ? 2 : timeRange === 30 ? 4 : 0}
                      tick={{ fill: palette.chartText }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={palette.chartText}
                      fontSize={11}
                      width={50}
                      tick={{ fill: palette.chartText }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: palette.tooltipBg,
                        border: `1px solid ${palette.tooltipBorder}`,
                        borderRadius: '8px',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={isDark ? '#60a5fa' : '#2563eb'}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: isDark ? '#60a5fa' : '#2563eb' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={`${palette.card} p-4 sm:p-6`}>
              <div className="mb-4">
                <h3 className={`text-base font-semibold font-heading ${palette.heading}`}>各模型API调用比例</h3>
                <p className={`mt-0.5 text-xs ${palette.subheading}`}>不同AI模型的使用占比</p>
              </div>

              {chartLoading ? (
                <div className="flex h-72 items-center justify-center">
                  <div className={palette.label}>加载中...</div>
                </div>
              ) : chartData.provider_stats.length === 0 ? (
                <div className="flex h-72 items-center justify-center">
                  <div className={palette.label}>暂无数据</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={chartData.provider_stats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.provider_stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: palette.tooltipBg,
                        border: `1px solid ${palette.tooltipBorder}`,
                        borderRadius: '8px',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '13px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={`${palette.card} p-4 sm:p-6 lg:col-span-2`}>
              <div className="mb-4">
                <h3 className={`text-base font-semibold font-heading ${palette.heading}`}>功能调用占比</h3>
                <p className={`mt-0.5 text-xs ${palette.subheading}`}>各功能模块的API调用分布</p>
              </div>

              {chartLoading ? (
                <div className="flex h-72 items-center justify-center">
                  <div className={palette.label}>加载中...</div>
                </div>
              ) : chartData.source_stats.length === 0 ? (
                <div className="flex h-72 items-center justify-center">
                  <div className={palette.label}>暂无数据</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={chartData.source_stats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.source_stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: palette.tooltipBg,
                        border: `1px solid ${palette.tooltipBorder}`,
                        borderRadius: '8px',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '13px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
