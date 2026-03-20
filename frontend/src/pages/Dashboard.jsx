import { useEffect, useState } from 'react';
import api from '../api/apiClient';
import AcademyCard from '../components/homepage/AcademyCard.jsx';
import AcademyPageShell from '../components/homepage/AcademyPageShell.jsx';
import DashboardOverview from '../components/homepage/DashboardOverview.jsx';

function useCountUp(target, duration = 900) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setCount(Math.round(end * eased));
      if (progress >= 1) clearInterval(timer);
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

function getStoredUserInfo() {
  const raw = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatTrendLabel(item, index) {
  if (!item?.date) return `第${index + 1}次`;

  return new Date(item.date).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

function normalizeDashboardData({ progress, stats, userInfo, animatedValues }) {
  const lineData = (progress?.score_trend || []).map((item, index) => ({
    ...item,
    label: formatTrendLabel(item, index),
  }));

  const recentScores = Array.isArray(progress?.recent_scores)
    ? progress.recent_scores.map((item, index) => ({
        name: `最近${index + 1}次`,
        score: typeof item === 'number' ? item : item?.score ?? 0,
      }))
    : lineData.slice(-5).map((item, index) => ({
        name: item.label || `最近${index + 1}次`,
        score: item.score ?? 0,
      }));

  const topicSource = Array.isArray(stats?.topic_statistics)
    ? stats.topic_statistics
    : Array.isArray(progress?.topic_statistics)
    ? progress.topic_statistics
    : [];
  const topicData = topicSource.slice(0, 8).map((item) => ({
    name: item.topic || item.name || '未分类',
    score: item.average_score ?? item.score ?? 0,
    count: item.count ?? 1,
  }));

  return {
    userName: userInfo?.name || userInfo?.nickname || userInfo?.email || '学习者',
    averageScore: animatedValues.averageScore,
    completionRate: animatedValues.completionRate,
    totalTests: animatedValues.totalTests,
    totalPlans: animatedValues.totalPlans,
    lineData,
    recentScores,
    topicData,
    weakTopics: Array.isArray(progress?.weak_topics) ? progress.weak_topics : [],
  };
}

function DashboardLoadingState() {
  return (
    <AcademyPageShell>
      <div className="animate-pulse space-y-6">
        <AcademyCard className="p-6 md:p-8">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-full bg-[var(--academy-surface-soft)]" />
            <div className="h-10 w-48 rounded-full bg-[var(--academy-surface-soft)]" />
            <div className="h-4 w-72 rounded-full bg-[var(--academy-surface-soft)]" />
          </div>
        </AcademyCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <AcademyCard key={item} className="h-36 p-5">
              <div className="space-y-3">
                <div className="h-4 w-20 rounded-full bg-[var(--academy-surface-soft)]" />
                <div className="h-10 w-24 rounded-full bg-[var(--academy-surface-soft)]" />
              </div>
            </AcademyCard>
          ))}
        </div>
      </div>
    </AcademyPageShell>
  );
}

function DashboardErrorState({ error }) {
  return (
    <AcademyPageShell>
      <AcademyCard className="border-[color:color-mix(in_srgb,var(--academy-accent)_40%,transparent)] p-6">
        <p className="text-sm font-medium text-[var(--academy-accent)]">加载失败</p>
        <p className="mt-2 text-sm text-[var(--academy-text-muted)]">{error}</p>
      </AcademyCard>
    </AcademyPageShell>
  );
}

function Dashboard() {
  const [progress, setProgress] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const storedUser = getStoredUserInfo();
  const userId = storedUser?.id;

  useEffect(() => {
    async function fetchData() {
      try {
        if (!userId) {
          setError('请先登录');
          setLoading(false);
          return;
        }

        const progressResponse = await api.get(`/api/v1/analytics/progress/${userId}`);
        setProgress(progressResponse.data);

        try {
          const statsResponse = await api.get(`/api/v1/analytics/stats/${userId}`);
          setStats(statsResponse.data);
        } catch {
          setStats(null);
        }
      } catch (err) {
        setError(err.response?.data?.detail || '加载数据失败');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  const handleDownloadReport = async () => {
    if (!userId) {
      window.alert('请先登录');
      return;
    }

    try {
      const response = await fetch(`${api.defaults.baseURL}/api/v1/analytics/report/${userId}`);

      if (!response.ok) {
        window.alert('学习报告下载失败，请稍后重试');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `智学伴学习报告_${userId}_${Date.now()}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (err) {
      window.alert(`学习报告下载失败：${err.message}`);
    }
  };

  const animatedValues = {
    averageScore: useCountUp(progress?.average_score),
    completionRate: useCountUp(progress?.completion_rate),
    totalTests: useCountUp(progress?.total_tests),
    totalPlans: useCountUp(progress?.total_plans),
  };

  if (loading) return <DashboardLoadingState />;
  if (error) return <DashboardErrorState error={error} />;

  const overviewData = normalizeDashboardData({
    progress,
    stats,
    userInfo: storedUser,
    animatedValues,
  });

  return (
    <DashboardOverview
      data={overviewData}
      onDownloadReport={handleDownloadReport}
    />
  );
}

export default Dashboard;
