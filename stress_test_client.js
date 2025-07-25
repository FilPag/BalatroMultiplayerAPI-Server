import net from 'net'

const HOST = '127.0.0.1';
const PORT = 8788;
const NUM_CLIENTS = 40000; // Change this for more/less load
const ACTION = JSON.stringify({ action: 'version' }) + '\n';

let clients = [];
let responseTimes = new Array(NUM_CLIENTS).fill(null);
let endedClients = 0;

for (let i = 0; i < NUM_CLIENTS; i++) {
  const client = new net.Socket();
  const startTime = Date.now();
  let responses = 0;

  client.connect(PORT, HOST, () => {
    for (let j = 0; j < 2; j++) {
      client.write(ACTION);
      client.write('INVALID_MESSAGE\n');
    }
    setTimeout(() => client.end(), 100);
  });

  client.on('data', (data) => {
    responses++;
    const elapsed = Date.now() - startTime;
    if (responses === 1) {
      responseTimes[i] = elapsed;
      console.log(`Client ${i} first response time: ${elapsed}ms`);
    }
  });

  client.on('end', () => {
    endedClients++;
    if (endedClients === NUM_CLIENTS) {
      // All clients ended, calculate average
      const validTimes = responseTimes.filter(t => t !== null);
      const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
      console.log(`Average first response time: ${avg.toFixed(2)}ms`);
    }
  });

  client.on('error', (err) => {
    // Ignore connection errors for stress test
  });

  clients.push(client);
}

function spawnClient(i) {
  const client = new net.Socket();
  const startTime = Date.now();
  let responses = 0;

  client.connect(PORT, HOST, () => {
    for (let j = 0; j < 2; j++) {
      client.write(ACTION);
      client.write('INVALID_MESSAGE\n');
    }
    setTimeout(() => client.end(), 100);
  });

  client.on('data', (data) => {
    responses++;
    const elapsed = Date.now() - startTime;
    if (responses === 1) {
      responseTimes[i] = elapsed;
      console.log(`Client ${i} first response time: ${elapsed}ms`);
    }
  });

  client.on('end', () => {
    endedClients++;
    if (endedClients === NUM_CLIENTS) {
      // All clients ended, calculate average
      const validTimes = responseTimes.filter(t => t !== null);
      const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
      console.log(`Average first response time: ${avg.toFixed(2)}ms`);
    }
  });

  client.on('error', (err) => {
    // Ignore connection errors for stress test
  });

  clients.push(client);
}

function staggerClients(i) {
  if (i >= NUM_CLIENTS) return;
  spawnClient(i);
  setTimeout(() => staggerClients(i + 1), 5); // 5ms delay between each client
}

staggerClients(0);

console.log(`Spawned ${NUM_CLIENTS} clients.`);