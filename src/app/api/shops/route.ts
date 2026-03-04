import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/shops - fetch all shops for current owner
export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('shops')
        .select('*, products(count)')
        .eq('owner_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ shops: data })
}

// POST /api/shops - create a new shop
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, description, address, lat, lng } = body

    if (!name || !address || lat == null || lng == null) {
        return NextResponse.json({ error: 'name, address, lat, lng are required' }, { status: 400 })
    }

    // Build PostGIS Geography POINT
    const { data, error } = await supabase
        .from('shops')
        .insert({
            name,
            description,
            address,
            owner_id: user.id,
            location: `POINT(${lng} ${lat})`,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ shop: data }, { status: 201 })
}
