import AcademyCard from './AcademyCard.jsx';

export default function WeakTopicsPanel({ weakTopics }) {
  if (!weakTopics?.length) return null;

  return (
    <AcademyCard className="p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--academy-accent)]">
        重点关注
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[var(--academy-text)]">需要加强的方面</h2>
      <div className="mt-5 space-y-3">
        {weakTopics.map((topic) => (
          <div
            key={topic}
            className="flex items-center gap-3 rounded-2xl border border-[color:var(--academy-border)] bg-[var(--academy-surface-soft)] px-4 py-3"
          >
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--academy-accent)]" />
            <span className="text-sm text-[var(--academy-text)]">{topic}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--academy-text-muted)]">
        建议把这些主题作为下一轮复盘与练习的优先顺序。
      </p>
    </AcademyCard>
  );
}
