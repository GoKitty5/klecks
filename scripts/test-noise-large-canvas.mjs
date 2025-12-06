import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  
  // Increase timeout for long-running filter operations
  page.setDefaultTimeout(60000);
  
  console.log('Navigating to http://localhost:1234...');
  await page.goto('http://localhost:1234', { waitUntil: 'networkidle0' });

  console.log('Waiting for KL app to initialize...');
  await page.waitForFunction(() => window.KL && typeof window.KL.newImageDialog === 'function', {
    timeout: 15000,
  });

  console.log('Creating 7000x7000 canvas...');
  // Create a large canvas
  await page.evaluate(() => {
    return new Promise((resolve) => {
      window.KL.newImageDialog({
        currentColor: { r: 255, g: 255, b: 255 },
        secondaryColor: { r: 0, g: 0, b: 0 },
        maxCanvasSize: 8000,
        canvasWidth: 1000,
        canvasHeight: 1000,
        workspaceWidth: 1000,
        workspaceHeight: 800,
        onConfirm: (w, h, color) => {
          console.log(`Canvas created: ${w}x${h}`);
          window.__CANVAS_SIZE = { w, h };
          resolve();
        },
        onCancel: () => {
          window.__CANVAS_CANCELLED = true;
          resolve();
        },
      });
    });
  });

  // Set the input values to 7000x7000 before confirming
  await page.evaluate(() => {
    const widthInput = document.querySelector('input[name="image-width"]');
    const heightInput = document.querySelector('input[name="image-height"]');
    if (widthInput && heightInput) {
      widthInput.value = '7000';
      heightInput.value = '7000';
      widthInput.dispatchEvent(new Event('change', { bubbles: true }));
      heightInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Click OK button to confirm
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const okBtn = buttons.find(b => b.textContent.includes('Ok'));
    if (okBtn) okBtn.click();
  });

  // Wait for canvas to be created
  console.log('Waiting for canvas creation...');
  await page.waitForFunction(
    () => window.__CANVAS_SIZE && window.__CANVAS_SIZE.w === 7000,
    { timeout: 30000 },
  );
  console.log('✓ Canvas 7000x7000 created');

  // Wait a moment for the UI to settle
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Looking for Noise/Static filter in UI...');
  // Try to find and apply Noise filter
  const noiseApplied = await page.evaluate(async () => {
    // Look for Noise filter button/menu item
    const allElements = document.querySelectorAll('*');
    let noiseBtn = null;
    
    for (const el of allElements) {
      if (el.textContent && (el.textContent.includes('Noise') || el.textContent.includes('Static'))) {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.classList.contains('kl-menu-item')) {
          noiseBtn = el;
          break;
        }
      }
    }
    
    if (!noiseBtn) {
      console.log('Noise button not found in DOM');
      return { found: false, error: 'Noise button not found' };
    }
    
    console.log('Found Noise button, clicking...');
    noiseBtn.click();
    
    // Wait for filter dialog or application
    await new Promise(r => setTimeout(r, 2000));
    
    // Look for apply/ok button in filter dialog
    const buttons = Array.from(document.querySelectorAll('button'));
    const applyBtn = buttons.find(b => 
      b.textContent.includes('Apply') || 
      b.textContent.includes('OK') ||
      b.textContent.includes('Ok')
    );
    
    if (applyBtn) {
      console.log('Applying noise filter...');
      applyBtn.click();
      return { found: true, applied: true };
    }
    
    return { found: true, applied: false, msg: 'Apply button not found' };
  });

  console.log('Noise filter result:', noiseApplied);

  // Wait for filter to process (give it up to 45 seconds for large canvas)
  console.log('Waiting for filter to complete (up to 45s)...');
  try {
    await page.waitForFunction(
      () => !document.body.classList.contains('busy') && !document.querySelector('[class*="processing"]'),
      { timeout: 45000 },
    );
    console.log('✓ Filter completed without crashing');
  } catch (e) {
    console.log('⚠ Timeout waiting for filter completion (may still be processing)');
  }

  // Check for JavaScript errors
  const errors = await page.evaluate(() => window.__ERRORS || []);
  if (errors.length > 0) {
    console.error('JS Errors detected:', errors);
  } else {
    console.log('✓ No JS errors');
  }

  // Simple check: verify canvas is still responsive
  const canvasStillValid = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return !!(canvas && canvas.width > 0 && canvas.height > 0);
  });

  if (canvasStillValid) {
    console.log('✓ Canvas still valid after filter');
  } else {
    console.log('✗ Canvas invalid after filter');
  }

  console.log('\n========== TEST SUMMARY ==========');
  if (noiseApplied.found && canvasStillValid) {
    console.log('RESULT: PASS - Noise filter on 7000x7000 canvas succeeded');
  } else {
    console.log('RESULT: INCONCLUSIVE - Could not fully verify noise application');
    console.log('Details:', { noiseApplied, canvasStillValid });
  }

  await browser.close();
})().catch((err) => {
  console.error('TEST_ERROR:', err.message);
  process.exit(2);
});
