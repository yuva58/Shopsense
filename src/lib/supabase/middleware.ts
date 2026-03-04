import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    const supabaseResponse = NextResponse.next({ request })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Skip Supabase session refresh if credentials are not configured yet
    if (
        !supabaseUrl ||
        !supabaseKey ||
        supabaseUrl === 'your_supabase_project_url' ||
        supabaseKey === 'your_supabase_anon_key'
    ) {
        return supabaseResponse
    }

    let response = supabaseResponse

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                response = NextResponse.next({ request })
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                )
            },
        },
    })

    // Refresh auth token
    await supabase.auth.getUser()

    return response
}
