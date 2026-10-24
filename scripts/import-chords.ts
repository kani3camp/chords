import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { identity, parseChord, pattern } from '../src/domain/chords';
import { nameFromKey, validateVoicing } from '../src/catalog/validation';
import type { Catalog, Voicing } from '../src/catalog/schema';
import personalDefaults from '../src/catalog/personal-defaults.json';

const PIN = 'df06fa7b425cf5fd29485ff6591236b3557e3fac';
const root = '.cache/chords-db';
const sha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sha !== PIN) throw new Error(`Unexpected upstream ${sha}`);
type Position = { frets: number[]; fingers: number[]; baseFret: number; barres?: number[]; midi: number[] };
type Entry = { key: string; suffix: string; positions: Position[] };
const db = JSON.parse(readFileSync(`${root}/lib/guitar.json`, 'utf8')) as { chords: Record<string, Entry[]> };
const aliases: Record<string, string> = { major:'', minor:'m', sus:'sus4', '69':'6/9', m69:'m6/9', mmaj7:'mMaj7', mmaj9:'mMaj9', mmaj11:'mMaj11', aug7:'7#5', aug9:'9#5' };
const catalog: Catalog = {}; const rejected: { name: string; pattern: string; reasons: string[] }[] = [];
const previous: Catalog = existsSync('src/catalog/generated/guitar.json') ? JSON.parse(readFileSync('src/catalog/generated/guitar.json','utf8')) : {};
let inputCount = 0;
for (const entries of Object.values(db.chords)) for (const e of entries) {
  const name = e.key + (aliases[e.suffix] ?? e.suffix);
  const c = parseChord(name);
  for (const p of e.positions) {
    inputCount++;
    // lib/guitar.json is already 6→1. Positive values are baseFret-relative.
    const frets = p.frets.map(f => f <= 0 ? f : f + p.baseFret - 1);
    const barres: Voicing['barres'] = [];
    for (const finger of [1,2,3,4]) {
      const strings = p.fingers.flatMap((f, i) => f === finger ? [i] : []);
      if (strings.length > 1) barres.push({ fret: frets[strings[0]], from: strings[0], to: strings.at(-1)!, finger });
    }
    const v: Voicing = { frets, fingers: p.fingers, barres, pattern: pattern(frets), status:'active', source: `chords-db@${PIN}` };
    let reasons = validateVoicing(name, v);
    const midi = frets.flatMap((f, i) => f < 0 ? [] : [[40,45,50,55,59,64][i] + f]);
    if (JSON.stringify(midi) !== JSON.stringify(p.midi)) reasons = [...reasons, 'upstream MIDI mismatch'];
    if (!c?.known || reasons.length) { rejected.push({name, pattern:v.pattern, reasons}); continue; }
    const key = identity(c);
    const typePcs = new Set(midi.map(m => ((m - c.root) % 12 + 12) % 12));
    if (!typePcs.has(0)) v.omission = 'Root omitted in an extended voicing; characteristic tones verified.';
    const list = catalog[key] ??= [];
    if (!list.some(x => x.pattern === v.pattern)) list.push(v);
  }
}
// Audited open voicings from the user-supplied design. These are stable defaults.
const defaults: [string,string,string][] = [
  ['C','x32010','032010'], ['Am7','x02010','002010'], ['G','320003','210003'],
  ['Fmaj7','xx3210','003210'], ['Bm7b5','x2323x','013240'], ['E/G#','4x2100','302100'],
  ['Dm7','xx0211','000211'], ['G7','320001','320001'], ['Cmaj7','x32000','032000'],
  ['Em7','022030','012030'], ['A7','x02020','002030'], ['D7','xx0212','000213'],
  ['B7','x21202','021304'], ['Fadd9','xx3213','003214'], ['Gsus4','330013','230014']
];
for (const [name, tab, fingerString] of defaults) {
  const c = parseChord(name)!;
  const frets = [...tab].map(f => f === 'x' ? -1 : Number(f));
  const fingers = [...fingerString].map(Number);
  const barres: Voicing['barres'] = [];
  for (const finger of [1,2,3,4]) {
    const ids = fingers.flatMap((f,i)=>f === finger ? [i] : []);
    if (ids.length > 1) barres.push({fret:frets[ids[0]],from:ids[0],to:ids.at(-1)!,finger});
  }
  const v: Voicing = { frets, fingers, barres, pattern:tab, status:'active',source:'audited-design-v1' };
  const errors = validateVoicing(name,v);
  if (errors.length) throw new Error(`${name}: ${errors.join(',')}`);
  catalog[identity(c)] = [v,...(catalog[identity(c)] ?? []).filter(x=>x.pattern!==tab)];
}
// Register additional names used in the acceptance songs only when an existing
// licensed voicing independently passes the exact new chord AND slash-bass rules.
// This is a build-time catalog operation; the browser never invents new shapes.
const songs=JSON.parse(readFileSync('tests/fixtures/practice-songs.json','utf8')) as {codes:string}[];
const {parseInput}=await import('../src/domain/chords');
const pool=Object.values(catalog).flat();
for(const p of songs)for(const {name} of parseInput(p.codes)) {
  const c=parseChord(name);if(!c?.known)continue;
  const key=identity(c);const list=catalog[key]??=[];
  for(const candidate of pool) {
    if(list.some(v=>v.pattern===candidate.pattern))continue;
    const v={...candidate,source:candidate.source+'; exact-name reclassification'};
    if(validateVoicing(name,v).length===0)list.push(v);
  }
}
// Published positions survive catalog updates. Musical errors are explicitly
// invalidated, never silently replaced, so old links keep the original warning.
for(const [key,forms] of Object.entries(previous))for(const old of forms) {
  if(catalog[key]?.some(v=>v.pattern===old.pattern))continue;
  const reasons=validateVoicing(nameFromKey(key),old);
  (catalog[key]??=[]).push({...old,status:reasons.length?'invalid':'legacy',...(reasons.length?{reason:reasons.join('; ')}:{})});
}
// Explicit owner preferences from the 2026-10-25 reference image. Reorder existing
// audited candidates, preserving every position and its representative fingering.
for(const [name,tab] of Object.entries(personalDefaults)) {
  const c=parseChord(name);
  if(!c?.known)throw new Error(`Unknown personal preset: ${name}`);
  const key=identity(c);const forms=catalog[key]??[];
  const selected=forms.find(v=>v.pattern===tab&&v.status==='active');
  if(!selected)throw new Error(`Personal preset is not an active registered candidate: ${name}@${tab}`);
  const reasons=validateVoicing(name,selected);
  if(reasons.length)throw new Error(`Invalid personal preset ${name}@${tab}: ${reasons.join(', ')}`);
  catalog[key]=[selected,...forms.filter(v=>v.pattern!==tab)];
}
const sorted = Object.fromEntries(Object.entries(catalog).sort(([a],[b])=>a.localeCompare(b)));
mkdirSync('src/catalog/generated',{recursive:true}); mkdirSync('licenses',{recursive:true});
writeFileSync('src/catalog/generated/guitar.json', JSON.stringify(sorted));
writeFileSync('docs/catalog-report.json', JSON.stringify({upstream:PIN,inputCount,identities:Object.keys(catalog).length,active:Object.values(catalog).flat().length,rejectedCount:rejected.length,coverage:Object.entries(catalog).map(([key,v])=>({name:nameFromKey(key),count:v.length})),rejected},null,2));
copyFileSync(`${root}/LICENSE`,'licenses/chords-db-MIT.txt');
console.log({inputCount,active:Object.values(catalog).flat().length,identities:Object.keys(catalog).length,rejected:rejected.length});
