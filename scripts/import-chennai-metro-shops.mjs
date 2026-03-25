#!/usr/bin/env node
/**
 * ShopSense – Chennai Metro OSM Shop Importer (v3)
 *
 * Key changes from v2:
 *  - Cleanup uses chunked DELETE (200 IDs at a time) to avoid statement timeout
 *    (no dependency on `source` column schema-cache being ready)
 *  - BBOX focused on 15 km radius around Panimalar Engineering College
 *  - Products inserted in concurrent batches (5 parallel chunks of 300)
 *  - Price history in concurrent batches (5 parallel chunks of 600)
 *  - Full progress logging
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// ─── ENV ──────────────────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return
    for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i <= 0) continue
        const key = line.slice(0, i).trim()
        const val = line.slice(i + 1).trim()
        if (!(key in process.env)) process.env[key] = val
    }
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function chunkArray(items, size) {
    const chunks = []
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
    return chunks
}

async function pooledAll(items, concurrency, fn) {
    const results = []
    for (const batch of chunkArray(items, concurrency)) {
        results.push(...(await Promise.all(batch.map(fn))))
    }
    return results
}

function stableHash(input) {
    let h = 2166136261
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
    }
    return h >>> 0
}

const priceFromHash = (seed, min, max) => min + (stableHash(seed) % (max - min + 1))
const normalizeSpaces = (t) => t.replace(/\s+/g, ' ').trim()

function buildAddress(tags) {
    const line1 = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
    const rest = [
        tags['addr:suburb'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:district'] || tags['addr:county'],
        tags['addr:state'],
        tags['addr:postcode'],
    ].filter(Boolean).join(', ')

    let addr = [line1, rest].filter(Boolean).join(', ')
    if (!addr) addr = tags['addr:full'] || tags.name || 'Poonamallee, Chennai'
    if (!addr.toLowerCase().includes('tamil nadu')) addr += ', Tamil Nadu'
    return normalizeSpaces(addr)
}

function readCoordinates(el) {
    if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon }
    if (el.center?.lat != null) return { lat: el.center.lat, lon: el.center.lon }
    return null
}

// ─── OSM FETCH ────────────────────────────────────────────────────────────────

// Panimalar Engineering College: lat 13.0506, lon 80.0761 (Poonamallee, Chennai)
const PANIMALAR_LAT = 13.0506
const PANIMALAR_LON = 80.0761
const R_LAT = 0.135  // ~15 km N-S
const R_LON = 0.153  // ~15 km E-W at 13°N

const BBOX = [
    (PANIMALAR_LAT - R_LAT).toFixed(4),
    (PANIMALAR_LON - R_LON).toFixed(4),
    (PANIMALAR_LAT + R_LAT).toFixed(4),
    (PANIMALAR_LON + R_LON).toFixed(4),
].join(',')

const SHOP_TYPES = [
    'supermarket', 'convenience', 'grocery', 'greengrocer', 'dairy',
    'bakery', 'butcher', 'seafood', 'department_store', 'mall',
    'organic', 'health_food', 'wholesale', 'general', 'variety_store',
    'stationery', 'chemist', 'pharmacy', 'hardware', 'electronics',
    'kiosk', 'gift', 'toys', 'clothes', 'books', 'florist', 'mobile',
    'beverages', 'confectionery', 'frozen_food',
].join('|')

async function fetchOsmShops(endpoints, maxShops) {
    const query = `[out:json][timeout:120];
(
  node["shop"~"${SHOP_TYPES}"]["name"](${BBOX});
  way["shop"~"${SHOP_TYPES}"]["name"](${BBOX});
  relation["shop"~"${SHOP_TYPES}"]["name"](${BBOX});
);
out center;`

    let json = null
    for (const endpoint of endpoints) {
        try {
            console.log(`  Trying: ${endpoint}`)
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'User-Agent': 'ShopSense/3.0' },
                body: query,
                signal: AbortSignal.timeout(130_000),
            })
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
            json = await res.json()
            console.log(`  ✓ Got data from ${endpoint}`)
            break
        } catch (e) {
            console.warn(`  ✗ ${endpoint}: ${e.message}`)
        }
    }

    if (!json) throw new Error('All Overpass endpoints failed.')

    const deduped = new Map()
    for (const el of (json.elements || [])) {
        const tags = el.tags || {}
        const name = normalizeSpaces(tags.name || '')
        const coords = readCoordinates(el)
        if (!name || !coords) continue
        const key = `${el.type}/${el.id}`
        deduped.set(key, { osmRef: key, name, address: buildAddress(tags), lat: coords.lat, lon: coords.lon, shopType: tags.shop || 'shop' })
    }

    return [...deduped.values()].slice(0, maxShops)
}

// ─── CLEANUP ──────────────────────────────────────────────────────────────────

/**
 * Chunked delete: first fetches IDs of all OSM-imported shops (via description
 * pattern), then deletes them 200 at a time by primary key — fast, indexed, no timeout.
 */
