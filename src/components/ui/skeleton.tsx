import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-800',
        className
      )}
    />
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 h-12 flex items-center px-6 border-b">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 mx-2" />
          ))}
        </div>
        <div className="bg-white">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-16 flex items-center px-6 border-b last:border-0">
              {Array.from({ length: cols }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1 mx-2" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}
