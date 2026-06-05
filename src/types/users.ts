export const userProfiles = ["Administrador", "Gestor", "Técnico", "Comercial"] as const;

export type UserProfile = (typeof userProfiles)[number];

export type ManagedUser = {
  id: string;
  email: string;
  nome: string;
  perfil: UserProfile | "";
  ativo: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type UserMetadata = {
  nome?: string;
  perfil?: UserProfile;
  ativo?: boolean;
};
