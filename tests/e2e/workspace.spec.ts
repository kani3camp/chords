import { test,expect,type Page } from '@playwright/test';
import practice from '../fixtures/practice-songs.json' with {type:'json'};
async function apply(page:Page,input='C,Am7,G,Fmaj7') {await page.getByLabel('コード一覧を貼り付け',{exact:true}).fill(input);await page.getByRole('button',{name:'一覧に反映',exact:true}).click();await expect(page.getByRole('button',{name:'一覧に反映',exact:true})).toBeEnabled();}
test('input, voicing, preference deletion, copy and reload',async({page,context,browserName})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{level:1})).toContainText('一画面に');
  await apply(page);await expect(page.getByTestId('chord-card')).toHaveCount(4);
  const c=page.getByTestId('chord-card').filter({has:page.getByRole('heading',{name:'C',exact:true})});
  await c.getByRole('button').click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').locator('.voicing-option').filter({hasText:'x35553'}).getByRole('radio').check();
  await page.getByRole('button',{name:'この押さえ方を使う'}).click();
  await expect(c.getByRole('img')).toHaveAccessibleName(/x35553/);
  await expect(page).toHaveURL(/x35553/);
  await page.getByRole('button',{name:'名前順',exact:true}).click();await expect(c.getByRole('img')).toHaveAccessibleName(/x35553/);
  await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(c.getByRole('img')).toHaveAccessibleName(/x35553/);
  if(browserName==='chromium')await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'共有リンクをコピー',exact:true}).click();
  if(browserName==='chromium')expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(page.url());
  else if(await page.getByRole('dialog').isVisible())await page.getByRole('dialog').getByLabel('閉じる',{exact:true}).click();
  await page.getByRole('button',{name:/好みの押さえ方/}).click();
  await page.getByRole('button',{name:'Cの好みを削除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(c.getByRole('img')).toHaveAccessibleName(/x32010/);
  expect(errors).toEqual([]);
});
test('external preview, no implicit saving, fallback and accepted forms in another context',async({page,browser})=>{
  const input='/?v=1&codes=C,G&mode=shape&forms=C@x35553,G@355433';
  await page.goto(input);await expect(page.getByRole('dialog')).toContainText('外部の押さえ方を確認');
  expect(await page.evaluate(()=>localStorage.getItem('guitar-chords:preferences:v1'))).toBeNull();
  const c=page.getByTestId('chord-card').filter({has:page.getByRole('heading',{name:'C',exact:true})});
  await expect(c.getByRole('img')).toHaveAccessibleName(/x35553/);
  await page.getByRole('checkbox').first().check();await page.getByRole('button',{name:'選択した内容で確定'}).click();
  const url=page.url();expect(new URL(url).searchParams.get('forms')).toBe('C@x35553,G@320003');
  const other=await browser.newContext();const second=await other.newPage();await second.goto(url);
  await expect(second.getByRole('dialog')).toBeVisible();await second.getByRole('checkbox').check();
  await second.getByRole('button',{name:'選択した内容で確定'}).click();
  expect(new URL(second.url()).searchParams.get('forms')).toBe('C@x35553,G@320003');await other.close();
});
test('input failure and long URL keep the last valid page and query',async({page})=>{
  await page.goto('/');await apply(page,'C,G');const url=page.url();
  await apply(page,'C,,G');await expect(page.getByRole('alert')).toContainText('2番目');expect(page.url()).toBe(url);
  await page.getByLabel('曲名（任意）',{exact:true}).fill('曲'.repeat(2000));await apply(page,'C,G');
  await expect(page.getByRole('alert')).toContainText('上限');expect(page.url()).toBe(url);await expect(page.getByTestId('chord-card')).toHaveCount(2);
});
test('capo modes, source shift and total display',async({page})=>{
  await page.goto('/?v=1&codes=Db&mode=sound&capo=1&sourceShift=-1');
  const card=page.getByTestId('chord-card');await expect(card.getByRole('heading')).toHaveText('C');
  await expect(page.getByLabel('合計移調')).toHaveText('-1');
  await page.getByRole('button',{name:'半音上げる',exact:true}).click();await expect(card.getByRole('heading')).toHaveText('Db'.replace('b','♭'));
  await expect(page.getByLabel('合計移調')).toHaveText('0');
  await page.getByLabel('カポ',{exact:true}).selectOption('0');await expect(card.getByRole('heading')).toHaveText('D');
  await page.getByRole('button',{name:'元サイトの移調を半音下げる',exact:true}).click();await expect(card.getByRole('heading')).toHaveText('D');
  await expect(page.getByLabel('合計移調')).toHaveText('-1');
});
test('unsupported names and patterns stay visible and never receive fabricated diagrams',async({page})=>{
  await page.goto('/');await apply(page,'C@x:10:12:12:11:10,G,C7(b9,#11),C6/9,N.C.');
  const rows=page.getByTestId('chord-card');await expect(rows).toHaveCount(5);
  await expect(rows.nth(0).getByRole('img')).toHaveCount(0);await expect(rows.nth(0)).toContainText('リンク指定のフォーム');
  await expect(rows.nth(1).getByRole('img')).toHaveCount(1);await expect(rows.nth(2).getByRole('heading')).toContainText('C7');
  await expect(rows.nth(4)).toContainText('N.C.');
});
test('browser history separates songs and keeps same-song edits in place',async({page})=>{
  await page.goto('/');await apply(page,'C,G');await page.getByRole('button',{name:'別の曲を入力する',exact:false}).click();
  await apply(page,'Am,Dm');await page.getByLabel('カポ',{exact:true}).selectOption('2');
  await page.goBack();await expect(page.getByTestId('chord-card').first().getByRole('heading')).toHaveText('C');
  await page.goForward();await expect(page.getByTestId('chord-card').first().getByRole('heading')).toHaveText('Am');await expect(page.getByLabel('カポ',{exact:true})).toHaveValue('2');
});
test('enharmonic cards share changes without collapsing the original spelling',async({page})=>{
  await page.goto('/');await apply(page,'Db,C#');await expect(page.getByTestId('chord-card')).toHaveCount(2);
  await page.getByTestId('chord-card').first().getByRole('button').click();await page.getByRole('radio').nth(3).check();
  await page.getByRole('button',{name:'この押さえ方を使う'}).click();
  const images=page.getByTestId('chord-card').getByRole('img');const a=await images.nth(0).getAttribute('aria-labelledby');expect(a).toBeTruthy();
  const form=new URL(page.url()).searchParams.get('forms');expect(form?.split(',')).toHaveLength(1);
  await expect(page.getByTestId('chord-card').nth(0).getByRole('heading')).toHaveText('D♭');await expect(page.getByTestId('chord-card').nth(1).getByRole('heading')).toHaveText('C♯');
});
test('keyboard dialog closure restores focus; no horizontal overflow; artifact screenshots',async({page},testInfo)=>{
  await page.goto('/');await page.getByRole('button',{name:'サンプルで試す',exact:true}).click();
  await expect(page.getByTestId('chord-card')).toHaveCount(16);
  await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`docs/screenshots/${testInfo.project.name}.png`,fullPage:true});
  const trigger=page.getByRole('button',{name:'Cの押さえ方を変更',exact:true});await trigger.click();
  await page.screenshot({path:`docs/screenshots/${testInfo.project.name}-picker.png`});
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
});
test('catalog loads on demand and input is stable during the first asynchronous load',async({page})=>{
  let requests=0;
  await page.route('**/assets/guitar-*.js',async route=>{requests++;await new Promise(resolve=>setTimeout(resolve,250));await route.continue();});
  await page.goto('/');expect(requests).toBe(0);
  await page.getByLabel('コード一覧を貼り付け',{exact:true}).fill('C,G');
  await page.getByRole('button',{name:'一覧に反映',exact:true}).click();
  await expect(page.getByLabel('コード一覧を貼り付け',{exact:true})).toBeDisabled();
  await expect(page.getByTestId('chord-card')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('codes')).toBe('C,G');expect(requests).toBe(1);
});
for(const fixture of practice)test(`full practice-song input and form selection: ${fixture.title}`,async({page})=>{
  const externalRequests:string[]=[];
  page.on('request',r=>{if(r.url().startsWith('https://ja.chordwiki.org'))externalRequests.push(r.url());});
  await page.goto('/');
  await page.getByLabel('曲名（任意）',{exact:true}).fill(fixture.title);
  await page.getByLabel('出典URL（任意・記録のみ）',{exact:true}).fill(fixture.source);
  await apply(page,fixture.codes);
  await expect(page.getByTestId('chord-card')).toHaveCount(fixture.codes.split(/,(?![^()]*\))/).length);
  await expect(page.getByRole('heading',{level:1})).toHaveText(fixture.title);
  await expect(page.getByRole('link',{name:'元のコード譜を開く'})).toHaveAttribute('rel','noopener noreferrer');
  expect(await page.getByTestId('chord-card').filter({has:page.locator('.missing')}).count()).toBe(fixture.maxUnsupported+1);
  await page.getByTestId('chord-card').first().getByRole('button').click();
  await page.getByRole('dialog').getByRole('radio').nth(1).check();
  await page.getByRole('button',{name:'この押さえ方を使う'}).click();
  await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
