-- ─────────────────────────────────────────────────────────────────────
-- TASK-INF-002: readonly-пользователь для postgres_exporter
-- (ЧТЗ «Централизованный мониторинг», §4.4).
--
-- Роль pg_monitor: доступ к мониторинговым view БЕЗ суперпользователя.
-- Пароль передаётся аргументом скрипта setup-user.sh (в git НЕ хранится).
--
-- Выполнить в БД tow_truck (VPS):
--   docker exec -i tow-truck-db psql -U postgres -d tow_truck \
--     < deploy/postgres-exporter/create-monitoring-user.sql
-- (скрипт сам подставит пароль из переменной окружения)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres_exporter') THEN
    CREATE ROLE postgres_exporter LOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
      PASSWORD :'exporter_password';
  ELSE
    ALTER ROLE postgres_exporter PASSWORD :'exporter_password';
  END IF;
END
$$;

GRANT pg_monitor TO postgres_exporter;

-- CONNECTION LIMIT: мониторингу достаточно одного подключения.
ALTER ROLE postgres_exporter CONNECTION LIMIT 3;
