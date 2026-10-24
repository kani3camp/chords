/** Top-level ASCII commas only; no dropping, guessing, or lyric extraction. */
export function splitTokens(input: string): string[] {
  if (!input.trim()) throw new Error('コード一覧が空です。');
  if ([...input].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)) throw new Error('カンマ区切りの1行で入力してください（改行・制御文字は使えません）。');
  const tokens: string[] = []; let depth = 0; let start = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++;
    if (input[i] === ')' && --depth < 0) throw new Error('かっこ「( )」の対応が取れていません。');
    if (input[i] === ',' && depth === 0) { tokens.push(input.slice(start, i).trim()); start = i + 1; }
  }
  if (depth) throw new Error('かっこ「( )」の対応が取れていません。');
  tokens.push(input.slice(start).trim());
  const empty = tokens.findIndex(t => !t);
  if (empty !== -1) throw new Error(`${empty + 1}番目の項目が空です（「,,」など）。`);
  return tokens;
}
export function parsePattern(input: string): number[] {
  const value = input.toLowerCase();
  const parts = value.includes(':') ? value.split(':') : [...value];
  if (parts.length !== 6 || parts.some(p => !/^(x|0|[1-9][0-9]*)$/.test(p))) throw new Error(`押さえ方「${input}」は6弦→1弦の6項目で指定してください。`);
  const frets = parts.map(p => p === 'x' ? -1 : Number(p));
  if (frets.some(f => !Number.isSafeInteger(f))) throw new Error('フレットの値が大きすぎます。');
  return frets;
}
export const pattern = (frets: number[]) => frets.map(f => f < 0 ? 'x' : String(f)).join(frets.some(f => f > 9) ? ':' : '');
export type Token = { name: string; form?: string };
export function parseInput(input: string): Token[] {
  return splitTokens(input).map(t => {
    const at = t.split('@');
    if (at.length > 2 || !at[0].trim()) throw new Error(`「${t}」の @ 指定が不正です。`);
    const name = at[0].trim();
    if (!/^(?:[A-G][A-Za-z0-9#♯＃b♭ｂΔø°+\-(),/]*|N\.C\.|NC)$/.test(name)) throw new Error(`「${name}」をコード名として読み取れません。コード名のみ入力してください。`);
    return { name, ...(at.length === 2 ? { form: pattern(parsePattern(at[1].trim())) } : {}) };
  });
}
