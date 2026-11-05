import { Link } from '@tanstack/react-router'
import { BellRing } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

/** Static app label at the top of the sidebar (no team switching). */
export function AppTitle() {
  const t = useT()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg' asChild tooltip={t('app.name')}>
          <Link to='/' onClick={() => setOpenMobile(false)}>
            <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
              <BellRing className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>Stellive Hub Admin</span>
              <span className='truncate text-xs'>{t('app.subtitle')}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
