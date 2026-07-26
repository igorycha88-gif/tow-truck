/**
 * PIPELINE_PROD.js — Конвейер безопасного продакшн-деплоя проекта «Эвакуация»
 *
 * Это НЕ исполняемый файл. Это ФОРМАЛЬНАЯ СПЕЦИФИКАЦИЯ конвейера
 * продакшн-деплоя, которую AI-агент (opencode) обязан выполнять пошагово.
 *
 * Отличия от основного конвейера:
 *   - PIPELINE.js    → разработка (локально, docker-compose.dev.yml)
 *   - PIPELINE_PROD  → деплой на прод (VPS, main → production)
 *
 * Принцип: ОДИН промпт пользователя → безопасный деплой с откатом.
 * Каждый шаг проверяем, каждый провал — откат.
 *
 * Триггерные фразы пользователя:
 *   «деплой на прод», «задеплой», «деплой в прод», «выложить на прод»,
 *   «push to prod», «deploy to production», «запусти прод деплой»
 *
 * Базовый скилл: SKILL_DEVOPS.md (стандарт работы DevOps)
 * Расширенный скилл: SKILL_DEVOPS_PROD.md (продакшн-специфичные практики)
 *
 * ── КОНФИГУРАЦИЯ ПРОЕКТА (заполнить при первом деплое) ──────────────
 *   VPS_HOST        = <VPS_IP>
 *   VPS_USER        = root
 *   PROJECT_DIR     = /root/tow-truck
 *   DOMAIN          = эвакуация.online
 *   GHCR_IMAGE      = ghcr.io/igorycha88-gif/tow-truck/app
 *   PROD_BRANCH     = main
 *   BLUE_PORT       = 3001
 *   GREEN_PORT      = 3003
 *   CONTAINER       = tow-truck-app
 *   CONTAINER_GREEN = tow-truck-app-green
 *   NGINX_UPSTREAM  = /etc/nginx/conf.d/tow-truck-upstream.conf
 *   DEPLOY_LOG_DIR  = /var/log/tow-truck-deploy
 * ────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════
// 6 ЖЕЛЕЗНЫХ ПРАВИЛ ПРОД ДЕПЛОЯ
// ═══════════════════════════════════════════════════════════════════════

const PROD_RULES = {

  PR1_BACKUP_FIRST: `
    ПРАВИЛО 1: БЭКАП ПРЕЖДЕ ВСЕГО
    Перед ЛЮБЫМ изменением на проде — ОБЯЗАТЕЛЬНО:
    - Бэкап БД (pg_dump)
    - Фиксация текущего состояния контейнеров (docker ps, image tags)
    - Сохранение текущего nginx конфига
    БЭКАП — страховка для отката. Без бэкапа — деплой НЕ начинается.`,

  PR2_BLUE_GREEN: `
    ПРАВИЛО 2: BLUE-GREEN ДЕПЛОЙ
    НИКОГДА не останавливать текущий контейнер до проверки нового.
    Новый контейнер запускается на GREEN_PORT=3003.
    Healthcheck проходит → переключаем nginx → останавливаем старый.
    Если healthcheck провалился — старый контейнер ПРОДОЛЖАЕТ работать.`,

  PR3_VERIFY_EVERY_STEP: `
    ПРАВИЛО 3: ВЕРИФИКАЦИЯ КАЖДОГО ШАГА
    Каждый этап завершается проверкой:
    - Build/Pull → образ существует
    - Start container → healthcheck pass
    - Nginx switch → HTTP 200
    - Smoke tests → все критические эндпоинты отвечают
    Провал любого шага → СТОП + ОТКАТ.`,

  PR4_AUTO_ROLLBACK: `
    ПРАВИЛО 4: АВТОМАТИЧЕСКИЙ ОТКАТ
    При провале healthcheck или smoke tests:
    1. Переключить nginx на предыдущий контейнер
    2. Остановить провалившийся контейнер
    3. Вернуть предыдущий образ (PREVIOUS_IMAGE)
    4. Верифицировать откат
    5. Уведомить через Telegram
    Откат НЕ требует подтверждения пользователя — это автоматическая защита.`,

  PR5_NO_PARTIAL_DEPLOY: `
    ПРАВИЛО 5: ПОЛНАЯ ПЕРЕСБОРКА ОБРАЗА
    На проде Docker-образы — неделимые артефакты.
    ЗАПРЕЩЕНО: обновлять один контейнер, не трогая остальные.
    Каждый деплой — новый Docker-образ целиком (multi-stage build).
    nginx, Redis, PostgreSQL — НЕ пересобираются (они stateful сервисы).`,

  PR6_AUDIT_TRAIL: `
    ПРАВИЛО 6: АУДИТ
    Каждый деплой логируется:
    - timestamp начала/конца
    - предыдущий образ → новый образ
    - commit SHA
    - результат (success / failed / rolled_back)
    - длительность
    - инициатор
    Логи: /var/log/tow-truck-deploy/deploy-YYYYMMDD-HHMMSS.log
    Уведомление: Telegram (success/failure/rollback)`,
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 0: ПРЕДПОСЁЛОЧНАЯ ПРОВЕРКА (Pre-Flight)
// ═══════════════════════════════════════════════════════════════════════

const PREFLIGHT_STAGE = {
  role: "DEVOPS",
  icon: "🔍",
  name: "PRE-FLIGHT CHECK",

  description: `
    Проверка готовности к деплою. Если любой чек проваливается —
    деплой НЕ начинается, выводится причина.`,

  steps: [
    {
      id: "PF1",
      name: "Проверка ветки",
      action: `Убедиться что текущая ветка = main:
        git branch --show-current
        Если НЕ main → ВЫВЕСТИ предупреждение и спросить подтверждение.`,
      critical: true,
    },
    {
      id: "PF2",
      name: "Проверка CI статуса",
      action: `Проверить что последний CI pipeline прошёл:
        gh run list --branch main --limit 1 --json status,conclusion
        Если conclusion != "success" → ВЫВЕСТИ предупреждение.
        Если есть непроведённые тесты → СПРОСИТЬ подтверждение.`,
      critical: true,
    },
    {
      id: "PF3",
      name: "Проверка незакоммиченных изменений",
      action: `git status --porcelain
        Если есть незакоммиченные файлы → ВЫВЕСТИ предупреждение,
        СПРОСИТЬ: «Есть незакоммиченные изменения. Продолжить?»`,
      critical: false,
    },
    {
      id: "PF4",
      name: "Проверка VPS доступности",
      action: `SSH connectivity check:
        ssh -o ConnectTimeout=10 -o BatchMode=yes root@<VPS_IP> "echo OK"
        Если недоступен → деплой НЕ начинается.`,
      critical: true,
    },
    {
      id: "PF5",
      name: "Проверка дискового пространства на VPS",
      action: `ssh root@VPS "df -m /root | tail -1 | awk '{print \$4}'"
        Если свободно < 2GB → ВЫВЕСТИ предупреждение.
        Если свободно < 500MB → деплой НЕ начинается.`,
      critical: true,
    },
    {
      id: "PF6",
      name: "Проверка .env на проде",
      action: `ssh root@VPS "test -f ${PROJECT_DIR}/.env && echo OK || echo MISSING"
        Если .env отсутствует → деплой НЕ начинается.
        Также проверить ключевые переменные: DATABASE_URL, REDIS_URL/REDIS_PASSWORD,
        TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, YANDEX_MAPS_API_KEY, METRIKA_ID.`,
      critical: true,
    },
    {
      id: "PF7",
      name: "Фиксация текущего состояния прода",
      action: `Зафиксировать для возможного отката:
        - Текущий контейнер: docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
        - Текущий образ: docker inspect --format='{{.Config.Image}}' tow-truck-app
        - Текущий nginx upstream: cat /etc/nginx/conf.d/tow-truck-upstream.conf
        - Текущий commit: git rev-parse HEAD
        Сохранить в PREVIOUS_STATE.`,
      critical: true,
    },
  ],

  output: `Pre-flight report:
    ✅/❌ Ветка: main
    ✅/❌ CI: passed
    ✅/❌ VPS: доступен
    ✅/❌ Диск: X MB free
    ✅/❌ .env: OK
    📸 Текущее состояние прода зафиксировано`,
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 0.5: ВЕРСИОНИРОВАНИЕ (Versioning)
// ═══════════════════════════════════════════════════════════════════════

const VERSIONING_STAGE = {
  role: "DEVOPS",
  icon: "🏷️",
  name: "VERSIONING",

  description: `
    Определение и фиксация версии приложения перед деплоем.
    Версия хранится в package.json (semver: MAJOR.MINOR.PATCH).
    Каждый деплой = новая версия. Git tag = vMAJOR.MINOR.PATCH.
    Версия отображается в /api/health → version и в Telegram уведомлениях.`,

  semver: {
    source: "package.json → field: version",
    format: "MAJOR.MINOR.PATCH (semver)",
    current: "Читается из package.json автоматически",
    bump_rules: `
      patch (0.1.0 → 0.1.1): баг-фиксы, мелкие правки, безопасности
      minor (0.1.0 → 0.2.0): новый функционал, новые страницы, новые API
      major (0.1.0 → 1.0.0): breaking changes, смена архитектуры, удаление API`,
  },

  steps: [
    {
      id: "VR1",
      name: "Определение текущей версии",
      action: `Прочитать текущую версию:
        grep '"version"' package.json | head -1 | sed 's/.*: "//;s/".*//'
        Запомнить как CURRENT_VERSION.`,
      critical: true,
    },
    {
      id: "VR2",
      name: "Определение типа изменения (patch / minor / major)",
      action: `Проанализировать что было изменено с предыдущего деплоя:
        git log v${CURRENT_VERSION}..HEAD --oneline   (если тег существует)
        Иначе: git log --oneline -20

        По коммит-сообщениям определить тип:
        - feat! или BREAKING CHANGE → major
        - feat: → minor
        - иначе (fix:, refactor:, chore:, docs:) → patch

        ЗАДАТЬ вопрос пользователю через question tool:
        «Какой тип версионирования?» с вариантами patch/minor/major
        (рекомендуемый — на основе анализа).
        Если пользователь не ответил 2 мин → использовать рекомендуемый.`,
      critical: true,
    },
    {
      id: "VR3",
      name: "Bump версии в package.json",
      action: `npm version ${BUMP_TYPE} --no-git-tag-version
        Запомнить NEW_VERSION.`,
      critical: true,
    },
    {
      id: "VR4",
      name: "Обновление CHANGELOG.md",
      action: `Собрать список изменений:
        git log v${CURRENT_VERSION}..HEAD --pretty=format:"- %s (%h)" --no-merges

        Добавить блок наверх CHANGELOG.md:
        ## [${NEW_VERSION}] - $(date +%Y-%m-%d)
        ### Добавлено / ### Исправлено / ### Изменено
        Если CHANGELOG.md не существует — создать.`,
      critical: false,
    },
    {
      id: "VR5",
      name: "Git commit + tag",
      action: `git add package.json package-lock.json CHANGELOG.md
        git commit -m "chore: release v${NEW_VERSION}"
        git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}: $(date +%Y-%m-%d)"
        НЕ ПУШИТЬ — push будет на этапе BUILD.`,
      critical: true,
    },
    {
      id: "VR6",
      name: "Вывод версионного отчёта",
      action: `Вывести:
        📦 Версия: ${CURRENT_VERSION} → ${NEW_VERSION}
        🏷️  Tag: v${NEW_VERSION}
        📝 Изменений: N коммитов
        Тип: ${BUMP_TYPE}`,
      critical: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 1: БЭКАП (Backup)
// ═══════════════════════════════════════════════════════════════════════

const BACKUP_STAGE = {
  role: "DEVOPS",
  icon: "💾",
  name: "BACKUP",

  steps: [
    {
      id: "BK1",
      name: "Бэкап базы данных",
      action: `Создать бэкап PostgreSQL:
        ssh root@VPS "pg_dump -U postgres -h 127.0.0.1 tow_truck | gzip > ${PROJECT_DIR}/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz"
        Альтернатива через контейнер:
        ssh root@VPS "docker exec tow-truck-db pg_dump -U postgres tow_truck | gzip > ${PROJECT_DIR}/backups/db_....sql.gz"
        Если бэкап провалился → WARN + спросить подтверждение.`,
      critical: true,
    },
    {
      id: "BK2",
      name: "Сохранение nginx конфигурации",
      action: `ssh root@VPS "cp /etc/nginx/conf.d/tow-truck-upstream.conf ${PROJECT_DIR}/backups/nginx-upstream-$(date +%Y%m%d_%H%M%S).conf 2>/dev/null || true"`,
      critical: false,
    },
    {
      id: "BK3",
      name: "Проверка бэкапа",
      action: `Убедиться что бэкап создан и имеет размер > 0:
        ls -la ${PROJECT_DIR}/backups/db_*.sql.gz | tail -1
        Если файл пустой или отсутствует → WARN.`,
      critical: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 2: СБОРКА (Build / Pull)
// ═══════════════════════════════════════════════════════════════════════

const BUILD_STAGE = {
  role: "DEVOPS",
  icon: "🏗️",
  name: "BUILD",

  steps: [
    {
      id: "BD1",
      name: "Push в main (если есть незапушенные коммиты)",
      action: `Проверить: git status и git log origin/main..HEAD
        Если есть незапушенные коммиты → git push origin main --tags
        Push триггерит GitHub Actions CI pipeline (build Docker image → push to GHCR).
        ДОЖДАТЬСЯ завершения CI pipeline (gh run watch).`,
      critical: true,
    },
    {
      id: "BD2",
      name: "Ожидание CI completion",
      action: `Если CI не запущен: gh workflow run ci.yml --ref main
        Отслеживать: gh run list --branch main --limit 1; gh run watch <run_id>
        Таймаут: 15 минут.
        Если CI failed → СТОП. Деплой НЕ продолжается.`,
      critical: true,
    },
    {
      id: "BD3",
      name: "Определение образа для деплоя",
      action: `SHORT_SHA=$(git rev-parse --short HEAD)
        IMAGE_TAG="sha-${SHORT_SHA}"
        IMAGE="${GHCR_IMAGE}:${IMAGE_TAG}"
        Вывести: «Деплой образ: ${IMAGE}»`,
      critical: true,
    },
    {
      id: "BD4",
      name: "Pull образа на VPS",
      action: `ssh root@VPS "docker pull ${IMAGE}"
        Если pull failed → попытаться локальный билд:
        ssh root@VPS "cd ${PROJECT_DIR} && docker compose -f docker-compose.yml build --no-cache app"
        Таймаут: 10 минут.`,
      critical: true,
      on_failure: "Если pull и local build провалились → СТОП (старый контейнер ещё работает).",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 3: ДЕПЛОЙ (Blue-Green)
// ═══════════════════════════════════════════════════════════════════════

const DEPLOY_STAGE = {
  role: "DEVOPS",
  icon: "🚀",
  name: "BLUE-GREEN DEPLOY",

  BLUE_PORT: 3001,
  GREEN_PORT: 3003,
  NGINX_UPSTREAM: "/etc/nginx/conf.d/tow-truck-upstream.conf",

  steps: [
    {
      id: "DP1",
      name: "Очистка старого green контейнера",
      action: `ssh root@VPS "docker rm -f tow-truck-app-green 2>/dev/null || true"`,
      critical: false,
    },
    {
      id: "DP2",
      name: "Запуск GREEN контейнера",
      action: `ssh root@VPS "docker run -d \\
        --name tow-truck-app-green \\
        --network host \\
        --restart no \\
        --env-file ${PROJECT_DIR}/.env \\
        -e PORT=3003 \\
        -e NODE_ENV=production \\
        ${IMAGE}"

        ВАЖНО: --restart no — чтобы при краше не перезапускался автоматически.
        ВАЖНО: BLUE контейнер (tow-truck-app) ПРОДОЛЖАЕТ работать на порту 3001.
        Пользователи ничего не замечают.`,
      critical: true,
    },
    {
      id: "DP3",
      name: "Healthcheck GREEN контейнера",
      action: `Ждём healthcheck на GREEN порту (макс 120 секунд):
        for i in $(seq 1 24); do
          sleep 5
          if curl -sf --max-time 3 "http://127.0.0.1:3003/api/health" | grep -q '"status"'; then break; fi
          if ! docker ps | grep -q tow-truck-app-green; then echo "GREEN container died"; break; fi
        done

        Проверить:
        1. Контейнер RUNNING (docker ps)
        2. HTTP /api/health → 200 + status ok
        3. db и redis ok в ответе
        4. В логах нет fatal/error (docker logs tow-truck-app-green --tail=20)

        Если healthcheck FAILED → АВТОМАТИЧЕСКИЙ ОТКАТ.`,
      critical: true,
      rollback_trigger: true,
    },
    {
      id: "DP4",
      name: "Миграции БД (внутри контейнера)",
      action: `Миграции запускаются автоматически в entrypoint.sh контейнера.
        Проверить что миграция прошла:
        docker logs tow-truck-app-green 2>&1 | grep -i "migration\\|prisma" | tail -5
        Если логи показывают ошибку миграции → ОТКАТ.
        Бэкап БД — страховка.`,
      critical: true,
      rollback_trigger: true,
    },
    {
      id: "DP5",
      name: "Переключение nginx на GREEN",
      action: `ssh root@VPS "cat > /etc/nginx/conf.d/tow-truck-upstream.conf <<EOF
        upstream app {
            server 127.0.0.1:3003;
            keepalive 32;
        }
        EOF
        nginx -t && nginx -s reload"

        ВАЖНО: Это момент когда пользователи начинают видеть новую версию.
        Если nginx -t failed → НЕ переключаем, BLUE продолжает работать.`,
      critical: true,
    },
    {
      id: "DP6",
      name: "Smoke tests на GREEN (через nginx)",
      action: `Проверить критические эндпоинты через nginx (порт 80/443):
        - GET /api/health → 200
        - GET / → 200
        - GET /kontakt → 200
        - POST /api/orders (с тестовыми данными, валидация) → 201/400

        Если любой FAILED → ОТКАТ (переключить nginx обратно на BLUE).`,
      critical: true,
      rollback_trigger: true,
    },
    {
      id: "DP7",
      name: "Остановка BLUE + запуск нового production контейнера",
      action: `После успешных smoke tests:
        1. docker stop tow-truck-app && docker rm tow-truck-app
        2. docker run -d --name tow-truck-app --network host --restart unless-stopped \\
             --env-file ${PROJECT_DIR}/.env \\
             -e PORT=3001 -e NODE_ENV=production ${IMAGE}
        3. Healthcheck нового на 3001
        4. Переключить nginx на 3001
        5. docker rm -f tow-truck-app-green
        Чистое состояние: один контейнер tow-truck-app на порту 3001.`,
      critical: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 4: ВЕРИФИКАЦИЯ (Post-Deploy Verification)
// ═══════════════════════════════════════════════════════════════════════

const VERIFY_STAGE = {
  role: "DEVOPS",
  icon: "✅",
  name: "POST-DEPLOY VERIFICATION",

  steps: [
    {
      id: "VF1",
      name: "Проверка контейнера",
      action: `ssh root@VPS: docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep tow-truck
        Ожидаем: tow-truck-app Up (healthy) + IMAGE = новый образ`,
      critical: true,
    },
    {
      id: "VF2",
      name: "Проверка HTTP",
      action: `curl -sf --max-time 10 "http://127.0.0.1:3001/api/health"
        Ожидаем: {"status":"ok",...}. Проверить db и redis.`,
      critical: true,
    },
    {
      id: "VF3",
      name: "Проверка Redis",
      action: `Из healthcheck ответа: grep -o '"redis":[^,}]*' → ok
        Или redis-cli ping → PONG`,
      critical: true,
    },
    {
      id: "VF4",
      name: "Проверка PostgreSQL",
      action: `pg_isready -h 127.0.0.1 -p 5432; из healthcheck: db → ok`,
      critical: true,
    },
    {
      id: "VF5",
      name: "Проверка логов на ошибки",
      action: `docker logs tow-truck-app --tail=50 2>&1 | grep -iE "error|fatal|panic|NOAUTH|ECONNREFUSED"
        Если найдены → WARN. КРИТИЧЕСКИЕ: fatal/panic/NOAUTH → рассмотреть откат.`,
      critical: false,
    },
    {
      id: "VF6",
      name: "Проверка SSL (через домен)",
      action: `curl -sf --max-time 10 "https://<DOMAIN>/api/health"
        Ожидаем 200 + {"status":"ok"}
        Если failed → WARN (DNS/CDN кеш, подождать 30 сек и retry).`,
      critical: false,
    },
    {
      id: "VF7",
      name: "Полный smoke test (через домен)",
      action: `Проверить через https://<DOMAIN>:
        - GET / → 200
        - GET /api/health → 200
        Записать результаты.`,
      critical: false,
    },
  ],

  criteria: `
    DEPLOYMENT GO — все критические (critical: true) шаги пройдены
    DEPLOYMENT CONDITIONAL — критические пройдены, есть warnings
    DEPLOYMENT NO-GO → АВТОМАТИЧЕСКИЙ ОТКАТ`,
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 4.5: ПОЛНОЕ ТЕСТИРОВАНИЕ НА ПРОДЕ (Full Production Testing)
// ═══════════════════════════════════════════════════════════════════════

const FULL_TESTING_STAGE = {
  role: "DEVOPS",
  icon: "🧪",
  name: "FULL PRODUCTION TESTING",

  description: `
    Комплексное тестирование РАБОТАЮЩЕГО продакшн-сайта ПОСЛЕ деплоя.
    Включает автоматические API-тесты и ручное E2E-тестирование.
    Все тесты выполняются НА ПРОДЕ (https://<DOMAIN>).
    Версия приложения проверяется через /api/health → version.`,

  TEST_URL: "https://<DOMAIN>",
  INTERNAL_URL: "http://127.0.0.1:3001",

  steps: [
    // ── БЛОК A: Автоматические API-тесты ──
    {
      id: "FT1",
      name: "Автотест: Health endpoint (версия + зависимости)",
      action: `curl -sf "http://127.0.0.1:3001/api/health" | python3 -m json.tool
        Проверить: status == "ok", version == NEW_VERSION (СВЕРИТЬ!),
        db.ok == true, db.latencyMs < 500, redis.ok == true, redis.latencyMs < 100.
        Если version != NEW_VERSION → ❌ КРИТИЧЕСКАЯ ОШИБКА.`,
      critical: true,
      rollback_trigger: true,
    },
    {
      id: "FT2",
      name: "Автотест: Критические страницы (HTTP статусы)",
      action: `test_url() {
          CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$1" 2>/dev/null || echo "000")
          [ "$CODE" = "$2" ] && echo "  ✅ $1 → $CODE" || echo "  ❌ $1 → $CODE (exp $2)"
        }
        test_url "https://<DOMAIN>/" "200"
        test_url "https://<DOMAIN>/api/health" "200"
        test_url "https://<DOMAIN>/kontakt" "200"
        Если FAIL > 0 → ❌ КРИТИЧЕСКАЯ ОШИБКА`,
      critical: true,
      rollback_trigger: true,
    },
    {
      id: "FT3",
      name: "Автотест: API функциональность (POST заявки)",
      action: `Проверить что форма заявки валидирует и принимает:
        curl -s -X POST "http://127.0.0.1:3001/api/orders" \\
          -H "Content-Type: application/json" \\
          -d '{"name":"Тест","phone":"invalid"}'
        → ожидаем 400 (валидация телефона)
        (НЕ отправлять реальную заявку на проде через Telegram — только валидацию)`,
      critical: true,
    },
    {
      id: "FT4",
      name: "Автотест: SSL + Security Headers",
      action: `curl -sfI --max-time 10 "https://<DOMAIN>/" | head -20
        Проверить HSTS, X-Frame-Options, X-Content-Type-Options.
        HTTP → HTTPS redirect: ожидаем 301/302.`,
      critical: false,
    },
    {
      id: "FT5",
      name: "Автотест: Время отклика (Performance)",
      action: `Замерить: "/", "/api/health", "/kontakt".
        Если время ответа > 3s → ⚠️ SLOW.
        Для эвакуации скорость критична (LCP < 2.5s).`,
      critical: false,
    },
    {
      id: "FT6",
      name: "Автотест: Логи без ошибок после деплоя",
      action: `docker logs tow-truck-app --since "${DEPLOY_TIME}s" 2>&1 | \\
        grep -iE "error|fatal|panic|unhandled|ENOENT" | \\
        grep -viE "healthcheck|favicon|robots" || echo "✅ Логи чистые"`,
      critical: false,
    },

    // ── БЛОК B: Ручное E2E тестирование ──
    {
      id: "FT7",
      name: "Ручное E2E: Главная страница",
      action: `📋 E2E — ГЛАВНАЯ СТРАНИЦА
        Открой: https://<DOMAIN>
        □ Страница загружается < 2.5s
        □ Sticky-header: телефон видим сверху
        □ Floating-кнопка «Позвонить» видимая
        □ Hero: УТП + телефон + CTA
        □ Секции (услуги, калькулятор, зона, цены, отзывы) отображаются
        □ Футер с контактами и юр. реквизитами
        □ Нет визуальных артефактов
        □ Мобильная: DevTools iPhone 12 — телефон крупный, кнопки min 44px
        Спросить: «Главная страница OK?» (Да/Нет)`,
      critical: true,
      manual_e2e: true,
    },
    {
      id: "FT8",
      name: "Ручное E2E: Калькулятор стоимости",
      action: `📋 E2E — КАЛЬКУЛЯТОР
        □ Выбор типа авто работает
        □ Ввод расстояния — поле принимает значения
        □ Расчёт выполняется, цена отображается
        □ Кнопка «Заказать» открывает/прокручивает к форме
        □ Нет ошибок в консоли (F12)
        Спросить: «Калькулятор OK?» (Да/Нет)`,
      critical: true,
      manual_e2e: true,
    },
    {
      id: "FT9",
      name: "Ручное E2E: Форма заявки",
      action: `📋 E2E — ФОРМА ЗАЯВКИ
        □ Форма отображается корректно
        □ Поля: имя, телефон, локация — работают
        □ Чекбокс согласия на обработку ПД (152-ФЗ) присутствует
        □ Валидация телефона RU формата (отправить «asdf» → ошибка)
        □ Успешная отправка → сообщение об успехе
        □ Проверить: пришло ли уведомление в Telegram оператору
        ВНИМАНИЕ: для реальной отправки — тестовые данные, согласие отмечено.
        Спросить: «Форма заявки OK? Пришло ли в Telegram?»`,
      critical: true,
      manual_e2e: true,
    },
    {
      id: "FT10",
      name: "Ручное E2E: Карта зоны обслуживания",
      action: `📋 E2E — КАРТА
        □ Yandex Maps загружается
        □ Зона покрытия (Москва + МО) отображается
        □ Интерактивность (зум, перемещение) работает
        □ Нет ошибок в консоли (ключ API валиден)
        Спросить: «Карта OK?» (Да/Нет / Пропустить)`,
      critical: false,
      manual_e2e: true,
    },
    {
      id: "FT11",
      name: "Ручное E2E: SEO + Мета-теги",
      action: `TITLE=$(curl -sf "https://<DOMAIN>/" | grep -o '<title>[^<]*</title>' | head -1)
        □ Title содержит «эвакуатор»/«эвакуация»
        □ meta description присутствует
        □ Open Graph теги (og:title, og:description, og:image)
        □ schema.org LocalBusiness в View Source
        □ Yandex.Метрика загружается (Network)
        □ /sitemap.xml доступен
        □ /robots.txt доступен
        Спросить: «SEO OK?» (Да/Нет / Пропустить)`,
      critical: false,
      manual_e2e: true,
    },
    {
      id: "FT12",
      name: "Ручное E2E: Мобильная адаптивность",
      action: `DevTools → iPhone 12 (390x844) и iPad (768x1024):
        □ Бургер-меню работает
        □ Контент не вылезает
        □ Кнопки кликабельны (min 44px), телефон крупный
        □ Формы удобны на мобильном
        □ Нет горизонтального скролла
        Спросить: «Мобильная версия OK?» (Да/Нет / Пропустить)`,
      critical: false,
      manual_e2e: true,
    },

    // ── БЛОК C: Итоговый вердикт ──
    {
      id: "FT13",
      name: "Сводный отчёт тестирования",
      action: `┌─────────────────────────────────────────────────────┐
        │           РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ НА ПРОДЕ          │
        ├─────────────────────────────────────────────────────┤
        │ БЛОК A: Автотесты                                  │
        │  ✅/❌ FT1: Health (версия: X.X.X)                 │
        │  ✅/❌ FT2: HTTP статусы                            │
        │  ✅/❌ FT3: API заявок (валидация)                  │
        │  ⚠️/✅ FT4: SSL + Headers                          │
        │  ⚠️/✅ FT5: Performance                            │
        │  ⚠️/✅ FT6: Логи                                   │
        ├─────────────────────────────────────────────────────┤
        │ БЛОК B: Ручное E2E                                 │
        │  ✅/❌/⏭️ FT7:  Главная                            │
        │  ✅/❌/⏭️ FT8:  Калькулятор                        │
        │  ✅/❌/⏭️ FT9:  Форма заявки (+Telegram)           │
        │  ✅/❌/⏭️ FT10: Карта                              │
        │  ✅/❌/⏭️ FT11: SEO                                │
        │  ✅/❌/⏭️ FT12: Мобильная                          │
        ├─────────────────────────────────────────────────────┤
        │ ВЕРДИКТ: GO / CONDITIONAL GO / NO-GO              │
        └─────────────────────────────────────────────────────┘

        GO → FINALIZE
        CONDITIONAL GO → WARN + продолжить
        NO-GO → АВТОМАТИЧЕСКИЙ ОТКАТ`,
      critical: true,
    },
  ],

  verdict_rules: `
    GO:      Все critical тесты пройдены (✅)
    COND:    Все critical пройдены, есть warnings (⚠️)
    NO-GO:   Хотя бы один critical = ❌ → АВТОМАТИЧЕСКИЙ ОТКАТ

    Если пользователь ответил «Нет» на critical E2E → NO-GO → откат
    Если пользователь ответил «Пропустить» на non-critical E2E → COND → продолжить`,
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП 5: ФИНАЛИЗАЦИЯ (Finalize)
// ═══════════════════════════════════════════════════════════════════════

const FINALIZE_STAGE = {
  role: "DEVOPS",
  icon: "📋",
  name: "FINALIZE",

  steps: [
    {
      id: "FN1",
      name: "Очистка старых образов",
      action: `На VPS удалить старые образы (оставить 10 последних):
        docker image prune -f`,
      critical: false,
    },
    {
      id: "FN2",
      name: "Очистка старых бэкапов",
      action: `find ${PROJECT_DIR}/backups -name "*.sql.gz" -mtime +7 -delete
        find /var/log/tow-truck-deploy -name "*.log" -mtime +30 -delete`,
      critical: false,
    },
    {
      id: "FN3",
      name: "Telegram уведомление — УСПЕХ",
      action: `Отправить:
        ✅ Деплой успешен — Эвакуация
        Версия: v${NEW_VERSION}
        Время: Xs
        URL: https://<DOMAIN>
        Предыдущий: sha-YYYYYYY → Новый: sha-XXXXXXX
        Инициатор: manual (opencode)`,
      critical: false,
    },
    {
      id: "FN4",
      name: "Deployment Report",
      action: `═══════════════════════════════════════════
        🎉 PRODUCTION DEPLOYMENT SUCCESSFUL
        ════════════════════════════════════════════
        📦 Image:  ${GHCR_IMAGE}:sha-XXXXXXX
        🌐 URL:    https://<DOMAIN>
        ⏱️  Time:   Xs
        📊 From:   sha-YYYYYYY → To: sha-XXXXXXX
        💾 Backup: ${PROJECT_DIR}/backups/db_YYYYMMDD.sql.gz
        📝 Log:    /var/log/tow-truck-deploy/deploy-YYYYMMDD.log
        ════════════════════════════════════════════`,
      critical: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// ЭТАП ОТКАТА: ROLLBACK (автоматический или ручной)
// ═══════════════════════════════════════════════════════════════════════

const ROLLBACK_STAGE = {
  role: "DEVOPS",
  icon: "🔄",
  name: "ROLLBACK",

  trigger: `
    Автоматический откат запускается при:
    - GREEN healthcheck failed (Этап 3, DP3)
    - Миграция БД провалена (DP4)
    - Smoke tests failed (DP6)
    - Post-deploy verification NO-GO (Этап 4)
    - Full testing NO-GO (Этап 4.5)

    Ручной откат — по команде: «откат», «rollback», «верни предыдущую версию»`,

  steps: [
    {
      id: "RB1",
      name: "Переключение nginx на BLUE",
      action: `cat > /etc/nginx/conf.d/tow-truck-upstream.conf <<EOF
        upstream app { server 127.0.0.1:3001; keepalive 32; }
        EOF
        nginx -t && nginx -s reload
        Момент возврата трафика к старой версии.`,
      critical: true,
    },
    {
      id: "RB2",
      name: "Остановка GREEN контейнера",
      action: `docker rm -f tow-truck-app-green 2>/dev/null || true`,
      critical: true,
    },
    {
      id: "RB3",
      name: "Восстановление предыдущего контейнера (если BLUE упал)",
      action: `Если tow-truck-app не работает:
        docker run -d --name tow-truck-app --network host --restart unless-stopped \\
          --env-file ${PROJECT_DIR}/.env \\
          -e PORT=3001 -e NODE_ENV=production ${PREVIOUS_IMAGE}
        Ждать healthcheck на 3001 (макс 90 сек). Переключить nginx на 3001.`,
      critical: true,
    },
    {
      id: "RB4",
      name: "Восстановление БД (если миграция повредила данные)",
      action: `ТОЛЬКО если есть признаки повреждения данных:
        1. docker stop tow-truck-app
        2. gunzip -c ${PROJECT_DIR}/backups/db_YYYYMMDD.sql.gz | psql -U postgres tow_truck
        3. Запустить приложение
        ВНИМАНИЕ: деструктивная операция, данные после бэкапа теряются.
        Спросить подтверждение пользователя ПЕРЕД восстановлением БД.`,
      critical: false,
      manual_only: true,
    },
    {
      id: "RB5",
      name: "Верификация после отката",
      action: `docker ps → tow-truck-app Up (healthy)
        curl http://127.0.0.1:3001/api/health → 200
        curl https://<DOMAIN>/ → 200
        Если откат провалился → КРИТИЧЕСКАЯ ОШИБКА → ручное вмешательство.`,
      critical: true,
    },
    {
      id: "RB6",
      name: "Уведомление об откате",
      action: `Telegram:
        🔄 Откат выполнен — Эвакуация
        Причина: [healthcheck failed / smoke test failed / ...]
        Версия: вернулись к sha-YYYYYYY
        Деплой: sha-XXXXXXX → FAILED`,
      critical: false,
    },
  ],

  on_rollback_failure: `
    Если откат тоже провалился:
    1. Вывести: 🚨🚨🚨 ОТКАТ ПРОВАЛИЛСЯ — РУЧНОЕ ВМЕШАТЕЛЬСТВО 🚨🚨🚨
    2. Диагностика:
       - docker ps -a | grep tow-truck
       - docker logs tow-truck-app --tail=100
       - docker logs tow-truck-app-green --tail=100
       - nginx -T 2>&1 | grep upstream
       - df -m /
    3. Команды ручного восстановления (запуск предыдущего образа, psql restore)
    4. CRITICAL уведомление в Telegram`,
};

// ═══════════════════════════════════════════════════════════════════════
// ПОСТДЕПЛОЙНЫЙ МОНИТОРИНГ (Post-Deploy Watch)
// ═══════════════════════════════════════════════════════════════════════

const POSTDEPLOY_WATCH = {
  role: "DEVOPS",
  icon: "👁️",
  name: "POST-DEPLOY WATCH",

  description: `
    После успешного деплоя — 5-минутное наблюдение.
    Не блокирует конвейер, но позволяет заметить проблемы.

    Проверки каждые 60 секунд (5 итераций):
    1. curl /api/health → 200
    2. docker logs --since 60s → нет fatal/panic/OOM
    3. Время ответа /api/health < 2s

    Если проблема найдена → WARN пользователю + предложить откат.`,

  iterations: 5,
  interval_seconds: 60,
};

// ═══════════════════════════════════════════════════════════════════════
// ГРАФ ПЕРЕХОДОВ
// ═══════════════════════════════════════════════════════════════════════

const PROD_PIPELINE_TRANSITIONS = {
  "Pre-Flight → Versioning": { condition: "Все critical проверки пройдены", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "Вывести причину и СТОП" },
  "Versioning → Backup": { condition: "Версия bumped, git tag создан", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "СТОП" },
  "Backup → Build": { condition: "Бэкап БД создан успешно", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "WARN + спросить подтверждение" },
  "Build → Deploy": { condition: "CI passed + образ существует на VPS", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "СТОП — образ недоступен" },
  "Deploy → Verify": { condition: "GREEN healthcheck + smoke tests passed", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "АВТОМАТИЧЕСКИЙ ОТКАТ → Rollback" },
  "Verify → Full Testing": { condition: "Все critical верификации пройдены (GO)", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "АВТОМАТИЧЕСКИЙ ОТКАТ → Rollback" },
  "Full Testing → Finalize": { condition: "GO или CONDITIONAL GO", action: "АВТОМАТИЧЕСКИ продолжить", on_failure: "NO-GO → АВТОМАТИЧЕСКИЙ ОТКАТ → Rollback" },
  "Finalize → Done": { condition: "Отчёт выведен, уведомления отправлены", action: "Вывести итог + начать Post-Deploy Watch" },
  "ЛЮБОЙ ЭТАП → Rollback": { condition: "critical шаг провалился + rollback_trigger = true", action: "АВТОМАТИЧЕСКИЙ ОТКАТ без подтверждения" },
  "Rollback → Done": { condition: "Откат успешен, верификация пройдена", action: "Вывести Rollback Report + уведомления" },
  "Rollback → CRITICAL": { condition: "Откат тоже провалился", action: "Вывести 🚨 + диагностику + команды ручного восстановления" },
};

// ═══════════════════════════════════════════════════════════════════════
// ПОЛНАЯ СХЕМА КОНВЕЙЕРА (визуальная)
// ═══════════════════════════════════════════════════════════════════════
/**
 *
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │              ПОЛЬЗОВАТЕЛЬ: «деплой на прод»                 │
 *    └────────────────────────┬────────────────────────────────────┘
 *                             │
 *                    ┌────────▼────────┐
 *                    │  🔍 PRE-FLIGHT  │  Ветка(main), CI, VPS, диск, .env
 *                    └────────┬────────┘
 *                             │ ✅
 *                    ┌────────▼────────┐
 *                    │  🏷️ VERSIONING  │  bump version, git tag, CHANGELOG
 *                    └────────┬────────┘
 *                             │ ✅
 *                    ┌────────▼────────┐
 *                    │  💾 BACKUP      │  DB dump, nginx config
 *                    └────────┬────────┘
 *                             │ ✅
 *                    ┌────────▼────────┐
 *                    │  🏗️ BUILD       │  push main → CI → pull образ на VPS
 *                    └────────┬────────┘
 *                             │ ✅
 *                    ┌────────▼────────┐
 *                    │  🚀 DEPLOY      │  Blue-Green: GREEN(3003)→nginx→BLUE(3001)
 *                    └───┬────────┬────┘
 *                        │        │
 *                  ✅ OK  │        │ ❌ FAILED
 *                        │        │
 *               ┌────────▼──┐  ┌──▼──────────┐
 *               │ ✅ VERIFY  │  │ 🔄 ROLLBACK  │
 *               └────┬──────┘  └──┬──────────┬┘
 *                    │             │          │
 *              ✅ GO │        ✅ OK │     ❌ FAIL│
 *                    │             │          │
 *          ┌─────────▼──────┐ ┌───▼───┐  ┌──▼──────────┐
 *          │ 🧪 FULL TEST   │ │ Done  │  │ 🚨 CRITICAL │
 *          │ API + E2E      │ │ +rep  │  │ Ручное      │
 *          └──┬────────┬────┘ └───────┘  │ вмешательство│
 *             │        │                  └─────────────┘
 *       ✅ GO │   ❌ NO │
 *             │         │
 *      ┌──────▼───┐ ┌───▼──────────┐
 *      │ 📋 FINAL │ │ 🔄 ROLLBACK  │
 *      │ + NOTIFY │ │ + Telegram   │
 *      └────┬─────┘ └──────────────┘
 *           │
 *    ┌──────▼──────┐
 *    │ 👁️ WATCH     │
 *    │ (5 мин)     │
 *    └─────────────┘
 */
