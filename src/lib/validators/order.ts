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
  location: z
    .string()
    .trim()
    .min(3, { message: 'Укажите адрес или район подачи' })
    .max(200, { message: 'Слишком длинный адрес' }),
  serviceType: z.enum(
    ['light_vehicle', 'moto', 'commercial', 'offroad', 'accident', 'fuel'],
    { message: 'Выберите тип услуги' },
  ),
  consent: z.literal(true, {
    message: 'Необходимо согласие на обработку персональных данных',
  }),
});

export type OrderSchemaInput = z.infer<typeof orderSchema>;
// consent после transform становится true (boolean literal), см. тип OrderInput.
