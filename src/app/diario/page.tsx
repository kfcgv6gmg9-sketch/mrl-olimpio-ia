"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { AgendaServico, DiarioOperacional } from "@/types/database";

type DiarioForm = {
  data: string;
  tecnico: string;
  cliente: string;
  cidade: string;
  servico_realizado: string;
  observacao: string;
  situacao_atendimento: string;
  status_atendimento: string;
  agendamento_id: string;
};

const initialForm: DiarioForm = {
  data: "",
  tecnico: "",
  cliente: "",
  cidade: "",
  servico_realizado: "",
  observacao: "",
  situacao_atendimento: "",
  status_atendimento: "Em andamento",
  agendamento_id: ""
};

const statusAtendimento = ["Em andamento", "Finalizado"];

function isDiarioLocked(record: DiarioOperacional) {
  return record.status_atendimento === "Finalizado" || record.bloqueado === true;
}

function agendaLabel(record: AgendaServico) {
  const city = record.cidade ? ` | ${record.cidade}` : "";
  const status = record.status_agendamento ? ` | ${record.status_agendamento}` : "";

  return `${record.data} | ${record.cliente}${city}${status}`;
}

export default function DiarioPage() {
  const [records, setRecords] = useState<DiarioOperacional[]>([]);
  const [agendaRecords, setAgendaRecords] = useState<AgendaServico[]>([]);
  const [form, setForm] = useState<DiarioForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    setError("");

    const [diarioResponse, agendaResponse] = await Promise.all([
      supabase
        .from("diario_operacional")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("agenda_servicos")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
    ]);

    if (diarioResponse.error) {
      setError(diarioResponse.error.message);
    } else {
      setRecords(diarioResponse.data ?? []);
    }

    if (agendaResponse.error) {
      setError((currentError) => currentError || agendaResponse.error.message);
    } else {
      setAgendaRecords(agendaResponse.data ?? []);
    }

    setLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (editingId) {
      const currentRecord = records.find((record) => record.id === editingId);

      if (currentRecord && isDiarioLocked(currentRecord)) {
        setError("Registro finalizado ou bloqueado nao pode ser editado.");
        setSaving(false);
        return;
      }
    }

    const payload = {
      data: form.data,
      tecnico: form.tecnico.trim(),
      cliente: form.cliente.trim(),
      cidade: form.cidade.trim() || null,
      servico_realizado: form.servico_realizado.trim(),
      observacao: form.observacao.trim() || null,
      situacao_atendimento: form.situacao_atendimento.trim() || null,
      status_atendimento: form.status_atendimento || null,
      agendamento_id: form.agendamento_id || null
    };

    const response = editingId
      ? await supabase.from("diario_operacional").update(payload).eq("id", editingId)
      : await supabase.from("diario_operacional").insert(payload);

    if (response.error) {
      setError(response.error.message);
      setSaving(false);
      return;
    }

    if (payload.status_atendimento === "Finalizado" && payload.agendamento_id) {
      const { error: agendaError } = await supabase
        .from("agenda_servicos")
        .update({ bloqueado: true })
        .eq("id", payload.agendamento_id);

      if (agendaError) {
        setError(`Registro salvo, mas nao foi possivel bloquear o agendamento: ${agendaError.message}`);
        await loadRecords();
        setSaving(false);
        return;
      }
    }

    setForm(initialForm);
    setEditingId(null);
    setMessage(editingId ? "Registro atualizado." : "Registro salvo.");
    await loadRecords();
    setSaving(false);
  }

  function handleEdit(record: DiarioOperacional) {
    if (isDiarioLocked(record)) {
      setMessage("");
      setError("Registro finalizado ou bloqueado nao pode ser editado.");
      return;
    }

    setEditingId(record.id);
    setForm({
      data: record.data,
      tecnico: record.tecnico,
      cliente: record.cliente,
      cidade: record.cidade ?? "",
      servico_realizado: record.servico_realizado,
      observacao: record.observacao ?? "",
      situacao_atendimento: record.situacao_atendimento ?? "",
      status_atendimento: record.status_atendimento ?? "Em andamento",
      agendamento_id: record.agendamento_id ?? ""
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
    const confirmed = window.confirm("Excluir este registro do diario?");

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("diario_operacional").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Registro excluido.");
      await loadRecords();
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <header className="topbar">
            <div className="brand">
              <h1>Diario Operacional</h1>
              <p>Registro interno de servicos realizados.</p>
            </div>
            <nav className="nav" aria-label="Navegacao">
              <Link href="/">Inicio</Link>
              <Link href="/agenda">Agenda</Link>
            </nav>
          </header>

          <section className="work-layout">
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
                Tecnico
                <input
                  required
                  type="text"
                  value={form.tecnico}
                  onChange={(event) => setForm({ ...form, tecnico: event.target.value })}
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
                Situacao do Atendimento
                <input
                  type="text"
                  value={form.situacao_atendimento}
                  onChange={(event) => setForm({ ...form, situacao_atendimento: event.target.value })}
                />
              </label>

              <label>
                Status do Atendimento
                <select
                  required
                  value={form.status_atendimento}
                  onChange={(event) => setForm({ ...form, status_atendimento: event.target.value })}
                >
                  {statusAtendimento.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Agendamento Vinculado
                <select
                  value={form.agendamento_id}
                  onChange={(event) => setForm({ ...form, agendamento_id: event.target.value })}
                >
                  <option value="">Sem agendamento vinculado</option>
                  {agendaRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {agendaLabel(record)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Servico Realizado
                <textarea
                  required
                  rows={4}
                  value={form.servico_realizado}
                  onChange={(event) => setForm({ ...form, servico_realizado: event.target.value })}
                />
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

              <div className="record-list">
                {records.map((record) => {
                  const linkedAgenda = agendaRecords.find((agenda) => agenda.id === record.agendamento_id);
                  const locked = isDiarioLocked(record);

                  return (
                    <article className="record-card" key={record.id}>
                      <div>
                        <strong>{record.cliente}</strong>
                        <span>
                          {record.data} | {record.tecnico}
                        </span>
                        <span>Cidade: {record.cidade ?? "Nao informado"}</span>
                        <span>Situacao: {record.situacao_atendimento ?? "Nao informado"}</span>
                        <span>Status: {record.status_atendimento ?? "Nao informado"}</span>
                        <span>
                          Agendamento:{" "}
                          {linkedAgenda
                            ? agendaLabel(linkedAgenda)
                            : record.agendamento_id
                              ? record.agendamento_id
                              : "Nao vinculado"}
                        </span>
                        {record.bloqueado ? <span>Bloqueado: Sim</span> : null}
                        <p>{record.servico_realizado}</p>
                        {record.observacao ? <p>{record.observacao}</p> : null}
                      </div>
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
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        </AuthGate>
      </div>
    </main>
  );
}
