export const DISPLAY_SETTINGS_KEY = 'guitar-chords:display-settings:v1';

export function readShowChordDetails(storage: Pick<Storage,'getItem'>): boolean {
  try {
    const value = JSON.parse(storage.getItem(DISPLAY_SETTINGS_KEY) ?? 'null');
    return value?.version === 1 && value.showChordDetails === true;
  } catch { return false; }
}

export function writeShowChordDetails(storage: Pick<Storage,'setItem'>, showChordDetails: boolean): void {
  storage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify({version:1,showChordDetails}));
}
