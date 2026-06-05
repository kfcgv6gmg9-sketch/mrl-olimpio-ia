import { supabase } from "@/lib/supabase";

export type AuditModule = "Agenda" | "Diário" | "Veículos" | "Usuários";
export type AuditAction = "Criar" | "Editar" | "Excluir" | "Finalizar" | "Cancelar";

export type AuditPayload = {
  modulo: AuditModule;
  acao: AuditAction;
  registro_afetado: string;
};

export async function logAudit({ modulo, acao, registro_afetado }: AuditPayload) {
  const { data } = await supabase.auth.getSession();
  const usuario = data.session?.user.email ?? "Usuario nao identificado";
  const now = new Date();

  const { error } = await supabase.from("auditoria").insert({
    usuario,
    data: formatDate(now),
    hora: formatTime(now),
    modulo,
    acao,
    registro_afetado
  });

  if (error) {
    console.error("Nao foi possivel registrar auditoria.", error.message);
  }
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}
