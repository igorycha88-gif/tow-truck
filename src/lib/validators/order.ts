import { z } from 'zod';
import { isValidRuPhone, normalizePhone } from '@/lib/utils';

// Zod-схема заявки (см. SKILL_DEVELOPER.md §1, ARCHITECTURE.md §3).
// 152-ФЗ: обязательное согласие на обработку ПД (consent === true).

export const orderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Имя должно содержать минимум 2 символа' })
    .max(100, { message: 'Имя слишком длинное' }),
  phone: z
    .string()
    .trim()
    .min(6, { message: 'Укажите номер телефона' })
    .refine(isValidRuPhone, { message: 'Неверный формат российского номера' })
    .transform(normalizePhone),
  // Блок «Адреса» (ЧТЗ_Блок_адресов_в_форме_заявки.md): откуда/куда.
  addressFrom: z
    .string()
    .trim()
    .min(3, { message: 'Укажите адрес, откуда забрать автомобиль' })
    .max(200, { message: 'Слишком длинный адрес' }),
  addressTo: z
    .string()
    .trim()
    .max(200, { message: 'Слишком длинный адрес' })
    .optional()
    .transform((v) => (v ? v : undefined)),
  serviceType: z.enum(
    ['light_vehicle', 'moto', 'commercial', 'offroad', 'accident'],
    { message: 'Выберите тип услуги' },
  ),
  consent: z.literal(true, {
    message: 'Необходимо согласие на обработку персональных данных',
  }),
});

export type OrderSchemaInput = z.infer<typeof orderSchema>;
// consent после transform становится true (boolean literal), см. тип OrderInput.
