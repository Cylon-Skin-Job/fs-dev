# B17 — agent-operated post-warmup native foreground handoff

Prelaunch packet; no runtime. Explicit owner autonomous-completion/supervisor authority replaces the earlier human-only B17 plan, which was held before edits/tests/runtime. Sole boundedfixturewriter; unrelateddirtywork preserved. Frozen1950source SHA256c8a51100d94732a93608518f9c60c1697c3463c52a2f341d0cfc7aca32b8affc/build200unchanged SHA2566c06602b58f8dc0e4a9b1ed6588c5670b8e628b21044040a581e9e9d55f05234. B17-IDENTITY files/B17-CHANGED-PATHS exact4paths(2modified2new); B17-BEFORE/MANIFEST exact2predecessors savedbeforeedit.

## Coordination interface

Opt-in `FUSION_CHAT_ARCH_POST_WARMUP_FOREGROUND_MS=120000`; default0preservesB16automaticfinal5sgate. Only0/120000accepted; lifecycle-only rejectsnonzero. Existinginitial FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS=120000 remains setup-only, with original FOREGROUND_READY marker/acquisitionreceipt; builder relays as INITIAL_OWNER_FOREGROUND phase, no sharedhelperchange. FinalmanualMS0/nativeManualenvabsent.

AfterALLdense/lifecycle/dialog/draftwarmup, before B16finalbootstrap/full45ssettle/baseline: newhelper resolves exactBrowserWindowhandlefromruntime.page, validates runtimePID and exactwindowURL, sets unmistakabletitle `ISOLATED SOAK HANDOFF — <runId>`, then persists `rawrun/post-warmup-foreground-result.json` and emits `POST_WARMUP_READY` beforepolling. Receiptcontains operatoragent/statuswaiting/runId/pid/windowId/title/profile/workspace/startedAt/deadlineAt. Deadline120000ms includesallnativequeries; hungqueryboundedbyremainingtime. No otherwindowinventory/reselection, noapp/windowfocus/show/moveTop/bringToFront/inputcall orpointerobserver. Title setup occursbeforeREADY. Supervisor ownsseparate exactPID/windowCUAactionreceipt; click is notnativefocusproof orowneracceptance.

The passpredicate requires2s continuous actualnative app.isActive ANDwindow.isFocused/visible/unminimized/notappHidden. Transientfalse resetsstability. No pointerrequirement becauseactivationclickmaynotreachrenderer. Durableacquiredreceipt and stdout `POST_WARMUP_ACQUIRED` emittedimmediately onpass; timeout/queryfailure saveslastcompletedstate/time/count/deadline and emits `POST_WARMUP_FAILED` beforeoriginalerrorrethrow. Failedreceiptwritecannotreplaceoriginalfailure and isflaggedinstdout. Pre-READY identity/setup errors propagate toouterexistingsoakfailure/cleanup (no falseREADY orvalidtargetclaim). No furtheractivationafterwaitstarts or duringmeasurement.

Successfulcallback resumes UNCHANGEDB16 SAMEdocumentorderedexistingcapture→updated→request→data revalidation plus NEW500msquiet againstcontinuingtrafficSequence, thenFULL45ssettle/baseline and unchanged45minute/input/focus/traffic/render/resourcegates. Earlierinitialacquisition is notfinalreadiness. Agentlabel coverssetupinput only; ownerAcceptancefalse explicit.

## Acceptance / deviation

SPEC06/06B requires “Execute VALIDATION short idle/streaming and five-minute probes followed by the 45-minute workload” and says missingnativecapability/ownerresponse leavesacceptancepending. B16actualSOAK02finalnativefocus48attemptsfailedbeforefinalbootstrap/settle/input; no causalactorproven. B17addsboundedexplicitexactwindowhandoff, not a focuswaiver orcausalproductfix.

