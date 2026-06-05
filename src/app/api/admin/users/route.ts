import { NextRequest, NextResponse } from "next/server";
import { jsonError, normalizeUserPayload, requireAdmin } from "@/lib/adminAuth";
import { ManagedUser, UserMetadata } from "@/types/users";

function toManagedUser(user: {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
  created_at: string;
  last_sign_in_at?: string;
}): ManagedUser {
  const metadata = user.user_metadata as UserMetadata;

  return {
    id: user.id,
    email: user.email ?? "",
    nome: metadata.nome ?? "",
    perfil: metadata.perfil ?? "",
    ativo: metadata.ativo !== false,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null
  };
}

export async function GET(request: NextRequest) {
  try {
    const { error, supabase } = await requireAdmin(request);

    if (error || !supabase) {
      return error;
    }

    const { data, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      return jsonError(listError.message, 400);
    }

    return NextResponse.json({
      users: data.users.map(toManagedUser)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Nao foi possivel listar usuarios.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, supabase } = await requireAdmin(request);

    if (error || !supabase) {
      return error;
    }

    const parsed = normalizeUserPayload(await request.json(), true);

    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const { email, password, nome, perfil, ativo } = parsed.data;
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        perfil,
        ativo
      }
    });

    if (createError) {
      return jsonError(createError.message, 400);
    }

    return NextResponse.json({ user: data.user ? toManagedUser(data.user) : null }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Nao foi possivel criar usuario.", 500);
  }
}
