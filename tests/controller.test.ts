import { describe,expect,it } from 'vitest';
import { Controller } from '../src/app/controller';
import { STORAGE_KEY } from '../src/state/preferences';
import { cards } from '../src/state/song';
import { candidates } from '../src/catalog';
import { audibleTranspose } from '../src/state/transposition';
import { UI_SETTINGS_STORAGE_KEY } from '../src/state/ui-settings';
function harness(initial='https://chords.kani3camp.com/',stored:Record<string,string>={},settings?:string) {
  let href=initial;let blocked=false;let historyFailure=false;const writes:string[]=[];const history:boolean[]=[];
  const data=new Map<string,string>([[STORAGE_KEY,JSON.stringify({version:1,forms:stored})]]);
  if(settings!==undefined)data.set(UI_SETTINGS_STORAGE_KEY,settings);
  const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{if(blocked)throw Error('denied');data.set(k,v);writes.push(v);}} as Storage;
  const c=new Controller({href:()=>href,history:(url,push)=>{if(historyFailure)throw Error('history denied');href=url;history.push(push);},storage:()=>storage});
  return {c,href:()=>href,writes,history,storageData:data,setUrl:(url:string)=>{href=url;},block:()=>{blocked=true;},historyFailure:()=>{historyFailure=true;}};
}
describe('Q-13/30/37/38/39/44/49/51/55/56 atomic transitions',()=>{
  it('previews URL without storing, unselected external value reverts',()=>{
    const h=harness('https://chords.kani3camp.com/?v=1&codes=C&mode=shape&forms=C@x35553');
    expect(h.c.snapshot().pending?.incoming.song.forms['0||']).toBe('x35553');expect(h.writes).toHaveLength(0);
    expect(h.href()).toContain('forms=C@x35553');
    h.c.finishReview([]);expect(h.c.snapshot().song?.forms['0||']).toBe('x32010');
    expect(new URL(h.href()).searchParams.get('forms')).toBe('C@x32010');
    expect(JSON.parse(h.writes.at(-1)!).forms).toEqual({});
  });
  it('checks differences even when URL explicitly selects standard and a preference exists',()=>{
    const h=harness('https://chords.kani3camp.com/?v=1&codes=C&mode=shape&forms=C@x32010',{'0||':'x35553'});
    expect(h.c.snapshot().pending).toBeTruthy();h.c.finishReview([]);
    expect(h.c.snapshot().song?.forms['0||']).toBe('x35553');
  });
  it('has no review for default with no preference; selecting a form autosaves',()=>{
    const h=harness('https://chords.kani3camp.com/?v=1&codes=C&mode=shape&forms=C@x32010');
    expect(h.c.snapshot().pending).toBeNull();h.c.choose('0||','x35553');
    expect(h.c.snapshot().prefs['0||']).toBe('x35553');expect(h.href()).toContain('x35553');
  });
  it('saves only accepted differences, and rechecks original external URL every time',()=>{
    const original='https://chords.kani3camp.com/?v=1&codes=C,G&mode=shape&forms=C@x35553,G@355433';
    const h=harness(original);h.c.finishReview(['0||']);expect(h.c.snapshot().prefs).toEqual({'0||':'x35553'});
    expect(h.c.snapshot().song?.forms['7||']).toBe('320003');
    h.setUrl(original);h.c.load();expect(h.c.snapshot().pending).toBeTruthy();
  });
  it('preserves prior state and preferences on syntax/URL-length/history failure',()=>{
    const h=harness();h.c.draft({input:'C,G'});h.c.apply();const previous=h.c.snapshot().song;const url=h.href();
    h.c.draft({input:'C,,G'});h.c.apply();expect(h.c.snapshot().song).toBe(previous);expect(h.href()).toBe(url);
    h.c.draft({input:'C',title:'曲'.repeat(2000)});h.c.apply();expect(h.c.snapshot().song).toBe(previous);expect(h.href()).toBe(url);expect(h.writes).toHaveLength(0);
    h.historyFailure();h.c.choose('0||','x35553');expect(h.c.snapshot().song).toBe(previous);expect(h.writes).toHaveLength(0);
  });
  it('keeps URL sharing available when localStorage fails',()=>{
    const h=harness();h.c.draft({input:'C'});h.c.apply();h.block();h.c.choose('0||','x35553');
    expect(h.c.snapshot().notice).toContain('保存できません');expect(new URL(h.href()).searchParams.get('forms')).toBe('C@x35553');
  });
  it('deletion immediately resets only the matching current chord',()=>{
    const h=harness();h.c.draft({input:'C,G'});h.c.apply();h.c.choose('0||','x35553');h.c.choose('7||','355433');
    h.c.deletePreferences(['0||']);expect(h.c.snapshot().song?.forms).toMatchObject({'0||':'x32010','7||':'355433'});
    expect(h.c.snapshot().prefs).toEqual({'7||':'355433'});
  });
  it('keeps surviving selections and uses push for a new song, replace for edits',()=>{
    const h=harness();h.c.draft({input:'C,G'});h.c.apply();h.c.choose('0||','x35553');
    h.c.draft({input:'C,Am7'});h.c.apply();expect(h.c.snapshot().song?.forms['0||']).toBe('x35553');expect(h.history.at(-1)).toBe(false);
    h.c.newSong();h.c.draft({input:'G'});h.c.apply();expect(h.history.at(-1)).toBe(true);
  });
  it('resolves enharmonic conflicts explicitly and synchronizes both cards and canonical URL',()=>{
    const opts=candidates('1||');expect(opts.length).toBeGreaterThanOrEqual(2);
    const h=harness(`https://chords.kani3camp.com/?v=1&codes=Db@${opts[0].pattern},C%23@${opts[1].pattern}&mode=shape`);
    expect(h.c.snapshot().pending?.incoming.conflicts).toHaveLength(1);
    h.c.resolveConflicts({'1||':opts[0].pattern});if(h.c.snapshot().pending)h.c.finishReview(['1||']);
    const rows=cards(h.c.snapshot().song!);expect(rows).toHaveLength(2);expect(rows[0].form).toBe(rows[1].form);
  });
  it('does not commit unknown forms into preferences',()=>{
    const h=harness('https://chords.kani3camp.com/?v=1&codes=C&mode=shape&forms=C@xxxxxx');
    expect(h.c.snapshot().song?.forms['0||']).toBe('xxxxxx');expect(h.writes).toHaveLength(0);
    expect(cards(h.c.snapshot().song!)[0].voicing).toBeUndefined();
  });
});

