#!/usr/bin/env node
/**
 * Screenshot Harness Script
 *
 * Takes screenshots of the application at various viewports.
 *
 * Usage:
 *   npm run screenshots                    # Screenshots of / at all viewports
 *   npm run screenshots -- --route /split  # Screenshots of /split route
 *   npm run screenshots -- --params "data=abc123"  # With URL params
 *   npm run screenshots -- --mock-data     # Inject synthetic localStorage data
 *
 * Options:
 *   --route <path>      Route to screenshot (default: /)
 *   --params <query>    URL query parameters (without leading ?)
 *   --mock-data         Inject synthetic receipt data into localStorage
 *   --output <dir>      Output directory (default: screenshots)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

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

// Synthetic mock data for testing
const MOCK_RECEIPT = {
  restaurant: "Test Restaurant",
  date: "2024-01-15",
  subtotal: 45.00,
  tax: 4.50,
  tip: 9.00,
  total: 58.50,
  items: [
    { name: "Burger", price: 15.00, quantity: 1 },
    { name: "Fries", price: 5.00, quantity: 2 },
    { name: "Soda", price: 3.00, quantity: 2 },
    { name: "Salad", price: 12.00, quantity: 1 },
  ]
};

const MOCK_PEOPLE = [
  {
    id: "person-1",
    name: "Alice",
    items: [
      { itemId: 0, itemName: "Burger", originalPrice: 15.00, quantity: 1, sharePercentage: 100, amount: 15.00 },
      { itemId: 1, itemName: "Fries", originalPrice: 5.00, quantity: 1, sharePercentage: 50, amount: 2.50 }
    ],
    totalBeforeTax: 17.50,
    tax: 1.75,
    tip: 3.50,
    finalTotal: 22.75
  },
  {
    id: "person-2",
    name: "Bob",
    items: [
      { itemId: 1, itemName: "Fries", originalPrice: 5.00, quantity: 1, sharePercentage: 50, amount: 2.50 },
      { itemId: 2, itemName: "Soda", originalPrice: 3.00, quantity: 2, sharePercentage: 100, amount: 6.00 }
    ],
    totalBeforeTax: 8.50,
    tax: 0.85,
    tip: 1.70,
    finalTotal: 11.05
  },
  {
    id: "person-3",
    name: "Charlie",
    items: [
      { itemId: 3, itemName: "Salad", originalPrice: 12.00, quantity: 1, sharePercentage: 100, amount: 12.00 }
    ],
    totalBeforeTax: 12.00,
    tax: 1.20,
    tip: 2.40,
    finalTotal: 15.60
  }
];

const MOCK_GROUPS = [
  {
    id: "group-1",
    name: "Friends",
    memberIds: ["person-1", "person-2"],
    emoji: "1f3c8"
  }
];

// Generate URL params for /split route from mock data
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
      case '--output':
        options.outputDir = args[++i] || 'screenshots';
        break;
    }
  }

  return options;
}

async function injectMockData(page) {
  await page.evaluate(({ receipt, people, groups }) => {
    localStorage.setItem('receipt-splitter-receipt', JSON.stringify(receipt));
    localStorage.setItem('receipt-splitter-people', JSON.stringify(people));
    localStorage.setItem('receipt-splitter-groups', JSON.stringify(groups));
  }, { receipt: MOCK_RECEIPT, people: MOCK_PEOPLE, groups: MOCK_GROUPS });
}

async function takeScreenshots(options) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const outputPath = path.resolve(process.cwd(), options.outputDir);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  console.log(`\nScreenshot Harness`);
  console.log(`==================`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Route: ${options.route}`);
  console.log(`Params: ${options.params || '(none)'}`);
  console.log(`Mock Data: ${options.mockData ? 'Yes' : 'No'}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Viewports: ${VIEWPORTS.length}`);
  console.log('');

  const browser = await chromium.launch();

  try {
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
          // For other routes, inject localStorage data
          await page.goto(baseUrl);
          await injectMockData(page);
        }
      } else if (options.params) {
        url += `?${options.params}`;
      }

      console.log(`Taking screenshot: ${viewport.name} (${viewport.width}x${viewport.height})`);

      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Wait a bit for any animations to settle
      await page.waitForTimeout(500);

      // Generate filename
      const routeName = options.route === '/' ? 'home' : options.route.replace(/\//g, '-').slice(1);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${routeName}_${viewport.name}_${timestamp}.png`;
      const filePath = path.join(outputPath, filename);

      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`  Saved: ${filename}`);

      await context.close();
    }

    console.log(`\nDone! Screenshots saved to ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// Main execution
const options = parseArgs();
takeScreenshots(options).catch((error) => {
  console.error('Error taking screenshots:', error);
  process.exit(1);
});
