import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Navbar from '../Navbar.jsx';

const { ensureIconfontLoaded } = vi.hoisted(() => ({
  ensureIconfontLoaded: vi.fn(),
}));

vi.mock('../icons/iconfontLoader.js', () => ({
  ensureIconfontLoaded,
}));

beforeEach(() => {
  ensureIconfontLoaded.mockReset();
  ensureIconfontLoaded.mockResolvedValue(false);

  sessionStorage.setItem(
    'userInfo',
    JSON.stringify({
      name: '张三',
      email: 'zhangsan@example.com',
      role: 'admin',
    })
  );
});

afterEach(() => {
  document.querySelectorAll('[data-testid="iconfont-symbol"]').forEach((node) => node.remove());
});

test('renders academy brand chrome, fallback icon affordances, and the active route edge case', async () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/upload-file']}>
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
  expect(brandLink.querySelector('.academy-brand-icon')).toBeInTheDocument();

  await waitFor(() => {
    expect(container.querySelectorAll('.academy-nav-icon')).toHaveLength(5);
  });

  for (const label of ['首页', '学习助手', '学习计划', '专项测评', '知识图谱', '管理后台']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }

  expect(screen.getByRole('link', { name: '学习计划' })).toHaveAttribute('aria-current', 'page');
});
