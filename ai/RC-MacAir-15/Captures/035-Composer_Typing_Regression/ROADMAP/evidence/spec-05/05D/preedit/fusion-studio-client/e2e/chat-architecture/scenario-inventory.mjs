export const SCENARIOS = Object.freeze([
  { id: 'R1-STARTUP-F2-F3', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-WARM-F2-F3', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-SETTLED45-F2-F3', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-DENSE-F2', requirement: 'R1', fixture: 'F2-dense+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-COMPOSER-INPUT', requirement: 'R1', fixture: 'F4', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-COMPOSER-LOCALITY', requirement: 'R1', fixture: 'F2+F4', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-FIVE-MINUTE-TYPING', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04C', state: 'enforce' },
  { id: 'R2-DISCONNECT-BEFORE-CLICK', requirement: 'R2', fixture: 'F1', owner: 'SPEC-02/02A', state: 'characterize-now' },
  { id: 'R2-ENQUEUE-THROW-RACE', requirement: 'R2', fixture: 'F1', owner: 'SPEC-02/02A', state: 'characterize-now' },
  { id: 'R3-LOST-ACK-STATUS', requirement: 'R3', fixture: 'F5', owner: 'SPEC-02/02B', state: 'blocked-missing-receipt-status-contract' },
  { id: 'R3-RECONNECT-UI', requirement: 'R3', fixture: 'F5', owner: 'SPEC-02/02C', state: 'blocked-missing-recovery-ui-contract' },
  { id: 'R4-DISTINCT-ATTEMPTS', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02A', state: 'blocked-missing-request-id-contract' },
  { id: 'R4-DISTINCT-RECEIPTS', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02B', state: 'blocked-missing-receipt-contract' },
  { id: 'R4-DUPLICATE-MISMATCH', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02B', state: 'blocked-missing-receipt-contract' },
  { id: 'R4-LATE-DRAFT-RECOVERY', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02C', state: 'blocked-missing-recovery-ui-contract' },
  { id: 'R5-FILE-ACTION', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'characterize-now' },
  { id: 'R5-WIKI-ACTION', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'characterize-now' },
  { id: 'R5-OFFICE-ACTION', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'characterize-now' },
  { id: 'R5-SYSTEM-PROMPT-NEW', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03B', state: 'characterize-now' },
  { id: 'R5-SYSTEM-PROMPT-NEW-SUCCESS', requirement: 'R5', fixture: 'F3+F4+F5', owner: 'SPEC-03/03B', state: 'characterize-now' },
  { id: 'R5-SOURCE-SWITCH', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'characterize-now' },
  { id: 'R5-TEXT-INSERT', requirement: 'R5', fixture: 'F4', owner: 'SPEC-03/03A', state: 'characterize-now' },
  { id: 'R5-DIAGNOSTIC-APPEND', requirement: 'R5', fixture: 'F4', owner: 'SPEC-05/05D', state: 'characterize-now' },
  { id: 'R5-NO-TARGET-CONSUMER', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'characterize-now' },
  { id: 'R6-PROMPT-UNMOUNT', requirement: 'R6', fixture: 'F4+F5', owner: 'SPEC-03/03B', state: 'source-only-Legacy-host-hazard' },
  { id: 'R6-CREATE-RECONNECT', requirement: 'R6', fixture: 'F4+F5', owner: 'SPEC-03/03B', state: 'source-only-Legacy-host-hazard' },
  { id: 'R6-UNRELATED-OPEN-LISTENERS', requirement: 'R6', fixture: 'F4', owner: 'SPEC-03/03B', state: 'source-only-Legacy-host-hazard' },
  { id: 'R6-PROMPT-CREATE-COMPLETION', requirement: 'R6', fixture: 'F4+F5', owner: 'SPEC-03/03B', state: 'source-only-Legacy-host-hazard' },
  { id: 'R6-PRODUCTION-ACTION-OWNER', requirement: 'R6', fixture: 'F3+F4+F5', owner: 'SPEC-03/03B', state: 'blocked-missing-production-consumer;conditional-activation' },
  { id: 'R7-STREAM-STOP-SAVE', requirement: 'R7', fixture: 'F4+F5', owner: 'SPEC-02/02C + SPEC-04/04B + SPEC-05/05C', state: 'characterize-current-branches' },
  { id: 'R7-HISTORY-LIVE-OBSERVATION', requirement: 'R7', fixture: 'F2+F4+F5', owner: 'SPEC-04/04B', state: 'enforce' },
  { id: 'R8-GROUP-BACKEND-MATRIX', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05A-05C', state: 'characterize-current-branches' },
  { id: 'R9-INDICATOR-DISTINCTION', requirement: 'R9', fixture: 'F2+F5', owner: 'SPEC-06/06B', state: 'characterize-now' },
  { id: 'R9-NATIVE-OWNER-SYMPTOMS', requirement: 'R9', fixture: 'F2+F3+F5', owner: 'SPEC-06/06B', state: 'blocked-owner-native-acceptance' },
]);

export const ENFORCE_GROUPS = Object.freeze({
  submit: SCENARIOS.filter((item) => ['R2', 'R3', 'R4'].includes(item.requirement)).map((item) => item.id),
  actions: SCENARIOS.filter((item) => ['R5', 'R6'].includes(item.requirement)).map((item) => item.id),
  render: SCENARIOS.filter((item) => (
    ['R1', 'R7', 'R9'].includes(item.requirement) && item.id !== 'R1-FIVE-MINUTE-TYPING'
  )).map((item) => item.id),
  soak: ['R1-FIVE-MINUTE-TYPING'],
  backend: SCENARIOS.filter((item) => item.requirement === 'R8').map((item) => item.id),
});

export function assertCompleteScenarioInventory() {
  const requirements = new Set(SCENARIOS.map((item) => item.requirement));
  for (let index = 1; index <= 9; index += 1) {
    if (!requirements.has(`R${index}`)) throw new Error(`scenario inventory is missing R${index}`);
  }
  for (const item of SCENARIOS) {
    if (!item.id || !item.fixture || !item.owner || !item.state) throw new Error(`incomplete scenario: ${item.id}`);
  }
  return true;
}
