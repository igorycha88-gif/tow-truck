import { PrismaClient } from '@prisma/client';

// Seed: создаёт тестовые данные для dev (заявки для проверки).
// Запуск: npm run db:seed (после db:push / migrate)

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  // Очищаем только dev-данные (безопасно: только таблица Order)
  await prisma.order.deleteMany({});

  await prisma.order.create({
    data: {
      name: 'Тестовый клиент',
      phone: '+79991234567',
      location: 'МКАД 50 км',
      serviceType: 'light_vehicle',
      status: 'NEW',
      source: 'seed',
    },
  });

  console.log('✅ Seeded 1 test order');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
