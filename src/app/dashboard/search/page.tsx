'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { MapPin, Search, Route, Loader2, TrendingDown, TrendingUp, Minus, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'

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

interface CatalogProduct {
    id: string
    shop_id: string
    name: string
    current_price: number
    shops?: { name?: string; address?: string } | Array<{ name?: string; address?: string }> | null
}

const mapCatalogProductsToResults = (products: CatalogProduct[]): ShopResult[] =>
    products.map((p) => {
        const shop = Array.isArray(p.shops) ? p.shops[0] : p.shops
        return {
            shop_id: p.shop_id,
            shop_name: shop?.name || 'Unknown shop',
            address: shop?.address || 'Address unavailable',
            distance_metres: -1, // -1 means distance unavailable (global result)
            product_id: p.id,
            product_name: p.name,
            current_price: Number(p.current_price),
        }
    })

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

const buildSearchCandidates = (rawQuery: string) => {
    const trimmed = rawQuery.trim()
    const lower = trimmed.toLowerCase()
    const candidates = new Set<string>([trimmed])

    const aliasMap: Record<string, string> = {
        miruku: 'milk',
        miluku: 'milk',
        paal: 'milk',
        muttai: 'eggs',
        anda: 'eggs',
        rotti: 'bread',
        roti: 'bread',
    }

    if (aliasMap[lower]) {
        candidates.add(aliasMap[lower])
    }

    for (const [misspelled, corrected] of Object.entries(aliasMap)) {
        if (lower.includes(misspelled)) {
            candidates.add(lower.replaceAll(misspelled, corrected))
        }
    }

    return Array.from(candidates)
}