async function cleanupPreviousImport(supabase) {
    console.log('  Fetching IDs of previous OSM import...')

    // Fetch only IDs (very fast, no cascade work yet)
    const { data, error } = await supabase
        .from('shops')
        .select('id')
        .ilike('description', 'type=%,%')   // matches "type=convenience" style from v2+
        .not('description', 'ilike', 'Curated%')
        .limit(50000)

    if (error) {
        console.warn(`  ⚠  Could not fetch existing shop IDs: ${error.message}. Skipping cleanup.`)
        return 0
    }

    const ids = (data || []).map((r) => r.id)
    if (ids.length === 0) {
        console.log('  No previous OSM shops found — nothing to clean.')
        return 0
    }

    console.log(`  Deleting ${ids.length} previously imported shops in chunks...`)
    let deleted = 0
    for (const chunk of chunkArray(ids, 200)) {
        const { error: delErr } = await supabase.from('shops').delete().in('id', chunk)
        if (delErr) {
            console.warn(`  ⚠  Delete chunk failed: ${delErr.message}`)
            continue
        }
        deleted += chunk.length
        process.stdout.write(`\r  Deleted: ${deleted} / ${ids.length}`)
    }
    console.log(`\n  ✓ Cleanup done. ${deleted} shops removed (products cascade-deleted automatically).`)
    return deleted
}

// ─── INSERT SHOPS ─────────────────────────────────────────────────────────────

async function insertOsmShops(supabase, shops) {
    // Note: `source` column intentionally omitted here until PostgREST schema
    // cache refreshes (ALTER TABLE was run, but REST API not restarted yet).
    // Use `description` field to mark OSM rows (backward-compatible).
    const rows = shops.map((s) => ({
        name: s.name,
        description: `type=${s.shopType}`,
        address: s.address,
        location: `POINT(${s.lon} ${s.lat})`,
    }))

    const inserted = []
    const chunks = chunkArray(rows, 300)
    for (let i = 0; i < chunks.length; i++) {
        const { data, error } = await supabase.from('shops').insert(chunks[i]).select('id, name')
        if (error) throw new Error(`Insert shops chunk ${i + 1}: ${error.message}`)
        inserted.push(...(data || []))
        process.stdout.write(`\r  Shops: ${inserted.length} / ${rows.length}`)
    }
    console.log(`\n  ✓ ${inserted.length} shops inserted.`)
    return inserted
}

// ─── INSERT PRODUCTS ──────────────────────────────────────────────────────────

