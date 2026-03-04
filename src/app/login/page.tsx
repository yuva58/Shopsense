'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { MapPin, ShieldCheck, Zap } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)

        if (error) {
            setError(error.message)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    return (
        <div className="relative min-h-screen gradient-hero-bg flex items-center justify-center p-4 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/4 w-[520px] h-[520px] bg-[#FBE7DC] rounded-full blur-3xl opacity-60 pointer-events-none" />

            <div className="relative z-10 w-full max-w-[1248px] flex flex-col md:flex-row gap-8 bg-transparent">

                {/* Left Promo Card */}
                <div className="hidden md:flex flex-1 max-w-[664px] gradient-login-promo rounded-[24px] p-8 lg:p-12 flex-col justify-between shadow-2xl">
                    <div>
                        <div className="inline-flex h-8 px-4 rounded-full bg-[#2F6A4A] items-center text-white/90 text-sm font-medium mb-8 border border-white/10">
                            Smart shopping intelligence
                        </div>
                        <h1 className="text-[40px] lg:text-[50px] font-bold text-[#F2FAF4] leading-[1.04] tracking-tight mb-8">
                            Welcome back. Continue tracking local prices and trusted stores near you.
                        </h1>
                        <ul className="space-y-4 text-[#CBE8D8] font-medium text-lg">
                            <li className="flex gap-3 items-center">
                                <MapPin className="w-5 h-5 text-primary" />
                                Nearby product discovery within 5 km
                            </li>
                            <li className="flex gap-3 items-center">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                AI review scoring and route optimization
                            </li>
                        </ul>
                    </div>

                    <div className="mt-12 h-[146px] rounded-[18px] bg-white/5 border border-[#7BB192] p-5 flex flex-col justify-center">
                        <div className="text-4xl font-bold text-white tracking-tight mb-1">₹420 / month</div>
                        <div className="text-[#CBE8D8] text-sm font-medium">Average customer savings</div>
                    </div>
                </div>

                {/* Right Login Form */}
                <div className="flex-1 max-w-[550px] bg-white rounded-[24px] p-8 lg:p-10 border border-border shadow-xl flex flex-col justify-center">
                    <h2 className="text-[36px] lg:text-[42px] font-bold text-[#171916] tracking-tight mb-3">Sign in to your account</h2>
                    <p className="text-[#677069] text-base leading-relaxed mb-8">
                        Access customer, shop owner, and admin tools with one secure account.
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                                {error}
                            </div>
                        )}

                        <div>
                            <input
                                type="email"
                                aria-label="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full h-14 bg-[#F8FAF7] border border-[#DCE3D8] rounded-xl px-4 text-heading outline-none focus:border-primary transition-colors placeholder:text-[#677069]"
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="password"
                                aria-label="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full h-14 bg-[#F8FAF7] border border-[#DCE3D8] rounded-xl px-4 text-heading outline-none focus:border-primary transition-colors placeholder:text-[#677069]"
                                required
                            />
                        </div>



                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[52px] mt-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
                        >
                            {loading ? 'Signing in...' : 'Sign in securely'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-border">
                        <Link href="/register" className="text-sm font-semibold text-[#466854] hover:text-primary transition-colors">
                            New to ShopSense? Create an account
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    )
}
