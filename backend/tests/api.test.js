// backend/tests/api.test.js
// Runs against the REAL app and a SEPARATE test database.
// Run with: npm test
process.env.SESSION_STORE = 'memory';   // tests don't need the MySQL sessions table
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

if (!/_test$/.test(process.env.DB_NAME || '')) {
  throw new Error('Refusing to run: DB_NAME must end with _test (got "' + process.env.DB_NAME + '")');
}

const pool = require('../src/config/db');
const app = require('../src/app');

let server;
let base;

// A tiny client that remembers cookies, like a browser tab.
function makeClient() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    return { status: res.status, data };
  };
}

function future(hours) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const donationBody = (overrides = {}) => ({
  food_name: 'Test rice', description: 'x', category: 'COOKED_MEAL', quantity: 10, unit: 'PORTIONS',
  expires_at: future(5), pickup_area: 'Saket, Delhi', pickup_address: '22 Saket Road, Block C',
  ...overrides
});

async function register(client, name, email, role) {
  return client('POST', '/api/auth/register', { name, email, password: 'password123', role });
}
async function login(client, email) {
  return client('POST', '/api/auth/login', { email, password: 'password123' });
}

let donor, ngo1, ngo2, donor2;

before(async () => {
  await pool.query('DELETE FROM donations');
  await pool.query('DELETE FROM users');
  server = app.listen(0);
  base = 'http://localhost:' + server.address().port;

  donor = makeClient(); donor2 = makeClient(); ngo1 = makeClient(); ngo2 = makeClient();
  await register(donor, 'Donor', 'donor@t.com', 'DONOR');
  await register(donor2, 'Donor Two', 'donor2@t.com', 'DONOR');
  await register(ngo1, 'NGO One', 'ngo1@t.com', 'NGO');
  await register(ngo2, 'NGO Two', 'ngo2@t.com', 'NGO');
  await login(donor, 'donor@t.com');
  await login(donor2, 'donor2@t.com');
  await login(ngo1, 'ngo1@t.com');
  await login(ngo2, 'ngo2@t.com');
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('registering as ADMIN is rejected', async () => {
  const anon = makeClient();
  const r = await register(anon, 'Sneaky', 'sneaky@t.com', 'ADMIN');
  assert.equal(r.status, 400);
  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE email = 'sneaky@t.com'");
  assert.equal(rows[0].n, 0);
});

test('duplicate email gives 409; passwords are stored hashed', async () => {
  const anon = makeClient();
  const r = await register(anon, 'Dup', 'donor@t.com', 'DONOR');
  assert.equal(r.status, 409);
  const [rows] = await pool.query("SELECT password_hash FROM users WHERE email = 'donor@t.com'");
  assert.ok(rows[0].password_hash.startsWith('$2b$'));
  assert.notEqual(rows[0].password_hash, 'password123');
});

test('wrong password and unknown email give the same 401 message', async () => {
  const a = makeClient(), b = makeClient();
  const r1 = await a('POST', '/api/auth/login', { email: 'donor@t.com', password: 'wrongpass1' });
  const r2 = await b('POST', '/api/auth/login', { email: 'nobody@t.com', password: 'password123' });
  assert.equal(r1.status, 401);
  assert.equal(r2.status, 401);
  assert.equal(r1.data.error, r2.data.error);
});

test('protected routes: 401 when logged out, 403 for the wrong role', async () => {
  const anon = makeClient();
  assert.equal((await anon('GET', '/api/donations/mine')).status, 401);
  assert.equal((await ngo1('POST', '/api/donations', donationBody())).status, 403);
  assert.equal((await donor('GET', '/api/donations/available')).status, 403);
  assert.equal((await donor('PATCH', '/api/donations/1/claim')).status, 403);
});

test('donation validation: past deadline and bad category are rejected', async () => {
  const past = await donor('POST', '/api/donations', donationBody({ expires_at: future(-2) }));
  assert.equal(past.status, 400);
  assert.ok(past.data.fields.expires_at);
  const bad = await donor('POST', '/api/donations', donationBody({ category: 'HACKED' }));
  assert.equal(bad.status, 400);
  const qty = await donor('POST', '/api/donations', donationBody({ quantity: 0 }));
  assert.equal(qty.status, 400);
});

test('browse hides the street address; claim reveals it', async () => {
  const created = await donor('POST', '/api/donations', donationBody({ food_name: 'Privacy test' }));
  const id = created.data.donation.id;

  const list = await ngo1('GET', '/api/donations/available');
  const item = list.data.donations.find((d) => d.id === id);
  assert.ok(item);
  assert.equal(item.pickup_address, undefined);
  assert.ok(item.pickup_area);

  const detail = await ngo2('GET', '/api/donations/' + id);
  assert.equal(detail.data.donation.pickup_address, undefined);

  const claim = await ngo1('PATCH', `/api/donations/${id}/claim`);
  assert.equal(claim.status, 200);
  assert.equal(claim.data.donation.pickup_address, '22 Saket Road, Block C');
});

test('ownership: another donor cannot cancel and gets 404', async () => {
  const created = await donor('POST', '/api/donations', donationBody());
  const id = created.data.donation.id;
  const r = await donor2('PATCH', `/api/donations/${id}/cancel`);
  assert.equal(r.status, 404);
  const [rows] = await pool.query('SELECT status FROM donations WHERE id = ?', [id]);
  assert.equal(rows[0].status, 'AVAILABLE');
});

test('cancel works once; cancelled donations cannot be claimed', async () => {
  const id = (await donor('POST', '/api/donations', donationBody())).data.donation.id;
  assert.equal((await donor('PATCH', `/api/donations/${id}/cancel`)).status, 200);
  assert.equal((await donor('PATCH', `/api/donations/${id}/cancel`)).status, 409);
  assert.equal((await ngo1('PATCH', `/api/donations/${id}/claim`)).status, 409);
});

test('expired donations are hidden, cannot be claimed, and become EXPIRED', async () => {
  const id = (await donor('POST', '/api/donations', donationBody())).data.donation.id;
  await pool.query('UPDATE donations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?', [id]);

  const claim = await ngo1('PATCH', `/api/donations/${id}/claim`);
  assert.equal(claim.status, 409);

  const list = await ngo1('GET', '/api/donations/available');
  assert.equal(list.data.donations.find((d) => d.id === id), undefined);

  const mine = await donor('GET', '/api/donations/mine');
  assert.equal(mine.data.donations.find((d) => d.id === id).status, 'EXPIRED');
});

test('status flow: only the claiming NGO or owning donor may mark COLLECTED', async () => {
  const id = (await donor('POST', '/api/donations', donationBody())).data.donation.id;
  assert.equal((await ngo1('PATCH', `/api/donations/${id}/status`, { status: 'COLLECTED' })).status, 404);  // not claimed yet
  await ngo1('PATCH', `/api/donations/${id}/claim`);
  assert.equal((await ngo2('PATCH', `/api/donations/${id}/status`, { status: 'COLLECTED' })).status, 404);  // wrong NGO
  assert.equal((await ngo1('PATCH', `/api/donations/${id}/status`, { status: 'CANCELLED' })).status, 400);  // invalid target
  assert.equal((await ngo1('PATCH', `/api/donations/${id}/status`, { status: 'COLLECTED' })).status, 200);
  assert.equal((await ngo1('PATCH', `/api/donations/${id}/status`, { status: 'COLLECTED' })).status, 409);  // already collected
});

test('RACE: 20 simultaneous claims by two NGOs produce exactly one winner', async () => {
  const id = (await donor('POST', '/api/donations', donationBody({ food_name: 'Race' }))).data.donation.id;
  const attempts = [];
  for (let i = 0; i < 10; i++) {
    attempts.push(ngo1('PATCH', `/api/donations/${id}/claim`));
    attempts.push(ngo2('PATCH', `/api/donations/${id}/claim`));
  }
  const results = await Promise.all(attempts);
  const wins = results.filter((r) => r.status === 200).length;
  const losses = results.filter((r) => r.status === 409).length;
  assert.equal(wins, 1);
  assert.equal(losses, 19);
  const [rows] = await pool.query('SELECT status, claimed_by_ngo_id FROM donations WHERE id = ?', [id]);
  assert.equal(rows[0].status, 'ACCEPTED');
  assert.ok(rows[0].claimed_by_ngo_id);
});

test('malformed JSON returns 400, not a crash', async () => {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad'
  });
  assert.equal(res.status, 400);
});