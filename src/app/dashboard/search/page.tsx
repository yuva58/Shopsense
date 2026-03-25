import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyDashboardSearchPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>
}) {
    const params = await searchParams
    const q = params.q?.trim()
    redirect(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
}
