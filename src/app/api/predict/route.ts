import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Trend = 'rising' | 'falling' | 'stable'
type Recommendation = 'buy_now' | 'wait'

type PricePrediction = {
    trend: Trend
    predicted_price_next_week: number
    recommendation: Recommendation
    confidence: number
    reason: string
    source?: 'ai' | 'fallback'
}

type PriceHistoryRow = {
    price: number | string
    recorded_at: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const roundInr = (value: number) => Math.max(1, Math.round(value))

function buildFallbackPrediction(
    currentPrice: number,
    history: Array<{ price: number; recorded_at: string }>
): PricePrediction {
    let trend: Trend = 'stable'
    let nextWeek = currentPrice

    if (history.length >= 2) {
        const newest = history[0].price
        const previous = history[1].price
        const delta = newest - previous
        if (Math.abs(delta) >= 1) {
            trend = delta > 0 ? 'rising' : 'falling'
            nextWeek = newest + delta * 0.5
        }
    }

    const recommendation: Recommendation = trend === 'falling' ? 'wait' : 'buy_now'
    const confidence = history.length >= 10 ? 0.68 : history.length >= 4 ? 0.52 : 0.35
    const context =
        history.length < 2
            ? 'Only a small amount of Chennai price history is available right now.'
            : 'This estimate comes from recent local price movements.'

    const trendSummary =
        trend === 'falling'
            ? 'Prices have been trending down recently.'
            : trend === 'rising'
                ? 'Prices have been trending up recently.'
                : 'Prices have been mostly stable recently.'

    const actionSummary =
        recommendation === 'buy_now'
            ? 'Buying now is likely the safer option.'
            : 'Waiting for a few days may help you save.'

    return {
        trend,
        predicted_price_next_week: roundInr(nextWeek),
        recommendation,
        confidence,
        reason: `${trendSummary} ${actionSummary} ${context}`,
        source: 'fallback',
    }
}

function normalizeAiPrediction(raw: unknown, fallback: PricePrediction): PricePrediction {
    if (!raw || typeof raw !== 'object') return fallback
    const parsed = raw as Record<string, unknown>

    const trend = parsed.trend === 'rising' || parsed.trend === 'falling' || parsed.trend === 'stable'
        ? parsed.trend
        : fallback.trend

    const predicted = Number(parsed.predicted_price_next_week)
    const predicted_price_next_week = Number.isFinite(predicted)
        ? roundInr(predicted)
        : fallback.predicted_price_next_week

    const recommendation = parsed.recommendation === 'buy_now' || parsed.recommendation === 'wait'
        ? parsed.recommendation
        : fallback.recommendation

    const confidenceRaw = Number(parsed.confidence)
    const confidence = Number.isFinite(confidenceRaw)
        ? clamp(confidenceRaw, 0, 1)
        : fallback.confidence

    const reason = typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : fallback.reason

    return {
        trend,
        predicted_price_next_week,
        recommendation,
        confidence,
        reason,
        source: 'ai',
    }
}

// POST /api/predict  { product_id }
// Returns AI-generated price prediction (with deterministic fallback if AI/history is unavailable).
export async function POST(request: NextRequest) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const product_id = body?.product_id

        if (!product_id || typeof product_id !== 'string') {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, current_price')
            .eq('id', product_id)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const currentPrice = Number(product.current_price)
        if (!Number.isFinite(currentPrice)) {
            return NextResponse.json({ error: 'Invalid current product price' }, { status: 500 })
        }

        const { data: historyRows, error: histError } = await supabase
            .from('price_history')
            .select('price, recorded_at')
            .eq('product_id', product_id)
            .order('recorded_at', { ascending: false })
            .limit(90)

        if (histError) {
            const fallback = buildFallbackPrediction(currentPrice, [])
            return NextResponse.json({
                prediction: fallback,
                history_points: 0,
                fallback: true,
            })
        }

        const history = ((historyRows || []) as PriceHistoryRow[])
            .map((row) => ({
                price: Number(row.price),
                recorded_at: row.recorded_at,
            }))
            .filter((row) => Number.isFinite(row.price))

        const fallback = buildFallbackPrediction(currentPrice, history)

        if (history.length < 1) {
            return NextResponse.json({
                prediction: fallback,
                history_points: history.length,
                fallback: true,
                message: 'No price history available for model inference; using fallback trend.',
            })
        }

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({
                prediction: fallback,
                history_points: history.length,
                fallback: true,
                message: 'AI provider is disabled; using fallback trend.',
            })
        }

        const priceTable = history
            .slice()
            .reverse()
            .map((row) => `${new Date(row.recorded_at).toLocaleDateString('en-IN')} -> INR ${row.price}`)
            .join('\n')

        try {
            const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                },
                signal: AbortSignal.timeout(10000),
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.2,
                    response_format: { type: 'json_object' },
                    messages: [
                        {
                            role: 'system',
                            content: `You are a pricing analyst. Given product price history, return JSON only:
{
  "trend": "rising" | "falling" | "stable",
  "predicted_price_next_week": <number in INR>,
  "recommendation": "buy_now" | "wait",
  "confidence": <0.0-1.0>,
  "reason": "<max 2 short sentences, plain language for everyday shoppers>"
}`,
                        },
                        {
                            role: 'user',
                            content: `Price history (oldest to newest):\n${priceTable}`,
                        },
                    ],
                }),
            })

            if (!aiResponse.ok) {
                return NextResponse.json({
                    prediction: fallback,
                    history_points: history.length,
                    fallback: true,
                    message: `AI provider returned ${aiResponse.status}; using fallback trend.`,
                })
            }

            const aiJson = await aiResponse.json()
            const rawContent = aiJson?.choices?.[0]?.message?.content
            const rawPrediction = typeof rawContent === 'string' ? JSON.parse(rawContent) : null
            const prediction = normalizeAiPrediction(rawPrediction, fallback)

            return NextResponse.json({
                prediction,
                history_points: history.length,
                fallback: prediction.source !== 'ai',
            })
        } catch {
            return NextResponse.json({
                prediction: fallback,
                history_points: history.length,
                fallback: true,
                message: 'AI request failed or timed out; using fallback trend.',
            })
        }
    } catch {
        return NextResponse.json({ error: 'Malformed request JSON' }, { status: 400 })
    }
}
