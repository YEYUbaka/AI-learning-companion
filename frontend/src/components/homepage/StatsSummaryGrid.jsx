import AcademyCard from './AcademyCard.jsx';
import IconFontSymbol from '../icons/IconFontSymbol.jsx';
import { HOMEPAGE_ICON_NAMES } from '../icons/homepageIconNames.js';

const STAT_ITEMS = [
  { key: 'averageScore', label: '平均得分', icon: HOMEPAGE_ICON_NAMES.score, suffix: '分' },
  { key: 'completionRate', label: '完成率', icon: HOMEPAGE_ICON_NAMES.completion, suffix: '%' },
  { key: 'totalTests', label: '已完成测评', icon: HOMEPAGE_ICON_NAMES.tests, suffix: '次' },
  { key: 'totalPlans', label: '学习计划', icon: HOMEPAGE_ICON_NAMES.plan, suffix: '项' },
];

function StatIcon({ name }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] text-[var(--academy-text)]">
      <IconFontSymbol
        name={name}
        className="h-5 w-5"
        fallback={<span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--academy-accent)]" />}
      />
    </span>
  );
}

export default function StatsSummaryGrid({ data }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STAT_ITEMS.map((item) => (
        <div key={item.key} data-testid="academy-stat-card">
          <AcademyCard className="h-full p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--academy-text-muted)]">{item.label}</p>
                <p className="mt-4 text-3xl font-semibold text-[var(--academy-text)]">
                  {data[item.key]}
                  <span className="ml-1 text-sm font-normal text-[var(--academy-text-muted)]">
                    {item.suffix}
                  </span>
                </p>
              </div>
              <StatIcon name={item.icon} />
            </div>
          </AcademyCard>
        </div>
      ))}
    </section>
  );
}
