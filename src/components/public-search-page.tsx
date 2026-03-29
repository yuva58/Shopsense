'use client'

import { useEffect, useState } from 'react'
import { Compass, Loader2, MapPin, Navigation, Search, Sparkles } from 'lucide-react'

type PricePrediction = {
    trend: 'rising' | 'falling' | 'stable'
    predicted_price_next_week: number
    recommendation: 'buy_now' | 'wait'
    confidence: number
    reason: string
    source?: 'ai' | 'fallback'
}

type SearchResult = {
    shop_id: string
    shop_name: string
    address: string
    distance_metres: number
    product_id: string
    product_name: string
    current_price: number
    ai_prediction: PricePrediction
    route_destination: string
    match_reason: string
    is_best_match?: boolean
}

type SearchResponse = {
    query: string
    coverage: string
    used_location: boolean
    note?: string
    best_match: SearchResult | null
    results: SearchResult[]
}

const currency = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
})

const getLocation = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'))
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            }),
            () => reject(new Error('Location access denied')),
            { maximumAge: 0, timeout: 12000, enableHighAccuracy: true }
        )
    })

const distanceLabel = (distanceMetres: number) =>
    distanceMetres >= 0 ? `${(distanceMetres / 1000).toFixed(1)} km away` : 'Regional beta match'

const confidenceLabel = (confidence: number) => {
    if (confidence >= 0.65) return 'Higher confidence'
    if (confidence >= 0.45) return 'Medium confidence'
    return 'Low confidence'
}

const recommendationLabel = (recommendation: PricePrediction['recommendation']) =>
    recommendation === 'buy_now' ? 'Buy now' : 'Wait and watch'

const trendTone = (trend: PricePrediction['trend']) => {
    if (trend === 'falling') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    if (trend === 'rising') return 'text-rose-700 bg-rose-50 border-rose-200'
    return 'text-slate-700 bg-slate-50 border-slate-200'
}

const buildRouteUrl = (coords: { lat: number; lng: number }, destination: string) => {
    const params = new URLSearchParams({
        api: '1',
        origin: `${coords.lat},${coords.lng}`,
        destination,
        travelmode: 'driving',
    })

    return `https://www.google.com/maps/dir/?${params.toString()}`
}

