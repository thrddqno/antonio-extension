import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const distDir = resolve('dist');
const chromiumPath = spawnSync('which', ['chromium'], { encoding: 'utf8' }).stdout.trim();

if (!chromiumPath) {
  console.warn('Chromium executable not found; UI checks skipped.');
  process.exit(0);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function addGroup(page, name) {
  await page.getByRole('button', { name: '+', exact: true }).click();
  await page.getByRole('menuitem', { name: 'new group' }).click();
  await page.getByLabel('name').fill(name);
  await page.getByRole('button', { name: 'save' }).click();
}

async function addPin(page, label, url, categoryId = 'uncategorized') {
  const section =
    categoryId === 'uncategorized'
      ? page.locator('[aria-labelledby="pins-heading"] > div').first()
      : page.locator(`[data-group-id="${categoryId}"]`);

  const addButton = categoryId === 'uncategorized'
    ? section.getByRole('button', { name: 'add +' })
    : section.getByRole('button', { name: /^Add pin to / });
  await addButton.click();
  await page.getByLabel('label').fill(label);
  await page.getByLabel('url').fill(url);
  assert((await page.getByLabel('group', { exact: true }).inputValue()) === categoryId, `Add pin did not preselect ${categoryId}.`);
  await page.getByRole('button', { name: 'save' }).click();
}

async function dragBetween(page, source, target) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert(sourceBox && targetBox, 'Drag elements must be visible.');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function pinLabels(collection) {
  return collection.locator(':scope > [data-pin-id]').evaluateAll((elements) =>
    elements.map((element) => element.firstElementChild?.textContent?.trim().toLowerCase() ?? ''),
  );
}

async function verifySearchEngine(context, expectedPrefix) {
  const searchPage = await context.newPage();
  await searchPage.goto('chrome://newtab/');
  await searchPage.getByPlaceholder('search the web...').waitFor();
  await searchPage.route(`${expectedPrefix}**`, (route) => route.abort());
  const request = searchPage.waitForRequest((candidate) => candidate.isNavigationRequest() && candidate.url().startsWith(expectedPrefix));
  await searchPage.getByPlaceholder('search the web...').fill('prompt four');
  await searchPage.getByPlaceholder('search the web...').press('Enter');
  await request;
  await searchPage.close();
}

const profileDir = mkdtempSync(join(tmpdir(), 'new-tab-ui-'));

try {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromiumPath,
    headless: true,
    viewport: { width: 1366, height: 768 },
    args: [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
    ],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  const outboundHttpRequests = [];
  const consoleErrors = [];
  page.on('request', (request) => {
    if (request.url().startsWith('http')) {
      outboundHttpRequests.push(request.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto('chrome://newtab/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByPlaceholder('search the web...').waitFor();

  const initiallyFocusedId = await page.evaluate(() => document.activeElement?.id);
  assert(initiallyFocusedId === 'search-input', 'Search input was not focused when the new tab opened.');

  await page.keyboard.press('/');
  const focusedId = await page.evaluate(() => document.activeElement?.id);
  assert(focusedId === 'search-input', 'Slash shortcut did not focus search input.');
  assert((await page.getByPlaceholder('search the web...').inputValue()) === '/', 'Slash was hijacked while already typing in search.');

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+K');
  const commandFocusedId = await page.evaluate(() => document.activeElement?.id);
  assert(commandFocusedId === 'search-input', 'Control+K shortcut did not focus search input.');
  await page.getByPlaceholder('search the web...').fill('');

  assert((await page.getByRole('button', { name: 'add +' }).count()) === 0, 'Add controls are visible while locked.');
  assert((await page.getByRole('button', { name: '+', exact: true }).count()) === 0, 'Dock add control is visible while locked.');
  await page.getByText('no pins yet').waitFor();
  await page.getByText('no groups yet').waitFor();
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await page.getByRole('button', { name: 'Lock layout' }).waitFor();

  await page.getByRole('button', { name: '+', exact: true }).click();
  await page.getByRole('menuitem', { name: 'new pin' }).waitFor();
  await page.keyboard.press('Escape');
  assert((await page.getByRole('menuitem', { name: 'new pin' }).count()) === 0, 'Escape did not close the add menu.');
  assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'menu'), 'Add menu did not restore focus to its trigger.');

  await addPin(page, 'Example', 'example.com');
  await page.getByRole('button', { name: 'example', exact: true }).waitFor();
  assert((await page.getByText('UNCATEGORIZED').count()) === 0, 'Uncategorized heading should not be rendered.');

  await addGroup(page, 'Development');
  await addGroup(page, 'Work');
  await page.getByRole('heading', { name: 'development', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'work', exact: true }).waitFor();

  await addPin(page, 'GitHub', 'github.com', 'development');
  await addPin(page, 'Spring Docs', 'spring.io', 'development');
  await addPin(page, 'Postgres', 'postgresql.org', 'development');
  await addPin(page, 'Mail', 'mail.google.com', 'work');
  await page.getByRole('button', { name: 'github', exact: true }).waitFor();

  const pinText = await page.getByRole('button', { name: 'github', exact: true }).innerText();
  assert(pinText.includes('github'), 'Pin label was not normalized to lowercase.');

  await page.getByRole('button', { name: 'github', exact: true }).hover();
  await page.getByRole('button', { name: 'Actions for github' }).click();
  await page.getByRole('menuitem', { name: 'Edit github' }).waitFor();
  await page.getByRole('menuitem', { name: 'Move github' }).waitFor();
  await page.getByRole('menuitem', { name: 'Delete github' }).waitFor();
  await page.keyboard.press('Escape');
  assert((await page.getByRole('menuitem', { name: 'Edit github' }).count()) === 0, 'Escape did not close the pin menu.');
  assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Actions for github'), 'Pin menu did not restore focus to its trigger.');

  await addPin(page, 'Temporary', 'temporary.example');
  let temporaryPin = page.getByRole('button', { name: 'temporary', exact: true });
  await temporaryPin.hover();
  await page.getByRole('button', { name: 'Actions for temporary' }).click();
  await page.getByRole('menuitem', { name: 'Edit temporary' }).click();
  await page.getByRole('heading', { name: 'Edit Pin' }).waitFor();
  assert(await page.evaluate(() => document.activeElement?.id === 'pin-label'), 'Edit pin dialog did not focus the label.');
  await page.keyboard.press('Control+K');
  assert(await page.evaluate(() => document.activeElement?.id === 'pin-label'), 'Search shortcut escaped an active dialog.');
  await page.getByRole('button', { name: 'save' }).focus();
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'close'), 'Dialog focus was not trapped on Tab.');
  await page.keyboard.press('Escape');
  assert((await page.getByRole('heading', { name: 'Edit Pin' }).count()) === 0, 'Escape did not close the pin dialog.');
  assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Actions for temporary'), 'Pin dialog did not restore focus.');

  await page.getByRole('button', { name: 'Actions for temporary' }).click();
  await page.getByRole('menuitem', { name: 'Edit temporary' }).click();
  await page.getByLabel('label').fill('Temporary Edited');
  await page.getByLabel('url').fill('https://example.net/docs');
  await page.getByLabel('group', { exact: true }).selectOption('work');
  await page.getByRole('button', { name: 'save' }).click();
  temporaryPin = page.locator('[data-pin-category="work"]').getByRole('button', { name: 'temporary edited', exact: true });
  await temporaryPin.waitFor();

  await temporaryPin.hover();
  await page.getByRole('button', { name: 'Actions for temporary edited' }).click();
  await page.getByRole('menuitem', { name: 'Move temporary edited' }).click();
  assert(await page.evaluate(() => document.activeElement?.id === 'pin-category'), 'Move action did not focus the group selector.');
  await page.getByLabel('group', { exact: true }).selectOption('development');
  await page.getByRole('button', { name: 'save' }).click();
  temporaryPin = page.locator('[data-pin-category="development"]').getByRole('button', { name: 'temporary edited', exact: true });
  await temporaryPin.hover();
  await page.getByRole('button', { name: 'Actions for temporary edited' }).click();
  await page.getByRole('menuitem', { name: 'Delete temporary edited' }).click();
  await page.getByRole('heading', { name: 'Delete Pin' }).waitFor();
  await page.getByRole('button', { name: 'cancel' }).click();
  await temporaryPin.waitFor();
  await page.getByRole('button', { name: 'Actions for temporary edited' }).click();
  await page.getByRole('menuitem', { name: 'Delete temporary edited' }).click();
  await page.getByRole('button', { name: 'delete pin' }).click();
  assert((await page.getByRole('button', { name: 'temporary edited', exact: true }).count()) === 0, 'Confirmed pin deletion did not remove the pin.');

  await addGroup(page, 'Archive');
  const archiveGroup = page.locator('[data-group-id="archive"]');
  await archiveGroup.getByText('no pins', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit archive group' }).click();
  await page.getByLabel('name').fill('Reference');
  await page.getByRole('button', { name: 'save' }).click();
  await page.getByRole('heading', { name: 'reference', exact: true }).waitFor();
  await addPin(page, 'Reference Pin', 'reference.example', 'archive');
  await page.getByRole('button', { name: 'Delete reference group' }).click();
  await page.getByLabel('move existing pins to').selectOption('work');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'reference', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete reference group' }).click();
  await page.getByLabel('move existing pins to').selectOption('work');
  await page.getByRole('button', { name: 'delete group' }).click();
  assert((await page.getByRole('heading', { name: 'reference', exact: true }).count()) === 0, 'Group deletion did not remove the group.');
  await page.locator('[data-pin-category="work"]').getByRole('button', { name: 'reference pin', exact: true }).waitFor();

  await addPin(page, 'x'.repeat(100), 'long-label.example', 'work');
  const longPin = page.locator('[data-pin-category="work"] [data-pin-id]').filter({ hasText: 'x'.repeat(40) }).first();
  const longPinGeometry = await longPin.evaluate((element) => ({ width: element.getBoundingClientRect().width, pageWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  assert(longPinGeometry.width <= 240 && longPinGeometry.pageWidth <= longPinGeometry.viewportWidth, 'Long pin label broke the wrapping layout.');
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Edit mode overflows a narrow viewport.');
  await page.screenshot({ path: '/tmp/new-tab-editing-narrow.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });

  assert((await page.getByRole('heading', { name: 'Weather' }).count()) === 0, 'Weather UI is still visible.');

  await page.getByRole('button', { name: 'settings' }).click();
  assert((await page.getByRole('heading', { name: 'Weather' }).count()) === 0, 'Weather settings are still visible.');
  await page.keyboard.press('Control+K');
  assert(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'close'), 'Search shortcut escaped the settings drawer.');
  const engineSelect = page.getByLabel('engine');
  await engineSelect.selectOption('google');
  await page.waitForTimeout(100);
  await verifySearchEngine(context, 'https://www.google.com/search?q=prompt%20four');
  await engineSelect.selectOption('duckduckgo');
  await page.waitForTimeout(100);
  await verifySearchEngine(context, 'https://duckduckgo.com/?q=prompt%20four');
  await engineSelect.selectOption('brave');
  await page.waitForTimeout(100);
  await verifySearchEngine(context, 'https://search.brave.com/search?q=prompt%20four');

  await page.getByLabel('font', { exact: true }).selectOption('custom');
  await page.getByLabel('custom font-family').fill('Definitely Missing Mono');

  const importedToml = `
accent = "#445566"
cursor = "#abcdef"
foreground = "#d0d0d0"
background = "#101820"
selection_foreground = "#101820"
selection_background = "#abcdef"
color0 = "#101820"
color1 = "#cc8866"
color2 = "#889977"
color3 = "#bbaa77"
color4 = "#445566"
color5 = "#778899"
color6 = "#99aabb"
color7 = "#eeeeee"
color8 = "#334455"
color9 = "#aa5533"
color10 = "#668899"
color11 = "#aa6677"
color12 = "#aabbcc"
color13 = "#bb99aa"
color14 = "#88aa99"
color15 = "#d0d0d0"
extra_key = "ignored"
`;
  const themeFile = page.locator('input[type="file"]');
  await themeFile.setInputFiles({ name: 'colors.toml', mimeType: 'application/toml', buffer: Buffer.from(importedToml) });
  await page.getByText('theme imported').waitFor();
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim() === '#101820'), 'Imported background token was not applied.');
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cursor').trim() === '#abcdef'), 'Imported cursor token was not applied.');

  await themeFile.setInputFiles({ name: 'colors.toml', mimeType: 'application/toml', buffer: Buffer.from('accent = "invalid"') });
  await page.getByText(/error: missing required key|error: invalid color/).waitFor();
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim() === '#101820'), 'Invalid theme partially changed the current theme.');

  const lockSetting = page.getByLabel('lock layout by default');
  await lockSetting.check();
  assert((await page.getByRole('button', { name: 'Edit layout' }).count()) === 1, 'Settings lock did not use the global layout lock.');
  await lockSetting.uncheck();
  assert((await page.getByRole('button', { name: 'Lock layout' }).count()) === 1, 'Settings unlock did not use the global layout lock.');

  await page.getByRole('button', { name: 'reset to default' }).click();
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim() === '#121212'), 'Theme reset did not restore the bundled background.');
  await themeFile.setInputFiles({ name: 'colors.toml', mimeType: 'application/toml', buffer: Buffer.from(importedToml) });
  await page.getByText('theme imported').waitFor();
  await page.getByRole('button', { name: 'close' }).click();

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: 'settings' }).click();
  assert((await page.getByLabel('engine').inputValue()) === 'brave', 'Search engine selection did not survive reload.');
  assert((await page.getByLabel('font', { exact: true }).inputValue()) === 'custom', 'Font selection did not survive reload.');
  assert((await page.getByLabel('custom font-family').inputValue()) === 'Definitely Missing Mono', 'Custom font did not survive reload.');
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim() === '#101820'), 'Imported theme did not survive reload.');
  const appearance = await page.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    selectionBackground: getComputedStyle(document.body, '::selection').backgroundColor,
  }));
  assert(appearance.font.includes('Definitely Missing Mono') && appearance.font.includes('ui-monospace'), 'Custom font does not include a safe monospace fallback.');
  assert(appearance.selectionBackground === 'rgb(171, 205, 239)', 'Imported selection color was not applied.');
  await page.screenshot({ path: '/tmp/new-tab-settings.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  const narrowDrawer = await page.locator('[aria-labelledby="settings-title"]').evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewport: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  assert(narrowDrawer.left >= 0 && narrowDrawer.right <= narrowDrawer.viewport && !narrowDrawer.overflow, 'Settings drawer overflows a narrow viewport.');
  await page.screenshot({ path: '/tmp/new-tab-settings-narrow.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.keyboard.press('Escape');
  assert((await page.getByRole('heading', { name: 'Settings' }).count()) === 0, 'Escape did not close the settings drawer.');
  assert(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'settings'), 'Settings drawer did not restore focus to its trigger.');

  assert((await page.getByRole('button', { name: /Drag .* group/ }).count()) === 2, 'Group handles are not visible while editing.');

  const developmentPins = page.locator('[data-pin-category="development"]');
  const workPins = page.locator('[data-pin-category="work"]');
  const githubPin = developmentPins.getByRole('button', { name: 'github', exact: true });
  const postgresPin = developmentPins.getByRole('button', { name: 'postgres', exact: true });
  const mailPin = workPins.getByRole('button', { name: 'mail', exact: true });

  const pageUrlBeforeEditClick = page.url();
  await githubPin.click();
  assert(page.url() === pageUrlBeforeEditClick, 'Clicking a pin while editing caused navigation.');

  await dragBetween(page, githubPin, postgresPin);
  const reorderedDevelopmentPins = await pinLabels(developmentPins);
  assert(reorderedDevelopmentPins[2]?.includes('github'), 'Pins did not reorder within their category.');

  const beforeCrossGroupDrop = await pinLabels(developmentPins);
  await dragBetween(page, developmentPins.getByRole('button', { name: 'github', exact: true }), mailPin);
  assert(JSON.stringify(await pinLabels(developmentPins)) === JSON.stringify(beforeCrossGroupDrop), 'Cross-category drop changed pin order.');

  const workHandle = page.getByRole('button', { name: 'Drag work group' });
  const developmentHandle = page.getByRole('button', { name: 'Drag development group' });
  await dragBetween(page, workHandle, developmentHandle);
  const visibleGroupOrder = await page.locator('[data-group-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-group-id')));
  assert(visibleGroupOrder[0] === 'work', 'Groups did not reorder.');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: 'Lock layout' }).waitFor();
  const persistedGroupOrder = await page.locator('[data-group-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-group-id')));
  assert(persistedGroupOrder[0] === 'work', 'Group order did not survive reload.');
  const persistedDevelopmentPins = await pinLabels(page.locator('[data-pin-category="development"]'));
  assert(persistedDevelopmentPins[2]?.includes('github'), 'Pin order did not survive reload.');

  await page.getByRole('button', { name: 'Lock layout' }).click();
  await page.getByRole('button', { name: 'Edit layout' }).waitFor();
  await page.getByRole('link', { name: /github/i }).waitFor();
  assert((await page.getByRole('button', { name: 'add +' }).count()) === 0, 'Inline add controls are visible while locked.');
  assert((await page.getByRole('button', { name: '+', exact: true }).count()) === 0, 'Dock add control is visible while locked.');
  assert((await page.getByRole('button', { name: 'edit', exact: true }).count()) === 0, 'Edit controls are visible while locked.');
  assert((await page.getByRole('button', { name: 'delete', exact: true }).count()) === 0, 'Delete controls are visible while locked.');
  assert((await page.getByRole('button', { name: /Actions for/ }).count()) === 0, 'Pin action controls are visible while locked.');
  assert((await page.getByRole('button', { name: /Drag .* group/ }).count()) === 0, 'Group handles are visible while locked.');

  const dateText = await page.locator('header div').innerText();
  assert(/^[A-Z]+ · [A-Z]{3} \d{1,2}, \d{4}$/.test(dateText), 'Date does not match the reference format.');

  const pinStyles = await page.getByRole('link', { name: /github/i }).evaluate((element) => {
    const styles = getComputedStyle(element);
    const collection = element.parentElement?.parentElement;
    const collectionStyles = collection ? getComputedStyle(collection) : null;
    return {
      borderRadius: styles.borderRadius,
      collectionDisplay: collectionStyles?.display,
      collectionFlexWrap: collectionStyles?.flexWrap,
    };
  });
  assert(pinStyles.borderRadius === '4px', 'Pins are not using the requested compact rectangular radius.');
  assert(pinStyles.collectionDisplay === 'flex' && pinStyles.collectionFlexWrap === 'wrap', 'Pin collection is not using flex-wrap.');

  const viewports = [
    { width: 360, height: 800 },
    { width: 768, height: 900 },
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    const geometry = await page.evaluate(() => {
      const header = document.querySelector('header')?.getBoundingClientRect();
      const search = document.querySelector('[role="search"]')?.getBoundingClientRect();
      const pins = document.querySelector('[aria-labelledby="pins-heading"]')?.getBoundingClientRect();
      const dock = document.querySelector('[aria-label="New tab controls"]')?.getBoundingClientRect();

      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        headerCenter: header ? header.left + header.width / 2 : null,
        searchCenter: search ? search.left + search.width / 2 : null,
        pinsLeft: pins?.left ?? null,
        dockLeft: dock?.left ?? null,
        dockRight: dock?.right ?? null,
        viewportWidth: window.innerWidth,
      };
    });

    assert(!geometry.hasHorizontalOverflow, `Page overflows horizontally at ${viewport.width}x${viewport.height}.`);
    assert(geometry.headerCenter !== null && Math.abs(geometry.headerCenter - viewport.width / 2) < 2, `Header is not centered at ${viewport.width}x${viewport.height}.`);
    assert(geometry.searchCenter !== null && Math.abs(geometry.searchCenter - viewport.width / 2) < 2, `Search is not centered at ${viewport.width}x${viewport.height}.`);
    assert(geometry.pinsLeft !== null && geometry.pinsLeft < viewport.width / 2, `Pin content is not left-aligned at ${viewport.width}x${viewport.height}.`);
    assert(geometry.dockLeft !== null && geometry.dockLeft >= 0 && geometry.dockRight !== null && geometry.dockRight <= geometry.viewportWidth, `Dock is outside the viewport at ${viewport.width}x${viewport.height}.`);

    await page.screenshot({ path: `/tmp/new-tab-${viewport.width}x${viewport.height}.png`, fullPage: true });
  }

  const navigationPage = await context.newPage();
  await navigationPage.goto('chrome://newtab/');
  await navigationPage.getByRole('link', { name: /github/i }).waitFor();
  await navigationPage.route('https://github.com/**', (route) => route.abort());
  const navigationRequest = navigationPage.waitForRequest((request) => request.isNavigationRequest() && request.url().startsWith('https://github.com/'));
  await navigationPage.getByRole('link', { name: /github/i }).click();
  await navigationRequest;
  await navigationPage.close();

  // Minimal favicon strategy: Chrome's _favicon/ API only. No page scraping,
  // no /favicon.ico, no cross-origin fetch. Validate that live here.
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  await page.evaluate(async (pngBase64) => {
    const pngBytes = Uint8Array.from(atob(pngBase64), (character) => character.charCodeAt(0));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('new-tab', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('favicons', 'readwrite');
    const store = tx.objectStore('favicons');
    store.put({ domain: 'cachedtest.test', blob: new Blob([pngBytes], { type: 'image/png' }), updatedAt: Date.now() });
    store.put({ domain: 'nofavtest.test', blob: new Blob([new Uint8Array([0])]), updatedAt: Date.now() });
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, tinyPng);

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await page.getByRole('button', { name: 'Lock layout' }).waitFor();

  await addPin(page, 'reddit', 'reddit.com');
  await addPin(page, 'youtube', 'youtube.com');
  await addPin(page, 'maps', 'maps.google.com');
  await addPin(page, 'linkedin', 'linkedin.com');
  await addPin(page, 'github', 'github.com', 'development');
  await addPin(page, 'localhost', 'http://localhost:4173/');
  await addPin(page, 'Cached', 'cachedtest.test');
  await addPin(page, 'No Fav', 'nofavtest.test');

  const cachedPin = page.locator('[data-pin-id]').filter({ hasText: 'cached' }).first();
  const noFavPin = page.locator('[data-pin-id]').filter({ hasText: 'no fav' }).first();
  await cachedPin.waitFor();
  await noFavPin.waitFor();

  // Cached favicon renders immediately from IndexedDB, symmetric with the marker cache.
  await cachedPin.locator('img').waitFor();
  const cachedSrc = await cachedPin.locator('img').getAttribute('src');
  assert(cachedSrc && cachedSrc.startsWith('blob:'), 'Cached favicon did not render from a blob URL.');

  // Marker-cached domain renders the letter fallback, no fetch attempted.
  assert((await noFavPin.locator('img').count()) === 0, 'Marker-cached domain did not render the letter fallback.');

  const corsErrors = consoleErrors.filter((entry) => /access-control|cors|blocked by/i.test(entry));
  assert(corsErrors.length === 0, `CORS/blocked console errors present: ${corsErrors.join(' | ')}`);

  const scrapedUrls = outboundHttpRequests.filter((url) => {
    const host = new URL(url).host;
    return /(reddit|youtube|maps\.google|linkedin|github|localhost|cachedtest|nofavtest)\./.test(host) || url.endsWith('/favicon.ico');
  });
  assert(scrapedUrls.length === 0, `Extension made unwanted favicon/scrape requests: ${scrapedUrls.join(' | ')}`);

  // Real-domain pins render either a favicon or the fallback, never nothing.
  const realPins = ['reddit', 'youtube', 'maps', 'linkedin', 'github', 'localhost'];
  for (const label of realPins) {
    const pin = page.locator('[data-pin-id]').filter({ hasText: label }).first();
    const imgs = await pin.locator('img').count();
    const fallbacks = await pin.locator('span[aria-hidden="true"]').count();
    assert(imgs + fallbacks === 1, `Pin ${label} rendered neither a favicon nor a fallback.`);
  }

  // Offline: cached favicon must remain visible, page fully usable.
  await context.setOffline(true);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const cachedPinOffline = page.locator('[data-pin-id]').filter({ hasText: 'cached' }).first();
  await cachedPinOffline.locator('img').waitFor();
  const cachedSrcOffline = await cachedPinOffline.locator('img').getAttribute('src');
  assert(cachedSrcOffline && cachedSrcOffline.startsWith('blob:'), 'Cached favicon did not render while offline.');
  await page.getByPlaceholder('search the web...').waitFor();
  await context.setOffline(false);

  await page.evaluate(async () => {
    await chrome.storage.local.set({ newTabState: { version: 1, groups: 'bad', pins: [{ id: 'x', url: 'javascript:alert(1)' }] } });
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  assert((await page.getByText('UNCATEGORIZED').count()) === 0, 'Malformed state recovery rendered an uncategorized heading.');
  await page.getByRole('heading', { name: 'Pins', exact: true }).waitFor();
  await page.getByText('no pins yet').waitFor();

  await context.close();
} finally {
  rmSync(profileDir, { recursive: true, force: true });
}

console.log('Built extension UI checks passed.');
