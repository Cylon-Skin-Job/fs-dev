# REFERENCES — Evidence and source template

> Inert starter: adapt to the assigned subject. A catalog of sources and what they support, not a new authority or a claim that every source has been checked. No references exist in this template.

Use `REF-` IDs under the relevant H2 category; use H4 subheadings within a record when excerpts, context or limitations need more space. Required bold-label bullet fields: **Kind**, **Status**, **Source**, **Locator**, **Revision**, **Checked**, **Supports**, **Limitations**, and **Related**. Status is uninspected, inspected, unavailable, or superseded. Kind describes the source, such as user_quote, assistant_summary, code, wiki, standard, runtime, external, or artifact; adapt kinds to the project.

Source names the origin; Locator gives a path/URL and section, line, task/turn or other precise position. Revision identifies the version, commit, content fingerprint or dated observation; use “unknown” with its consequence when unavailable. Checked records the actual inspection date and method, or “not checked.” Link claims in Issues, Decisions, Contracts or proposals to the source record rather than copying the same inventory into each document. Keep necessary excerpts with the claim when that makes it understandable.

## User Statements and Conversation

What did the owner actually say, in which context, and what scope did it concern? Label exact quotes, paraphrases and assistant summaries explicitly. Preserve qualifications and surrounding context. A summary is a retrieval aid; verify the original passage when its wording determines intent. Record history coverage limits and unavailable turns without inventing identifiers.

Follow [conversation-evidence.md](../../conversation-evidence.md): include the task UUID/link, returned turn/message IDs, speaker, relevant quotation or labeled paraphrase, retrieval time/method, checked later revisions and coverage limits. Keep source identity distinct from the reviewing agent’s identity; never invent an unavailable side-chat locator.

For a possible change of mind, preserve both statements and link the decision or issue that reconciles them. Newer does not automatically mean superseding. Referencing a statement does not make an assistant interpretation owner-approved.

## Code and Configuration

Which implementation points support the claimed current behavior? Name the relevant checkout and revision, including relevant dirty changes. A symbol or path alone is a lead, not evidence of a traced execution path. Source inspection is distinct from runtime verification.

## Wiki and Standards

Which wiki contracts, standards-router pages or approved specifications constrain the work? Record exact pages and applicable scope. Separate documented intent from observed implementation; route conflicts to Issues instead of quietly choosing one as globally authoritative.

## Runtime and Verification Evidence

What was actually observed or tested, against which version and environment? Link commands, reports or artifacts and their outcome. Keep unexecuted test ideas elsewhere. Historical passing evidence is not proof that the current revision passes.

## External Sources and Prior Art

Which specifications, research, examples or outside sources inform the work? Preserve author/publisher, date and source location where relevant. Distinguish source claims, quotations and our inference; note applicability and limits.

## Prior Work and Supporting Artifacts

Which earlier captures, investigation reports, tickets, designs or demonstrations help explain the current work? Mark whether they are context, evidence or an approved contract. Historical approvals apply only to their recorded scope; link replacements without erasing provenance.
