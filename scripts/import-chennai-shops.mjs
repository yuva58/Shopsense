#!/usr/bin/env node

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
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
    }
    return chunks
}

function stableHash(input) {
    let hash = 2166136261
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i)
        hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24)
    }
    return hash >>> 0
}

function priceFromHash(seed, min, max) {
    const spread = max - min + 1
    return min + (stableHash(seed) % spread)
}

function normalizeSpaces(text) {
    return text.replace(/\s+/g, ' ').trim()
}

function buildAddress(tags) {
    const firstLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
    const rest = [
        tags['addr:suburb'],
        tags['addr:city'],
        tags['addr:state'],
        tags['addr:postcode'],
    ]
        .filter(Boolean)
        .join(', ')

    let address = [firstLine, rest].filter(Boolean).join(', ')
    if (!address) address = tags['addr:full'] || 'Chennai'
    if (!/chennai/i.test(address)) address = `${address}, Chennai`
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
    // Chennai bounding box (south, west, north, east) reduces timeout risk vs full admin area scan.
    const query = `
[out:json][timeout:90];
(
  node["shop"~"supermarket|convenience|grocery|greengrocer|dairy|bakery|butcher|seafood|department_store|mall"]["name"](12.88,80.12,13.26,80.36);
  way["shop"~"supermarket|convenience|grocery|greengrocer|dairy|bakery|butcher|seafood|department_store|mall"]["name"](12.88,80.12,13.26,80.36);
  relation["shop"~"supermarket|convenience|grocery|greengrocer|dairy|bakery|butcher|seafood|department_store|mall"]["name"](12.88,80.12,13.26,80.36);
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
                    'User-Agent': 'ShopSense Chennai Importer/1.0',
                },
                body: query,
            })
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`)
            }
            json = await response.json()
            break
        } catch (error) {
            lastError = error
        }
    }

    if (!json) {
        throw new Error(
            `Overpass requests failed on all endpoints: ${lastError instanceof Error ? lastError.message : String(lastError)}`
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

        deduped.set(key, {
            osmRef: key,
            name,
            address,
            lat: coords.lat,
            lon: coords.lon,
            shopType,
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

async function insertDemoProductsForImportedShops(supabase, insertedShops) {
    const templates = [
        { name: 'Milk 1L (demo estimate)', category: 'Dairy', min: 52, max: 78 },
        { name: 'Bread 400g (demo estimate)', category: 'Bakery', min: 35, max: 55 },
        { name: 'Eggs 6 pack (demo estimate)', category: 'Poultry', min: 45, max: 75 },
    ]

    const productRows = []
    for (const shop of insertedShops) {
        for (const template of templates) {
            productRows.push({
                shop_id: shop.id,
                name: template.name,
                description: 'Demo product row added to support product search UI on imported OSM shops.',
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
    const maxShops = Number(process.env.CHENNAI_IMPORT_MAX_SHOPS || '300')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
        )
    }
    if (!Number.isFinite(maxShops) || maxShops <= 0) {
        throw new Error('CHENNAI_IMPORT_MAX_SHOPS must be a positive number.')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    console.log(`Fetching Chennai shops from Overpass endpoints: ${overpassEndpoints.join(', ')}`)
    const osmShops = await fetchOsmShops(overpassEndpoints, maxShops)
    if (osmShops.length === 0) {
        throw new Error('No Chennai shops were returned from Overpass.')
    }

    console.log(`Fetched ${osmShops.length} named shops from OSM. Inserting...`)
    const insertedShops = await insertOsmShops(supabase, osmShops)
    const insertedProducts = await insertDemoProductsForImportedShops(supabase, insertedShops)

    console.log(`Imported shops: ${insertedShops.length}`)
    console.log(`Inserted demo products: ${insertedProducts}`)
    console.log('Done. Search for "milk", "bread", or "eggs" to test immediately.')
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
