const PLACEHOLDER_VALUES = new Set([
    'your_supabase_project_url',
    'your_supabase_anon_key',
])

export type SupabasePublicConfig =
    | { url: string; anonKey: string }
    | { error: string }

const normalize = (value: string | undefined) => value?.trim() ?? ''

const isPlaceholder = (value: string) => PLACEHOLDER_VALUES.has(value)

export function getPublicSupabaseConfig(): SupabasePublicConfig {
    const url = normalize(process.env.NEXT_PUBLIC_SUPABASE_URL)
    const anonKey = normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) {
        return {
            error:
                'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        }
    }

    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return {
            error: 'NEXT_PUBLIC_SUPABASE_URL is not a valid URL.',
        }
    }

    if (!['https:', 'http:'].includes(parsed.protocol)) {
        return {
            error: 'NEXT_PUBLIC_SUPABASE_URL must start with http:// or https://.',
        }
    }

    return { url: parsed.toString().replace(/\/$/, ''), anonKey }
}

export function hasPublicSupabaseConfig(
    config: SupabasePublicConfig
): config is { url: string; anonKey: string } {
    return 'url' in config && 'anonKey' in config
}
