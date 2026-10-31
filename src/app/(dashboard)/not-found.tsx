import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="font-heading text-xl font-bold">No encontramos eso</h1>
      <p className="text-sm text-muted-foreground">
        El registro no existe o ya no está disponible.
      </p>
      <Button render={<Link href="/dashboard" />} nativeButton={false}>
        Volver al inicio
      </Button>
    </div>
  );
}
