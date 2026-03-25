import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from './config'

export function createClient() {
    const config = getPublicSupabaseConfig()
    if (!hasPublicSupabaseConfig(config)) {
        throw new Error(config.error)
    }

    return createBrowserClient(config.url, config.anonKey)
}
