import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { lifecycleCopy } from '../form'
import { type HubEventLifecycleAction } from '../types'

type LifecycleConfirmDialogProps = {
  action: HubEventLifecycleAction
  eventTitle: string
  pending: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

/** Confirm publish / cancel / deactivate / delete with an optional reason. */
export function LifecycleConfirmDialog({
  action,
  eventTitle,
  pending,
  onCancel,
  onConfirm,
}: LifecycleConfirmDialogProps) {
  const t = useT()
  const [reason, setReason] = useState('')
  const copy = lifecycleCopy[action]
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && !pending && onCancel()}
      title={t(copy.title)}
      desc={
        <div className='grid gap-1'>
          <span className='font-medium break-words text-foreground'>
            {t('hubEvent.confirmEventName', { title: eventTitle })}
          </span>
          <span>{t(copy.desc)}</span>
        </div>
      }
      confirmText={t(copy.label)}
      destructive={action === 'delete'}
      isLoading={pending}
      handleConfirm={() => onConfirm(reason)}
    >
      <div className='grid gap-1.5'>
        <Label htmlFor='hub-event-change-reason'>
          {t('hubEvent.changeReason')}
        </Label>
        <Textarea
          id='hub-event-change-reason'
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
        />
        <p className='text-sm text-muted-foreground'>
          {t('hubEvent.changeReasonHelp')}
        </p>
      </div>
    </ConfirmDialog>
  )
}
