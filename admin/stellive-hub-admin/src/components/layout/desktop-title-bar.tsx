import { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLayout } from '@/context/layout-provider'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

const TitleBarSlotContext = createContext<HTMLElement | null>(null)

/** Element in the desktop title bar where the page header renders its controls. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDesktopTitleBarSlot() {
  return useContext(TitleBarSlotContext)
}

/**
 * macOS overlay title bar for the Tauri shell: the traffic lights sit at its
 * left edge, followed by the sidebar toggle; the page header (AppHeader)
 * portals its controls into the right-hand slot. Empty space drags the
 * window and double-clicking it toggles maximize (Tauri's drag-region script
 * skips buttons, inputs and other interactive elements).
 */
export function DesktopTitleBar({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const { state } = useSidebar()
  const { variant } = useLayout()
  return (
    <TitleBarSlotContext value={slot}>
      <header
        data-tauri-drag-region='deep'
        className={cn(
          'fixed inset-x-0 top-0 z-40 flex h-(--titlebar-height) cursor-default items-center bg-sidebar text-sidebar-foreground select-none',
          variant !== 'inset' && 'border-b'
        )}
      >
        {/* 80px keeps the toggle clear of the traffic lights (x 16, ~54px wide). */}
        <div
          className={cn(
            'flex h-full shrink-0 items-center ps-20 pe-2',
            state === 'expanded' && 'w-(--sidebar-width)'
          )}
        >
          <SidebarTrigger className='text-muted-foreground hover:text-foreground' />
        </div>
        <div
          ref={setSlot}
          className='flex h-full min-w-0 flex-1 items-center gap-3 px-4 sm:gap-4'
        />
      </header>
      {children}
    </TitleBarSlotContext>
  )
}
