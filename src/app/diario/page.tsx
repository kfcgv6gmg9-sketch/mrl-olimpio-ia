"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { PermissionGate } from "@/components/PermissionGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { logAudit } from "@/lib/audit";
import { canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import {
  AgendaServico,
  DiarioAjudante,
  DiarioMovimentacao,
  DiarioMovimentacaoAjudante,
  DiarioOperacional,
  Funcionario
} from "@/types/database";

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
  ajudantes: string[];
};

type MovimentacaoForm = {
  movimentacao_id: string;
  diario_id: string;
  data: string;
  tecnico: string;
  servico_realizado: string;
  observacao: string;
  status_atendimento: string;
  ajudantes: string[];
};

type HistoryItem = {
  id: string;
  source: "principal" | "movimentacao";
  diario_id: string;
  data: string;
  tecnico: string;
  status_atendimento: string;
  servico_realizado: string;
  observacao: string | null;
};

const initialMovimentacaoForm: MovimentacaoForm = {
  movimentacao_id: "",
  diario_id: "",
  data: "",
  tecnico: "",
  servico_realizado: "",
  observacao: "",
  status_atendimento: "Aberto",
  ajudantes: []
};

const statusAtendimento = [
  "Aberto",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Peça",
  "Finalizado",
  "Cancelado"
];
const defaultSituacaoAtendimento = "Servi\u00e7o T\u00e9cnico";
const situacoesAtendimento = [defaultSituacaoAtendimento, "Retorno", "Garantia"];

function createInitialForm(): DiarioForm {
  return {
    data: "",
    tecnico: "",
    cliente: "",
    cidade: "",
    servico_realizado: "",
    observacao: "",
    situacao_atendimento: defaultSituacaoAtendimento,
    status_atendimento: "Aberto",
    agendamento_id: "",
    ajudantes: []
  };
}

function isDiarioLocked(record: DiarioOperacional) {
  return record.status_atendimento === "Finalizado" || record.bloqueado === true;
}

function preventsNewMovement(record: DiarioOperacional) {
  return isDiarioLocked(record) || record.status_atendimento === "Cancelado";
}

function finalizadoBadge(record: DiarioOperacional) {
  return isDiarioLocked(record) ? "ATENDIMENTO FINALIZADO" : "";
}

function agendaLabel(record: AgendaServico) {
  const city = record.cidade ? ` | ${record.cidade}` : "";
  const status = record.status_agendamento ? ` | ${record.status_agendamento}` : "";

  return `${record.data} | ${record.cliente}${city}${status}`;
}

function principalHistoryItem(record: DiarioOperacional): HistoryItem {
  return {
    id: `principal-${record.id}`,
    source: "principal",
    diario_id: record.id,
    data: record.data,
    tecnico: record.tecnico,
    servico_realizado: record.servico_realizado,
    observacao: record.observacao,
    status_atendimento: record.status_atendimento ?? "Aberto"
  };
}

function isInitialMovementCopy(record: DiarioOperacional, movement: DiarioMovimentacao) {
  return (
    movement.data === record.data &&
    movement.tecnico === record.tecnico &&
    movement.servico_realizado === record.servico_realizado &&
    (movement.observacao ?? "") === (record.observacao ?? "")
  );
}

function normalizeMainSituation(value: string) {
  const trimmedValue = value.trim();
  const legacyAllowedValues = ["Realizado", "Pendente", "Retorno", "Cancelado"];

  return legacyAllowedValues.includes(trimmedValue) ? trimmedValue : null;
}

function normalizeFormSituation(value?: string | null) {
  return value && situacoesAtendimento.includes(value) ? value : defaultSituacaoAtendimento;
}

function selectValues(select: HTMLSelectElement) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function funcionarioMatchesTecnico(funcionario: Funcionario, tecnico: string) {
  return funcionario.nome.trim().toLowerCase() === tecnico.trim().toLowerCase();
}

