#!/usr/bin/env node
/**
 * Screenshot Harness Script
 *
 * Takes screenshots of the application at various viewports.
 *
 * Usage:
 *   npm run screenshots                          # Screenshots of / at all viewports
 *   npm run screenshots -- --route /split        # Screenshots of /split route
 *   npm run screenshots -- --params "data=abc"   # With URL params
 *   npm run screenshots -- --mock-data           # Inject v2 session (one receipt), show results tab
 *   npm run screenshots -- --mock-data --tab all # Screenshot all tabs with mock data
 *   npm run screenshots -- --mock-data --tab people # Screenshot just people tab
 *   npm run screenshots -- --mock-data --multi-receipt --tab all
 *                                            # Two-receipt v2 session (Coffee + Lunch)
 *
 * Options:
 *   --route <path>      Route to screenshot (default: /)
 *   --params <query>    URL query parameters (without leading ?)
 *   --mock-data         Inject synthetic receipt data into localStorage (v2 session)
 *   --multi-receipt     With --mock-data, inject two receipts instead of one
 *   --tab <name>        Which tab to show: upload, people, assign, results, or all (default: results)
 *   --output <dir>      Output directory (default: screenshots)
 *
 * Note: The dev server must be running on localhost:3000 before running this script.
 *       Start it with: npm run dev
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const {
  MOCK_PEOPLE,
  buildMockSession,
} = require('./screenshot-fixtures');

// Define viewport configurations
const VIEWPORTS = [
  { name: 'mobile-small', width: 320, height: 568 },   // iPhone SE
  { name: 'mobile', width: 375, height: 667 },         // iPhone 8
  { name: 'mobile-large', width: 414, height: 896 },   // iPhone 11 Pro Max
  { name: 'tablet', width: 768, height: 1024 },        // iPad
  { name: 'tablet-landscape', width: 1024, height: 768 }, // iPad Landscape
  { name: 'desktop', width: 1280, height: 800 },       // Small desktop
  { name: 'desktop-large', width: 1920, height: 1080 }, // Full HD
];

// localStorage key used by the app (must match src/app/page.tsx)
const LOCAL_STORAGE_KEY = 'receiptSplitterSession';

/**
 * Generate URL params for /split route from mock data
 */
function generateSplitParams() {
  const names = MOCK_PEOPLE.map(p => p.name).join(',');
  // Amounts in cents
  const amounts = MOCK_PEOPLE.map(p => Math.round(p.finalTotal * 100)).join(',');
  const total = MOCK_PEOPLE.reduce((sum, p) => sum + Math.round(p.finalTotal * 100), 0);

  const params = new URLSearchParams();
  params.set('names', names);
  params.set('amounts', amounts);
  params.set('total', String(total));
  params.set('note', 'Test Restaurant');
  params.set('phone', '5551234567');
  params.set('date', '2024-01-15');

  return params.toString();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    route: '/',
    params: '',
    mockData: false,
    multiReceipt: false,
    tab: 'results',
    outputDir: 'screenshots',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--route':
        options.route = args[++i] || '/';
        break;
      case '--params':
        options.params = args[++i] || '';
        break;
      case '--mock-data':
        options.mockData = true;
        break;
      case '--multi-receipt':
        options.multiReceipt = true;
        break;
      case '--tab':
        options.tab = args[++i] || 'results';
        break;
      case '--output':
        options.outputDir = args[++i] || 'screenshots';
        break;
    }
  }

  return options;
}

/**
 * Check if the dev server is running
 */
async function checkServerRunning(baseUrl) {
  try {
    await fetch(baseUrl, { method: 'HEAD' });
    return true; // any response (including 500) means the server is up
  } catch {
    return false;
  }
}

async function takeScreenshots(options) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const outputPath = path.resolve(process.cwd(), options.outputDir);

  // Check if server is running
  const serverRunning = await checkServerRunning(baseUrl);
  if (!serverRunning) {
    console.error(`\nError: Could not connect to ${baseUrl}`);
    console.error('Make sure the dev server is running: npm run dev\n');
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  // Determine which tabs to screenshot
  const ALL_TABS = ['upload', 'people', 'assign', 'results'];
  const tabsToCapture = options.tab === 'all' ? ALL_TABS : [options.tab];

  console.log(`\nScreenshot Harness`);
  console.log(`==================`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Route: ${options.route}`);
  console.log(`Params: ${options.params || '(none)'}`);
  console.log(`Mock Data: ${options.mockData ? (options.multiReceipt ? 'Yes (two receipts)' : 'Yes (one receipt)') : 'No'}`);
  console.log(`Tabs: ${options.tab === 'all' ? 'all (upload, people, assign, results)' : options.tab}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Viewports: ${VIEWPORTS.length}`);
  console.log('');

  const browser = await chromium.launch();

  try {
    for (const tab of tabsToCapture) {
      if (tabsToCapture.length > 1) {
        console.log(`\n--- Tab: ${tab} ---`);
      }

      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();

        // Build the full URL
        let url = `${baseUrl}${options.route}`;

        // Handle mock data injection based on route
        if (options.mockData) {
          if (options.route === '/split') {
            // For /split route, use URL params
            const splitParams = generateSplitParams();
            url += `?${splitParams}`;
          } else {
            // For home route, inject localStorage data using addInitScript
            // This runs before any page scripts, ensuring data is available on load
            const mockSession = buildMockSession(tab, { multiReceipt: options.multiReceipt });
            await page.addInitScript((data) => {
              window.localStorage.setItem('receiptSplitterSession', JSON.stringify(data));
            }, mockSession);
          }
        } else if (options.params) {
          url += `?${options.params}`;
        }

        console.log(`  ${viewport.name} (${viewport.width}x${viewport.height})`);

        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Wait for React hydration and content to be visible
        // Look for key elements that indicate the page is fully loaded
        try {
          if (options.mockData && options.route === '/') {
            // Wait for tab content to be visible
            await page.waitForSelector('[role="tabpanel"]', { timeout: 5000 });
          } else if (options.route === '/split' && options.mockData) {
            // Wait for split summary to load
            await page.waitForSelector('text=Receipt Split', { timeout: 5000 });
          }
        } catch {
          // If specific elements don't appear, continue anyway after networkidle
        }

        // Brief wait for any CSS animations to settle
        await page.waitForTimeout(300);

        // Generate filename
        const routeName = options.route === '/' ? 'home' : options.route.replace(/\//g, '-').slice(1);
        const tabSuffix = tabsToCapture.length > 1 ? `_${tab}` : (options.mockData && options.route === '/' ? `_${tab}` : '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${routeName}${tabSuffix}_${viewport.name}_${timestamp}.png`;
        const filePath = path.join(outputPath, filename);

        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`    Saved: ${filename}`);

        await context.close();
      }
    }

    console.log(`\nDone! Screenshots saved to ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// Main execution
const options = parseArgs();
takeScreenshots(options).catch((error) => {
  if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
    console.error('\nError: Could not connect to the dev server.');
    console.error('Make sure it is running: npm run dev\n');
  } else {
    console.error('Error taking screenshots:', error);
  }
  process.exit(1);
});
