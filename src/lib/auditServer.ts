import { SupabaseClient } from "@supabase/supabase-js";
import { AuditAction, AuditModule } from "@/lib/audit";

export async function logServerAudit({
  supabase,
  usuario,
  modulo,
  acao,
  registro_afetado
}: {
  supabase: SupabaseClient;
  usuario: string;
  modulo: AuditModule;
  acao: AuditAction;
  registro_afetado: string;
}) {
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
