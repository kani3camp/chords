export const MAX_URL_BYTES = 7168;
export const byteLength = (url: string) => new TextEncoder().encode(url).length;
export function validateUrlLength(url: string) { if (byteLength(url)>MAX_URL_BYTES) throw new Error(`リンクが上限${MAX_URL_BYTES.toLocaleString()}バイトを超えます（${byteLength(url).toLocaleString()}バイト）。編集全体を確定しませんでした。曲名や出典URLを短くしてください。`); }
