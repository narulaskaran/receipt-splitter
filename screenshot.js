const { chromium } = require('playwright');

async function takeScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewportSize({ width: 1200, height: 800 });
  
  // Navigate to the split page with test data
  const testUrl = 'http://localhost:3000/split?names=Alice,Bob,Charlie&amounts=10.00,10.00,10.00&total=30.00&note=Test%20Restaurant&phone=5551234567';
  
  console.log('Navigating to:', testUrl);
  await page.goto(testUrl);
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Take screenshot
  await page.screenshot({ 
    path: 'venmo-buttons-light-mode.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved as venmo-buttons-light-mode.png');
  
  await browser.close();
}

takeScreenshot().catch(console.error);