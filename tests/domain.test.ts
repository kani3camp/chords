import { describe,expect,it } from 'vitest';
import { identity,parseChord,parseInput,parsePattern,pattern,splitTokens,transpose } from '../src/domain/chords';
import { cards,emptySong,fromInput,resolve } from '../src/state/song';
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
