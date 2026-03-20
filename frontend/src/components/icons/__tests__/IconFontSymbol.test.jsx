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
