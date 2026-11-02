import { parentPort, workerData } from 'node:worker_threads';
import { parseSavedVariables } from './lua-data.js';
import { exportServerDocument } from './model.js';

// Runs in a worker thread so a large upload cannot block the server's event loop.
// Posts the Lua text to store (application records omitted), or the reason it is invalid.
try { parentPort.postMessage({ ok: true, lua: exportServerDocument(parseSavedVariables(workerData)) }); }
catch (error) { parentPort.postMessage({ ok: false, message: error.message }); }
