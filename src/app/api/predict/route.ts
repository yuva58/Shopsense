import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/predict  { product_id }
// Returns AI-generated price prediction based on stored price history
export async function POST(request: NextRequest) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const product_id = body.product_id

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

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'AI provider is disabled' }, { status: 503 })
        }

        // ── Groq Price Prediction (Llama 3.3 70B) ────────────────────────────────
        try {
            const openaiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
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
                return NextResponse.json({ error: 'Failed to process AI request' }, { status: 502 })
            }

            const aiJson = await openaiRes.json()

            try {
                const prediction = JSON.parse(aiJson.choices[0].message.content)
                return NextResponse.json({ prediction, history_points: history.length })
            } catch (parseError) {
                console.error('Groq JSON Parse error:', parseError)
                return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
            }
        } catch (networkError) {
            console.error('Groq Network/Timeout error:', networkError)
            return NextResponse.json({ error: 'AI Service timeout or unavailable' }, { status: 504 })
        }
    } catch (err) {
        return NextResponse.json({ error: 'Malformed request JSON' }, { status: 400 })
    }
}
