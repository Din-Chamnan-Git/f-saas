"use client";

import { Toast } from "@/components/ui/toast";

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toast />
    </>
  );
}
