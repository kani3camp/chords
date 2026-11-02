import {
  DEFAULT_CAPO_BEHAVIOR,
  type CapoBehavior,
} from './transposition';

export const UI_SETTINGS_STORAGE_KEY = 'guitar-chords:ui-settings:v1';

export function readCapoBehavior(storage: Pick<Storage, 'getItem'>): { behavior: CapoBehavior; warning?: string } {
  try {
    const raw = storage.getItem(UI_SETTINGS_STORAGE_KEY);
    if (raw === null) return { behavior: DEFAULT_CAPO_BEHAVIOR };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid settings');
    const value = parsed as Record<string, unknown>;
    if (value.version !== 1 || (value.behavior !== 'keep-sound' && value.behavior !== 'keep-shape')) {
      throw new Error('Invalid settings');
    }
    return { behavior: value.behavior };
  } catch {
    return {
      behavior: DEFAULT_CAPO_BEHAVIOR,
      warning: 'カポ変更時の設定を読み取れなかったため、実音を維持する既定動作を使用します。',
    };
  }
}

export function writeCapoBehavior(storage: Pick<Storage, 'setItem'>, behavior: CapoBehavior): string | undefined {
  try {
    storage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, behavior }));
    return undefined;
  } catch {
    return 'カポ変更時の設定をブラウザに保存できませんでした。この画面では選択した設定を使用します。';
  }
}
