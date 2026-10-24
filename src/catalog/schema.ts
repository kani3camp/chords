export type Barre = { fret: number; from: number; to: number; finger: number };
export type Voicing = { frets: number[]; fingers: number[]; barres: Barre[]; pattern: string; status: 'active' | 'legacy' | 'invalid'; reason?: string; source: string; omission?: string };
export type Catalog = Record<string, Voicing[]>;
