const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {mkdirSync} = require('node:fs');
const {chromium} = require('playwright');

const port = process.env.PORT || '8099';
const baseUrl = `http://127.0.0.1:${port}`;
mkdirSync('test-results', {recursive: true});

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server lokal tidak siap.')), 15000);
    proc.stdout.on('data', chunk => {
      if (chunk.toString().includes('http://')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Server berhenti lebih awal: ${code}`));
    });
  });
}

async function checkViewport(browser, name, viewport) {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
  });
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.waitForSelector('#screenLogin', {state: 'visible'});
  assert.equal(await page.locator('#openingScreen').count(), 0);
  assert.equal(await page.locator('script[src*="maps.googleapis"]').count(), 0);
  assert.ok(await page.locator('#input-whatsapp').isVisible());
  assert.ok(await page.evaluate(() => Boolean(window.supabase && window.RONDA_CONFIG && window.L)));
  await page.screenshot({path: `test-results/ui-${name}.png`, fullPage: true});
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkSecurityGate(browser) {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  await page.addInitScript(() => {
    localStorage.setItem('ronda_session', 'stored-session-token');
    localStorage.setItem('ronda_last_account', JSON.stringify({
      id: 'last-account',
      name: 'Ilham',
      phone: '6281234567890',
      biometric: false
    }));
  });
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.waitForSelector('#screenLogin', {state: 'visible'});
  assert.ok(await page.locator('#screenDashboard').evaluate(el => el.classList.contains('hidden')));
  assert.equal(await page.locator('#loginSubheading').textContent(), 'Ilham');
  await page.close();
}

async function checkDisplayNameCleanup(browser) {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  const names = await page.evaluate(() => [
    displayPointName({name: 'HSE-RT01-10 01', description: 'Ilham'}),
    displayPointName({name: 'HSE-RT01-02 02', description: 'Rumah Bu Sari'}),
    markerPopup({id:'p1', name:'HSE-RT-01 01', description:'Pak Budi', status_today:'belum', paid:false})
  ]);
  assert.deepEqual(names.slice(0, 2), ['Ilham', 'Rumah Bu Sari']);
  assert.equal(names[2].includes('HSE'), false);
  await page.close();
}

(async () => {
  const server = spawn(process.execPath, ['scripts/serve.cjs'], {
    cwd: process.cwd(),
    env: {...process.env, PORT: port},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await waitForServer(server);
    const browser = await chromium.launch();
    try {
      await checkViewport(browser, 'desktop', {width: 390, height: 844});
      await checkViewport(browser, 'mobile', {width: 360, height: 740, isMobile: true});
      await checkSecurityGate(browser);
      await checkDisplayNameCleanup(browser);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
