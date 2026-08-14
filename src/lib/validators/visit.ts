import { z } from 'zod';

// Zod-схема визита (см. ADR-002). page — slug страницы (не enum):
// новые страницы не требуют миграций схемы.
// '/' нормализуется в 'home' на клиенте (VisitTracker).

export const visitSchema = z.object({
  page: z
    .string()
    .trim()
    .min(1, 'Пустая страница')
    .max(100, 'Слишком длинный slug страницы')
    .regex(/^[a-z0-9/_-]*$/, 'Slug страницы: строчные латиница/цифры/_-/')
    .default('home'),
});

export type VisitSchemaInput = z.infer<typeof visitSchema>;
