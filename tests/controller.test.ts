import { describe,expect,it } from 'vitest';
import { Controller } from '../src/app/controller';
import { STORAGE_KEY } from '../src/state/preferences';
import { cards } from '../src/state/song';
import { candidates } from '../src/catalog';
function harness(initial='https://chords.kani3camp.com/',stored:Record<string,string>={}) {
  let href=initial;let blocked=false;let historyFailure=false;const writes:string[]=[];const history:boolean[]=[];
  const data=new Map<string,string>([[STORAGE_KEY,JSON.stringify({version:1,forms:stored})]]);
  const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{if(blocked)throw Error('denied');data.set(k,v);writes.push(v);}} as Storage;
  const c=new Controller({href:()=>href,history:(url,push)=>{if(historyFailure)throw Error('history denied');href=url;history.push(push);},storage:()=>storage});
  return {c,href:()=>href,writes,history,setUrl:(url:string)=>{href=url;},block:()=>{blocked=true;},historyFailure:()=>{historyFailure=true;}};
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
