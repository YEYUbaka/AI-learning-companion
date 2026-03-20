import { render, screen } from '@testing-library/react';
import AcademyPageShell from '../AcademyPageShell.jsx';
import AcademyCard from '../AcademyCard.jsx';

test('applies academy surface classes for the page shell and card', () => {
  render(
    <AcademyPageShell>
      <AcademyCard as="article" className="custom-card">
        <div data-testid="shell-child">body</div>
      </AcademyCard>
    </AcademyPageShell>
  );

  expect(screen.getByTestId('academy-shell')).toHaveClass('academy-shell');
  expect(screen.getByTestId('shell-child')).toBeInTheDocument();
  expect(screen.getByTestId('shell-child').closest('article')).toHaveClass(
    'academy-card',
    'border',
    'rounded-[24px]',
    'custom-card'
  );
});
