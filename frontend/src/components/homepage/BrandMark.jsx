import IconFontSymbol from '../icons/IconFontSymbol.jsx';
import { HOMEPAGE_ICON_NAMES } from '../icons/homepageIconNames.js';

export default function BrandMark({ className = '' }) {
  return (
    <div
      className={`academy-brand-mark flex items-center gap-3 rounded-[22px] border border-[color:var(--academy-border)] bg-[var(--academy-surface)] px-3 py-2 shadow-[0_14px_32px_rgba(44,35,29,0.08)] ${className}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--academy-brand)] text-[var(--academy-surface)]">
        <IconFontSymbol name={HOMEPAGE_ICON_NAMES.brand} className="h-5 w-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[0.92rem] font-semibold tracking-[0.22em] text-[var(--academy-brand)]">
          智学伴
        </span>
        <span className="block text-xs text-[var(--academy-text-muted)]">
          学院风学习平台
        </span>
      </span>
    </div>
  );
}
