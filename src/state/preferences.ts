import { matchVoicing } from '../catalog';
import type { Preferences } from './song';
export const STORAGE_KEY = 'guitar-chords:preferences:v1';
export function readPreferences(storage: Pick<Storage,'getItem'>): { forms: Preferences; warning?: string } {
  try {
    const raw = storage.getItem(STORAGE_KEY); if (!raw) return {forms:{}};
    const value = JSON.parse(raw);
    if (value.version!==1 || !value.forms || typeof value.forms!=='object' || Array.isArray(value.forms)) throw new Error('schema');
    const forms: Preferences={}; let invalid=false;
    for(const [key,tab] of Object.entries(value.forms)) {
      if(typeof tab==='string' && matchVoicing(key,tab) && matchVoicing(key,tab)?.status!=='invalid') forms[key]=tab;
      else invalid=true;
    }
    return {forms,...(invalid?{warning:'保存済みの好みの一部が不正なため、使用しませんでした。リンクからの復元は利用できます。'}:{})};
  } catch { return {forms:{},warning:'このブラウザの好みを読み取れませんでした。リンクからの復元・共有は利用できます。'}; }
}
export function writePreferences(storage: Pick<Storage,'setItem'>, forms: Preferences): string | undefined {
  try { storage.setItem(STORAGE_KEY,JSON.stringify({version:1,forms})); return undefined; }
  catch { return 'このブラウザに好みを保存できませんでした。今回の選択は共有リンクに保存されています。'; }
}
