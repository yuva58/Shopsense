#!/usr/bin/env node
// import-tamilnadu-shops.mjs
// Imports OSM shops from all of Tamil Nadu (not just Chennai) into Supabase.
// Run: node scripts/import-tamilnadu-shops.mjs
// Env overrides:
//   OVERPASS_ENDPOINT            — custom Overpass endpoint
//   TAMILNADU_IMPORT_MAX_SHOPS   — max shops to import (default 1500)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const equalIndex = line.indexOf('=')
        if (equalIndex <= 0) continue
        const key = line.slice(0, equalIndex).trim()
        const value = line.slice(equalIndex + 1).trim()
        if (!(key in process.env)) process.env[key] = value
    }
}

function chunkArray(items, size) {
    const chunks = []
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
    return chunks
}

function stableHash(input) {
    let hash = 2166136261
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i)
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return hash >>> 0
}

function priceFromHash(seed, min, max) {
    return min + (stableHash(seed) % (max - min + 1))
}

function normalizeSpaces(text) {
    return text.replace(/\s+/g, ' ').trim()
}

function buildAddress(tags, fallbackState = 'Tamil Nadu') {
    const firstLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
    const rest = [
        tags['addr:suburb'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:district'],
        tags['addr:state'],
        tags['addr:postcode'],
    ]
        .filter(Boolean)
        .join(', ')

    let address = [firstLine, rest].filter(Boolean).join(', ')
    if (!address) address = tags['addr:full'] || tags['name'] || fallbackState

    // Ensure state context is present for Tamil Nadu shops outside Chennai
    if (!/tamil\s*nadu/i.test(address) && !/chennai/i.test(address)) {
        address = `${address}, Tamil Nadu`
    }
    return normalizeSpaces(address)
}

function readCoordinates(element) {
    if (typeof element.lat === 'number' && typeof element.lon === 'number') {
        return { lat: element.lat, lon: element.lon }
    }
    if (
        element.center &&
        typeof element.center.lat === 'number' &&
        typeof element.center.lon === 'number'
    ) {
        return { lat: element.center.lat, lon: element.center.lon }
    }
    return null
}

async function fetchOsmShops(overpassEndpoints, maxShops) {
    // Full Tamil Nadu bounding box (south, west, north, east)
    // Covers Chennai, Thiruvallur, Kancheepuram, Vellore, Coimbatore, Madurai, etc.
    const BBOX = '8.07,76.23,13.56,80.40'

    // Expanded shop types: covers supermarkets, grocers, vegetable/fruit shops,
    // dry goods, dairy, bakeries, butchers, seafood, wholesale, spice shops.
    const SHOP_TYPES = [
        'supermarket', 'convenience', 'grocery', 'greengrocer', 'dairy',
        'bakery', 'butcher', 'seafood', 'department_store', 'mall',
        'farm', 'health_food', 'organic', 'wholesale', 'variety_store',
        'general', 'frozen_food', 'nuts', 'spices', 'deli',
    ].join('|')

    const query = `
[out:json][timeout:120];
(
  node["shop"~"${SHOP_TYPES}"]["name"](${BBOX});
  way["shop"~"${SHOP_TYPES}"]["name"](${BBOX});
  relation["shop"~"${SHOP_TYPES}"]["name"](${BBOX});
);
out center;
`

    let json = null
    let lastError = null
    for (const endpoint of overpassEndpoints) {
        try {
            console.log(`  Trying endpoint: ${endpoint}`)
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'User-Agent': 'ShopSense TamilNadu Importer/2.0',
                },
                body: query,
            })
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
            json = await response.json()
            console.log(`  Success from: ${endpoint}`)
            break
        } catch (error) {
            lastError = error
            console.warn(`  Failed: ${endpoint} — ${error.message}`)
        }
    }

    if (!json) {
        throw new Error(
            `All Overpass endpoints failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`
        )
    }

    const elements = Array.isArray(json.elements) ? json.elements : []
    const deduped = new Map()

    for (const element of elements) {
        const tags = element.tags || {}
        const name = normalizeSpaces(tags.name || '')
        const coords = readCoordinates(element)
        if (!name || !coords) continue

        const key = `${element.type}/${element.id}`
        const address = buildAddress(tags)
        const shopType = tags.shop || 'shop'

        deduped.set(key, { osmRef: key, name, address, lat: coords.lat, lon: coords.lon, shopType })
    }

    const all = Array.from(deduped.values())
    console.log(`  ${elements.length} OSM elements → ${all.length} unique named shops (before cap)`)
    return all.slice(0, maxShops)
}

