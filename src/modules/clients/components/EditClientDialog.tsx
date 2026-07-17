"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientForm } from "./ClientForm";
import { updateClient } from "../actions";
import type { Client, CatalogEntry } from "../queries";

export function EditClientDialog({
  client,
  documentTypes,
  genderTypes,
}: {
  client: Client;
  documentTypes: CatalogEntry[];
  genderTypes: CatalogEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <ClientForm
          documentTypes={documentTypes}
          genderTypes={genderTypes}
          defaultValues={{
            first_name: client.first_name,
            last_name: client.last_name,
            alias: client.alias ?? "",
            email: client.email ?? "",
            dni_type: client.dni_type ?? "",
            dni_number: client.dni_number ?? "",
            phone: client.phone ?? "",
            alternative_phone: client.alternative_phone ?? "",
            birth_date: client.birth_date ?? "",
            gender: client.gender ?? "",
            address: client.address ?? "",
          }}
          onSubmit={async (values) => {
            const result = await updateClient(client.id, values);
            if ("error" in result) return result;
            toast.success("Cliente actualizado");
            setOpen(false);
          }}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
  );
}
