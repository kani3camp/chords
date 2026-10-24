import { describe,expect,it } from 'vitest';
import { catalog,defaultForm,matchVoicing } from '../src/catalog';
import { validateVoicing } from '../src/catalog/validation';
import type { Catalog,Voicing } from '../src/catalog/schema';
import { identity,parseChord,parsePattern } from '../src/domain/chords';
import { cards,emptySong,fromInput } from '../src/state/song';
import practice from './fixtures/practice-songs.json';
import { parseUrl,serialize } from '../src/state/url';
describe('independent music checks',()=>{
  // Fixed pitch sets, no production music helper is used to calculate expectations.
  it.each([
    ['C','x32010',[0,4,7],null],['C','8:10:10:9:8:8',[0,4,7],null],
    ['Dsus2','xx0230',[2,4,9],null],['G','320003',[2,7,11],null],
    ['E/G#','4x2100',[4,8,11],8],['Bm7b5','x2323x',[2,5,9,11],null],
  ] as [string,string,number[],number|null][])('%s@%s matches independent MIDI facts',(name,tab,expected,bass)=>{
    const fret=parsePattern(tab);const midi=fret.flatMap((f,i)=>f<0?[]:[[40,45,50,55,59,64][i]+f]);
    expect([...new Set(midi.map(n=>n%12))].sort((a,b)=>a-b)).toEqual(expected);
    if(bass!==null)expect(Math.min(...midi)%12).toBe(bass);
    expect(matchVoicing(identity(parseChord(name)!),tab)).toBeDefined();
  });
  it('detects an erroneous C form that is actually G minor',()=>{
    const v:Voicing={frets:[-1,10,12,12,11,10],fingers:[0,1,3,4,2,1],barres:[{fret:10,from:1,to:5,finger:1}],pattern:'x:10:12:12:11:10',status:'active',source:'test'};
    expect(validateVoicing('C',v)).toContain('non-chord tone');
  });
  it('handles legacy and invalid status without inventing released history',()=>{
    const current=catalog['0||'][0];
    const fixture:Catalog={'0||':[{...current,status:'legacy'}]};expect(matchVoicing('0||',current.pattern,fixture)?.status).toBe('legacy');
    const invalid:Catalog={'0||':[{...current,status:'invalid',reason:'Regression fixture'}]};expect(matchVoicing('0||',current.pattern,invalid)?.status).toBe('invalid');
  });
});

describe('owner default presets from the 2026-10-25 screenshot',()=>{
  it.each([
    ['Gm','355333','310033',[1,3,4,1,1,1]],
    ['Cm','335543','x31013',[1,1,3,4,2,1]],
    ['C7sus4','335363','x33311',[1,1,3,1,4,1]],
  ] as [string,string,string,number[]][])('%s uses the requested shape and retains old URLs',(name,selected,old,fingers)=>{
    const key=identity(parseChord(name)!);
    const fresh=fromInput(name,emptySong(),{}).song;
    expect(defaultForm(key)).toBe(selected);
    expect(cards(fresh)[0].voicing).toMatchObject({pattern:selected,fingers,barres:[{fret:3,from:0,to:5,finger:1}]});
    const original=parseUrl(`https://chords.kani3camp.com/?v=1&codes=${name}&mode=shape&forms=${name}@${old}`,{})!.song;
    expect(cards(original)[0].voicing?.pattern).toBe(old);
    expect(parseUrl(serialize(original,'https://chords.kani3camp.com/'),{})!.song).toEqual(original);
  });
});
describe('AC-65 full-song distinct chord fixtures',()=>{
  it.each(practice)('$title retains all source labels, warns and restores',p=>{
    const s=fromInput(p.codes,{...emptySong(),title:p.title,capo:p.capo,sourceShift:p.sourceShift},{}).song;
    const rows=cards(s);expect(rows.map(c=>c.raw)).toEqual(s.codes);
    expect(rows.filter(c=>c.key&&!c.voicing).length).toBeLessThanOrEqual(p.maxUnsupported);
    for(const c of rows)if(c.key&&!c.voicing)expect(c.warning).toBeTruthy();
    expect(parseUrl(serialize(s,'https://chords.kani3camp.com/'),{})!.song).toEqual(s);
  });
});
