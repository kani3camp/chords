import { useEffect, useState, useSyncExternalStore } from 'react';
import { Controller } from './controller';
import { cards, differences, type Card } from '../state/song';
import { matchVoicing,loadCatalog } from '../catalog';
import { nameFromKey } from '../catalog/validation';
import { pretty } from '../domain/chords';
import { ChordDiagram } from '../components/ChordDiagram';
import { Dialog } from '../components/Dialog';
import { serialize } from '../state/url';

const SAMPLE='C,Am7,G,Fmaj7,Bm7b5,E/G#,Dm7,G7,Cmaj7,Em7,A7,D7,B7,Fadd9,Gsus4,C7(b9,#11)';
const signed=(n:number)=>n>0?`+${n}`:String(n);
function Icon({name}:{name:'book'|'help'|'link'|'out'}) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name==='book'?<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>:name==='help'?<><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></>:name==='out'?<><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>:<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>}
  </svg>;
}
export default function App({controller}:{controller:Controller}) {
  const st=useSyncExternalStore(controller.subscribe,controller.snapshot);
  const [panel,setPanel]=useState<'prefs'|'help'|null>(null);
  const [picker,setPicker]=useState<Card|null>(null);
  const [selected,setSelected]=useState('');
  const [reviewHidden,setReviewHidden]=useState(false);
  const [accepted,setAccepted]=useState<string[]>([]);
  const [conflictChoices,setConflictChoices]=useState<Record<string,string>>({});
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [copyFallback,setCopyFallback]=useState(false);
  const [loading,setLoading]=useState(false);
  const s=st.pending?.incoming.song??st.song;
  const rows=s?cards(s,st.pending?.incoming.conflicts):[];
  const locked=!!st.pending;
  const diff=st.pending?differences(st.pending.incoming,st.prefs):[];
  const resetReview=()=>{setReviewHidden(false);setAccepted([]);setConflictChoices({});};
  useEffect(()=>{const onPop=()=>{controller.load();setReviewHidden(false);setAccepted([]);setConflictChoices({});setPanel(null);setPicker(null);};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[controller]);
  const apply=async()=>{
    if(loading)return;
    resetReview();setLoading(true);
    try{await loadCatalog();controller.apply();}
    catch{controller.setError('コード図データを読み込めませんでした。接続を確認して、もう一度「一覧に反映」を押してください。');}
    finally{setLoading(false);}
  };
  const closeReview=()=>{if(!controller.cancelReview())setReviewHidden(true);};
  const url=()=>st.song?serialize(st.song,location.href):'';
  const copy=async()=>{try{await navigator.clipboard.writeText(url());controller.notify('共有リンクをコピーしました。ブックマークや別の端末で開いて復元できます。');}catch{setCopyFallback(true);}};
  const dirty=st.draft.input!==(st.song?.codes.join(',')??'')||st.draft.title!==(st.song?.title??'')||st.draft.src!==(st.song?.src??'');
  return <>
    <a href="#workspace" className="skip-link">コード一覧へ移動</a>
    <header className="app-header">
      <div className="brand"><img src="/favicon.svg" alt="" width="23" height="28"/><strong>ギターコード一覧</strong><span className="brand-sub">練習ワークスペース</span></div>
      <nav aria-label="アプリ"><button onClick={()=>setPanel('prefs')} disabled={locked||loading}><Icon name="book"/>好みの押さえ方 <span className="count">{Object.keys(st.prefs).length}</span></button><button onClick={()=>setPanel('help')}><Icon name="help"/>ヘルプ</button></nav>
    </header>
    <div className="workspace">
      <aside className="sidebar" aria-label="入力と設定">
        <form onSubmit={e=>{e.preventDefault();apply();}}>
          <div className="field"><label htmlFor="chord-input">コード一覧を貼り付け</label><input id="chord-input" className="mono" type="text" autoComplete="off" spellCheck={false} placeholder="C,Am7,G,Fmaj7" value={st.draft.input} onChange={e=>controller.draft({input:e.target.value})} aria-describedby="chord-hint" disabled={locked||loading}/><p id="chord-hint">カンマ区切り・1行。例 <code>C,Am7,G,Fmaj7</code><br/><button className="text-button" type="button" onClick={()=>setPanel('help')}>入力形式・フォーム指定について</button></p></div>
          <fieldset disabled={locked||loading}><legend>貼り付けたコードの意味</legend>{(['shape','sound'] as const).map(mode=><label key={mode} className={`mode-option ${st.draft.mode===mode?'active':''}`}><input type="radio" name="mode" value={mode} checked={st.draft.mode===mode} onChange={()=>{controller.edit({mode});}}/><span><strong>{mode==='shape'?'押さえるコード（フォーム）':'鳴らしたいコード（実音）'}</strong><small>{mode==='shape'?'カポを変えても押さえ方は同じ':'カポに合わせて押さえ方を計算'}</small></span></label>)}</fieldset>
          <button className="primary apply" disabled={locked||loading} type="submit">{loading?'コード図を読み込み中…':'一覧に反映'}</button>
          {dirty&&!locked&&<p className="small dirty">入力が変更されています。反映するまで一覧とリンクは前のままです。</p>}
          <details className="advanced" open><summary>詳細設定<small>曲名・出典URL・元サイトの移調</small></summary><div className="details-body">
            <div className="field"><label htmlFor="song-title">曲名（任意）</label><input id="song-title" value={st.draft.title} onChange={e=>controller.draft({title:e.target.value})} disabled={locked||loading}/></div>
            <div className="field"><label htmlFor="song-src">出典URL（任意・記録のみ）</label><input id="song-src" type="url" value={st.draft.src} onChange={e=>controller.draft({src:e.target.value})} placeholder="https://…" disabled={locked||loading}/><p>自動取得はしません。出典URL全文が共有リンクに含まれます。</p></div>
            <div className="field"><span id="source-shift-label" className="label">元サイトで適用済みの移調</span><div className="stepper" role="group" aria-labelledby="source-shift-label"><button type="button" aria-label="元サイトの移調を半音下げる" disabled={locked||st.draft.sourceShift<=-24} onClick={()=>{controller.edit({sourceShift:st.draft.sourceShift-1});}}>−</button><output>{signed(st.draft.sourceShift)}</output><button type="button" aria-label="元サイトの移調を半音上げる" disabled={locked||st.draft.sourceShift>=24} onClick={()=>{controller.edit({sourceShift:st.draft.sourceShift+1});}}>＋</button><span className="small">半音</span></div><p>元サイトで移調してから貼った場合だけ入力（省略時 0）。貼ったコードに二重には足しません。</p></div>
          </div></details>
        </form>
        <div className="sidebar-footer"><p><strong>登録・ログイン不要。</strong>曲の内容はリンクのURLに、好みの押さえ方はこのブラウザに、別々に保存されます。</p>{st.song&&<button className="text-button" onClick={()=>controller.newSong()} disabled={locked||loading}>＋ 別の曲を入力する</button>}<a href="/url-v1.md" target="_blank" rel="noreferrer">AI向けURL仕様</a><a href="/third-party-notices.txt" target="_blank" rel="noreferrer">データ出典・ライセンス</a></div>
      </aside>
      <main id="workspace" className="main" tabIndex={-1}>
        {st.error&&<div className="alert" role="alert"><strong>反映できませんでした</strong><span>{st.error}</span><small>直前の有効な一覧とリンクはそのままです。</small></div>}
        {locked&&<div className="review-banner"><strong>押さえ方を確認中 · リンクの内容をプレビューしています</strong><p>確認が完了するまで好みは保存されず、共有・編集はできません。</p><button onClick={()=>setReviewHidden(false)}>確認を続ける</button></div>}
        {s&&rows.length>0?<>
          <section className="song-heading"><h1>{s.title||'曲名なし'}</h1><div className="song-meta">{s.src&&<a href={s.src} target="_blank" rel="noopener noreferrer">元のコード譜を開く <Icon name="out"/></a>}<span><strong>{rows.length}</strong> コード</span><span>入力：{s.mode==='shape'?'押さえるコード（フォーム）':'鳴らしたいコード（実音）'}</span><span>標準6弦ギター（E A D G B E）</span></div></section>
          <section className="toolbar" aria-label="表示の操作"><div className="toolbar-row">
            <div className="stepper" role="group" aria-label="移調"><span className="label">移調</span><button aria-label="半音下げる" disabled={locked||s.shift<=-24} onClick={()=>controller.edit({shift:s.shift-1})}>−</button><output aria-live="polite" aria-label="合計移調">{signed(s.sourceShift+s.shift)}</output><button aria-label="半音上げる" disabled={locked||s.shift>=24} onClick={()=>controller.edit({shift:s.shift+1})}>＋</button></div>
            <div className="control"><label htmlFor="capo">カポ</label><select id="capo" value={s.capo} disabled={locked||loading} onChange={e=>controller.edit({capo:Number(e.target.value)})}>{Array.from({length:13},(_,n)=><option key={n} value={n}>{n===0?'なし（0）':n}</option>)}</select></div>
            <div className="control"><span className="label">並び順</span><div className="segmented">{(['first','name'] as const).map(sort=><button key={sort} aria-pressed={s.sort===sort} disabled={locked||loading} onClick={()=>controller.edit({sort})}>{sort==='first'?'貼り付け順':'名前順'}</button>)}</div></div>
            <button className="primary copy" onClick={copy} disabled={locked||loading}><Icon name="link"/>共有リンクをコピー</button>
          </div><div className="toolbar-help">{s.sourceShift!==0&&<span>移調 {signed(s.sourceShift+s.shift)} ＝ 元サイト {signed(s.sourceShift)} ＋ 追加 {signed(s.shift)}。</span>}<span>この曲はリンクのURLだけで保存・復元・共有できます。</span>{!locked&&st.song&&<code title={url()}>{url()}</code>}</div></section>
          <ul className="chord-grid" aria-label="コード一覧">{rows.map(c=><li className="chord-card" key={c.raw} data-testid="chord-card"><h2>{pretty(c.playing)}</h2><div className="card-status">{(c.playing!==c.raw||c.sounding!==c.playing)&&<small>元: {pretty(c.raw)} ／ 実音: {pretty(c.sounding)}</small>}{c.key&&!!st.prefs[c.key]&&st.prefs[c.key]===c.form&&<span className="pref-badge"><Icon name="book"/>好みを使用中</span>}</div>{c.voicing?<ChordDiagram name={c.playing} v={c.voicing}/>:<div className="missing"><strong>ⓘ {c.key?'フォーム未対応':'N.C.'}</strong><p>{c.warning}</p>{c.form&&<code>{c.form}</code>}</div>}{c.voicing&&s.capo+Math.max(...c.voicing.frets)>24&&<p className="neck-warning">カポを含む位置が24フレットを超えます。お使いのギターで弾けるか確認してください。</p>}<div className="card-actions">{c.options.length>1&&<button disabled={locked||loading} aria-label={`${c.playing}の押さえ方を変更`} onClick={e=>{e.currentTarget.focus();setPicker(c);setSelected(c.form??c.options[0].pattern);}}>押さえ方を変更</button>}</div></li>)}</ul>
          <p className="grid-note">○ 開放弦 × ミュート <span className="finger-example">1</span> 人差し指 2 中指 3 薬指 4 小指<span>左が6弦、右が1弦。フレットはカポを0として数えます。</span></p>
        </>:<section className="empty-state"><img src="/favicon.svg" alt="" width="48" height="56"/><p className="eyebrow">いつもの曲を、弾きやすい押さえ方で。</p><h1>曲のコードを、<br/>一画面に。</h1><p>コード一覧を貼り付けて、練習をはじめましょう。<br/>好きな押さえ方に変えて、リンクだけで残せます。</p><button onClick={()=>{controller.draft({input:SAMPLE,title:'練習曲サンプル'});void apply();}} disabled={loading}>サンプルで試す <span aria-hidden="true">→</span></button><div className="empty-steps"><span><b>1</b> コードを貼り付け</span><span><b>2</b> 押さえ方を選ぶ</span><span><b>3</b> リンクで保存</span></div><small>歌詞・コード進行は元のコード譜で確認できます。</small></section>}
        {st.notice&&<div className="notice" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{st.notice}</div>}
      </main>
    </div>
    {picker&&<Dialog title={`${pretty(picker.playing)} の押さえ方を選ぶ`} wide onClose={()=>setPicker(null)}><div className="voicing-options" role="radiogroup" aria-label={`${picker.playing}の候補`}>{picker.options.map(v=><label className={`voicing-option ${selected===v.pattern?'selected':''}`} key={v.pattern}><input type="radio" name="voicing" value={v.pattern} checked={selected===v.pattern} onChange={()=>setSelected(v.pattern)}/><span>{selected===v.pattern?'選択中':' '}</span><ChordDiagram name={picker.playing} v={v}/><code>{v.pattern}</code><small>{v.barres.length?'セーハあり':'セーハなし'}{picker.form===v.pattern?' · 現在の表示':''}</small></label>)}</div><div className="modal-footer"><p>選んだ押さえ方はこのブラウザに保存され、他の曲の同じコードにも使われます。指番号は登録済みの代表値です。</p><div><button onClick={()=>setPicker(null)}>キャンセル</button><button className="primary" onClick={()=>{if(controller.choose(picker.key!,selected))setPicker(null);}}>この押さえ方を使う</button></div></div></Dialog>}
    {panel==='prefs'&&<Dialog title={`好みの押さえ方 ${Object.keys(st.prefs).length}件`} onClose={()=>setPanel(null)}><div className="modal-content"><p>このブラウザだけに保存され、どの曲でも同じコードに使われます。同じ音のコード（C♯とD♭など）は共通です。曲の保存先（リンクのURL）とは別です。</p>{Object.keys(st.prefs).length===0?<p className="no-prefs">まだありません。カードの「押さえ方を変更」で選ぶと、ここに残ります。</p>:<ul className="preference-list">{Object.entries(st.prefs).map(([key,tab])=>{const v=matchVoicing(key,tab);return <li key={key}><div><h3>{pretty(nameFromKey(key))}</h3><code>{tab}</code></div>{v&&v.status!=='invalid'&&<ChordDiagram name={nameFromKey(key)} v={v} small/>}<button aria-label={`${nameFromKey(key)}の好みを削除`} onClick={()=>controller.deletePreferences([key])}>削除</button></li>;})}</ul>}<p className="small">削除すると、表示中の曲の該当コードもサイト標準の押さえ方に戻り、リンクが更新されます。</p>{confirmDelete?<div className="alert"><strong>すべての好みを削除しますか？</strong><div className="button-row"><button onClick={()=>setConfirmDelete(false)}>やめる</button><button onClick={()=>{controller.deletePreferences(Object.keys(st.prefs));setConfirmDelete(false);}}>すべて削除する</button></div></div>:<button disabled={!Object.keys(st.prefs).length} onClick={()=>setConfirmDelete(true)}>すべて削除…</button>}</div></Dialog>}
    {panel==='help'&&<Dialog title="使い方" onClose={()=>setPanel(null)}><div className="modal-content help-content"><ol><li>曲に出てくるコードを、冒頭から最後までカンマ区切りで用意します。</li><li>入力欄に貼り付けて「一覧に反映」。同じ表記は1枚にまとめます。</li><li>「押さえ方を変更」から弾きやすいフォームを選びます。</li><li>「共有リンクをコピー」してブックマーク。別の端末でも復元できます。</li></ol><h3>入力形式</h3><code>C,Am7,G,Fmaj7</code><p>押さえ方も指定する場合：<code>C@x32010,Am7,G</code>。6弦→1弦の順で、xはミュート、0は開放です。10フレット以上は <code>C@8:10:10:9:8:8</code> のように全弦をコロンで区切ります。</p><p>登録済みのフォームだけを使用します。未対応のコード名やフォームも省略せず、名前と警告を残します。<code>C7(b9,#11)</code> のかっこ内のカンマは区切りません。</p><h3>カポと移調</h3><p>「フォーム」入力ではカポを変えても押さえるコードは維持されます。「実音」入力では、同じ実音が鳴るように押さえるコードを計算します。元サイトで適用済みの移調は詳細設定に記録し、二重には足しません。</p><h3>共有と好み</h3><p>共有リンクを開いただけではブラウザの好みは変更されません。差分確認で選んだ押さえ方だけを保存します。選ばなかった指定は、ご自身の好み（なければサイト標準）に戻ります。</p><a href="/url-v1.md" target="_blank" rel="noreferrer">AI・外部ツール向けURL仕様を読む</a></div></Dialog>}
    {locked&&!reviewHidden&&<Dialog title={st.pending!.incoming.conflicts.length?'同じ音のコードの押さえ方をそろえる':'外部の押さえ方を確認'} wide onClose={closeReview}><div className="modal-content"><p>リンクの押さえ方をプレビューしています。確認するまで、このブラウザの好みは変更されません。</p>{st.pending!.incoming.conflicts.length?st.pending!.incoming.conflicts.map(c=><fieldset className="conflict" key={c.key}><legend>{pretty(nameFromKey(c.key))} · 同じ音の別表記に競合があります</legend><div className="voicing-options">{c.values.map(tab=>{const v=matchVoicing(c.key,tab);return <label key={tab} className="voicing-option"><input type="radio" name={`conflict-${c.key}`} checked={conflictChoices[c.key]===tab} onChange={()=>setConflictChoices({...conflictChoices,[c.key]:tab})}/><code>{tab}</code>{v&&v.status!=='invalid'?<ChordDiagram name={nameFromKey(c.key)} v={v}/>:<p>登録のないフォーム · 図は表示しません</p>}</label>;})}</div></fieldset>):<><p><strong>自分の好みとして保存するコードだけにチェックしてください。</strong>未選択のものは、ご自身の好み（なければサイト標準）に戻ります。</p>{diff.map(d=><section className="diff-card" key={d.key}><h3>{pretty(d.name)}</h3><div className="diff-pair"><div><span>リンクで指定された押さえ方</span><ChordDiagram name={d.name} v={matchVoicing(d.key,d.external)!} small/><code>{d.external}</code></div><div><span>{st.prefs[d.key]?'ブラウザに保存済み':'サイト標準'}</span><ChordDiagram name={d.name} v={matchVoicing(d.key,d.fallback)!} small/><code>{d.fallback}</code></div></div><label className="save-check"><input type="checkbox" checked={accepted.includes(d.key)} onChange={e=>setAccepted(e.target.checked?[...accepted,d.key]:accepted.filter(k=>k!==d.key))}/>この押さえ方を自分の好みとして保存</label></section>)}</>}</div><div className="modal-footer"><button onClick={closeReview}>{st.pending!.previous?'キャンセルして前の曲へ':'あとで確認する'}</button>{st.pending!.incoming.conflicts.length?<button className="primary" disabled={!st.pending!.incoming.conflicts.every(c=>conflictChoices[c.key])} onClick={()=>controller.resolveConflicts(conflictChoices)}>この押さえ方にそろえる</button>:<button className="primary" onClick={()=>controller.finishReview(accepted)}>選択した内容で確定</button>}</div></Dialog>}
    {copyFallback&&<Dialog title="共有リンクをコピー" onClose={()=>setCopyFallback(false)}><div className="modal-content"><p>クリップボードが利用できません。下のリンクを選択してコピーしてください。</p><textarea aria-label="共有リンク" readOnly value={url()} onFocus={e=>e.target.select()}/></div></Dialog>}
  </>;
}
