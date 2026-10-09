export const SCENARIOS = Object.freeze([
  { id: 'R1-STARTUP-F2-F3', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-WARM-F2-F3', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-SETTLED45-F2-F3', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-DENSE-F2', requirement: 'R1', fixture: 'F2-dense+F3', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-COMPOSER-INPUT', requirement: 'R1', fixture: 'F4', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-COMPOSER-LOCALITY', requirement: 'R1', fixture: 'F2+F4', owner: 'SPEC-04/04A', state: 'enforce' },
  { id: 'R1-FIVE-MINUTE-TYPING', requirement: 'R1', fixture: 'F2+F3', owner: 'SPEC-04/04C', state: 'enforce' },
  { id: 'R2-DISCONNECT-BEFORE-CLICK', requirement: 'R2', fixture: 'F1', owner: 'SPEC-02/02A', state: 'enforce' },
  { id: 'R2-ENQUEUE-THROW-RACE', requirement: 'R2', fixture: 'F1', owner: 'SPEC-02/02A', state: 'enforce' },
  { id: 'R3-LOST-ACK-STATUS', requirement: 'R3', fixture: 'F5', owner: 'SPEC-02/02B', state: 'enforce' },
  { id: 'R3-RECONNECT-UI', requirement: 'R3', fixture: 'F5', owner: 'SPEC-02/02C', state: 'enforce' },
  { id: 'R4-DISTINCT-ATTEMPTS', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02A', state: 'enforce' },
  { id: 'R4-DISTINCT-RECEIPTS', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02B', state: 'enforce' },
  { id: 'R4-DUPLICATE-MISMATCH', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02B', state: 'enforce' },
  { id: 'R4-LATE-DRAFT-RECOVERY', requirement: 'R4', fixture: 'F4', owner: 'SPEC-02/02C', state: 'enforce' },
  { id: 'R5-FILE-ACTION', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'enforce' },
  { id: 'R5-WIKI-ACTION', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'enforce' },
  { id: 'R5-OFFICE-ACTION', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'enforce' },
  { id: 'R5-SYSTEM-PROMPT-NEW', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R5-SYSTEM-PROMPT-NEW-SUCCESS', requirement: 'R5', fixture: 'F3+F4+F5', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R5-SOURCE-SWITCH', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'enforce' },
  { id: 'R5-TEXT-INSERT', requirement: 'R5', fixture: 'F4', owner: 'SPEC-03/03A', state: 'enforce' },
  { id: 'R5-DIAGNOSTIC-APPEND', requirement: 'R5', fixture: 'F4', owner: 'SPEC-05/05D', state: 'enforce' },
  { id: 'R5-NO-TARGET-CONSUMER', requirement: 'R5', fixture: 'F3+F4', owner: 'SPEC-03/03A', state: 'enforce' },
  { id: 'R6-PROMPT-UNMOUNT', requirement: 'R6', fixture: 'F4+F5', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R6-CREATE-RECONNECT', requirement: 'R6', fixture: 'F4+F5', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R6-UNRELATED-OPEN-LISTENERS', requirement: 'R6', fixture: 'F4', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R6-PROMPT-CREATE-COMPLETION', requirement: 'R6', fixture: 'F4+F5', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R6-PRODUCTION-ACTION-OWNER', requirement: 'R6', fixture: 'F3+F4+F5', owner: 'SPEC-03/03B', state: 'enforce' },
  { id: 'R7-STREAM-STOP-SAVE', requirement: 'R7', fixture: 'F4+F5', owner: 'SPEC-02/02C + SPEC-04/04B + SPEC-05/05C', state: 'enforce' },
  { id: 'R7-HISTORY-LIVE-OBSERVATION', requirement: 'R7', fixture: 'F2+F4+F5', owner: 'SPEC-04/04B', state: 'enforce' },
  { id: 'R8-GROUP-BACKEND-MATRIX', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05A-05C', state: 'enforce' },
  { id: 'R8-UI-LIFECYCLE', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05D', state: 'enforce' },
  { id: 'R8-EXACT-MEMBER-HYDRATION', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05D', state: 'enforce' },
  { id: 'R7-R8-RUNTIME-OWNERSHIP', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05D', state: 'enforce' },
  { id: 'R8-MIRROR-RECOVERY', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05D', state: 'enforce' },
  { id: 'R8-SESSION-LIFECYCLE', requirement: 'R8', fixture: 'F3+F4+F5', owner: 'SPEC-05/05D', state: 'enforce' },
  { id: 'R8-PRE-RECEIPT-UPGRADE', requirement: 'R8', fixture: 'pre-045+F5', owner: 'SPEC-06/06A', state: 'enforce' },
  { id: 'R9-INDICATOR-DISTINCTION', requirement: 'R9', fixture: 'F2+F5', owner: 'SPEC-06/06B', state: 'enforce' },
  { id: 'R9-45-MINUTE-SOAK', requirement: 'R9', fixture: 'F2+F3+F4+F5', owner: 'SPEC-06/06B', state: 'enforce' },
  { id: 'R9-EARLY-LIFECYCLE', requirement: 'R9', fixture: 'F2+F3', owner: 'SPEC-06/06B', state: 'diagnostic-only' },
  { id: 'R9-NATIVE-ACTIVATION-PROTOCOL', requirement: 'R9', fixture: 'F2+F3', owner: 'SPEC-06/06B', state: 'diagnostic-only' },
  { id: 'R9-WATCHED-FOREGROUND-SETUP', requirement: 'R9', fixture: 'F2+F3', owner: 'SPEC-06/06B', state: 'diagnostic-only' },
  { id: 'R9-LIFECYCLE-RESOURCES', requirement: 'R9', fixture: 'F2+F3+F4+F5', owner: 'SPEC-06/06B', state: 'enforce' },
  { id: 'R9-NATIVE-OWNER-SYMPTOMS', requirement: 'R9', fixture: 'F2+F3+F5', owner: 'SPEC-06/06B', state: 'blocked-owner-native-acceptance' },
]);

export const ENFORCE_GROUPS = Object.freeze({
  all: SCENARIOS.filter((item) => !['R9-EARLY-LIFECYCLE','R9-NATIVE-ACTIVATION-PROTOCOL','R9-WATCHED-FOREGROUND-SETUP','R9-45-MINUTE-SOAK','R9-LIFECYCLE-RESOURCES','R9-NATIVE-OWNER-SYMPTOMS','R1-FIVE-MINUTE-TYPING'].includes(item.id)).map((item) => item.id),
  submit: SCENARIOS.filter((item) => ['R2', 'R3', 'R4'].includes(item.requirement)).map((item) => item.id),
  actions: SCENARIOS.filter((item) => ['R5', 'R6'].includes(item.requirement)).map((item) => item.id),
  render: SCENARIOS.filter((item) => (
    ['R1', 'R7', 'R9'].includes(item.requirement) && !['R9-EARLY-LIFECYCLE','R9-NATIVE-ACTIVATION-PROTOCOL','R9-WATCHED-FOREGROUND-SETUP','R9-NATIVE-OWNER-SYMPTOMS','R9-45-MINUTE-SOAK','R9-LIFECYCLE-RESOURCES'].includes(item.id)
  )).map((item) => item.id),
  soak: ['R9-45-MINUTE-SOAK'],
  native: ['R9-NATIVE-OWNER-SYMPTOMS'],
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

export function assertEnforcementCoverage(suite, available, catalog, required = ENFORCE_GROUPS[suite] || []) {
  for (const scenarioId of required) {
    if (!available.some(id => catalog[id]?.scenarioIds?.includes(scenarioId))) {
      throw new Error(`suite ${suite} is missing executable enforcement scenario ${scenarioId}`);
    }
  }
}
