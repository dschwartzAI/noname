import { Separator } from '@/components/ui/separator'

type ContentSectionProps = {
  title: string
  desc: string
  children: React.JSX.Element
  headerAction?: React.ReactNode
}

export function ContentSection({ title, desc, children, headerAction }: ContentSectionProps) {
  return (
    <div className='flex flex-1 flex-col'>
      <div className='flex-none flex items-start justify-between'>
        <div>
          <h3 className='text-lg font-medium'>{title}</h3>
          <p className='text-muted-foreground text-sm'>{desc}</p>
        </div>
        {headerAction && <div className='ml-4'>{headerAction}</div>}
      </div>
      <Separator className='my-4 flex-none' />
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className='-mx-1 px-1.5 w-full'>{children}</div>
      </div>
    </div>
  )
}
