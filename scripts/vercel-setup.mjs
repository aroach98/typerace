// One-shot Vercel project setup for type.andrewroach.xyz.
// Env in: VERCEL_TOKEN, SUPABASE_PAT. Prints NO secret values.
// Creates the project (framework: vite), sets the two public VITE_* env vars
// from the Supabase Management API, and attaches the custom domain.
const V = 'https://api.vercel.com';
const TOKEN = process.env.VERCEL_TOKEN;
const PAT = process.env.SUPABASE_PAT;
const REF = process.env.SUPABASE_REF || 'aoxaoqqbrenkhnmhrlmu';
const PROJECT = process.env.VERCEL_PROJECT_NAME || 'typerace';
const DOMAIN = process.env.DOMAIN || 'type.andrewroach.xyz';

if (!TOKEN || !PAT) {
  console.error('missing VERCEL_TOKEN or SUPABASE_PAT');
  process.exit(1);
}

async function v(method, path, body) {
  const res = await fetch(V + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

const teams = await v('GET', '/v2/teams');
const team = teams.j.teams?.find((t) => /andrew.?projects/i.test(t.slug) || /andrew projects/i.test(t.name)) ?? teams.j.teams?.[0];
if (!team) throw new Error('no team found');
console.log(`team: ${team.slug} (${team.id})`);
const tq = `teamId=${team.id}`;

let proj = await v('GET', `/v9/projects/${PROJECT}?${tq}`);
if (proj.status === 404) {
  proj = await v('POST', `/v10/projects?${tq}`, { name: PROJECT, framework: 'vite' });
  if (proj.status >= 300) throw new Error(`create project: ${proj.status} ${JSON.stringify(proj.j).slice(0, 300)}`);
  console.log('project created');
} else {
  console.log('project exists');
}
console.log(`project id: ${proj.j.id}`);

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${PAT}` },
});
if (!keysRes.ok) throw new Error(`supabase keys: ${keysRes.status}`);
const keys = await keysRes.json();
const pub = keys.find((k) => k.type === 'publishable')?.api_key ?? keys.find((k) => k.name === 'anon')?.api_key;
if (!pub) throw new Error('publishable/anon key not found');
console.log(`supabase key: fetched (${pub.startsWith('sb_') ? 'publishable' : 'legacy anon'}, not shown)`);

const envs = [
  ['VITE_SUPABASE_URL', `https://${REF}.supabase.co`],
  ['VITE_SUPABASE_ANON_KEY', pub],
];
for (const [key, value] of envs) {
  const r = await v('POST', `/v10/projects/${PROJECT}/env?${tq}&upsert=true`, {
    key,
    value,
    type: 'plain',
    target: ['production', 'preview'],
  });
  console.log(`env ${key}: ${r.status < 300 ? 'set' : `FAILED ${r.status} ${JSON.stringify(r.j).slice(0, 200)}`}`);
}

const dom = await v('POST', `/v10/projects/${PROJECT}/domains?${tq}`, { name: DOMAIN });
if (dom.status < 300) console.log(`domain ${DOMAIN}: attached (verified=${dom.j.verified})`);
else if (dom.status === 409) console.log(`domain ${DOMAIN}: already attached`);
else console.log(`domain ${DOMAIN}: FAILED ${dom.status} ${JSON.stringify(dom.j).slice(0, 300)}`);

console.log('vercel setup complete');
