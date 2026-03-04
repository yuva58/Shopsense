import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/shops/nearby?lat=xx&lng=xx&radius=5000
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '')
    const lng = parseFloat(searchParams.get('lng') || '')
    const radius = parseFloat(searchParams.get('radius') || '5000') // metres, default 5 km
    const product = searchParams.get('product') || ''

    if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // PostGIS ST_DWithin: returns shops within `radius` metres of (lng, lat)
    // The function must be created in Supabase (see supabase_schema.sql for the RPC)
    const { data, error } = await supabase.rpc('get_nearby_shops', {
        user_lat: lat,
        user_lng: lng,
        radius_metres: radius,
        product_filter: product || null,
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ shops: data })
}
