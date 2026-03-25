import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from './config'

export async function updateSession(request: NextRequest) {
    const supabaseResponse = NextResponse.next({ request })
    const config = getPublicSupabaseConfig()
    if (!hasPublicSupabaseConfig(config)) {
        return supabaseResponse
    }

    let response = supabaseResponse

    const supabase = createServerClient(config.url, config.anonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(
                cookiesToSet: Array<{
                    name: string
                    value: string
                    options: CookieOptions
                }>
            ) {
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
