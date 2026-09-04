-- ==========================================================================
-- SCRIPT SQL DE MIGRATION & DÉVERROUILLAGE TOTAL SUPABASE (NEXA PLATFORM)
-- À exécuter dans l'Éditeur SQL de votre tableau de bord Supabase
-- ==========================================================================

-- 1. Table RESTAURANTS
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  whatsapp_contact TEXT,
  city TEXT,
  currency TEXT DEFAULT 'FCFA',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS whatsapp_contact TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'FCFA';
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;

-- 2. Table CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_phone TEXT UNIQUE NOT NULL,
  full_name TEXT,
  points_balance INTEGER DEFAULT 0,
  visits_count INTEGER DEFAULT 0,
  last_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS visits_count INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- 3. Table REWARDS (Étape R8)
CREATE TABLE IF NOT EXISTS public.rewards (
  id TEXT PRIMARY KEY,
  resto_id TEXT NOT NULL,
  restaurant_name TEXT,
  title TEXT NOT NULL,
  "desc" TEXT,
  description TEXT,
  pts INTEGER DEFAULT 20,
  points_required INTEGER DEFAULT 20,
  icon TEXT DEFAULT '🎁',
  image TEXT,
  category TEXT DEFAULT 'Général',
  active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  redemptions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS resto_id TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS restaurant_name TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS "desc" TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS pts INTEGER DEFAULT 20;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS points_required INTEGER DEFAULT 20;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🎁';
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Général';
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS redemptions_count INTEGER DEFAULT 0;
ALTER TABLE public.rewards DISABLE ROW LEVEL SECURITY;

-- 4. Table OFFERS (Étape R9)
CREATE TABLE IF NOT EXISTS public.offers (
  id TEXT PRIMARY KEY,
  resto_id TEXT NOT NULL,
  restaurant_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS resto_id TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS restaurant_name TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.offers DISABLE ROW LEVEL SECURITY;

-- 5. Table SCANS
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_name TEXT,
  client_phone TEXT,
  table_number INTEGER,
  points_earned INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS restaurant_name TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS table_number INTEGER;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 20;
ALTER TABLE public.scans DISABLE ROW LEVEL SECURITY;

-- 6. Table TABLES_QR
CREATE TABLE IF NOT EXISTS public.tables_qr (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resto_id TEXT,
  table_number INTEGER,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tables_qr DISABLE ROW LEVEL SECURITY;
