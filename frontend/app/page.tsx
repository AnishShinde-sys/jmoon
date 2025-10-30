'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard (which will redirect to login if not authenticated)
    router.replace('/dashboard')
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Budbase</h1>
      <p className="text-muted-foreground text-center max-w-xl">
        Redirecting to dashboard...
      </p>
    </main>
  )
}

