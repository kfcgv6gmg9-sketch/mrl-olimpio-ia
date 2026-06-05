"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { AgendaServico } from "@/types/database";

type AgendaForm = {
  data: string;
  cliente: string;
  observacao: string;
  situacao_agendamento: string;
};

const initialForm: AgendaForm = {
  data: "",
  cliente: "",
  observacao: "",
  situacao_agendamento: ""
};

export default function AgendaPage() {
  const [records, setRecords] = useState<AgendaServico[]>([]);
  const [form, setForm] = useState<AgendaForm>(initialForm);
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

    const payload = {
      data: form.data,
      cliente: form.cliente.trim(),
      observacao: form.observacao.trim() || null,
      situacao_agendamento: form.situacao_agendamento || null
    };

    const response = editingId
      ? await supabase.from("agenda_servicos").update(payload).eq("id", editingId)
      : await supabase.from("agenda_servicos").insert(payload);

    if (response.error) {
      setError(response.error.message);
    } else {
      setForm(initialForm);
      setEditingId(null);
      setMessage(editingId ? "Registro atualizado." : "Registro salvo.");
      await loadRecords();
    }

    setSaving(false);
  }

  function handleEdit(record: AgendaServico) {
    setEditingId(record.id);
    setForm({
      data: record.data,
      cliente: record.cliente,
      observacao: record.observacao ?? "",
      situacao_agendamento: record.situacao_agendamento ?? ""
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
              <h1>Agenda de Servicos</h1>
              <p>Caderneta digital interna para servicos por data.</p>
            </div>
            <nav className="nav" aria-label="Navegacao">
              <Link href="/">Inicio</Link>
              <Link href="/diario">Diario</Link>
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
                Cliente
                <input
                  required
                  type="text"
                  value={form.cliente}
                  onChange={(event) => setForm({ ...form, cliente: event.target.value })}
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

              <label>
                Situacao do Agendamento
                <select
                  value={form.situacao_agendamento}
                  onChange={(event) => setForm({ ...form, situacao_agendamento: event.target.value })}
                >
                  <option value="">Nao informado</option>
                  <option value="Realizado">Realizado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
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
                {records.map((record) => (
                  <article className="record-card" key={record.id}>
                    <div>
                      <strong>{record.cliente}</strong>
                      <span>{record.data}</span>
                      <span>Situacao: {record.situacao_agendamento ?? "Nao informado"}</span>
                      {record.observacao ? <p>{record.observacao}</p> : null}
                    </div>
                    <div className="button-row">
                      <button className="secondary-button" onClick={() => handleEdit(record)} type="button">
                        Editar
                      </button>
                      <button className="danger-button" onClick={() => handleDelete(record.id)} type="button">
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </AuthGate>
      </div>
    </main>
  );
}
