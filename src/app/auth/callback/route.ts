import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
