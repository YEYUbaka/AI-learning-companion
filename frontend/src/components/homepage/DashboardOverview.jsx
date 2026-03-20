import AcademyCard from './AcademyCard.jsx';
import AcademyPageShell from './AcademyPageShell.jsx';
import DashboardHero from './DashboardHero.jsx';
import ProgressCharts from './ProgressCharts.jsx';
import QuickToolsGrid from './QuickToolsGrid.jsx';
import StatsSummaryGrid from './StatsSummaryGrid.jsx';
import WeakTopicsPanel from './WeakTopicsPanel.jsx';

export default function DashboardOverview({ isDark, data, onDownloadReport }) {
  const hasProgressContext =
    data.lineData.length > 0 || data.recentScores.length > 0 || data.topicData.length > 0;
  const hasWeakTopics = data.weakTopics.length > 0;

  return (
    <AcademyPageShell>
      <div className="space-y-6">
        <DashboardHero userName={data.userName} onDownloadReport={onDownloadReport} />

        <StatsSummaryGrid data={data} />

        {hasProgressContext ? (
          <ProgressCharts
            isDark={isDark}
            lineData={data.lineData}
            recentScores={data.recentScores}
            topicData={data.topicData}
          />
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
