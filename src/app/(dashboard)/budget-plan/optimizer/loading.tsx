import { Skeleton } from "@/components/ui/skeleton";

export default function OptimizerLoading() {
  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Cut Suggestions */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>

      <div className="border-t" />

      {/* Simulator */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-72 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
