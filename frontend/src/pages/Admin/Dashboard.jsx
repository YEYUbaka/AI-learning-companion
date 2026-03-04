/**
 * 管理后台仪表盘
 * 作者：智学伴开发团队
 * 目的：展示系统统计信息（数据大屏风格）
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { getDashboardStats, getChartData } from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
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
  const [timeRange, setTimeRange] = useState(7); // 1, 7, 30
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            heading: 'text-white',
            card: 'bg-gradient-to-br from-[#101629] to-[#0a0f1f] border border-cyan-500/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-6 text-white hover:border-cyan-500/40 transition-all cursor-pointer',
            cardHover: 'hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(6,182,212,0.2)]',
            label: 'text-white/60',
            value: 'text-white',
            button: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40',
            buttonActive: 'bg-cyan-500 text-white border-cyan-500',
            bg: 'bg-gradient-to-br from-[#05060a] via-[#0a0f1f] to-[#05060a]',
          }
        : {
            heading: 'text-gray-800',
            card: 'bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 border border-gray-200 hover:border-blue-300 transition-all cursor-pointer',
            cardHover: 'hover:scale-[1.02] hover:shadow-xl',
            label: 'text-gray-600',
            value: 'text-gray-900',
            button: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200',
            buttonActive: 'bg-blue-600 text-white border-blue-600',
            bg: 'bg-gradient-to-br from-gray-50 to-white',
          },
    [isDark]
  );

  // 饼图颜色配置
  const PIE_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

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
      console.error('获取统计数据失败:', error);
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
      console.error('获取图表数据失败:', error);
    } finally {
      setChartLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className={palette.label}>加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { 
      label: '总用户数', 
      value: stats.total_users, 
      icon: '👥', 
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600',
      link: '/admin/users', // 跳转到用户管理页面
    },
    { 
      label: '活跃模型', 
      value: stats.active_models, 
      icon: '🤖', 
      color: 'bg-green-500',
      gradient: 'from-green-500 to-green-600',
      link: '/admin/models',
    },
    { 
      label: 'Prompt总数', 
      value: stats.total_prompts, 
      icon: '📝', 
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600',
      link: '/admin/prompts',
    },
    { 
      label: '今日API调用', 
      value: stats.api_calls_today, 
      icon: '📊', 
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-orange-600',
      link: '/admin/api-logs', // 跳转到API调用查询页面
    },
    { 
      label: '总API调用', 
      value: stats.api_calls_total, 
      icon: '📈', 
      color: 'bg-red-500',
      gradient: 'from-red-500 to-red-600',
      link: '/admin/api-logs', // 跳转到API调用查询页面
    },
  ];

  const handleCardClick = (link) => {
    if (link) {
      navigate(link);
    }
  };

  return (
    <AdminLayout>
      <div className={`${palette.bg} h-full p-6`}>
        {/* 标题区域 */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${palette.heading}`}>
            数据大屏
          </h1>
          <p className={`text-lg ${palette.label}`}>
            实时监控系统运行状态
          </p>
        </div>

        {/* 统计卡片 - 数据大屏风格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              onClick={() => handleCardClick(card.link)}
              className={`${palette.card} ${card.link ? palette.cardHover : ''} relative overflow-hidden group`}
            >
              {/* 背景渐变装饰 */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-10 rounded-full -mr-16 -mt-16 group-hover:opacity-20 transition-opacity`}></div>
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <p className={`text-sm font-medium ${palette.label}`}>{card.label}</p>
                  {card.link && (
                    <svg 
                      className={`w-4 h-4 ${palette.label} group-hover:text-cyan-400 transition-colors`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <p className={`text-5xl font-bold ${palette.value} leading-none`}>
                    {card.value.toLocaleString()}
                  </p>
                  <div className={`${card.color} w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                    {card.icon}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 图表区域 - 数据大屏风格 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* API调用趋势折线图 */}
          <div className={`${palette.card} relative`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${palette.heading} mb-1`}>API调用趋势</h3>
                <p className={`text-xs ${palette.label}`}>
                  {chartData.is_hourly ? '周期: 1小时 · 逐小时统计' : `周期: 1天 · 最近${timeRange}天统计`}
                </p>
              </div>
              <div className="flex gap-2">
                {[1, 7, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeRange(days)}
                    className={`px-4 py-2 text-sm font-medium rounded transition-all ${
                      timeRange === days
                        ? palette.buttonActive
                        : palette.button
                    }`}
                  >
                    {days}天
                  </button>
                ))}
              </div>
            </div>
            {chartLoading ? (
              <div className="flex justify-center items-center h-80">
                <div className={`${palette.label} text-lg`}>加载中...</div>
              </div>
            ) : chartData.daily_stats.length === 0 ? (
              <div className="flex justify-center items-center h-80">
                <div className={`${palette.label} text-lg`}>暂无数据</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <LineChart 
                  data={chartData.daily_stats}
                  margin={{ 
                    top: 5, 
                    right: 20, 
                    left: 0, 
                    bottom: chartData.is_hourly ? 50 : timeRange === 30 ? 50 : 20 
                  }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke={isDark ? 'rgba(255,255,255,0.6)' : '#666'}
                    fontSize={10}
                    angle={chartData.is_hourly ? -45 : timeRange === 30 ? -45 : 0}
                    textAnchor={chartData.is_hourly ? 'end' : timeRange === 30 ? 'end' : 'middle'}
                    height={chartData.is_hourly ? 60 : timeRange === 30 ? 60 : 30}
                    interval={
                      chartData.is_hourly 
                        ? 2  // 小时数据每2小时显示一个标签
                        : timeRange === 30 
                          ? 4  // 30天数据每4天显示一个标签（约7-8个标签）
                          : timeRange === 7
                            ? 0  // 7天显示所有标签
                            : 0   // 1天显示所有标签
                    }
                    tick={{ fill: isDark ? 'rgba(255,255,255,0.6)' : '#666' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={isDark ? 'rgba(255,255,255,0.6)' : '#666'}
                    fontSize={11}
                    width={60}
                    tick={{ fill: isDark ? 'rgba(255,255,255,0.6)' : '#666' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ 
                      value: '调用次数', 
                      angle: -90, 
                      position: 'insideLeft',
                      offset: 10,
                      style: { textAnchor: 'middle', fill: isDark ? 'rgba(255,255,255,0.6)' : '#666', fontSize: '12px' }
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                      borderRadius: '6px',
                      color: isDark ? '#fff' : '#000',
                      fontSize: '13px',
                      padding: '8px 12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                    labelFormatter={(label) => chartData.is_hourly ? `时间: ${label}` : `日期: ${label}`}
                    formatter={(value) => [`${value} 次`, '调用次数']}
                    separator=": "
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={isDark ? '#06b6d4' : '#3b82f6'}
                    strokeWidth={2.5}
                    name="调用次数"
                    dot={false}
                    activeDot={{ r: 6, fill: isDark ? '#06b6d4' : '#3b82f6', strokeWidth: 2 }}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 各模型调用比例饼图 */}
          <div className={`${palette.card} relative`}>
            <div className="mb-6">
              <h3 className={`text-xl font-bold ${palette.heading} mb-1`}>各模型API调用比例</h3>
              <p className={`text-sm ${palette.label}`}>不同AI模型的使用占比</p>
            </div>
            {chartLoading ? (
              <div className="flex justify-center items-center h-80">
                <div className={`${palette.label} text-lg`}>加载中...</div>
              </div>
            ) : chartData.provider_stats.length === 0 ? (
              <div className="flex justify-center items-center h-80">
                <div className={`${palette.label} text-lg`}>暂无数据</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={chartData.provider_stats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.provider_stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: isDark ? '#fff' : '#000',
                      fontSize: '14px',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '14px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 功能调用占比饼图 */}
          <div className={`${palette.card} lg:col-span-2 relative`}>
            <div className="mb-6">
              <h3 className={`text-xl font-bold ${palette.heading} mb-1`}>功能调用占比</h3>
              <p className={`text-sm ${palette.label}`}>各功能模块的API调用分布</p>
            </div>
            {chartLoading ? (
              <div className="flex justify-center items-center h-80">
                <div className={`${palette.label} text-lg`}>加载中...</div>
              </div>
            ) : chartData.source_stats.length === 0 ? (
              <div className="flex justify-center items-center h-80">
                <div className={`${palette.label} text-lg`}>暂无数据</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={chartData.source_stats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(1)}%`}
                    outerRadius={140}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.source_stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: isDark ? '#fff' : '#000',
                      fontSize: '14px',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '14px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

