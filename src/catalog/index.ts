import type { Catalog, Voicing } from './schema';
export let catalog: Catalog = {};
let loading: Promise<void> | undefined;
/** The audited data is fetched once, only when a song or saved preferences need it. */
export function loadCatalog(): Promise<void> {
  return loading ??= import('./generated/guitar.json').then(data=>{catalog=data.default as Catalog;}).catch(e=>{loading=undefined;throw e;});
}
export const candidates = (key: string): Voicing[] => (catalog[key] ?? []).filter(v => v.status === 'active');
export function matchVoicing(key: string, tab: string, db: Catalog = catalog): Voicing | undefined {
  return db[key]?.find(v => v.pattern === tab);
}
export const defaultForm = (key: string) => candidates(key)[0]?.pattern;
