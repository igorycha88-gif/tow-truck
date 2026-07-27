import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { company } from '@/config/company';

// Заглушка страницы Политики конфиденциальности (152-ФЗ).
// Текст — каркас; заменить на согласованный с юристом при деплое.
export const metadata: Metadata = buildMetadata({
  title: 'Политика конфиденциальности',
  path: '/politika',
  noIndex: true,
});

export default function PolitikaPage() {
  return (
    <section className="container py-16 md:py-24">
      <article className="prose prose-slate mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Политика конфиденциальности</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
        </p>

        <h2 className="mt-8 text-xl font-semibold">1. Общие положения</h2>
        <p className="mt-2 text-muted-foreground">
          Настоящая Политика определяет порядок обработки и защиты персональных данных
          пользователей сайта {company.name} ({company.domain}) в соответствии с
          Федеральным законом № 152-ФЗ «О персональных данных».
        </p>

        <h2 className="mt-8 text-xl font-semibold">2. Какие данные мы обрабатываем</h2>
        <p className="mt-2 text-muted-foreground">
          При отправке заявки через форму на сайте мы обрабатываем: имя, номер телефона,
          адрес (локацию) подачи и выбранный тип услуги.
        </p>

        <h2 className="mt-8 text-xl font-semibold">3. Цели обработки</h2>
        <p className="mt-2 text-muted-foreground">
          Данные используются исключительно для связи с пользователем по его заявке
          на услугу эвакуации.
        </p>

        <h2 className="mt-8 text-xl font-semibold">4. Контакты</h2>
        <p className="mt-2 text-muted-foreground">
          По вопросам обработки персональных данных: {company.name},
          тел. {company.phone}.
        </p>

        <p className="mt-12 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          ⚠️ Это заготовочный текст. Перед публикацией замените на согласованную с юристом редакцию.
        </p>
      </article>
    </section>
  );
}
