'use client'

import { useEffect } from 'react'

const SW_CLEANUP_FLAG = '__shopsense_sw_cleanup_done__'

export default function DevSwCleanup() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return
        if (!('serviceWorker' in navigator)) return

        void (async () => {
            try {
                const regs = await navigator.serviceWorker.getRegistrations()
                if (regs.length === 0) return

                await Promise.all(regs.map((reg) => reg.unregister()))

                if ('caches' in window) {
                    const cacheKeys = await caches.keys()
                    await Promise.all(cacheKeys.map((key) => caches.delete(key)))
                }

                const cleanupDone = window.sessionStorage.getItem(SW_CLEANUP_FLAG) === '1'
                if (!cleanupDone) {
                    window.sessionStorage.setItem(SW_CLEANUP_FLAG, '1')
                    window.location.reload()
                }
            } catch {
                // Ignore cleanup failures in development.
            }
        })()
    }, [])

    return null
}
