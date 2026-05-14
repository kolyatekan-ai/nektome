import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@burmalda.app' },
    update: {},
    create: {
      email: 'alice@burmalda.app',
      username: 'alice',
      displayName: 'Alice',
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@burmalda.app' },
    update: {},
    create: {
      email: 'bob@burmalda.app',
      username: 'bob',
      displayName: 'Bob',
      passwordHash,
    },
  });

  // Create demo server
  const existing = await prisma.server.findFirst({
    where: { name: 'Burmalda HQ', ownerId: alice.id },
  });

  if (!existing) {
    const server = await prisma.server.create({
      data: { name: 'Burmalda HQ', ownerId: alice.id },
    });

    await prisma.channel.createMany({
      data: [
        { serverId: server.id, name: 'general', type: 'TEXT', position: 0 },
        { serverId: server.id, name: 'random', type: 'TEXT', position: 1 },
      ],
    });

    await prisma.role.create({
      data: {
        serverId: server.id,
        name: '@everyone',
        permissions: BigInt(0b11),
      },
    });

    await prisma.member.createMany({
      data: [
        { userId: alice.id, serverId: server.id },
        { userId: bob.id, serverId: server.id },
      ],
    });

    console.log(
      `Seeded server "Burmalda HQ" (invite: ${server.inviteCode}) with members alice, bob`,
    );
  }

  console.log('Demo users:');
  console.log('  alice@burmalda.app / password123');
  console.log('  bob@burmalda.app   / password123');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
