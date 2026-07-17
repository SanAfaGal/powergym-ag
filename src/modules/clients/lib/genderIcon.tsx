import { CircleQuestionMark, Mars, Venus } from "lucide-react";

// Always renders a fixed-size slot -- unset/unrecognized gender gets a gray
// "?" rather than nothing, so names in the table/cards column stay
// left-aligned regardless of whether a given client has a gender on file.
// "male"/"female" describe biological sex, not gender identity -- copy says
// "Sexo", not "Género".
export function GenderIcon({ gender }: { gender: string | null }) {
  if (gender === "male") {
    return (
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        aria-label="Sexo: masculino"
        title="Sexo: masculino"
      >
        <Mars className="size-2.5" />
      </span>
    );
  }
  if (gender === "female") {
    return (
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400"
        aria-label="Sexo: femenino"
        title="Sexo: femenino"
      >
        <Venus className="size-2.5" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-label="Sexo no registrado"
      title="Sexo no registrado"
    >
      <CircleQuestionMark className="size-2.5" />
    </span>
  );
}
