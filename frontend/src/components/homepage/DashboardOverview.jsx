import AcademyCard from './AcademyCard.jsx';
import AcademyPageShell from './AcademyPageShell.jsx';
import DashboardHero from './DashboardHero.jsx';
import QuickToolsGrid from './QuickToolsGrid.jsx';
import StatsSummaryGrid from './StatsSummaryGrid.jsx';
import WeakTopicsPanel from './WeakTopicsPanel.jsx';

export default function DashboardOverview({ data, onDownloadReport }) {
  const hasProgressContext =
    data.lineData.length > 0 || data.recentScores.length > 0 || data.topicData.length > 0;
  const hasWeakTopics = data.weakTopics.length > 0;

  return (
    <AcademyPageShell>
      <div className="space-y-6">
        <DashboardHero userName={data.userName} onDownloadReport={onDownloadReport} />

        <StatsSummaryGrid data={data} />

        {hasProgressContext ? (
          <AcademyCard className="p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--academy-accent)]">
                  研习脉络
                </p>
                <h2 className="mt-2 font-serif text-2xl text-[var(--academy-brand)]">近期学习概览</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--academy-text-muted)]">
                  图表精修会在下一步补上，这里先保留你的趋势、最近成绩和主题统计摘要，
                  方便首页结构先稳定下来。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] px-4 py-3">
                  <p className="text-xs text-[var(--academy-text-muted)]">趋势点位</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--academy-brand)]">
                    {data.lineData.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] px-4 py-3">
                  <p className="text-xs text-[var(--academy-text-muted)]">近期成绩</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--academy-brand)]">
                    {data.recentScores.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] px-4 py-3">
                  <p className="text-xs text-[var(--academy-text-muted)]">主题统计</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--academy-brand)]">
                    {data.topicData.length}
                  </p>
                </div>
              </div>
            </div>
          </AcademyCard>
        ) : null}

        {hasWeakTopics ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start">
            <QuickToolsGrid />
            <WeakTopicsPanel weakTopics={data.weakTopics} />
          </div>
        ) : (
          <QuickToolsGrid />
        )}
      </div>
    </AcademyPageShell>
  );
}
