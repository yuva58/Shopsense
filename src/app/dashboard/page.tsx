import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Search, TrendingDown, Star, Route, Store, LogOut, Settings, Plus, LayoutDashboard } from 'lucide-react'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const isShopOwner = profile?.role === 'shop_owner'
    const isAdmin = profile?.role === 'admin'

    return (
        <div className="min-h-screen bg-[#EEF2ED] p-7 flex justify-center">
            {/* App Shell Wrapper */}
            <div className="w-full max-w-[1384px] bg-white rounded-[24px] border border-[#DFE6DD] shadow-lg flex overflow-hidden min-h-[90vh]">

                {/* App Sidebar */}
                <aside className="w-[246px] bg-[#123324] flex flex-col justify-between py-8 px-5 shrink-0">
                    <div>
                        <Link href="/" className="px-2 block mb-10">
                            <span className="text-[#EAF6EF] font-bold text-2xl tracking-tight">ShopSense</span>
                        </Link>

                        <nav className="flex flex-col gap-2">
                            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-medium transition-colors">
                                <LayoutDashboard className="w-5 h-5 text-emerald-400" />
                                Overview
                            </Link>
                            <Link href="/dashboard/search" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white font-medium transition-colors">
                                <Search className="w-5 h-5" />
                                Search & Compare
                            </Link>
                            {isShopOwner && (
                                <Link href="/dashboard/shop/new" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white font-medium transition-colors mt-4">
                                    <Store className="w-5 h-5 text-blue-300" />
                                    Manage Shop
                                </Link>
                            )}
                            {isAdmin && (
                                <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white font-medium transition-colors mt-4">
                                    <Settings className="w-5 h-5 text-red-300" />
                                    Security Admin
                                </Link>
                            )}
                        </nav>
                    </div>

                    {/* User Profile Footer */}
                    <div className="pt-6 border-t border-white/10 px-2 mt-auto">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white text-sm font-semibold capitalize truncate">{profile?.username || 'User'}</div>
                                <div className="text-white/50 text-xs mt-0.5 capitalize">{profile?.role?.replace('_', ' ') || 'customer'}</div>
                            </div>
                            <form action="/api/auth/signout" method="post">
                                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Sign out">
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 bg-[#F8FAF7] p-8 lg:p-10 flex flex-col overflow-y-auto">

                    {/* Main Header */}
                    <header className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-[#151614] tracking-tight">Welcome, {profile?.username || 'Shopper'}</h1>
                            <p className="text-[#677069] text-sm mt-1">Here is a quick overview of your local shopping intelligence.</p>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-[#DFE6DD] text-sm font-medium text-[#151614] shadow-sm">
                            <MapPin className="w-4 h-4 text-primary" />
                            Current location: Detecting...
                        </div>
                    </header>

                    {/* Quick Search Bar */}
                    <div className="relative mb-8">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-[#677069]" />
                        </div>
                        <input
                            type="text"
                            className="w-full h-14 pl-14 pr-4 bg-white border border-[#DDE4DA] rounded-[14px] text-[#151614] outline-none hover:border-[#102417]/20 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all text-base placeholder:text-[#677069]"
                            placeholder="Search any product..."
                        />
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { icon: MapPin, label: 'Nearby Shops', value: '12+', color: 'text-blue-600', bg: 'bg-blue-50' },
                            { icon: TrendingDown, label: 'AI Savings Found', value: '₹420', color: 'text-primary', bg: 'bg-[#EEF6EE]' },
                            { icon: Star, label: 'Verified Reviews', value: '100%', color: 'text-amber-600', bg: 'bg-amber-50' },
                            { icon: Route, label: 'Routes Optimized', value: '4', color: 'text-purple-600', bg: 'bg-purple-50' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white border border-[#DDE4DA] rounded-[18px] p-5 hover:shadow-md hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                    <span className="text-sm font-medium text-[#677069]">{stat.label}</span>
                                </div>
                                <p className="text-[28px] font-bold text-[#151614] tracking-tight">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Action Banners */}
                    <div className="grid md:grid-cols-2 gap-6 mt-auto">
                        <div className="bg-gradient-to-br from-[#123324] to-[#1A4732] rounded-[20px] p-8 text-white flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold mb-2">Start your shopping trip</h3>
                                <p className="text-white/70 text-sm mb-6 max-w-[80%]">Use ShopSense search to find product availability, AI price predictions, and optimal routes between stores.</p>
                            </div>
                            <Link href="/dashboard/search" className="inline-flex h-11 px-6 items-center justify-center bg-white text-[#123324] font-semibold text-sm rounded-xl hover:bg-white/90 transition-colors self-start w-fit">
                                Go to Search
                            </Link>
                        </div>

                        {isShopOwner && (
                            <div className="bg-white border border-[#DDE4DA] shadow-sm rounded-[20px] p-8 text-[#151614] flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Shop Owner Hub</h3>
                                    <p className="text-[#677069] text-sm mb-6 max-w-[80%]">Register your business, verify prices, and track how many route additions your store receives.</p>
                                </div>
                                <Link href="/dashboard/shop/new" className="inline-flex h-11 px-6 items-center justify-center bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors self-start w-fit">
                                    Add your shop
                                </Link>
                            </div>
                        )}
                    </div>

                </main>
            </div>
        </div>
    )
}
