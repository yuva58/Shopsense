import { createClient } from '@/lib/supabase/server'
import { demoMetroStores } from '@/lib/demo-metro-catalog'
import { NextRequest, NextResponse } from 'next/server'

type Trend = 'rising' | 'falling' | 'stable'
type Recommendation = 'buy_now' | 'wait'

type PricePrediction = {
    trend: Trend
    predicted_price_next_week: number
    recommendation: Recommendation
    confidence: number
    reason: string
    source?: 'ai' | 'fallback'
}

type NearbyRow = {
    shop_id: string
    shop_name: string
    address: string
    distance_metres: number
    product_id: string
    product_name: string
    current_price: number | string
}

type ProductRow = {
    id: string
    shop_id: string
    name: string
    category?: string | null
    current_price: number | string
    shops?: { name?: string | null; address?: string | null } | Array<{ name?: string | null; address?: string | null }> | null
}

type PriceHistoryRow = {
    price: number | string
    recorded_at: string
}

type SearchResult = {
    shop_id: string
    shop_name: string
    address: string
    distance_metres: number
    product_id: string
    product_name: string
    current_price: number
    ai_prediction: PricePrediction
    route_destination: string
    match_reason: string
    is_best_match?: boolean
}

type SearchPayload = {
    query: string
    coverage: string
    used_location: boolean
    note: string
    best_match: SearchResult | null
    results: SearchResult[]
}

const DEFAULT_LIMIT = 8
const DEFAULT_RADIUS_METRES = 60000

const aliasMap: Record<string, string> = {
    paal: 'milk',
    muttai: 'eggs',
    coke: 'coca cola',
    cocacola: 'coca cola',
    cola: 'coca cola',
    thumbsup: 'soft drink',
    thumsup: 'soft drink',
    paste: 'toothpaste',
    soapu: 'soap',
    saboon: 'soap',
    surf: 'detergent',
    biscuit: 'biscuits',
    chips: 'snack',
    cooldrink: 'soft drink',
    soda: 'soft drink',
}

