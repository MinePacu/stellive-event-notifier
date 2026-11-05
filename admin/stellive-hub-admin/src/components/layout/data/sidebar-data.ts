import { useMemo } from 'react'
import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  Wrench,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { isTauri } from '@/lib/runtime'
import { type SidebarData } from '../types'

/** Sidebar/command-menu navigation, translated for the current locale. */
export function useSidebarData(): SidebarData {
  const t = useT()
  return useMemo(
    () => ({
      navGroups: [
        {
          title: t('nav.groupContent'),
          items: [
            { title: t('nav.dashboard'), url: '/', icon: LayoutDashboard },
            {
              title: t('nav.hubEvents'),
              url: '/hub-events',
              icon: CalendarDays,
            },
            {
              title: t('nav.announcements'),
              url: '/announcements',
              icon: Megaphone,
            },
            // The server console still has the goods list and MD gallery
            // editors. It needs the web admin session cookie, so the desktop
            // app (bearer token only) does not link to it.
            ...(isTauri()
              ? []
              : [
                  {
                    title: t('nav.legacyConsole'),
                    url: '/admin/legacy',
                    icon: ExternalLink,
                    external: true,
                  },
                ]),
          ],
        },
        {
          title: t('nav.groupSystem'),
          items: [
            { title: t('nav.operations'), url: '/operations', icon: Wrench },
            { title: t('nav.audit'), url: '/audit', icon: ScrollText },
            { title: t('nav.settings'), url: '/settings', icon: Settings },
          ],
        },
      ],
    }),
    [t]
  )
}
