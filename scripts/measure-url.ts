import { writeFileSync } from 'node:fs';
import { emptySong,fromInput } from '../src/state/song';
import { byteLength,MAX_URL_BYTES,parseUrl,serialize } from '../src/state/url';
import practice from '../tests/fixtures/practice-songs.json';
import { loadCatalog } from '../src/catalog';
await loadCatalog();
const sixty=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'].flatMap(n=>['','m','7','maj7','m7'].map(q=>n+q)).join(',');
const rows=[...practice,{title:'60 chord stress fixture',codes:sixty,sourceShift:0,capo:0,source:''}].map(p=>{
  const s=fromInput(p.codes,{...emptySong(),title:p.title,src:p.source,sourceShift:p.sourceShift,capo:p.capo},{}).song;
  const url=serialize(s,'https://chords.kani3camp.com/');
  if(JSON.stringify(parseUrl(url,{})!.song)!==JSON.stringify(s))throw Error('URL roundtrip failed');
  return {title:p.title,codes:s.codes.length,bytes:byteLength(url),limit:MAX_URL_BYTES,url};
});
writeFileSync('docs/url-measurements.json',JSON.stringify(rows,null,2));console.log(rows.map(({title,codes,bytes,limit})=>({title,codes,bytes,limit})));
