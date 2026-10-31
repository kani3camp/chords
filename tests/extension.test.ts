import { describe, expect, it } from 'vitest';
import { normalizeChord, songLink, sourceSite, type ExtractedSong } from '../extension/extract';
import { parseUrl } from '../src/state/url';

describe('extension input and URL compatibility', () => {
  it('preserves slash chords, alterations, and commas inside parentheses', () => {
    for (const name of ['C7(b9,#11)', 'F#m/A', 'C6/9', 'G7+5']) expect(normalizeChord(name)).toBe(name);
    expect(normalizeChord(' B♭ / D ')).toBe('Bb/D');
    expect(normalizeChord('(N.C)')).toBe('N.C.');
    expect(normalizeChord('(Am)')).toBe('Am');
    for (const name of ['Intro', 'サビ', 'C,G', 'C@x32010', 'C7(b9', '<script>']) expect(normalizeChord(name)).toBeNull();
  });

  it('runs only on supported song views', () => {
    for (const url of ['https://www.ufret.jp/song.php?data=41', 'https://ufret.jp/song.php?data=41', 'https://chordwiki.org/wiki/曲名', 'https://chordwiki.org/wiki.cgi?c=view&t=曲名']) expect(sourceSite(new URL(url))).not.toBeNull();
    for (const url of ['https://www.ufret.jp/', 'https://www.ufret.jp/song.php', 'https://chordwiki.org/wiki.cgi?c=edit&t=曲名', 'https://chordwiki.org/search.html', 'https://beta.chordwiki.org/song/曲名', 'https://evil.example/song.php?data=41', 'http://chordwiki.org/wiki/曲名']) expect(sourceSite(new URL(url))).toBeNull();
  });

  it('supports Japanese ChordWiki song views and excludes non-song pages', () => {
    expect(sourceSite(new URL('https://ja.chordwiki.org/wiki/ファールプレーにくらり'))).toBe('chordwiki');
    expect(sourceSite(new URL('https://ja.chordwiki.org/wiki.cgi?c=view&t=曲名'))).toBe('chordwiki');
    for (const url of ['https://ja.chordwiki.org/wiki.cgi?c=edit&t=曲名', 'https://ja.chordwiki.org/wiki.cgi?c=log&t=曲名', 'https://ja.chordwiki.org/search.html', 'https://ja.chordwiki.org.evil.example/wiki/曲名']) expect(sourceSite(new URL(url))).toBeNull();
  });

  const song: ExtractedSong = { codes: ['C#', 'C7(b9,#11)', 'Am', 'N.C.'], title: '曲名 & + #', src: 'https://www.ufret.jp/song.php?data=41', capo: 2, sourceShift: 3, skipped: [] };
  it('is accepted by the real app without transposing displayed chords again', () => {
    const url = songLink(song);
    const incoming = parseUrl(url, {});
    expect(incoming?.song.codes).toEqual(song.codes);
    expect(incoming?.song).toMatchObject({ title: song.title, src: song.src, capo: 2, sourceShift: 3, shift: 0, mode: 'shape' });
  });

  it('rejects empty, malformed and oversized links without truncating them', () => {
    expect(() => songLink({ ...song, codes: [] })).toThrow('コード');
    expect(() => songLink({ ...song, codes: ['C,G'] })).toThrow('コード名');
    expect(() => songLink({ ...song, title: '曲'.repeat(2000) })).toThrow('上限');
    expect(() => songLink({ ...song, capo: 13 })).toThrow('カポ');
  });
});