export default function SearchPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<ShopResult[]>([])
    const [lastSearchedQuery, setLastSearchedQuery] = useState('')
    const [hasSearched, setHasSearched] = useState(false)
    const [searchScope, setSearchScope] = useState<'nearby' | 'global' | null>(null)
    const [catalogEmpty, setCatalogEmpty] = useState(false)
    const [loading, setLoading] = useState(false)
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedShops, setSelectedShops] = useState<string[]>([])
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [loadingPredictions, setLoadingPredictions] = useState(false)
    const [predictionStatus, setPredictionStatus] = useState<string | null>(null)
    const [searchNote, setSearchNote] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<'best_price' | 'nearest'>('best_price')
    const searchParams = useSearchParams()
    const autoSearchDone = useRef(false)

    const handleSearch = useCallback(async (overrideQuery?: string) => {
        const trimmedQuery = (overrideQuery ?? query).trim()
        if (!trimmedQuery) return

        setHasSearched(true)
        setLastSearchedQuery(trimmedQuery)
        setLoading(true)
        setError(null)
        setResults([])
        setSearchScope(null)
        setCatalogEmpty(false)
        setSelectedShops([])
        setPredictionStatus(null)
        setSearchNote(null)

        try {
            let userCoords = coords
            if (!userCoords) {
                try {
                    setLocating(true)
                    userCoords = await getLocation()
                    setCoords(userCoords)
                } catch {
                    setSearchNote('Location unavailable. Showing citywide product matches instead.')
                } finally {
                    setLocating(false)
                }
            }

            const searchCandidates = buildSearchCandidates(trimmedQuery)

            if (userCoords) {
                for (const candidate of searchCandidates) {
                    const params = new URLSearchParams({
                        lat: String(userCoords.lat),
                        lng: String(userCoords.lng),
                        radius: '5000',
                        product: candidate,
                    })
                    const res = await fetch(`/api/shops/nearby?${params}`)
                    const json = await res.json()

                    if (!res.ok) throw new Error(json.error || 'Failed to fetch shops')
                    const nearbyResults = (json.shops || []) as ShopResult[]
                    if (nearbyResults.length > 0) {
                        setResults(nearbyResults)
                        setSearchScope('nearby')
                        if (candidate.toLowerCase() !== trimmedQuery.toLowerCase()) {
                            setSearchNote(`No exact match for "${trimmedQuery}". Showing nearby results for "${candidate}".`)
                        }
                        return
                    }
                }
            }

            for (const candidate of searchCandidates) {
                const catalogRes = await fetch(`/api/products?search=${encodeURIComponent(candidate)}`)
                const catalogJson = await catalogRes.json()
                if (!catalogRes.ok) throw new Error(catalogJson.error || 'Failed to fetch products')

                const products = (catalogJson.products || []) as CatalogProduct[]
                if (products.length > 0) {
                    setResults(mapCatalogProductsToResults(products))
                    setSearchScope('global')
                    if (candidate.toLowerCase() !== trimmedQuery.toLowerCase()) {
                        setSearchNote(`No exact match for "${trimmedQuery}". Showing citywide results for "${candidate}".`)
                    }
                    return
                }
            }

            const allProductsRes = await fetch('/api/products')
            const allProductsJson = await allProductsRes.json()
            if (!allProductsRes.ok) throw new Error(allProductsJson.error || 'Failed to fetch products')

            const allProducts = (allProductsJson.products || []) as CatalogProduct[]
            setCatalogEmpty(allProducts.length === 0)
            if (allProducts.length > 0) {
                setResults(mapCatalogProductsToResults(allProducts))
                setSearchScope('global')
                setSearchNote(`No exact matches for "${trimmedQuery}". Showing all products instead.`)
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
            setLocating(false)
        }
    }, [query, coords])

    // Auto-search if ?q= param is present (e.g. from overview page search bar)
    useEffect(() => {
        const q = searchParams.get('q')?.trim()
        if (!q || autoSearchDone.current) return

        autoSearchDone.current = true
        setQuery(q)
        void handleSearch(q)
    }, [searchParams, handleSearch])

    const loadPredictions = async () => {
        if (!results.length) return
        setLoadingPredictions(true)
        setPredictionStatus(null)

        // Predict for a capped subset so users get visible output quickly even for very large result sets.
        const maxPredictions = 40
        const prioritizedResults = [...results].sort((a, b) => {
            const aSelected = selectedShops.includes(a.shop_id) ? 1 : 0
            const bSelected = selectedShops.includes(b.shop_id) ? 1 : 0
            return bSelected - aSelected
        })
        const targets = prioritizedResults.slice(0, maxPredictions)

        const settled = await Promise.allSettled(
            targets.map(async (r) => {
                const fallbackPrediction = {
                    trend: 'stable',
                    predicted_price_next_week: Math.round(r.current_price),
                    recommendation: 'buy_now',
                    confidence: 0.3,
                    reason: 'Fallback estimate used because AI insight is currently unavailable.',
                } as const

                try {
                    const res = await fetch('/api/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_id: r.product_id }),
                    })
                    const json = await res.json()
                    return {
                        key: `${r.shop_id}-${r.product_id}`,
                        prediction: res.ok && json?.prediction ? json.prediction : fallbackPrediction,
                    }
                } catch {
                    return {
                        key: `${r.shop_id}-${r.product_id}`,
                        prediction: fallbackPrediction,
                    }
                }
            })
        )

        const predictionMap = new Map<string, ShopResult['ai_prediction']>()
        settled.forEach((entry) => {
            if (entry.status === 'fulfilled') {
                predictionMap.set(entry.value.key, entry.value.prediction)
            }
        })

        setResults((prev) =>
            prev.map((r) => {
                const key = `${r.shop_id}-${r.product_id}`
                const predicted = predictionMap.get(key)
                if (!predicted) return r
                return { ...r, ai_prediction: predicted }
            })
        )

        const loadedCount = predictionMap.size
        setPredictionStatus(
            loadedCount > 0
                ? `AI insights loaded for ${loadedCount} result${loadedCount > 1 ? 's' : ''}.`
                : 'Could not load AI insights right now. Showing default estimates.'
        )
        setLoadingPredictions(false)
    }

    const toggleShop = (shopId: string) => {
        setSelectedShops((prev) =>
            prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
        )
    }

    const distanceRank = (distanceMetres: number) =>
        distanceMetres >= 0 ? distanceMetres : Number.MAX_SAFE_INTEGER

    const getRouteOrder = (items: ShopResult[]) =>
        [...items].sort((a, b) => distanceRank(a.distance_metres) - distanceRank(b.distance_metres))

    const openRoute = async () => {
        if (!selectedShops.length) return
        const selected = getRouteOrder(
            results.filter((r) => selectedShops.includes(r.shop_id))
        )
        if (!selected.length) return

        let userCoords = coords
        if (!userCoords) {
            try {
                setLocating(true)
                userCoords = await getLocation()
                setCoords(userCoords)
            } catch {
                setError('Location access is required to generate an en-route map.')
                return
            } finally {
                setLocating(false)
            }
        }

        const destination = selected[selected.length - 1]
        const waypointAddresses = selected.slice(0, -1).map((s) => s.address)
        const params = new URLSearchParams({
            api: '1',
            origin: `${userCoords.lat},${userCoords.lng}`,
            destination: destination.address,
            travelmode: 'driving',
        })

        if (waypointAddresses.length > 0) {
            params.set('waypoints', `optimize:true|${waypointAddresses.join('|')}`)
        }

        const url = `https://www.google.com/maps/dir/?${params.toString()}`
        window.open(url, '_blank')
    }

    const cheapest = results.length ? Math.min(...results.map((r) => r.current_price)) : null
    const sortedResults = [...results].sort((a, b) => {
        if (sortBy === 'nearest') {
            return distanceRank(a.distance_metres) - distanceRank(b.distance_metres)
        }
        return a.current_price - b.current_price
    })

    // For the UI match, we separate selected items to the Right Panel (Decision Insights)
    const selectedByShop = results.reduce<Map<string, ShopResult>>((acc, curr) => {
        if (!selectedShops.includes(curr.shop_id)) return acc
        if (!acc.has(curr.shop_id)) acc.set(curr.shop_id, curr)
        return acc
    }, new Map<string, ShopResult>())
    const selectedResultObjects = Array.from(selectedByShop.values())
    const routeOrderedSelected = getRouteOrder(selectedResultObjects)
    const totalSelectedPrice = routeOrderedSelected.reduce((acc, curr) => acc + curr.current_price, 0)
    const totalProjectedNextWeek = routeOrderedSelected.reduce(
        (acc, curr) => acc + (curr.ai_prediction?.predicted_price_next_week ?? curr.current_price),
        0
    )
    const projectedDelta = totalProjectedNextWeek - totalSelectedPrice
    const roundedProjectedDelta = Math.round(projectedDelta)
    const roundedProjectedNextWeek = Math.round(totalProjectedNextWeek)
    const primarySelectedShop = routeOrderedSelected[0]
    const selectedCount = selectedResultObjects.length
    const averageSelectedPrice = selectedCount > 0 ? Math.round(totalSelectedPrice / selectedCount) : 0
    const canGenerateRoute = selectedCount > 0 && !locating
    const mapEmbedSrc = primarySelectedShop
        ? `https://www.google.com/maps?q=${encodeURIComponent(primarySelectedShop.address)}&z=15&output=embed`
        : coords
            ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=14&output=embed`
            : 'https://www.google.com/maps?q=20.5937,78.9629&z=4&output=embed'

    const trendIcon = (trend?: string) => {
        if (trend === 'falling') return <TrendingDown className="h-4 w-4 text-emerald-500" />
        if (trend === 'rising') return <TrendingUp className="h-4 w-4 text-red-400" />
        return <Minus className="h-4 w-4 text-[#677069]" />
    }

    const getPredictionDelta = (result: ShopResult) => {
        if (!result.ai_prediction) return null
        const rawDelta = Math.round(result.ai_prediction.predicted_price_next_week - result.current_price)
        if (rawDelta === 0) {
            return {
                label: 'No change',
                tone: 'bg-[#F3F5F3] text-[#4A5450] border-[#DDE4DA]',
                direction: 'flat' as const,
            }
        }
        if (rawDelta < 0) {
            return {
                label: `-${Math.abs(rawDelta)} INR`,
                tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                direction: 'down' as const,
            }
        }
        return {
            label: `+${Math.abs(rawDelta)} INR`,
            tone: 'bg-red-50 text-red-700 border-red-200',
            direction: 'up' as const,
        }
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
                    onClick={() => handleSearch()}
                    disabled={loading || locating}
                    className="h-[56px] px-8 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-[14px] font-medium text-base transition-colors flex items-center gap-2 shadow-sm"
                >
                    {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    {locating ? 'Locating...' : loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className={`rounded-2xl border p-4 ${hasSearched ? 'bg-[#F4F9F6] border-[#B8D7C3]' : 'bg-white border-[#DDE4DA]'}`}>
                    <p className="text-xs text-[#677069] uppercase tracking-[0.08em] font-semibold">Step 1</p>
                    <p className="mt-1 text-sm font-bold text-[#151614]">Search product</p>
                    <p className="text-xs text-[#677069] mt-1">{hasSearched ? `Searching for "${lastSearchedQuery}"` : 'Type milk, bread, eggs and search.'}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${selectedCount > 0 ? 'bg-[#F4F9F6] border-[#B8D7C3]' : 'bg-white border-[#DDE4DA]'}`}>
                    <p className="text-xs text-[#677069] uppercase tracking-[0.08em] font-semibold">Step 2</p>
                    <p className="mt-1 text-sm font-bold text-[#151614]">Select shops</p>
                    <p className="text-xs text-[#677069] mt-1">{selectedCount > 0 ? `${selectedCount} shop${selectedCount > 1 ? 's' : ''} selected for route.` : 'Use Add button on cards to shortlist shops.'}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${selectedCount > 0 ? 'bg-[#EAF6EF] border-[#90C6A5]' : 'bg-white border-[#DDE4DA]'}`}>
                    <p className="text-xs text-[#677069] uppercase tracking-[0.08em] font-semibold">Step 3</p>
                    <p className="mt-1 text-sm font-bold text-[#151614]">Generate en-route plan</p>
                    <p className="text-xs text-[#677069] mt-1">
                        {selectedCount === 0
                            ? 'Select at least 1 shop to start navigation.'
                            : coords
                                ? 'Click Generate Route. Stops are ordered en-route and optimized in Google Maps.'
                                : 'Click Generate Route and allow location access to start navigation.'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                    {error}
                </div>
            )}

            {searchNote && (
                <div className="p-3 mb-6 rounded-xl bg-[#ECF5EE] border border-[#CDE2D3] text-[#2F5D42] text-sm">
                    {searchNote}
                </div>
            )}

            {/* Content Split: Results (Left) vs insights (Right) */}
            <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">

                {/* Left side: Results List */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="mb-4 bg-white border border-[#DDE4DA] rounded-[20px] overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-[#EEF3EC] flex items-center justify-between">
                            <h2 className="text-sm font-bold text-[#151614]">Live Map</h2>
                            <p className="text-xs text-[#677069]">
                                {primarySelectedShop ? 'Focused on selected shop' : coords ? 'Using your location' : 'Waiting for location access'}
                            </p>
                        </div>
                        <div className="h-[220px] bg-[#EFF5EE]">
                            <iframe
                                title="Search area map"
                                src={mapEmbedSrc}
                                className="w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                        <p className="px-5 py-2 text-[11px] text-[#7B857D] border-t border-[#EEF3EC] bg-[#FBFDFB]">
                            Shop location data source: OpenStreetMap contributors.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-[#151614]">Nearby Results</h2>
                            {searchScope === 'global' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#EEF2FF] text-[#325AA6] border border-[#DDE4FF]">
                                    No nearby matches. Showing citywide results.
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {results.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setSortBy('best_price')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${sortBy === 'best_price' ? 'bg-[#EAF6EF] border-[#A9D0B6] text-[#123324]' : 'bg-white border-[#DDE4DA] text-[#677069]'}`}
                                    >
                                        Sort: Best Price
                                    </button>
                                    <button
                                        onClick={() => setSortBy('nearest')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${sortBy === 'nearest' ? 'bg-[#EAF6EF] border-[#A9D0B6] text-[#123324]' : 'bg-white border-[#DDE4DA] text-[#677069]'}`}
                                    >
                                        Sort: Nearest
                                    </button>
                                </>
                            )}
                            {results.length > 0 && (
                                <button
                                    onClick={loadPredictions}
                                    disabled={loadingPredictions}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#123324] text-white text-sm font-semibold hover:bg-[#1A4732] disabled:opacity-60 transition-colors"
                                >
                                    {loadingPredictions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    {loadingPredictions ? 'Analysing Prices...' : 'Show AI Price Insights'}
                                </button>
                            )}
                        </div>
                    </div>

                    {predictionStatus && (
                        <p className="mb-3 text-xs font-medium text-[#466854]">{predictionStatus}</p>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-8">
                        {results.length > 0 && (
                            <div className="sticky top-0 z-10 rounded-2xl border border-[#C8D9CE] bg-[#F2F8F4] p-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-[#2E7047]">Next Action</p>
                                    <p className="text-sm text-[#173225]">
                                        {selectedCount > 0
                                            ? coords
                                                ? `${selectedCount} shop${selectedCount > 1 ? 's' : ''} selected. Generate en-route navigation now.`
                                                : `${selectedCount} shop${selectedCount > 1 ? 's' : ''} selected. Next: allow location and generate route.`
                                            : 'Select shops from cards, then generate your route.'}
                                    </p>
                                </div>
                                <button
                                    onClick={openRoute}
                                    disabled={!canGenerateRoute}
                                    className="h-10 px-4 rounded-lg bg-[#123324] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                                    {locating ? 'Locating...' : 'Generate Route'}
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-[#677069]">Scanning local stores...</p>
                            </div>
                        )}

                        {!loading && results.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#DDE4DA] rounded-[20px]">
                                <p className="text-[#677069] font-medium">
                                    {hasSearched && catalogEmpty
                                        ? 'No products exist yet. Add shops and products first.'
                                        : hasSearched
                                            ? `No results found for "${lastSearchedQuery}".`
                                            : 'No active search yet.'}
                                </p>
                            </div>
                        )}

                        {!loading && sortedResults.map((result) => {
                            const isCheapest = result.current_price === cheapest
                            const isSelected = selectedShops.includes(result.shop_id)
                            const pred = result.ai_prediction
                            const predictionDelta = getPredictionDelta(result)
                            const hasDistance = Number.isFinite(result.distance_metres) && result.distance_metres >= 0

                            return (
                                <div
                                    key={`${result.shop_id}-${result.product_id}`}
                                    className={`bg-white border ${isSelected ? 'border-primary shadow-sm bg-[#F4F9F6]' : 'border-[#DDE4DA]'} rounded-[18px] p-5 hover:border-primary/50 transition-all`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-[#151614] text-lg">{result.shop_name}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-[#677069] mt-1.5">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span className="line-clamp-1">
                                                    {result.address} <span className="mx-1">-</span> {hasDistance ? `${(result.distance_metres / 1000).toFixed(1)} km away` : 'Citywide match'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {isCheapest && (
                                                <div className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E5F3EB] text-[#2E7047]">
                                                    Best Price
                                                </div>
                                            )}
                                            <button
                                                onClick={() => toggleShop(result.shop_id)}
                                                className={`h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 border transition-colors ${isSelected ? 'bg-[#EAF6EF] text-[#123324] border-[#A9D0B6]' : 'bg-white text-[#173225] border-[#C7D7CC] hover:border-primary/60'}`}
                                            >
                                                {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                                {isSelected ? 'Remove' : 'Add to Route'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="text-xs uppercase tracking-[0.08em] font-semibold text-[#66726A]">Today price</p>
                                        <div className="mt-1 flex items-end justify-between gap-3">
                                            <p className="text-[30px] leading-none font-extrabold text-[#0F5D3A]">INR {result.current_price}</p>
                                            <p className="text-xs text-[#677069] pb-1">{result.product_name}</p>
                                        </div>
                                    </div>

                                    {/* AI Prediction Section */}
                                    {pred ? (
                                        <div className="mt-4 rounded-xl border border-[#D6E7DB] bg-[#F4FAF6] p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B5135]">
                                                    <Sparkles className="h-4 w-4" />
                                                    AI price insight
                                                </div>
                                                {predictionDelta && (
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${predictionDelta.tone}`}>
                                                        {predictionDelta.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                <div className="text-right">
                                                    <p className="text-xs text-[#677069]">Next week estimate</p>
                                                    <p className="text-[22px] leading-none font-extrabold text-[#123324]">INR {pred.predicted_price_next_week}</p>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    {trendIcon(pred.trend)}
                                                    <span className={`font-semibold ${pred.recommendation === 'buy_now' ? 'text-primary' : 'text-amber-700'}`}>
                                                        {pred.recommendation === 'buy_now' ? 'Buy now recommended' : 'Wait may save more'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[#677069] text-xs leading-relaxed mt-2">
                                                {pred.reason} ({Math.round((pred.confidence || 0) * 100)}% confidence)
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-xl border border-dashed border-[#D8E2DC] px-3 py-2 text-xs text-[#6F7B73]">
                                            AI insight not loaded yet. Click <span className="font-semibold">Show AI Price Insights</span> above.
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
                        <p className="text-white/70 text-sm mb-4">Select shops on the left, then generate an en-route optimized trip.</p>

                        <div className="mb-5 rounded-xl bg-white/10 border border-white/10 p-4">
                            <p className="text-xs uppercase tracking-[0.08em] text-white/65 font-semibold">Selection Summary</p>
                            <div className="mt-2 flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-extrabold">{selectedCount}</p>
                                    <p className="text-xs text-white/70">shops selected</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-white/70">Avg selected price</p>
                                    <p className="text-lg font-bold">INR {averageSelectedPrice}</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-white/65 mt-3">Stops are auto-ordered en-route from your current location.</p>
                        </div>

                        <div className="flex-1">
                            {routeOrderedSelected.length === 0 ? (
                                <div className="h-32 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-sm font-medium">
                                    Add shops from cards to start route planning
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {routeOrderedSelected.map((s, index) => {
                                        const predictionDelta = getPredictionDelta(s)
                                        const deltaTone = predictionDelta?.direction === 'down'
                                            ? 'bg-emerald-500/20 text-emerald-100 border-emerald-300/20'
                                            : predictionDelta?.direction === 'up'
                                                ? 'bg-red-500/20 text-red-100 border-red-300/20'
                                                : 'bg-white/10 text-white/80 border-white/20'

                                        return (
                                            <div key={s.shop_id} className="bg-white/10 rounded-xl p-4 border border-white/10">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] uppercase tracking-[0.08em] text-white/60 font-semibold">Stop {index + 1}</p>
                                                        <span className="font-semibold text-sm line-clamp-1">{s.shop_name}</span>
                                                        <div className="text-xs text-white/60 mt-0.5">{s.product_name}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleShop(s.shop_id)}
                                                        className="h-8 px-3 rounded-lg border border-white/20 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    <span className="font-bold text-emerald-300 shrink-0">INR {s.current_price}</span>
                                                    {s.ai_prediction ? (
                                                        <div className="text-right">
                                                            <p className="text-[11px] text-white/65">AI next week</p>
                                                            <p className="text-sm font-bold">INR {s.ai_prediction.predicted_price_next_week}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-white/60">Run AI insight</span>
                                                    )}
                                                </div>

                                                {predictionDelta && (
                                                    <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${deltaTone}`}>
                                                        {predictionDelta.label} vs today
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}

                                    <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-white/80">Total Cart</span>
                                            <span className="text-2xl font-bold">INR {totalSelectedPrice}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-white/80">
                                            <span>Projected next week</span>
                                            <span className="font-semibold">INR {roundedProjectedNextWeek}</span>
                                        </div>
                                        <p className={`text-[11px] ${roundedProjectedDelta <= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                                            {roundedProjectedDelta === 0
                                                ? 'AI predicts no overall basket change next week.'
                                                : roundedProjectedDelta < 0
                                                    ? `Potential basket saving: INR ${Math.abs(roundedProjectedDelta)} next week.`
                                                    : `Potential basket increase: INR ${roundedProjectedDelta} next week.`}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={openRoute}
                                disabled={!canGenerateRoute}
                                className="w-full h-12 bg-white text-[#173225] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/90 disabled:opacity-50 transition-colors"
                            >
                                {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Route className="w-5 h-5" />}
                                {locating
                                    ? 'Locating...'
                                    : routeOrderedSelected.length > 0
                                        ? `Generate En-route Plan (${routeOrderedSelected.length})`
                                        : 'Select shops to route'}
                            </button>
                            {routeOrderedSelected.length > 0 && (
                                <button
                                    onClick={() => setSelectedShops([])}
                                    className="w-full mt-2 h-10 border border-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/10 transition-colors"
                                >
                                    Clear selection
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
