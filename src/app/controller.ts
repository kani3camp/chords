import { defaultForm, matchVoicing } from '../catalog';
import { differences, emptySong, fromInput, keysOf, resolve, type Incoming, type Preferences, type Song } from '../state/song';
import { parseUrl, serialize } from '../state/url';
import { readPreferences, writePreferences } from '../state/preferences';

export type Draft = { input: string; title: string; src: string; mode: Song['mode']; sourceShift: number };
type Pending = { incoming: Incoming; previous: Song | null; previousUrl: string; push: boolean };
export type Snapshot = { song: Song | null; prefs: Preferences; pending: Pending | null; draft: Draft; error: string; notice: string; newSong: boolean };
const draftOf = (s: Song): Draft => ({input:s.codes.join(','),title:s.title,src:s.src,mode:s.mode,sourceShift:s.sourceShift});
export interface Environment { href:()=>string; history:(url:string,push:boolean)=>void; storage:()=>Storage; }
export class Controller {
  private listeners = new Set<()=>void>();
  private state: Snapshot = {song:null,prefs:{},pending:null,draft:draftOf(emptySong()),error:'',notice:'',newSong:false};
  constructor(private env: Environment) {
    try { const stored = readPreferences(env.storage()); this.state.prefs=stored.forms; this.state.notice=stored.warning??''; }
    catch { this.state.notice='ブラウザの保存機能が利用できません。共有リンクは利用できます。'; }
    this.load();
  }
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>this.listeners.delete(f);};
  snapshot=()=>this.state;
  private update(next: Partial<Snapshot>) { this.state={...this.state,...next}; this.listeners.forEach(f=>f()); }
  private fail(e:unknown) { this.update({error:e instanceof Error?e.message:String(e)}); }
  private commit(song: Song, opts: { push?:boolean; prefs?:Preferences; syncDraft?:boolean; notice?:string }={}): boolean {
    try {
      const url=serialize(song,this.env.href()); // Must finish before history, storage, or visible state.
      this.env.history(url,!!opts.push);
      let notice=opts.notice??'一覧と共有リンクを更新しました。';
      if(opts.prefs) { try { notice=writePreferences(this.env.storage(),opts.prefs)??notice; } catch {notice='好みをブラウザに保存できませんでした。共有リンクは更新されています。';} }
      this.update({song,pending:null,error:'',prefs:opts.prefs??this.state.prefs,notice,newSong:false,...(opts.syncDraft?{draft:draftOf(song)}:{})});
      return true;
    } catch(e) { this.fail(e);return false; }
  }
  load=()=>{
    try {
      const incoming=parseUrl(this.env.href(),this.state.prefs);
      if(!incoming) {this.update({song:null,pending:null,draft:draftOf(emptySong()),error:'',newSong:false});return;}
      this.receive(incoming,false);
    } catch(e) {
      if(this.state.song) {
        try{this.env.history(serialize(this.state.song,this.env.href()),false);}catch{/* Original failure is still surfaced below. */}
      }
      this.fail(e);
    }
  };
  private receive(incoming: Incoming,push:boolean) {
    // A preview is not an escape hatch around the atomic URL-length gate.
    const longest={...incoming.song,forms:{...incoming.song.forms}};
    for(const c of incoming.conflicts)longest.forms[c.key]=[...c.values].sort((a,b)=>encodeURIComponent(b).length-encodeURIComponent(a).length)[0];
    serialize(longest,this.env.href());
    if(incoming.conflicts.length || differences(incoming,this.state.prefs).length) {
      // External values remain visibly previewed. Preferences and the URL are untouched.
      this.update({pending:{incoming,previous:this.state.song,previousUrl:this.state.song?serialize(this.state.song,this.env.href()):this.env.href(),push},draft:draftOf(incoming.song),error:''});
    } else this.commit(incoming.song,{push,syncDraft:true});
  }
  draft=(next:Partial<Draft>)=>this.update({draft:{...this.state.draft,...next},error:''});
  newSong=()=>{if(!this.state.pending)this.update({draft:draftOf(emptySong()),newSong:true,error:'',notice:'別の曲のコードを入力してください。反映すると履歴に追加します。'});};
  apply=()=>{
    if(this.state.pending)return;
    try {
      const d=this.state.draft;
      const base={...(this.state.newSong?emptySong():this.state.song??emptySong()),title:d.title,src:d.src,mode:d.mode,sourceShift:d.sourceShift,forms:{}};
      const incoming=fromInput(d.input,base,this.state.prefs,this.state.newSong?{}:this.state.song?.forms);
      this.receive(incoming,!!this.state.song && this.state.newSong);
    } catch(e) {this.fail(e);}
  };
  edit=(next:Partial<Pick<Song,'capo'|'shift'|'sourceShift'|'sort'|'mode'>>)=>{
    if(this.state.pending)return;
    const s=this.state.song;
    if(!s || this.state.newSong) {if(next.mode)this.draft({mode:next.mode}); if(next.sourceShift!==undefined)this.draft({sourceShift:next.sourceShift});return;}
    const rederive=next.capo!==undefined||next.shift!==undefined||next.mode!==undefined;
    const candidate=resolve({...s,...next,forms:rederive?{}:s.forms},this.state.prefs,rederive?s.forms:{});
    if(this.commit(candidate) && (next.mode!==undefined||next.sourceShift!==undefined)) this.draft({...(next.mode?{mode:next.mode}:{}),...(next.sourceShift!==undefined?{sourceShift:next.sourceShift}:{})});
  };
  choose=(key:string,form:string)=>{
    const s=this.state.song;if(!s||this.state.pending)return false;
    const found=matchVoicing(key,form);if(!found||found.status==='invalid')return false;
    return this.commit({...s,forms:{...s.forms,[key]:form}},{prefs:{...this.state.prefs,[key]:form},notice:'好みの押さえ方を保存しました。他の曲の同じコードにも使われます。'});
  };
  deletePreferences=(keys:string[])=>{
    if(this.state.pending)return;
    const prefs={...this.state.prefs};for(const k of keys)delete prefs[k];
    const s=this.state.song;
    if(s) {
      const forms={...s.forms};
      for(const key of keys) if(keysOf(s).includes(key)) {const standard=defaultForm(key); if(standard)forms[key]=standard;else delete forms[key];}
      this.commit({...s,forms},{prefs,notice:'好みを削除しました。表示中の該当コードとリンクを標準の押さえ方に更新しました。'});
    } else {
      let notice='好みを削除しました。';try{notice=writePreferences(this.env.storage(),prefs)??notice;}catch{notice='ブラウザの好みを削除できませんでした。';}
      this.update({prefs,notice});
    }
  };
  resolveConflicts=(choices: Record<string,string>)=>{
    const p=this.state.pending;if(!p)return;
    const incoming={...p.incoming,song:{...p.incoming.song,forms:{...p.incoming.song.forms}},explicit:{...p.incoming.explicit},conflicts:[]};
    for(const c of p.incoming.conflicts) {if(!c.values.includes(choices[c.key]))throw new Error('競合する押さえ方を選択してください。');incoming.song.forms[c.key]=choices[c.key];incoming.explicit[c.key]=[choices[c.key]];}
    this.update({pending:{...p,incoming}});
    if(!differences(incoming,this.state.prefs).length) this.commit(incoming.song,{push:p.push,syncDraft:true});
  };
  finishReview=(accepted:string[])=>{
    const p=this.state.pending;if(!p||p.incoming.conflicts.length)return false;
    const prefs={...this.state.prefs};const song={...p.incoming.song,forms:{...p.incoming.song.forms}};
    for(const d of differences(p.incoming,this.state.prefs)) {
      if(accepted.includes(d.key))prefs[d.key]=d.external;
      else song.forms[d.key]=d.fallback;
    }
    return this.commit(song,{push:p.push,prefs,syncDraft:true,notice:'確認した押さえ方を反映しました。共有リンクも更新しました。'});
  };
  cancelReview=()=>{
    const p=this.state.pending;if(!p?.previous)return false;
    try{this.env.history(p.previousUrl,false);this.update({song:p.previous,pending:null,draft:draftOf(p.previous),error:'',notice:'取り込みをキャンセルしました。'});return true;}catch(e){this.fail(e);return false;}
  };
  setError=(error:string)=>this.update({error});
  notify=(notice:string)=>this.update({notice});
}
