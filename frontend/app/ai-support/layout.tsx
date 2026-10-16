import type { ReactNode } from "react";
import { WritingAdminGuard } from "@/components/writing/writing-admin-guard";

export default function AISupportLayout({ children }: { children: ReactNode }) {
  return <WritingAdminGuard>{children}</WritingAdminGuard>;
}
