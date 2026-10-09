import WebSocket from 'ws';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Testing WebSocket Server...');

  const ws = new WebSocket('ws://localhost:3000/api/ws');
  await new Promise((res) => ws.on('open', res));

  const received = [];
  ws.on('message', (data) => {
    received.push(JSON.parse(data.toString()));
  });

  ws.send(JSON.stringify({ v: 1, type: 'message:send', payload: { text: 'hello' } }));
  await delay(100);
  console.log('1. Unidentified test:', received.pop()?.payload?.code === 'UNIDENTIFIED' ? 'PASS' : 'FAIL');

  ws.send(JSON.stringify({ v: 1, type: 'user:identify', payload: { username: 'alice' } }));
  await delay(100);
  console.log('2. Welcome test:', received.pop()?.type === 'user:welcome' ? 'PASS' : 'FAIL');

  ws.send(JSON.stringify({ v: 1, type: 'user:identify', payload: { username: 'alice' } }));
  await delay(100);
  console.log('3. Already identified test:', received.pop()?.payload?.code === 'ALREADY_IDENTIFIED' ? 'PASS' : 'FAIL');

  ws.send(JSON.stringify({ v: 1, type: 'message:send', payload: { text: 'hello world' } }));
  await delay(100);
  const broadcast = received.pop();
  console.log('4. Broadcast message test:', broadcast?.payload?.text === 'hello world' && broadcast?.payload?.author === 'alice' ? 'PASS' : 'FAIL');

  ws.send(JSON.stringify({ v: 1, type: 'message:send', payload: { text: '   ' } }));
  await delay(100);
  console.log('5. Empty message test:', received.pop()?.payload?.code === 'VALIDATION_ERROR' ? 'PASS' : 'FAIL');

  ws.send(JSON.stringify({ v: 1, type: 'unknown:test', payload: {} }));
  await delay(100);
  console.log('6. Unknown type test:', received.pop()?.payload?.code === 'UNKNOWN_TYPE' ? 'PASS' : 'FAIL');

  ws.close();

  const wsFatal = new WebSocket('ws://localhost:3000/api/ws');
  await new Promise((res) => wsFatal.on('open', res));
  const closePromise = new Promise((res) => wsFatal.on('close', (code) => res(code)));
  wsFatal.send(JSON.stringify({ v: 2, type: 'user:identify', payload: { username: 'bob' } }));
  const closeCode = await closePromise;
  console.log('7. Protocol version test (code 4001):', closeCode === 4001 ? 'PASS' : 'FAIL');

  console.log('All tests finished successfully.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
