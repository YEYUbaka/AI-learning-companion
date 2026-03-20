import { Link } from 'react-router-dom';
import AcademyCard from './AcademyCard.jsx';

export default function DashboardHero({ userName, onDownloadReport }) {
  return (
    <AcademyCard className="overflow-hidden p-3 md:p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]">
        <div className="rounded-[28px] bg-[var(--academy-brand)] px-6 py-7 text-[var(--academy-surface)] md:px-8 md:py-9">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--academy-accent-soft)]">
            书院门厅
          </p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">学习中枢</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:color-mix(in_srgb,var(--academy-surface)_82%,transparent)] md:text-base">
            欢迎回来，{userName || '学习者'}。先确认进度，再进入工具区，
            把今天的学习安排稳稳推进下去。
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/study-plan"
              className="inline-flex items-center justify-center rounded-full bg-[var(--academy-accent-soft)] px-5 py-3 text-sm font-medium text-[var(--academy-brand-deep)] transition-colors hover:bg-[var(--academy-surface)]"
            >
              继续今日学习
            </Link>
            <button
              type="button"
              onClick={onDownloadReport}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-[var(--academy-surface)] transition-colors hover:bg-white/16"
            >
              查看学习报告
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] px-5 py-6 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--academy-accent)]">
            今日提要
          </p>
          <div className="mt-4 space-y-4">
            {[
              '先浏览统计卡，确认今天该优先推进的进度段。',
              '进入常用入口，继续计划、测评或资料整理。',
              '薄弱项会放在右侧，方便你快速决定复盘顺序。',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface)] px-4 py-3 text-sm leading-6 text-[var(--academy-text-muted)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AcademyCard>
  );
}
