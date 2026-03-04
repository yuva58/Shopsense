'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { MapPin, ShieldCheck, Tag } from 'lucide-react'

export default function RegisterPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [role, setRole] = useState<'customer' | 'shop_owner'>('customer')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccessMsg(null)

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    role: role,
                }
            }
        })

        if (authError) {
            setError(authError.message)
            setLoading(false)
            return
        }

        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: authData.user.id,
                        username: username,
                        role: role
                    }
                ])

            if (profileError) {
                console.error("Profile creation error:", profileError)
            }

            if (authData.session === null) {
                setSuccessMsg('Registration successful! Please check your email to verify your account.')
            } else {
                router.push('/dashboard')
                router.refresh()
            }
        }
        setLoading(false)
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
                            Join ShopSense. Plan the smartest routes and find trusted local stores.
                        </h1>
                        <ul className="space-y-4 text-[#CBE8D8] font-medium text-lg">
                            <li className="flex gap-3 items-center">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                AI-verified reviews and trustworthiness
                            </li>
                            <li className="flex gap-3 items-center">
                                <Tag className="w-5 h-5 text-primary" />
                                Live price comparisons & drop predictions
                            </li>
                        </ul>
                    </div>

                    <div className="mt-12 h-[146px] rounded-[18px] bg-white/5 border border-[#7BB192] p-5 flex flex-col justify-center">
                        <div className="text-4xl font-bold text-white tracking-tight mb-1">300+</div>
                        <div className="text-[#CBE8D8] text-sm font-medium">Verified local shops already joined</div>
                    </div>
                </div>

                {/* Right Register Form */}
                <div className="flex-1 max-w-[550px] bg-white rounded-[24px] p-8 lg:p-10 border border-border shadow-xl flex flex-col justify-center">
                    <h2 className="text-[36px] lg:text-[42px] font-bold text-[#171916] tracking-tight mb-3">Create your account</h2>
                    <p className="text-[#677069] text-base leading-relaxed mb-6">
                        Access customer, shop owner, and admin tools with one secure account.
                    </p>

                    <form onSubmit={handleRegister} className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">
                                {successMsg}
                            </div>
                        )}

                        {/* Interactive Role Selector matching the Pencil schema UI */}
                        <div className="flex gap-2 mb-4 bg-[#F8FAF7] p-1.5 rounded-xl border border-[#DCE3D8]">
                            <button
                                type="button"
                                onClick={() => setRole('customer')}
                                className={`flex-1 h-11 rounded-lg text-sm font-medium transition-colors ${role === 'customer' ? 'bg-primary text-white shadow-sm' : 'text-[#677069] hover:text-heading'
                                    }`}
                            >
                                Customer
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole('shop_owner')}
                                className={`flex-1 h-11 rounded-lg text-sm font-medium transition-colors ${role === 'shop_owner' ? 'bg-primary text-white shadow-sm' : 'text-[#677069] hover:text-heading'
                                    }`}
                            >
                                Shop Owner
                            </button>
                        </div>

                        <div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Username"
                                className="w-full h-14 bg-[#F8FAF7] border border-[#DCE3D8] rounded-xl px-4 text-heading outline-none focus:border-primary transition-colors placeholder:text-[#677069]"
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="email"
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
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password (min 6 chars)"
                                className="w-full h-14 bg-[#F8FAF7] border border-[#DCE3D8] rounded-xl px-4 text-heading outline-none focus:border-primary transition-colors placeholder:text-[#677069]"
                                required minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[52px] mt-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
                        >
                            {loading ? 'Creating...' : 'Create account'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-border">
                        <Link href="/login" className="text-sm font-semibold text-[#466854] hover:text-primary transition-colors">
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    )
}
