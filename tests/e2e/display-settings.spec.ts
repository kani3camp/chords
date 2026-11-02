import { test,expect } from '@playwright/test';
import { DISPLAY_SETTINGS_KEY } from '../../src/state/display-settings';

const label='各コードの元・実音を常に表示する';
test('details default off, persist across songs and reloads, and stay out of shared URLs',async({page,browser})=>{
  await page.goto('/?v=1&codes=C,G,N.C.&mode=shape&capo=2');
  const details=page.getByTestId('chord-card').locator('.card-status small');
  await expect(page.getByTestId('chord-card')).toHaveCount(3);
  await expect(details).toHaveCount(0);
  await page.getByRole('button',{name:'設定',exact:true}).click();
  const toggle=page.getByRole('checkbox',{name:label,exact:true});
  await expect(toggle).not.toBeChecked();
  const url=page.url();
  await toggle.check();
  await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(details).toHaveText(['元: C ／ 実音: D','元: G ／ 実音: A','元: N.C. ／ 実音: N.C.']);
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
