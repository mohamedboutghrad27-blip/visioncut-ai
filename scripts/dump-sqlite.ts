/**
 * Dump all rows from the current SQLite database to JSON,
 * so they can be re-seeded into Neon Postgres after the provider switch.
 * Run BEFORE changing prisma/schema.prisma (client is generated for sqlite now).
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  const [users, projects, resets] = await Promise.all([
    prisma.user.findMany(),
    prisma.project.findMany(),
    prisma.passwordReset.findMany(),
  ])

  const dump = {
    dumpedAt: new Date().toISOString(),
    users,
    projects,
    passwordResets: resets,
  }

  mkdirSync('/home/z/my-project/db', { recursive: true })
  writeFileSync('/home/z/my-project/db/sqlite-dump.json', JSON.stringify(dump, null, 2))

  const sum = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => String(r.id).slice(0, 10)).join(', ')

  console.log(`users: ${users.length} [${sum(users)}]`)
  console.log(`projects: ${projects.length} [${sum(projects)}]`)
  console.log(`passwordResets: ${resets.length}`)
  console.log('dump written to db/sqlite-dump.json')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
