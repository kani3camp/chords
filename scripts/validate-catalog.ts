import { catalog,loadCatalog } from '../src/catalog';
import { keyForName,nameFromKey,validateVoicing } from '../src/catalog/validation';
import required from '../tests/fixtures/catalog-required.json';
import practice from '../tests/fixtures/practice-songs.json';
import { cards,emptySong,fromInput } from '../src/state/song';
import { writeFileSync } from 'node:fs';
await loadCatalog();
const errors:string[]=[];let total=0;
for(const [key,forms] of Object.entries(catalog)) {
  const seen=new Set<string>();
  for(const v of forms) {
    total++;
    if(v.status!=='invalid') for(const issue of validateVoicing(nameFromKey(key),v)) errors.push(`${key}@${v.pattern}: ${issue}`);
    if(seen.has(v.pattern))errors.push(`duplicate ${key}@${v.pattern}`);seen.add(v.pattern);
    if(!v.source||!['active','legacy','invalid'].includes(v.status))errors.push(`missing provenance/status ${key}`);
  }
}
for(const root of required.roots)for(const [quality,min] of Object.entries(required.qualities)) {
  const key=keyForName(root+quality);const count=(catalog[key]??[]).filter(v=>v.status==='active').length;
  if(count<min)errors.push(`${root+quality}: ${count}<${min}`);
}
for(const [name,patterns] of Object.entries(required.requiredPatterns))for(const tab of patterns)if(!catalog[keyForName(name)]?.some(v=>v.pattern===tab&&v.status==='active'))errors.push(`required ${name}@${tab}`);
const practiceResults=practice.map(p=>{
  const s=fromInput(p.codes,{...emptySong(),title:p.title,mode:'shape',capo:p.capo,sourceShift:p.sourceShift},{}).song;
  const rows=cards(s);const unsupported=rows.filter(c=>c.key&&!c.voicing).map(c=>c.raw);
  if(unsupported.length>p.maxUnsupported)errors.push(`${p.title}: unsupported ${unsupported.length}>${p.maxUnsupported}`);
  return {title:p.title,codes:rows.length,soundingChords:rows.filter(c=>c.key).length,unsupported,unsupportedRate:unsupported.length/rows.filter(c=>c.key).length};
});
writeFileSync('docs/coverage.json',JSON.stringify({forms:total,identities:Object.keys(catalog).length,requiredCodeCount:required.roots.length*Object.keys(required.qualities).length,practice:practiceResults,errors},null,2));
console.log(JSON.stringify({forms:total,identities:Object.keys(catalog).length,practice:practiceResults,errors},null,2));
if(errors.length)process.exitCode=1;
