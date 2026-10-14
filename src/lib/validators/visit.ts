import { z } from 'zod';

// Zod-схема визита v2 (см. ADR-002, ADR-014). page — slug страницы (не enum):
// новые страницы не требуют миграций схемы. '/' нормализуется в 'home' на клиенте.
//
// type='enter' (дефолт — старый payload {page, referrer?} валиден без изменений):
//   from     — предыдущая страница вкладки (null = вход);
//   sessionId/visitorId/viewId — анонимные uuid (8..64 симв.), опциональны;
//   utm_*    — метки с посадочной URL (только вход вкладки).
// type='leave': viewId обязателен, dwellMs — время на странице (клампится).

const SLUG_MESSAGE = 'Slug страницы: строчные латиница/цифры/_-/';
const SLUG_RE = /^[a-z0-9/_-]+$/;

export const PAGE_SLUG = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Пустая страница')
  .max(100, 'Слишком длинный slug страницы')
  .regex(SLUG_RE, SLUG_MESSAGE);

const ID_FIELD = z
  .string()
  .trim()
  .min(8, 'Слишком короткий ID')
  .max(64, 'Слишком длинный ID')
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID: латиница/цифры/_-');

const UTM_FIELD = z
  .string()
  .trim()
  .min(1, 'Пустая UTM-метка')
  .max(100, 'Слишком длинная UTM-метка')
  // Серверная санитизация (ADR-014): только [a-zA-Z0-9._-], как на клиенте —
  // в БД не попадают произвольные символы/разметка.
  .transform((value) => value.replace(/[^a-zA-Z0-9._-]/g, '_'));

const DWELL_MS = z
  .number()
  .int('dwellMs должен быть целым')
  .min(0, 'dwellMs не может быть отрицательным')
  .max(1_800_000, 'dwellMs больше 30 минут');

export const visitEnterSchema = z.object({
  type: z.literal('enter').optional(),
  page: PAGE_SLUG.default('home'),
  from: z.union([PAGE_SLUG, z.literal('')]).optional(),
  referrer: z.string().trim().min(1, 'Пустой источник').max(100, 'Слишком длинный источник').optional(),
  sessionId: ID_FIELD.optional(),
  visitorId: ID_FIELD.optional(),
  viewId: ID_FIELD.optional(),
  utmSource: UTM_FIELD.optional(),
  utmMedium: UTM_FIELD.optional(),
  utmCampaign: UTM_FIELD.optional(),
});

export const visitLeaveSchema = z.object({
  type: z.literal('leave'),
  viewId: ID_FIELD,
  dwellMs: DWELL_MS,
});

export const visitSchema = z.union([visitLeaveSchema, visitEnterSchema]);

export type VisitEnterInput = z.infer<typeof visitEnterSchema>;
export type VisitLeaveInput = z.infer<typeof visitLeaveSchema>;
export type VisitSchemaInput = z.infer<typeof visitSchema>;

export function isVisitLeave(input: VisitSchemaInput): input is VisitLeaveInput {
  return input.type === 'leave';
}
