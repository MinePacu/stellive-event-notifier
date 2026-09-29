import { cn } from '@/lib/utils'

type PageHeadingProps = {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned actions (buttons, filters). */
  actions?: React.ReactNode
  className?: string
}

/** Page title block used at the top of every authenticated page. */
export function PageHeading({
  title,
  description,
  actions,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2',
        className
      )}
    >
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
        {description ? (
          <p className='text-muted-foreground'>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className='flex flex-wrap items-center gap-2'>{actions}</div>
      ) : null}
    </div>
  )
}
