export function RequiredMark() {
  return (
    <span className="ml-0.5 font-bold text-destructive" aria-hidden="true">
      *
    </span>
  );
}

export function OptionalMark() {
  return (
    <span className="ml-1 text-xs font-normal text-muted-foreground">
      (opcional)
    </span>
  );
}
