import { test,expect } from '@playwright/test';
import { DISPLAY_SETTINGS_KEY } from '../../src/state/display-settings';

const label='各コードの元・実音を常に表示する';
test('details default off, persist across songs and reloads, and stay out of shared URLs',async({page,browser})=>{
  await page.goto('/?v=1&codes=C,G,N.C.&mode=shape&capo=2');
  const details=page.getByTestId('chord-card').locator('.card-status small');
  await expect(page.getByTestId('chord-card')).toHaveCount(3);
  await expect(details).toHaveCount(0);
  const card=page.getByTestId('chord-card').first();
  await expect(card.locator('.card-status')).toBeHidden();
  const compactHeight=(await card.boundingBox())!.height;
  await page.getByRole('button',{name:'設定',exact:true}).click();
  const toggle=page.getByRole('checkbox',{name:label,exact:true});
  await expect(toggle).not.toBeChecked();
  const url=page.url();
  await toggle.check();
  await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(details).toHaveText(['元: C ／ 実音: D','元: G ／ 実音: A','元: N.C. ／ 実音: N.C.']);
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(compactHeight+24);
  expect(page.url()).toBe(url);
  await page.reload();
  await expect(details).toHaveCount(3);
  await page.goto('/?v=1&codes=Am&mode=shape');
  await expect(details).toHaveText(['元: Am ／ 実音: Am']);
  const other=await browser.newContext();
  try {
    const second=await other.newPage();await second.goto(page.url());
    await expect(second.getByTestId('chord-card')).toHaveCount(1);
    await expect(second.getByTestId('chord-card').locator('.card-status small')).toHaveCount(0);
  } finally {await other.close();}
  await page.getByRole('button',{name:'設定',exact:true}).click();
  await toggle.uncheck();
  await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(details).toHaveCount(0);
  await page.reload();await expect(page.getByTestId('chord-card')).toHaveCount(1);await expect(details).toHaveCount(0);
});

test('invalid saved settings default off and unavailable storage still allows toggling',async({page})=>{
  await page.addInitScript(key=>{
    localStorage.setItem(key,'{"version":1,"showChordDetails":"true"}');
    Storage.prototype.setItem=()=>{throw new Error('storage blocked');};
  },DISPLAY_SETTINGS_KEY);
  await page.goto('/?v=1&codes=C&mode=shape&shift=1');
  const details=page.getByTestId('chord-card').locator('.card-status small');
  await expect(page.getByTestId('chord-card')).toHaveCount(1);
  await expect(details).toHaveCount(0);
  await page.getByRole('button',{name:'設定',exact:true}).click();
  await page.getByRole('checkbox',{name:label,exact:true}).check();
  await expect(details).toHaveCount(1);
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('表示設定をこのブラウザに保存できませんでした');
  await page.reload();await expect(page.getByTestId('chord-card')).toHaveCount(1);await expect(details).toHaveCount(0);
});


test('hidden details retain a saved-voicing badge without reserving empty status rows',async({page})=>{
  await page.goto('/?v=1&codes=C,G&mode=shape');
  const cards=page.getByTestId('chord-card');
  await expect(cards).toHaveCount(2);
  await cards.first().getByRole('button',{name:'Cの押さえ方を変更',exact:true}).click();
  await page.getByRole('dialog').getByRole('radio').nth(1).check();
  await page.getByRole('button',{name:'この押さえ方を使う',exact:true}).click();
  await expect(cards.first().locator('.pref-badge')).toBeVisible();
  await expect(cards.first().locator('.card-status')).toBeVisible();
  await expect(cards.nth(1).locator('.card-status')).toBeHidden();
  await expect(cards.locator('.card-status small')).toHaveCount(0);
});
