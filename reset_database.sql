-- ==========================================================================
-- SCRIPT DE RÉINITIALISATION PROPRE DE LA BASE DE DONNÉES (TESTS PROPRES)
-- Exécuter dans l'Éditeur SQL Supabase pour tout effacer et repartir à zéro
-- ==========================================================================

-- 1. Vider la table des scans de test
TRUNCATE TABLE public.scans RESTART IDENTITY;

-- 2. Vider la table des clients de test
TRUNCATE TABLE public.clients RESTART IDENTITY;

-- 3. Vider la table des récompenses de test
TRUNCATE TABLE public.rewards RESTART IDENTITY;

-- 4. Vider la table des restaurants de test (Optionnel)
TRUNCATE TABLE public.restaurants RESTART IDENTITY;
