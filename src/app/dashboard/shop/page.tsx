import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
import { ArrowLeft, MapPin, Store, PlusCircle } from 'lucide-react'

export default async function ShopHubPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'shop_owner' && profile?.role !== 'admin') {
        redirect('/dashboard')
    }

    const { data: shops, error } = await supabase
        .from('shops')
        .select('id, name, description, address, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

    const hasShops = !!shops && shops.length > 0

    return (
        <div className="min-h-screen bg-[#F8FAF7] py-10 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between gap-4 mb-8">
                    <div>
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#66726A] hover:text-primary transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Link>
                        <h1 className="mt-3 text-3xl font-bold text-[#151614] tracking-tight">Manage Shops</h1>
                        <p className="mt-1 text-sm text-[#677069]">
                            View your registered shops and add new ones.
                        </p>
                    </div>
                    <Link
                        href="/dashboard/shop/new"
                        className="inline-flex h-11 px-5 items-center justify-center gap-2 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <PlusCircle className="h-4 w-4" />
                        Add New Shop
                    </Link>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm mb-6">
                        {error.message}
                    </div>
                )}

                {!error && !hasShops && (
                    <div className="rounded-2xl border border-[#DDE4DA] bg-white p-8 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-[#EEF6EE] text-primary flex items-center justify-center mb-4">
                            <Store className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-bold text-[#151614]">No shops yet</h2>
                        <p className="text-sm text-[#677069] mt-2 mb-6">
                            You have not registered a shop yet. Add your first shop to start listing products.
                        </p>
                        <Link
                            href="/dashboard/shop/new"
                            className="inline-flex h-11 px-5 items-center justify-center bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                        >
                            Register First Shop
                        </Link>
                    </div>
                )}

                {!error && hasShops && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {shops.map((shop) => (
                            <div key={shop.id} className="rounded-2xl border border-[#DDE4DA] bg-white p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#EEF6EE] text-primary flex items-center justify-center shrink-0">
                                        <Store className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-bold text-[#151614] line-clamp-1">{shop.name}</h3>
                                        <p className="text-sm text-[#677069] line-clamp-2 mt-1">
                                            {shop.description || 'No description added yet.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-[#EEF3EC]">
                                    <div className="flex items-start gap-2 text-sm text-[#49544D]">
                                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[#6E7A72]" />
                                        <span className="line-clamp-2">{shop.address}</span>
                                    </div>
                                    <p className="text-xs text-[#7A857D] mt-3">
                                        Added on {new Date(shop.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

