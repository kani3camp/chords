import { describe,expect,it } from 'vitest';
import { Controller } from '../src/app/controller';
import { DISPLAY_SETTINGS_KEY } from '../src/state/display-settings';
import { STORAGE_KEY } from '../src/state/preferences';

function harness(saved?:string) {
  const data=new Map<string,string>();
  if(saved!==undefined)data.set(DISPLAY_SETTINGS_KEY,saved);
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}} as Storage;
  let href='https://chords.kani3camp.com/?v=1&codes=C,G&mode=shape&capo=2';
  let blocked=false;
  const env={href:()=>href,history:(url:string)=>{href=url;},storage:()=>{if(blocked)throw Error('blocked');return storage;}};
  return {controller:new Controller(env),reload:()=>new Controller(env),data,href:()=>href,block:()=>{blocked=true;}};
}

describe('browser display settings independent of song and voicing persistence',()=>{
  it('persists both on and off without changing the song, URL or saved voicings',()=>{
    const h=harness();
    expect(h.controller.snapshot().showChordDetails).toBe(false);
    const song=h.controller.snapshot().song;
    const url=h.href();
    h.controller.setShowChordDetails(true);
    expect(h.reload().snapshot().showChordDetails).toBe(true);
    expect(h.controller.snapshot().song).toBe(song);
    expect(h.href()).toBe(url);
    expect(h.data.has(STORAGE_KEY)).toBe(false);
    h.controller.setShowChordDetails(false);
    expect(h.reload().snapshot().showChordDetails).toBe(false);
  });

  it.each(['broken JSON','null','{}','{"version":2,"showChordDetails":true}','{"version":1,"showChordDetails":"true"}'])(
    'defaults off for invalid stored settings: %s',saved=>{
      expect(harness(saved).controller.snapshot().showChordDetails).toBe(false);
    }
  );

  it('allows display changes and song loading when storage access throws',()=>{
    const h=harness();const url=h.href();h.block();
    h.controller.setShowChordDetails(true);
    expect(h.controller.snapshot().showChordDetails).toBe(true);
    expect(h.controller.snapshot().notice).toContain('保存できません');
    expect(h.href()).toBe(url);
    const reloaded=h.reload();
    expect(reloaded.snapshot().showChordDetails).toBe(false);
    expect(reloaded.snapshot().song?.codes).toEqual(['C','G']);
  });
});
