import { CopyTextButton } from "@/components/shared/CopyTextButton";

export function CopyExpiringButton({
  text,
  count,
}: {
  text: string;
  count: number;
}) {
  return <CopyTextButton text={text} label={`Copiar lista (${count})`} />;
}
