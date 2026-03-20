# Homepage Academy Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the homepage `Navbar + Dashboard` into a cohesive academy-branded experience in both light and dark modes, with iconfont.cn-backed icons and regression coverage.

**Architecture:** Keep routing and analytics fetching intact, but split the homepage UI into focused presentational components so the academy theme tokens, icon wrapper, navigation chrome, and dashboard sections can be tested independently. Introduce the iconfont wrapper and design tokens first, then refactor `Navbar` and `Dashboard` to consume those primitives without changing backend APIs.

**Tech Stack:** React 18, Vite 5, TailwindCSS, Zustand, Recharts, Vitest, React Testing Library, iconfont.cn symbol script

---

## File Map

### Existing files to modify

- `frontend/package.json`
  Adds the frontend test scripts and test-only dependencies required for TDD.
- `frontend/vite.config.js`
  Extends the Vite config with the Vitest `test` block so JSX component tests run under `jsdom`.
- `frontend/.env.development`
  Stores the local `VITE_ICONFONT_URL` value exported from the iconfont.cn project.
- `frontend/src/main.jsx`
  Ensures homepage iconfont bootstrap runs once before app render.
- `frontend/src/styles/global.css`
  Defines the academy light/dark tokens, shared surfaces, typography rules, and reusable utility classes.
- `frontend/src/components/Navbar.jsx`
  Rebuilds the navbar with academy branding, iconized nav items, and consistent desktop/mobile behavior.
- `frontend/src/pages/Dashboard.jsx`
  Stays as the data-fetching container, normalizes API data, and delegates rendering to presentational homepage components.

### New files to create

- `frontend/src/test/setup.js`
  Global Vitest setup for `jest-dom`, `matchMedia`, storage cleanup, and deterministic theme state.
- `frontend/src/test/renderWithRouter.jsx`
  Shared render helper for components that require `MemoryRouter`.
- `frontend/src/test/fixtures/dashboardFixture.js`
  Stable fake analytics payload used by homepage tests without mocking the backend shape inline in every test.
- `frontend/src/components/icons/IconFontSymbol.jsx`
  Thin wrapper for the iconfont.cn symbol script with a fallback slot when the sprite is missing.
- `frontend/src/components/icons/iconfontLoader.js`
  One-time loader for the remote iconfont symbol script referenced by `VITE_ICONFONT_URL`.
- `frontend/src/components/icons/homepageIconNames.js`
  Semantic icon name map used by `Navbar` and homepage cards instead of scattering raw icon ids.
- `frontend/src/components/icons/__tests__/IconFontSymbol.test.jsx`
  Verifies the icon wrapper fallback and loaded-symbol rendering paths.
- `frontend/src/components/homepage/BrandMark.jsx`
  Bookplate-style homepage brand mark used by the navbar.
- `frontend/src/components/homepage/AcademyPageShell.jsx`
  Shared homepage shell that applies academy page background and content spacing.
- `frontend/src/components/homepage/AcademyCard.jsx`
  Shared card surface for stats, chart sections, and quick tools.
- `frontend/src/components/homepage/DashboardHero.jsx`
  Hero banner with the welcome copy and primary actions.
- `frontend/src/components/homepage/StatsSummaryGrid.jsx`
  The four homepage stat cards.
- `frontend/src/components/homepage/ProgressCharts.jsx`
  Academy-colored chart section wrapper around the existing Recharts visualizations.
- `frontend/src/components/homepage/QuickToolsGrid.jsx`
  Icon-led homepage tool entry cards.
- `frontend/src/components/homepage/WeakTopicsPanel.jsx`
  Styled weak-topic list matching the academy surface language.
- `frontend/src/components/homepage/DashboardOverview.jsx`
  Presentational assembly for the full academy homepage body.
- `frontend/src/components/homepage/__tests__/AcademyPageShell.test.jsx`
  Verifies the academy shell and card primitives expose the expected light/dark classes.
- `frontend/src/components/__tests__/Navbar.test.jsx`
  Regression coverage for the academy navbar structure, active state, and mobile menu.
