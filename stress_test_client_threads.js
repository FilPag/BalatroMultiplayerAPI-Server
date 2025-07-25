// @ts-nocheck

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import net from 'net';

const filename = fileURLToPath(import.meta.url);

if (isMainThread) {
  // Main thread: spawn 5 workers
  const NUM_THREADS = 5;
  const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS || '25', 10); // total clients
  const REQUESTS_PER_CLIENT = parseInt(process.env.REQUESTS_PER_CLIENT || '100', 10);
  const CLIENTS_PER_THREAD = Math.ceil(NUM_CLIENTS / NUM_THREADS);

  let finishedThreads = 0;
  let totalWarnings = 0;

  for (let t = 0; t < NUM_THREADS; t++) {
    const worker = new Worker(filename, {
      workerData: {
        threadId: t,
        startIdx: t * CLIENTS_PER_THREAD,
        numClients: CLIENTS_PER_THREAD,
        requestsPerClient: REQUESTS_PER_CLIENT
      }
    });
    worker.on('message', (msg) => {
      if (msg.type === 'warning') {
        totalWarnings++;
        console.log(msg.text);
      }
      if (msg.type === 'done') {
        finishedThreads++;
        if (finishedThreads === NUM_THREADS) {
          console.log(`All threads finished. Total warnings: ${totalWarnings}`);
        }
      }
    });
  }
} else {
  // Worker thread: run stress test for a subset of clients
  const HOST = '192.168.0.179';
  const PORT = 8788;
  const VERSION_ACTION = JSON.stringify({ action: 'version' });
  const { threadId, startIdx, numClients, requestsPerClient } = workerData;

  function getVersionAction() {
    return VERSION_ACTION;
  }

  let finishedClients = 0;

  function spawnClient(i) {
    const client = new net.Socket();
    let responseCount = 0;
    let startTimes = [];

    client.connect(PORT, HOST, () => {
      for (let j = 0; j < requestsPerClient; j++) {
        setTimeout(() => {
          client.write(getVersionAction());
          startTimes[j] = Date.now();
        }, 500 * Math.random());
      }
    });

    client.on('data', () => {
      if (responseCount < requestsPerClient) {
        const elapsed = Date.now() - startTimes[responseCount];
        if (elapsed > 100) {
          parentPort.postMessage({ type: 'warning', text: `Thread ${threadId} Client ${i} request ${responseCount} took ${elapsed}ms` });
        }
        responseCount++;
      } else {
        client.end();
      }
    });

    client.on('end', () => {
      finishedClients++;
      if (finishedClients === numClients) {
        parentPort.postMessage({ type: 'done' });
      }
    });

    client.on('error', () => {});
  }

  function staggerClients(i) {
    if (i >= numClients) return;
    spawnClient(i + startIdx);
    setTimeout(() => staggerClients(i + 1), 2);
  }

  staggerClients(0);
}
