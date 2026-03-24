import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type ProductRow = {
    id: string
    shop_id: string
    name: string
    category?: string | null
    current_price: number | string
    shops?: { name?: string | null; address?: string | null } | Array<{ name?: string | null; address?: string | null }> | null
}

const FOOD_KEYWORDS = [
    'milk', 'bread', 'egg', 'rice', 'dal', 'lentil', 'oil', 'flour', 'atta',
    'vegetable', 'fruit', 'potato', 'onion', 'tomato', 'carrot', 'beans',
    'chicken', 'mutton', 'fish', 'seafood', 'paneer', 'curd', 'yogurt',
    'spice', 'masala', 'salt', 'sugar', 'tea', 'coffee', 'biscuit', 'snack',
    'bakery', 'dairy', 'grocery', 'meat', 'poultry'
]

const isFoodProduct = (product: ProductRow) => {
    const searchable = `${product.name || ''} ${product.category || ''}`.toLowerCase()
    return FOOD_KEYWORDS.some((keyword) => searchable.includes(keyword))
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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

const getShopInfo = (product: ProductRow) =>
    Array.isArray(product.shops) ? product.shops[0] : product.shops

const toSearchText = (product: ProductRow) => {
    const shop = getShopInfo(product)
    return `${product.name || ''} ${product.category || ''} ${shop?.name || ''} ${shop?.address || ''}`
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

const matchesSearch = (product: ProductRow, normalizedSearch: string, searchTokens: string[]) => {
    const text = toSearchText(product)
    if (!text) return false
    if (normalizedSearch && text.includes(normalizedSearch)) return true
    if (searchTokens.length === 0) return false

    // Keep matching permissive for multi-word place queries.
    const matchedTokenCount = searchTokens.filter((token) => text.includes(token)).length
    return matchedTokenCount >= Math.max(1, Math.min(2, searchTokens.length))
}

const scoreSearchMatch = (product: ProductRow, normalizedSearch: string, searchTokens: string[]) => {
    const shop = getShopInfo(product)
    const nameLower = (product.name || '').toLowerCase()
    const categoryLower = (product.category || '').toLowerCase()
    const shopNameLower = (shop?.name || '').toLowerCase()
    const shopAddressLower = (shop?.address || '').toLowerCase()
    const text = `${nameLower} ${categoryLower} ${shopNameLower} ${shopAddressLower}`

    let score = 0

    if (normalizedSearch) {
        if (nameLower.includes(normalizedSearch)) score += 150
        if (shopNameLower.includes(normalizedSearch)) score += 120
        if (categoryLower.includes(normalizedSearch)) score += 90
        if (shopAddressLower.includes(normalizedSearch)) score += 70
        if (text.includes(normalizedSearch)) score += 30
    }

    for (const token of searchTokens) {
        if (!token) continue
        if (nameLower.includes(token)) score += 35
        if (shopNameLower.includes(token)) score += 30
        if (categoryLower.includes(token)) score += 20
        if (shopAddressLower.includes(token)) score += 18
    }

    return score
}

const sanitizeIlikePattern = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[%_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const mergeById = <T extends { id: string }>(target: Map<string, T>, rows: T[]) => {
    for (const row of rows) {
        if (!row?.id) continue
        if (!target.has(row.id)) target.set(row.id, row)
    }
}

const chunk = <T,>(values: T[], size: number) => {
    const result: T[][] = []
    for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size))
    return result
}

// GET /api/products?shop_id=xx&search=milk
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shop_id')
    const search = searchParams.get('search') || ''
    const foodOnly = searchParams.get('food_only') === 'true'
    const rawLimit = Number.parseInt(searchParams.get('limit') || '120', 10)
    const limit = Number.isFinite(rawLimit) ? clamp(rawLimit, 1, 500) : 120

    const supabase = await createClient()
    const normalizedSearch = normalizeSearchTerm(search)

    // Fast path for browse use-cases (no search query).
    if (!normalizedSearch) {
        let query = supabase
            .from('products')
            .select('*, shops(name, address)')

        if (shopId) query = query.eq('shop_id', shopId)
        query = query.limit(foodOnly ? Math.min(limit * 3, 1500) : limit)

        const { data, error } = await query.order('current_price', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const products = (data || []) as Array<Record<string, unknown>>
        const filtered = foodOnly
            ? products.filter((product) =>
                isFoodProduct({
                    id: String(product.id || ''),
                    shop_id: String(product.shop_id || ''),
                    name: String(product.name || ''),
                    category: typeof product.category === 'string' ? product.category : null,
                    current_price: typeof product.current_price === 'number' || typeof product.current_price === 'string'
                        ? product.current_price
                        : 0,
                    shops: (product.shops as ProductRow['shops']) || null,
                })
            )
            : products

        return NextResponse.json({ products: filtered.slice(0, limit) })
    }

    const searchTokens = tokenize(normalizedSearch).filter((token) => token.length >= 2)
    const searchPatterns = Array.from(new Set([normalizedSearch, ...searchTokens]))
        .map(sanitizeIlikePattern)
        .filter((value) => value.length >= 2)
        .slice(0, 8)

    const productsById = new Map<string, ProductRow>()
    const shopIds = new Set<string>()

    // Product-first lookup (name/category).
    for (const pattern of searchPatterns) {
        let productSearchQuery = supabase
            .from('products')
            .select('*, shops(name, address)')
            .or(`name.ilike.%${pattern}%,category.ilike.%${pattern}%`)
            .limit(250)

        if (shopId) productSearchQuery = productSearchQuery.eq('shop_id', shopId)

        const { data, error } = await productSearchQuery.order('current_price', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        mergeById(productsById, (data || []) as ProductRow[])
    }

    // Shop-first lookup (shop name/address), then pull products from matched shops.
    if (!shopId) {
        for (const pattern of searchPatterns) {
            const { data: matchingShops, error: shopError } = await supabase
                .from('shops')
                .select('id')
                .or(`name.ilike.%${pattern}%,address.ilike.%${pattern}%`)
                .limit(350)

            if (shopError) return NextResponse.json({ error: shopError.message }, { status: 500 })
            for (const shop of matchingShops || []) {
                if (shop?.id) shopIds.add(String(shop.id))
            }
        }
    }

    if (shopId) shopIds.add(shopId)

    if (shopIds.size > 0) {
        for (const group of chunk(Array.from(shopIds), 100)) {
            const { data, error } = await supabase
                .from('products')
                .select('*, shops(name, address)')
                .in('shop_id', group)
                .order('current_price', { ascending: true })
                .limit(500)

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            mergeById(productsById, (data || []) as ProductRow[])
        }
    }

    const mergedProducts = Array.from(productsById.values())
        .filter((product) => matchesSearch(product, normalizedSearch, searchTokens))
        .filter((product) => (foodOnly ? isFoodProduct(product) : true))
        .sort((a, b) => {
            const scoreDelta =
                scoreSearchMatch(b, normalizedSearch, searchTokens) -
                scoreSearchMatch(a, normalizedSearch, searchTokens)
            if (scoreDelta !== 0) return scoreDelta

            return Number(a.current_price) - Number(b.current_price)
        })

    return NextResponse.json({ products: mergedProducts.slice(0, limit) })
}

// POST /api/products - shop owner adds a product
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { shop_id, name, description, current_price, category, image_url } = body

    if (!shop_id || !name || current_price == null) {
        return NextResponse.json({ error: 'shop_id, name, current_price are required' }, { status: 400 })
    }

    // Verify shop ownership
    const { data: shop } = await supabase
        .from('shops').select('owner_id').eq('id', shop_id).single()

    if (shop?.owner_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: product, error } = await supabase
        .from('products')
        .insert({ shop_id, name, description, current_price, category, image_url })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also insert into price_history for AI prediction data
    await supabase.from('price_history').insert({
        product_id: product.id,
        price: current_price,
    })

    return NextResponse.json({ product }, { status: 201 })
}
