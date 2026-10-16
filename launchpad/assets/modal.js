/* Shared read-only detail modal: text payloads and callback-driven clipboard. */
globalThis.LPModal = function ({title, value, onCopy, onClose, selector, onSelector, scrollKey}) {
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  const dialog=document.createElement('dialog');dialog.className='rv-modal';dialog.setAttribute('aria-label',title);
  const head=document.createElement('header');head.className='rv-modal-head';
  const label=document.createElement('h2');label.textContent=title;
  let closed=false;function finish(){if(closed)return;closed=true;dialog.remove();onClose();}function dismiss(){dialog.close();finish();}
  const close=document.createElement('button');close.dataset.focusRole='modal-close';close.type='button';close.textContent='Close';close.onclick=dismiss;
  const copy=document.createElement('button');copy.dataset.focusRole='modal-copy';copy.type='button';copy.textContent='Copy JSON';
  const text=document.createElement('pre');text.className='rv-modal-scroll';text.tabIndex=0;text.dataset.focusRole='modal-json';if(scrollKey)text.dataset.scrollKey=scrollKey;text.textContent=typeof value==='string'?value:JSON.stringify(ordered(value),null,2);
  copy.onclick=()=>onCopy(text.textContent,text);head.append(label);
  if(selector){const status=document.createElement('span');status.textContent=selector==='pinned'?'Pinned historical revision':'Current captured revision';
    const switcher=document.createElement('button');switcher.type='button';switcher.textContent=selector==='pinned'?'Show current':'Pin revision';switcher.dataset.focusRole=selector==='pinned'?'modal-current':'modal-pin';switcher.onclick=()=>onSelector(selector==='pinned'?'current':'pinned');head.append(status,switcher);}
  head.append(copy,close);dialog.append(head,text);
  dialog.onclose=finish;dialog.oncancel=event=>{event.preventDefault();dismiss();};dialog.onclick=event=>{if(event.target===dialog)dismiss();};
  return dialog;
};
