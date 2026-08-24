import { z } from 'zod';

// Zod-схема события клика по номеру телефона (см. ADR-001, ЧТЗ_Графана_Бизнес_метрики).
// page — где произошёл клик: home / contacts / floating_call / header / service_page.

const PAGE_VALUES = ['home', 'contacts', 'floating_call', 'header', 'service_page'] as const;

export const clickEventSchema = z.object({
  page: z
    .enum(PAGE_VALUES, { message: 'Неизвестная страница клика' })
    .default('home'),
});

export type ClickEventSchemaInput = z.infer<typeof clickEventSchema>;

export const CLICK_EVENT_PAGES = PAGE_VALUES;