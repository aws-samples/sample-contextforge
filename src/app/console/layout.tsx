"use client";
import { ConsoleLayout } from "@/components/console-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ConsoleLayout>{children}</ConsoleLayout>;
}
