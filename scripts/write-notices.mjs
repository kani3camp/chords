import { readFileSync,writeFileSync,existsSync,mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname,resolve } from 'node:path';
import { log } from 'node:console';
const packages=[];
const seen=new Set();
function visit(name,req) {
  let dir=dirname(req.resolve(name));
  while(!existsSync(`${dir}/package.json`))dir=dirname(dir);
  const pkg=JSON.parse(readFileSync(`${dir}/package.json`,'utf8'));
  if(seen.has(pkg.name))return;seen.add(pkg.name);
  const license=['LICENSE','LICENSE.md','LICENSE.txt'].find(f=>existsSync(`${dir}/${f}`));
  if(!license)throw Error(`Missing license ${name}`);
  packages.push({name:pkg.name,version:pkg.version,text:readFileSync(`${dir}/${license}`,'utf8')});
  const next=createRequire(resolve(dir,'package.json'));
  for(const child of Object.keys(pkg.dependencies??{}))visit(child,next);
}
const manifest=JSON.parse(readFileSync('package.json','utf8').replace(/^\uFEFF/,''));
for(const name of Object.keys(manifest.dependencies))visit(name,createRequire(resolve('package.json')));
packages.sort((a,b)=>a.name.localeCompare(b.name));
const dataLicense=readFileSync('licenses/chords-db-MIT.txt','utf8');
const slashReferences=JSON.parse(readFileSync('src/catalog/audited-slash-forms.json','utf8'));
const publishers=[...new Set(Object.values(slashReferences.sources).map(s=>`${s.publisher}: https://${s.independenceGroup}/`))].sort();
const referenceNote='Independently reviewed slash-chord fret positions (2026-10-30)\nExact source URLs, diagram locations, review dates and fingering decisions: src/catalog/audited-slash-forms.json in the source repository.\n'+publishers.join('\n')+'\nFret positions are recorded as factual review data. Lesson text and diagram artwork remain the property of the respective publishers. JGuitar corroborates shapes; teaching references support practical usage.\n';
const text='Third party notices — Guitar Chords\n\nData: tombatossals/chords-db @ df06fa7b425cf5fd29485ff6591236b3557e3fac\nhttps://github.com/tombatossals/chords-db\n\n'+dataLicense+'\n\n'+referenceNote+'\n'+packages.map(p=>`${p.name} ${p.version}\n${p.text}`).join('\n\n');
mkdirSync('licenses',{recursive:true});writeFileSync('licenses/THIRD_PARTY_NOTICES.txt',text);writeFileSync('public/third-party-notices.txt',text);
log(`Notices generated for ${packages.length} runtime packages and the chord data.`);
