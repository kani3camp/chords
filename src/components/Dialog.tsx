import { useEffect, useRef, type ReactNode } from 'react';
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const dialog=ref.current!;dialog.showModal();
    return ()=>{dialog.close();previous?.focus();};
  },[]);
  return <dialog ref={ref} className={wide?'modal wide':'modal'} aria-labelledby="dialog-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}
