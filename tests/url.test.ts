import { describe,expect,it } from 'vitest';
import { MAX_URL_BYTES,byteLength,parseUrl,serialize } from '../src/state/url';
import { emptySong,fromInput,resolve } from '../src/state/song';
const base='https://chords.kani3camp.com/';
describe('Q-23/24/32/47/48 URL v1 compatibility',()=>{
  it('emits canonical order, every form, stable high frets and exact source names',()=>{
    const s=fromInput('C@8:10:10:9:8:8,Db,C#,C7(b9,#11),N.C.',{...emptySong(),title:'曲 & 名前',src:'https://example.com/?a=1&b=2'},{}).song;
    const url=serialize(s,base);const p=new URL(url).searchParams;
    expect([...p.keys()]).toEqual(['v','codes','mode','capo','sourceShift','shift','sort','forms','title','src']);
    expect(p.get('forms')).toContain('C@8:10:10:9:8:8');
    expect(parseUrl(url,{})!.song).toEqual(s);expect(serialize(parseUrl(url,{})!.song,base)).toBe(url);
  });
  it('reads shorthand codes and splits final playing forms after capo',()=>{
    const incoming=parseUrl(base+'?v=1&codes=Db@x32010&mode=sound&capo=1',{})!;
    expect(serialize(incoming.song,base)).toContain('forms=C%40x32010');
    expect(incoming.song.codes).toEqual(['Db']);
  });
  it.each([
    '?v=9&codes=C&mode=shape','?v=1&codes=C','?v=1&codes=C&mode=wrong',
    '?v=1&codes=C&mode=shape&capo=1.2','?v=1&codes=C&mode=shape&capo=13',
    '?v=1&codes=C&mode=shape&shift=25','?v=1&codes=C&mode=shape&capo=1&capo=2',
    '?v=1&codes=C&mode=shape&forms=G@320003','?v=1&codes=C&mode=shape&src=javascript:alert(1)',
    '?v=1&codes=C&mode=shape&title=%ZZ','?v=1&codes=C,,G&mode=shape',
  ])('rejects invalid external URL %s',q=>expect(()=>parseUrl(base+q,{})).toThrow());
  it('retains unregistered form warnings through canonicalization',()=>{
    const url=base+'?v=1&codes=C,G&mode=shape&forms=C@x:10:12:12:11:10';
    const first=parseUrl(url,{})!;const again=parseUrl(serialize(first.song,base),{})!;
    expect(again.song).toEqual(first.song);
  });
  it('reports enharmonic and inline/forms conflicts without choosing a winner',()=>{
    const x=parseUrl(base+'?v=1&codes=C@x32010&mode=shape&forms=C@x35553',{})!;
    expect(x.conflicts).toEqual([{key:'0||',values:['x32010','x35553']}]);
    expect(x.song.forms['0||']).toBeUndefined();
  });
  it('roundtrips 60 codes and all selected forms under the byte limit',()=>{
    const names=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'].flatMap(n=>['','m','7','maj7','m7'].map(q=>n+q));
    const s=resolve({...emptySong(),codes:names,title:'60コードの検証'},{});const u=serialize(s,base);
    expect(byteLength(u)).toBeLessThan(MAX_URL_BYTES);expect(parseUrl(u,{})!.song).toEqual(s);
  });
  it('enforces full UTF-8 URL bytes, including title and hostname',()=>{
    expect(()=>serialize({...emptySong(),codes:['C'],title:'あ'.repeat(2000)},base)).toThrow('上限');
    expect(byteLength('あ')).toBe(3);
  });
});
