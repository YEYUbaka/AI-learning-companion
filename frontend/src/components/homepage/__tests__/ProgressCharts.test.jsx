import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ProgressCharts from '../ProgressCharts.jsx';
import { dashboardFixture } from '../../../test/fixtures/dashboardFixture.js';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');

  return {
    ...actual,
    ResponsiveContainer: ({ children }) => children,
  };
});

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
