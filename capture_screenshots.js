const puppeteer = require('puppeteer');
const { generateShareableUrl } = require('./dist/lib/split-sharing');

async function captureScreenshots() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport sizes
  const desktopViewport = { width: 1200, height: 800 };
  const mobileViewport = { width: 375, height: 667 };
  
  try {
    console.log('📸 Starting Next.js dev server...');
    const { spawn } = require('child_process');
    const server = spawn('npm', ['run', 'dev'], { detached: true });
    
    // Wait for server to start
    console.log('⏳ Waiting for server to start...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('📱 Capturing mobile screenshots...');
    await page.setViewport(mobileViewport);
    
    // 1. Loading state (simulate slow loading)
    await page.goto('http://localhost:3000/split?names=Alice&amounts=25.00&total=25.00&note=Test&phone=5551234567', { 
      waitUntil: 'domcontentloaded' 
    });
    await page.screenshot({ 
      path: 'screenshots/split-page-loading-mobile.png',
      fullPage: true 
    });
    
    // 2. Success state - Full data
    await page.goto('http://localhost:3000/split?names=Alice%20Johnson%2CBob%20Smith%2CCharlie%20Brown&amounts=32.50%2C19.50%2C13.00&total=65.00&note=Delicious%20Pizza%20Palace&phone=5551234567&date=2024-01-15', {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({ 
      path: 'screenshots/split-page-success-mobile.png',
      fullPage: true 
    });
    
    // 3. Error state
    await page.goto('http://localhost:3000/split?names=Alice&amounts=invalid', {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({ 
      path: 'screenshots/split-page-error-mobile.png',
      fullPage: true 
    });
    
    console.log('🖥️ Capturing desktop screenshots...');
    await page.setViewport(desktopViewport);
    
    // 4. Success state - Desktop
    await page.goto('http://localhost:3000/split?names=Alice%20Johnson%2CBob%20Smith%2CCharlie%20Brown&amounts=32.50%2C19.50%2C13.00&total=65.00&note=Delicious%20Pizza%20Palace&phone=5551234567&date=2024-01-15', {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({ 
      path: 'screenshots/split-page-success-desktop.png',
      fullPage: true 
    });
    
    // 5. Minimal data - Desktop
    await page.goto('http://localhost:3000/split?names=Alice%20Johnson&amounts=32.50&total=32.50&note=Quick%20Coffee&phone=5551234567', {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({ 
      path: 'screenshots/split-page-minimal-desktop.png',
      fullPage: true 
    });
    
    console.log('✅ Screenshots captured successfully!');
    
    // Kill server
    process.kill(-server.pid);
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  captureScreenshots().then(() => {
    console.log('🎉 Screenshot capture complete!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Screenshot capture failed:', error);
    process.exit(1);
  });
}