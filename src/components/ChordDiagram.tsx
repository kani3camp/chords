import { useId } from 'react';
import type { Voicing } from '../catalog/schema';
export function ChordDiagram({name,v,small=false}:{name:string;v:Voicing;small?:boolean}) {
  const id=useId(); const positives=v.frets.filter(f=>f>0);
  const max=Math.max(0,...positives); const base=max<=4?1:Math.min(...positives);
  const rows=Math.max(4,max-base+1);const dx=24,dy=32,x=35,y=30;
  const desc=`${name} コード図 ${v.pattern}。開始${base}フレット。`+v.frets.map((f,i)=>`${6-i}弦${f<0?'ミュート':f===0?'開放':`${f}フレット、指${v.fingers[i]}`}`).join('。')+v.barres.map(b=>`。${b.fret}フレット、${6-b.from}弦から${6-b.to}弦を指${b.finger}でセーハ`).join('');
  const covered=(i:number)=>v.barres.some(b=>i>=b.from&&i<=b.to&&v.frets[i]===b.fret&&v.fingers[i]===b.finger);
  return <svg className={small?'diagram small':'diagram'} viewBox={`0 0 186 ${y+rows*dy+18}`} role="img" aria-labelledby={id}>
    <title id={id}>{desc}</title>
    {base>1&&<text className="fret-number" x="18" y={y+dy/2+6} textAnchor="end">{base}</text>}
    {Array.from({length:rows+1},(_,i)=><line key={`f${i}`} x1={x} x2={x+5*dx} y1={y+i*dy} y2={y+i*dy} className={i===0&&base===1?'nut':'fret'}/>)}
    {v.frets.map((f,i)=><g key={i}><line x1={x+i*dx} x2={x+i*dx} y1={y} y2={y+rows*dy} className="string"/>{f<=0&&<text className="open-mark" x={x+i*dx} y="18" textAnchor="middle">{f<0?'×':'○'}</text>}</g>)}
    {v.barres.map((b,i)=><g key={`b${i}`}><rect x={x+b.from*dx-10} y={y+(b.fret-base+.5)*dy-10} width={(b.to-b.from)*dx+20} height="20" rx="10" className="finger-dot"/><text x={x+b.from*dx} y={y+(b.fret-base+.5)*dy+4} textAnchor="middle" className="finger-number">{b.finger}</text></g>)}
    {v.frets.map((f,i)=>f>0&&!covered(i)?<g key={`p${i}`}><circle cx={x+i*dx} cy={y+(f-base+.5)*dy} r="10" className="finger-dot"/><text x={x+i*dx} y={y+(f-base+.5)*dy+4} textAnchor="middle" className="finger-number">{v.fingers[i]}</text></g>:null)}
  </svg>;
}
