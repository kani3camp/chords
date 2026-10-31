import { test, expect } from '@playwright/test';

test('slash defaults, candidate selection, saved preference and shared URL restore', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('コード一覧を貼り付け', { exact: true }).fill('A/C#,D/F#,D7/F#,Cmaj7/G,Am7/G,F/G');
  await page.getByRole('button', { name: '一覧に反映', exact: true }).click();
  const rows = page.getByTestId('chord-card');
  await expect(rows).toHaveCount(6);
  for (const [i, pattern] of ['x42220', '200232', '200212', '332000', '302010', '3x321x'].entries()) {
    await expect(rows.nth(i).getByRole('img')).toHaveAccessibleName(new RegExp(pattern));
  }
  await rows.nth(3).getByRole('button').click();
  await page.getByRole('dialog').locator('.voicing-option').filter({ hasText: '322010' }).getByRole('radio').check();
  await page.getByRole('button', { name: 'この押さえ方を使う', exact: true }).click();
  await expect(rows.nth(3).getByRole('img')).toHaveAccessibleName(/322010/);
  expect(new URL(page.url()).searchParams.get('forms')).toContain('Cmaj7/G@322010');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('guitar-chords:preferences:v1')))!).forms['0|maj7|7']).toBe('322010');
  const shared = page.url();
  await page.reload();
  await expect(rows.nth(3).getByRole('img')).toHaveAccessibleName(/322010/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(page.url()).toBe(shared);
});

test('previous D/F# URL and saved preference retain the published diagram', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('guitar-chords:preferences:v1', JSON.stringify({ version: 1, forms: { '2||6': '254232' } }));
  });
  await page.goto('/?v=1&codes=D%2FF%23&mode=shape&forms=D%2FF%23%40254232');
  await expect(page.getByTestId('chord-card').getByRole('img')).toHaveAccessibleName(/254232/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('chord-card').getByRole('img')).toHaveAccessibleName(/254232/);
});
