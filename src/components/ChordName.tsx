import { enharmonicName, pretty } from '../domain/chords';

export function ChordName({name}:{name:string}) {
  const alternate=enharmonicName(name);
  return <>{pretty(name)}{alternate&&<> <span className="chord-alternate">({pretty(alternate)})</span></>}</>;
}