export default function DiarioPage() {
  const [records, setRecords] = useState<DiarioOperacional[]>([]);
  const [movements, setMovements] = useState<DiarioMovimentacao[]>([]);
  const [agendaRecords, setAgendaRecords] = useState<AgendaServico[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [ajudantes, setAjudantes] = useState<DiarioAjudante[]>([]);
  const [movementHelpers, setMovementHelpers] = useState<DiarioMovimentacaoAjudante[]>([]);
  const [form, setForm] = useState<DiarioForm>(createInitialForm);
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

    const [
      diarioResponse,
      movementResponse,
      agendaResponse,
      funcionariosResponse,
      ajudantesResponse,
      movementHelpersResponse
    ] = await Promise.all([
      supabase
        .from("diario_operacional")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("diario_movimentacoes")
        .select("*")
        .order("data", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("agenda_servicos")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("funcionarios")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("diario_ajudantes")
        .select("*"),
      supabase
        .from("diario_movimentacao_ajudantes")
        .select("*")
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

    if (funcionariosResponse.error) {
      setError((currentError) => currentError || funcionariosResponse.error.message);
      setFuncionarios([]);
    } else {
      setFuncionarios(funcionariosResponse.data ?? []);
    }

    if (ajudantesResponse.error) {
      setError((currentError) => currentError || ajudantesResponse.error.message);
      setAjudantes([]);
    } else {
      setAjudantes(ajudantesResponse.data ?? []);
    }

    if (movementHelpersResponse.error) {
      setError((currentError) => currentError || movementHelpersResponse.error.message);
      setMovementHelpers([]);
    } else {
      setMovementHelpers(movementHelpersResponse.data ?? []);
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

    const normalizedSituation = normalizeFormSituation(form.situacao_atendimento);
    const payload = {
      data: form.data,
      tecnico: form.tecnico.trim(),
      cliente: form.cliente.trim(),
      cidade: form.cidade.trim() || null,
      servico_realizado: form.servico_realizado.trim(),
      observacao: form.observacao.trim() || null,
      situacao_atendimento: normalizeMainSituation(normalizedSituation),
      status_atendimento: form.status_atendimento || "Aberto",
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

    if (diarioId) {
      const { error: deleteHelpersError } = await supabase.from("diario_ajudantes").delete().eq("diario_id", diarioId);

      if (deleteHelpersError) {
        setError(`Registro salvo, mas nao foi possivel atualizar ajudantes: ${deleteHelpersError.message}`);
        await loadRecords();
        setSaving(false);
        return;
      }

      const selectedHelpers = Array.from(new Set(form.ajudantes)).filter((funcionarioId) => {
        const funcionario = funcionarios.find((currentFuncionario) => currentFuncionario.id === funcionarioId);

        return funcionario ? !funcionarioMatchesTecnico(funcionario, form.tecnico) : false;
      });

      if (selectedHelpers.length > 0) {
        const { error: insertHelpersError } = await supabase.from("diario_ajudantes").insert(
          selectedHelpers.map((funcionarioId) => ({
            diario_id: diarioId,
            funcionario_id: funcionarioId
          }))
        );

        if (insertHelpersError) {
          setError(`Registro salvo, mas nao foi possivel gravar ajudantes: ${insertHelpersError.message}`);
          await loadRecords();
          setSaving(false);
          return;
        }
      }
    }

    if (!editingId && diarioId) {
      const { error: movementError } = await supabase.from("diario_movimentacoes").insert({
        diario_id: diarioId,
        data: form.data,
        tecnico: form.tecnico.trim(),
        servico_realizado: form.servico_realizado.trim(),
        observacao: form.observacao.trim() || null,
        status_atendimento: form.status_atendimento || "Aberto"
      });

      if (movementError) {
        setError(`Atendimento salvo, mas a primeira movimentacao nao foi criada: ${movementError.message}`);
        await loadRecords();
        setSaving(false);
        return;
      }
    }

    if (diarioId && payload.status_atendimento === "Finalizado") {
      const { error: movementsStatusError } = await finalizeDiarioMovements(diarioId);

      if (movementsStatusError) {
        setError(`Registro finalizado, mas nao foi possivel finalizar as movimentacoes: ${movementsStatusError.message}`);
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
      acao:
        payload.status_atendimento === "Finalizado"
          ? "Finalizar"
          : payload.status_atendimento === "Cancelado"
            ? "Cancelar"
            : editingId
              ? "Editar"
              : "Criar",
      registro_afetado: diarioId ?? form.cliente
    });
    setForm(createInitialForm());
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

    if (preventsNewMovement(record)) {
      setError("Atendimento finalizado, bloqueado ou cancelado nao permite alterar movimentacoes.");
      setSaving(false);
      return;
    }

    const status = movementForm.status_atendimento || "Aberto";
    const movementPayload = {
      diario_id: movementForm.diario_id,
      data: movementForm.data,
      tecnico: movementForm.tecnico.trim(),
      servico_realizado: movementForm.servico_realizado.trim(),
      observacao: movementForm.observacao.trim() || null,
      status_atendimento: status
    };
    const movementResponse = movementForm.movimentacao_id
      ? await supabase
          .from("diario_movimentacoes")
          .update(movementPayload)
          .eq("id", movementForm.movimentacao_id)
          .select("id")
          .single()
      : await supabase
          .from("diario_movimentacoes")
          .insert(movementPayload)
          .select("id")
          .single();

    if (movementResponse.error) {
      setError(movementResponse.error.message);
      setSaving(false);
      return;
    }

    const movementId = movementResponse.data?.id ?? movementForm.movimentacao_id;

    if (movementId) {
      const { error: deleteHelpersError } = await supabase
        .from("diario_movimentacao_ajudantes")
        .delete()
        .eq("movimentacao_id", movementId);

      if (deleteHelpersError) {
        setError(`Movimentacao salva, mas nao foi possivel atualizar ajudantes: ${deleteHelpersError.message}`);
        await loadRecords();
        setSaving(false);
        return;
      }

      const selectedHelpers = Array.from(new Set(movementForm.ajudantes)).filter((funcionarioId) => {
        const funcionario = funcionarios.find((currentFuncionario) => currentFuncionario.id === funcionarioId);

        return funcionario ? !funcionarioMatchesTecnico(funcionario, movementForm.tecnico) : false;
      });

      if (selectedHelpers.length > 0) {
        const { error: insertHelpersError } = await supabase.from("diario_movimentacao_ajudantes").insert(
          selectedHelpers.map((funcionarioId) => ({
            movimentacao_id: movementId,
            funcionario_id: funcionarioId
          }))
        );

        if (insertHelpersError) {
          setError(`Movimentacao salva, mas nao foi possivel gravar ajudantes: ${insertHelpersError.message}`);
          await loadRecords();
          setSaving(false);
          return;
        }
      }
    }

    const { data: updatedRecord, error: updateStatusError } = await supabase
      .from("diario_operacional")
      .update({
        status_atendimento: status,
        bloqueado: status === "Finalizado"
      })
      .eq("id", movementForm.diario_id)
      .select("id,status_atendimento,bloqueado")
      .single();

    if (updateStatusError) {
      setError(`Movimentacao salva, mas nao foi possivel atualizar o status do atendimento: ${updateStatusError.message}`);
      await loadRecords();
      setSaving(false);
      return;
    }

    if (
      status === "Finalizado" &&
      (updatedRecord?.status_atendimento !== "Finalizado" || updatedRecord.bloqueado !== true)
    ) {
      setError("Movimentacao salva, mas o atendimento principal nao foi confirmado como finalizado e bloqueado.");
      await loadRecords();
      setSaving(false);
      return;
    }

    if (status === "Finalizado") {
      const { error: movementsStatusError } = await finalizeDiarioMovements(movementForm.diario_id);

      if (movementsStatusError) {
        setError(`Atendimento finalizado, mas nao foi possivel finalizar as movimentacoes: ${movementsStatusError.message}`);
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
      acao: status === "Finalizado" ? "Finalizar" : status === "Cancelado" ? "Cancelar" : movementForm.movimentacao_id ? "Editar" : "Criar",
      registro_afetado: movementForm.diario_id
    });
    setMovementForm(initialMovimentacaoForm);
    setMessage(status === "Finalizado" ? "Atendimento finalizado." : movementForm.movimentacao_id ? "Movimentacao atualizada." : "Movimentacao adicionada.");
    await loadRecords();
    setSaving(false);
  }

  async function finalizeDiarioMovements(diarioId: string) {
    return supabase
      .from("diario_movimentacoes")
      .update({ status_atendimento: "Finalizado" })
      .eq("diario_id", diarioId);
  }

  function handleEdit(record: DiarioOperacional) {
    if (isDiarioLocked(record)) {
      setMessage("");
      setError("Registro finalizado ou bloqueado nao pode ser editado.");
      return;
    }

    const linkedAgenda = agendaRecords.find((agenda) => agenda.id === record.agendamento_id);

    setEditingId(record.id);
    setForm({
      data: record.data,
      tecnico: record.tecnico,
      cliente: record.cliente,
      cidade: record.cidade ?? "",
      servico_realizado: record.servico_realizado,
      observacao: record.observacao ?? "",
      situacao_atendimento: normalizeFormSituation(record.situacao_atendimento ?? linkedAgenda?.situacao_agendamento),
      status_atendimento: record.status_atendimento ?? "Aberto",
      agendamento_id: record.agendamento_id ?? "",
      ajudantes: ajudantes
        .filter((helper) => helper.diario_id === record.id)
        .map((helper) => helper.funcionario_id)
    });
    setMessage("");
    setError("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(createInitialForm());
    setMessage("");
    setError("");
  }

  function handlePrepareMovement(record: DiarioOperacional) {
    if (preventsNewMovement(record)) {
      setMessage("");
      setError("Atendimento finalizado, bloqueado ou cancelado nao permite novas movimentacoes.");
      return;
    }

    setMovementForm({
      movimentacao_id: "",
      diario_id: record.id,
      data: "",
      tecnico: record.tecnico,
      servico_realizado: "",
      observacao: "",
      status_atendimento: "Aberto",
      ajudantes: []
    });
    setMessage("");
    setError("");
  }

  function handleEditMovement(movement: HistoryItem) {
    if (movement.source !== "movimentacao") {
      return;
    }

    const record = records.find((currentRecord) => currentRecord.id === movement.diario_id);

    if (!record) {
      setError("Atendimento da movimentacao nao encontrado.");
      return;
    }

    if (isDiarioLocked(record)) {
      setError("Atendimento finalizado nao permite alterar movimentacoes.");
      return;
    }

    setMovementForm({
      movimentacao_id: movement.id,
      diario_id: movement.diario_id,
      data: movement.data,
      tecnico: movement.tecnico,
      servico_realizado: movement.servico_realizado,
      observacao: movement.observacao ?? "",
      status_atendimento: movement.status_atendimento,
      ajudantes: movementHelpers
        .filter((helper) => helper.movimentacao_id === movement.id)
        .map((helper) => helper.funcionario_id)
    });
    setMessage("");
    setError("");
  }

  function handleAgendaChange(agendamentoId: string) {
    const selectedAgenda = agendaRecords.find((record) => record.id === agendamentoId);

    if (!selectedAgenda) {
      setForm({
        ...form,
        agendamento_id: agendamentoId,
        situacao_atendimento: defaultSituacaoAtendimento
      });
      return;
    }

    setForm({
      ...form,
      agendamento_id: agendamentoId,
      cliente: selectedAgenda.cliente,
      cidade: selectedAgenda.cidade ?? "",
      situacao_atendimento: normalizeFormSituation(selectedAgenda.situacao_agendamento),
      servico_realizado: selectedAgenda.observacao ?? ""
    });
  }

  async function handleDelete(id: string) {
    const currentRecord = records.find((record) => record.id === id);

    if (currentRecord && isDiarioLocked(currentRecord)) {
      setError("Atendimento finalizado nao pode ser excluido.");
      setMessage("");
      return;
    }

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

  function recordHistory(record: DiarioOperacional) {
    const principalItem = principalHistoryItem(record);
    const visitItems = movements
      .filter((movement) => movement.diario_id === record.id)
      .filter((movement) => !isInitialMovementCopy(record, movement))
      .map((movement) => ({
        ...movement,
        source: "movimentacao" as const
      }))
      .sort((first, second) => {
        const dateComparison = first.data.localeCompare(second.data);

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return first.created_at.localeCompare(second.created_at);
      });

    return [principalItem, ...visitItems];
  }

  function funcionarioName(funcionarioId: string) {
    return funcionarios.find((funcionario) => funcionario.id === funcionarioId)?.nome ?? funcionarioId;
  }

  function recordHelpers(recordId: string) {
    return ajudantes.filter((helper) => helper.diario_id === recordId);
  }

  function movementHelperNames(movementId: string) {
    return movementHelpers
      .filter((helper) => helper.movimentacao_id === movementId)
      .map((helper) => funcionarioName(helper.funcionario_id));
  }

  function handleTecnicoChange(tecnico: string) {
    setForm({
      ...form,
      tecnico,
      ajudantes: form.ajudantes.filter((funcionarioId) => {
        const funcionario = funcionarios.find((currentFuncionario) => currentFuncionario.id === funcionarioId);

        return funcionario ? !funcionarioMatchesTecnico(funcionario, tecnico) : true;
      })
    });
  }

  function handleMovementTecnicoChange(tecnico: string) {
    setMovementForm({
      ...movementForm,
      tecnico,
      ajudantes: movementForm.ajudantes.filter((funcionarioId) => {
        const funcionario = funcionarios.find((currentFuncionario) => currentFuncionario.id === funcionarioId);

        return funcionario ? !funcionarioMatchesTecnico(funcionario, tecnico) : true;
      })
    });
  }

  function toggleMovementHelper(funcionarioId: string) {
    setMovementForm({
      ...movementForm,
      ajudantes: movementForm.ajudantes.includes(funcionarioId)
        ? movementForm.ajudantes.filter((currentId) => currentId !== funcionarioId)
        : [...movementForm.ajudantes, funcionarioId]
    });
  }

  const tecnicoOptions = Array.from(
    new Set([
      ...funcionarios.map((funcionario) => funcionario.nome),
      form.tecnico,
      movementForm.tecnico
    ].filter(Boolean))
  );
  const ajudanteOptions = funcionarios.filter((funcionario) => !funcionarioMatchesTecnico(funcionario, form.tecnico));
  const movementHelperOptions = funcionarios.filter(
    (funcionario) => !funcionarioMatchesTecnico(funcionario, movementForm.tecnico)
  );
  const selectedMovementHelperNames = movementForm.ajudantes.map((funcionarioId) => funcionarioName(funcionarioId));

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
                    <select
                      required
                      value={form.tecnico}
                      onChange={(event) => handleTecnicoChange(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {tecnicoOptions.map((tecnico) => (
                        <option key={tecnico} value={tecnico}>
                          {tecnico}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Ajudantes
                    <select
                      multiple
                      value={form.ajudantes}
                      onChange={(event) => setForm({ ...form, ajudantes: selectValues(event.currentTarget) })}
                    >
                      {ajudanteOptions.map((funcionario) => (
                        <option key={funcionario.id} value={funcionario.id}>
                          {funcionario.nome}
                        </option>
                      ))}
                    </select>
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
                    Situação do Atendimento
                    <select
                      required
                      value={normalizeFormSituation(form.situacao_atendimento)}
                      onChange={(event) => setForm({ ...form, situacao_atendimento: event.target.value })}
                    >
                      {situacoesAtendimento.map((situacao) => (
                        <option key={situacao} value={situacao}>
                          {situacao}
                        </option>
                      ))}
                    </select>
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
                    <h2>{movementForm.movimentacao_id ? "Editar movimentacao" : "Nova movimentacao"}</h2>

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
                      <select
                        required
                        value={movementForm.tecnico}
                        onChange={(event) => handleMovementTecnicoChange(event.target.value)}
                      >
                        <option value="">Selecione</option>
                        {tecnicoOptions.map((tecnico) => (
                          <option key={tecnico} value={tecnico}>
                            {tecnico}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Ajudantes
                      <div className="multi-select-panel">
                        {movementHelperOptions.length === 0 ? (
                          <span className="muted-text">Nenhum funcionário disponível.</span>
                        ) : null}
                        {movementHelperOptions.map((funcionario) => (
                          <label className="checkbox-label" key={funcionario.id}>
                            <input
                              checked={movementForm.ajudantes.includes(funcionario.id)}
                              onChange={() => toggleMovementHelper(funcionario.id)}
                              type="checkbox"
                            />
                            {funcionario.nome}
                          </label>
                        ))}
                      </div>
                      {selectedMovementHelperNames.length > 0 ? (
                        <div className="selected-chip-list">
                          {selectedMovementHelperNames.map((name) => (
                            <span className="selected-chip" key={name}>
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
                        {saving ? "Salvando..." : movementForm.movimentacao_id ? "Atualizar visita" : "Adicionar visita"}
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
                    const movementDisabled = preventsNewMovement(record);
                    const badge = finalizadoBadge(record);

                    return (
                      <article className="record-card" key={record.id}>
                        <div>
                          <strong>{record.cliente}</strong>
                          {badge ? <span className="finalized-badge">{badge}</span> : null}
                          <span>
                            Data original: {record.data} | {record.tecnico}
                          </span>
                          <span>Cidade: {record.cidade ?? "Nao informado"}</span>
                          <span>
                            Situacao:{" "}
                            {normalizeFormSituation(record.situacao_atendimento ?? linkedAgenda?.situacao_agendamento)}
                          </span>
                          <span>Status: {record.status_atendimento ?? "Nao informado"}</span>
                          {recordHelpers(record.id).length > 0 ? (
                            <span>
                              Ajudantes: {recordHelpers(record.id).map((helper) => funcionarioName(helper.funcionario_id)).join(", ")}
                            </span>
                          ) : null}
                          <span>
                            Agendamento:{" "}
                            {linkedAgenda
                              ? agendaLabel(linkedAgenda)
                              : record.agendamento_id
                                ? record.agendamento_id
                                : "Nao vinculado"}
                          </span>
                          {record.bloqueado ? <span>Bloqueado: Sim</span> : null}

                          <div className="movement-list" aria-label="Historico do atendimento">
                            <h3>Histórico do Atendimento</h3>
                            {recordHistory(record).map((movement) => (
                              <div className="movement-item" key={movement.id}>
                                <strong>
                                  {movement.data} - {movement.tecnico}
                                </strong>
                                {movement.source === "movimentacao" && movementHelperNames(movement.id).length > 0 ? (
                                  <span>Ajudantes: {movementHelperNames(movement.id).join(", ")}</span>
                                ) : null}
                                <span>Status: {movement.status_atendimento}</span>
                                <p>Serviço: {movement.servico_realizado}</p>
                                {movement.observacao ? <p>{movement.observacao}</p> : null}
                                {movement.source === "movimentacao" && !locked ? (
                                  <button
                                    className="secondary-button"
                                    onClick={() => handleEditMovement(movement)}
                                    type="button"
                                  >
                                    Editar visita
                                  </button>
                                ) : null}
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
                            disabled={movementDisabled}
                            onClick={() => handlePrepareMovement(record)}
                            type="button"
                          >
                            Nova visita
                          </button>
                          <button
                            className="danger-button"
                            disabled={locked}
                            onClick={() => handleDelete(record.id)}
                            type="button"
                          >
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


