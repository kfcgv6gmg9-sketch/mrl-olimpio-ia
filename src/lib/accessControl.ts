import { UserMetadata, userProfiles } from "@/types/users";

const defaultFirstAdminEmail = "murilo.olimpio@icloud.com";

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
