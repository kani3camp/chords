import { identity, parseChord, parsePattern } from '../../src/domain/chords';
import { nameFromKey, validateVoicing } from '../../src/catalog/validation';
import type { Catalog, Voicing } from '../../src/catalog/schema';

export type Source = { publisher: string; independenceGroup: string; url: string; accessedAt: string; kind: 'teaching' | 'reference' };
export type ReviewedForm = {
  id: string; name: string; pattern: string; fingers: number[]; barres: Voicing['barres'];
  evidence: { source: string; locator: string; pattern: string }[];
  preferred: boolean; reason: string;
};
export type SlashAudit = {
  version: number; reviewedAt: string; sources: Record<string, Source>; forms: ReviewedForm[];
  checks: Record<string, { url: string; result: string }[]>;
  baseline: Record<string, { default: string | null; patterns: string[] }>;
  sourceIssues?: { name: string; pattern: string; url: string; locator: string; reasons: string[] }[];
};

export function reviewedVoicing(form: ReviewedForm): Voicing {
  return { frets: parsePattern(form.pattern), fingers: form.fingers, barres: form.barres,
    pattern: form.pattern, status: 'active', source: `slash-audit-v1:${form.id}` };
}

/** Evidence is per exact six-string shape, never inferred from transposition. */
export function validateSlashAudit(audit: SlashAudit): string[] {
  const errors: string[] = [], ids = new Set<string>(), shapes = new Set<string>(), preferred = new Set<string>();
  if (audit.version !== 1) errors.push('unsupported slash audit version');
  for (const form of audit.forms) {
    const c = parseChord(form.name), key = c && identity(c);
    if (!c?.known || c.bass === null) errors.push(`${form.id}: known slash chord required`);
    if (!form.id || ids.has(form.id)) errors.push(`${form.id}: duplicate/empty audit id`);
    ids.add(form.id);
    const shape = `${key}@${form.pattern}`;
    if (shapes.has(shape)) errors.push(`${form.id}: duplicate reviewed shape`);
    shapes.add(shape);
    if (form.preferred && preferred.has(key!)) errors.push(`${form.id}: multiple preferred forms`);
    if (form.preferred) preferred.add(key!);
    if (!form.reason.trim()) errors.push(`${form.id}: selection reason required`);
    const groups = new Set<string>(); let teaching = false;
    for (const evidence of form.evidence) {
      const source = audit.sources[evidence.source];
      if (!source) { errors.push(`${form.id}: unknown source ${evidence.source}`); continue; }
      if (!source.independenceGroup || !source.publisher || !/^https:\/\//.test(source.url) || !/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt)) errors.push(`${form.id}: incomplete source`);
      if (!evidence.locator.trim() || evidence.pattern !== form.pattern) errors.push(`${form.id}: exact-shape evidence required`);
      groups.add(source.independenceGroup); teaching ||= source.kind === 'teaching';
    }
    if (groups.size < 2) errors.push(`${form.id}: two independent sources required`);
    if (!teaching) errors.push(`${form.id}: teaching reference required`);
    try { for (const error of validateVoicing(form.name, reviewedVoicing(form))) errors.push(`${form.id}: ${error}`); }
    catch { errors.push(`${form.id}: malformed pattern`); }
  }
  return errors;
}

export function applySlashAudit(catalog: Catalog, audit: SlashAudit): void {
  const errors = validateSlashAudit(audit);
  if (errors.length) throw new Error(errors.join('\n'));
  for (const form of audit.forms) {
    const key = identity(parseChord(form.name)!), forms = catalog[key] ??= [];
    const existing = forms.find(v => v.pattern === form.pattern);
    const proposed = reviewedVoicing(form);
    if (existing && JSON.stringify([existing.frets, existing.fingers, existing.barres]) !== JSON.stringify([proposed.frets, proposed.fingers, proposed.barres])) {
      throw new Error(`Published fingering differs: ${form.name}@${form.pattern}`);
    }
    const selected = existing ?? proposed;
    selected.status = 'active';
    // Preserve all published fingerings and provenance; the suffix links to the evidence ledger.
    if (!selected.source.includes(proposed.source)) selected.source += `; ${proposed.source}`;
    if (!existing) forms.push(selected);
    if (form.preferred) catalog[key] = [selected, ...forms.filter(v => v !== selected)];
  }
}

export function slashTargets(keys: string[]): { key: string; matrix: boolean }[] {
  const targets = new Map<string, boolean>();
  for (const key of keys) if (key.split('|')[2] !== '') targets.set(key, false);
  for (let root = 0; root < 12; root++) {
    for (const [quality, intervals] of [['', [4, 7]], ['m', [3, 7]], ['7', [4, 7, 10]], ['maj7', [4, 7, 11]], ['m7', [3, 7, 10]]] as const) {
      for (const interval of intervals) targets.set(`${root}|${quality}|${(root + interval) % 12}`, true);
    }
  }
  return [...targets].sort(([a], [b]) => a.localeCompare(b)).map(([key, matrix]) => ({ key, matrix }));
}

export function slashReport(catalog: Catalog, audit: SlashAudit) {
  const keys = [...Object.keys(audit.baseline), ...audit.forms.map(f => identity(parseChord(f.name)!))];
  const entries = slashTargets(keys).map(({ key, matrix }) => {
    const forms = (catalog[key] ?? []).filter(v => v.status === 'active');
    const reviewed = audit.forms.filter(f => identity(parseChord(f.name)!) === key);
    const oldDefault = audit.baseline[key]?.default ?? null;
    const currentDefault = forms[0]?.pattern ?? null;
    return { key, name: nameFromKey(key), matrix, activeForms: forms.length, oldDefault, default: currentDefault,
      confirmedForms: reviewed.map(f => f.id),
      status: reviewed.length ? 'two-source-confirmed' : forms.length ? 'unconfirmed-existing' : 'unconfirmed-missing',
      reason: reviewed.length ? null : 'No exact six-string shape was individually corroborated by two independent sources in this review. Existing registration is not proof of common usage.',
      sourceChecks: audit.checks[key] ?? [],
    };
  });
  return { reviewedAt: audit.reviewedAt, tuning: 'E2 A2 D3 G3 B3 E4',
    note: 'Unconfirmed existing forms remain available for compatibility; they are not counted as independently confirmed. Reference calculators corroborate exact shapes, not their popularity.',
    sourceIssues: audit.sourceIssues ?? [],
    metrics: { matrixTargets: entries.filter(e => e.matrix).length, totalTargets: entries.length,
      confirmedIdentities: entries.filter(e => e.confirmedForms.length).length, confirmedForms: audit.forms.length,
      confirmedMatrixIdentities: entries.filter(e => e.matrix && e.confirmedForms.length).length,
      addedIdentities: entries.filter(e => e.activeForms > 0 && !Object.hasOwn(audit.baseline, e.key)).length,
      addedForms: entries.reduce((n, e) => n + (catalog[e.key] ?? []).filter(v => !audit.baseline[e.key]?.patterns.includes(v.pattern)).length, 0),
      changedDefaults: entries.filter(e => e.oldDefault !== null && e.oldDefault !== e.default).length,
      unconfirmedExisting: entries.filter(e => e.status === 'unconfirmed-existing').length,
      unconfirmedMissing: entries.filter(e => e.status === 'unconfirmed-missing').length }, entries };
}

type Observations = { dadaGP: number | null; mySongBook: number | null };
type DefaultAuditRow = {
  key: string; name: string; default: string | null; activeForms: number;
  observedSongs: Observations; anyActiveCandidateBothCorpora: boolean;
  [field: string]: unknown;
};
export type DefaultAuditSnapshot = { entries: DefaultAuditRow[]; metrics: Record<string, number>; [field: string]: unknown };

/** Retain historical corpus observations only for the exact shape they measured. */
export function synchronizeDefaultAudit(catalog: Catalog, previous: DefaultAuditSnapshot, audit: SlashAudit): DefaultAuditSnapshot {
  const prior = new Map(previous.entries.map(row => [row.key, row]));
  const entries = Object.entries(catalog).map(([key, forms]): DefaultAuditRow => {
    const row = prior.get(key), selected = forms.find(v => v.status === 'active');
    const changed = row?.default !== (selected?.pattern ?? null);
    const proof = audit.forms.find(f => identity(parseChord(f.name)!) === key && f.pattern === selected?.pattern);
    const name = nameFromKey(key), c = parseChord(name)!;
    const bass = selected && Math.min(...selected.frets.flatMap((f, i) => f < 0 ? [] : [f + [40, 45, 50, 55, 59, 64][i]])) % 12;
    return { ...row, key, name, oldDefault: row?.oldDefault ?? null, default: selected?.pattern ?? null,
      activeForms: forms.filter(v => v.status === 'active').length, bassMatchesSymbol: !!selected && bass === (c.bass ?? c.root),
      observedSongs: !changed && row ? row.observedSongs : { dadaGP: null, mySongBook: null },
      ...(changed && row ? { previousObservation: { pattern: row.default, observedSongs: row.observedSongs } } : {}),
      ...(proof ? { slashEvidence: proof.id, corroboration: 'two-independent-shape-references' } : {}),
      ...(changed && !proof ? { slashEvidence: null, corroboration: 'not-independently-corroborated' } : {}),
      ...(changed ? { review: row ? 'slash-reference-review' : 'slash-reference-addition' } : {}),
      anyActiveCandidateBothCorpora: row?.anyActiveCandidateBothCorpora ?? false };
  });
  const measured = entries.filter(row => row.default !== null && row.observedSongs.dadaGP !== null && row.observedSongs.mySongBook !== null);
  const slashMetrics = slashReport(catalog, audit).metrics;
  return { ...previous, catalogUpdatedAt: audit.reviewedAt,
    metricScopes: { changedDefaults: 'Initial 2026-10-29 review', newForms: 'Initial 2026-10-29 review', slashFormsAdded: '2026-10-30 slash review', slashDefaultsChanged: '2026-10-30 slash review' },
    observationNote: 'null means the current default was not measured in the historical corpora. Counts are not transferred between shapes. Slash evidence confirms shape agreement and teaching use, not occurrence frequency.',
    metrics: { ...previous.metrics, totalIdentities: entries.length, reviewedDefaults: entries.filter(r => r.default !== null).length,
      noActiveForms: entries.filter(r => r.default === null).length,
      defaultBothCorpora: measured.filter(r => r.observedSongs.dadaGP! > 0 && r.observedSongs.mySongBook! > 0).length,
      defaultOneCorpus: measured.filter(r => Number(r.observedSongs.dadaGP! > 0) + Number(r.observedSongs.mySongBook! > 0) === 1).length,
      defaultNeitherCorpus: measured.filter(r => r.observedSongs.dadaGP === 0 && r.observedSongs.mySongBook === 0).length,
      defaultUnmeasured: entries.filter(r => r.default !== null).length - measured.length,
      defaultBassNotLabel: entries.filter(r => r.default !== null && !r.bassMatchesSymbol).length,
      defaultWithSlashEvidence: entries.filter(r => r.slashEvidence).length,
      slashFormsAdded: slashMetrics.addedForms,
      slashDefaultsChanged: slashMetrics.changedDefaults }, entries };
}
