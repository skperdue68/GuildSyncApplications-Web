import { Worker } from 'node:worker_threads';

const workerUrl = new URL('./validate-worker.js', import.meta.url);
export const VALIDATION_TIMEOUT_MS = 15000;
export const MAX_CONCURRENT_VALIDATIONS = 3;
let active = 0;

const failure = (kind, message) => Object.assign(Error(message), { kind });

// Checks SavedVariables text off the main thread. Rejects with an Error whose
// `kind` is one of: invalid (bad data), busy, timeout, memory, internal.
export function validateLua(lua, { timeoutMs = VALIDATION_TIMEOUT_MS, maxConcurrent = MAX_CONCURRENT_VALIDATIONS } = {}) {
  if (active >= maxConcurrent) return Promise.reject(failure('busy', 'The server is busy checking other uploads. Try again in a moment.'));
  active++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerUrl, { workerData: lua, resourceLimits: { maxOldGenerationSizeMb: 512 } });
    const timer = setTimeout(() => finish(reject, failure('timeout', 'Checking the file took too long.')), timeoutMs);
    function finish(settle, value) {
      if (settled) return;
      settled = true; clearTimeout(timer); active--;
      worker.terminate().catch(() => {});
      settle(value);
    }
    worker.once('message', message => message.ok ? finish(resolve) : finish(reject, failure('invalid', message.message)));
    worker.once('error', error => error.code === 'ERR_WORKER_OUT_OF_MEMORY'
      ? finish(reject, failure('memory', 'The file is too large to check.'))
      : finish(reject, failure('internal', 'Unable to check the file.')));
    worker.once('exit', () => finish(reject, failure('internal', 'Unable to check the file.')));
  });
}
