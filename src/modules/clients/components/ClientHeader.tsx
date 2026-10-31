import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { Client } from "../queries";
import { DeactivateClientDialog } from "./DeactivateClientDialog";

export type HeaderChip = {
  text: string;
  tone: "success" | "warning" | "muted";
};

const CHIP_TONE: Record<HeaderChip["tone"], string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
};

function initials(first: string, last: string) {
  return `${first.trim()[0] ?? ""}${last.trim()[0] ?? ""}`.toUpperCase();
}

// Always visible above the tabs: who this is, whether they are active and the
// activate/deactivate action (editing the data lives in the Información tab). The photo is the registration photo (a short-lived
// signed link, so staff can tell who they are looking at); initials otherwise.
export function ClientHeader({
  client,
  photoUrl,
  chips,
}: {
  client: Client;
  photoUrl: string | null;
  // what matters at a glance: membership, face on file...
  chips: HeaderChip[];
}) {
  const fullName = `${client.first_name} ${client.last_name}`;

  return (
    <header className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 sm:gap-5 sm:p-5">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL from a private bucket
        <img
          src={photoUrl}
          alt={`Foto de ${fullName}`}
          className="size-20 shrink-0 rounded-md border border-border object-cover sm:size-28"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted font-heading text-3xl font-bold text-muted-foreground sm:size-28 sm:text-4xl"
        >
          {initials(client.first_name, client.last_name)}
        </div>
      )}

      <div className="min-w-0 flex-1 basis-40">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {fullName}
        </h1>
        {client.alias && (
          <p className="text-sm text-muted-foreground">({client.alias})</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge isActive={client.is_active} />
          {chips.map((chip) => (
            <Badge key={chip.text} className={CHIP_TONE[chip.tone]}>
              {chip.text}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <DeactivateClientDialog
          clientId={client.id}
          clientName={fullName}
          isActive={client.is_active}
        />
      </div>
    </header>
  );
}