Changedpaths: newsoak-foreground-handoff.mjs nativewait/receipt; newtestmodule; soak-electron.mjs envguard andfinalcallbackbranch; run.mjs addshelperprovenanceonly. No sharedmeasurement/helper/product/build/provider/dependency changes. Proposedclassification acceptedboundedfixturecoordinationintegration. Rootclassificationreserved. Risk: CUAmaynotestablishnativefocus; timeout/queriesfailclosed withcleanup. Nativeappavailabilityneverinvented. No dialogcauseclaim/cacheclear/reset/thresholdrelaxation. Temporaryhandoffretirement whensoakfixture no longerrequirescoordinatedforeground; notproductfeature. Downstream06C remainsbarredpendingall06Bacceptance.

## Checks / self-review / selective evidence

Finalcommand `node --test fusion-studio-client/e2e/chat-architecture/soak-foreground-handoff.test.mjs fusion-studio-client/e2e/chat-architecture/soak-preparation.test.mjs fusion-studio-client/e2e/chat-architecture/soak-resources.test.mjs fusion-studio-client/e2e/chat-architecture/owned-focus-observation.test.mjs fusion-studio-client/e2e/chat-architecture/observation-contract.test.mjs`; b17-unit-02.log23pass/0skip507.879625ms. Initialb17-unit-01passed; no redB17checks.

Newtests independentlyrejectinactiveapp/focusfalse/invisible/minimized/hidden; prove2sstabilitywithoutpointer, resetaftertransientinactivity, originalqueryfailure+laststatepreservation, hungquerydeadline, exactownedidentityandREADYpersist-beforepoll ordering, agent/noownerclaims, durableACQUIRED/FAILED markers, optinonlyfinalcallbackafterwarmup/nohiddenfocuscalls. ExistingB16bootstrap/quiet/doc/45s/resource/transientfocus/fixtureinventories stillpass. Selfreview added remainingdeadline boundaroundnativequery so a hungcallcannot silentlyextend120s. No browser/Electron/build/tests touchingliveprofile requiredforpurefixturelogic; actualrequiredsoak pendinggates/GO.

VRENDER03 remains selectivelyvalid: actualrendercases/sharedhelpers/product/build untouched; oldrunmanifest containschangedsoak/runprovenance so notallhistoricalentriesmatchnewB17. B16test/measurementownersunchanged. Full45min stillnotrun; SOAK01/02failureproof retained. NativeIME/Palette/autocomplete/explicitownersymptomreceipt remainseparate.

## Required launch coordination

Freshbuilderreadonlyreview+rootfreshreview thenfreshunlocked/exactownedlane/hashpreflight andsupervisorCUAready/imminentnotice/rootGO. Proposedoneactualruncommand: `FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS=120000 FUSION_CHAT_ARCH_POST_WARMUP_FOREGROUND_MS=120000 FUSION_CHAT_ARCH_POST_SOAK_MANUAL_MS=0 /usr/bin/caffeinate -d node fusion-studio-client/e2e/chat-architecture/run.mjs --suite soak --duration-ms 2700000 --mode enforce`. Relayexecution sessionId/fullstdoutpath/rawreceipt/runidentityimmediately; READY andACQUIRED/FAILED immediately to root/supervisor sooperator avoids lateclick. Initialacquisitionmarker also relayed; receiverchecksreceiptstatusbeforeaction. No final3/10minmanualwindow; no nativefollowonuntilaftersoakcoordination. Hard55minactualcase, exactownedcleanup; protectpersistentPID55084. Newownerhandoffauthoritysupersedes earlier01:44deadline; no unboundedabsenceassumption.

Fresh builder reviewer /root/builder06b/review06b_handoff1 terminal CLEAN on frozen B17. REVIEW-HANDOFF-1.md/REVIEW-LIFECYCLE.md preserve result and unavailable closure tool. No source changes after freeze; actual runtime/CUA/soak/native/owner acceptance pending.

ActualSOAK03 B17handoff passedafter supervisor nativeCancel ofresidualDelete sheet; finalbootstrap/fullsettle succeeded. FirstshortnumericrAFmax50.9>50ms failedwithvalidfocus/exactretention,45minnotstarted. See SOAK-03-REPORT/CLEANUP forrawlimits/causalassessment. No sourcechanges; fullsoakstillincomplete, no native/owneracceptance.
