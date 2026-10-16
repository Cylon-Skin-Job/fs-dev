/* Scoped portable presentation styles, injected exactly once. */
(() => {
  if(document.getElementById('rv-view-styles'))return;
  const style=document.createElement('style');style.id='rv-view-styles';style.textContent=`
  :root { color-scheme:dark; }
  body { margin:var(--space-zero,0); background:var(--bg-page,#000); color:var(--text-primary,#eee); font-family:var(--font-ui,system-ui); }
  #rv-root button,#rv-root select { font:inherit; color:inherit; background:var(--bg-control,#0d1110); border:var(--border-width,1px) solid var(--palette-line,#38413d); border-radius:var(--radius-sm,6px); padding:var(--space-sm,8px); cursor:pointer; }
  #rv-root button:focus-visible,#rv-root select:focus-visible { outline:var(--outline-width,2px) solid var(--palette-accent,#99d9c7); }
  .rv-header { padding:var(--space-lg,24px); border-bottom:var(--border-width,1px) solid var(--palette-line,#38413d); }
  .rv-header h1 { font-size:var(--font-title,22px); margin:var(--space-zero,0) var(--space-zero,0) var(--space-md,16px); }
  .rv-generation { color:var(--text-muted,#aaa); font-size:var(--font-small,12px); overflow-wrap:anywhere; }
  .rv-body { padding:var(--space-lg,24px); }
  #rv-root a { color:var(--palette-accent,#99d9c7); }
  .rv-timeline-viewport { overflow:auto; min-height:var(--viewport-height,680px); border:var(--border-width,1px) solid var(--palette-line,#303733); border-radius:var(--radius-lg,8px); background:var(--bg-timeline,#030504); }
  .rv-timeline { position:relative; width:var(--timeline-width,2200px); height:var(--timeline-height,680px); }
  .rv-links { position:absolute; inset:var(--space-zero,0); width:var(--full-width,100%); height:var(--full-height,100%); pointer-events:none; }
  .rv-links path { fill:none; stroke:var(--palette-rail,#46554b); stroke-width:var(--rail-width,1.2px); }
  .rv-links .rv-main-rail { stroke:var(--palette-main-rail,#a1b8aa); stroke-width:var(--main-rail-width,3.5px); }
  .rv-track-title { position:absolute; top:var(--track-y,0); left:var(--track-label-x,18px); margin:var(--space-zero,0); padding:var(--space-xs,3px) var(--space-sm,6px); background:var(--bg-timeline,#030504); font-size:var(--font-small,12px); font-weight:var(--weight-medium,500); color:var(--text-muted,#969f99); }
  .rv-card { position:absolute; left:var(--card-x,160px); top:var(--card-y,340px); transform:translateY(var(--card-center,-50%)); width:var(--card-width,200px); height:var(--card-height,72px); background:var(--bg-card,#0d1110); border:var(--border-width,1px) solid var(--palette-line,#38413d); border-radius:var(--radius-sm,6px); padding:var(--space-sm,8px); display:flex; flex-direction:column; gap:var(--space-xs,4px); box-sizing:border-box; }
  #rv-root .rv-card-open { text-align:center; height:var(--full-height,100%); border:var(--border-zero,0); background:var(--bg-transparent,transparent); font-size:var(--font-card,13px); line-height:var(--card-line-height,18px); padding:var(--space-xs,4px); }
  .rv-card-state { position:absolute; right:var(--icon-x,-8px); top:var(--icon-y,-8px); color:var(--palette-accent,#99d9c7); font-size:var(--font-icon,18px); background:var(--bg-card,#0d1110); }
  #rv-root .rv-blocked { position:absolute; left:var(--icon-x,-8px); top:var(--icon-y,-8px); font-size:var(--font-icon,18px); padding:var(--space-zero,0); border:var(--border-zero,0); border-radius:var(--radius-circle,50%); }
  .rv-ticket { max-width:var(--ticket-width,1200px); margin:var(--space-md,16px) auto; }
  .rv-ticket-columns { display:grid; grid-template-columns:var(--workflow-column,340px) minmax(var(--min-zero,0px),1fr); gap:var(--space-lg,24px); }
  .rv-workflow,.rv-ticket-content { max-height:var(--ticket-pane-height,65vh); overflow:auto; }
  .rv-logo { font-size:var(--font-title,22px); }.rv-row { display:flex; align-items:center; gap:var(--space-sm,8px); }
  .rv-node { border:var(--border-width,1px) solid var(--palette-line,#38413d); border-radius:var(--radius-sm,6px); margin:var(--space-sm,8px) var(--space-zero,0); padding:var(--space-sm,8px); }
  .rv-node[aria-current=step] { border-color:var(--palette-accent,#99d9c7); background:var(--bg-current-phase,#10221a); }
  .rv-card[data-current-phase] { border-color:var(--palette-accent,#99d9c7); }
  .rv-node-body { margin-left:var(--space-lg,24px); }.rv-description { flex:1; text-align:left; background:var(--bg-transparent,transparent); border-color:var(--bg-transparent,transparent); color:var(--text-muted,#aaa); }
  .rv-description:hover { border-color:var(--palette-line,#38413d); }.rv-description:focus-visible { border-color:var(--palette-accent,#99d9c7); background:var(--bg-control,#0d1110); }
  .rv-card[data-card-color=running] { border-color:var(--palette-running,#7fb3d5); }.rv-card[data-card-color=owner] { border-color:var(--palette-owner,#edc575); }.rv-card[data-card-color=done] { border-color:var(--palette-done,#99d9c7); }
  .rv-content { padding:var(--space-md,16px); }
  .rv-content pre { white-space:pre-wrap; overflow-wrap:anywhere; }.rv-modal { width:var(--modal-width,90vw); height:var(--modal-height,85vh); background:var(--bg-page,#000); color:var(--text-primary,#eee); border:var(--border-width,1px) solid var(--palette-line,#38413d); padding:var(--space-lg,24px); }
  .rv-modal::backdrop { background:var(--bg-backdrop,#000b); }.rv-modal-head { display:flex; gap:var(--space-md,16px); align-items:center; }.rv-modal-head h2 { flex:1; }
  .rv-modal-scroll { overflow:auto; max-height:var(--modal-scroll-height,65vh); white-space:pre-wrap; overflow-wrap:anywhere; }.rv-notice { color:var(--palette-warning,#edc575); }
  .rv-run-spinner{display:inline-block;margin-inline-end:var(--space-xs,4px);animation:rv-run-spin var(--run-spin-duration,1s) linear infinite;}@keyframes rv-run-spin{to{transform:rotate(360deg);}}@media(prefers-reduced-motion:reduce){.rv-run-spinner{animation:none;}}
`;document.head.append(style);
})();
