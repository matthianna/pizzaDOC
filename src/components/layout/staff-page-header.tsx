'use client'

import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layout/page-header'

type StaffPageHeaderProps = {
  title: string
  subtitle?: string
  action?: ReactNode
}

/** @deprecated Prefer PageHeader — kept as thin alias for existing imports. */
export function StaffPageHeader({ title, subtitle, action }: StaffPageHeaderProps) {
  return <PageHeader title={title} subtitle={subtitle} action={action} />
}
