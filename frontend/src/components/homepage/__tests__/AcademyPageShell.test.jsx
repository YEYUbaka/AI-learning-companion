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
