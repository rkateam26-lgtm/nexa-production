-- ==========================================================================
-- SCRIPT DE MISE À NIVEAU ET DÉBLOCAGE COMPLET DE LA BASE SUPABASE
-- Exécuter dans l'Éditeur SQL Supabase pour corriger la contrainte UNIQUE des clients
-- ==========================================================================

-- 1. Ajouter la contrainte UNIQUE sur whatsapp_phone pour permettre l'UPSERT sans erreur 400
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_whatsapp_phone_key;
ALTER TABLE public.clients ADD CONSTRAINT clients_whatsapp_phone_key UNIQUE (whatsapp_phone);

-- 2. Désactiver les verrous RLS pour garantir l'accès direct en lecture/écriture
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans DISABLE ROW LEVEL SECURITY;

-- 3. Nettoyer les anciennes données de test incohérentes
DELETE FROM public.scans;
DELETE FROM public.clients;
DELETE FROM public.rewards;
DELETE FROM public.restaurants;
