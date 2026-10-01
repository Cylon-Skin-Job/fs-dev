export async function establishFocusedWindow({
  observeAndFocus,
  wait,
  timeoutMs = 5_000,
  now = () => Date.now(),
}) {
  const startedAt = now();
  let attempts = 0;
  let lastObservation = null;
  do {
    attempts += 1;
    lastObservation = await observeAndFocus();
    if (lastObservation?.focused === true) {
      return {
        attempts,
        elapsedMs: Math.max(0, now() - startedAt),
        observation: lastObservation,
      };
    }
    if (now() - startedAt >= timeoutMs) break;
    await wait(100);
  } while (true);
  const error = new Error(
    `R1 staged Electron focus unavailable after ${attempts} attempts: ${JSON.stringify(lastObservation)}`,
  );
  error.code = 'R1_FOCUS_UNAVAILABLE';
  error.observation = lastObservation;
  throw error;
}

export function assertFocusedBeforeTyping(observation, label) {
  if (observation?.focused === true) return observation;
  const error = new Error(
    `${label}: staged Electron lost OS focus immediately before typing: ${JSON.stringify(observation)}`,
  );
  error.code = 'R1_FOCUS_LOST_BEFORE_TYPING';
  throw error;
}
