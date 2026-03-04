import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen gradient-hero-bg overflow-hidden flex flex-col items-center">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/3 w-[620px] h-[620px] bg-[#DFF0E6] rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute top-1/4 right-0 translate-x-1/3 -translate-y-1/4 w-[520px] h-[520px] bg-[#FCE6DB] rounded-full blur-3xl opacity-60 pointer-events-none" />

      {/* Top Navigation */}
      <nav className="relative z-10 w-full max-w-[1312px] mt-8 mx-auto h-16 glass-panel rounded-2xl flex justify-between items-center px-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 ml-2">
          <div className="w-[34px] h-[34px] bg-primary rounded-[10px] flex items-center justify-center text-white font-bold text-lg">
            S
          </div>
          <span className="font-semibold text-xl text-heading tracking-tight">ShopSense</span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/login" className="text-[15px] font-medium text-body hover:text-heading transition-colors">How it works</Link>
          <Link href="/dashboard" className="text-[15px] font-medium text-body hover:text-heading transition-colors">Features</Link>
          <Link href="/register" className="text-[15px] font-medium text-body hover:text-heading transition-colors">For shop owners</Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 mr-1">
          <Link href="/login" className="h-10 px-5 flex items-center justify-center rounded-xl border border-border text-[15px] font-medium text-heading hover:bg-black/5 transition-colors">
            Sign in
          </Link>
          <Link href="/register" className="h-10 px-5 flex items-center justify-center rounded-xl bg-primary text-white text-[15px] font-medium hover:bg-primary/90 transition-colors shadow-sm">
            Create account
          </Link>
        </div>
      </nav>

      {/* Main Hero Section */}
      <main className="relative z-10 w-full max-w-[1312px] mx-auto mt-12 mb-20 flex flex-col lg:flex-row gap-8 px-4 lg:px-0">

        {/* Left Content Card */}
        <section className="flex-1 glass-panel-heavy rounded-[24px] p-8 lg:p-10 flex flex-col justify-between">
          <div className="space-y-6">
            <span className="text-primary font-semibold text-sm tracking-wide uppercase">AI shopping companion for local neighborhoods</span>
            <h1 className="text-[56px] lg:text-[62px] font-bold text-heading leading-[1.02] tracking-[-1.2px] max-w-2xl">
              Find trusted nearby shops, compare real prices, and plan the smartest route.
            </h1>
            <p className="text-body text-lg leading-[1.4] max-w-xl">
              Search a product once. ShopSense surfaces nearby availability, AI trust signals from reviews, price-drop predictions, and the shortest store-to-store path.
            </p>
          </div>

          <div className="mt-12 space-y-8">
            {/* Search Mockup Area */}
            <div className="bg-[#F8FAF6] border border-border rounded-xl p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex gap-3">
                <input type="text" aria-label="Search product" placeholder="Search product e.g., milk, bread..." className="flex-1 h-12 bg-white rounded-lg px-4 border border-border text-sm outline-none focus:border-primary" />
                <div className="w-32 h-12 bg-white rounded-lg px-4 border border-border flex items-center text-sm text-body">
                  Radius: 5 km
                </div>
              </div>
              <Link href="/dashboard" className="h-12 px-6 flex items-center justify-center rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
                Find best options
              </Link>
            </div>

            <div className="flex gap-3">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#E5F3EB] text-[#2E7047]">Nearby availability</span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FCECE6] text-[#A64D32]">AI trust score</span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#EBF0FC] text-[#325AA6]">Price trend forecast</span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-8">
              <div>
                <div className="text-3xl font-bold text-heading">300+</div>
                <div className="text-xs text-body mt-1">Verified local shops</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-heading">14%</div>
                <div className="text-xs text-body mt-1">Average savings per trip</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-heading">4.8</div>
                <div className="text-xs text-body mt-1">Trusted review quality score</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Visual Card */}
        <section className="flex-1 lg:max-w-[480px] bg-brand-dark rounded-[24px] p-5 flex flex-col gap-4">

          {/* Map Area Mockup */}
          <div className="flex-1 min-h-[300px] gradient-dark-panel rounded-[18px] p-5 flex flex-col justify-end border border-white/5">
            <div className="mb-2">
              <span className="text-white font-semibold text-lg">Route AI: 11 min faster than default map path</span>
            </div>
            <div className="flex gap-2">
              <span className="bg-white/10 text-white/90 text-xs px-3 py-1 rounded-full border border-white/20">Stop 1: Aavin</span>
              <span className="bg-[#4D4466] text-[#E8DDF2] text-xs px-3 py-1 rounded-full border border-[#6B5A81]">Stop 2: Local Mart</span>
            </div>
          </div>

          {/* Trust Panel Mockup */}
          <div className="bg-white rounded-[18px] p-5">
            <h3 className="text-xl font-bold text-heading mb-1">Today&apos;s best local basket</h3>
            <p className="text-xs text-body mb-4">AI removed 12 suspicious reviews and ranked by trusted value.</p>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-heading">Milk 1L - Aavin</span>
                <span className="font-semibold">₹48</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-heading">Whole Wheat Bread</span>
                <span className="font-semibold">₹35</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-heading">Eggs - 12 pack</span>
                <span className="font-semibold">₹78</span>
              </div>
            </div>

            <button className="w-full h-10 bg-[#162D1F] text-white rounded-xl text-sm font-medium hover:bg-black transition-colors">
              Open live comparison
            </button>
          </div>

        </section>
      </main>
    </div>
  );
}
