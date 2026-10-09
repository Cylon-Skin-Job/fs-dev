import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const bundlePromise = buildHarness();

async function buildHarness(): Promise<string> {
  const entry = 'virtual:chat-architecture-observation';
  const resolved = `\0${entry}`;
  const panelStore = path.resolve('src/state/panelStore.ts');
  const draftStore = path.resolve('src/state/chatComposerDraftStore.ts');
  const attachmentStore = path.resolve('src/state/chatFileLinkStore.ts');
  const submissionStore = path.resolve('src/state/chatSubmissionStore.ts');
  const host = path.resolve('src/components/chat/ChatSessionHost.tsx');
  const componentMount = path.resolve('src/components/chat/ChatSurfaceComponentMount.tsx');
  const action = path.resolve('src/lib/chat-action.ts');
  const actionController = path.resolve('src/lib/chat-action-controller.ts');
  const diagnosticHandlers = path.resolve('src/lib/ws/chat-diagnostic-handlers.ts');
  const source = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { useWorkspaceStore } from ${JSON.stringify(path.resolve('src/state/workspaceStore.ts'))};
    import { installProductSendCapability } from ${JSON.stringify(path.resolve('src/lib/ws/product-send.ts'))};
    import { usePanelStore } from ${JSON.stringify(panelStore)};
    import { useChatComposerDraftStore } from ${JSON.stringify(draftStore)};
    import { useChatFileLinkStore } from ${JSON.stringify(attachmentStore)};
    import { useChatSubmissionStore } from ${JSON.stringify(submissionStore)};
    import { ChatSessionHost } from ${JSON.stringify(host)};
    import { ChatSurfaceComponentMount } from ${JSON.stringify(componentMount)};
    import { dispatchChatAction, beginChatMaterial, commitChatMaterial } from ${JSON.stringify(action)};
    import { installChatActionConsumer } from ${JSON.stringify(actionController)};
    import { handleChatDiagnosticReportFrame } from ${JSON.stringify(diagnosticHandlers)};

    class FixtureSocket {
      constructor(name) { this.name=name; this.readyState=1; this.listeners=new Map(); this.sent=[]; }
      addEventListener(type, fn) { const set=this.listeners.get(type)||new Set(); set.add(fn); this.listeners.set(type,set); }
      removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
      send(payload) { this.sent.push(JSON.parse(payload)); }
      close() { this.readyState=3; }
      emit(message) { for (const fn of this.listeners.get('message')||[]) fn({data:JSON.stringify(message)}); }
      count(type) { return this.listeners.get(type)?.size||0; }
    }
    const sockets=[];
    function socket(name) { const value=new FixtureSocket(name); sockets.push(value); return value; }
    function authorize(value) {
      installProductSendCapability({ socket: value, generation: 'fixture-generation', isAuthenticated: () => true,
        captureBinding: workspaceId => ({workspaceId,workspaceEpoch:'fixture-epoch',bindingRevision:1,bindingSerial:1}),
        isBindingCurrent: binding => binding.workspaceId === 'fixture-workspace',
        sendProductResult: (serialized, policy, current) => { if (!current()) return {status:'not_enqueued',reason:'stale_binding'}; value.send(serialized); return {status:'enqueued',transport:'socket'}; } });
    }
    const first=socket('first'); authorize(first);
    useWorkspaceStore.setState({activeWorkspaceId:'fixture-workspace',workspaceEpoch:'fixture-epoch',bindingRevision:1,bindingSerial:1,hasReceivedInit:true});
    const row=(threadId, groupId, viewId, overrides={})=>({threadId,threadGroupId:groupId,workspaceId:'fixture-workspace',viewId,
      currentPrimaryThreadId:threadId,currentPrimarySequence:1,memberCount:1,createdAt:1,updatedAt:1,
      entry:{name:threadId,createdAt:'2026-01-01T00:00:00.000Z',messageCount:0,status:'active',harnessId:'opencode',harnessConfig:{}},...overrides});
    const openedFrame=(threadId,extra={})=>({type:'thread:opened',threadId,threadGroupId:'group-a',workspaceId:'fixture-workspace',
      viewId:'capture-viewer',panel:'panel-a',scope:'project',thread:row(threadId,'group-a','capture-viewer').entry,
      history:[],exchanges:[],liveTurn:null,contextUsage:null,...extra});
    const empty=()=>({messages:[],currentTurn:null,pendingTurnEnd:false,pendingPromptAcceptance:null,retryPromptDraft:null,
      pendingMessage:null,segments:[],lastReleasedSegmentCount:0,pendingSavedExchanges:{},pendingExchangeSaveTurnId:null,todoDrawer:undefined,activity:null});
    const movedGroup=row('thread-b','group-a','capture-viewer',{currentPrimaryThreadId:'thread-b',currentPrimarySequence:2,memberCount:2});
    const otherGroup=row('thread-c','group-c','wiki-viewer');
    const movedMembers=[
      {threadId:'thread-a',ordinal:1,isPrimary:false,createdAt:1,label:'thread-a',placementDisposition:'open'},
      {threadId:'thread-b',ordinal:2,isPrimary:true,createdAt:2,label:'thread-b',placementDisposition:'open'},
    ];
    const movedEntry={schemaVersion:1,adapterId:'capture-viewer',adapterVersion:1,contentRevision:'content-r1',placementRevision:'placement-r2',
      updatedAt:'2026-01-01T00:00:00.000Z',content:null,managedComponentPlacements:{'side-placement-a':{
        placementId:'side-placement-a',disposition:'open',updatedAt:'2026-01-01T00:00:00.000Z',descriptor:{schemaVersion:1,
          componentTypeId:'fusion.chat-surface',componentInstanceId:'chat-side:side-placement-a',targetKey:'side-placement-a',
          input:{workspaceId:'fixture-workspace',viewId:'capture-viewer',threadGroupId:'group-a',threadId:'thread-a',host:'side-tab'}}}}};
    usePanelStore.setState({activeWorkspaceId:'fixture-workspace',currentPanel:'capture-viewer',currentThreadId:'thread-b',chatActive:true,ws:first,
      threads:[movedGroup,otherGroup],
      projectChats:{'thread-a':empty(),'thread-b':empty(),'thread-c':empty()},viewStates:{},contextUsageByThread:{},tokenUsageByThread:{},wireReadyByThread:{},
      harnessSelectionByThread:{},threadGroupsByWorkspaceAndView:{'fixture-workspace':{'capture-viewer':[movedGroup],'wiki-viewer':[otherGroup]}},
      currentThreadGroupIdByWorkspaceAndView:{'fixture-workspace':{'capture-viewer':'group-a','wiki-viewer':'group-c'}},
      threadMembersByGroup:{'fixture-workspace::group-a':movedMembers},
      sideChatActivePlacementByView:{'fixture-workspace::capture-viewer':'side-placement-a'},
      worksurfaceEntries:{'fixture-workspace::capture-viewer::group-a':movedEntry},
      legacyThreadGroupsByWorkspaceId:{},currentLegacyThreadGroupIdByWorkspaceId:{}});
    installChatActionConsumer();
    let root=createRoot(document.querySelector('#root'));
    function LifetimeHost() { return React.createElement(ChatSessionHost,{panel:'panel-a',workspaceId:'fixture-workspace',viewId:'capture-viewer',threadGroupId:'group-a',threadId:'thread-b',host:'main'}); }
    const descriptor=(instanceId,threadId,groupId,viewId,host)=>({schemaVersion:1,componentTypeId:'fusion.chat-surface',componentInstanceId:instanceId,
      input:{workspaceId:'fixture-workspace',viewId,threadGroupId:groupId,threadId,host}});
    function DiagnosticHost() { return React.createElement(ChatSurfaceComponentMount,
      {descriptor:descriptor('diagnostic-instance','thread-b','group-a','capture-viewer','main')}); }
    function MountMatrix() { return React.createElement('div',null,
      React.createElement('div',{id:'same-visible'},React.createElement(ChatSessionHost,{panel:'same-visible',workspaceId:'fixture-workspace',threadId:'thread-a',threadGroupId:'group-a',viewId:'capture-viewer',expectedPrimarySequence:2,host:'main'})),
      React.createElement('div',{id:'same-inactive','data-mounted-state':'inactive'},React.createElement(ChatSessionHost,{panel:'same-inactive',workspaceId:'fixture-workspace',threadId:'thread-a',threadGroupId:'group-a',viewId:'capture-viewer',expectedPrimarySequence:2,host:'main',isActive:false})),
      React.createElement('div',{id:'moved-primary','data-group-id':'group-a','data-primary-thread-id':'thread-b'},React.createElement(ChatSurfaceComponentMount,{descriptor:descriptor('primary-instance','thread-b','group-a','capture-viewer','main')})),
      React.createElement('div',{id:'other-view'},React.createElement(ChatSurfaceComponentMount,{descriptor:descriptor('other-instance','thread-c','group-c','wiki-viewer','main')})),
      React.createElement('div',{id:'side-after-move','data-placement':'side-placement-a','data-group-id':'group-a','data-side-thread-id':'thread-a'},React.createElement(ChatSurfaceComponentMount,{descriptor:descriptor('chat-side:side-placement-a','thread-a','group-a','capture-viewer','side-tab')}))); }
    root.render(React.createElement(LifetimeHost));
    window.__archObs={
      dispatch: async action => {
        if(action.target !== 'current' || action.delivery !== 'insert') return dispatchChatAction(action);
        const owner=Object.values(usePanelStore.getState().mountedChats).find(owner=>owner.threadId===action.address.threadId && owner.host==='side-tab');
        const begun=beginChatMaterial(owner??null);
        return begun.status==='ready' ? commitChatMaterial(begun.operation, action.attachment ? {attachment:action.attachment} : {text:action.content}) : begun;
      },
      rawDispatch:dispatchChatAction,
      sent:()=>sockets.map(item=>({name:item.name,sent:item.sent.slice()})),
      listenerCounts:()=>sockets.map(item=>({name:item.name,message:item.count('message'),readyState:item.readyState})),
      emit:(index,message)=>sockets[index].emit(message),
      openedFrame,
      close:(index)=>sockets[index].close(),
      unmount:()=>root.unmount(),
      remountLifetime:()=>{root=createRoot(document.querySelector('#root'));root.render(React.createElement(LifetimeHost));},
      mountDiagnostic:()=>{root.unmount();root=createRoot(document.querySelector('#root'));root.render(React.createElement(DiagnosticHost));},
      reconnect:()=>{const next=socket('reconnected');authorize(next);usePanelStore.setState({ws:next});return sockets.length-1;},
      mountMatrix:()=>{root.unmount();root=createRoot(document.querySelector('#root'));root.render(React.createElement(MountMatrix));},
      setIndicatorState:(mode)=>{
        useChatSubmissionStore.getState().clearSession('fixture-workspace','thread-b');
        if(mode==='acceptance') useChatSubmissionStore.getState().begin({workspaceId:'fixture-workspace',threadId:'thread-b',requestId:'r9-request',text:'fixture prompt',draftRevision:1,attachmentIds:[],attachmentGenerations:{},phase:'pending'});
        const chat=empty();
        if(mode==='acceptance') chat.pendingPromptAcceptance={text:'fixture prompt',composerText:'fixture draft',workspaceId:'fixture-workspace',attachmentIds:[]};
        if(mode==='finalizing') chat.pendingTurnEnd=true;
        if(mode==='activity') {
          chat.currentTurn={id:'r9-turn',content:'',status:'streaming',hasThinking:false,thinkingContent:''};
          chat.activity={kind:'working',turnId:'r9-turn',identity:'fixture-step',startedAt:1,activityRevision:1};
        }
        usePanelStore.setState((state)=>({projectChats:{...state.projectChats,'thread-b':chat}}));
        useChatComposerDraftStore.getState().setDraft('fixture-workspace','thread-b','fixture draft');
      },
      setDiagnosticState:()=>{
        const chat=empty();
        chat.messages=[{id:'diagnostic-message',type:'assistant',content:'',timestamp:1,
          segments:[{type:'text',content:'partial output',complete:true}],
          metadata:{turnId:'diagnostic-turn',terminalError:{kind:'runtime',code:'MODEL_RESPONSE_FAILED',
            message:'The model response failed before it completed.',recoverable:true,diagnosticId:'diagnostic-id'}}}];
        usePanelStore.setState((state)=>({projectChats:{...state.projectChats,'thread-b':chat}}));
      },
      resolveDiagnostic:()=>handleChatDiagnosticReportFrame({type:'chat-turn:diagnostic:report',threadId:'thread-b',
        turnId:'diagnostic-turn',diagnosticId:'diagnostic-id',report:{version:1,harnessId:'opencode',category:'runtime',
          message:'redacted deterministic diagnostic',stderrExcerpt:'redacted deterministic stderr',
          hadRenderableOutput:true,hadToolCalls:false,truncatedFields:[]}}),
      indicatorState:()=>{
        const chat=usePanelStore.getState().projectChats['thread-b'];
        return {
          pendingPromptAcceptance:chat?.pendingPromptAcceptance!=null,
          pendingTurnEnd:chat?.pendingTurnEnd??false,
          pendingExchangeSaveTurnId:chat?.pendingExchangeSaveTurnId??null,
          currentTurnId:chat?.currentTurn?.id??null,
          currentTurnStatus:chat?.currentTurn?.status??null,
          activityTurnId:chat?.activity?.turnId??null,
          activityRevision:chat?.activity?.activityRevision??null,
        };
      },
      postMoveFacts:()=>{
        const state=usePanelStore.getState();
        const group=state.threadGroupsByWorkspaceAndView['fixture-workspace']['capture-viewer'][0];
        const members=state.threadMembersByGroup['fixture-workspace::group-a'];
        const entry=state.worksurfaceEntries['fixture-workspace::capture-viewer::group-a'];
        return {threadGroupId:group.threadGroupId,currentPrimaryThreadId:group.currentPrimaryThreadId,
          currentPrimarySequence:group.currentPrimarySequence,memberCount:group.memberCount,
          selectedGroupId:state.currentThreadGroupIdByWorkspaceAndView['fixture-workspace']['capture-viewer'],
          memberThreadIds:members.map((member)=>member.threadId),primaryMembers:members.filter((member)=>member.isPrimary).map((member)=>member.threadId),
          activePlacementId:state.sideChatActivePlacementByView['fixture-workspace::capture-viewer'],
          durablePlacement:entry.managedComponentPlacements['side-placement-a']};
      },
      drafts:()=>useChatComposerDraftStore.getState().draftsByOwner,
      draftRevisions:()=>useChatComposerDraftStore.getState().revisionsByOwner,
      attachments:()=>useChatFileLinkStore.getState().pendingAttachmentsByOwner,
      setUnknownAttempt:(threadId)=>{
        const workspaceId='fixture-workspace';
        const requestId='unknown-fixture-'+threadId;
        const store=useChatSubmissionStore.getState();
        store.begin({workspaceId,threadId,requestId,text:'earlier request',draftRevision:0,
          attachmentIds:[],attachmentGenerations:{},phase:'pending'});
        store.unknown(workspaceId,threadId,requestId);
      },
      selectPanel:(panel)=>usePanelStore.setState({currentPanel:panel}),
    };
  `;
  const output = await build({
    configFile: false, logLevel: 'silent',
    plugins: [{ name: 'chat-architecture-observation', enforce: 'pre', resolveId(id) { return id === entry ? resolved : null; },
      load(id) { return id === resolved ? source : null; } }],
    build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'iife', name: 'ChatArchitectureObservation' } } },
  }) as { output: Array<{ type: string; code?: string }> };
  const chunk = output.output.find((item) => item.type === 'chunk' && item.code);
  if (!chunk?.code) throw new Error('observation harness did not build');
  return chunk.code;
}

async function mount(page: Page) {
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await bundlePromise });
  await expect(page.locator('.rv-chat-area')).toHaveCount(1);
}

test('F4 duplicate session mounts and two sessions/views retain separate transient surfaces in visible and inactive mounted states', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window as any).__archObs.mountMatrix());
  await expect(page.locator('.rv-chat-area')).toHaveCount(5);
  await expect(page.locator('#same-visible .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'thread-a');
  await expect(page.locator('#same-inactive .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'thread-a');
  await expect(page.locator('#same-inactive')).toHaveAttribute('data-mounted-state', 'inactive');
  await expect(page.locator('#moved-primary .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'thread-b');
  await expect(page.locator('#moved-primary .rv-chat-area')).toHaveAttribute('data-chat-view-id', 'capture-viewer');
  await expect(page.locator('#other-view .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'thread-c');
  await expect(page.locator('#other-view .rv-chat-area')).toHaveAttribute('data-chat-view-id', 'wiki-viewer');
  await expect(page.locator('#side-after-move')).toHaveAttribute('data-placement', 'side-placement-a');
  await expect(page.locator('#side-after-move .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'thread-a');
  await expect(page.locator('#side-after-move .rv-chat-area')).toHaveAttribute('data-chat-host', 'side-tab');
  expect(await page.evaluate(() => (window as any).__archObs.postMoveFacts())).toEqual({
    threadGroupId: 'group-a', currentPrimaryThreadId: 'thread-b', currentPrimarySequence: 2,
    memberCount: 2, selectedGroupId: 'group-a', memberThreadIds: ['thread-a', 'thread-b'], primaryMembers: ['thread-b'],
    activePlacementId: 'side-placement-a', durablePlacement: {
      placementId: 'side-placement-a', disposition: 'open', updatedAt: '2026-01-01T00:00:00.000Z',
      descriptor: { schemaVersion: 1, componentTypeId: 'fusion.chat-surface', componentInstanceId: 'chat-side:side-placement-a',
        targetKey: 'side-placement-a', input: { workspaceId: 'fixture-workspace', viewId: 'capture-viewer', threadGroupId: 'group-a',
          threadId: 'thread-a', host: 'side-tab' } },
    },
  });
  const ids = await page.locator('.rv-chat-area').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-surface-id')));
  expect(new Set(ids).size).toBe(5);
});

test('R9 indicator states distinguish prompt acceptance, turn finalization, active work, idle, and a blocked renderer', async ({ page }) => {
  await mount(page);
  const states: Array<Record<string, unknown>> = [];
  const capture = async (label: string) => {
    await page.waitForTimeout(0);
    states.push(await page.evaluate((stateLabel) => {
      const composer = document.querySelector<HTMLTextAreaElement>('.rv-chat-input');
      return {
        label: stateLabel,
        observedAt: performance.now(),
        store: (window as any).__archObs.indicatorState(),
        composerDisabled: composer?.disabled ?? null,
        warming: document.querySelectorAll('button[title="Connecting thread runtime"] .rv-send-warming-wheel').length,
        completing: document.querySelectorAll('.rv-chat-completing-indicator').length,
        stop: document.querySelectorAll('button[title="Stop generating"]').length,
        send: document.querySelectorAll('button[title="Send message"]').length,
        assistantActivity: document.querySelectorAll('.rv-message-assistant').length,
      };
    }, label));
  };

  await page.evaluate(() => (window as any).__archObs.setIndicatorState('acceptance'));
  await expect(page.locator('.rv-chat-input')).toBeDisabled();
  await expect(page.locator('button[title="Connecting thread runtime"] .rv-send-warming-wheel')).toHaveCount(1);
  await expect(page.locator('.rv-chat-completing-indicator')).toHaveCount(0);
  await capture('prompt-acceptance');

  await page.evaluate(() => (window as any).__archObs.setIndicatorState('finalizing'));
  await expect(page.locator('.rv-chat-input')).toBeDisabled();
  await expect(page.locator('.rv-chat-completing-indicator')).toHaveCount(1);
  await expect(page.locator('button[title="Connecting thread runtime"]')).toHaveCount(0);
  await capture('turn-finalization');

  await page.evaluate(() => (window as any).__archObs.setIndicatorState('activity'));
  await expect(page.locator('.rv-chat-input')).toBeEnabled();
  await expect(page.locator('button[title="Stop generating"]')).toHaveCount(1);
  await expect(page.locator('.rv-message-assistant')).toHaveCount(1);
  await expect(page.locator('.rv-chat-completing-indicator')).toHaveCount(0);
  await capture('active-work');

  await page.evaluate(() => (window as any).__archObs.setIndicatorState('idle'));
  await expect(page.locator('.rv-chat-input')).toBeEnabled();
  await expect(page.locator('button[title="Send message"]')).toHaveCount(1);
  await capture('idle');

  const blockedRenderer = await page.evaluate(() => {
    const composer = document.querySelector<HTMLTextAreaElement>('.rv-chat-input');
    const disabledBefore = composer?.disabled ?? null;
    const startedAt = performance.now();
    while (performance.now() - startedAt < 75) { /* deterministic main-thread block */ }
    return {
      label: 'blocked-renderer',
      startedAt,
      endedAt: performance.now(),
      composerDisabledBefore: disabledBefore,
      composerDisabledAfter: composer?.disabled ?? null,
    };
  });
  expect(blockedRenderer.endedAt - blockedRenderer.startedAt).toBeGreaterThanOrEqual(75);
  expect(blockedRenderer.composerDisabledBefore).toBe(false);
  expect(blockedRenderer.composerDisabledAfter).toBe(false);

  const evidence = {
    caseId: 'R9-INDICATOR-DISTINCTION',
    status: 'passed',
    states,
    blockedRenderer,
    requestIdentityAvailable: true,
    requestIdentityBoundary: 'session-owned correlated submission attempt',
    distinction: 'disabled-state indicators are DOM/state claims; a blocked renderer is measured wall time while the composer remains enabled',
    contentCaptured: false,
  };
  const evidenceRoot = process.env.FUSION_CHAT_ARCH_EVIDENCE_ROOT;
  if (evidenceRoot) fs.writeFileSync(path.join(evidenceRoot, 'r9-result.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
});

test('R5 current action owner inserts once across duplicate mounts and reports send pending', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window as any).__archObs.mountMatrix());
  await expect(page.locator('.rv-chat-area')).toHaveCount(5);
  const observed = await page.evaluate(async () => {
    const fixture = (window as any).__archObs;
    const address = { workspaceId: 'fixture-workspace', viewId: 'capture-viewer',
      threadGroupId: 'group-a', threadId: 'thread-a' };
    fixture.selectPanel('wiki-viewer');
    const inserted = await fixture.dispatch({ content: 'exact insertion', target: 'current', delivery: 'insert', address });
    const revisions = fixture.draftRevisions();
    const drafts = fixture.drafts();
    const sent = await fixture.dispatch({ content: 'exact send', target: 'current', delivery: 'send',
      address: { ...address, threadId: 'thread-b' } });
    const prompts = fixture.sent().flatMap((socket: any) => socket.sent).filter((frame: any) => frame.type === 'prompt');
    return { inserted, sent, prompts,
      draftA: drafts[JSON.stringify(['fixture-workspace', 'thread-a'])],
      revisionA: revisions[JSON.stringify(['fixture-workspace', 'thread-a'])],
      draftC: drafts[JSON.stringify(['fixture-workspace', 'thread-c'])] ?? null };
  });
  expect(observed.inserted.status).toBe('applied');
  expect(observed.draftA).toBe('exact insertion');
  expect(observed.revisionA).toBe(1);
  expect(observed.draftC).toBeNull();
  expect(observed.sent.status).toBe('pending');
  expect(observed.prompts).toHaveLength(1);
  expect(observed.prompts[0]).toMatchObject({ threadId: 'thread-b', user_input: 'exact send', requestId: observed.sent.requestId });
});

test('R5 unknown attempt permits exact insert and attachment while blocking resend', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window as any).__archObs.mountMatrix());
  await expect(page.locator('.rv-chat-area')).toHaveCount(5);
  const observed = await page.evaluate(async () => {
    const fixture = (window as any).__archObs;
    const address = { workspaceId: 'fixture-workspace', viewId: 'capture-viewer',
      threadGroupId: 'group-a', threadId: 'thread-a' };
    fixture.setUnknownAttempt('thread-a');
    fixture.selectPanel('wiki-viewer');
    const insert = await fixture.dispatch({ content: 'newer editable text', target: 'current', delivery: 'insert', address });
    const attach = await fixture.dispatch({ attachment: { id: 'exact-file-link', kind: 'file',
      label: 'file', path: '/fixture/file.md', sourceName: 'fixture', panel: 'capture-viewer' },
      target: 'current', delivery: 'insert', address });
    const send = await fixture.dispatch({ content: 'forbidden resend', target: 'current', delivery: 'send', address });
    const prompts = fixture.sent().flatMap((socket: any) => socket.sent).filter((frame: any) => frame.type === 'prompt');
    return { insert, attach, send, prompts,
      draft: fixture.drafts()[JSON.stringify(['fixture-workspace', 'thread-a'])],
      siblingDraft: fixture.drafts()[JSON.stringify(['fixture-workspace', 'thread-c'])] ?? null,
      attachments: fixture.attachments()[JSON.stringify(['fixture-workspace', 'thread-a'])]?.attachments ?? [],
      siblingAttachments: fixture.attachments()[JSON.stringify(['fixture-workspace', 'thread-c'])]?.attachments ?? [] };
  });
  expect(observed.insert.status).toBe('applied');
  expect(observed.attach.status).toBe('applied');
  expect(observed.draft).toBe('newer editable text');
  expect(observed.attachments).toHaveLength(1);
  expect(observed.attachments[0]).toMatchObject({ id: 'exact-file-link', path: '/fixture/file.md' });
  expect(observed.send).toMatchObject({ status: 'failed', reason: 'busy' });
  expect(observed.prompts).toHaveLength(0);
  expect(observed.siblingDraft).toBeNull();
  expect(observed.siblingAttachments).toHaveLength(0);
});

test('R5 diagnostic Ask AI retrieves through the actual handler and appends without sending a prompt', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window as any).__archObs.mountDiagnostic());
  await page.evaluate(() => (window as any).__archObs.setDiagnosticState());
  const textarea = page.locator('.rv-chat-input');
  const view = page.getByRole('button', { name: 'View', exact: true });
  const askAI = page.getByRole('button', { name: 'Ask AI', exact: true });
  await expect(view).toBeVisible();
  await expect(askAI).toBeVisible();
  await textarea.fill('PRESERVED-DRAFT');

  await view.click();
  await expect.poll(() => page.evaluate(() => {
    const frames = (window as any).__archObs.sent().flatMap((item: any) => item.sent);
    return frames.filter((frame: any) => frame.type === 'chat-turn:diagnostic:get').length;
  })).toBe(1);
  await page.evaluate(() => (window as any).__archObs.resolveDiagnostic());
  await expect(page.locator('.rv-chat-diagnostic-report')).toContainText('redacted deterministic diagnostic');

  const sentBeforeAsk = await page.evaluate(() => (window as any).__archObs.sent().flatMap((item: any) => item.sent));
  await askAI.click();
  await expect(textarea).toHaveValue(/^PRESERVED-DRAFT\n\n/);
  await expect(textarea).toHaveValue(/redacted deterministic diagnostic/);
  await expect(page.locator('.rv-chat-diagnostic-status')).toHaveText('Diagnostic added to the composer for review.');
  const sentAfterAsk = await page.evaluate(() => (window as any).__archObs.sent().flatMap((item: any) => item.sent));
  expect(sentAfterAsk.filter((frame: any) => frame.type === 'prompt')).toHaveLength(0);
  expect(sentAfterAsk.filter((frame: any) => frame.type === 'chat-turn:diagnostic:get')).toHaveLength(
    sentBeforeAsk.filter((frame: any) => frame.type === 'chat-turn:diagnostic:get').length,
  );

  const evidenceRoot = process.env.FUSION_CHAT_ARCH_EVIDENCE_ROOT;
  if (evidenceRoot) fs.writeFileSync(path.join(evidenceRoot, 'r5-diagnostic-boundary.json'), `${JSON.stringify({
    caseId: 'R5-DIAGNOSTIC-APPEND', status: 'passed', diagnosticGets: 1,
    existingDraftPreserved: true, appendedThroughActualComposerCallback: true,
    promptFramesAfterAsk: 0, privateContentRecorded: false,
  }, null, 2)}\n`, { flag: 'wx' });
});

test('R5 diagnostic Ask AI appends after an unknown attempt without resending', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => (window as any).__archObs.mountDiagnostic());
  await page.evaluate(() => (window as any).__archObs.setDiagnosticState());
  const textarea = page.locator('.rv-chat-input');
  await textarea.fill('PRESERVED-DRAFT');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__archObs.sent()
    .flatMap((item: any) => item.sent).filter((frame: any) => frame.type === 'chat-turn:diagnostic:get').length)).toBe(1);
  await page.evaluate(() => (window as any).__archObs.resolveDiagnostic());
  await expect(page.locator('.rv-chat-diagnostic-report')).toContainText('redacted deterministic diagnostic');
  await page.evaluate(() => (window as any).__archObs.setUnknownAttempt('thread-b'));
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(textarea).toHaveValue(/^PRESERVED-DRAFT\n\n/);
  await expect(textarea).toHaveValue(/redacted deterministic diagnostic/);
  await expect(page.locator('.rv-chat-diagnostic-status')).toHaveText('Diagnostic added to the composer for review.');
  const prompts = await page.evaluate(() => (window as any).__archObs.sent()
    .flatMap((item: any) => item.sent).filter((frame: any) => frame.type === 'prompt'));
  expect(prompts).toHaveLength(0);
});

test('retired address-only current insert rejects without mutation or source work', async ({page}) => {
  await mount(page);
  const observed=await page.evaluate(async()=>{const f=(window as any).__archObs; const before=f.drafts();
    const result=await f.rawDispatch({target:'current',delivery:'insert',content:'FORBIDDEN',address:{workspaceId:'fixture-workspace',viewId:'capture-viewer',threadGroupId:'group-a',threadId:'thread-b'}});
    return {result,before,after:f.drafts(),sent:f.sent()};});
  expect(observed.result).toEqual({status:'failed',reason:'unsupported'}); expect(observed.after).toEqual(observed.before);
  expect(observed.sent.flatMap((s:any)=>s.sent).filter((f:any)=>f.type==='prompt')).toHaveLength(0);
});
