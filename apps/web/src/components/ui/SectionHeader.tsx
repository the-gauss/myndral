import { Link } from 'react-router-dom'

interface Props {
  title: string
  href?: string
}

export default function SectionHeader({ title, href }: Props) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {href && (
        <Link
          to={href}
          className="text-xs font-semibold text-muted-fg hover:text-foreground transition-colors uppercase tracking-wide"
        >
          See all
        </Link>
      )}
    </div>
  )
}