describe('ADR-063: audible capo changes, settings and atomicity',()=>{
  const source='https://chords.kani3camp.com/?v=1&codes=F&mode=shape&capo=4&sourceShift=4&shift=-4';
  it('changes capo 4 to no capo in one action without shifting the sounding pitch',()=>{
    const h=harness(source);
    const a=h.c.snapshot().song!;
    expect(cards(a)[0].playing).toBe('Db');
    expect(cards(a)[0].sounding).toBe('F');
    expect(audibleTranspose(a)).toBe(4);
    h.c.edit({capo:0});
    const b=h.c.snapshot().song!;
    expect(b.capo).toBe(0);expect(b.shift).toBe(0);
    expect(audibleTranspose(b)).toBe(4);
    expect(cards(b)[0].playing).toBe('F');
    expect(cards(b)[0].sounding).toBe('F');
    expect(new URL(h.href()).searchParams.get('shift')).toBe('0');
    expect(h.history.at(-1)).toBe(false);
  });
  it('keeps the pressed chord when that behavior is explicitly selected',()=>{
    const h=harness(source);const before=h.href();
    h.c.setCapoBehavior('keep-shape');
    expect(h.href()).toBe(before);
    expect(JSON.parse(h.storageData.get(UI_SETTINGS_STORAGE_KEY)!).behavior).toBe('keep-shape');
    h.c.edit({capo:0});
    const b=h.c.snapshot().song!;
    expect(b.shift).toBe(-4);
    expect(cards(b)[0].playing).toBe('Db');
    expect(cards(b)[0].sounding).toBe('Db');
    expect(audibleTranspose(b)).toBe(0);
  });
  it('supports both choices in sound input mode',()=>{
    const url='https://chords.kani3camp.com/?v=1&codes=Db&mode=sound&capo=1';
    const a=harness(url);
    expect(cards(a.c.snapshot().song!)[0].playing).toBe('C');
    a.c.edit({capo:0});
    expect(cards(a.c.snapshot().song!)[0].playing).toBe('Db');
    expect(cards(a.c.snapshot().song!)[0].sounding).toBe('Db');
    const b=harness(url,{},JSON.stringify({version:1,behavior:'keep-shape'}));
    b.c.edit({capo:0});
    expect(b.c.snapshot().song?.shift).toBe(-1);
    expect(cards(b.c.snapshot().song!)[0].playing).toBe('C');
    expect(cards(b.c.snapshot().song!)[0].sounding).toBe('C');
  });
  it('changes audible pitch through the transposition control with either input mode',()=>{
    for(const mode of ['shape','sound'] as const){
      const h=harness(`https://chords.kani3camp.com/?v=1&codes=E%2FG%23&mode=${mode}&capo=4&sourceShift=-2&shift=1`);
      const a=h.c.snapshot().song!;
      h.c.setAudibleTranspose(audibleTranspose(a)+1);
      const b=h.c.snapshot().song!;
      expect(b.capo).toBe(4);expect(b.shift).toBe(2);
      expect(audibleTranspose(b)).toBe(audibleTranspose(a)+1);
    }
  });
  it('persists the preference for later songs, defaults when corrupt, and tolerates storage failure',()=>{
    const a=harness(source);a.c.setCapoBehavior('keep-shape');
    const b=harness(source,{},a.storageData.get(UI_SETTINGS_STORAGE_KEY));
    expect(b.c.snapshot().capoBehavior).toBe('keep-shape');
    b.c.newSong();b.c.draft({input:'C'});b.c.apply();
    expect(b.c.snapshot().capoBehavior).toBe('keep-shape');
    const corrupted=harness(source,{},'{');
    expect(corrupted.c.snapshot().capoBehavior).toBe('keep-sound');
    expect(corrupted.c.snapshot().notice).toContain('読み取れなかった');
    const failed=harness(source);failed.block();failed.c.setCapoBehavior('keep-shape');
    expect(failed.c.snapshot().capoBehavior).toBe('keep-shape');
    expect(failed.c.snapshot().notice).toContain('保存できません');
    expect(failed.storageData.get(UI_SETTINGS_STORAGE_KEY)).toBeUndefined();
  });
  it('rejects range and URL history errors atomically',()=>{
    const a=harness('https://chords.kani3camp.com/?v=1&codes=C&mode=shape&capo=0&shift=-24');
    const old=a.c.snapshot().song, url=a.href();
    a.c.edit({capo:1});
    expect(a.c.snapshot().song).toBe(old);expect(a.href()).toBe(url);
    expect(a.c.snapshot().error).toContain('−24');
    const b=harness(source),before=b.c.snapshot().song,beforeUrl=b.href();
    b.historyFailure();b.c.edit({capo:0});
    expect(b.c.snapshot().song).toBe(before);expect(b.href()).toBe(beforeUrl);
  });
  it('restores a legacy explicit-form URL without changing its playing or sounding pitches',()=>{
    const url='https://chords.kani3camp.com/?v=1&codes=C&mode=shape&capo=4&shift=-4&forms=Ab@466544';
    const h=harness(url,{},JSON.stringify({version:1,behavior:'keep-shape'}));
    const s=h.c.snapshot().pending?.incoming.song??h.c.snapshot().song!;
    expect(s.capo).toBe(4);expect(s.shift).toBe(-4);
    expect(cards(s)[0].playing).toBe('Ab');expect(cards(s)[0].sounding).toBe('C');
  });
});
