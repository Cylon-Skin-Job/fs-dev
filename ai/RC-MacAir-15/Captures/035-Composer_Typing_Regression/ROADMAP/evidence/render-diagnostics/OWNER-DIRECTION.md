# Visible-wait clock and stream diagnostics — new owner direction

Authority: direct owner messages in Codex task01a0d633-7d87-7ff3-8804-f2291bceb0c6 on2026-09-27. This is a new bounded work item, separate from completed instant-collapse and TO-01; no retroactive expansion of their acceptance.

## Exact latest direct owner message

> Yes, so we are elapsing some time before using it, right? I am thinking 2 seconds. That's about when you register a lag and around 3-4 wonder what's wrong. So the clock needs enough gap that 2 seconds and then continued stream isn't too bad, but any more and you get acknowledged.&#x20;
>
> I also want to make a "diagnostics" tab, that I can pop up from the list button in the chat. Just have it appear as a tab to the right of all other open tabs. I'd like to stick a realtime dump from whatever char we are on, unbeautified plain markdown as it arrives, like a terminal stream, but don't event remove \<thinking> and all that. So I could see up top like a counter of each, and speed gap, by calcing what hasn't displayed yet. Because basically all tool calls, and every char and all of it has a deterministic speed that we can calculate at any time.

## Preceding direct owner context

> An say one thing in a queue is displayed, but another is not done forming a full chunk, and then say the tokens slow from the provider, would we be able to just use that timer clock? Because it occurs to me, maybe we set a counter to mark what token number streamed while another was rendered, and compare. Is there a way to grab that and not break the render speed?

Assistant explained possible received/ready/revealing observations, source positions rather than provider-token numbers, independent low-frequency display, and measuring visible wait rather than provider step age. Latest owner message approves2seconds and requests diagnostics tab.

## Supervisor relay — coordination only, no added authority

Supervisor task01a0c1c8-6e85-7f83-8d67-2cb5c1476007 directed keeping this new contract separate from instant-collapse/TO-01, preserving direct-owner provenance, defining actual counters and unknown-future-work limits. Its reply explicitly supplies no extra product/runtime authority and is not root-owner acceptance in that task. Implementation authority comes from the direct owner request above. No activation/Alpha/Git authority is added.

## Source mapping and factual constraints

ChatAreaHeader.tsx owns the event_list More options menu; ConnectedChatHeader/useChatSessionActions/chatSurfaceContract carry connected actions. Existing Generic Host/tab adapters and sideChatBridge compose the content tab rail, including Side Chats. The Diagnostics action must append a closable, active tab at the right of all currently open tabs without replacing/reordering them or changing the selected chat identity.

text/text-animate.ts owns received contentRef, raw cursor, ready blocks, visible character loop and boundary-fixed speed. reveal/orchestrator.ts owns tool parser feed length, ready queue, character loop, interchunk waits and its existing150ms partial flush. tool-animate.ts additionally owns existing awaitsResult polling/timeout. These owners must report observation; diagnostics must not duplicate parsers or steer pacing.

Incoming canonical content/thinking/tool events are separate. OpenCode native events reach its adapter before canonical translation; literal thinking tags are not guaranteed in provider data. An optional owner clarification is pending on Fusion's incoming content/tool stream versus native OpenCode envelopes. Preserve all literal tags/markdown at the selected boundary and label any synthetic event separators. Never claim native-byte fidelity for reconstructed canonical data.

Source text length, rendered visible characters and transformed tool output are different measures. No subtraction across unlike units. Record source progress separately from visible progress; explicit waiting/unknown states for incomplete parse, future provider data and unfinished tools. Nominal remaining paced time for already-known work can be estimated using current schedule; future arrival and actual event-loop wall time cannot be deterministic.

## Execution slices

RD-01: two-second visible-wait clock and passive reveal progress observations; unchanged pacing/finalization.
RD-02: diagnostics menu/tab, raw incoming feed and truthful counters/rates/known-backlog timing using RD-01 observations; define exact feed semantics before dependent implementation.

One fresh writer per slice; builder/root fresh independent gates. Source-ready only; preserve current human app/profile/chat, no restart, native dependencies, paid provider, Alpha/Git or soak. Full SPEC06/06B/06C status remains unchanged.


## Owner clarification reply and response

Owner answered the optional feed question: “I'm curious about Option 2, but does that cause dual streams from the harness?” This is a feasibility question, not yet an explicit feed selection. Assistant answered that native diagnostics can tap the same process/output before translation; no second run/modelrequest/token generation, only a separatelybatched local observation copy. Follow-up optionalchoice is nativeeventswithrendercounters versus canonicalcontent. RD01 implementationcontinues independently; RD02feedselection remains amendable.


Owner follow-up (architecture question, not yet feed selection): “I'm asking, since we already tranlate the harness events on the back end adapater, are you tranlating those events back? Or maintianing a sperate token stream? How would you do it?”

Assistant clarified oneincomingnativeevent branches to existingtranslatoronce andoptionaloriginaleventcopy. No reversetranslation andno secondtokenstream; there is an additional backend-to-tabdiagnosticfeed whileopen, batchedwithoutawaiting it inchatpath. Nativeevents andactualrenderer observationsremainseparate/correlated withdeclaredunits. Nativefeednotimplemented yet. Do not misreport this question asselection/approvalofnative-specificscope. RD01continues; RD02mustresolve semantics withoutrepeatingunnecessaryquestions.


## Native feed selection — direct owner approval

Owner: “Okay, that works. I really don't care about formatting on the stream side. It could be raw makdown.”

This follows the explicit architecture explanation of one native event copied before existingtranslation, no reversetranslation/secondtokenstream, with an additional batchedbackend-to-tabfeed. Treat it as approvalofthatnativefeeddesign. DisplayplaintextwithoutMarkdownrendering/beautification; actualnativeenvelopesmaybeserializedJSON with literal textpayloads. Preservecontent/markers asreceived at adapter; no claimmodeltokenboundaries orbyteexactstdoutunlesscapturedasbytes. RD02 now nativefeed, superseding the earlierprovisionalcanonicaldefault. No activation/Alpha/Git authority added.


## Per-turn disposal — direct owner instruction

Owner: “Also, we can just destroy the prior text and start a fresh stream on every turn. It's purely for observation.”

Required: reset diagnostictext/counters/buffers on each newaddressedturn; discardpreviousdiagnosticcontent ratherthanarchive/appendturnhistory. Completedturnmayremainvisible untilnextturn/close. No durablelog/export/historyfeature is requested. Lateprior-turnevents mustnotrepopulate clearednewturnfeed.
