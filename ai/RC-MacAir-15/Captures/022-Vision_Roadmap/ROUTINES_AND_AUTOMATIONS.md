# Routines and Automations Model

> Broad analysis of user-created routines, semantic automation graphs, trigger-driven heartbeats, inspectable scripts, and plugin composition. Owner decisions remain authoritative in DECISIONS.md; this document does not define an execution engine, manifest schema, sandbox, or implementation sequence.

## Product Role

**Routines** is the visible place where users understand, create, connect, and discuss automation. It replaces the idea of an invisible autonomous agent with an inspectable routine, a fronting chat, explicit wake conditions, visible steps, and observable outputs.

The user should be able to open a routine and ask, “How does this work?” The assistant can explain the routine from its semantic description, show the relevant triggers and steps, identify connected plugins and applications, and help the user reshape the automation without pretending that a persistent agent entity exists behind it.

## Creation and Conversation Boundary

Opening a routine or starting a chat about an existing routine does not create a folder. Conversation creation remains a narrow chat/thread operation.

Creating a new routine is a separate explicit action. **Create Routine** establishes a new routine folder, after which the AI can work inside that folder to develop its definition, supporting scripts, state, and documentation.

This mirrors the project boundary: **Create Project** creates the project and its view context, while starting a chat within an existing project does not write folders or starter files. The creation of a conversation is not the creation of the domain object it discusses.

## Routine Definition

Each routine is centered on an inspectable `triggers.md` document. It provides:

- the routine name and description;
- frontmatter and metadata for categorization and discovery;
- named input triggers;
- the scripts, heartbeats, or other connectors to execute;
- the outputs the routine may produce; and
- a README-style body that explains the automation semantically to the user and the assistant.

The Markdown is more than hidden configuration. It is the human-readable entry point for understanding what the routine does, what wakes it, which components it connects, and where to inspect those components.

## Visual Composition

The Routines view projects the automation as a connected sequence of nodes or blocks: A leads to B, B to C, and onward. The interaction takes inspiration from node-based automation tools such as n8n, including drag-and-drop composition and visible connectors between steps.

Nodes can represent triggers, scripts, heartbeat checks, applications, plugin capabilities, transformations, AI synthesis, tickets, inbox reports, or other declared inputs and outputs. Clicking a script-backed node lets the user inspect the script itself alongside the semantic explanation derived from `triggers.md`.

The visual graph and inspectable files are two presentations of the same routine. The interface should help ordinary users reason semantically while allowing sophisticated users to inspect or customize the underlying Markdown, JSON, scripts, regular expressions, and file-matching rules.

## Wake Conditions

Once the Provenance schema and event foundation are available, a routine can respond to any trigger the user has installed, configured, and authorized.

Examples include:

- a regular schedule;
- a particular file change;
- a folder reaching a derived state, such as a file count divisible by ten;
- the completion or failure of a script;
- a heartbeat interval or monitored variable; and
- a plugin output.

Invoking or waking from another routine remains the separate proposal in P-009 rather than part of the settled wake model.

The trigger answers what wakes the capability. The routine definition answers what happens next. The assistant or Agent Profile supplies reasoning when a step requires it, without becoming the persistent identity of the automation.

## Heartbeat and Wait Strategy

Routines can mix ordinary script execution with heartbeat-based follow-up. A long-running pattern can:

1. run a script;
2. sleep for a meaningful interval such as thirty minutes;
3. wake and inspect the work;
4. verify that the result is in order;
5. repair and rerun it when needed; and
6. return to sleep before the next check.

For a short operation—roughly the kind expected to finish in seconds—the active process can simply wait and inspect the result without creating a heartbeat cycle. The examples establish proportional behavior, not a fixed thirty-second or thirty-minute threshold.

Monitored variables can be established by the assistant while shaping the routine or supplied as part of a plugin package that installs a known automation pattern.

## Fronting Assistant

