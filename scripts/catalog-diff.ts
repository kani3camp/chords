import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { catalog,loadCatalog } from '../src/catalog';
import type { Catalog,Voicing } from '../src/catalog/schema';
await loadCatalog();
const file=process.argv[2];
type Baseline = Record<string,{default:string|null;forms:Record<string,string>}>;
const fingerprint=(v:Voicing)=>createHash('sha256').update(JSON.stringify([v.frets,v.fingers,v.barres])).digest('hex');
export const summarize=(db:Catalog):Baseline=>Object.fromEntries(Object.entries(db).map(([key,forms])=>[key,{default:forms.find(v=>v.status==='active')?.pattern??null,forms:Object.fromEntries(forms.map(v=>[v.pattern,fingerprint(v)]))}]));
const prior=JSON.parse(readFileSync(file??'tests/fixtures/catalog-baseline.json','utf8')) as Baseline;
const current=summarize(catalog);const changes:string[]=[];
for(const [key,b] of Object.entries(prior)) {
  if(b.default!==current[key]?.default)changes.push(`DEFAULT changed: ${key} ${b.default} -> ${current[key]?.default}`);
  for(const [tab,hash] of Object.entries(b.forms)) {
    const now=current[key]?.forms[tab];
    if(!now)changes.push(`URL position removed: ${key}@${tab}`);
    else if(now!==hash)changes.push(`URL diagram changed: ${key}@${tab}`);
  }
}
console.log(changes.length?changes.join('\n'):'Catalog compatibility: all baseline defaults and diagrams retained.');
if(changes.length)process.exitCode=1;
