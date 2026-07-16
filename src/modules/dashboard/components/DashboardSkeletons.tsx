import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CardListSkeleton({
  title,
  rows = 4,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <li key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
