export function formatDate(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}


export function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}
