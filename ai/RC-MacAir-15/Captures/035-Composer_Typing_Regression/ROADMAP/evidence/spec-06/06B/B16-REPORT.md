# B16 — final soak preparation after warmup

Prelaunch fixture-only correction explicitly authorized by root/supervisor after SOAK01. No Electron run yet. Frozen source1948 SHA2569f97dd6ad99cba7610b35147905dc1e907295bc8e340bfb00a38bea8f2f30cfc; build200 unchanged SHA2566c06602b58f8dc0e4a9b1ed6588c5670b8e628b21044040a581e9e9d55f05234. B16-IDENTITY files, B16-CHANGED-PATHS exactfivepaths (3modified/2new), B16-BEFORE andmanifest retain exactthreepredecessors beforeediting. No product/sharedmeasurementhelper/dependency changes.

## Authority / behavior / deviation B16

SPEC06/06B: “Execute VALIDATION short idle/streaming and five-minute probes followed by the 45-minute workload.” VALIDATION: “Initial hydration/focus and settled typing are distinct windows; record a fixed 45-second settle for comparison and a separate startup-responsiveness result.” Approved setup retains ordered currentdocument capture→updated→request→data plus500msquiet, actualnativefocus and strict measuredinterval predicates.

SOAK01 ordered/focus preparation occurred before densehistory, lifecycle warmup including dialogs, and draft warming. After those operations and45ssettle/resource baseline, the first nativefocus query wasfalse. Telemetry lacksblur/hide; sequence warrants a final preparation boundary but does NOT prove a dialog/resource operation caused the false query. Failure retained unchanged in HANDS-OFF-CONTINUATION-REPORT/rawrun.

The early bootstrap is now named setupBootstrap, sealing the2048boundedfixturetraffic buffer as before. After allwarmup, new soak-preparation.mjs asserts that the live document matches that setup receipt, performs the SINGLE finalnativefocus establishment, calls the UNCHANGED waitForScreenshotBootstrapQuiescence anew, verifies same document and nondecreasingtrafficsequence, then waits the full45000ms before baseline sampling and anytyping. This revalidates the genuine existing ordered lifecycle within the SAME retaineddocument and requires NEW500msquiet against continuingtrafficSequence. It does not claim a newcapture afterwarmup. Earlier stalechain prohibition remains enforced against crossdocumentreuse/oldquiet/rawoldreceipt substitution. No observerreset, productcacheclear, reload, ribboninteraction, newcapturetrigger or measuredrefocus.

Fivepaths: soak-electron.mjs callsite/order; newsoak-preparation.mjs cohesive guard/settle helper; newsoak-preparation.test.mjs behavior/negative/order checks; run.mjs adds newhelper to existingprovenancemanifest only; observation-contract.test.mjs fixes stale source-location check by asserting actualr1-sustained import+call and inspecting its extractedr1-sustained-observation owner. Sharedobservation and allR1 runtimebytes untouched.

Proposedclassification: accepted bounded fixture-preparation integration with necessaryoracle-location correction. No standards exception, numeric/focus/traffic/resource/duration waiver. Downstream: actualfullsoak must run onB16;06C documentation carries exactsetup/lifecycle scope only aftermandatoryacceptance. Temporaryfixture helpers retire when suite isretired; no productadapterintroduced. Risk: actualnativefocus may stillfail later; no causalfixguarantee, and strictgates stop it.

## Tests / self-review

b16-unit-01:8pass/0skip125.552791ms (preparation/resource/focus). Expandedb16-unit-02:16pass/1fail430.951666ms; stalepreexisting observation-contract literalsearch expected bootstrapimplementation inr1-sustained-electron afterB12extraction. Exactbefore preserved; correctedtestverifies import+call+actualowner with allformula/traffic assertions preserved. No productrepair inferred. Finalcommand: `node --test fusion-studio-client/e2e/chat-architecture/soak-preparation.test.mjs fusion-studio-client/e2e/chat-architecture/soak-resources.test.mjs fusion-studio-client/e2e/chat-architecture/owned-focus-observation.test.mjs fusion-studio-client/e2e/chat-architecture/observation-contract.test.mjs`; b16-unit-03:17pass/0skip407.185458ms.

Tests invoke actualunchangedbootstraphelper underboundedfakeclock/traffic, proving sealedbuffer retainschain whilequiet restarts oncontinuingsequence; expected500msfreshquiet and45000msfullsettle. Missing/outoforder/overflow/neverquiet failclosed; missing/crossdocument/sequencebackward/nativefocusfailure preventsettle; callsiteorder establisheswarmup→draftwarm→finalprepare→baseline→typing; exactlyonefinal focus(true) andmeasurementfocus(false) preserved. Resource finalsample and transientfocusnegative checks retained. No Electron/browser launch, build orproductserverrerun required forpurefixturesequence/testchanges; actualsoak remains indispensable pendingfreshgates.

Selfreview: currentdocidentity is checked both beforefinalfocus andafterbootstrap; measuredwindows retain existingdocumentcheck andfullfocusintervalchecks; earlysetupquiet never substitutes for finalquiet. Thehelper performs noactivation aftersettle/insideinput. Nativefive-minute observer/calibration/formulas unaffected. No failures hidden; no cacheclearing.

## Evidence validity / launch boundary

VRENDER03 remains valid via unchanged actualrenderdependency surface. Its old55entryrunmanifest now has differing unusedsoakfile andrunprovenance/testentries, so do NOT claim everyhistoricalmanifestentry equalsB16. Actualrendercases/R1/sharedhelpers/product/build untouched; runchange merelyrecordsnewsoakhelper. Thetest-location correction changes no runtimeoracle. No duplicatefullrender needed forunusedsoakdependency. SOAK01 retainedfailedpremeasurement and cannot certifyB16/full45min.

Freshbuilder androotreviews required before rootGO for ONE actual45minsoak using `FUSION_CHAT_ARCH_OWNER_FOREGROUND_MS=120000 FUSION_CHAT_ARCH_POST_SOAK_MANUAL_MS=0 /usr/bin/caffeinate -d node fusion-studio-client/e2e/chat-architecture/run.mjs --suite soak --duration-ms 2700000 --mode enforce`. No diagnosticprobes/manualwindow/humanclick requirement. Root latestsafe launch01:44UTC forownerhands-off00:40–02:40UTC with55minuteharddeadline+cleanup; checktime beforeGO, do notextendownerabsence. ProtectpersistentPID55084. Fullsoak/realIME/Palette/autocomplete/explicitownersymptoms pending, no06C.

Freshbuilderreview /root/builder06b/review06b_preparation1 terminalCLEAN/no materialfindings onfrozenfivepathdelta. REVIEW-PREPARATION-1.md andREVIEW-LIFECYCLE.md recordresult/close_agentabsence. No sourceeditsafterfreeze. Rootfreshgate/GO pending; no runtime.

## Actual B16 outcome

Afterbothfreshgates/rootGO, oneSOAK02 runchat-arch-1790471405317-953cbc1640 failedfinalnativefocusafterwarmup48boundedattempts; nofinalbootstrap/settle/baseline/input/workload.33147msexit1/cleanownedcleanup/hashunchanged. SOAK-02-REPORT.md andSOAK-02-CLEANUP.json retainlimits/causeunknown. No retry/sourcechange; fullsoakstillblocked.
