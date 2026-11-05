import { createFileRoute } from '@tanstack/react-router'
import { HubEvents } from '@/features/hub-events'

export const Route = createFileRoute('/_authenticated/hub-events')({
  component: HubEvents,
})
