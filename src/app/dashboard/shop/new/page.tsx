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

    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const params = new URLSearchParams({
                lat: String(lat),
                lon: String(lng),
                format: 'jsonv2',
                addressdetails: '1',
            })
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`)
            if (!res.ok) return null
            const json = await res.json()
            return (json?.display_name as string | undefined) || null
        } catch {
            return null
        }
    }

    const detectLocation = async () => {
        setError(null)

        if (!navigator.geolocation) {
            setError('Geolocation is not supported in this browser. Please enter coordinates manually.')
            return
        }

        setLocating(true)

        try {
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'geolocation' })
                if (permission.state === 'denied') {
                    setError('Location permission is blocked. Enable it in browser site settings and try again.')
                    setLocating(false)
                    return
                }
            }

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 0,
                })
            })

            const lat = position.coords.latitude
            const lng = position.coords.longitude
            const detectedAddress = await reverseGeocode(lat, lng)

            setForm((f) => ({
                ...f,
                lat: lat.toString(),
                lng: lng.toString(),
                address: f.address.trim() ? f.address : (detectedAddress || f.address),
            }))
        } catch (err) {
            const geolocationError = err as GeolocationPositionError
            if (geolocationError?.code === 1) {
                setError('Location access denied. Allow location permission and try again.')
            } else if (geolocationError?.code === 2) {
                setError('Location is unavailable right now. Check GPS/network and retry.')
            } else if (geolocationError?.code === 3) {
                setError('Location request timed out. Please retry.')
            } else {
                setError('Could not auto-detect location. Please enter coordinates manually.')
            }
        } finally {
            setLocating(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const lat = Number.parseFloat(form.lat)
        const lng = Number.parseFloat(form.lng)

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            setError('Please enter valid latitude and longitude values.')
            setLoading(false)
            return
        }

        const res = await fetch('/api/shops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name,
                description: form.description,
                address: form.address,
                lat,
                lng,
            }),
        })

        const json = await res.json()
        if (!res.ok) {
            setError(json.error || 'Failed to create shop')
            setLoading(false)
        } else {
            router.push('/dashboard/shop')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-black py-12 px-4">
            <div className="max-w-lg mx-auto space-y-6">
                <div>
                    <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-500 transition-colors">
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold mt-3 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Store className="h-6 w-6 text-blue-500" /> Register Your Shop
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Add your shop to start listing products for nearby customers.
                    </p>
                </div>

                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Shop Name *</label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="Aavin Dairy Store"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Description</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm resize-none"
                                    placeholder="Fresh dairy products and local groceries..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Address *</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="12, Anna Nagar, Chennai - 600040"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Location Coordinates *</label>
                                <button
                                    type="button"
                                    onClick={detectLocation}
                                    disabled={locating}
                                    className="text-xs text-emerald-500 hover:text-emerald-600 font-medium flex items-center gap-1 transition-colors disabled:opacity-60"
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
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                    placeholder="Latitude (e.g. 13.0827)"
                                    required
                                />
                                <input
                                    type="number"
                                    step="any"
                                    value={form.lng}
                                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
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
