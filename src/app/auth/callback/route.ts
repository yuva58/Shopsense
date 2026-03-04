import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type AppRole = 'customer' | 'shop_owner' | 'admin'

const toSafeUsername = (value: string) => {
    const base = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    return (base || 'user').slice(0, 24)
}

const withSuffix = (base: string, userId: string) => {
    const suffix = userId.slice(0, 6).toLowerCase()
    const trimmed = base.slice(0, Math.max(1, 24 - (suffix.length + 1)))
    return `${trimmed}_${suffix}`
}

const toValidRole = (value: unknown): AppRole => {
    if (value === 'shop_owner' || value === 'admin' || value === 'customer') {
        return value
    }
    return 'customer'
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const nextParam = searchParams.get('next') ?? '/'

    // Validate next parameter to prevent Open Redirects
    const isSafeRedirect = nextParam.startsWith('/') && !nextParam.startsWith('//')
    const next = isSafeRedirect ? nextParam : '/'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const metadata = user.user_metadata ?? {}
                const preferredRole = toValidRole(metadata.role)
                const preferredUsername = toSafeUsername(
                    typeof metadata.username === 'string' && metadata.username.trim().length > 0
                        ? metadata.username
                        : (user.email?.split('@')[0] ?? 'user')
                )

                const upsertProfile = async (candidateUsername: string) =>
                    supabase.from('profiles').upsert(
                        {
                            id: user.id,
                            username: candidateUsername,
                            role: preferredRole,
                        },
                        { onConflict: 'id', ignoreDuplicates: true }
                    )

                let { error: profileError } = await upsertProfile(preferredUsername)
                if (profileError?.code === '23505') {
                    const fallbackUsername = withSuffix(preferredUsername, user.id)
                    const retry = await upsertProfile(fallbackUsername)
                    profileError = retry.error
                }

                if (profileError) {
                    console.error('Profile bootstrap failed during auth callback:', profileError)
                }
            }

            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
                return NextResponse.redirect(`${origin}${next}`, { status: 303 })
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`, { status: 303 })
            } else {
                return NextResponse.redirect(`${origin}${next}`, { status: 303 })
            }
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`, { status: 303 })
}
