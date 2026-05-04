const { test, expect } = require('@playwright/test');

test('MathText renders inline latex with KaTeX', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/quiz');
  await page.evaluate(async () => {
    const [{ default: React }, ReactDomClient, { default: MathText }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js?v=dev'),
      import('/node_modules/.vite/deps/react-dom_client.js?v=dev'),
      import('/src/components/MathText.jsx'),
    ]);

    document.body.innerHTML = '<main id="math-root"></main>';
    const createRoot = ReactDomClient.createRoot || ReactDomClient.default?.createRoot;
    createRoot(document.getElementById('math-root')).render(
      React.createElement(MathText, { as: 'div' }, '已知向量$\\vec{a}=(2,m)$，若$\\vec{a}$与$\\vec{b}$共线')
    );
  });

  await expect(page.locator('.katex')).toHaveCount(3);
});
