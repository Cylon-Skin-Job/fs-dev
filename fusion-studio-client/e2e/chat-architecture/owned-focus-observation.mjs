// Bounded diagnostics for the already-owned Electron fixture only.
export async function installOwnedFocusObservation(runtime) {
  await runtime.app.evaluate(({BrowserWindow,app}) => {
    const window = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('fusion-shell://app/'));
    if (!window) throw Error('Owned fixture window unavailable for focus observation');
    const observation = globalThis.__chatArchOwnedFocus = {pid:process.pid,windowId:window.id,events:[],overflow:0};
    const record = type => {
      if (observation.events.length === 200) {observation.events.shift();observation.overflow++;}
      observation.events.push({type,at:Date.now(),focused:window.isFocused(),appHidden:app.isHidden(),visible:window.isVisible(),minimized:window.isMinimized()});
    };
    for (const type of ['focus','blur','show','hide','minimize','restore','responsive','unresponsive']) window.on(type,() => record(type));
    record('installed');
  });
}

export async function readOwnedFocusObservation(runtime) {
  return runtime?.app.evaluate(() => globalThis.__chatArchOwnedFocus ?? null).catch(() => null);
}

export function focusIntervalEvidence(observation,startedAt,endedAt) {
  const available=Boolean(observation?.events?.length)
    && observation.events[0].at<=startedAt && observation.overflow===0;
  const events=(observation?.events??[]).filter(event=>event.at>=startedAt&&event.at<=endedAt);
  const interruptions=events.filter(event=>['blur','hide','minimize'].includes(event.type)
    || event.focused!==true || event.minimized===true || event.appHidden===true);
  return {startedAt,endedAt,available,events,overflow:observation?.overflow??null,
    valid:available&&interruptions.length===0,interruptions};
}
