type SettingsNoteProps = {
  title: string
  description: string
}

/** Title + description pair used in the informational settings cards. */
export function SettingsNote({ title, description }: SettingsNoteProps) {
  return (
    <div className='rounded-md border p-3'>
      <div className='text-sm font-medium'>{title}</div>
      <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
    </div>
  )
}
