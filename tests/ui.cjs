const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
      if (!file.startsWith(root + path.sep) || /(?:^|[\\/])(?:\.git|\.env|node_modules|supabase|tests)(?:[\\/]|$)/.test(file.slice(root.length))) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        } else {
          res.writeHead(200, {
            'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-store'
          });
          res.end(data);
        }
      });
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function runTests() {
  console.log('Starting local web server for UI testing...');
  const server = await startServer(8099);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on ${baseUrl}`);

  let browser;
  try {
    let launchOptions = { headless: true };
    try {
      browser = await chromium.launch(launchOptions);
    } catch (e) {
      if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
        browser = await chromium.launch({ ...launchOptions, channel: 'chrome' });
      } else if (fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
        browser = await chromium.launch({ ...launchOptions, channel: 'msedge' });
      } else {
        throw e;
      }
    }
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 RondaTest/3.0'
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_REFUSED') && !msg.text().includes('supabase.co')) {
        consoleErrors.push(msg.text());
      }
    });

    console.log('Test 1: Opening page directly without splash screen or "Buka Aplikasi"');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    
    // 1. Verify Opening Screen is gone
    const bukaAppBtn = await page.$('text="Buka Aplikasi"');
    assert.equal(bukaAppBtn, null, 'Tombol "Buka Aplikasi" should not exist');

    // 2. Verify Login screen is shown
    const loginScreen = await page.$('#screenLogin');
    assert.ok(loginScreen, 'Login screen element should exist');
    const isLoginHidden = await page.$eval('#screenLogin', el => el.classList.contains('hidden'));
    assert.equal(isLoginHidden, false, 'Login screen must be visible when not authenticated');

    // 3. Verify Login UI components
    const phoneInput = await page.$('#input-whatsapp');
    const pinInput = await page.$('#input-pin');
    const submitBtn = await page.$('#btnLoginSubmit');
    assert.ok(phoneInput && pinInput && submitBtn, 'Login form inputs must be present');

    // 4. Test Register modal open and close
    console.log('Test 2: Register modal interaction');
    await page.click('button:has-text("Daftar Akun Baru")');
    const regModalVisible = await page.$eval('#modalRegister', el => !el.classList.contains('hidden'));
    assert.equal(regModalVisible, true, 'Register modal should open');
    await page.click('#modalRegister button[aria-label="Tutup"]');
    const regModalClosed = await page.$eval('#modalRegister', el => el.classList.contains('hidden'));
    assert.equal(regModalClosed, true, 'Register modal should close');

    // 5. Test Responsive layout on small mobile (360x740)
    console.log('Test 3: Responsive layout on small viewport (360x740)');
    await page.setViewportSize({ width: 360, height: 740 });
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(hasHorizontalScroll, false, 'Page should not have horizontal overflow on small screen');

    // 6. Test Dashboard view by simulating authenticated state
    console.log('Test 4: Dashboard view & operational components');
    await page.evaluate(() => {
      currentUser = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Master Admin RT',
        phone: '085877672699',
        role: 'master',
        avatar: ''
      };
      houseData = [
        { id: 'h1', name: 'Rumah No. 01', description: 'Gang Mawar', occupied: true, paid: true, latitude: -7.78, longitude: 110.36 },
        { id: 'h2', name: 'Rumah No. 02', description: 'Gang Mawar', occupied: true, paid: false, latitude: -7.7801, longitude: 110.3601 },
        { id: 'h3', name: 'Rumah No. 03 (Kosong)', description: 'Gang Dahlia', occupied: false, paid: false, latitude: null, longitude: null }
      ];
      dashboardTotal = 15000;
      renderIdentity();
      renderDashboard();
      navigateToScreen('screenDashboard');
    });

    const isDashVisible = await page.$eval('#screenDashboard', el => !el.classList.contains('hidden'));
    assert.equal(isDashVisible, true, 'Dashboard screen should be visible when authenticated');

    // 7. Verify Change Log 07 & 08:
    // Header date exists, no "Shift Aktif", no verification badge in header
    const shiftSchedule = await page.$eval('#shiftScheduleTitle', el => el.textContent.trim());
    assert.ok(shiftSchedule.length > 0, 'Shift schedule date must be populated');
    const shiftAktifPresent = await page.evaluate(() => document.body.innerText.includes('Shift Aktif'));
    assert.equal(shiftAktifPresent, false, '"Shift Aktif" should not exist on Dashboard');

    // Stat cards: Rumah Terpasang, Rumah Kosong, Rumah Lunas
    const pasangVal = await page.$eval('#cardValPasang', el => el.textContent.trim());
    const kosongVal = await page.$eval('#cardValKosong', el => el.textContent.trim());
    const lunasVal = await page.$eval('#cardValLunas', el => el.textContent.trim());
    assert.equal(pasangVal, '2', 'Rumah Terpasang count should be 2');
    assert.equal(kosongVal, '1', 'Rumah Kosong count should be 1');
    assert.equal(lunasVal, '1', 'Rumah Lunas count should be 1');

    // 8. Test Stat Detail Modals
    console.log('Test 5: Stat detail modal (Terpasang includes Lunas)');
    await page.click('button:has(#cardValPasang)');
    const panelTitle = await page.$eval('#operationalTitle', el => el.textContent.trim());
    assert.equal(panelTitle, 'Rumah Terpasang', 'Panel title should be Rumah Terpasang');
    const panelBody = await page.$eval('#operationalBody', el => el.innerText);
    assert.ok(panelBody.includes('Rumah No. 01'), 'Lunas house should still appear in Terpasang list');
    assert.ok(panelBody.includes('Rumah No. 02'), 'Unpaid house should appear in Terpasang list');
    assert.ok(!panelBody.includes('Rumah No. 03 (Kosong)'), 'Empty house should not appear in Terpasang list');
    await page.click('#operationalPanel button[aria-label="Tutup"]');

    // 9. Test Profile Modal (Change Log 06)
    console.log('Test 6: Profile modal simplification');
    await page.evaluate(() => openProfileModal());
    const profName = await page.$eval('#profileModalName', el => el.textContent.trim());
    assert.equal(profName, 'Master Admin RT', 'Profile name matches');
    const profRole = await page.$eval('#profileModalRole', el => el.textContent.trim());
    assert.equal(profRole, 'RT 01 / RW 02', 'Profile region format matches RT 01 / RW 02');
    const pwaInProfile = await page.evaluate(() => {
      const modal = document.getElementById('profileModal');
      return modal.innerText.includes('layar utama') || modal.innerText.includes('Pasang aplikasi');
    });
    assert.equal(pwaInProfile, false, 'PWA install button must not be in profile modal');
    await page.evaluate(() => closeProfileModal());

    // 10. Test Route Map Modal (Leaflet OSM map)
    console.log('Test 7: Route map modal with Leaflet');
    await page.evaluate(() => {
      openRouteMapModal();
    });
    const mapModalVisible = await page.$eval('#routeMapModal', el => !el.classList.contains('hidden'));
    assert.equal(mapModalVisible, true, 'Route map modal should open');
    const hasLeafletMap = await page.$eval('#googleMap', el => el.classList.contains('leaflet-container'));
    assert.equal(hasLeafletMap, true, 'Map should be initialized with Leaflet container');
    await page.evaluate(() => closeRouteMapModal());

    // 11. Test Rekap Modal
    console.log('Test 8: Rekap modal & tabs');
    await page.evaluate(() => openRekapModal());
    const rekapVisible = await page.$eval('#rekapModal', el => !el.classList.contains('hidden'));
    assert.equal(rekapVisible, true, 'Rekap modal should open');
    const tabHari = await page.$('#tabRekapHari');
    const tabMinggu = await page.$('#tabRekapMinggu');
    const tabBulan = await page.$('#tabRekapBulan');
    assert.ok(tabHari && tabMinggu && tabBulan, 'Rekap modal should have Harian, Mingguan, Bulanan tabs');
    await page.evaluate(() => closeRekapModal());

    // 12. Verify absence of technical database error messages
    console.log('Test 9: Absence of technical errors');
    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(!bodyText.includes('Izin SQL Diperlukan'), 'No "Izin SQL Diperlukan"');
    assert.ok(!bodyText.includes('Permission 42501'), 'No "Permission 42501"');
    assert.ok(!bodyText.includes('SQL Permission'), 'No "SQL Permission"');

    console.log('All UI automated tests passed successfully!');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTests().catch(err => {
  console.error('UI Test failed:', err);
  process.exit(1);
});
