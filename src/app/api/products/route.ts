import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/products?shop_id=xx&search=milk
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shop_id')
    const search = searchParams.get('search') || ''

    const supabase = await createClient()

    let query = supabase
        .from('products')
        .select('*, shops(name, address)')
        .eq('in_stock', true)

    if (shopId) query = query.eq('shop_id', shopId)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query.order('current_price', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ products: data })
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
