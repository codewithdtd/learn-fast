export function formatDate(value: string | null): string {
  if (!value) {
    return "Chưa có";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}
