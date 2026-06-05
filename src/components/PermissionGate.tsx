"use client";

import { ReactNode } from "react";
import { AppModule, canAccessModule } from "@/lib/accessControl";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";

type PermissionGateProps = {
  children: ReactNode;
  module: AppModule;
};

export function PermissionGate({ children, module }: PermissionGateProps) {
  const { email, loading, metadata } = useCurrentAccess();

  if (loading) {
    return <p className="status-text">Carregando permissoes...</p>;
  }

  if (!canAccessModule(email, metadata, module)) {
    return (
      <section className="panel">
        <p className="error-text">Voce nao tem permissao para acessar esta tela.</p>
      </section>
    );
  }

  return <>{children}</>;
}
