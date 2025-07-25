
// @ts-nocheck
import net from 'net'

const HOST = '192.168.0.179';
const PORT = 8788;
const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS || '5', 10); // Configurable via env
const REQUESTS_PER_CLIENT = parseInt(process.env.REQUESTS_PER_CLIENT || '100', 10); // Configurable via env
const VERSION_ACTION = JSON.stringify({ action: 'version' });

function getVersionAction() {
  return VERSION_ACTION;
}


let endedClients = 0;
let totalResponseSum = 0;
let totalResponseCount = 0;

function spawnClient(i) {
  const client = new net.Socket();
  let responseCount = 0;
  let startTimes = [];
  let responseReceived = new Array(REQUESTS_PER_CLIENT).fill(false);

  client.connect(PORT, HOST, () => {
    for (let j = 0; j < REQUESTS_PER_CLIENT; j++) {
      setTimeout(() => {
        client.write(getVersionAction());
        startTimes[j] = Date.now();
      }, 500 * Math.random());
    }
  });

  client.on('data', async () => {
    // Each response, record time for this request
    if (responseCount < REQUESTS_PER_CLIENT) {
      const elapsed = Date.now() - startTimes[responseCount];
      if (elapsed > 100) {
        console.log(`Warning: Response for client ${i}, request ${responseCount} took ${elapsed}ms`);
      }
      responseCount++;
    }else{
      client.end(); // End client after all requests
    }
  });

  client.on('end', () => {
  });

  client.on('error', () => {
    // Ignore connection errors for stress test
  });
}

function staggerClients(i) {
  if (i >= NUM_CLIENTS) return;
  spawnClient(i);
  if (i % 1000 === 0) {
    // Log progress every 1000 clients
    console.log(`Spawned ${i} clients...`);
  }
  setTimeout(() => staggerClients(i + 1), 2); // 2ms delay for higher throughput
}

staggerClients(0);
