import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Always returns to the kiosk. The shared BackLink prefers the browser history,
// which lands elsewhere when the page was opened from the sidebar or a bookmark.
export function AccessBackLink() {
  return (
    <Link
      href="/access"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Control de acceso
    </Link>
  );
}
