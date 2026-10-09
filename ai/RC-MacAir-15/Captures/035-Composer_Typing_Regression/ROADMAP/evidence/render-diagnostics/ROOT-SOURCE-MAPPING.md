# Root independent source mapping before implementation

Date2026-09-27; root /Users/rccurtrightjr./projects/fs-dev verified, branchagent/exact-workspace-paths dirtyownerworktreepreserved. No productedits byroot.

- LiveSegmentRenderer samefile pipeline retains completioneffect; currentstepWorking originally requires activity+allsegmentsrevealed, and orbdisposes on firstoutput/step. This misses withinsegment parserwait. Its surface-local reveal phase mustown visiblewait eligibility, while existing canonicalsteptransport remains unchanged.
- WorkingActivity originally uses serverstepstartedAt,1Hz timestampdelta. Newaccepted2s policy changes displaytimebasis to localvisiblewait; existing accessibleHourglass canbereused.
- text/text-animate: contentRef,cursor,parseTextChunks blocks,buffer,visiblechars. Emptyblocks+incomplete sleeps30ms. Speedpicked onceperblock; existinginterblock/intersegmentpauses. Passivehooks mustnotcreateaflush/changeanydelay. Sourcecursor advancescompletedblock only, whileHTMLvisiblecountdiffersfromsource.
- reveal/orchestrator: tool contentfedlength,readybuffer,transformedtext,displayedlength,localchunkbatch/line-enddeceleration; existing150mspartialflush and30mspoll preserved. Deterministicschedulinginputs donotmean actualwalltimeexact.
- tool-animate: awaitsResult existing10stimeout/30mspoll; callbackwaitingstatehere isnecessaryfor toolwaitacknowledgement. Subagentbypass separate.
- ChatAreaHeader owns event_list sharedmenu. ConnectedChatHeader/useChatSessionActions/chatSurfaceContract ownexplicitactionprops. Diagnostics canbeclientpresentationactionwithoutproviderintent.
- viewTabAdapters.useViewTabAdapter applies nativeadapters then useSideChatRailAdapter. Diagnosticscomposition mustappendafterboth. GenericHostresolver canhostfirstpartydiagnostics. sideChatBridge's adapterlessrootpattern preservesexistingviewchildwhenacontenttabexists. Preserve native+side handlers ratherthanstealtheiractiveowner.
- DiagnosticsfromaSideChatmayunmountthatChatSurfacewhencontenttabchanges. Markrenderobservationunavailable/lastknown, do notintroducehiddenrenderingorsecondfinalizationowner.
- stream-handlers owns canonicalexactthread/turn/streamSeqroutegate and contiguousapplication. Captureatacceptedapplicationpointbeforeformat/group, notrawWebSocketarrival whichincludesduplicates/outoforder. Existingerrorretrieval staysseparate.
- OpenCodeadapter hasnativeJSONeventsbeforetranslation; canonical thinking istypedseparately, literal<thinking>notguaranteed. Historical provisional canonical default superseded by explicit owner approval: copy original native events before translation; no false byte-exact stdout claim.
- existing e2e/working-activity.spec.ts/support/working-activity-working-cases includesoldstepage,stalesnapshot/nonresurrectionUIclaims. Toldbuilder update affectedeligibility/timebasis oracles whilekeepingtransportrevisioninvariants.

Readactivecode-standards hub fully plusArchitectureRouting,FrontendUI,StateManagement,TestingAndSmoke. RelevantChatOverview read; established lifecycleinspection from previousacceptedwork retained. Furthernew surfaces require correspondingstandards, recorded bybuilderandrootinspection.

No full-providerlatency guarantee. No pacingchangeauthorized; no currenthumanappactivation.


Nativefeed feasibility: OpenCodeHarness.sendMessage creates one JsonLineParser and one childprocess; proc.stdout data feedsparser; parser messagecallback receivesparsednativeevent before translator.translate. Observing there can copy events without invoking sendMessage/spawn again. Existing parser parseLine strips framing whitespace and emits parsedobject only, so serializednativeevents preserveeventfields but are notbyteexactstdout unless original line is added as diagnosticmetadata. Keepnativeprotocolopaque withinadapter/diagnostictransport; neveremitrawproviderprotocol onUEB. Existing turnruntime drainroutecontext supplies immutableworkspace/thread/turn identity. Any diagnostic subscription must be exactowner and notbackpressure thedrain orbind to globallyselectedchat. Native feed is now explicitly owner-approved in RD-02-CONTRACT.md; fresh RD-02 builder dispatched after RD-01 acceptance.

Root RD-02 preimplementation integration inspection: stored report retrieval is persisted closed-shape and ID-only, so native streaming needs a separate generic diagnostic subscription owner and protocol. Existing per-connection router/binding lease governs cleanup and scope. Original native payload is opaque observation only under RD-NATIVE-1. Async configured-secret lookup/redaction must remain bounded and independent of canonical iteration, and late fulfillment must not repopulate a replacement turn.
