import { parentPort, workerData } from 'node:worker_threads';
import { parseSavedVariables } from './lua-data.js';
import { exportDocument } from './model.js';

// Runs in a worker thread so a large upload cannot block the server's event loop.
try { exportDocument(parseSavedVariables(workerData)); parentPort.postMessage({ ok: true }); }
catch (error) { parentPort.postMessage({ ok: false, message: error.message }); }
