"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { DiarioOperacional } from "@/types/database";

type DiarioForm = {
  data: string;
  tecnico: string;
  cliente: string;
  servico_realizado: string;
  observacao: string;
  situacao_atendimento: string;
};

const initialForm: DiarioForm = {
  data: "",
  tecnico: "",
  cliente: "",
  servico_realizado: "",
  observacao: "",
  situacao_atendimento: ""
};

export default function DiarioPage() {
  const [records, setRecords] = useState<DiarioOperacional[]>([]);
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

    const { data, error: listError } = await supabase
      .from("diario_operacional")
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
      tecnico: form.tecnico.trim(),
      cliente: form.cliente.trim(),
      servico_realizado: form.servico_realizado.trim(),
      observacao: form.observacao.trim() || null,
      situacao_atendimento: form.situacao_atendimento || null
    };

    const response = editingId
      ? await supabase.from("diario_operacional").update(payload).eq("id", editingId)
      : await supabase.from("diario_operacional").insert(payload);

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

  function handleEdit(record: DiarioOperacional) {
    setEditingId(record.id);
    setForm({
      data: record.data,
      tecnico: record.tecnico,
      cliente: record.cliente,
      servico_realizado: record.servico_realizado,
      observacao: record.observacao ?? "",
      situacao_atendimento: record.situacao_atendimento ?? ""
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

              <label>
                Situacao do Atendimento
                <select
                  value={form.situacao_atendimento}
                  onChange={(event) => setForm({ ...form, situacao_atendimento: event.target.value })}
                >
                  <option value="">Nao informado</option>
                  <option value="Finalizado">Finalizado</option>
                  <option value="Retorno">Retorno</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Orçamento Não Aprovado">Orçamento Não Aprovado</option>
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
                      <span>
                        {record.data} | {record.tecnico}
                      </span>
                      <span>Situacao: {record.situacao_atendimento ?? "Nao informado"}</span>
                      <p>{record.servico_realizado}</p>
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
