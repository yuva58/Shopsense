import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from './config'

export async function createClient() {
    const cookieStore = await cookies()
    const config = getPublicSupabaseConfig()

    if (!hasPublicSupabaseConfig(config)) {
        throw new Error(config.error)
    }

    return createServerClient(
        config.url,
        config.anonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(
                    cookiesToSet: Array<{
                        name: string
                        value: string
                        options: CookieOptions
                    }>
                ) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Called from a Server Component — safe to ignore,
                        // middleware will keep the session fresh.
                    }
                },
            },
        }
    )
}
