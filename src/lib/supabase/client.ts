import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseConfig } from './config'

export function createClient() {
    const config = getPublicSupabaseConfig()
    if (config.error) {
        throw new Error(config.error)
    }

    return createBrowserClient(config.url, config.anonKey)
}
