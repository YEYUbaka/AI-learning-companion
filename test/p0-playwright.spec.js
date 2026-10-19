const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(__dirname, 'artifacts-p0-20260503');
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const FIXTURE_DIR = path.join(ARTIFACT_DIR, 'fixtures');

for (const dir of [ARTIFACT_DIR, SCREENSHOT_DIR, FIXTURE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function writeFixtureFiles() {
  const txt = path.join(FIXTURE_DIR, 'p0-valid.txt');
  const doc = path.join(FIXTURE_DIR, 'legacy-doc.doc');
  const exe = path.join(FIXTURE_DIR, 'blocked.exe');
  const large = path.join(FIXTURE_DIR, 'over-10mb.txt');

  fs.writeFileSync(txt, '智学伴 P0 自动化测试资料：函数、导数、知识图谱、学习计划。', 'utf8');
  fs.writeFileSync(doc, 'legacy doc placeholder', 'utf8');
  fs.writeFileSync(exe, 'MZ placeholder', 'utf8');
  if (!fs.existsSync(large) || fs.statSync(large).size <= 10 * 1024 * 1024) {
    fs.writeFileSync(large, Buffer.alloc(10 * 1024 * 1024 + 1024, 65));
  }

  return { txt, doc, exe, large };
}

async function visibleText(page, pattern, timeout = 5000) {
  try {
    await page.getByText(pattern).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

test.describe.configure({ mode: 'serial' });

test('P0 browser automation coverage', async ({ browser, request }) => {
  test.setTimeout(240000);
  const fixtures = writeFixtureFiles();
  const results = [];
  const browserLogs = [];
  const runId = Date.now();
  const email = `codex_p0_${runId}@example.com`;
  const password = 'Test123!';
  let userInfo = null;
  let token = null;

  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  page.on('console', (msg) => browserLogs.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => browserLogs.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => browserLogs.push(`[requestfailed] ${req.method()} ${req.url()} ${req.failure()?.errorText || ''}`));

  async function record(id, title, status, evidence, pageForScreenshot = page) {
    let screenshot = '';
    if (pageForScreenshot) {
      screenshot = path.join(SCREENSHOT_DIR, `${id}.png`);
      try {
        await pageForScreenshot.screenshot({ path: screenshot, fullPage: true });
      } catch (error) {
        browserLogs.push(`[screenshot:${id}] ${error.message}`);
        screenshot = '';
      }
    }
    results.push({ id, title, status, evidence, screenshot });
  }

  async function fillLogin(loginEmail, loginPassword) {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('请输入邮箱').fill(loginEmail);
    await page.getByPlaceholder('请输入密码').fill(loginPassword);
  }

  async function loginAsTestUser() {
    await fillLogin(email, password);
    await page.locator('form button[type="submit"]').click();
    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    } catch {
      // Keep going so the report captures the page state.
    }
    token = await page.evaluate(() => sessionStorage.getItem('token'));
    userInfo = await page.evaluate(() => JSON.parse(sessionStorage.getItem('userInfo') || 'null'));
    return Boolean(token && userInfo?.id && page.url().includes('/dashboard'));
  }

  const registerDialog = page.waitForEvent('dialog', { timeout: 7000 }).catch(() => null);
  await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入邮箱').fill(email);
  await page.getByPlaceholder('2-20个字符，支持中英文、数字').fill('CodexP0');
  await page.getByPlaceholder('至少6位，含大小写字母、数字和特殊字符').fill(password);
  await page.locator('form button[type="submit"]').click();
  const dialog = await registerDialog;
  const dialogMessage = dialog?.message() || '';
  if (dialog) await dialog.accept();
  await page.waitForURL('**/login', { timeout: 10000 }).catch(() => null);
  await record(
    'R-001',
    '正常注册',
    page.url().includes('/login') && dialogMessage.includes('注册成功') ? 'PASS' : 'FAIL',
    `注册邮箱 ${email}；dialog="${dialogMessage}"；当前URL=${page.url()}`,
  );

  await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入邮箱').fill(email);
  await page.getByPlaceholder('2-20个字符，支持中英文、数字').fill('CodexP0');
  await page.getByPlaceholder('至少6位，含大小写字母、数字和特殊字符').fill(password);
  await page.locator('form button[type="submit"]').click();
  const duplicateVisible = await visibleText(page, /该邮箱已被注册/);
  await record('R-002', '重复邮箱', duplicateVisible ? 'PASS' : 'FAIL', `重复注册错误提示可见=${duplicateVisible}`);

  await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入邮箱').fill(`short_${runId}@example.com`);
  await page.getByPlaceholder('2-20个字符，支持中英文、数字').fill('CodexP0');
  await page.getByPlaceholder('至少6位，含大小写字母、数字和特殊字符').fill('Ab1!');
  await page.locator('form button[type="submit"]').click();
  const shortPasswordVisible = await visibleText(page, /密码长度至少 6 位|密码长度不足/);
  await record('R-003', '密码过短', shortPasswordVisible ? 'PASS' : 'FAIL', `短密码前端校验提示可见=${shortPasswordVisible}`);

  await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入邮箱').fill('not-an-email');
  await page.getByPlaceholder('2-20个字符，支持中英文、数字').fill('CodexP0');
  await page.getByPlaceholder('至少6位，含大小写字母、数字和特殊字符').fill(password);
  await page.locator('form button[type="submit"]').click();
  const invalidEmailVisible = await visibleText(page, /邮箱格式不正确/);
  await record('R-004', '无效邮箱', invalidEmailVisible ? 'PASS' : 'FAIL', `邮箱格式错误提示可见=${invalidEmailVisible}`);

  await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.locator('form button[type="submit"]').click();
  const registerStayed = page.url().includes('/register');
  await record('R-005', '空字段', registerStayed ? 'PASS' : 'FAIL', `空字段提交后URL=${page.url()}`);

  const loginOk = await loginAsTestUser();
  await record('L-001', '正常登录', loginOk ? 'PASS' : 'FAIL', `登录后URL=${page.url()}；sessionStorage token=${Boolean(token)}`);

  await fillLogin(email, 'Wrong123!');
  await page.locator('form button[type="submit"]').click();
  const wrongPasswordVisible = await visibleText(page, /邮箱或密码错误/);
  await record('L-002', '错误密码', wrongPasswordVisible ? 'PASS' : 'FAIL', `统一错误提示可见=${wrongPasswordVisible}`);

  await fillLogin(`missing_${runId}@example.com`, password);
  await page.locator('form button[type="submit"]').click();
  const missingEmailVisible = await visibleText(page, /邮箱或密码错误/);
  await record('L-003', '不存在邮箱', missingEmailVisible ? 'PASS' : 'FAIL', `不存在邮箱使用统一错误提示=${missingEmailVisible}`);

  await page.route('**/api/v1/auth/login-json', (route) => route.abort('failed'));
  await fillLogin(email, password);
  await page.locator('form button[type="submit"]').click();
  const backendDisconnectedVisible = await visibleText(page, /无法连接到服务器/);
  await page.unroute('**/api/v1/auth/login-json');
  await record('L-004', '后端断开', backendDisconnectedVisible ? 'PASS' : 'FAIL', `浏览器网络失败时错误提示可见=${backendDisconnectedVisible}`);

  await page.route('**/api/v1/auth/login-json', async (route) => {
    await sleep(11000);
    await route.fulfill({ status: 504, contentType: 'application/json', body: '{"detail":"timeout"}' }).catch(() => null);
  });
  await fillLogin(email, password);
  await page.locator('form button[type="submit"]').click();
  const timeoutVisible = await visibleText(page, /请求超时/, 14000);
  await page.unroute('**/api/v1/auth/login-json');
  await record('L-005', '请求超时', timeoutVisible ? 'PASS' : 'FAIL', `Axios超时提示可见=${timeoutVisible}`);

  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('form button[type="submit"]').click({ force: true });
  await record('L-006', '空表单', page.url().includes('/login') ? 'PASS' : 'FAIL', `空登录表单提交后URL=${page.url()}`);

  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/login', { timeout: 5000 }).catch(() => null);
  await record('L-007', '无Token访问', page.url().includes('/login') ? 'PASS' : 'FAIL', `无token访问dashboard后URL=${page.url()}`);

  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    sessionStorage.setItem('token', 'expired.invalid.token');
    sessionStorage.setItem('userInfo', JSON.stringify({ id: 1, email: 'expired@example.com', name: 'Expired', role: 'user' }));
  });
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/login', { timeout: 8000 }).catch(() => null);
  await record('L-008', 'Token过期', page.url().includes('/login') ? 'PASS' : 'FAIL', `无效JWT触发401处理后URL=${page.url()}`);

  await loginAsTestUser();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await record('L-009', '刷新保持登录', page.url().includes('/dashboard') && Boolean(await page.evaluate(() => sessionStorage.getItem('token'))) ? 'PASS' : 'FAIL', `刷新后URL=${page.url()}`);

  const newContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const newPage = await newContext.newPage();
  await newPage.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await newPage.waitForURL('**/login', { timeout: 5000 }).catch(() => null);
  await record('L-010', '关闭标签页/新会话', newPage.url().includes('/login') ? 'PASS' : 'FAIL', `新浏览器上下文访问dashboard后URL=${newPage.url()}`, newPage);
  await newContext.close();

  await loginAsTestUser();
  await page.getByTitle('切换主题').first().click();
  await page.getByRole('button', { name: /深色模式/ }).click();
  const darkClass = await page.locator('body').evaluate((node) => node.innerText.includes('欢迎来到智学伴'));
  await page.getByTitle('切换主题').first().click();
  await page.getByRole('button', { name: /浅色模式/ }).click();
  await record('L-011', '暗色/亮色切换', darkClass ? 'PASS' : 'FAIL', '主题切换后页面主要内容仍可见');

  await page.route('**/api/v1/analytics/progress/**', async (route) => {
    await sleep(1200);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ average_score: 0, completion_rate: 0, total_tests: 0, total_plans: 0 }),
    }).catch(() => null);
  });
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  const skeletonVisible = await page.locator('.animate-pulse').first().isVisible().catch(() => false);
  await record('D-001', '骨架屏加载', skeletonVisible ? 'PASS' : 'FAIL', `animate-pulse可见=${skeletonVisible}`);
  await page.unroute('**/api/v1/analytics/progress/**');

  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle' }).catch(() => null);
  const dashboardCore = await visibleText(page, /核心功能/) && await visibleText(page, /学习数据|快速开始/);
  await record('D-002', '数据加载', dashboardCore ? 'PASS' : 'FAIL', `核心功能和数据区域可见=${dashboardCore}`);

  await page.route('**/api/v1/analytics/progress/**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }));
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const dashboardNotCrashed = await visibleText(page, /欢迎来到智学伴|核心功能/);
  await page.unroute('**/api/v1/analytics/progress/**');
  await record('D-003', 'API失败', dashboardNotCrashed ? 'PASS' : 'FAIL', `analytics 500时页面仍渲染=${dashboardNotCrashed}`);

  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle' }).catch(() => null);
  const hasZeroOrStats = (await page.locator('text=/平均得分|完成率|已完成测验|学习计划/').count()) >= 4;
  await record('D-004', '新用户空数据', hasZeroOrStats ? 'PASS' : 'FAIL', `统计卡区域可见=${hasZeroOrStats}`);

  const navTargets = [
    ['AI 智能助手', '/agent'],
    ['智能组卷', '/quiz'],
    ['学习计划', '/study-plan'],
    ['知识图谱', '/learning-map'],
  ];
  let navOk = true;
  for (const [label, target] of navTargets) {
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.getByText(label).first().click();
    await page.waitForURL(`**${target}`, { timeout: 5000 }).catch(() => { navOk = false; });
  }
  await record('D-005', '卡片导航', navOk ? 'PASS' : 'FAIL', `4个功能卡跳转全部正确=${navOk}`);

  await page.goto(`${FRONTEND_URL}/study-plan`, { waitUntil: 'networkidle' }).catch(() => null);
  const createFormVisible = await visibleText(page, /学习目标|创建计划|生成学习计划/);
  await record('SP-001', '首次访问无计划', createFormVisible ? 'PASS' : 'FAIL', `创建表单/入口可见=${createFormVisible}`);

  await page.getByRole('button', { name: /创建学习计划/ }).first().click().catch(() => null);
  await page.getByRole('button', { name: /生成学习计划/ }).click().catch(() => null);
  const emptyGoalVisible = await visibleText(page, /请输入学习目标/);
  await record('SP-003', '空目标', emptyGoalVisible ? 'PASS' : 'FAIL', `空目标错误提示可见=${emptyGoalVisible}`);

  await page.goto(`${FRONTEND_URL}/learning-map`, { waitUntil: 'networkidle' }).catch(() => null);
  const emptyMapVisible = await visibleText(page, /暂无图谱数据，请先生成/);
  await record('LM-001', '知识图谱空状态', emptyMapVisible ? 'PASS' : 'FAIL', `空状态提示可见=${emptyMapVisible}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FRONTEND_URL}/learning-map`, { waitUntil: 'domcontentloaded' });
  const mobileTabs =
    await page.getByRole('button', { name: /^生成$/ }).isVisible().catch(() => false)
    && await page.getByRole('button', { name: /^图谱$/ }).isVisible().catch(() => false)
    && await page.getByRole('button', { name: /^详情$/ }).isVisible().catch(() => false)
    && await page.getByRole('button', { name: /^历史$/ }).isVisible().catch(() => false);
  await record('LM-009', '知识图谱移动端适配', mobileTabs ? 'PASS' : 'FAIL', `移动端标签/主区域可见=${mobileTabs}`);
  await page.setViewportSize({ width: 1366, height: 768 });

  await page.goto(`${FRONTEND_URL}/upload-file`, { waitUntil: 'domcontentloaded' });
  await page.locator('#file-upload').setInputFiles(fixtures.txt);
  await page.getByRole('button', { name: /上传文件/ }).click();
  const uploadOk = await visibleText(page, /文件上传成功|教材上传完成/, 15000);
  await record('UF-001', '有效文件上传', uploadOk ? 'PASS' : 'FAIL', `txt上传成功提示可见=${uploadOk}`);

  await page.goto(`${FRONTEND_URL}/upload-file`, { waitUntil: 'domcontentloaded' });
  await page.locator('#file-upload').setInputFiles(fixtures.doc);
  const docRejected = await visibleText(page, /不支持的文件类型: \.doc|暂不支持/);
  await record('UF-002', '.doc拒绝', docRejected ? 'PASS' : 'FAIL', `.doc错误提示可见=${docRejected}`);

  await page.locator('#file-upload').setInputFiles(fixtures.exe);
  const exeRejected = await visibleText(page, /不支持的文件类型: \.exe/);
  await record('UF-003', '不支持格式', exeRejected ? 'PASS' : 'FAIL', `.exe错误提示可见=${exeRejected}`);

  await page.locator('#file-upload').setInputFiles(fixtures.large);
  const largeRejected = await visibleText(page, /文件过大/);
  await record('UF-004', '超10MB', largeRejected ? 'PASS' : 'FAIL', `>10MB错误提示可见=${largeRejected}`);

  await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => null);
  await record('AD-001', '普通用户被拒', page.url().includes('/dashboard') ? 'PASS' : 'FAIL', `普通用户访问/admin后URL=${page.url()}`);

  const noAuth = await request.get(`${BACKEND_URL}/api/v1/admin/dashboard`);
  await record('SEC-001', '无Token访问受保护API', noAuth.status() === 401 ? 'PASS' : 'FAIL', `GET /api/v1/admin/dashboard 无token状态码=${noAuth.status()}`, null);

  const userAdmin = await request.get(`${BACKEND_URL}/api/v1/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await record('SEC-002', 'Admin权限隔离', userAdmin.status() === 403 ? 'PASS' : 'FAIL', `普通用户访问admin API状态码=${userAdmin.status()}`, null);

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'browser-console.log'), browserLogs.join('\n'), 'utf8');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'p0-browser-results.json'), JSON.stringify(results, null, 2), 'utf8');

  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length;
  const markdown = [
    '# P0 浏览器自动化测试结果',
    '',
    `- 执行时间: ${new Date().toISOString()}`,
    `- 前端: ${FRONTEND_URL}`,
    `- 后端: ${BACKEND_URL}`,
    `- 汇总: PASS ${passed} / FAIL ${failed}`,
    '',
    '| 编号 | 用例 | 结果 | 证据 | 截图 |',
    '|---|---|---|---|---|',
    ...results.map((item) => `| ${item.id} | ${item.title} | ${item.status} | ${String(item.evidence).replace(/\|/g, '\\|')} | ${item.screenshot || ''} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'p0-browser-report.md'), markdown, 'utf8');

  await context.close();
});
