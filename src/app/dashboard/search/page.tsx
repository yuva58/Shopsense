import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PublicSearchPage from '@/components/public-search-page'
import { LayoutDashboard, Search, Store, Settings, LogOut } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardSearchPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const isShopOwner = profile?.role === 'shop_owner'
    const isAdmin = profile?.role === 'admin'

    return (
        <div className="min-h-screen bg-[#EEF2ED] p-7 flex justify-center">
            <div className="w-full max-w-[1384px] bg-white rounded-[24px] border border-[#DFE6DD] shadow-lg flex overflow-hidden min-h-[90vh]">

                {/* Sidebar */}
                <aside className="w-[246px] bg-[#123324] flex flex-col justify-between py-8 px-5 shrink-0">
                    <div>
                        <Link href="/dashboard" className="px-2 block mb-10">
                            <span className="text-[#EAF6EF] font-bold text-2xl tracking-tight">ShopSense</span>
                        </Link>
                        <nav className="flex flex-col gap-2">
                            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white font-medium transition-colors">
                                <LayoutDashboard className="w-5 h-5 text-emerald-400" />
                                Overview
                            </Link>
                            <Link href="/dashboard/search" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-medium transition-colors">
                                <Search className="w-5 h-5" />
                                Search & Compare
                            </Link>
                            {isShopOwner && (
                                <Link href="/dashboard/shop" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white font-medium transition-colors mt-4">
                                    <Store className="w-5 h-5 text-blue-300" />
                                    Manage Shops
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

                {/* Search content */}
                <main className="flex-1 overflow-y-auto">
                    <PublicSearchPage />
                </main>
            </div>
        </div>
    )
}
