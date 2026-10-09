# Original checklist fixture intent

This is a disposable test application inside an ordinary Fusion Studio custom
view capsule. It is an integration rehearsal input, not a production feature.
Root `/root` is the fixture test controller. Before actual initial review, root
must approve this authority revision; setup approval alone does not do that.

The checklist contains three stable tasks: `draft` (Draft report), `review`
(Review sources), and `send` (Send summary). Each task has a completion checkbox.
Checking a task marks it complete while keeping the task visible and available
to reverse. Unchecking it makes it incomplete again. The summary shows the
number of incomplete tasks. All three labels and checkbox states remain visible.
Completion survives an ordinary iframe/shell reload within the same profile;
the canonical restart deliberately clears browser session storage, so a full
restart starts with the three incomplete fixture tasks.

Acceptance scenario: initial incomplete count 3; check Draft report → 2; check
Review sources → 1; uncheck Draft report → 2. The three rows remain throughout.
Reload after those actions retains the two incomplete tasks and checked Review
sources. Checking all three reaches 0; unchecking all returns 3. The test uses
real checkbox interaction and visible summary text in the normal custom iframe.

The fixture Wiki must accurately explain task completion, reversal, summary
meaning, reload retention and the full-restart reset. Inspect the existing
Checklist Guide article even when its `source-files` list is empty. Its reader
claims are part of the integration coverage. Retain the Navigation Guide facts
and its timestamp when unchanged. Read the article by navigating the built-in
Wiki view, then navigate away/back and reload through the actual shell.

Two prerequisites deliberately require later test-controller resolution:

- `FIXTURE_PROVIDER_01`: the fixture sample provider must release the exact
  three IDs/labels above. Provider `fixture-sample-provider`, consumer
  `checklist-view`, resolver `/root`. A labeled `REHEARSAL_ONLY_PROVIDER_RELEASE`
  receipt must contain the sample hash, existing baseline ID, fixture landed
  field explicitly simulated, and adoption evidence separately labeled.
  No provider build or real landing is authorized by this prerequisite.
- `FIXTURE_INTENT_01`: the summary wording is not settled. The precise question
  is whether the required count is presented as `N remaining` or
  `N remaining of 3`. Resolver `/root`; release is a labeled
  `REHEARSAL_ONLY_INTENT_RESOLUTION` selecting one exact format. The numerical
  acceptance sequence above is already settled. The Supervisor must return the
  actual intent hold before guessing the required final presentation.

After the first real waiting-owner packet only, root may supply the separately
defined `REHEARSAL_ONLY_FIX_X_Y` control: X renames Draft report to Review report
while retaining the stable `draft` ID and completion semantics; Y adds Reset
completion, which unchecks all three tasks without deleting/renaming a row and
updates/persists the summary immediately. Check two tasks → reset → three
incomplete visible tasks; reload retains the reset. Corresponding Guide prose
must explain the reset and the new label. This control authorizes only these
disposable fixture changes and renewed affected gates/runtime. It never grants
Git or publication authority.
