"use client";

import Link from "next/link";
import { AppModule, appModules, canAccessModule } from "@/lib/accessControl";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";

type AppNavProps = {
  includeHome?: boolean;
};

export function AppNav({ includeHome = true }: AppNavProps) {
  const { email, loading, metadata } = useCurrentAccess();

  if (loading) {
    return null;
  }

  const visibleModules = appModules.filter((module) => {
    if (!includeHome && module.id === "inicio") {
      return false;
    }

    return canAccessModule(email, metadata, module.id as AppModule);
  });

  return (
    <nav className="nav" aria-label="Navegacao">
      {visibleModules.map((module) => (
        <Link href={module.href} key={module.id}>
          {module.title}
        </Link>
      ))}
    </nav>
  );
}
