import { PrismaClient, UserRole, PlanType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@leadhunter.ai' },
    update: {},
    create: {
      email: 'admin@leadhunter.ai',
      password: adminPassword,
      name: 'Admin',
      role: UserRole.SUPER_ADMIN,
      plan: PlanType.ENTERPRISE,
      emailVerified: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  const userPassword = await bcrypt.hash('User1234!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@leadhunter.ai' },
    update: {},
    create: {
      email: 'user@leadhunter.ai',
      password: userPassword,
      name: 'Usuário Demo',
      role: UserRole.USER,
      plan: PlanType.FREE,
      emailVerified: true,
    },
  });
  console.log('✅ Demo user created:', user.email);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
