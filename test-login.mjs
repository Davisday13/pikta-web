export default async function run(page, ui) {
  const allLogs = [];
  page.on('console', msg => { allLogs.push({type: msg.type(), text: msg.text()}); });
  page.on('pageerror', err => { allLogs.push({type: 'PAGE_ERROR', text: err.message, stack: err.stack}); });
  page.on('requestfailed', req => { allLogs.push({type: 'REQUEST_FAILED', text: req.url() + ' ' + req.failure()?.errorText}); });

  // Try navigating directly to /pos (with login in URL if possible)
  // First login
  await page.locator('input[placeholder*="usuario"], input[type="text"]').first().fill('admin');
  await page.locator('input[placeholder*="contraseña"], input[type="password"]').first().fill('admin');
  await page.locator('button:has-text("Ingresar")').click();
  await page.waitForTimeout(3000);

  // Go to dashboard first - should work
  const dashRoot = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length);
  
  // Now navigate to /pos via sidebar
  const posLink = page.locator('a[href="/pos"]');
  if (await posLink.count() > 0) {
    await posLink.click();
    await page.waitForTimeout(5000);
  }
  
  const posRoot = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length);
  const posHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 3000));

  return { dashRoot, posRoot, posHtml: posHtml || 'EMPTY', allLogs: allLogs.filter(l => l.type === 'error' || l.type === 'PAGE_ERROR' || l.type === 'REQUEST_FAILED') };
}