- `frontend/src/components/homepage/__tests__/DashboardOverview.test.jsx`
  Verifies the hero, stat cards, tool cards, and weak-topic panel render from fixture data.
- `frontend/src/components/homepage/__tests__/ProgressCharts.test.jsx`
  Verifies academy chart sections render only when data exists and use theme-aware palette hooks.

### Existing context to keep in mind

- `frontend/src/store/themeStore.js`
  The current theme state source; keep this logic intact and consume `theme` rather than replacing the store.
- `docs/superpowers/specs/2026-03-20-homepage-academy-design.md`
  The approved design spec. Every UI decision in the tasks below should trace back here.

### Baseline verification

- Current baseline in the worktree: `npm run build` passes in `frontend/`.
- Current gap: there is no frontend test harness yet, so the first implementation task adds Vitest + RTL before any UI changes.

---

### Task 1: Add the Homepage Test Harness and Icon Wrapper

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/.env.development`
- Modify: `frontend/src/main.jsx`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/test/renderWithRouter.jsx`
- Create: `frontend/src/components/icons/iconfontLoader.js`
- Create: `frontend/src/components/icons/IconFontSymbol.jsx`
- Create: `frontend/src/components/icons/homepageIconNames.js`
- Test: `frontend/src/components/icons/__tests__/IconFontSymbol.test.jsx`

- [ ] **Step 1: Add test tooling and iconfont configuration placeholders**

Add the scripts and dependencies below to `frontend/package.json`, and add a placeholder `VITE_ICONFONT_URL=` line to `frontend/.env.development` so the local dev environment has an obvious place for the exported iconfont.cn URL.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Install the new test dependencies**

Run: `npm install`
Expected: new test packages are added to `package-lock.json` without removing the existing Vite/Tailwind toolchain.

- [ ] **Step 3: Write the failing icon wrapper test**

Create `frontend/src/components/icons/__tests__/IconFontSymbol.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import IconFontSymbol from '../IconFontSymbol.jsx';

vi.mock('../iconfontLoader.js', () => ({
  ensureIconfontLoaded: vi.fn(() => Promise.resolve(false)),
}));

describe('IconFontSymbol', () => {
  test('renders fallback content when the iconfont sprite is unavailable', async () => {
    render(
      <IconFontSymbol
        name="icon-homepage-nav"
        fallback={<span data-testid="icon-fallback">fallback</span>}
        title="首页"
      />
    );

    expect(await screen.findByTestId('icon-fallback')).toBeInTheDocument();
    expect(document.querySelector('use')).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test:run -- src/components/icons/__tests__/IconFontSymbol.test.jsx`
Expected: FAIL with `Cannot find module '../IconFontSymbol.jsx'` or equivalent missing-file failure.

- [ ] **Step 5: Add the test setup, loader, and minimal icon wrapper implementation**

Create `frontend/src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { useThemeStore } from '../store/themeStore';

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.dataset.theme = 'light';
  useThemeStore.setState({ mode: 'light', theme: 'light' });
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
```

Create `frontend/src/test/renderWithRouter.jsx`:

```jsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export function renderWithRouter(ui, { route = '/dashboard' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}
```

Extend `frontend/vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
  server: { ...existingServerConfig }
});
```

Create `frontend/src/components/icons/iconfontLoader.js`:

```js
const loaded = new Map();

export function ensureIconfontLoaded(url) {
  if (!url) return Promise.resolve(false);
  if (loaded.has(url)) return loaded.get(url);

  const promise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  loaded.set(url, promise);
  return promise;
}
```

