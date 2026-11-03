import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Crypt } from '../infrastructure/Crypt';
import { env } from '../db';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DB_URI }),
});

async function seedSuperAdmin() {
  const phone = env.SUPERADMIN.PHONE;
  const password = env.SUPERADMIN.PASSWORD;
  const username = env.SUPERADMIN.USERNAME ?? 'superadmin';
  const fullName = env.SUPERADMIN.FULLNAME ?? 'Super Admin';

  if (!phone || !password) {
    console.error(
      'SUPERADMIN_PHONE and SUPERADMIN_PASSWORD environment variables are required.',
    );
    process.exit(1);
  }

  console.log(`Checking SUPERADMIN with phone: ${phone}...`);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ phone }, { username }],
    },
  });

  if (existingUser) {
    console.log(
      `SUPERADMIN or user already exists (id: ${existingUser.id}, username: ${existingUser.username}, role: ${existingUser.role}).`,
    );
    if (existingUser.role !== 'SUPERADMIN') {
      console.log('Upgrading user role to SUPERADMIN...');
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'SUPERADMIN' },
      });
      console.log('User upgraded to SUPERADMIN successfully.');
    }
    await prisma.$disconnect();
    return;
  }

  const hashedPassword = await Crypt.hash(password);

  const superAdmin = await prisma.user.create({
    data: {
      phone,
      username,
      fullName,
      password: hashedPassword,
      role: 'SUPERADMIN',
      isVerified: true,
      status: 'ACTIVE',
    },
  });

  console.log(`SUPERADMIN created successfully with id: ${superAdmin.id}`);
  await prisma.$disconnect();
}

seedSuperAdmin().catch((err) => {
  console.error('Error seeding SUPERADMIN:', err);
  prisma.$disconnect();
  process.exit(1);
});

