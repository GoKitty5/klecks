import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);
  await page.goto('http://localhost:1234', { waitUntil: 'networkidle0' });

  // Open the New Image dialog by calling the global API the app exposes
  await page.evaluate(() => {
    if (window.KL && typeof window.KL.newImageDialog === 'function') {
      // pass large initial sizes to trigger the warning
      window.KL.newImageDialog({
        currentColor: { r: 255, g: 255, b: 255 },
        secondaryColor: { r: 0, g: 0, b: 0 },
        maxCanvasSize: 8000,
        canvasWidth: 7000,
        canvasHeight: 7000,
        workspaceWidth: 1000,
        workspaceHeight: 800,
        onConfirm: () => (window.__NEW_IMAGE_DONE = 'confirm'),
        onCancel: () => (window.__NEW_IMAGE_DONE = 'cancel'),
      });
    } else {
      window.__NEW_IMAGE_ERR = 'KL API missing';
    }
  });

  // Wait for the capability warning text (covers both phrasing variants)
  try {
    await page.waitForXPath(
      "//*[contains(., 'Selected size may exceed device capabilities') or contains(., 'Large sizes may be slow') or contains(., 'Selected size may exceed') ]",
      { timeout: 7000 },
    );
    console.log('WARNING_TEXT_FOUND');
  } catch (e) {
    if ((await page.evaluate(() => window.__NEW_IMAGE_ERR)) === 'KL API missing') {
      console.error('ERROR: KL API not found on page');
      await browser.close();
      process.exit(3);
    }
    console.log('WARNING_TEXT_NOT_FOUND');
  }

  await browser.close();
})().catch((err) => {
  console.error('TEST_ERROR', err);
  process.exit(2);
});
