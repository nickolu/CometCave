'use client'
import { ReactNode } from 'react'

interface ListProps<T> {
  items: T[]
  renderItem: (item: T, idx: number) => ReactNode
  className?: string
}

export function List<T>({ items, renderItem, className = '' }: ListProps<T>) {
  return (
    <ul className={className}>
      {items.map((item, idx) => (
        <li key={idx}>{renderItem(item, idx)}</li>
      ))}
    </ul>
  )
}
