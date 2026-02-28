interface Props {
  message?: string
}

export default function EmptyState({ message = 'Nothing here yet.' }: Props) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-fg text-sm">
      {message}
    </div>
  )
}
