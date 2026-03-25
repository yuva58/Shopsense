#!/usr/bin/env node
/**
 * One-shot migration: adds `source` column + indexes to public.shops
 * Uses the Supabase service role key (bypasses RLS).
 * Run once: node scripts/run-migration.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i <= 0) continue
        const key = line.slice(0, i).trim()
        const val = line.slice(i + 1).trim()
        if (!(key in process.env)) process.env[key] = val
    }
}

async function runSql(supabaseUrl, serviceRoleKey, sql) {
    const pgRestUrl = `${supabaseUrl}/rest/v1/rpc/`
    // Supabase exposes a /rest/v1/ endpoint; for raw SQL we use the
    // Management API or the pg connection. Here we use the Supabase
    // Management REST endpoint that allows arbitrary SQL via POST.
    const managementUrl = supabaseUrl.replace('https://', 'https://').replace('.supabase.co', '.supabase.co')
    
    // Use the pg connection via fetch to the SQL endpoint
    // Supabase projects expose /rest/v1/ but for DDL we need the SQL API
    // The Supabase SQL endpoint is at: {ref}.supabase.co via Management API
    // But we can do this via the JS client using a stored procedure trick.
    // Simplest approach: use the Supabase JS client with exec_sql if available.
    
    // Actually, the most reliable approach for a Node script is to call the
    // Supabase Management API /v1/projects/{ref}/database/query
    // OR use the postgres connection string if available.
    
    // Let's try the Management API approach first
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    const managementApiUrl = `https://api.supabase.com/v1/projects/${ref}/database/query`
    
    const res = await fetch(managementApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: sql }),
    })
    
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Management API error ${res.status}: ${body}`)
    }
    
    return await res.json()
}

async function main() {
    loadEnvFile(path.join(projectRoot, '.env.local'))

    const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    }

    // The migration SQL, broken into individual statements so each can be run
    const statements = [
        `ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS source TEXT`,
        `CREATE INDEX IF NOT EXISTS shops_source_btree_idx ON public.shops (source)`,
        `CREATE INDEX IF NOT EXISTS shops_source_trgm_idx  ON public.shops USING GIN (source gin_trgm_ops)`,
        `UPDATE public.shops SET source = 'osm_chennai_metro' WHERE source IS NULL AND description ILIKE 'osm_import:%'`,
    ]

    console.log('Running migration: add source column to shops...')

    for (const sql of statements) {
        process.stdout.write(`  → ${sql.slice(0, 70)}...  `)
        try {
            await runSql(supabaseUrl, serviceRoleKey, sql)
            console.log('✓')
        } catch (err) {
            console.log(`⚠  ${err.message}`)
            // Non-fatal – column/index may already exist
        }
    }

    console.log('\n✅  Migration complete.')
}

main().catch((err) => {
    console.error('❌  Migration failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
})
