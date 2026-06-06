"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { PermissionGate } from "@/components/PermissionGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { logAudit } from "@/lib/audit";
import { canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { AgendaServico, DiarioMovimentacao, DiarioOperacional } from "@/types/database";

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

type MovimentacaoForm = {
  diario_id: string;
  data: string;
  tecnico: string;
  servico_realizado: string;
  observacao: string;
  status_atendimento: string;
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

const initialMovimentacaoForm: MovimentacaoForm = {
  diario_id: "",
  data: "",
  tecnico: "",
  servico_realizado: "",
  observacao: "",
  status_atendimento: "Em andamento"
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

function movementFallback(record: DiarioOperacional): DiarioMovimentacao {
  return {
    id: `legacy-${record.id}`,
    diario_id: record.id,
    data: record.data,
    tecnico: record.tecnico,
    servico_realizado: record.servico_realizado,
    observacao: record.observacao,
    status_atendimento: record.status_atendimento === "Finalizado" ? "Finalizado" : "Em andamento",
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function normalizeMainSituation(value: string) {
  const trimmedValue = value.trim();
  const legacyAllowedValues = ["Realizado", "Pendente", "Retorno", "Cancelado"];

  return legacyAllowedValues.includes(trimmedValue) ? trimmedValue : null;
}

export default function DiarioPage() {
  const [records, setRecords] = useState<DiarioOperacional[]>([]);
  const [movements, setMovements] = useState<DiarioMovimentacao[]>([]);
  const [agendaRecords, setAgendaRecords] = useState<AgendaServico[]>([]);
  const [form, setForm] = useState<DiarioForm>(initialForm);
  const [movementForm, setMovementForm] = useState<MovimentacaoForm>(initialMovimentacaoForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { email, loading: accessLoading, metadata } = useCurrentAccess();
  const canAccessDiario = canAccessModule(email, metadata, "diario");

  useEffect(() => {
    if (!accessLoading && canAccessDiario) {
      loadRecords();
    }
  }, [accessLoading, canAccessDiario]);

  async function loadRecords() {
    setLoading(true);
    setError("");

    const [diarioResponse, movementResponse, agendaResponse] = await Promise.all([
      supabase
        .from("diario_operacional")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("diario_movimentacoes")
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

    if (movementResponse.error) {
      setError((currentError) => currentError || movementResponse.error.message);
      setMovements([]);
    } else {
      setMovements(movementResponse.data ?? []);
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
      situacao_atendimento: normalizeMainSituation(form.situacao_atendimento),
      status_atendimento: form.status_atendimento || null,
      agendamento_id: form.agendamento_id || null,
      bloqueado: form.status_atendimento === "Finalizado"
    };

    const response = editingId
      ? await supabase.from("diario_operacional").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("diario_operacional").insert(payload).select("id").single();

    if (response.error) {
      setError(response.error.message);
      setSaving(false);
      return;
    }

    const diarioId = response.data?.id ?? editingId;

    if (!editingId && diarioId) {
      const { error: movementError } = await supabase.from("diario_movimentacoes").insert({
        diario_id: diarioId,
        data: form.data,
        tecnico: form.tecnico.trim(),
        servico_realizado: form.servico_realizado.trim(),
        observacao: form.observacao.trim() || null,
        status_atendimento: form.status_atendimento || "Em andamento"
      });

      if (movementError) {
        setError(`Atendimento salvo, mas a primeira movimentacao nao foi criada: ${movementError.message}`);
        await loadRecords();
        setSaving(false);
        return;
      }
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

    await logAudit({
      modulo: "Diário",
      acao: payload.status_atendimento === "Finalizado" ? "Finalizar" : editingId ? "Editar" : "Criar",
      registro_afetado: diarioId ?? form.cliente
    });
    setForm(initialForm);
    setEditingId(null);
    setMessage(editingId ? "Atendimento atualizado." : "Atendimento salvo com primeira movimentacao.");
    await loadRecords();
    setSaving(false);
  }

  async function handleAddMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const record = records.find((currentRecord) => currentRecord.id === movementForm.diario_id);

    if (!record) {
      setError("Selecione um atendimento para adicionar movimentacao.");
      setSaving(false);
      return;
    }

    if (isDiarioLocked(record)) {
      setError("Atendimento finalizado ou bloqueado nao permite novas movimentacoes.");
      setSaving(false);
      return;
    }

    const status = movementForm.status_atendimento || "Em andamento";
    const { error: movementError } = await supabase.from("diario_movimentacoes").insert({
      diario_id: movementForm.diario_id,
      data: movementForm.data,
      tecnico: movementForm.tecnico.trim(),
      servico_realizado: movementForm.servico_realizado.trim(),
      observacao: movementForm.observacao.trim() || null,
      status_atendimento: status
    });

    if (movementError) {
      setError(movementError.message);
      setSaving(false);
      return;
    }

    if (status === "Finalizado") {
      const { error: updateError } = await supabase
        .from("diario_operacional")
        .update({
          status_atendimento: "Finalizado",
          bloqueado: true
        })
        .eq("id", movementForm.diario_id);

      if (updateError) {
        setError(`Movimentacao salva, mas nao foi possivel finalizar o atendimento: ${updateError.message}`);
        await loadRecords();
        setSaving(false);
        return;
      }

      if (record.agendamento_id) {
        const { error: agendaError } = await supabase
          .from("agenda_servicos")
          .update({ bloqueado: true })
          .eq("id", record.agendamento_id);

        if (agendaError) {
          setError(`Atendimento finalizado, mas nao foi possivel bloquear o agendamento: ${agendaError.message}`);
          await loadRecords();
          setSaving(false);
          return;
        }
      }
    }

    await logAudit({
      modulo: "Diário",
      acao: status === "Finalizado" ? "Finalizar" : "Criar",
      registro_afetado: movementForm.diario_id
    });
    setMovementForm(initialMovimentacaoForm);
    setMessage(status === "Finalizado" ? "Atendimento finalizado." : "Movimentacao adicionada.");
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

  function handlePrepareMovement(record: DiarioOperacional) {
    if (isDiarioLocked(record)) {
      setMessage("");
      setError("Atendimento finalizado ou bloqueado nao permite novas movimentacoes.");
      return;
    }

    setMovementForm({
      diario_id: record.id,
      data: "",
      tecnico: record.tecnico,
      servico_realizado: "",
      observacao: "",
      status_atendimento: "Em andamento"
    });
    setMessage("");
    setError("");
  }

  function handleAgendaChange(agendamentoId: string) {
    const selectedAgenda = agendaRecords.find((record) => record.id === agendamentoId);

    if (!selectedAgenda) {
      setForm({ ...form, agendamento_id: agendamentoId });
      return;
    }

    setForm({
      ...form,
      agendamento_id: agendamentoId,
      cliente: selectedAgenda.cliente,
      cidade: selectedAgenda.cidade ?? "",
      situacao_atendimento: selectedAgenda.situacao_agendamento ?? "",
      servico_realizado: selectedAgenda.observacao ?? ""
    });
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
      await logAudit({
        modulo: "Diário",
        acao: "Excluir",
        registro_afetado: id
      });
      setMessage("Registro excluido.");
      await loadRecords();
    }
  }

  function recordMovements(record: DiarioOperacional) {
    const currentMovements = movements.filter((movement) => movement.diario_id === record.id);

    return currentMovements.length > 0 ? currentMovements : [movementFallback(record)];
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <PermissionGate module="diario">
            <header className="topbar">
              <div className="brand">
                <h1>Diario Operacional</h1>
                <p>Registro interno de atendimentos e movimentacoes.</p>
              </div>
              <AppNav />
            </header>

            <section className="work-layout">
              <div className="panel form-grid">
                <form className="form-grid" onSubmit={handleSubmit}>
                  <h2>{editingId ? "Editar atendimento" : "Novo atendimento"}</h2>

                  <label>
                    Data original
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
                      onChange={(event) => handleAgendaChange(event.target.value)}
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
                    Servico inicial
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

                {movementForm.diario_id ? (
                  <form className="form-grid" onSubmit={handleAddMovement}>
                    <h2>Nova movimentacao</h2>

                    <label>
                      Data da visita
                      <input
                        required
                        type="date"
                        value={movementForm.data}
                        onChange={(event) => setMovementForm({ ...movementForm, data: event.target.value })}
                      />
                    </label>

                    <label>
                      Tecnico
                      <input
                        required
                        type="text"
                        value={movementForm.tecnico}
                        onChange={(event) => setMovementForm({ ...movementForm, tecnico: event.target.value })}
                      />
                    </label>

                    <label>
                      Servico realizado
                      <textarea
                        required
                        rows={4}
                        value={movementForm.servico_realizado}
                        onChange={(event) =>
                          setMovementForm({ ...movementForm, servico_realizado: event.target.value })
                        }
                      />
                    </label>

                    <label>
                      Observacao
                      <textarea
                        rows={3}
                        value={movementForm.observacao}
                        onChange={(event) => setMovementForm({ ...movementForm, observacao: event.target.value })}
                      />
                    </label>

                    <label>
                      Status
                      <select
                        required
                        value={movementForm.status_atendimento}
                        onChange={(event) =>
                          setMovementForm({ ...movementForm, status_atendimento: event.target.value })
                        }
                      >
                        {statusAtendimento.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="button-row">
                      <button className="primary-button" disabled={saving} type="submit">
                        {saving ? "Salvando..." : "Adicionar visita"}
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => setMovementForm(initialMovimentacaoForm)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>

              <section className="panel">
                <div className="section-heading">
                  <h2>Atendimentos cadastrados</h2>
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
                            Data original: {record.data} | {record.tecnico}
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

                          <div className="movement-list">
                            {recordMovements(record).map((movement) => (
                              <div className="movement-item" key={movement.id}>
                                <strong>
                                  {movement.data} | {movement.tecnico} | {movement.status_atendimento}
                                </strong>
                                <p>{movement.servico_realizado}</p>
                                {movement.observacao ? <p>{movement.observacao}</p> : null}
                              </div>
                            ))}
                          </div>
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
                          <button
                            className="secondary-button"
                            disabled={locked}
                            onClick={() => handlePrepareMovement(record)}
                            type="button"
                          >
                            Nova visita
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
          </PermissionGate>
        </AuthGate>
      </div>
    </main>
  );
}
