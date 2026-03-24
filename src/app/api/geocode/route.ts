import { NextRequest, NextResponse } from 'next/server'

type NominatimRow = {
    lat?: string
    lon?: string
    display_name?: string
    address?: {
        state?: string
        county?: string
        city?: string
        town?: string
        village?: string
    }
}

const isTamilNaduLocation = (row: NominatimRow) => {
    const haystack = `${row.display_name || ''} ${row.address?.state || ''}`.toLowerCase()
    return haystack.includes('tamil nadu')
}

// GET /api/geocode?q=panimalar engineering college chennai
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (q.length < 3) {
        return NextResponse.json({ error: 'Query must be at least 3 characters.' }, { status: 400 })
    }

    const params = new URLSearchParams({
        q,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'in',
    })

    let response: Response
    try {
        response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
            headers: {
                'User-Agent': 'ShopSense Geocoder/1.0',
                Accept: 'application/json',
            },
            cache: 'no-store',
        })
    } catch {
        return NextResponse.json({ error: 'Geocoding service is currently unreachable.' }, { status: 502 })
    }

    if (!response.ok) {
        return NextResponse.json(
            { error: `Geocoding failed with status ${response.status}.` },
            { status: 502 }
        )
    }

    const rows = (await response.json()) as NominatimRow[]
    if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ location: null })
    }

    const preferred = rows.find(isTamilNaduLocation) || rows[0]
    const lat = Number.parseFloat(preferred.lat || '')
    const lng = Number.parseFloat(preferred.lon || '')

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ location: null })
    }

    return NextResponse.json({
        location: {
            lat,
            lng,
            display_name: preferred.display_name || q,
            state: preferred.address?.state || null,
            district: preferred.address?.county || null,
            locality:
                preferred.address?.city ||
                preferred.address?.town ||
                preferred.address?.village ||
                null,
            is_tamil_nadu: isTamilNaduLocation(preferred),
        },
    })
}
