const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, copyFileSync, symlinkSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

// Run the actual server and SQLite driver against a disposable project copy.
test('watchlist HTTP integration', async t => {
  const root = path.resolve(__dirname, '..');
  const dir = mkdtempSync(path.join(tmpdir(), 'next-up-test-'));
  for (const file of ['server.js', 'database.js']) copyFileSync(path.join(root, file), path.join(dir, file));
  symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
  symlinkSync(path.join(root, 'public'), path.join(dir, 'public'), 'junction');
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let child;
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try { if ((await fetch(`${base}/api/watchlist`)).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(`Server failed to start: ${output}`);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
  }
  t.after(async () => { await stop(); rmSync(dir, { recursive: true, force: true }); });
  async function request(method, route = '', body) {
    const res = await fetch(`${base}/api/watchlist${route}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: res.status, body: await res.json() };
  }
  await start();
  await t.test('uses a numeric fallback when the configured port is occupied', async () => {
    const second = spawn(process.execPath, ['server.js'], {
      cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    second.stdout.on('data', chunk => { output += chunk; });
    second.stderr.on('data', chunk => { output += chunk; });
    try {
      let match;
      for (let i = 0; i < 100; i++) {
        match = output.match(/running at http:\/\/localhost:(\d+)/);
        if (match) break;
        if (second.exitCode !== null) throw new Error(output);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      assert.ok(match, output);
      assert.ok(Number(match[1]) > port && Number(match[1]) <= 65535, output);
      assert.equal((await fetch(`http://127.0.0.1:${match[1]}/api/watchlist`)).status, 200);
    } finally {
      if (second.exitCode === null) {
        const exited = new Promise(resolve => second.once('exit', resolve));
        second.kill(); await exited;
      }
    }
  });
  let id;
  await t.test('serves the page and static assets', async () => {
    for (const route of ['/', '/app.js', '/style.css']) assert.equal((await fetch(base + route)).status, 200);
    assert.match(await (await fetch(base)).text(), /Next-Up/);
  });
  await t.test('lists sample titles with episode fields', async () => {
    const res = await request('GET');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 4);
    assert.equal(res.body.data.find(i => i.title === 'Stranger Things').current_ep, 7);
  });
  await t.test('adds a show to the existing database schema', async () => {
    const res = await request('POST', '', { title: '  Integration Show  ', type: 'show', total_ep: 3 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.title, 'Integration Show');
    assert.equal(res.body.data.total_ep, 3);
    id = res.body.data.id;
  });
  await t.test('updates progress, completes and reopens a show', async () => {
    assert.ok(id);
    let res = await request('PATCH', `/${id}`, { current_ep: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, 'watching');
    res = await request('PATCH', `/${id}`, { current_ep: 99 });
    assert.equal(res.body.data.current_ep, 3);
    assert.equal(res.body.data.status, 'completed');
    res = await request('PATCH', `/${id}`, { current_ep: 2 });
    assert.equal(res.body.data.status, 'watching');
    res = await request('PATCH', `/${id}`, { current_ep: -1 });
    assert.equal(res.body.data.current_ep, 0);
  });
  await t.test('status changes keep progress consistent', async () => {
    assert.ok(id);
    let res = await request('PATCH', `/${id}`, { status: 'completed' });
    assert.equal(res.body.data.current_ep, 3);
    res = await request('PATCH', `/${id}`, { status: 'plan' });
    assert.equal(res.body.data.current_ep, 0);
    res = await request('POST', '', { title: 'Completed movie', status: 'completed' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.current_ep, 1);
  });
  await t.test('supports long episode field aliases', async () => {
    const res = await request('POST', '', { title: 'Alias show', type: 'show', current_episode: 1, total_episodes: 2 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.current_ep, 1);
    assert.equal(res.body.data.status, 'watching');
    const updated = await request('PATCH', `/${res.body.data.id}`, { current_episode: 2 });
    assert.equal(updated.body.data.status, 'completed');
  });
  await t.test('rejects invalid user data with 400 instead of crashing', async () => {
    for (const body of [null, [], { title: 42 }, { title: ' ' }, { title: 'x', type: 'invalid' },
      { title: 'x', status: 'invalid' }, { title: 'x', total_ep: 0 }, { title: 'x', total_ep: 1.5 },
      { title: 'x', current_ep: 'garbage' }, { title: 'x', current_ep: -1 },
      { title: 'x', type: 'show', current_ep: 3, total_ep: 2 }]) {
      assert.equal((await request('POST', '', body)).status, 400, JSON.stringify(body));
    }
    assert.ok(id);
    for (const body of [null, [], {}, { status: 'invalid' }, { current_ep: 0.5 }, { current_ep: 'garbage' }]) {
      assert.equal((await request('PATCH', `/${id}`, body)).status, 400, JSON.stringify(body));
    }
    const malformed = await fetch(`${base}/api/watchlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).success, false);
  });
  await t.test('missing titles return 404', async () => {
    for (const method of ['PATCH', 'DELETE']) {
      assert.equal((await request(method, '/999999', { status: 'plan' })).status, 404);
    }
  });
  await t.test('persists changes across server restarts', async () => {
    assert.ok(id);
    await stop(); await start();
    assert.ok((await request('GET')).body.data.some(i => i.id === id));
  });
  await t.test('deletes titles and keeps an emptied watchlist empty after restart', async () => {
    for (const item of (await request('GET')).body.data) {
      assert.equal((await request('DELETE', `/${item.id}`)).status, 200);
    }
    assert.deepEqual((await request('GET')).body.data, []);
    await stop(); await start();
    assert.deepEqual((await request('GET')).body.data, []);
  });
});
