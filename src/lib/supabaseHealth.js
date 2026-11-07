// Whether the backend has stopped answering. Two retryable failures in a row
// raise it; one success, or the player dismissing it, lowers it. A 403 is
// not an outage — that is the server saying no, which is an answer.

let failures = 0;
const listeners = new Set();

const emit = () => {
  for (const fn of listeners) {
    try { fn(); } catch { /* a subscriber must not break the next one */ }
  }
};

export function outageActive() {
  return failures >= 2;
}

export function noteSuccess() {
  if (failures === 0) return;
  failures = 0;
  emit();
}

export function noteFailure() {
  failures += 1;
  if (failures === 2) emit();
}

export function dismissOutage() {
  if (failures === 0) return;
  failures = 0;
  emit();
}

export function subscribeHealth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test hook. Production code never resets a module global on purpose. */
export function resetHealthForTests() {
  failures = 0;
  listeners.clear();
}
