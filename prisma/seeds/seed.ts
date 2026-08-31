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
      addressFrom: 'МКАД 50 км',
      addressTo: 'Москва, ул. Тверская, 1',
      serviceType: 'light_vehicle',
      status: 'NEW',
      source: 'seed',
      consentAt: new Date(),
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
