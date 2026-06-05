import { UserMetadata, userProfiles } from "@/types/users";

const defaultFirstAdminEmail = "murilo.olimpio@icloud.com";

export type AppModule =
  | "inicio"
  | "agenda"
  | "diario"
  | "veiculos"
  | "relatorios"
  | "usuarios"
  | "auditoria";

export const appModules: Array<{
  id: AppModule;
  title: string;
  href: string;
}> = [
  { id: "inicio", title: "Inicio", href: "/" },
  { id: "agenda", title: "Agenda", href: "/agenda" },
  { id: "diario", title: "Diario", href: "/diario" },
  { id: "veiculos", title: "Veiculos", href: "/veiculos" },
  { id: "relatorios", title: "Relatorios", href: "/relatorios" },
  { id: "usuarios", title: "Usuarios", href: "/administracao/usuarios" },
  { id: "auditoria", title: "Auditoria", href: "/administracao/auditoria" }
];

const profileModules: Record<string, AppModule[]> = {
  Administrador: ["inicio", "agenda", "diario", "veiculos", "relatorios", "usuarios", "auditoria"],
  Gestor: ["inicio", "agenda", "diario", "veiculos", "relatorios"],
  Técnico: ["inicio", "agenda", "diario"],
  Comercial: ["inicio", "agenda", "relatorios"]
};

export function firstAdminEmail() {
  return (process.env.NEXT_PUBLIC_FIRST_ADMIN_EMAIL ?? defaultFirstAdminEmail).trim().toLowerCase();
}

export function isFirstAdmin(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();

  return Boolean(normalizedEmail) && normalizedEmail === firstAdminEmail();
}

export function hasActiveSystemAccess(email: string | undefined, metadata: UserMetadata | undefined) {
  if (isFirstAdmin(email)) {
    return true;
  }

  const hasValidProfile = metadata?.perfil ? userProfiles.some((profile) => profile === metadata.perfil) : false;

  return hasValidProfile && metadata?.ativo !== false;
}

export function hasAdminAccess(email: string | undefined, metadata: UserMetadata | undefined) {
  if (isFirstAdmin(email)) {
    return true;
  }

  return metadata?.perfil === "Administrador" && metadata.ativo !== false;
}

export function userProfile(email: string | undefined, metadata: UserMetadata | undefined) {
  if (isFirstAdmin(email)) {
    return "Administrador";
  }

  return metadata?.perfil ?? "";
}

export function canAccessModule(
  email: string | undefined,
  metadata: UserMetadata | undefined,
  module: AppModule
) {
  if (!hasActiveSystemAccess(email, metadata)) {
    return false;
  }

  return profileModules[userProfile(email, metadata)]?.includes(module) ?? false;
}

export function canEditAgenda(email: string | undefined, metadata: UserMetadata | undefined) {
  const profile = userProfile(email, metadata);

  return profile === "Administrador" || profile === "Gestor" || profile === "Comercial";
}
