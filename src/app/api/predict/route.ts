import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/predict  { product_id }
// Returns AI-generated price prediction based on stored price history
export async function POST(request: NextRequest) {
    const supabase = await createClient()

    const { product_id } = await request.json()
    if (!product_id) {
        return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }

    // Fetch price history  (last 90 entries, newest first)
    const { data: history, error: histError } = await supabase
        .from('price_history')
        .select('price, recorded_at')
        .eq('product_id', product_id)
        .order('recorded_at', { ascending: false })
        .limit(90)

    if (histError) return NextResponse.json({ error: histError.message }, { status: 500 })

    if (!history || history.length < 2) {
        return NextResponse.json({
            prediction: null,
            message: 'Not enough price history to generate a prediction.',
        })
    }

    // Format for the prompt
    const priceTable = history
        .slice()
        .reverse()
        .map((r) => `${new Date(r.recorded_at).toLocaleDateString('en-IN')} → ₹${r.price}`)
        .join('\n')

    // ── Groq Price Prediction (Llama 3.3 70B) ────────────────────────────────
    const openaiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You are a pricing analyst. Given a product's historical price data, 
predict the price trend and advise whether a customer should buy now or wait.
Respond ONLY with JSON:
{
  "trend": "rising" | "falling" | "stable",
  "predicted_price_next_week": <number in INR>,
  "recommendation": "buy_now" | "wait",
  "confidence": <0.0–1.0>,
  "reason": "<two-sentence max explanation>"
}`,
                },
                {
                    role: 'user',
                    content: `Price history (oldest to newest):\n${priceTable}`,
                },
            ],
        }),
    })

    if (!openaiRes.ok) {
        const err = await openaiRes.json()
        return NextResponse.json({ error: err.error?.message || 'Groq error' }, { status: 502 })
    }

    const aiJson = await openaiRes.json()
    const prediction = JSON.parse(aiJson.choices[0].message.content)

    return NextResponse.json({ prediction, history_points: history.length })
}
