import { Link } from 'react-router-dom';
import AcademyCard from './AcademyCard.jsx';
import IconFontSymbol from '../icons/IconFontSymbol.jsx';
import { HOMEPAGE_ICON_NAMES } from '../icons/homepageIconNames.js';

const TOOL_ITEMS = [
  {
    to: '/agent',
    title: '学习助手',
    description: '即时答疑与学习引导，帮你更快进入状态。',
    icon: HOMEPAGE_ICON_NAMES.agent,
  },
  {
    to: '/study-plan',
    title: '学习计划',
    description: '继续推进你的阶段安排和任务节奏。',
    icon: HOMEPAGE_ICON_NAMES.plan,
  },
  {
    to: '/quiz',
    title: '专项测评',
    description: '聚焦单项练习，快速发现掌握薄弱点。',
    icon: HOMEPAGE_ICON_NAMES.quiz,
  },
  {
    to: '/learning-map',
    title: '知识图谱',
    description: '梳理知识结构，确认下一步该补哪一段。',
    icon: HOMEPAGE_ICON_NAMES.map,
  },
  {
    to: '/upload-file',
    title: '上传资料',
    description: '整理讲义与题解，让学习资料更容易调用。',
    icon: HOMEPAGE_ICON_NAMES.upload,
  },
];

function ToolIcon({ name }) {
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

export default function QuickToolsGrid() {
  return (
    <section id="academy-quick-tools">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--academy-accent)]">
            研习工具
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[var(--academy-text)]">常用入口</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TOOL_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} data-testid="quick-tool-card" className="group block">
            <AcademyCard className="h-full p-5 transition-transform duration-200 group-hover:-translate-y-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-[var(--academy-text)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--academy-text-muted)]">
                    {item.description}
                  </p>
                </div>
                <ToolIcon name={item.icon} />
              </div>
            </AcademyCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
