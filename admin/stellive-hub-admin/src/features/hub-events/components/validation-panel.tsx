import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { type HubEventValidationResult } from '../types'

type ValidationPanelProps = {
  /** Last validation outcome; null before anything was validated. */
  result: HubEventValidationResult | null
  /** Client-side problem found before calling the server. */
  clientError?: string | null
}

export function ValidationPanel({ result, clientError }: ValidationPanelProps) {
  const t = useT()
  const errors = result?.errors ?? []
  let lines: string[] = []
  if (clientError) lines = [clientError]
  else if (errors.length)
    lines = errors.map((error) =>
      [error.field, error.reason, error.message].filter(Boolean).join(' - ')
    )
  else if (result)
    lines = [
      result.valid === false
        ? t('hubEvent.validationFailed')
        : t('hubEvent.noValidationErrors'),
    ]
  const failed = Boolean(clientError) || result?.valid === false

  return (
    <section
      aria-labelledby='hub-event-validation-title'
      className={cn(
        'grid gap-2 rounded-md border p-3',
        failed && 'border-destructive'
      )}
    >
      <h3 id='hub-event-validation-title' className='text-sm font-semibold'>
        {t('hubEvent.validation')}
      </h3>
      {lines.length ? (
        <ul
          id='hub-event-validation'
          aria-live='polite'
          className={cn(
            'grid list-disc gap-1 ps-5 text-sm break-words',
            failed ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
