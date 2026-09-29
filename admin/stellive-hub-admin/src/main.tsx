import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { describeApiError, isApiError, setUnauthorizedHandler } from '@/lib/api'
import { t } from '@/lib/i18n'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Client-side problems (missing token/server URL) and 4xx responses
        // will not succeed on retry.
        if (
          isApiError(error) &&
          error.status === 0 &&
          error.code !== 'network_error'
        )
          return false
        if (isApiError(error) && error.status >= 400 && error.status < 500)
          return false
        return failureCount < 2
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Features can opt out by handling errors themselves via meta.
      if (mutation.meta?.suppressErrorToast) return
      toast.error(describeApiError(error))
    },
  }),
})

// The web build is served under /admin/, the desktop build from '/'.
const basepath = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

// Create a new router instance
const router = createRouter({
  routeTree,
  basepath,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// A 401 from /v1/admin/* means the admin session ended: go to sign-in and
// come back to the current page afterwards.
setUnauthorizedHandler(() => {
  const current = router.state.location
  if (current.pathname === '/sign-in') return
  queryClient.clear()
  toast.error(t('error.sessionExpired'))
  void router.navigate({
    to: '/sign-in',
    search: { redirect: current.href },
    replace: true,
  })
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Skip the global error toast for this mutation. */
      suppressErrorToast?: boolean
    }
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