async function insertCuratedProducts(supabase, shops) {
    const templates = [
        { name: 'Milk 1L',              category: 'Dairy',         min: 48,  max: 78  },
        { name: 'Bread 400g',           category: 'Bakery',        min: 32,  max: 55  },
        { name: 'Eggs 6 pack',          category: 'Poultry',       min: 42,  max: 76  },
        { name: 'Coca Cola 750ml',      category: 'Soft Drinks',   min: 38,  max: 58  },
        { name: 'Pepsi 750ml',          category: 'Soft Drinks',   min: 36,  max: 56  },
        { name: 'Detergent Powder 1kg', category: 'Home Care',     min: 78,  max: 145 },
        { name: 'Bath Soap Pack',       category: 'Personal Care', min: 42,  max: 96  },
        { name: 'Toothpaste 200g',      category: 'Personal Care', min: 84,  max: 132 },
        { name: 'Ponni Rice 1kg',       category: 'Staples',       min: 44,  max: 78  },
        { name: 'Sunflower Oil 1L',     category: 'Staples',       min: 122, max: 178 },
        { name: 'Biscuits Family Pack', category: 'Snacks',        min: 28,  max: 72  },
        { name: 'Potato 1kg',          category: 'Vegetables',    min: 18,  max: 42  },
        { name: 'Notebook 200 Pages',  category: 'Stationery',    min: 45,  max: 80  },
        { name: 'Ballpoint Pen Pack',  category: 'Stationery',    min: 30,  max: 60  },
        { name: 'Paracetamol 500mg',   category: 'Pharmacy',      min: 25,  max: 45  },
    ]

    const productRows = []
    const historyRows = []

    for (const shop of shops) {
        for (const t of templates) {
            const price = priceFromHash(`${shop.id}:${t.name}`, t.min, t.max)
            const pid = crypto.randomUUID()
            productRows.push({ id: pid, shop_id: shop.id, name: t.name, description: 'Beta catalog.', current_price: price, category: t.category, in_stock: true })
            ;[0.98, 1.0, 1.03, 1.01].forEach((m, idx) => {
                historyRows.push({ product_id: pid, price: Math.max(1, Math.round(price * m)), recorded_at: new Date(Date.now() - (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString() })
            })
        }
    }

    let pDone = 0
    await pooledAll(chunkArray(productRows, 300), 5, async (chunk) => {
        const { error } = await supabase.from('products').insert(chunk)
        if (error) throw new Error(`Products insert: ${error.message}`)
        pDone += chunk.length
        process.stdout.write(`\r  Products: ${pDone} / ${productRows.length}`)
    })
    console.log()

    let hDone = 0
    await pooledAll(chunkArray(historyRows, 600), 5, async (chunk) => {
        const { error } = await supabase.from('price_history').insert(chunk)
        if (error) throw new Error(`History insert: ${error.message}`)
        hDone += chunk.length
        process.stdout.write(`\r  Price history: ${hDone} / ${historyRows.length}`)
    })
    console.log()

    return { products: productRows.length, history: historyRows.length }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
    const t0 = Date.now()
    loadEnvFile(path.join(projectRoot, '.env.local'))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars.')

    const endpoints = process.env.OVERPASS_ENDPOINT
        ? [process.env.OVERPASS_ENDPOINT]
        : [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter',
        ]

    const maxShops = Number(process.env.CHENNAI_METRO_IMPORT_MAX_SHOPS || '5000')

    console.log('════════════════════════════════════════════════════')
    console.log('  ShopSense – Panimalar Area Importer v3')
    console.log(`  Centre: lat ${PANIMALAR_LAT}, lon ${PANIMALAR_LON} (Poonamallee)`)
    console.log(`  BBOX  : ${BBOX}  (~15 km radius)`)
    console.log(`  Max   : ${maxShops} shops`)
    console.log('════════════════════════════════════════════════════\n')

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    console.log('[1/5] Cleaning up previous import...')
    await cleanupPreviousImport(supabase)

    console.log('\n[2/5] Fetching shops from OSM Overpass...')
    const shops = await fetchOsmShops(endpoints, maxShops)
    if (!shops.length) throw new Error('No shops returned from OSM.')
    console.log(`  ✓ ${shops.length} unique shops found in the Panimalar bbox.`)

    console.log('\n[3/5] Inserting shops...')
    const inserted = await insertOsmShops(supabase, shops)

    console.log('\n[4/5] Inserting curated products & price history...')
    const totals = await insertCuratedProducts(supabase, inserted)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\n[5/5] ✅  Done in ${elapsed}s`)
    console.log(`       Shops: ${inserted.length}  |  Products: ${totals.products}  |  History: ${totals.history}`)
    console.log('════════════════════════════════════════════════════')
}

main().catch((e) => {
    console.error('\n❌  Import failed:', e instanceof Error ? e.message : String(e))
    process.exit(1)
})
