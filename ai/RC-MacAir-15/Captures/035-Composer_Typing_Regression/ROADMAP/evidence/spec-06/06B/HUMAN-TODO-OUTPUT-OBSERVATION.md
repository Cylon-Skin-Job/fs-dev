# Human todo/output pause — read-only diagnosis

Observed 2026-09-27, current instrumented run `human-1790494814495-ca038557`. Owner reported output hung around the todo tool, then spontaneously resumed. No restart, input, provider prompt, product edit or runtime intervention performed during diagnosis.

This is a NEW human-created chat, not the earlier rejected-shell chat:
- Fusion thread: `2026-09-27T01-25-18-759`.
- Provider session: `ses_f1e07919effekEnKHp5BPmgQpe`.
- Turn: `a782f33b-0d74-46bf-90c0-b478c13ea350`.
- Saved exchange: 10, sequence 1, user prompt “I want to keep working on this”.

Evidence from read-only provider SQLite and Fusion SQLite, and existing passive `events/events-0001.ndjson` journal:

1. First todowrite `call_01a0e1f8e455779497c3862d` completed successfully at 08:26:21.126 UTC (native start 08:26:21.124). The provider continued with subsequent work and multiple text/tool steps.
2. Final todowrite `call_01a0e1f98cfd7301b141f859` completed successfully at 08:27:03.804 UTC (native start 08:27:03.802), marking the four todos completed.
3. Last provider assistant message `msg_0e1f98f13001sYcrg179V0C4zq` completed at 08:27:06.048 UTC with native finish `stop`, an ordinary model completion, not evidence of a user Stop request.
4. Fusion received final content at 08:27:06.057, turn_end(reason stop) at 08:27:06.064, idle at .065 and chat-turn:saved at .076. Exchange contains the full concluding response and metadata reason stop/partial false. No rejected tool or premature terminal is established for this run.
5. Passive heartbeat first reports the actual chat composer disabled at 08:27:06.787 and enabled again at 08:28:03.786, approximately 57 seconds later. Heartbeats around both transitions remain approximately one second apart. The inspected interval had no recorded long-task or socket-close event. This is evidence of a post-terminal disabled-state interval, not proof that the entire renderer froze.

Limits: wire arrival and saved text do not prove when text was visibly painted. Owner's perceived output pause is not yet causally linked to the disabled-composer interval or to the todo tool. The todo tool itself did not hang according to its native start/end results. No broad claim about the absence of all rendering defects, provider pauses, or diagnostic overhead follows. This is separate from the permission-rejection/false-complete reproduction addressed by TO-01; do not silently expand that implementation or mark this symptom fixed.

Current outcome: provider turn completed normally; composer recovered without supervisor action; logs/profile/project retained. Further root-cause diagnosis of output/state delay remains open.
