"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { PermissionGate } from "@/components/PermissionGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { logAudit } from "@/lib/audit";
import { canAccessModule, canEditAgenda } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { AgendaServico } from "@/types/database";

type AgendaForm = {
  data: string;
  cliente: string;
  cidade: string;
  observacao: string;
  situacao_agendamento: string;
  status_agendamento: string;
};

const initialForm: AgendaForm = {
  data: "",
  cliente: "",
  cidade: "",
  observacao: "",
  situacao_agendamento: "Serviço Técnico",
  status_agendamento: "Agendado"
};

const situacoesAgendamento = ["Serviço Técnico", "Retorno", "Garantia"];
const statusAgendamento = ["Agendado", "Reagendado", "Cancelado"];

function isAgendaLocked(record: AgendaServico) {
  return record.status_agendamento === "Cancelado" || record.bloqueado === true;
}

export default function AgendaPage() {
  const [records, setRecords] = useState<AgendaServico[]>([]);
  const [form, setForm] = useState<AgendaForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { email, loading: accessLoading, metadata } = useCurrentAccess();
  const canAccessAgenda = canAccessModule(email, metadata, "agenda");
  const canManageAgenda = canEditAgenda(email, metadata);

  useEffect(() => {
    if (!accessLoading && canAccessAgenda) {
      loadRecords();
    }
  }, [accessLoading, canAccessAgenda]);

  async function loadRecords() {
    setLoading(true);
    setError("");

    const { data, error: listError } = await supabase
      .from("agenda_servicos")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (listError) {
      setError(listError.message);
    } else {
      setRecords(data ?? []);
    }

    setLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (!canManageAgenda) {
      setError("Voce nao tem permissao para alterar a agenda.");
      setSaving(false);
      return;
    }

    if (editingId) {
      const currentRecord = records.find((record) => record.id === editingId);

      if (currentRecord && isAgendaLocked(currentRecord)) {
        setError("Registro bloqueado ou cancelado nao pode ser editado.");
        setSaving(false);
        return;
      }
    }

    const payload = {
      data: form.data,
      cliente: form.cliente.trim(),
      cidade: form.cidade.trim() || null,
      observacao: form.observacao.trim() || null,
      situacao_agendamento: form.situacao_agendamento || null,
      status_agendamento: form.status_agendamento || null
    };

    const response = editingId
      ? await supabase.from("agenda_servicos").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("agenda_servicos").insert(payload).select("id").single();

    if (response.error) {
      setError(response.error.message);
    } else {
      await logAudit({
        modulo: "Agenda",
        acao: payload.status_agendamento === "Cancelado" ? "Cancelar" : editingId ? "Editar" : "Criar",
        registro_afetado: response.data?.id ?? editingId ?? form.cliente
      });
      setForm(initialForm);
      setEditingId(null);
      setMessage(editingId ? "Registro atualizado." : "Registro salvo.");
      await loadRecords();
    }

    setSaving(false);
  }

  function handleEdit(record: AgendaServico) {
    if (!canManageAgenda) {
      setMessage("");
      setError("Voce nao tem permissao para alterar a agenda.");
      return;
    }

    if (isAgendaLocked(record)) {
      setMessage("");
      setError("Registro bloqueado ou cancelado nao pode ser editado.");
      return;
    }

    setEditingId(record.id);
    setForm({
      data: record.data,
      cliente: record.cliente,
      cidade: record.cidade ?? "",
      observacao: record.observacao ?? "",
      situacao_agendamento: record.situacao_agendamento ?? "Serviço Técnico",
      status_agendamento: record.status_agendamento ?? "Agendado"
    });
    setMessage("");
    setError("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
    setError("");
  }

  async function handleDelete(id: string) {
    if (!canManageAgenda) {
      setMessage("");
      setError("Voce nao tem permissao para excluir registros da agenda.");
      return;
    }

    const confirmed = window.confirm("Excluir este registro da agenda?");

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("agenda_servicos").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      await logAudit({
        modulo: "Agenda",
        acao: "Excluir",
        registro_afetado: id
      });
      setMessage("Registro excluido.");
      await loadRecords();
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <PermissionGate module="agenda">
            <header className="topbar">
              <div className="brand">
                <h1>Agenda de Servicos</h1>
                <p>Caderneta digital interna para servicos por data.</p>
              </div>
              <AppNav />
            </header>

            <section className="work-layout">
              {canManageAgenda ? (
                <form className="panel form-grid" onSubmit={handleSubmit}>
                  <h2>{editingId ? "Editar registro" : "Novo registro"}</h2>

                  <label>
                    Data
                    <input
                      required
                      type="date"
                      value={form.data}
                      onChange={(event) => setForm({ ...form, data: event.target.value })}
                    />
                  </label>

                  <label>
                    Cliente
                    <input
                      required
                      type="text"
                      value={form.cliente}
                      onChange={(event) => setForm({ ...form, cliente: event.target.value })}
                    />
                  </label>

                  <label>
                    Cidade
                    <input
                      type="text"
                      value={form.cidade}
                      onChange={(event) => setForm({ ...form, cidade: event.target.value })}
                    />
                  </label>

                  <label>
                    Situacao do Agendamento
                    <select
                      required
                      value={form.situacao_agendamento}
                      onChange={(event) => setForm({ ...form, situacao_agendamento: event.target.value })}
                    >
                      {situacoesAgendamento.map((situacao) => (
                        <option key={situacao} value={situacao}>
                          {situacao}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status do Agendamento
                    <select
                      required
                      value={form.status_agendamento}
                      onChange={(event) => setForm({ ...form, status_agendamento: event.target.value })}
                    >
                      {statusAgendamento.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Observacao
                    <textarea
                      rows={4}
                      value={form.observacao}
                      onChange={(event) => setForm({ ...form, observacao: event.target.value })}
                    />
                  </label>

                  {error ? <p className="error-text">{error}</p> : null}
                  {message ? <p className="success-text">{message}</p> : null}

                  <div className="button-row">
                    <button className="primary-button" disabled={saving} type="submit">
                      {saving ? "Salvando..." : editingId ? "Atualizar" : "Salvar"}
                    </button>
                    {editingId ? (
                      <button className="secondary-button" onClick={handleCancelEdit} type="button">
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <section className="panel">
                  <p className="status-text">Agenda disponivel apenas para visualizacao.</p>
                </section>
              )}

              <section className="panel">
                <div className="section-heading">
                  <h2>Registros cadastrados</h2>
                  <button className="secondary-button" onClick={loadRecords} type="button">
                    Atualizar
                  </button>
                </div>

                {loading ? <p className="status-text">Carregando registros...</p> : null}

                {!loading && records.length === 0 ? (
                  <p className="status-text">Nenhum registro cadastrado.</p>
                ) : null}

                {!canManageAgenda && error ? <p className="error-text">{error}</p> : null}

                <div className="record-list">
                  {records.map((record) => {
                    const locked = isAgendaLocked(record);

                    return (
                      <article className="record-card" key={record.id}>
                        <div>
                          <strong>{record.cliente}</strong>
                          <span>{record.data}</span>
                          <span>Cidade: {record.cidade ?? "Nao informado"}</span>
                          <span>Situacao: {record.situacao_agendamento ?? "Nao informado"}</span>
                          <span>Status: {record.status_agendamento ?? "Nao informado"}</span>
                          {record.bloqueado ? <span>Bloqueado: Sim</span> : null}
                          {record.observacao ? <p>{record.observacao}</p> : null}
                        </div>
                        {canManageAgenda ? (
                          <div className="button-row">
                            <button
                              className="secondary-button"
                              disabled={locked}
                              onClick={() => handleEdit(record)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button className="danger-button" onClick={() => handleDelete(record.id)} type="button">
                              Excluir
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            </section>
          </PermissionGate>
        </AuthGate>
      </div>
    </main>
  );
}
