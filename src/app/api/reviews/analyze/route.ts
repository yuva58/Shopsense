import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/reviews/analyze  { product_id, content, rating }
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { product_id, content, rating } = await request.json()
    if (!product_id || !content) {
        return NextResponse.json({ error: 'product_id and content are required' }, { status: 400 })
    }

    // ── Groq Sentiment Analysis (Llama 3.3 70B) ──────────────────────────────
    const openaiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You are a review authenticity and sentiment classifier.
Analyse the review text and respond ONLY with a JSON object:
{
  "sentiment": "positive" | "negative" | "neutral",
  "is_fake": true | false,
  "trust_score": <0.0–1.0>,
  "reason": "<one-sentence explanation>"
}
Mark is_fake=true when the review is generic / copied / incentivised / nonsensical.`,
                },
                { role: 'user', content: `Review: "${content}"` },
            ],
        }),
    })

    if (!openaiRes.ok) {
        const err = await openaiRes.json()
        return NextResponse.json({ error: err.error?.message || 'Groq error' }, { status: 502 })
    }

    const aiJson = await openaiRes.json()
    const ai = JSON.parse(aiJson.choices[0].message.content)

    const ai_sentiment_score = ai.is_fake ? 'fake' : ai.sentiment
    const ai_trust_score = ai.trust_score

    // ── Persist review with AI scores ─────────────────────────────────────────
    const { data: review, error } = await supabase
        .from('reviews')
        .insert({
            product_id,
            user_id: user.id,
            content,
            rating,
            ai_sentiment_score,
            ai_trust_score,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ review, ai_analysis: ai }, { status: 201 })
}
