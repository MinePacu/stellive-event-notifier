import { useMemo } from 'react'
import {
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  Wrench,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
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
