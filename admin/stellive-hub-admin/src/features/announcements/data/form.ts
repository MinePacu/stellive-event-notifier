import { z } from 'zod'
import { type AnnouncementInput } from './api'
import { fromLocalDateTime, toLocalDateTime } from './format'
import {
  ANNOUNCEMENT_SEVERITIES,
  ANNOUNCEMENT_TYPES,
  type Announcement,
  type AnnouncementPlatform,
} from './types'

/**
 * Field-level rules (lengths, URL/version formats, CTA requirements) are
 * enforced by the API and surfaced inline from its 400 `errors`, so the
 * client schema only guarantees the shape.
 */
export const announcementFormSchema = z.object({
  type: z.enum(ANNOUNCEMENT_TYPES),
  severity: z.enum(ANNOUNCEMENT_SEVERITIES),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  android: z.boolean(),
  ios: z.boolean(),
  minimumAppVersion: z.string(),
  maximumAppVersion: z.string(),
  expiresAt: z.string(),
  actionLabel: z.string(),
  appDeepLink: z.string(),
  externalUrl: z.string(),
  isPinned: z.boolean(),
  pushEnabled: z.boolean(),
})

export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>

export function toFormValues(
  item: Announcement | null
): AnnouncementFormValues {
  const platforms = item?.targetPlatforms ?? ['android', 'ios']
  return {
    type: item?.type ?? 'general',
    severity: item?.severity ?? 'info',
    title: item?.title ?? '',
    summary: item?.summary ?? '',
    body: item?.body ?? '',
    android: platforms.includes('android'),
    ios: platforms.includes('ios'),
    minimumAppVersion: item?.minimumAppVersion ?? '',
    maximumAppVersion: item?.maximumAppVersion ?? '',
    expiresAt: toLocalDateTime(item?.expiresAt),
    actionLabel: item?.actionLabel ?? '',
    appDeepLink: item?.appDeepLink ?? '',
    externalUrl: item?.externalUrl ?? '',
    isPinned: item?.isPinned === true,
    pushEnabled: item?.pushEnabled !== false,
  }
}

export function toInput(values: AnnouncementFormValues): AnnouncementInput {
  const targetPlatforms: AnnouncementPlatform[] = []
  if (values.android) targetPlatforms.push('android')
  if (values.ios) targetPlatforms.push('ios')
  return {
    type: values.type,
    severity: values.severity,
    title: values.title.trim(),
    summary: values.summary.trim(),
    body: values.body.trim(),
    isPinned: values.isPinned,
    targetPlatforms,
    minimumAppVersion: values.minimumAppVersion.trim() || null,
    maximumAppVersion: values.maximumAppVersion.trim() || null,
    expiresAt: fromLocalDateTime(values.expiresAt),
    actionLabel: values.actionLabel.trim() || null,
    appDeepLink: values.appDeepLink.trim() || null,
    externalUrl: values.externalUrl.trim() || null,
    pushEnabled: values.pushEnabled,
  }
}

/** API path (`targetPlatforms.0`, `title`, ...) -> form field name. */
export function fieldForPath(
  path: string
): keyof AnnouncementFormValues | null {
  const root = path.split('.')[0]
  if (root === 'targetPlatforms') return 'android'
  return root in announcementFormSchema.shape
    ? (root as keyof AnnouncementFormValues)
    : null
}
