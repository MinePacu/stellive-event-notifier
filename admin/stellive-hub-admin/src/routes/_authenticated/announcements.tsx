import { createFileRoute } from '@tanstack/react-router'
import { Announcements } from '@/features/announcements'

export const Route = createFileRoute('/_authenticated/announcements')({
  component: Announcements,
})
