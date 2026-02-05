import { cn } from '@/lib/utils'

const H1Element = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h1 className={cn('text-4xl font-bold', className)}>{children}</h1>
}
const H2Element = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h2 className={cn('text-3xl font-bold', className)}>{children}</h2>
}
const H3Element = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h3 className={cn('text-2xl font-bold', className)}>{children}</h3>
}
const H4Element = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h4 className={cn('text-xl font-bold', className)}>{children}</h4>
}
const H5Element = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h5 className={cn('text-lg font-bold', className)}>{children}</h5>
}
const H6Element = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h6 className={cn('text-base font-bold', className)}>{children}</h6>
}
const PElement = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <p className={cn('text-sm font-normal', className)}>{children}</p>
}
const SmallElement = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return <small className={cn('text-xs font-normal', className)}>{children}</small>
}
const SpanElement = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return <span className={cn('text-sm font-normal', className)}>{children}</span>
}
const StrongElement = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return <strong className={cn('font-bold', className)}>{children}</strong>
}
const EmElement = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <em className={cn('font-italic', className)}>{children}</em>
}

export const Typography = ({
  variant = 'body1',
  as = 'p',
  children,
  className,
}: {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2'
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'small' | 'span' | 'strong' | 'em'
  children: React.ReactNode
  className?: string
}) => {
  const fontSize = {
    h1: 'text-4xl',
    h2: 'text-3xl',
    h3: 'text-2xl',
    h4: 'text-xl',
    h5: 'text-lg',
    h6: 'text-base',
    body1: 'text-sm',
    body2: 'text-xs',
  }

  const fontWeight = {
    h1: 'font-bold',
    h2: 'font-bold',
    h3: 'font-bold',
    h4: 'font-bold',
    h5: 'font-bold',
    h6: 'font-bold',
    body1: 'font-normal',
    body2: 'font-normal',
  }

  const elementMapping = {
    h1: H1Element,
    h2: H2Element,
    h3: H3Element,
    h4: H4Element,
    h5: H5Element,
    h6: H6Element,
    body1: PElement,
    body2: PElement,
    p: PElement,
    small: SmallElement,
    span: SpanElement,
    strong: StrongElement,
    em: EmElement,
  }

  const Element = elementMapping[as] || elementMapping[variant] || PElement
  return (
    <Element className={cn(fontSize[variant], fontWeight[variant], 'mb-2', className)}>
      {children}
    </Element>
  )
}
