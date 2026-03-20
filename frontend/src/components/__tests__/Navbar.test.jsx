import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Navbar from '../Navbar.jsx';
import { HOMEPAGE_ICON_NAMES } from '../icons/homepageIconNames.js';

const { ensureIconfontLoaded } = vi.hoisted(() => ({
  ensureIconfontLoaded: vi.fn(),
}));

vi.mock('../icons/iconfontLoader.js', () => ({
  ensureIconfontLoaded,
}));

function registerIconSymbol(name) {
  const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  symbol.id = name;
  symbol.dataset.testid = 'iconfont-symbol';
  document.body.appendChild(symbol);
}

beforeEach(() => {
  ensureIconfontLoaded.mockReset();
  ensureIconfontLoaded.mockResolvedValue(true);

  sessionStorage.setItem(
    'userInfo',
    JSON.stringify({
      name: '张三',
      email: 'zhangsan@example.com',
      role: 'admin',
    })
  );

  [...new Set(Object.values(HOMEPAGE_ICON_NAMES))].forEach(registerIconSymbol);
});

afterEach(() => {
  document.querySelectorAll('[data-testid="iconfont-symbol"]').forEach((node) => node.remove());
});

test('renders academy brand chrome, icon-led nav items, and the active route state', async () => {
  render(
    <MemoryRouter initialEntries={['/agent']}>
      <Navbar />
    </MemoryRouter>
  );

  expect(screen.getByRole('link', { name: /智学伴/ })).toBeInTheDocument();
  expect(screen.getByText('学院风学习平台')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: '切换主题' })).toHaveLength(2);
  });
  expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
  expect(screen.getByLabelText('打开导航菜单')).toBeInTheDocument();

  const brandLink = screen.getByRole('link', { name: /智学伴/ });
  expect(brandLink.querySelector('.academy-brand-mark')).toBeInTheDocument();
  await waitFor(() => {
    expect(brandLink.querySelector('use')).toHaveAttribute('href', `#${HOMEPAGE_ICON_NAMES.brand}`);
  });

  const navExpectations = [
    ['首页', HOMEPAGE_ICON_NAMES.home],
    ['智学助手', HOMEPAGE_ICON_NAMES.agent],
    ['学习计划', HOMEPAGE_ICON_NAMES.plan],
    ['AI 测评', HOMEPAGE_ICON_NAMES.quiz],
    ['知识图谱', HOMEPAGE_ICON_NAMES.map],
    ['管理后台', null],
  ];

  for (const [label, iconName] of navExpectations) {
    const link = screen.getByRole('link', { name: label });

    if (iconName) {
      await waitFor(() => {
        expect(link.querySelector('use')).toHaveAttribute('href', `#${iconName}`);
      });
    }
  }

  expect(screen.getByRole('link', { name: '智学助手' })).toHaveAttribute('aria-current', 'page');
});
