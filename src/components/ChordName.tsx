import { chordDisplayNames, pretty } from '../domain/chords';

export function ChordName({name}:{name:string}) {
  const {primary,alternate}=chordDisplayNames(name);
  return <>{pretty(primary)}{alternate&&<> <span className="chord-alternate">({pretty(alternate)})</span></>}</>;
}
