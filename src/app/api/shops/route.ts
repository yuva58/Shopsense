import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/shops - fetch all shops for current owner
export async function GET() {
    const supabase = await createServerClient()
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
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, description, address, lat, lng } = body

    if (!name || !address || lat == null || lng == null) {
        return NextResponse.json({ error: 'name, address, lat, lng are required' }, { status: 400 })
    }

    const parsedLat = Number(lat)
    const parsedLng = Number(lng)
    if (
        !Number.isFinite(parsedLat) ||
        !Number.isFinite(parsedLng) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180
    ) {
        return NextResponse.json({ error: 'Invalid latitude/longitude values.' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError) {
        return NextResponse.json({ error: 'Profile not found for current user. Please sign in again.' }, { status: 403 })
    }

    if (profile.role !== 'shop_owner' && profile.role !== 'admin') {
        return NextResponse.json(
            { error: 'Only shop owners can register shops. Sign up as Shop Owner to continue.' },
            { status: 403 }
        )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: 'Server is missing Supabase service-role configuration.' }, { status: 500 })
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    // Use service-role insert after auth/role checks to avoid policy mismatch and return clear app-level errors.
    const { data, error } = await admin
        .from('shops')
        .insert({
            name,
            description,
            address,
            owner_id: user.id,
            location: `POINT(${parsedLng} ${parsedLat})`,
        })
        .select()
        .single()

    if (error?.code === '42501' || error?.message?.toLowerCase().includes('row-level security')) {
        return NextResponse.json({ error: 'You are not permitted to create shops with this account.' }, { status: 403 })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ shop: data }, { status: 201 })
}
