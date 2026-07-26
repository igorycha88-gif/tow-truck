import * as React from 'react';

// Компонент для встраивания JSON-LD микроразметки (schema.org).
// Рендерит <script type="application/ld+json">. Используется в layout/страницах.
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data);
  return (
    <script
      type="application/ld+json"
      // Контролируемый нами объект, не пользовательский ввод
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