Create `frontend/src/components/icons/IconFontSymbol.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { ensureIconfontLoaded } from './iconfontLoader.js';

export default function IconFontSymbol({ name, className = '', fallback = null, title }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureIconfontLoaded(import.meta.env.VITE_ICONFONT_URL).then(setReady);
  }, []);

  if (!ready) return fallback;

  return (
    <svg aria-hidden="true" role={title ? 'img' : undefined} className={className}>
      {title ? <title>{title}</title> : null}
      <use href={`#${name}`} />
    </svg>
  );
}
```

Add a semantic map in `frontend/src/components/icons/homepageIconNames.js`:

```js
export const HOMEPAGE_ICON_NAMES = {
  home: 'icon-homepage-nav',
  agent: 'icon-homepage-agent',
  plan: 'icon-homepage-plan',
  quiz: 'icon-homepage-quiz',
  map: 'icon-homepage-map',
};
```

- [ ] **Step 6: Run the targeted test to verify it passes**

Run: `npm run test:run -- src/components/icons/__tests__/IconFontSymbol.test.jsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/.env.development frontend/src/main.jsx frontend/src/test/setup.js frontend/src/test/renderWithRouter.jsx frontend/src/components/icons/iconfontLoader.js frontend/src/components/icons/IconFontSymbol.jsx frontend/src/components/icons/homepageIconNames.js frontend/src/components/icons/__tests__/IconFontSymbol.test.jsx
git commit -m "test: add homepage iconfont test harness"
```

---

### Task 2: Introduce Academy Theme Tokens and Shared Homepage Surfaces

**Files:**
- Modify: `frontend/src/styles/global.css`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/components/homepage/AcademyPageShell.jsx`
- Create: `frontend/src/components/homepage/AcademyCard.jsx`
- Test: `frontend/src/components/homepage/__tests__/AcademyPageShell.test.jsx`

- [ ] **Step 1: Write the failing academy shell test**

Create `frontend/src/components/homepage/__tests__/AcademyPageShell.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import AcademyPageShell from '../AcademyPageShell.jsx';

test('applies academy surface classes for the page shell and card', () => {
  render(
    <AcademyPageShell isDark={false}>
      <div data-testid="shell-child">body</div>
    </AcademyPageShell>
  );

  expect(screen.getByTestId('academy-shell')).toHaveClass('academy-shell');
  expect(screen.getByTestId('shell-child')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/components/homepage/__tests__/AcademyPageShell.test.jsx`
Expected: FAIL with `Cannot find module '../AcademyPageShell.jsx'`.

- [ ] **Step 3: Add the academy token layer and shell primitives**

Create `frontend/src/components/homepage/AcademyPageShell.jsx`:

```jsx
export default function AcademyPageShell({ isDark, children }) {
  return (
    <div
      data-testid="academy-shell"
      className={`academy-shell min-h-screen ${isDark ? 'academy-shell-dark' : 'academy-shell-light'}`}
    >
      <div className="academy-page-frame mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
```

Create `frontend/src/components/homepage/AcademyCard.jsx`:

```jsx
export default function AcademyCard({ as: Tag = 'section', className = '', children }) {
  return (
    <Tag className={`academy-card border rounded-[24px] ${className}`}>
      {children}
    </Tag>
  );
}
```

Add academy tokens to `frontend/src/styles/global.css`:

```css
:root {
  --academy-bg: #f4ebdd;
  --academy-surface: #fbf6ee;
  --academy-surface-soft: #f1e6d5;
  --academy-brand: #1f4536;
  --academy-brand-deep: #163429;
  --academy-accent: #7a5638;
  --academy-accent-soft: #b48763;
  --academy-text: #2d241d;
  --academy-text-muted: #675b4f;
  --academy-border: rgba(45, 36, 29, 0.10);
}

:root[data-theme='dark'] {
  --academy-bg: #13231d;
  --academy-surface: #1b2f27;
  --academy-surface-soft: #22382e;
  --academy-brand: #294439;
  --academy-brand-deep: #0f1c17;
  --academy-accent: #b48763;
  --academy-accent-soft: #d6b38e;
  --academy-text: #e9ddc8;
  --academy-text-muted: #c3b39a;
  --academy-border: rgba(233, 221, 200, 0.12);
}

.academy-shell {
  background:
    radial-gradient(circle at top left, rgba(31, 69, 54, 0.10), transparent 30%),
    linear-gradient(180deg, var(--academy-bg), color-mix(in srgb, var(--academy-bg) 84%, white));
  color: var(--academy-text);
}

.academy-card {
  background: var(--academy-surface);
  border-color: var(--academy-border);
  color: var(--academy-text);
  box-shadow: 0 18px 48px rgba(44, 35, 29, 0.08);
}
```

