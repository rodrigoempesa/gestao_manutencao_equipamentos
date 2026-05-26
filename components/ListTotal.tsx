interface ListTotalProps {
  count: number
  total: number
  singular: string
  plural: string
  className?: string
}

export default function ListTotal({ count, total, singular, plural, className = '' }: ListTotalProps) {
  if (total === 0) return null
  const filtering = count !== total
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  return (
    <div className={`text-sm text-gray-600 ${className}`}>
      {filtering ? (
        <span>
          Exibindo <span className="font-semibold text-gray-900">{fmt(count)}</span> de{' '}
          <span className="font-semibold text-gray-900">{fmt(total)}</span> {plural}
        </span>
      ) : (
        <span>
          Total: <span className="font-semibold text-gray-900">{fmt(total)}</span>{' '}
          {total === 1 ? singular : plural}
        </span>
      )}
    </div>
  )
}
