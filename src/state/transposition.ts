import type { Song } from './song';

// URL v1's shift is the extra transformation of input codes, NOT the audible transposition.
// This module stays independent of the chord catalog so the OGP Worker remains lightweight.
export type CapoBehavior = 'keep-sound' | 'keep-shape';
export const DEFAULT_CAPO_BEHAVIOR: CapoBehavior = 'keep-sound';

type TranspositionState = Pick<Song, 'mode' | 'capo' | 'sourceShift' | 'shift'>;

/** Semitone change in sounding pitch relative to the original source score. */
export function audibleTranspose(song: TranspositionState): number {
  return song.sourceShift + song.shift + (song.mode === 'shape' ? song.capo : 0);
}

/** The internal URL-v1 shift needed for an audible transposition target. */
export function shiftForAudibleTranspose(song: TranspositionState, target: number): number {
  return target - song.sourceShift - (song.mode === 'shape' ? song.capo : 0);
}

/** The internal URL-v1 shift needed after an explicit capo change. */
export function shiftForCapoChange(
  song: Pick<Song, 'mode' | 'capo' | 'shift'>,
  nextCapo: number,
  behavior: CapoBehavior,
): number {
  if (behavior === 'keep-sound' && song.mode === 'shape') {
    return song.shift + song.capo - nextCapo;
  }
  if (behavior === 'keep-shape' && song.mode === 'sound') {
    return song.shift + nextCapo - song.capo;
  }
  return song.shift;
}
