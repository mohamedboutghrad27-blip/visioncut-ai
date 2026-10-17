import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const users = await p.user.count();
  const projects = await p.project.count();
  const host = (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || "unknown";
  console.log(`DB_OK host=${host} users=${users} projects=${projects}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("DB_FAIL", e.message);
    process.exit(1);
  });
