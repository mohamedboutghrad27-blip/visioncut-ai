/**
 * Seed Neon Postgres from the SQLite dump (db/sqlite-dump.json).
 * Preserves original ids/emails/timestamps. Idempotent: skips users/projects
 * that already exist. Never overwrites existing rows.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

interface DumpUser {
  id: string
  email: string
  name: string | null
  passwordHash: string
  avatarColor: string
  isDemo: boolean
  createdAt: string
  updatedAt: string
}
interface DumpProject {
  id: string
  userId: string
  name: string
  aspectRatio: string
  data: string
  thumbnail: string | null
  isDemo: boolean
  createdAt: string
  updatedAt: string
}
interface Dump {
  users: DumpUser[]
  projects: DumpProject[]
}

async function main() {
  const dump: Dump = JSON.parse(readFileSync('/home/z/my-project/db/sqlite-dump.json', 'utf8'))

  let usersCreated = 0
  for (const u of dump.users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } })
    if (exists) {
      console.log(`user exists, skip: ${u.email}`)
      continue
    }
    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: u.passwordHash,
        avatarColor: u.avatarColor,
        isDemo: u.isDemo,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      },
    })
    usersCreated++
    console.log(`user created: ${u.email} (${u.id})`)
  }

  let projectsCreated = 0
  for (const p of dump.projects) {
    const exists = await prisma.project.findUnique({ where: { id: p.id } })
    if (exists) {
      console.log(`project exists, skip: ${p.name} (${p.id})`)
      continue
    }
    await prisma.project.create({
      data: {
        id: p.id,
        userId: p.userId,
        name: p.name,
        aspectRatio: p.aspectRatio,
        data: p.data,
        thumbnail: p.thumbnail,
        isDemo: p.isDemo,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      },
    })
    projectsCreated++
    console.log(`project created: ${p.name} (${p.id})`)
  }

  const counts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
  }
  console.log(`seed done: +${usersCreated} users, +${projectsCreated} projects; totals:`, counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