const relatedTerms: Record<string, string[]> = {
    milk: ['dairy', 'curd', 'paneer'],
    eggs: ['egg', 'protein', 'poultry'],
    bread: ['bakery', 'bun'],
    'coca cola': ['soft drink', 'cola', 'beverage'],
    'soft drink': ['coca cola', 'pepsi', 'sprite', 'fanta'],
    toothpaste: ['oral care', 'colgate'],
    detergent: ['washing powder', 'laundry', 'surf excel'],
    soap: ['bath soap', 'body wash', 'hand wash'],
    biscuit: ['cookies', 'snack'],
    biscuits: ['biscuit', 'cookies', 'snack'],
    rice: ['ponni rice', 'basmati', 'grain'],
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const roundInr = (value: number) => Math.max(1, Math.round(value))

const tokenize = (value: string) =>
    value
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter(Boolean)

const normalizeSearchTerm = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[%_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const sanitizeIlikePattern = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[%_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const getShopInfo = (product: ProductRow) =>
    Array.isArray(product.shops) ? product.shops[0] : product.shops

const buildSearchCandidates = (rawQuery: string) => {
    const normalized = normalizeSearchTerm(rawQuery)
    if (!normalized) return []

    const tokens = tokenize(normalized)
    const candidates: string[] = []
    const pushUnique = (value: string) => {
        const cleaned = normalizeSearchTerm(value)
        if (!cleaned || candidates.includes(cleaned)) return
        candidates.push(cleaned)
    }

    pushUnique(normalized)
    for (const token of tokens) pushUnique(token)

    for (const token of tokens) {
        const canonical = aliasMap[token] || token
        pushUnique(canonical)

        if (token.endsWith('ies') && token.length > 3) {
            pushUnique(`${token.slice(0, -3)}y`)
        } else if (token.endsWith('es') && token.length > 3) {
            pushUnique(token.slice(0, -2))
        } else if (token.endsWith('s') && token.length > 2) {
            pushUnique(token.slice(0, -1))
        }

        const related = relatedTerms[canonical]
        if (related) {
            for (const term of related) pushUnique(term)
        }
    }

    return candidates.slice(0, 12)
}

function buildFallbackPrediction(
    currentPrice: number,
    history: Array<{ price: number; recorded_at: string }>
): PricePrediction {
    let trend: Trend = 'stable'
    let nextWeek = currentPrice

    if (history.length >= 2) {
        const newest = history[0].price
        const previous = history[1].price
        const delta = newest - previous
        if (Math.abs(delta) >= 1) {
            trend = delta > 0 ? 'rising' : 'falling'
            nextWeek = newest + delta * 0.5
        }
    }

    const recommendation: Recommendation = trend === 'falling' ? 'wait' : 'buy_now'
    const confidence = history.length >= 10 ? 0.68 : history.length >= 4 ? 0.52 : 0.35
    const trendSummary =
        trend === 'falling'
            ? 'Prices have been trending down in recent local history.'
            : trend === 'rising'
                ? 'Prices have been trending up in recent local history.'
                : 'Prices have been mostly stable in recent local history.'

    const actionSummary =
        recommendation === 'buy_now'
            ? 'Buying now is likely the safer option for this beta estimate.'
            : 'Waiting a few days may help you save if stock remains available.'

    return {
        trend,
        predicted_price_next_week: roundInr(nextWeek),
        recommendation,
        confidence,
        reason: `${trendSummary} ${actionSummary}`,
        source: 'fallback',
    }
}

const scoreResult = (
    result: { product_name: string; shop_name: string; address: string; distance_metres: number; current_price: number },
    normalizedQuery: string,
    tokens: string[]
) => {
    const productName = result.product_name.toLowerCase()
    const shopName = result.shop_name.toLowerCase()
    const address = result.address.toLowerCase()
    let score = 0

    if (normalizedQuery && productName.includes(normalizedQuery)) score += 160
    if (normalizedQuery && shopName.includes(normalizedQuery)) score += 45
    if (normalizedQuery && address.includes(normalizedQuery)) score += 20

    for (const token of tokens) {
        if (productName.includes(token)) score += 35
        if (shopName.includes(token)) score += 12
        if (address.includes(token)) score += 8
    }

    if (result.distance_metres >= 0) {
        score += Math.max(0, 80 - Math.round(result.distance_metres / 1000))
    }

    score += Math.max(0, 60 - result.current_price / 10)
    return score
}

const matchReasonFor = (result: SearchResult, usedLocation: boolean) => {
    if (usedLocation && result.distance_metres >= 0) {
        return 'Best blend of nearby distance, product match, and estimated price.'
    }
    return 'Strong product match from the Chennai metro beta catalog.'
}

const haversineDistanceMetres = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const earthRadius = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const createSearchPayload = (
    results: SearchResult[],
    query: string,
    hasCoords: boolean,
    note: string
): SearchPayload => ({
    query,
    coverage: 'Chennai (incl. Poonamallee / Panimalar), Tiruvallur, Chengalpattu, and Kanchipuram',
    used_location: hasCoords,
    note,
    best_match: results[0] || null,
    results,
})

const searchDemoCatalog = (
    query: string,
    limit: number,
    lat: number,
    lng: number,
    hasCoords: boolean,
    note: string
) => {
    const normalizedQuery = normalizeSearchTerm(query)
    const tokens = tokenize(normalizedQuery)
    const candidates = buildSearchCandidates(query)

    const results = demoMetroStores.flatMap((store) =>
        store.products.map((product) => {
            const searchable = `${product.name} ${product.category}`.toLowerCase()
            const matches = candidates.some((candidate) => searchable.includes(candidate))
            if (!matches) return null

            const history = product.history.map((price, index) => ({
                price,
                recorded_at: new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000).toISOString(),
            }))

            return {
                shop_id: store.id,
                shop_name: store.name,
                address: store.address,
                distance_metres: hasCoords ? haversineDistanceMetres(lat, lng, store.lat, store.lng) : -1,
                product_id: product.id,
                product_name: product.name,
                current_price: product.current_price,
                ai_prediction: buildFallbackPrediction(product.current_price, history),
                route_destination: store.address,
                match_reason: '',
            } satisfies SearchResult
        })
    )
        .filter((result): result is SearchResult => result !== null)
        .sort((a, b) => {
            const scoreDelta = scoreResult(b, normalizedQuery, tokens) - scoreResult(a, normalizedQuery, tokens)
            if (scoreDelta !== 0) return scoreDelta

            const aHasDistance = a.distance_metres >= 0
            const bHasDistance = b.distance_metres >= 0
            if (aHasDistance && bHasDistance && a.distance_metres !== b.distance_metres) {
                return a.distance_metres - b.distance_metres
            }

            return a.current_price - b.current_price
        })
        .slice(0, limit)
        .map((result, index) => ({
            ...result,
            is_best_match: index === 0,
            match_reason: index === 0
                ? matchReasonFor(result, hasCoords)
                : result.distance_metres >= 0
                    ? 'Alternative nearby match from the built-in metro beta demo catalog.'
                    : 'Alternative regional match from the built-in metro beta demo catalog.',
        }))

    return createSearchPayload(results, query, hasCoords, note)
}

async function getPredictionForProduct(
    supabase: Awaited<ReturnType<typeof createClient>>,
    productId: string,
    currentPrice: number
) {
    const { data, error } = await supabase
        .from('price_history')
        .select('price, recorded_at')
        .eq('product_id', productId)
        .order('recorded_at', { ascending: false })
        .limit(90)

    if (error) return buildFallbackPrediction(currentPrice, [])

    const history = ((data || []) as PriceHistoryRow[])
        .map((row) => ({
            price: Number(row.price),
            recorded_at: row.recorded_at,
        }))
        .filter((row) => Number.isFinite(row.price))

    return buildFallbackPrediction(currentPrice, history)
}

async function queryProducts(supabase: Awaited<ReturnType<typeof createClient>>, rawQuery: string) {
    const candidates = buildSearchCandidates(rawQuery)
    const searchPatterns = candidates
        .map(sanitizeIlikePattern)
        .filter((value) => value.length >= 2)
        .slice(0, 10)

    const productsById = new Map<string, ProductRow>()

    const promises = searchPatterns.map(async (pattern) => {
        const { data, error } = await supabase
            .from('products')
            .select('id, shop_id, name, category, current_price, shops(name, address)')
            .or(`name.ilike.%${pattern}%,category.ilike.%${pattern}%`)
            .limit(220)

        if (error) {
            throw new Error(error.message)
        }
        return data as ProductRow[]
    })

    const results = await Promise.all(promises)
    for (const data of results) {
        for (const row of (data || [])) {
            if (!row?.id) continue
            if (!productsById.has(row.id)) {
                productsById.set(row.id, row)
            }
        }
    }

    if (productsById.size > 0) {
        return Array.from(productsById.values())
    }

    return []
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limit = clamp(Number.parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1, 12)
    const lat = Number.parseFloat(searchParams.get('lat') || '')
    const lng = Number.parseFloat(searchParams.get('lng') || '')
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)

    if (q.length < 2) {
        return NextResponse.json({ error: 'Search query must be at least 2 characters.' }, { status: 400 })
    }

    let supabase: Awaited<ReturnType<typeof createClient>>
    try {
        supabase = await createClient()
    } catch {
        return NextResponse.json(
            searchDemoCatalog(
                q,
                limit,
                lat,
                lng,
                hasCoords,
                'Live database unavailable. Showing the built-in Chennai metro beta catalog instead.'
            )
        )
    }

    try {
        const normalizedQuery = normalizeSearchTerm(q)
        const tokens = tokenize(normalizedQuery)
        const candidates = buildSearchCandidates(q)
        const resultsByKey = new Map<string, SearchResult>()

        if (hasCoords) {
            const geoPromises = candidates.map(async (candidate) => {
                const { data, error } = await supabase.rpc('get_nearby_shops', {
                    user_lat: lat,
                    user_lng: lng,
                    radius_metres: DEFAULT_RADIUS_METRES,
                    product_filter: candidate,
                })
                if (error) throw new Error(error.message)
                return data as NearbyRow[]
            })

            const geoResults = await Promise.all(geoPromises)

            for (const data of geoResults) {
                for (const row of (data || [])) {
                    const key = `${row.shop_id}:${row.product_id}`
                    if (resultsByKey.has(key)) continue

                    resultsByKey.set(key, {
                        shop_id: row.shop_id,
                        shop_name: row.shop_name,
                        address: row.address,
                        distance_metres: Number(row.distance_metres),
                        product_id: row.product_id,
                        product_name: row.product_name,
                        current_price: Number(row.current_price),
                        ai_prediction: buildFallbackPrediction(Number(row.current_price), []),
                        route_destination: row.address,
                        match_reason: '',
                    })
                }
            }
        }

        const matchedProducts = await queryProducts(supabase, q)
        for (const product of matchedProducts) {
            const shop = getShopInfo(product)
            const key = `${product.shop_id}:${product.id}`
            if (resultsByKey.has(key)) continue

            resultsByKey.set(key, {
                shop_id: product.shop_id,
                shop_name: shop?.name || 'Unknown store',
                address: shop?.address || 'Address unavailable',
                distance_metres: -1,
                product_id: product.id,
                product_name: product.name,
                current_price: Number(product.current_price),
                ai_prediction: buildFallbackPrediction(Number(product.current_price), []),
                route_destination: shop?.address || 'Address unavailable',
                match_reason: '',
            })
        }

        const ranked = Array.from(resultsByKey.values())
            .sort((a, b) => {
                const scoreDelta = scoreResult(b, normalizedQuery, tokens) - scoreResult(a, normalizedQuery, tokens)
                if (scoreDelta !== 0) return scoreDelta

                const aHasDistance = a.distance_metres >= 0
                const bHasDistance = b.distance_metres >= 0
                if (aHasDistance !== bHasDistance) return aHasDistance ? -1 : 1

                if (aHasDistance && bHasDistance && a.distance_metres !== b.distance_metres) {
                    return a.distance_metres - b.distance_metres
                }

                return a.current_price - b.current_price
            })
            .slice(0, limit)

        const withPredictions = await Promise.all(
            ranked.map(async (result, index) => {
                const prediction = await getPredictionForProduct(supabase, result.product_id, result.current_price)
                return {
                    ...result,
                    ai_prediction: prediction,
                    match_reason: index === 0
                        ? matchReasonFor(result, hasCoords)
                        : result.distance_metres >= 0
                            ? 'Alternative nearby match in the Chennai metro beta coverage area.'
                            : 'Alternative catalog match in the Chennai metro beta coverage area.',
                    is_best_match: index === 0,
                }
            })
        )

        return NextResponse.json(
            createSearchPayload(
                withPredictions,
                q,
                hasCoords,
                hasCoords
                    ? 'Showing estimated availability ranked for your current location.'
                    : 'Location not available. Showing the best estimated matches across the Chennai metro beta region.'
            )
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to complete public search right now.'
        return NextResponse.json(
            searchDemoCatalog(
                q,
                limit,
                lat,
                lng,
                hasCoords,
                `Live database unavailable right now (${message.slice(0, 120)}). Showing the built-in Chennai metro beta catalog instead.`
            )
        )
    }
}
