import { NextRequest, NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/accessControl";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { UserMetadata, UserProfile, userProfiles } from "@/types/users";

type NormalizedUserPayload =
  | {
      ok: true;
      data: {
        email: string;
        password: string;
        nome: string;
        perfil: UserProfile;
        ativo: boolean;
      };
    }
  | {
      ok: false;
      error: string;
    };

function isUserProfile(value: string): value is UserProfile {
  return userProfiles.some((profile) => profile === value);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!token) {
    return { actorEmail: "", error: jsonError("Sessao nao informada.", 401), supabase: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { actorEmail: "", error: jsonError("Sessao invalida.", 401), supabase: null };
  }

  const metadata = data.user.user_metadata as UserMetadata;

  if (!hasAdminAccess(data.user.email, metadata)) {
    return { actorEmail: "", error: jsonError("Acesso permitido apenas para Administrador ativo.", 403), supabase: null };
  }

  return { actorEmail: data.user.email ?? "Usuario nao identificado", error: null, supabase };
}

export function normalizeUserPayload(body: unknown, requirePassword: boolean): NormalizedUserPayload {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Dados invalidos." };
  }

  const payload = body as Record<string, unknown>;
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const nome = typeof payload.nome === "string" ? payload.nome.trim() : "";
  const perfil = typeof payload.perfil === "string" ? payload.perfil : "";
  const ativo = typeof payload.ativo === "boolean" ? payload.ativo : true;

  if (!nome) {
    return { ok: false, error: "Informe o nome." };
  }

  if (!isUserProfile(perfil)) {
    return { ok: false, error: "Informe um perfil valido." };
  }

  if (!email && requirePassword) {
    return { ok: false, error: "Informe o e-mail." };
  }

  if (requirePassword && password.length < 6) {
    return { ok: false, error: "Informe uma senha com pelo menos 6 caracteres." };
  }

  return {
    ok: true,
    data: {
      email,
      password,
      nome,
      perfil,
      ativo
    }
  };
}
