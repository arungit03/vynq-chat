interface SkeletonProps {
  className?: string;
  rounded?: string;
}

export function Skeleton({ className = "", rounded = "rounded-lg" }: SkeletonProps) {
  return <div className={`animate-pulse bg-brand-100/70 ${rounded} ${className}`} />;
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl p-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
