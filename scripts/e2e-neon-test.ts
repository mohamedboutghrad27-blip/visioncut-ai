/**
 * End-to-end proof that the app is wired to Neon Postgres:
 * 1. Direct DB probe: SELECT version() + current_setting('neon.project_id')
 * 2. HTTP flow against the running app: login (demo) -> me -> projects CRUD
 *    -> register fresh user -> empty projects -> cleanup.
 * Usage: npx tsx scripts/e2e-neon-test.ts [baseUrl]
 */
import { PrismaClient } from '@prisma/client'

const BASE = process.argv[2] || 'http://localhost:3000'
const prisma = new PrismaClient()

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  const tag = ok ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

async function dbProbe() {
  const version = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`
  const ver = version[0]?.version ?? ''
  const proj = await prisma.$queryRaw<Array<{ pid: string | null }>>`
    SELECT current_setting('neon.project_id', true) AS pid`
  const pooler = process.env.DATABASE_URL?.includes('-pooler') ?? false
  check('DB reachable via Prisma', ver.startsWith('PostgreSQL'), ver.slice(0, 60))
  check('DB is Neon (neon.project_id GUC present)', !!proj[0]?.pid, `project_id=${proj[0]?.pid}`)
  check('DATABASE_URL is pooled (PgBouncer)', pooler, process.env.DATABASE_URL?.replace(/:\/\/[^@]*@/, '://***@') ?? 'unset')
  const counts = { users: await prisma.user.count(), projects: await prisma.project.count() }
  check('Seed data present', counts.users >= 1 && counts.projects >= 1, JSON.stringify(counts))
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, redirect: 'manual' })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    /* not json */
  }
  return { status: res.status, headers: res.headers, body }
}

async function httpFlow() {
  const demo = await api('/api/auth/demo', { method: 'POST' })
  const setCookie = demo.headers.get('set-cookie') ?? ''
  const cookie = setCookie.split(';')[0]
  check('POST /api/auth/demo -> 200 (DB user lookup + session insert)', demo.status === 200, `status=${demo.status}`)
  if (!cookie) return

  const me = await api('/api/auth/me', { headers: { cookie } })
  const meEmail = (me.body as { user?: { email?: string } })?.user?.email
  check('GET /api/auth/me -> 200 with user from Neon', me.status === 200 && !!meEmail, `email=${meEmail}`)

  const created = await api('/api/projects', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Neon E2E Proof', aspectRatio: '16:9' }),
  })
  const proj = created.body as { project?: { id?: string; name?: string } }
  const pid = proj?.project?.id
  check('POST /api/projects -> 201 (DB write)', created.status === 201 || created.status === 200, `id=${pid}`)

  const list = await api('/api/projects', { headers: { cookie } })
  const listed = (list.body as { projects?: Array<{ id: string }> })?.projects?.some((p) => p.id === pid)
  check('GET /api/projects lists the new project (DB read)', !!listed)

  const dup = await api(`/api/projects/${pid}/duplicate`, { method: 'POST', headers: { cookie } })
  const dupId = (dup.body as { project?: { id?: string } })?.project?.id
  check('POST /api/projects/[id]/duplicate -> ok', dup.status === 200 || dup.status === 201, `dup=${dupId}`)

  const del1 = await api(`/api/projects/${dupId}`, { method: 'DELETE', headers: { cookie } })
  const del2 = await api(`/api/projects/${pid}`, { method: 'DELETE', headers: { cookie } })
  check('DELETE /api/projects/[id] x2 -> ok (DB delete)', del1.status < 400 && del2.status < 400)

  const suffix = Math.random().toString(36).slice(2, 8)
  const reg = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Neon Tester', email: `neon-e2e-${suffix}@visioncut.ai`, password: 'TestPass!234' }),
  })
  check('POST /api/auth/register -> ok (DB insert)', reg.status === 200 || reg.status === 201, `status=${reg.status}`)

  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `neon-e2e-${suffix}@visioncut.ai`, password: 'TestPass!234' }),
  })
  const c2 = (login.headers.get('set-cookie') ?? '').split(';')[0]
  check('POST /api/auth/login -> 200 (scrypt verify + session)', login.status === 200)

  if (c2) {
    const fresh = await api('/api/projects', { headers: { cookie: c2 } })
    const n = (fresh.body as { projects?: unknown[] })?.projects?.length
    check('Fresh user has 0 projects', fresh.status === 200 && n === 0, `count=${n}`)
  }

  const demoUser = await prisma.user.findUnique({ where: { email: 'demo@visioncut.ai' } })
  if (demoUser) {
    const orphans = await prisma.project.count({ where: { userId: demoUser.id, name: 'Neon E2E Proof' } })
    check('Cleanup verified (proof projects removed)', orphans === 0)
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: 'neon-e2e-' } } })
}

async function main() {
  await dbProbe()
  await httpFlow()
  console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((e) => {
    console.error('E2E run error:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
