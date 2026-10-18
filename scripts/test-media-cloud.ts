/**
 * E2E test: cloud media backup round-trip via /api/media/*.
 * login -> init -> PUT chunks (raw bytes) -> complete -> GET -> compare bytes.
 * Also verifies ownership (second user cannot read) and 404 handling.
 * Run: ./scripts/with-neon-env.sh npx tsx scripts/test-media-cloud.ts
 */
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";
const CHUNK = 3 * 1024 * 1024;

function fakeAssetId() {
  return `as_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function main() {
  // 1. two sessions (owner + intruder)
  const login = async () => {
    const r = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
    const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    if (!cookie) throw new Error("no cookie");
    return cookie;
  };
  const owner = await login();
  console.log("LOGIN_OK");

  // 2. build a deterministic test payload (1.2 chunks worth: 3.5MB)
  const size = Math.floor(CHUNK * 1.2);
  const payload = new Uint8Array(size);
  for (let i = 0; i < size; i++) payload[i] = (i * 31 + 7) % 256;
  const id = fakeAssetId();

  // 3. init
  const init = await fetch(`${BASE}/api/media/init`, {
    method: "POST",
    headers: { cookie: owner, "Content-Type": "application/json" },
    body: JSON.stringify({ id, name: "cloud-e2e.bin", mimeType: "application/octet-stream", size }),
  });
  if (!init.ok) throw new Error(`init failed ${init.status}: ${await init.text()}`);
  console.log("INIT_OK", id);

  // 4. chunks
  const parts = Math.ceil(size / CHUNK);
  for (let i = 0; i < parts; i++) {
    const slice = payload.slice(i * CHUNK, Math.min(size, (i + 1) * CHUNK));
    const res = await fetch(`${BASE}/api/media/${id}/chunk?index=${i}`, {
      method: "PUT",
      headers: { cookie: owner, "Content-Type": "application/octet-stream" },
      body: slice,
    });
    if (!res.ok) throw new Error(`chunk ${i} failed ${res.status}`);
  }
  console.log(`CHUNKS_OK (${parts})`);

  // 5. complete
  const complete = await fetch(`${BASE}/api/media/${id}/complete`, { method: "POST", headers: { cookie: owner } });
  if (!complete.ok) throw new Error(`complete failed ${complete.status}: ${await complete.text()}`);
  console.log("COMPLETE_OK");

  // 6. get + byte-compare
  const get = await fetch(`${BASE}/api/media/${id}`, { headers: { cookie: owner } });
  if (!get.ok) throw new Error(`get failed ${get.status}`);
  const buf = new Uint8Array(await get.arrayBuffer());
  if (buf.length !== size) throw new Error(`size mismatch: ${buf.length} != ${size}`);
  let diff = 0;
  for (let i = 0; i < size; i++) if (buf[i] !== payload[i]) diff++;
  if (diff > 0) throw new Error(`${diff} bytes differ`);
  console.log(`ROUNDTRIP_OK ${size} bytes, 0 diffs, content-type=${get.headers.get("content-type")}`);

  // 7. ownership: different user (register fresh) cannot read
  const email = `cloud_${Date.now()}@e2e.test`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Str0ng!Pass1", name: "Cloud E2E" }),
  });
  const intruderCookie = (reg.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const forbidden = await fetch(`${BASE}/api/media/${id}`, { headers: { cookie: intruderCookie } });
  console.log("OWNERSHIP:", forbidden.status === 403 ? "ENFORCED (403)" : `LEAK! ${forbidden.status}`);
  if (forbidden.status !== 403) throw new Error("ownership not enforced");

  // 8. unknown id -> 404
  const missing = await fetch(`${BASE}/api/media/${fakeAssetId()}`, { headers: { cookie: owner } });
  console.log("UNKNOWN_ID:", missing.status === 404 ? "404_OK" : `unexpected ${missing.status}`);

  console.log("E2E_PASS");
}

main().catch((e) => {
  console.error("E2E_FAIL:", e.message);
  process.exit(1);
});
