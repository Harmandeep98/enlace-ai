-- Runs once, automatically, on first container init (docker-entrypoint-initdb.d).
-- Creates the restricted role apps/api and tests actually connect as — NOT the
-- POSTGRES_USER superuser, which has BYPASS RLS and would defeat every RLS policy
-- (docs/06-database-design.md §2: "apps/api's database role never has BYPASSRLS").
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'enlace_app') THEN
      CREATE ROLE enlace_app WITH LOGIN PASSWORD 'enlace_app_dev' NOSUPERUSER NOBYPASSRLS;
   END IF;
END
$$;

GRANT CONNECT ON DATABASE enlace_dev TO enlace_app;
GRANT USAGE ON SCHEMA public TO enlace_app;
