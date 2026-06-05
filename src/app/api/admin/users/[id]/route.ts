import { NextRequest, NextResponse } from "next/server";
import { jsonError, normalizeUserPayload, requireAdmin } from "@/lib/adminAuth";
import { logServerAudit } from "@/lib/auditServer";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { actorEmail, error, supabase } = await requireAdmin(request);

    if (error || !supabase) {
      return error;
    }

    const parsed = normalizeUserPayload(await request.json(), false);

    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const { data: currentUser, error: getError } = await supabase.auth.admin.getUserById(params.id);

    if (getError || !currentUser.user) {
      return jsonError(getError?.message ?? "Usuario nao encontrado.", 404);
    }

    const { nome, perfil, ativo } = parsed.data;
    const { error: updateError } = await supabase.auth.admin.updateUserById(params.id, {
      user_metadata: {
        ...currentUser.user.user_metadata,
        nome,
        perfil,
        ativo
      }
    });

    if (updateError) {
      return jsonError(updateError.message, 400);
    }

    await logServerAudit({
      supabase,
      usuario: actorEmail,
      modulo: "Usuários",
      acao: "Editar",
      registro_afetado: params.id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Nao foi possivel atualizar usuario.", 500);
  }
}
