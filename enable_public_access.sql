-- ==========================================================================
-- SCRIPT SQL DE DÉVERROUILLAGE DES RÈGLES RLS (ACCÈS PUBLIC EN LECTURE/ÉCRITURE)
-- Exécuter dans l'Éditeur SQL Supabase pour autoriser l'accès des clients et restaurateurs
-- ==========================================================================

-- 1. Autoriser la lecture/écriture publique sur les restaurants
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;

-- 2. Autoriser la lecture/écriture publique sur les récompenses
ALTER TABLE public.rewards DISABLE ROW LEVEL SECURITY;

-- 3. Autoriser la lecture/écriture publique sur les clients
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- 4. Autoriser la lecture/écriture publique sur les scans
ALTER TABLE public.scans DISABLE ROW LEVEL SECURITY;

-- 5. Autoriser la lecture/écriture publique sur les tables QR
ALTER TABLE public.tables_qr DISABLE ROW LEVEL SECURITY;
