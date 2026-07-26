// Единый источник версии приложения (semver из package.json).
// Запекается в сборку при `next build` (CI бампит версию ДО сборки образа),
// поэтому /api/health → version всегда соответствует деплоеному образу.
// См. PIPELINE_PROD.js → FT1 (сверка version == NEW_VERSION).

import packageJson from '../../package.json';

export const APP_VERSION: string =
  process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version;
