import fs from 'node:fs'
import dns from 'node:dns/promises'

const REQUIRED_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const PLACEHOLDERS = new Set(['your_supabase_project_url', 'your_supabase_anon_key'])

const loadEnvFile = (path) => {
    if (!fs.existsSync(path)) return
    const raw = fs.readFileSync(path, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIndex = trimmed.indexOf('=')
        if (eqIndex === -1) continue
        const key = trimmed.slice(0, eqIndex).trim()
        const value = trimmed.slice(eqIndex + 1).trim()
        if (!(key in process.env)) {
            process.env[key] = value
        }
    }
}

const fail = (message) => {
    console.error(`\n[auth-check] ${message}`)
    process.exit(1)
}

loadEnvFile('.env.local')

for (const key of REQUIRED_KEYS) {
    const value = process.env[key]?.trim()
    if (!value || PLACEHOLDERS.has(value)) {
        fail(`Missing or placeholder value for ${key}.`)
    }
}

let supabaseUrl
try {
    supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL.trim())
} catch {
    fail('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.')
}

if (!['https:', 'http:'].includes(supabaseUrl.protocol)) {
    fail('NEXT_PUBLIC_SUPABASE_URL must start with http:// or https://.')
}

try {
    await dns.lookup(supabaseUrl.hostname)
} catch {
    fail(`Supabase host does not resolve: ${supabaseUrl.hostname}`)
}

const healthUrl = new URL('/auth/v1/settings', supabaseUrl)
let response
try {
    response = await fetch(healthUrl, {
        headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim(),
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()}`,
        },
    })
} catch (error) {
    fail(`Unable to reach Supabase auth endpoint (${healthUrl}): ${error instanceof Error ? error.message : String(error)}`)
}

if (!response.ok) {
    fail(`Supabase auth endpoint check failed with status ${response.status}.`)
}

console.log('[auth-check] Supabase auth configuration looks healthy.')
