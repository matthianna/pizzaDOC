'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

/** Legacy route — festivi live under Configurazioni. */
export default function HolidaysRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/settings#holidays')
  }, [router])

  return <LoadingSpinner fullScreen text="Reindirizzamento…" />
}
