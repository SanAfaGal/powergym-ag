import { ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function OptionalSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md bg-muted px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70">
        <span className="flex items-center gap-2">
          {label}
          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Opcional
          </span>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 pt-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
