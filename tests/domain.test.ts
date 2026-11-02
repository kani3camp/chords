import { describe,expect,it } from 'vitest';
import { chordLabel,identity,parseChord,parseInput,parsePattern,pattern,splitTokens,transpose } from '../src/domain/chords';
import { cards,emptySong,fromInput,resolve } from '../src/state/song';
import { audibleTranspose, shiftForAudibleTranspose, shiftForCapoChange, type CapoBehavior } from '../src/state/transposition';
describe('enharmonic display names preserve chord meaning',()=>{
  it.each([
    ['Ab','A♭ (G♯)'], ['G#','G♯ (A♭)'], ['C#m','C♯m (D♭m)'],
    ['EbM7','E♭M7 (D♯M7)'], ['F#7','F♯7 (G♭7)'], ['Bb','B♭ (A♯)'],
    ['A♭m','A♭m (G♯m)'], ['E/G#','E/G♯ (E/A♭)'],
    ['Dbmaj7/Ab','D♭maj7/A♭ (C♯maj7/G♯)'],
    ['C7(b9,#11)','C7(♭9,♯11)'], ['Ab7(b9,#11)','A♭7(♭9,♯11) (G♯7(♭9,♯11))'],
    ['C6/9','C6/9'], ['F#m6/9','F♯m6/9 (G♭m6/9)'],
    ['C','C'], ['N.C.','N.C.'], ['Cb','C♭ (B)'], ['B#','B♯ (C)'],
  ])('%s → %s',(raw,label)=>{expect(chordLabel(raw)).toBe(label);});
});
describe('R-01, Q-33, Q-53 input grammar',()=>{
  it('retains complex names, top-level commas, slash extensions, and all first occurrences',()=>{
    expect(splitTokens('C7(b9,#11),E/G#,C6/9')).toEqual(['C7(b9,#11)','E/G#','C6/9']);
    expect(fromInput('C,Am7,C,Db,C#,C7(b9,#11),N.C.',emptySong(),{}).song.codes).toEqual(['C','Am7','Db','C#','C7(b9,#11)','N.C.']);
    expect(parseChord('C6/9')?.bass).toBe(null);
    expect(parseChord('C6/9')?.known).toBe(true);
  });
  it.each(['','C,,G','C,','C7(b9,#11','C),G','C@@x32010','C@x:10:12','C@x3201z','C\nG','<script>alert(1)</script>','C，G','C@-12222','C@1:2:3:4:5:6:7'])('rejects the whole malformed input %s',input=>expect(()=>parseInput(input)).toThrow());
  it('supports exact unregistered shapes without drawing them',()=>{
    const s=fromInput('C@x:10:12:12:11:10,G',emptySong(),{}).song;
    expect(cards(s)[0].voicing).toBeUndefined();expect(cards(s)[0].form).toBe('x:10:12:12:11:10');
    expect(cards(s)[1].voicing).toBeDefined();
  });
  it('normalizes the six-string pattern including high frets',()=>{
    expect(pattern(parsePattern('8:10:10:9:8:8'))).toBe('8:10:10:9:8:8');
    expect(pattern(parsePattern('X:3:2:0:1:0'))).toBe('x32010');
  });
});
describe('G01–G06 transposition and capo (independent fixed expectations)',()=>{
  it.each([
    ['Db','sound',0,1,'C','Db'], ['C','shape',0,1,'C','Db'],
    ['Db','shape',-1,1,'C','Db'], ['Db','sound',-1,1,'B','C'],
    ['E/G#','shape',1,1,'F/A','F#/Bb'], ['C','shape',0,0,'C','C'],
  ] as const)('%s %s shift %s capo %s', (input,mode,shift,capo,pressed,sound)=>{
    const s=resolve({...emptySong(),codes:[input],mode,shift,capo,sourceShift:-1},{});
    const c=cards(s)[0];expect(c.playing).toBe(pressed);expect(c.sounding).toBe(sound);
  });
  it('shifts bass as well as root and preserves original names at zero',()=>{
    expect(transpose('E/G#',-1)).toBe('Eb/G');expect(transpose('C#M7',0)).toBe('C#M7');
  });
  it('shares enharmonic preferences only for the exact quality and bass',()=>{
    const key=(s:string)=>identity(parseChord(s)!);
    expect(key('DbM7')).toBe(key('C#maj7'));expect(key('Db')).not.toBe(key('Db/F'));
    expect(key('Db')).not.toBe(key('Dbm'));expect(key('C#')).toBe(key('D♭'));
    const s=fromInput('Db,C#',emptySong(),{}).song;expect(cards(s)).toHaveLength(2);expect(Object.keys(s.forms)).toHaveLength(1);
  });
});

describe('ADR-063: audible transposition and capo behavior',()=>{
  it('keeps the original sounding pitch when changing capo 4 to no capo',()=>{
    const a={...emptySong(),codes:['F','E/G#'],mode:'shape' as const,sourceShift:4,shift:-4,capo:4};
    const b={...a,capo:0,shift:shiftForCapoChange(a,0,'keep-sound')};
    expect(cards(a).map(c=>c.playing)).toEqual(['Db','C/E']);
    expect(cards(a).map(c=>c.sounding)).toEqual(cards(b).map(c=>c.sounding));
    expect(cards(b).map(c=>c.playing)).toEqual(['F','E/G#']);
    expect(audibleTranspose(a)).toBe(4);
    expect(audibleTranspose(b)).toBe(4);
  });
  it('derives the extra URL-v1 shift from an audible target in both input modes',()=>{
    for(const mode of ['shape','sound'] as const){
      const a={...emptySong(),mode,shift:2,sourceShift:-3,capo:4};
      const desired=audibleTranspose(a)+1;
      const b={...a,shift:shiftForAudibleTranspose(a,desired)};
      expect(b.shift).toBe(3);
      expect(audibleTranspose(b)).toBe(desired);
    }
  });
  it('preserves sounding pitch or playing shape across supported capo positions, even with a slash chord',()=>{
    for(const mode of ['shape','sound'] as const)
    for(const behavior of ['keep-sound','keep-shape'] as CapoBehavior[])
    for(const oldCapo of [0,1,4,12])for(const nextCapo of [0,1,4,12]){
      const a=resolve({...emptySong(),codes:['E/G#'],mode,capo:oldCapo,sourceShift:3,shift:0},{});
      const b=resolve({...a,capo:nextCapo,shift:shiftForCapoChange(a,nextCapo,behavior),forms:{}},{});
      const before=cards(a)[0], after=cards(b)[0];
      if(behavior==='keep-sound'){
        expect(after.sounding).toBe(before.sounding);
        expect(audibleTranspose(b)).toBe(audibleTranspose(a));
      }else{
        expect(after.playing).toBe(before.playing);
        expect(audibleTranspose(b)-audibleTranspose(a)).toBe(nextCapo-oldCapo);
      }
    }
  });
});
