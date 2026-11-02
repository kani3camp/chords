import { test, expect } from '@playwright/test';

test('draft source opens directly in a new tab and only allows HTTP(S) URLs without credentials',async({page,context})=>{
  await page.goto('/');
  const initialUrl=page.url();
  const source=page.getByLabel('出典URL（任意）',{exact:true});
  const link=page.getByRole('link',{name:'入力した出典を開く',exact:true});
  await expect(link).toHaveCount(0);
  for(const value of ['not-a-url','javascript:alert(1)','data:text/html,test','https://user:pass@example.com/','ftp://example.com/']) {
    await source.fill(value);await expect(link).toHaveCount(0);
  }
  await source.fill('http://example.com/score');
  await expect(link).toHaveAttribute('href','http://example.com/score');
  const url='https://example.com/score?transpose=2#verse';
  await source.fill(url);
  await expect(link).toHaveAttribute('href',url);
  await expect(link).toHaveAttribute('target','_blank');
  await expect(link).toHaveAttribute('rel','noopener noreferrer');
  await context.route('https://example.com/**',route=>route.fulfill({body:'Source score'}));
  const opened=context.waitForEvent('page');
  await link.click();const tab=await opened;
  await expect(tab).toHaveURL(url);
  expect(await tab.evaluate(()=>window.opener===null)).toBe(true);
  await tab.close();
  expect(page.url()).toBe(initialUrl);
  await page.getByLabel('コード一覧を貼り付け',{exact:true}).fill('C,G');
  await page.getByRole('button',{name:'一覧に反映',exact:true}).click();
  await expect(page.getByRole('link',{name:'元のコード譜を開く'})).toHaveAttribute('href',url);
  await page.reload();await expect(link).toHaveAttribute('href',url);
  await source.fill('');await expect(link).toHaveCount(0);
});

test('collapsing input expands the workspace, preserves edits and is keyboard reversible',async({page},testInfo)=>{
  await page.goto('/');
  await page.getByRole('button',{name:'サンプルで試す',exact:true}).click();
  const cards=page.getByTestId('chord-card');await expect(cards).toHaveCount(16);
  await page.getByLabel('曲名（任意）',{exact:true}).fill('未反映の曲名');
  await page.getByLabel('出典URL（任意）',{exact:true}).fill('https://example.com/draft');
  const originalUrl=page.url();
  const forms=await cards.getByRole('img').allTextContents();
  const main=page.getByRole('main');const before=(await main.boundingBox())!;
  const columns=()=>cards.first().evaluate(el=>getComputedStyle(el.parentElement!).gridTemplateColumns.split(' ').length);
  const beforeColumns=await columns();
  const toggle=page.locator('button[aria-controls="input-sidebar"]');
  await expect(toggle).toHaveAttribute('aria-controls','input-sidebar');
  await toggle.focus();await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#input-sidebar')).toBeHidden();
  await expect(page.getByLabel('コード一覧を貼り付け',{exact:true})).toBeHidden();
  const after=(await main.boundingBox())!;
  if(page.viewportSize()!.width>=1024) {
    expect(after.width).toBeGreaterThan(before.width);
    expect(await columns()).toBeGreaterThan(beforeColumns);
  } else expect(after.y).toBeLessThan(before.y);
  expect(page.url()).toBe(originalUrl);
  expect(await cards.getByRole('img').allTextContents()).toEqual(forms);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${testInfo.project.name}-sidebar-collapsed.png`,fullPage:true});
  const reopen=page.getByRole('button',{name:'入力・設定を開く',exact:true});
  await expect(reopen).toBeFocused();await page.keyboard.press('Space');
  await expect(page.getByLabel('曲名（任意）',{exact:true})).toHaveValue('未反映の曲名');
  await expect(page.getByLabel('出典URL（任意）',{exact:true})).toHaveValue('https://example.com/draft');
  await expect(page.getByRole('button',{name:'入力・設定を折りたたむ',exact:true})).toHaveAttribute('aria-expanded','true');
  expect(page.url()).toBe(originalUrl);
});
