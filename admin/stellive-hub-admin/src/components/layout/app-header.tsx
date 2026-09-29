import { createPortal } from 'react-dom'
import { isTauri } from '@/lib/runtime'
import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useDesktopTitleBarSlot } from './desktop-title-bar'
import { Header } from './header'

type AppHeaderProps = {
  fixed?: boolean
  /** Optional extra controls rendered before the language/theme switches. */
  children?: React.ReactNode
}

/**
 * Standard page header for authenticated pages: sidebar trigger, search,
 * language + theme switches and the admin profile menu.
 */
export function AppHeader({ fixed, children }: AppHeaderProps) {
  const titleBarSlot = useDesktopTitleBarSlot()
  const controls = (
    <>
      <Search className='me-auto' />
      {children}
      <LanguageSwitch />
      <ThemeSwitch />
      <ProfileDropdown />
    </>
  )
  // Desktop: the controls live in the overlay title bar instead of a second
  // header strip (the title bar already holds the sidebar toggle).
  if (isTauri()) {
    return titleBarSlot ? createPortal(controls, titleBarSlot) : null
  }
  return <Header fixed={fixed}>{controls}</Header>
}
