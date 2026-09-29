import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
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
  return (
    <Header fixed={fixed}>
      <Search className='me-auto' />
      {children}
      <LanguageSwitch />
      <ThemeSwitch />
      <ProfileDropdown />
    </Header>
  )
}