Update `frontend/src/App.jsx` to replace the hard-coded page background with the new academy shell variables.

- [ ] **Step 4: Run the academy shell test to verify it passes**

Run: `npm run test:run -- src/components/homepage/__tests__/AcademyPageShell.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/global.css frontend/src/App.jsx frontend/src/components/homepage/AcademyPageShell.jsx frontend/src/components/homepage/AcademyCard.jsx frontend/src/components/homepage/__tests__/AcademyPageShell.test.jsx
git commit -m "feat: add academy homepage theme tokens"
```

---

### Task 3: Rebuild the Navbar as Academy Navigation

**Files:**
- Modify: `frontend/src/components/Navbar.jsx`
- Modify: `frontend/src/components/icons/homepageIconNames.js`
- Create: `frontend/src/components/homepage/BrandMark.jsx`
- Test: `frontend/src/components/__tests__/Navbar.test.jsx`

- [ ] **Step 1: Write the failing academy navbar test**

Create `frontend/src/components/__tests__/Navbar.test.jsx`:

```jsx
import { screen } from '@testing-library/react';
import Navbar from '../Navbar.jsx';
import { renderWithRouter } from '../../test/renderWithRouter.jsx';
import { useThemeStore } from '../../store/themeStore.js';

test('renders academy brand chrome and icon-led nav items', () => {
  sessionStorage.setItem('userInfo', JSON.stringify({ name: '林然', email: 'lin@example.com' }));
  useThemeStore.setState({ mode: 'light', theme: 'light' });

  renderWithRouter(<Navbar />, { route: '/dashboard' });

  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByText('智学伴')).toBeInTheDocument();
  expect(screen.getAllByTestId('nav-icon')).toHaveLength(5);
  expect(screen.getByRole('link', { name: /首页/ })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/components/__tests__/Navbar.test.jsx`
Expected: FAIL because the current navbar has no `BrandMark`, no `nav-icon` test ids, and no `aria-current="page"` state.

- [ ] **Step 3: Implement the academy navbar**

Create `frontend/src/components/homepage/BrandMark.jsx`:

```jsx
import IconFontSymbol from '../icons/IconFontSymbol.jsx';

export default function BrandMark() {
  return (
    <div className="academy-brand inline-flex items-center gap-3">
      <span className="academy-brand-badge">
        <IconFontSymbol
          name="icon-homepage-brand"
          className="h-4 w-4"
          fallback={<span className="text-xs font-bold">知</span>}
          title="智学伴"
        />
      </span>
      <div>
        <p className="academy-brand-title">智学伴</p>
        <p className="academy-brand-subtitle">Learning Companion</p>
      </div>
    </div>
  );
}
```

Refactor `frontend/src/components/Navbar.jsx` around a single nav item config:

```jsx
const NAV_ITEMS = [
  { to: '/dashboard', label: '首页', icon: HOMEPAGE_ICON_NAMES.home },
  { to: '/agent', label: '学习助手', icon: HOMEPAGE_ICON_NAMES.agent },
  { to: '/study-plan', label: '学习计划', icon: HOMEPAGE_ICON_NAMES.plan },
  { to: '/quiz', label: '专项测评', icon: HOMEPAGE_ICON_NAMES.quiz },
  { to: '/learning-map', label: '知识图谱', icon: HOMEPAGE_ICON_NAMES.map },
];
```

Render each item with:

```jsx
<Link
  aria-current={isActive ? 'page' : undefined}
  className={`academy-nav-link ${isActive ? 'academy-nav-link-active' : ''}`}
>
  <IconFontSymbol
    name={item.icon}
    className="h-4 w-4"
    fallback={<span data-testid="nav-icon" className="h-4 w-4 rounded-full bg-current/20" />}
    title={item.label}
  />
  <span>{item.label}</span>
</Link>
```

Also normalize the visible Chinese copy while refactoring any mojibake strings in the current navbar.

- [ ] **Step 4: Run the navbar test to verify it passes**

