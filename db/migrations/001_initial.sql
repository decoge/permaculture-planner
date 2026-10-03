-- Permaculture Planner schema for standard Postgres.
-- Replaces Supabase Auth (auth.users) and row-level security.
-- Ownership is enforced in the application queries.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE surface_type AS ENUM ('soil', 'hard', 'rooftop', 'concrete');
CREATE TYPE plan_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE task_category AS ENUM (
  'build', 'plant', 'maintain', 'harvest', 'water', 'fertilize', 'cover', 'maint'
);
CREATE TYPE water_source AS ENUM ('spigot', 'rain', 'none', 'drip');
CREATE TYPE season AS ENUM ('spring', 'summer', 'fall', 'winter');
CREATE TYPE sowing_method AS ENUM ('direct', 'transplant', 'succession');
CREATE TYPE plant_family AS ENUM (
  'Solanaceae', 'Brassicaceae', 'Cucurbitaceae', 'Fabaceae',
  'Allium', 'Apiaceae', 'Asteraceae', 'Amaranthaceae', 'Poaceae', 'Other'
);
CREATE TYPE bed_shape AS ENUM ('rect', 'circular', 'keyhole', 'spiral');
CREATE TYPE orientation AS ENUM ('NS', 'EW');

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  country_code VARCHAR(2),
  usda_zone VARCHAR(3),
  last_frost DATE,
  first_frost DATE,
  surface_type surface_type NOT NULL DEFAULT 'soil',
  slope_pct DECIMAL(5, 2),
  shade_notes TEXT,
  water_source water_source DEFAULT 'spigot',
  constraints_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status plan_status NOT NULL DEFAULT 'draft',
  scene_json JSONB,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shape bed_shape NOT NULL DEFAULT 'rect',
  length_ft DECIMAL(5, 2) NOT NULL CHECK (length_ft > 0 AND length_ft <= 100),
  width_ft DECIMAL(5, 2) NOT NULL CHECK (width_ft > 0 AND width_ft <= 100),
  height_in DECIMAL(4, 1) NOT NULL DEFAULT 12 CHECK (height_in >= 6 AND height_in <= 48),
  orientation orientation NOT NULL DEFAULT 'NS',
  surface surface_type NOT NULL DEFAULT 'soil',
  wicking BOOLEAN NOT NULL DEFAULT FALSE,
  trellis BOOLEAN NOT NULL DEFAULT FALSE,
  path_clearance_in DECIMAL(4, 1) NOT NULL DEFAULT 18,
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0,
  position_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  family plant_family NOT NULL,
  days_to_maturity_min INT,
  days_to_maturity_max INT,
  spacing_in DECIMAL(4, 1) NOT NULL,
  depth_in DECIMAL(3, 2),
  water_needs TEXT,
  sun_needs TEXT,
  companions TEXT[],
  antagonists TEXT[],
  frost_hardy BOOLEAN NOT NULL DEFAULT FALSE,
  heat_tolerant BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
  season season NOT NULL,
  year INT NOT NULL,
  crop_id UUID REFERENCES public.crops(id),
  variety TEXT,
  spacing_in DECIMAL(4, 1) NOT NULL,
  family plant_family NOT NULL,
  target_days_to_maturity INT,
  sowing_method sowing_method NOT NULL DEFAULT 'direct',
  sow_date DATE,
  transplant_date DATE,
  harvest_start DATE,
  harvest_end DATE,
  successions_json JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category task_category NOT NULL,
  due_on DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  recurring_pattern TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.materials_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  soil_cuft DECIMAL(8, 2),
  compost_cuft DECIMAL(8, 2),
  mulch_cuft DECIMAL(8, 2),
  lumber_boardfeet DECIMAL(8, 2),
  screws_count INT,
  drip_line_ft DECIMAL(8, 2),
  emitters_count INT,
  row_cover_sqft DECIMAL(8, 2),
  cost_estimate_cents INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[],
  weather JSONB,
  images TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id UUID NOT NULL REFERENCES public.plantings(id) ON DELETE CASCADE,
  harvested_on DATE NOT NULL,
  quantity DECIMAL(8, 2),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lat, lng, date)
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_beds_updated_at BEFORE UPDATE ON public.beds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plantings_updated_at BEFORE UPDATE ON public.plantings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materials_estimates_updated_at BEFORE UPDATE ON public.materials_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sites_user_id ON public.sites(user_id);
CREATE INDEX idx_plans_site_id ON public.plans(site_id);
CREATE INDEX idx_plans_status ON public.plans(status);
CREATE INDEX idx_beds_plan_id ON public.beds(plan_id);
CREATE INDEX idx_plantings_bed_id ON public.plantings(bed_id);
CREATE INDEX idx_plantings_season_year ON public.plantings(season, year);
CREATE INDEX idx_tasks_plan_id ON public.tasks(plan_id);
CREATE INDEX idx_tasks_due_on ON public.tasks(due_on);
CREATE INDEX idx_tasks_completed ON public.tasks(completed);
CREATE INDEX idx_journal_entries_plan_id ON public.journal_entries(plan_id);
CREATE INDEX idx_harvests_planting_id ON public.harvests(planting_id);
CREATE INDEX idx_weather_cache_coords ON public.weather_cache(lat, lng, date);
CREATE INDEX idx_users_is_admin ON public.users(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

-- Read-only compatibility view for older admin queries that expected profiles.
CREATE VIEW public.profiles AS
SELECT
  id,
  email,
  full_name,
  name,
  avatar_url,
  preferences,
  is_admin,
  created_at,
  updated_at
FROM public.users;