export default function PublicSearchPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [bestMatch, setBestMatch] = useState<SearchResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [note, setNote] = useState<string | null>(null)
    const [coverage, setCoverage] = useState('Chennai (incl. Poonamallee / Panimalar), Tiruvallur, Chengalpattu, and Kanchipuram')
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [lastQuery, setLastQuery] = useState('')
    const [hasSearched, setHasSearched] = useState(false)

    const runSearch = async (overrideQuery?: string) => {
        const trimmed = (overrideQuery ?? query).trim()
        if (!trimmed) return

        setHasSearched(true)
        setLastQuery(trimmed)
        setLoading(true)
        setError(null)
        setNote(null)
        setResults([])
        setBestMatch(null)

        let currentCoords = coords
        try {
            setLocating(true)
            currentCoords = await getLocation()
            setCoords(currentCoords)
        } catch {
            currentCoords = null
        } finally {
            setLocating(false)
        }

        try {
            const params = new URLSearchParams({ q: trimmed, limit: '8' })
            if (currentCoords) {
                params.set('lat', String(currentCoords.lat))
                params.set('lng', String(currentCoords.lng))
            }

            const response = await fetch(`/api/search?${params.toString()}`)
            const json = await response.json() as SearchResponse & { error?: string }

            if (!response.ok) {
                throw new Error(json.error || 'Unable to search products right now.')
            }

            setCoverage(json.coverage || coverage)
            setNote(json.note || (!currentCoords ? 'Allow location access to get the shortest route to the best store.' : null))
            setBestMatch(json.best_match)
            setResults(json.results || [])
        } catch (searchError) {
            setError(searchError instanceof Error ? searchError.message : 'Unable to search products right now.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const initialQuery = new URLSearchParams(window.location.search).get('q')?.trim()
        if (!initialQuery) return
        setQuery(initialQuery)
        void runSearch(initialQuery)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const openRoute = (result: SearchResult) => {
        if (!coords) {
            setError('Enable location access to generate the shortest route from your current location.')
            return
        }

        window.open(buildRouteUrl(coords, result.route_destination), '_blank', 'noopener,noreferrer')
    }

    const alternatives = results.filter((result) => !result.is_best_match)

    return (
        <div className="min-h-screen bg-[#F2F5F1]">
            <div className="mx-auto w-full max-w-[1320px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
                <section className="overflow-hidden rounded-[28px] border border-[#DCE5D9] bg-[radial-gradient(circle_at_top_left,#F5FBF7,white_55%,#EEF4F0)] p-6 shadow-[0_18px_60px_rgba(18,51,36,0.08)] lg:p-8">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#BCD5C6] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#2C6A49]">
                                <Compass className="h-3.5 w-3.5" />
                                Public beta
                            </div>
                            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#173225] md:text-5xl">
                                Search products across the Chennai metro region and open the fastest route instantly.
                            </h1>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-[#5E6D63]">
                                No login, no setup. Search for products like milk, Coca-Cola, detergent, toothpaste, or daily essentials and get nearby store matches across {coverage}.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2 text-sm font-medium text-[#335B46]">
                                <span className="rounded-full bg-[#EAF5EE] px-3 py-1">Estimated availability</span>
                                <span className="rounded-full bg-[#EAF5EE] px-3 py-1">Auto location-aware ranking</span>
                                <span className="rounded-full bg-[#EAF5EE] px-3 py-1">AI price outlook</span>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-[#DDE7E0] bg-white px-5 py-4 shadow-sm lg:w-[330px]">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6C7C72]">Coverage</p>
                            <p className="mt-2 text-lg font-bold text-[#173225]">Chennai Metro + Nearby Districts</p>
                            <p className="mt-1 text-sm leading-6 text-[#5E6D63]">
                                Chennai (incl. Poonamallee / Panimalar), Tiruvallur, Chengalpattu, and Kanchipuram.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            void runSearch()
                        }}
                        className="mt-8 flex flex-col gap-3 rounded-[24px] border border-[#D7E1DB] bg-white p-3 shadow-sm lg:flex-row"
                    >
                        <div className="flex h-14 flex-1 items-center gap-3 rounded-[18px] border border-[#DDE5DE] bg-[#FBFCFB] px-4">
                            <Search className="h-5 w-5 text-[#5C6C62]" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search milk, coca cola, detergent, rice..."
                                className="h-full w-full bg-transparent text-base text-[#173225] outline-none placeholder:text-[#7C8A81]"
                                aria-label="Search product"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex h-14 items-center justify-center gap-2 rounded-[18px] bg-[#2D7A4F] px-6 text-base font-semibold text-white transition-colors hover:bg-[#256641] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            {loading ? 'Searching...' : 'Search stores'}
                        </button>
                    </form>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#5C6C62]">
                        <span className="rounded-full bg-white px-3 py-1 shadow-sm">Best match list: 5-8 stores</span>
                        <span className="rounded-full bg-white px-3 py-1 shadow-sm">Route uses your current location</span>
                        <span className="rounded-full bg-white px-3 py-1 shadow-sm">Forecasts are beta estimates</span>
                    </div>
                </section>

                {error && (
                    <div className="mt-6 rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
                        {error}
                    </div>
                )}

                {note && !error && (
                    <div className="mt-6 rounded-[20px] border border-[#CCE0D4] bg-[#F3FAF5] px-5 py-4 text-sm font-medium text-[#28543D]">
                        {locating ? 'Checking your current location...' : note}
                    </div>
                )}

                <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <section className="rounded-[28px] border border-[#DCE5D9] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#708077]">Best nearby option</p>
                                <h2 className="mt-2 text-2xl font-bold text-[#173225]">
                                    {bestMatch ? bestMatch.shop_name : 'Search to find the best store near you'}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-[#627067]">
                                    {bestMatch
                                        ? bestMatch.match_reason
                                        : 'We will rank the strongest product match using your location, estimated price, and nearby availability.'}
                                </p>
                            </div>
                            <div className="hidden rounded-[20px] bg-[#163525] px-5 py-4 text-white shadow-sm sm:block">
                                <p className="text-xs uppercase tracking-[0.14em] text-white/65">Status</p>
                                <p className="mt-2 text-lg font-semibold">{coords ? 'Location ready' : 'Location optional'}</p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-[24px] border border-[#DDE5DE] bg-[#F8FBF9] p-5">
                            {bestMatch ? (
                                <div className="space-y-5">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="inline-flex rounded-full bg-[#E6F4EB] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2D7A4F]">
                                                Best nearby store
                                            </div>
                                            <h3 className="mt-3 text-3xl font-bold text-[#173225]">{bestMatch.shop_name}</h3>
                                            <div className="mt-2 flex items-start gap-2 text-sm text-[#66746B]">
                                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                                <span>{bestMatch.address}</span>
                                            </div>
                                        </div>
                                        <div className="min-w-[170px] rounded-[20px] bg-white px-4 py-4 shadow-sm">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[#718178]">Today estimate</p>
                                            <p className="mt-2 text-3xl font-bold text-[#0E5E3C]">INR {currency.format(bestMatch.current_price)}</p>
                                            <p className="mt-1 text-sm text-[#607065]">{distanceLabel(bestMatch.distance_metres)}</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="rounded-[18px] border border-[#DCE5DE] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[#6B7B71]">Matched product</p>
                                            <p className="mt-2 text-lg font-semibold text-[#173225]">{bestMatch.product_name}</p>
                                        </div>
                                        <div className="rounded-[18px] border border-[#DCE5DE] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[#6B7B71]">Next week estimate</p>
                                            <p className="mt-2 text-lg font-semibold text-[#173225]">
                                                INR {currency.format(bestMatch.ai_prediction.predicted_price_next_week)}
                                            </p>
                                        </div>
                                        <div className="rounded-[18px] border border-[#DCE5DE] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-[#6B7B71]">Recommendation</p>
                                            <p className="mt-2 text-lg font-semibold text-[#173225]">
                                                {recommendationLabel(bestMatch.ai_prediction.recommendation)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-[20px] border border-[#DCE5DE] bg-white p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#234D39]">
                                                <Sparkles className="h-4 w-4" />
                                                AI price outlook
                                            </div>
                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${trendTone(bestMatch.ai_prediction.trend)}`}>
                                                {bestMatch.ai_prediction.trend}
                                            </span>
                                            <span className="rounded-full border border-[#DCE5DE] bg-[#F6F8F7] px-2.5 py-1 text-xs font-semibold text-[#526157]">
                                                {confidenceLabel(bestMatch.ai_prediction.confidence)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-[#5C6B62]">
                                            {bestMatch.ai_prediction.reason}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <button
                                            onClick={() => openRoute(bestMatch)}
                                            className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#173225] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#102417]"
                                        >
                                            <Navigation className="h-4 w-4" />
                                            Open fastest route
                                        </button>
                                        <div className="inline-flex h-12 items-center rounded-[16px] border border-[#DCE5DE] bg-white px-4 text-sm font-medium text-[#5B6A61]">
                                            Estimated availability for the metro beta region
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-h-[240px] items-center justify-center rounded-[20px] border-2 border-dashed border-[#D7E1DB] bg-white px-6 text-center text-[#6B7970]">
                                    {loading
                                        ? 'Searching stores and ranking the best nearby option...'
                                        : hasSearched
                                            ? `No strong matches found for "${lastQuery}" yet. Try a broader product term.`
                                            : 'Start with a product search to see the best nearby store, AI forecast, and route option.'}
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="rounded-[28px] border border-[#DCE5D9] bg-[#173225] p-6 text-white shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Alternative matches</p>
                        <h2 className="mt-2 text-2xl font-bold">Shortlist of nearby stores</h2>
                        <p className="mt-2 text-sm leading-6 text-white/70">
                            Keep the beta simple: one best route first, then a few alternatives if you want to compare.
                        </p>

                        <div className="mt-6 space-y-3">
                            {loading && (
                                <div className="flex h-28 items-center justify-center rounded-[20px] border border-white/10 bg-white/5">
                                    <Loader2 className="h-6 w-6 animate-spin text-white/80" />
                                </div>
                            )}

                            {!loading && alternatives.length === 0 && (
                                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                                    {bestMatch
                                        ? 'No additional alternatives were needed for this search.'
                                        : 'Alternative stores will appear here after you search.'}
                                </div>
                            )}

                            {!loading && alternatives.map((result) => (
                                <div key={`${result.shop_id}-${result.product_id}`} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-semibold">{result.shop_name}</h3>
                                            <p className="mt-1 text-sm text-white/65">{result.product_name}</p>
                                        </div>
                                        <span className="shrink-0 text-lg font-bold text-emerald-200">
                                            INR {currency.format(result.current_price)}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-start gap-2 text-sm text-white/70">
                                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{distanceLabel(result.distance_metres)}</span>
                                    </div>
                                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/75">
                                        {result.ai_prediction.reason}
                                    </p>
                                    <button
                                        onClick={() => openRoute(result)}
                                        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-white px-4 text-sm font-semibold text-[#173225] transition-colors hover:bg-white/90"
                                    >
                                        <Navigation className="h-4 w-4" />
                                        Route to this store
                                    </button>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