Each routine can have a fronting assistant in its chat. That assistant is the conversational interface for understanding intention, explaining the graph, configuring conditional logic, recommending compatible components, and interpreting results.

It should be oriented with a semantic inventory such as:

- where to find available triggers;
- where to find available outputs;
- which applications are connected;
- where to read more about each capability;
- which relevant plugins are installed; and
- which additional plugins could be installed and chained together.

This context lets the assistant help the user engineer a routine without inventing capabilities or hiding what will execute.

## Inputs, Outputs, and Conditional Logic

A routine can combine structured and scriptable behavior. It may inspect file contents, match file extensions, apply regular expressions, run scripts, exchange JSON, or feed a compiled status and payload into an AI input.

An AI step can receive a semantic status update describing what ran, what was collected, what was compared, and what output was produced. It can then synthesize a report, place the result in the inbox, file it elsewhere, or create a ticket according to the routine's authorized heuristics and conditions.

The routine needs enough workspace context and semantic explanation to ask useful questions and recover the user's intent when conditional behavior is not fully specified.

## Plugin Dependencies and Shared Resources

Plugins provide reusable nodes, triggers, outputs, scripts, models, weights, applications, and prebuilt routine fragments. A routine can use an installed capability and recommend a small number of additional plugins when they complete a useful chain.

A plugin may declare another plugin or resource package as a dependency. Installing the higher-level capability can prompt the user to install the missing dependency, but registration, downloads, permissions, and activation remain explicit user-controlled steps.

Large local resources such as model weights are reusable system capabilities rather than private copies embedded into every routine. Once an authorized weight package is installed, compatible plugins and routines can connect to it.

## Speech-to-Text Example

Local speech-to-text illustrates the composition model:

1. A speech-to-text module exposes audio transcription as a reusable capability.
2. The microphone button supplies audio to that module.
3. The text output passes through a user-editable regular-expression formatter.
4. The formatted result returns to the chat input box.

The module and pipeline can be preconfigured while the large model weights remain absent until the user explicitly downloads them. The plugin can provide Markdown orientation and an installation script, but the user must initiate the resource installation.

The same installed speech-to-text weights can support another routine such as video transcription. A richer video plugin may require additional voice-detection, speaker-separation, or timestamping weights. Installing it can prompt for those additional resource plugins; once installed, the new capabilities become available to other authorized routines as well.

## Permissions and Inspection

Routines and plugins must make their authority legible. The interface can place trigger-permission and output-permission switches on the right side, grouped into readable sections. These switches expose what may wake the routine and what consequences it may produce.

Scripts remain inspectable from their visual nodes. Semantic descriptions explain their intended purpose, while the underlying files remain available for users who want to verify or customize behavior.

The database registry remains authoritative for granted permissions. Markdown and plugin declarations can request or describe capabilities, but they cannot grant authority that is absent from the registry.

## Open Questions

- What exact folder contents surround `triggers.md`, and which files are required versus optional?
- Does the graph edit `triggers.md` directly, generate another representation, or project a broader routine folder contract?
- How are node identities and connections kept stable when users edit Markdown or scripts outside the GUI?
- How are routines linked to or invoked by other routines without creating loops?
- Which wake conditions are core, and which arrive only through plugins?
- How are file-change and derived-count triggers debounced, deduplicated, and prevented from firing recursively?
- What determines whether a process waits inline or schedules a heartbeat follow-up?
- What limits repeated inspect-repair-rerun cycles, and when must the routine escalate to the user?
- How are assistant-created variables explained, validated, and approved?
- How are trigger permissions separated from output permissions, tool permissions, and data-access permissions?
- What script inspection, trust, signing, sandboxing, and rollback model applies to installed routine components?
- How do plugin dependencies declare compatible versions, required weights, storage size, download source, and update policy?
- Which installed resources are global, workspace-scoped, or routine-scoped?
- What state and evidence let the fronting assistant explain why a routine woke and what each node did?
