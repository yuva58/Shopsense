#!/usr/bin/env node

import crypto from 'node:crypto'
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
    for (let i = 0; i < input.length; i += 1) {
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

function buildAddress(tags) {
    const firstLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
    const rest = [
        tags['addr:suburb'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:district'] || tags['addr:county'],
        tags['addr:state'],
        tags['addr:postcode'],
    ]
        .filter(Boolean)
        .join(', ')

    let address = [firstLine, rest].filter(Boolean).join(', ')
    if (!address) address = tags['addr:full'] || tags.name || 'Chennai Metro Region'

    if (!address.toLowerCase().includes('tamil nadu')) {
        address = `${address}, Tamil Nadu`
    }

    return normalizeSpaces(address)
}

function readCoordinates(element) {
    if (typeof element.lat === 'number' && typeof element.lon === 'number') {
        return { lat: element.lat, lon: element.lon }
    }
    if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
        return { lat: element.center.lat, lon: element.center.lon }
    }
    return null
}

async function fetchOsmShops(overpassEndpoints, maxShops) {
    const BBOX = '12.35,79.55,13.62,80.45'
    const SHOP_TYPES = [
        'supermarket', 'convenience', 'grocery', 'greengrocer', 'dairy',
        'bakery', 'butcher', 'seafood', 'department_store', 'mall',
        'organic', 'health_food', 'wholesale', 'general', 'variety_store',
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
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'User-Agent': 'ShopSense ChennaiMetro Importer/1.0',
                },
                body: query,
            })
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
            json = await response.json()
            break
        } catch (error) {
            lastError = error
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
        deduped.set(key, {
            osmRef: key,
            name,
            address: buildAddress(tags),
            lat: coords.lat,
            lon: coords.lon,
            shopType: tags.shop || 'shop',
        })
    }

    return Array.from(deduped.values()).slice(0, maxShops)
}

async function insertOsmShops(supabase, shops) {
    const { error: cleanupError } = await supabase
        .from('shops')
        .delete()
        .ilike('description', 'osm_import:%')

    if (cleanupError) {
        throw new Error(`Failed to cleanup previous OSM imports: ${cleanupError.message}`)
    }

    const rows = shops.map((shop) => ({
        name: shop.name,
        description: `osm_import:${shop.osmRef};type=${shop.shopType};scope=chennai_metro`,
        address: shop.address,
        location: `POINT(${shop.lon} ${shop.lat})`,
    }))

    const inserted = []
    for (const chunk of chunkArray(rows, 200)) {
        const { data, error } = await supabase.from('shops').insert(chunk).select('id, name')
        if (error) throw new Error(`Failed to insert shops: ${error.message}`)
        inserted.push(...(data || []))
    }

    return inserted
}

async function insertCuratedProducts(supabase, shops) {
    const templates = [
        { name: 'Milk 1L', category: 'Dairy', min: 48, max: 78 },
        { name: 'Bread 400g', category: 'Bakery', min: 32, max: 55 },
        { name: 'Eggs 6 pack', category: 'Poultry', min: 42, max: 76 },
        { name: 'Coca Cola 750ml', category: 'Soft Drinks', min: 38, max: 58 },
        { name: 'Pepsi 750ml', category: 'Soft Drinks', min: 36, max: 56 },
        { name: 'Detergent Powder 1kg', category: 'Home Care', min: 78, max: 145 },
        { name: 'Bath Soap Pack', category: 'Personal Care', min: 42, max: 96 },
        { name: 'Toothpaste 200g', category: 'Personal Care', min: 84, max: 132 },
        { name: 'Ponni Rice 1kg', category: 'Staples', min: 44, max: 78 },
        { name: 'Sunflower Oil 1L', category: 'Staples', min: 122, max: 178 },
        { name: 'Biscuits Family Pack', category: 'Snacks', min: 28, max: 72 },
        { name: 'Potato 1kg', category: 'Vegetables', min: 18, max: 42 },
    ]

    const productRows = []
    const historyRows = []

    for (const shop of shops) {
        for (const template of templates) {
            const currentPrice = priceFromHash(`${shop.id}:${template.name}`, template.min, template.max)
            const productId = crypto.randomUUID()

            productRows.push({
                id: productId,
                shop_id: shop.id,
                name: template.name,
                description: 'Curated metro-region beta product for public search and estimated availability.',
                current_price: currentPrice,
                category: template.category,
                in_stock: true,
            })

            const historicalSeed = [0.98, 1.0, 1.03, 1.01]
            historicalSeed.forEach((multiplier, index) => {
                historyRows.push({
                    product_id: productId,
                    price: Math.max(1, Math.round(currentPrice * multiplier)),
                    recorded_at: new Date(Date.now() - (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
                })
            })
        }
    }

    for (const chunk of chunkArray(productRows, 300)) {
        const { error } = await supabase.from('products').insert(chunk)
        if (error) throw new Error(`Failed to insert curated products: ${error.message}`)
    }

    for (const chunk of chunkArray(historyRows, 600)) {
        const { error } = await supabase.from('price_history').insert(chunk)
        if (error) throw new Error(`Failed to insert price history: ${error.message}`)
    }

    return { products: productRows.length, history: historyRows.length }
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
    const maxShops = Number(process.env.CHENNAI_METRO_IMPORT_MAX_SHOPS || '900')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    console.log('Fetching Chennai metro region shops from OSM...')
    const shops = await fetchOsmShops(overpassEndpoints, maxShops)
    if (shops.length === 0) {
        throw new Error('No shops were returned for the metro region import.')
    }

    console.log(`Importing ${shops.length} shops...`)
    const insertedShops = await insertOsmShops(supabase, shops)
    const insertedData = await insertCuratedProducts(supabase, insertedShops)

    console.log(`Shops imported: ${insertedShops.length}`)
    console.log(`Products inserted: ${insertedData.products}`)
    console.log(`Price history rows inserted: ${insertedData.history}`)
    console.log('Metro beta import complete.')
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