async function insertOsmShops(supabase, shops) {
    // Clean up previous Tamil Nadu OSM imports (both old Chennai and new TN tags)
    const { error: cleanupError } = await supabase
        .from('shops')
        .delete()
        .ilike('description', 'osm_import:%')

    if (cleanupError) {
        throw new Error(`Failed to cleanup previous OSM imports: ${cleanupError.message}`)
    }

    const rows = shops.map((shop) => ({
        name: shop.name,
        description: `osm_import:${shop.osmRef};type=${shop.shopType}`,
        address: shop.address,
        location: `POINT(${shop.lon} ${shop.lat})`,
    }))

    const inserted = []
    for (const chunk of chunkArray(rows, 200)) {
        const { data, error } = await supabase
            .from('shops')
            .insert(chunk)
            .select('id, name, description')
        if (error) throw new Error(`Failed to insert shops: ${error.message}`)
        inserted.push(...(data || []))
    }

    return inserted
}

async function insertDemoProducts(supabase, insertedShops) {
    // 12 product templates — covers vegetables, fruits, dairy, staples, bakery, poultry.
    const templates = [
        // Vegetables
        { name: 'Potato (per kg)', category: 'Vegetables', min: 18, max: 45 },
        { name: 'Onion (per kg)', category: 'Vegetables', min: 20, max: 60 },
        { name: 'Tomato (per kg)', category: 'Vegetables', min: 15, max: 80 },
        { name: 'Carrot (per kg)', category: 'Vegetables', min: 25, max: 55 },
        // Fruits
        { name: 'Banana (dozen)', category: 'Fruits', min: 30, max: 60 },
        { name: 'Apple (per kg)', category: 'Fruits', min: 80, max: 180 },
        // Dairy
        { name: 'Milk 1L', category: 'Dairy', min: 52, max: 78 },
        { name: 'Curd 500g', category: 'Dairy', min: 30, max: 55 },
        // Staples
        { name: 'Ponni Rice (per kg)', category: 'Staples', min: 40, max: 70 },
        { name: 'Toor Dal (per kg)', category: 'Staples', min: 80, max: 140 },
        // Bakery
        { name: 'Bread 400g', category: 'Bakery', min: 35, max: 55 },
        // Poultry
        { name: 'Eggs (6 pack)', category: 'Poultry', min: 45, max: 75 },
    ]

    const productRows = []
    for (const shop of insertedShops) {
        for (const template of templates) {
            productRows.push({
                shop_id: shop.id,
                name: template.name,
                description: 'Demo product added by Tamil Nadu OSM import.',
                current_price: priceFromHash(`${shop.id}:${template.name}`, template.min, template.max),
                category: template.category,
                in_stock: true,
            })
        }
    }

    let insertedCount = 0
    for (const chunk of chunkArray(productRows, 300)) {
        const { error } = await supabase.from('products').insert(chunk)
        if (error) throw new Error(`Failed to insert demo products: ${error.message}`)
        insertedCount += chunk.length
    }

    return insertedCount
}

async function main() {
    loadEnvFile(path.join(projectRoot, '.env.local'))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const configuredEndpoint = process.env.OVERPASS_ENDPOINT
    const overpassEndpoints = configuredEndpoint
        ? [configuredEndpoint]
        : [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter',
        ]
    const maxShops = Number(process.env.TAMILNADU_IMPORT_MAX_SHOPS || '1500')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    }
    if (!Number.isFinite(maxShops) || maxShops <= 0) {
        throw new Error('TAMILNADU_IMPORT_MAX_SHOPS must be a positive number.')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    console.log(`\nShopSense — Tamil Nadu Shop Importer v2.0`)
    console.log(`Max shops: ${maxShops}`)
    console.log(`Querying Overpass API (Tamil Nadu bounding box: 8.07°N–13.56°N, 76.23°E–80.40°E)...\n`)

    const osmShops = await fetchOsmShops(overpassEndpoints, maxShops)
    if (osmShops.length === 0) {
        throw new Error('No Tamil Nadu shops were returned from Overpass. Try again later.')
    }

    console.log(`\nInserting ${osmShops.length} shops into Supabase (cleaning previous OSM import first)...`)
    const insertedShops = await insertOsmShops(supabase, osmShops)

    console.log(`Seeding demo products (12 per shop)...`)
    const insertedProducts = await insertDemoProducts(supabase, insertedShops)

    console.log(`\n✅  Done!`)
    console.log(`   Shops imported  : ${insertedShops.length}`)
    console.log(`   Products seeded : ${insertedProducts}`)
    console.log(`\nSearch for "potato", "milk", "Nilgiris", "onion" etc. to verify.`)
}

main().catch((error) => {
    console.error('\n❌ Import failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
})
