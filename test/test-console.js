const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--disable-web-security', '--no-sandbox'],
    headless: 'new'
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  const filePath = 'file://' + path.resolve(__dirname, '../game/index.html');
  await page.goto(filePath);
  // wait for a few frames
  await page.waitForTimeout(1000);
  await browser.close();

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  } else {
    console.log('No console errors found.');
  }
})();
