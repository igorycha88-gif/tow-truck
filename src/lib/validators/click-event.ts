import { z } from 'zod';

// Zod-схема события трекинга (ADR-001; ЧТЗ_Сайт_эвакуация_online_Полные_
// Бизнес_Метрики.md §2.1/§2.4): click_phone — клик по tel:-ссылке;
// service_click — клик по карточке/пункту услуги.
// page — где произошёл клик (slug, как в visitSchema);
// service — slug услуги (обязателен для service_click);
// referrer — источник сессии (host | (direct)), вычислен клиентом.

export const EVENT_TYPES = ['click_phone', 'service_click'] as const;

const SLUG_RE = /^[a-z0-9/_-]+$/;

export const clickEventSchema = z
  .object({
    eventType: z
      .enum(EVENT_TYPES, { message: 'Неизвестный тип события' })
      .default('click_phone'),
    page: z
      .string()
      .trim()
      .min(1, 'Пустая страница')
      .max(100, 'Слишком длинный slug страницы')
      .regex(SLUG_RE, 'Slug страницы: строчные латиница/цифры/_-/')
      .default('home'),
    service: z
      .string()
      .trim()
      .min(1, 'Пустой slug услуги')
      .max(100, 'Слишком длинный slug услуги')
      .regex(SLUG_RE, 'Slug услуги: строчные латиница/цифры/_-/')
      .optional(),
    referrer: z.string().trim().min(1, 'Пустой источник').max(100, 'Слишком длинный источник').optional(),
  })
  .refine((data) => data.eventType !== 'service_click' || Boolean(data.service), {
    message: 'service_click требует service',
    path: ['service'],
  });

export type ClickEventSchemaInput = z.infer<typeof clickEventSchema>;
