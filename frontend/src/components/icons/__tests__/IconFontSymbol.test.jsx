import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import IconFontSymbol from '../IconFontSymbol.jsx';

const { ensureIconfontLoaded } = vi.hoisted(() => ({
  ensureIconfontLoaded: vi.fn(),
}));

vi.mock('../iconfontLoader.js', () => ({
  ensureIconfontLoaded,
}));

beforeEach(() => {
  ensureIconfontLoaded.mockReset();
});

afterEach(() => {
  document.querySelectorAll('[data-testid="iconfont-symbol"]').forEach((node) => node.remove());
});

describe('IconFontSymbol', () => {
  test('renders fallback content when the iconfont sprite is unavailable', async () => {
    ensureIconfontLoaded.mockResolvedValue(false);

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

  test('renders the requested symbol when the sprite is available', async () => {
    ensureIconfontLoaded.mockResolvedValue(true);

    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    symbol.id = 'icon-homepage-nav';
    symbol.dataset.testid = 'iconfont-symbol';
    document.body.appendChild(symbol);

    render(<IconFontSymbol name="icon-homepage-nav" title="首页" />);

    const icon = await screen.findByRole('img', { name: '首页' });
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.querySelector('use')).toHaveAttribute('href', '#icon-homepage-nav');
  });

  test('renders fallback content when the sprite loads but the symbol is missing', async () => {
    ensureIconfontLoaded.mockResolvedValue(true);

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
