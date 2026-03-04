'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Store, FileText, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewShopPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '',
        description: '',
        address: '',
        lat: '',
        lng: '',
    })

    const detectLocation = () => {
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm((f) => ({
                    ...f,
                    lat: pos.coords.latitude.toString(),
                    lng: pos.coords.longitude.toString(),
                }))
                setLocating(false)
            },
            () => {
                setError('Could not detect location. Please enter manually.')
                setLocating(false)
            }
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const res = await fetch('/api/shops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name,
                description: form.description,
                address: form.address,
                lat: parseFloat(form.lat),
                lng: parseFloat(form.lng),
            }),
        })

        const json = await res.json()
        if (!res.ok) {
            setError(json.error || 'Failed to create shop')
            setLoading(false)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-black py-12 px-4">
            <div className="max-w-lg mx-auto space-y-6">
                <div>
                    <Link href="/dashboard" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors">← Back to Dashboard</Link>
                    <h1 className="text-2xl font-bold mt-3 flex items-center gap-2">
                        <Store className="h-6 w-6 text-blue-500" /> Register Your Shop
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add your shop to start listing products for nearby customers.</p>
                </div>

                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Shop Name *</label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="Aavin Dairy Store"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm resize-none"
                                    placeholder="Fresh dairy products and local groceries..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Address *</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="12, Anna Nagar, Chennai - 600040"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Location Coordinates *</label>
                                <button
                                    type="button"
                                    onClick={detectLocation}
                                    disabled={locating}
                                    className="text-xs text-emerald-500 hover:text-emerald-600 font-medium flex items-center gap-1 transition-colors"
                                >
                                    {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                                    {locating ? 'Detecting...' : 'Auto-detect'}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="number"
                                    step="any"
                                    value={form.lat}
                                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="Latitude (e.g. 13.0827)"
                                    required
                                />
                                <input
                                    type="number"
                                    step="any"
                                    value={form.lng}
                                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="Longitude (e.g. 80.2707)"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-medium text-sm transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 group"
                        >
                            {loading ? 'Registering...' : 'Register Shop'}
                            {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
