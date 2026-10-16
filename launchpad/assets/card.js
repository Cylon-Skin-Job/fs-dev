/* Portable card presentation receiving data and callbacks only. */
globalThis.LPCard = function ({ticket, onOpen, onBlocked}) {
  const card = document.createElement('article'); card.className = 'rv-card'; card.dataset.ticketUuid = ticket.root.uuid;
  const open = document.createElement('button'); open.className = 'rv-card-open'; open.type = 'button';
  open.textContent = ticket.root.body.number + '. ' + ticket.root.body.title; open.onclick = () => onOpen(ticket.root.uuid);
  // The card symbol/color derives only from the explicit current top-level
  // workflow node. Nested review/attempt/gate icons never roll up here.
  const symbol = (ticket.workflow && ticket.workflow.card && ticket.workflow.card.icon) || 'chat_display';
  const color = (ticket.workflow && ticket.workflow.card && ticket.workflow.card.color) || 'neutral';
  const glyphs = {chat_display:'◉', autostop:'⏸', rocket_launch:'🚀', back_hand:'🤚', check_circle:'✓', output_circle:'◯', progress_activity:'◌'};
  const state = document.createElement('span'); state.className = 'rv-card-state'; state.textContent = glyphs[symbol] || '◉';
  const phase = ticket.records.find(x => x.uuid === (ticket.discussions?.current_phase_node_uuid || ticket.root.body.current_workflow_node_uuid));
  state.setAttribute('aria-label', symbol + ' · ' + ((ticket.workflow && ticket.workflow.card && ticket.workflow.card.title) || phase?.body.title || 'Intake Capture'));
  state.title = symbol; card.dataset.cardSymbol = symbol; card.dataset.cardColor = color; card.dataset.currentPhase = phase?.uuid || '';
  // Finalization is a separate top-level timeline state. It never rewrites the
  // workflow-derived card icon and never invents a next mode for a terminal ticket.
  const fin = ticket.finalization || {};
  if (fin.state) { card.dataset.finalizationState = fin.state; card.dataset.finalizationCompleted = String(!!fin.completed); card.dataset.nextMode = fin.next_mode === null ? '' : String(fin.next_mode ?? ''); }
  const blocked = document.createElement('button'); blocked.type = 'button'; blocked.className = 'rv-blocked';
  blocked.textContent = 'ⓘ'; blocked.setAttribute('aria-label', 'Blocked reason and release'); blocked.title = 'Readiness';
  blocked.onclick = () => onBlocked({reason:'Seed awaits an owner-designated discussion and readiness review.', owner:'Assigned Launchpad', release:'Explicit reviewed prerequisite and owner gates.'});
  card.append(open, state, blocked); return card;
};
