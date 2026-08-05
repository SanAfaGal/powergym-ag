import { CopyTextButton } from "@/components/shared/CopyTextButton";

export function CopyRenewalRemindersButton({
  text,
  count,
}: {
  text: string;
  count: number;
}) {
  return (
    <CopyTextButton text={text} label={`Copiar teléfonos y mensajes (${count})`} />
  );
}
