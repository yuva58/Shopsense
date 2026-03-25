-- Migration: Add `source` column to shops for indexed, fast OSM cleanup
-- Run this once in the Supabase SQL editor before the next import.

-- 1. Add the source column (nullable so existing rows are unaffected)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS source TEXT;

-- 2. GIN trigram index for fast ILIKE, plus a plain btree for exact match (cleanup)
CREATE INDEX IF NOT EXISTS shops_source_btree_idx ON public.shops (source);
CREATE INDEX IF NOT EXISTS shops_source_trgm_idx  ON public.shops USING GIN (source gin_trgm_ops);

-- 3. Backfill: tag existing OSM rows that used the old description marker
UPDATE public.shops
SET    source = 'osm_chennai_metro'
WHERE  source IS NULL
  AND  description ILIKE 'osm_import:%';
