import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { isTauri } from '@/lib/runtime'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { DesktopTitleBar } from '@/components/layout/desktop-title-bar'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const content = (
    <>
      <SkipToMain />
      <AppSidebar />
      <SidebarInset
        className={cn(
          // Set content container, so we can use container queries
          '@container/content',

          // If layout is fixed, set the height
          // to 100svh to prevent overflow
          'has-data-[layout=fixed]:h-svh',

          // If layout is fixed and sidebar is inset,
          // set the height to 100svh - spacing (total margins) to prevent overflow
          'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
        )}
      >
        {children ?? <Outlet />}
      </SidebarInset>
    </>
  )
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          // Desktop: leave room for the fixed overlay title bar.
          className='desktop:pt-(--titlebar-height)'
        >
          {isTauri() ? <DesktopTitleBar>{content}</DesktopTitleBar> : content}
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
