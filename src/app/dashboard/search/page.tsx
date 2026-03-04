'use client'

import { useState, useCallback } from 'react'
import { MapPin, Search, Bot, Route, ArrowUpRight, Loader2, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react'

// (Same interfaces and logic as before, just completely restyled for the Pencil UI)
interface ShopResult {
    shop_id: string
    shop_name: string
    address: string
    distance_metres: number
    product_id: string
    product_name: string
    current_price: number
    ai_prediction?: {
        trend: string
        predicted_price_next_week: number
        recommendation: string
        confidence: number
        reason: string
    }
}

export default function SearchPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<ShopResult[]>([])
    const [loading, setLoading] = useState(false)
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedShops, setSelectedShops] = useState<string[]>([])
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [loadingPredictions, setLoadingPredictions] = useState(false)

    const getLocation = (): Promise<{ lat: number; lng: number }> =>
        new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'))
                return
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => reject(new Error('Location access denied'))
            )
        })

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return
        setLoading(true)
        setError(null)
        setResults([])
        setSelectedShops([])

        try {
            let userCoords = coords
            if (!userCoords) {
                setLocating(true)
                userCoords = await getLocation()
                setCoords(userCoords)
            }

            const params = new URLSearchParams({
                lat: String(userCoords.lat),
                lng: String(userCoords.lng),
                product: query,
            })
            const res = await fetch(`/api/shops/nearby?${params}`)
            const json = await res.json()

            if (!res.ok) throw new Error(json.error || 'Failed to fetch shops')
            setResults(json.shops || [])
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
            setLocating(false)
        }
    }, [query, coords])

    const loadPredictions = async () => {
        if (!results.length) return
        setLoadingPredictions(true)
        const updated = await Promise.all(
            results.map(async (r) => {
                try {
                    const res = await fetch('/api/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_id: r.product_id }),
                    })
                    const json = await res.json()
                    return { ...r, ai_prediction: json.prediction }
                } catch {
                    return r
                }
            })
        )
        setResults(updated)
        setLoadingPredictions(false)
    }

    const toggleShop = (shopId: string) => {
        setSelectedShops((prev) =>
            prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
        )
    }

    const openRoute = () => {
        if (!coords || !selectedShops.length) return
        const selected = results.filter((r) => selectedShops.includes(r.shop_id))
        // exclude destination from waypoints to prevent redundant routing loops
        const waypoints = selected.slice(0, -1).map((s) => encodeURIComponent(s.address)).join('|')
        const url = `https://www.google.com/maps/dir/?api=1&origin=${coords.lat},${coords.lng}&destination=${encodeURIComponent(selected[selected.length - 1].address)}&waypoints=${waypoints}&travelmode=driving`
        window.open(url, '_blank')
    }

    const cheapest = results.length ? Math.min(...results.map((r) => r.current_price)) : null

    // For the UI match, we separate selected items to the Right Panel (Decision Insights)
    const selectedResultObjects = results.filter(r => selectedShops.includes(r.shop_id))
    const totalSelectedPrice = selectedResultObjects.reduce((acc, curr) => acc + curr.current_price, 0)

    const trendIcon = (trend?: string) => {
        if (trend === 'falling') return <TrendingDown className="h-4 w-4 text-emerald-500" />
        if (trend === 'rising') return <TrendingUp className="h-4 w-4 text-red-400" />
        return <Minus className="h-4 w-4 text-[#677069]" />
    }

    return (
        <div className="flex flex-col h-full bg-[#F8FAF7]">
            {/* Header Content Area */}
            <header className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[28px] font-bold text-[#151614] tracking-tight">Search & Compare</h1>
                    <p className="text-[#677069] text-sm mt-1">Find products in trusted local stores instantly.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#DFE6DD] text-sm font-medium text-[#151614] shadow-sm">
                        <MapPin className="w-4 h-4 text-primary" />
                        5 km radius
                    </div>
                </div>
            </header>

            {/* AI Search Bar container mimicking Pencil schema */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-[#677069]" />
                    </div>
                    <input
                        type="text"
                        aria-label="Search items"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full h-[56px] pl-14 pr-4 bg-white border border-[#DDE4DA] rounded-[14px] text-[#151614] outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all text-base placeholder:text-[#677069]"
                        placeholder="Search for bread, milk, eggs..."
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading || locating}
                    className="h-[56px] px-8 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-[14px] font-medium text-base transition-colors flex items-center gap-2 shadow-sm"
                >
                    {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    {locating ? 'Locating...' : loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {error && (
                <div className="p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                    {error}
                </div>
            )}

            {/* Content Split: Results (Left) vs insights (Right) */}
            <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">

                {/* Left side: Results List */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-[#151614]">Nearby Results</h2>
                        {results.length > 0 && (
                            <button
                                onClick={loadPredictions}
                                disabled={loadingPredictions}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EBF0FC] text-[#325AA6] text-sm font-semibold hover:bg-blue-100 transition-colors"
                            >
                                {loadingPredictions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                                {loadingPredictions ? 'Analysing Prices...' : 'AI Price Predict'}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-8">
                        {loading && (
                            <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-[#677069]">Scanning local stores...</p>
                            </div>
                        )}

                        {!loading && results.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#DDE4DA] rounded-[20px]">
                                <p className="text-[#677069] font-medium">No active search yet.</p>
                            </div>
                        )}

                        {!loading && results.map((result) => {
                            const isCheapest = result.current_price === cheapest
                            const isSelected = selectedShops.includes(result.shop_id)
                            const pred = result.ai_prediction

                            return (
                                <div
                                    key={`${result.shop_id}-${result.product_id}`}
                                    onClick={() => toggleShop(result.shop_id)}
                                    className={`relative bg-white border ${isSelected ? 'border-primary shadow-sm bg-[#F4F9F6]' : 'border-[#DDE4DA]'} rounded-[18px] p-5 cursor-pointer hover:border-primary/50 transition-all`}
                                >
                                    {isCheapest && (
                                        <div className="absolute top-5 right-5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E5F3EB] text-[#2E7047]">
                                            Best Price
                                        </div>
                                    )}

                                    <div className="pr-20">
                                        <h3 className="font-bold text-[#151614] text-lg">{result.shop_name}</h3>
                                        <div className="flex items-center gap-1.5 text-xs text-[#677069] mt-1.5">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {result.address} <span className="mx-1">•</span> {(result.distance_metres / 1000).toFixed(1)} km away
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-end justify-between">
                                        <div>
                                            <p className="text-[22px] font-bold text-[#151614]">₹{result.current_price}</p>
                                            <p className="text-xs text-[#677069] mt-0.5">{result.product_name}</p>
                                        </div>

                                        {isSelected && (
                                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* AI Prediction Section */}
                                    {pred && (
                                        <div className="mt-5 pt-4 border-t border-[#F0F4EF] flex items-start gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 bg-[#EBF0FC] rounded-lg flex items-center justify-center">
                                                <Bot className="h-4 w-4 text-[#325AA6]" />
                                            </div>
                                            <div className="flex-1 text-sm">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {trendIcon(pred.trend)}
                                                    <span className={`font-semibold ${pred.recommendation === 'buy_now' ? 'text-primary' : 'text-amber-600'}`}>
                                                        {pred.recommendation === 'buy_now' ? 'Buy Now' : 'Wait for Discount'}
                                                    </span>
                                                    <span className="text-xs text-[#677069]">· predicts ₹{pred.predicted_price_next_week} next week</span>
                                                </div>
                                                <p className="text-[#677069] text-xs leading-relaxed">{pred.reason}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right side: Decision Panel / Route building */}
                <div className="flex flex-col w-full lg:w-[360px] gradient-dark-panel rounded-[24px] p-6 text-white shrink-0 shadow-lg relative overflow-y-auto lg:overflow-hidden">
                    <div className="relative z-10 flex flex-col h-full">
                        <h3 className="font-bold text-xl mb-1">Route & Insights</h3>
                        <p className="text-white/70 text-sm mb-6">Select shops on the left to build your optimized shopping route.</p>

                        <div className="flex-1">
                            {selectedResultObjects.length === 0 ? (
                                <div className="h-32 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-sm font-medium">
                                    No shops selected
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedResultObjects.map((s) => (
                                        <div key={s.shop_id} className="bg-white/10 rounded-xl p-4 border border-white/10">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-semibold text-sm line-clamp-1 pr-4">{s.shop_name}</span>
                                                <span className="font-bold text-emerald-400 shrink-0">₹{s.current_price}</span>
                                            </div>
                                            <div className="text-xs text-white/60">
                                                {s.product_name}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-center">
                                        <span className="font-medium text-white/80">Total Cart</span>
                                        <span className="text-2xl font-bold">₹{totalSelectedPrice}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={openRoute}
                                disabled={selectedResultObjects.length === 0}
                                className="w-full h-12 bg-white text-[#173225] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/90 disabled:opacity-50 transition-colors"
                            >
                                <Route className="w-5 h-5" />
                                {selectedResultObjects.length > 0 ? `Generate Live Route (${selectedResultObjects.length})` : 'Select shops to route'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
