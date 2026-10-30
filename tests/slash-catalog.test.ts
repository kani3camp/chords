import { describe, expect, it } from 'vitest';
import { catalog, defaultForm, matchVoicing } from '../src/catalog';
import { identity, parseChord, parsePattern } from '../src/domain/chords';
import { validateVoicing } from '../src/catalog/validation';
import { cards, emptySong, fromInput, resolve } from '../src/state/song';
import { parseUrl, serialize } from '../src/state/url';
import { readPreferences, STORAGE_KEY } from '../src/state/preferences';
import data from '../src/catalog/audited-slash-forms.json';
import report from '../docs/slash-chord-audit.json';
import { applySlashAudit, reviewedVoicing, slashReport, slashTargets, synchronizeDefaultAudit, validateSlashAudit, type SlashAudit } from '../scripts/lib/slash-audit';
import fullAudit from '../docs/default-voicing-audit.json';

const audit = data as SlashAudit;
const key = (name: string) => identity(parseChord(name)!);

describe('individually corroborated slash presets', () => {
  it('audits all 156 inversions and all 288 published slash identities without counting gaps as confirmed', () => {
    expect(Object.keys(audit.baseline)).toHaveLength(288);
    const targets = slashTargets(Object.keys(audit.baseline));
    expect(targets.filter(t => t.matrix)).toHaveLength(156);
    expect(report.entries.map(row => row.key)).toEqual(targets.map(t => t.key));
    expect(Object.keys(audit.checks).sort()).toEqual(targets.map(t => t.key).sort());
    expect(slashReport(catalog, audit)).toEqual(report);
    for (const row of report.entries) {
      expect(row.sourceChecks.length, row.name).toBeGreaterThan(0);
      if (row.status === 'two-source-confirmed') expect(row.confirmedForms.length).toBeGreaterThan(0);
      else { expect(row.confirmedForms).toEqual([]); expect(row.reason).toBeTruthy(); }
    }
  });

  it('requires two independent exact-shape references, including a teaching reference, for every reviewed form', () => {
    expect(validateSlashAudit(audit)).toEqual([]);
    for (const form of audit.forms) {
      const registered = matchVoicing(key(form.name), form.pattern)!;
      expect(registered, `${form.name}@${form.pattern}`).toBeDefined();
      expect(registered.status).toBe('active');
      expect(registered.source).toContain(`slash-audit-v1:${form.id}`);
      expect([registered.frets, registered.fingers, registered.barres]).toEqual([parsePattern(form.pattern), form.fingers, form.barres]);
      if (form.preferred) expect(defaultForm(key(form.name))).toBe(form.pattern);
    }
  });

  it('rejects duplicate publisher groups, unmatched fret evidence and missing teaching references', () => {
    const duplicate = structuredClone(audit);
    const [a, b] = duplicate.forms[0].evidence;
    duplicate.sources[b.source].independenceGroup = duplicate.sources[a.source].independenceGroup;
    expect(validateSlashAudit(duplicate)).toContain(`${duplicate.forms[0].id}: two independent sources required`);
    const mismatch = structuredClone(audit);
    mismatch.forms[0].evidence[0].pattern = 'xxxxxx';
    expect(validateSlashAudit(mismatch)).toContain(`${mismatch.forms[0].id}: exact-shape evidence required`);
    const calculators = structuredClone(audit);
    for (const source of Object.values(calculators.sources)) source.kind = 'reference';
    expect(validateSlashAudit(calculators)).toContain(`${calculators.forms[0].id}: teaching reference required`);
  });

  it('applies deterministically and refuses to overwrite published fingering', () => {
    const copy = structuredClone(catalog);
    applySlashAudit(copy, audit);
    const first = structuredClone(copy);
    applySlashAudit(copy, audit);
    expect(copy).toEqual(first);
    const form = structuredClone(audit.forms[0]);
    // A valid alternative for the same physical shape still cannot rewrite an old URL's fingers.
    form.fingers = form.fingers.map(f => f === 2 ? 3 : f === 3 ? 2 : f);
    form.barres = form.barres.map(b => ({ ...b, finger: b.finger === 2 ? 3 : b.finger === 3 ? 2 : b.finger }));
    expect(validateVoicing(form.name, reviewedVoicing(form))).toEqual([]);
    expect(() => applySlashAudit(copy, { ...audit, forms: [form] })).toThrow('Published fingering differs');
  });

  it.each([
    ['D/F#', '200232', [42, 45, 50, 57, 62, 66], [2, 6, 9], 6],
    ['D7/F#', '200212', [42, 45, 50, 57, 60, 66], [0, 2, 6, 9], 6],
    ['C7/E', '032310', [40, 48, 52, 58, 60, 64], [0, 4, 10], 4],
    ['Cmaj7/G', '332000', [43, 48, 52, 55, 59, 64], [0, 4, 7, 11], 7],
    ['Am7/G', '302010', [43, 45, 52, 55, 60, 64], [0, 4, 7, 9], 7],
    ['Bm7/A', 'x00202', [45, 50, 57, 59, 66], [2, 6, 9, 11], 9],
    ['F/G', '3x321x', [43, 53, 57, 60], [0, 5, 7, 9], 7],
    ['G7/D', 'xx0001', [50, 55, 59, 65], [2, 5, 7, 11], 2],
    ['E7/D', 'xx0100', [50, 56, 59, 64], [2, 4, 8, 11], 2],
    ['A7/C#', 'x42223', [49, 52, 57, 61, 67], [1, 4, 7, 9], 1],
  ] as [string, string, number[], number[], number][])('%s@%s matches fixed independent MIDI facts', (name, pattern, midi, pitches, bass) => {
    const v = matchVoicing(key(name), pattern)!;
    const actual = v.frets.flatMap((f, i) => f < 0 ? [] : [[40, 45, 50, 55, 59, 64][i] + f]);
    expect(actual).toEqual(midi);
    expect([...new Set(actual.map(n => n % 12))].sort((a, b) => a - b)).toEqual(pitches);
    expect(Math.min(...actual) % 12).toBe(bass);
    expect(validateVoicing(name, v)).toEqual([]);
  });

  it('rejects incorrect bass, missing seventh and a mislabeled teaching diagram', () => {
    expect(validateVoicing('D7/F#', matchVoicing(key('D7/A'), 'x00212')!)).toContain('incorrect slash bass');
    expect(validateVoicing('D7/F#', matchVoicing(key('D/F#'), '200232')!)).toContain('missing characteristic tone');
    const wrong = { frets: [-1, -1, -1, 3, 7, 3], fingers: [0, 0, 0, 1, 4, 1],
      barres: [{ fret: 3, from: 3, to: 5, finger: 1 }], pattern: 'xxx373', status: 'active' as const, source: 'test' };
    expect(validateVoicing('Gm7/D', wrong)).toEqual(expect.arrayContaining(['non-chord tone', 'missing characteristic tone', 'incorrect slash bass']));
    expect(matchVoicing(key('Gm7/D'), 'xxx373')).toBeUndefined();
  });

  it('preserves old explicit URLs and saved preferences when the default changes', () => {
    for (const row of report.entries.filter(r => r.oldDefault !== null && r.oldDefault !== r.default)) {
      const old = row.oldDefault!;
      const url = `https://chords.kani3camp.com/?v=1&codes=${encodeURIComponent(row.name)}&mode=shape&forms=${encodeURIComponent(row.name + '@' + old)}`;
      const song = parseUrl(url, {})!.song;
      expect(cards(song)[0].voicing?.pattern).toBe(old);
      expect(parseUrl(serialize(song, 'https://chords.kani3camp.com/'), {})!.song).toEqual(song);
      const storage = { getItem: (name: string) => name === STORAGE_KEY ? JSON.stringify({ version: 1, forms: { [row.key]: old } }) : null };
      const prefs = readPreferences(storage);
      expect(prefs.warning).toBeUndefined();
      expect(cards(fromInput(row.name, emptySong(), prefs.forms).song)[0].voicing?.pattern).toBe(old);
    }
  });

  it('shares enharmonic identities, transposes both notes and restores slash forms in URLs', () => {
    expect(key('A/C#')).toBe(key('A/Db'));
    const song = fromInput('A/C#,A/Db,D7/F#', emptySong(), {}).song;
    expect(cards(song).slice(0, 2).map(c => c.voicing?.pattern)).toEqual(['x42220', 'x42220']);
    const shifted = resolve({ ...song, shift: 2, forms: {} }, {});
    expect(cards(shifted).map(c => c.playing)).toEqual(['B/Eb', 'B/Eb', 'E7/Ab']);
    const newSong = fromInput('Cmaj7/G,Am7/G,D7/F#', emptySong(), {}).song;
    expect(cards(newSong).every(c => c.voicing && !c.warning)).toBe(true);
    expect(parseUrl(serialize(newSong, 'https://chords.kani3camp.com/'), {})!.song).toEqual(newSong);
  });

  it('does not invent corpus observations for new defaults and keeps reports reproducible', () => {
    expect(synchronizeDefaultAudit(catalog, fullAudit, audit)).toEqual(fullAudit);
    for (const changed of report.entries.filter(r => r.oldDefault !== null && r.oldDefault !== r.default)) {
      expect(fullAudit.entries.find(r => r.key === changed.key)).toMatchObject({
        observedSongs: { dadaGP: null, mySongBook: null },
        previousObservation: { pattern: changed.oldDefault },
      });
    }
    for (const form of audit.forms.filter(f => !Object.hasOwn(audit.baseline, key(f.name)))) {
      const row = fullAudit.entries.find(r => r.key === key(form.name))!;
      expect(row.observedSongs).toEqual({ dadaGP: null, mySongBook: null });
    }
  });
});