Run: `npm run test:run -- src/components/__tests__/Navbar.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Navbar.jsx frontend/src/components/homepage/BrandMark.jsx frontend/src/components/icons/homepageIconNames.js frontend/src/components/__tests__/Navbar.test.jsx
git commit -m "feat: restyle homepage navbar with academy chrome"
```

---

### Task 4: Split Dashboard Rendering into Academy Homepage Components

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`
- Create: `frontend/src/test/fixtures/dashboardFixture.js`
- Create: `frontend/src/components/homepage/DashboardHero.jsx`
- Create: `frontend/src/components/homepage/StatsSummaryGrid.jsx`
- Create: `frontend/src/components/homepage/QuickToolsGrid.jsx`
- Create: `frontend/src/components/homepage/WeakTopicsPanel.jsx`
- Create: `frontend/src/components/homepage/DashboardOverview.jsx`
- Test: `frontend/src/components/homepage/__tests__/DashboardOverview.test.jsx`

- [ ] **Step 1: Write the failing overview test**

Create `frontend/src/components/homepage/__tests__/DashboardOverview.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import DashboardOverview from '../DashboardOverview.jsx';
import { dashboardFixture } from '../../../test/fixtures/dashboardFixture.js';

test('renders the academy hero, stat cards, tool cards, and weak topics panel', () => {
  render(
    <DashboardOverview
      isDark={false}
      data={dashboardFixture}
      onDownloadReport={() => {}}
    />
  );

  expect(screen.getByRole('heading', { name: /学习中枢/ })).toBeInTheDocument();
  expect(screen.getAllByTestId('academy-stat-card')).toHaveLength(4);
  expect(screen.getAllByTestId('quick-tool-card')).toHaveLength(5);
  expect(screen.getByText('需要加强的方面')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/components/homepage/__tests__/DashboardOverview.test.jsx`
Expected: FAIL with `Cannot find module '../DashboardOverview.jsx'`.

- [ ] **Step 3: Add the dashboard fixture and presentational components**

Create `frontend/src/test/fixtures/dashboardFixture.js`:

```js
export const dashboardFixture = {
  userName: '林然',
  averageScore: 86,
  completionRate: 72,
  totalTests: 18,
  totalPlans: 4,
  lineData: [
    { label: '3/17', score: 74 },
    { label: '3/18', score: 88 },
  ],
  recentScores: [
    { name: '最近1', score: 78 },
    { name: '最近2', score: 92 },
  ],
  topicData: [
    { name: '函数', score: 68 },
    { name: '几何', score: 81 },
  ],
  weakTopics: ['函数', '几何'],
};
```

Create `frontend/src/components/homepage/DashboardHero.jsx`:

```jsx
import AcademyCard from './AcademyCard.jsx';

export default function DashboardHero({ userName, onDownloadReport }) {
  return (
    <AcademyCard className="academy-hero p-6 md:p-8">
      <p className="academy-section-kicker">今日研习</p>
      <h1 className="academy-hero-title">学习中枢</h1>
      <p className="academy-hero-copy">欢迎回来，{userName || '学习者'}。继续今天的学习安排，先看进度，再进入工具区。</p>
      <div className="flex gap-3">
        <button className="academy-btn-primary" type="button">继续今日学习</button>
        <button className="academy-btn-secondary" type="button" onClick={onDownloadReport}>查看学习报告</button>
      </div>
    </AcademyCard>
  );
}
```

Create `frontend/src/components/homepage/StatsSummaryGrid.jsx` and `QuickToolsGrid.jsx` so both consume `IconFontSymbol` and `AcademyCard`, and expose `data-testid="academy-stat-card"` / `data-testid="quick-tool-card"` on each card.

Create `frontend/src/components/homepage/WeakTopicsPanel.jsx` as a focused panel for the weak-topic list.

Create `frontend/src/components/homepage/DashboardOverview.jsx` to assemble the hero, stats, charts placeholder, tools, and weak topics sections from normalized props.

Update `frontend/src/pages/Dashboard.jsx` so the page keeps the existing API calls, but converts the fetched payload into the `DashboardOverview` prop shape instead of directly rendering the entire page inline.

- [ ] **Step 4: Run the overview test to verify it passes**

Run: `npm run test:run -- src/components/homepage/__tests__/DashboardOverview.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx frontend/src/test/fixtures/dashboardFixture.js frontend/src/components/homepage/DashboardHero.jsx frontend/src/components/homepage/StatsSummaryGrid.jsx frontend/src/components/homepage/QuickToolsGrid.jsx frontend/src/components/homepage/WeakTopicsPanel.jsx frontend/src/components/homepage/DashboardOverview.jsx frontend/src/components/homepage/__tests__/DashboardOverview.test.jsx
git commit -m "feat: split dashboard into academy homepage sections"
```

---

### Task 5: Apply Academy Chart Styling, Dark Mode Polish, and Final Verification

**Files:**
- Modify: `frontend/src/components/homepage/DashboardOverview.jsx`
- Create: `frontend/src/components/homepage/ProgressCharts.jsx`
- Test: `frontend/src/components/homepage/__tests__/ProgressCharts.test.jsx`

- [ ] **Step 1: Write the failing chart section test**

Create `frontend/src/components/homepage/__tests__/ProgressCharts.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import ProgressCharts from '../ProgressCharts.jsx';
import { dashboardFixture } from '../../../test/fixtures/dashboardFixture.js';

test('renders academy chart sections only when data exists', () => {
  render(
    <ProgressCharts
      isDark
      lineData={dashboardFixture.lineData}
      recentScores={dashboardFixture.recentScores}
      topicData={dashboardFixture.topicData}
    />
  );

  expect(screen.getByText('得分趋势')).toBeInTheDocument();
  expect(screen.getByText('近期得分')).toBeInTheDocument();
  expect(screen.getByText('各主题得分分布')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/components/homepage/__tests__/ProgressCharts.test.jsx`
Expected: FAIL with `Cannot find module '../ProgressCharts.jsx'`.

- [ ] **Step 3: Implement theme-aware chart sections and wire them into the overview**

Create `frontend/src/components/homepage/ProgressCharts.jsx`:

```jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import AcademyCard from './AcademyCard.jsx';

const LIGHT = {
  grid: 'rgba(45, 36, 29, 0.12)',
  axis: '#675b4f',
  line: '#1f4536',
  barStrong: '#1f4536',
  barMid: '#7a5638',
  barWarn: '#b48763',
};

const DARK = {
  grid: 'rgba(233, 221, 200, 0.12)',
  axis: '#c3b39a',
  line: '#d6b38e',
  barStrong: '#b48763',
  barMid: '#8fa88f',
  barWarn: '#d6b38e',
};
```

Render each chart inside `AcademyCard`, pick `const palette = isDark ? DARK : LIGHT`, and update `DashboardOverview.jsx` to insert `<ProgressCharts ... />` between the stats grid and quick tools grid.

- [ ] **Step 4: Run targeted tests and the full verification suite**

Run: `npm run test:run -- src/components/homepage/__tests__/ProgressCharts.test.jsx`
Expected: PASS

Run: `npm run test:run`
Expected: PASS with all homepage tests green

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/homepage/DashboardOverview.jsx frontend/src/components/homepage/ProgressCharts.jsx frontend/src/components/homepage/__tests__/ProgressCharts.test.jsx frontend/src/styles/global.css frontend/src/components/Navbar.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: complete academy homepage polish"
```

---

## Notes for the Implementer

- Normalize the mojibake Chinese copy as you touch each component. Do not preserve garbled labels if the component is being refactored anyway.
- Keep the current analytics API calls untouched; only reshape the fetched data for presentational components.
- Prefer CSS variables and academy utility classes over one-off inline styles so the deep and light themes stay in sync.
- If `VITE_ICONFONT_URL` is unavailable during local development, the fallback path in `IconFontSymbol` must keep the UI functional.
- Do not let `Dashboard.jsx` keep growing. If the file still feels crowded after the extraction above, split one more presentational child rather than pushing more JSX back into the container.
