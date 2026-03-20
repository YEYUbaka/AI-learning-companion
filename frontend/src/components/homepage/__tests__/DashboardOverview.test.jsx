import { screen } from '@testing-library/react';
import Dashboard from '../../../pages/Dashboard.jsx';
import DashboardOverview from '../DashboardOverview.jsx';
import { dashboardFixture } from '../../../test/fixtures/dashboardFixture.js';
import { renderWithRouter } from '../../../test/renderWithRouter.jsx';
import { beforeEach, test, vi } from 'vitest';

const { ensureIconfontLoaded, apiGet } = vi.hoisted(() => ({
  ensureIconfontLoaded: vi.fn(() => new Promise(() => {})),
  apiGet: vi.fn(),
}));

vi.mock('../../icons/iconfontLoader.js', () => ({
  ensureIconfontLoaded,
}));

vi.mock('../../../api/apiClient.js', () => ({
  default: {
    get: apiGet,
    defaults: {
      baseURL: 'https://example.com',
    },
  },
}));

beforeEach(() => {
  ensureIconfontLoaded.mockClear();
  ensureIconfontLoaded.mockImplementation(() => new Promise(() => {}));
  apiGet.mockReset();
});

test('renders the academy hero, stat cards, tool cards, and weak topics panel', () => {
  renderWithRouter(
    <DashboardOverview
      data={dashboardFixture}
      onDownloadReport={() => {}}
    />
  );

  expect(screen.getByRole('heading', { name: /学习中枢/ })).toBeInTheDocument();
  expect(screen.getAllByTestId('academy-stat-card')).toHaveLength(4);
  expect(screen.getAllByTestId('quick-tool-card')).toHaveLength(5);
  expect(screen.getByText('需要加强的方面')).toBeInTheDocument();
});

test('lets the quick tools section span full width when there are no weak topics', () => {
  const { container } = renderWithRouter(
    <DashboardOverview
      data={{ ...dashboardFixture, weakTopics: [] }}
      onDownloadReport={() => {}}
    />
  );

  expect(screen.queryByText('需要加强的方面')).not.toBeInTheDocument();
  expect(
    container.querySelector('.xl\\:grid-cols-\\[minmax\\(0\\,2fr\\)_minmax\\(280px\\,1fr\\)\\]')
  ).toBeNull();
});

test('keeps rendering when topic statistics are not returned as an array', async () => {
  sessionStorage.setItem(
    'userInfo',
    JSON.stringify({
      id: 7,
      name: '林然',
    })
  );

  apiGet
    .mockResolvedValueOnce({
      data: {
        average_score: 86,
        completion_rate: 72,
        total_tests: 18,
        total_plans: 4,
        score_trend: [],
        recent_scores: [],
        weak_topics: [],
      },
    })
    .mockResolvedValueOnce({
      data: {
        topic_statistics: {
          algebra: 1,
        },
      },
    });

  renderWithRouter(<Dashboard />);

  expect(await screen.findByRole('heading', { name: /学习中枢/ })).toBeInTheDocument();
});
