-- ShopSense Database Schema (PostgreSQL + PostGIS)

-- Enable PostGIS extension for geolocation queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Profiles (Extends Supabase Auth Users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('customer', 'shop_owner', 'admin')) DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Shops
CREATE TABLE public.shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  -- PostGIS Geography Point (Longitude, Latitude)
  location GEOGRAPHY(POINT) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for fast proximity bounding-box searches
CREATE INDEX shops_location_idx ON public.shops USING GIST (location);

-- 3. Products
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  current_price DECIMAL(10, 2) NOT NULL CHECK (current_price >= 0),
  category TEXT,
  in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Price History (For AI Predictions)
CREATE TABLE public.price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public price_history is viewable by everyone." ON public.price_history FOR SELECT USING (true);
-- Inserts to price_history are handled exclusively by the server (Service Role key) which bypasses RLS.

-- 5. Reviews (For AI Sentiment Analysis)
CREATE TABLE public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  -- Populated by OpenAI later
  ai_sentiment_score TEXT CHECK (ai_sentiment_score IN ('positive', 'negative', 'fake', 'pending')) DEFAULT 'pending',
  ai_trust_score DECIMAL(3, 2) CHECK (ai_trust_score >= 0 AND ai_trust_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ── PROFILES POLICIES ────────────────────────────────────────────────────────
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ── SHOPS POLICIES ───────────────────────────────────────────────────────────
CREATE POLICY "Public shops are viewable by everyone." ON public.shops FOR SELECT USING (true);
CREATE POLICY "Shop owners can insert shops." ON public.shops FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Shop owners can update own shops." ON public.shops FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Shop owners can delete own shops." ON public.shops FOR DELETE USING (auth.uid() = owner_id);

-- ── PRODUCTS POLICIES ────────────────────────────────────────────────────────
CREATE POLICY "Public products are viewable by everyone." ON public.products FOR SELECT USING (true);
CREATE POLICY "Shop owners can insert products." ON public.products FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = shop_id)
);
CREATE POLICY "Shop owners can update own products." ON public.products FOR UPDATE USING (
  auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = shop_id)
);
CREATE POLICY "Shop owners can delete own products." ON public.products FOR DELETE USING (
  auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = shop_id)
);

-- ── REVIEWS POLICIES ─────────────────────────────────────────────────────────
CREATE POLICY "Public reviews are viewable by everyone." ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reviews." ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews." ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews." ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PostGIS RPC: get_nearby_shops
-- Called by /api/shops/nearby?lat=&lng=&radius=&product=
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_nearby_shops (
  user_lat        DOUBLE PRECISION,
  user_lng        DOUBLE PRECISION,
  radius_metres   DOUBLE PRECISION DEFAULT 5000,
  product_filter  TEXT            DEFAULT NULL
)
RETURNS TABLE (
  shop_id         UUID,
  shop_name       TEXT,
  address         TEXT,
  distance_metres DOUBLE PRECISION,
  product_id      UUID,
  product_name    TEXT,
  current_price   DECIMAL
) LANGUAGE sql STABLE AS $$
  SELECT
    s.id              AS shop_id,
    s.name            AS shop_name,
    s.address,
    ST_Distance(
      s.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    )                 AS distance_metres,
    p.id              AS product_id,
    p.name            AS product_name,
    p.current_price
  FROM public.shops s
  JOIN public.products p ON p.shop_id = s.id
  WHERE
    p.in_stock = TRUE
    AND ST_DWithin(
          s.location,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_metres
        )
    AND (product_filter IS NULL OR p.name ILIKE '%' || product_filter || '%')
  ORDER BY distance_metres ASC
  LIMIT 50;
$$;
