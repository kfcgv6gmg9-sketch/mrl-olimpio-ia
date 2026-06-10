"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { PermissionGate } from "@/components/PermissionGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import {
  AgendaServico,
  DiarioMovimentacao,
  DiarioMovimentacaoAjudante,
  DiarioOperacional,
  Funcionario
} from "@/types/database";

type DiarioReportRecord = {
  id: string;
  data: string;
  tecnico: string;
  funcao: string;
  cliente: string;
  servico_realizado: string;
  status_atendimento: string | null;
  observacao: string | null;
};

type AgendaFilters = {
  data: string;
  dataInicio: string;
  dataFim: string;
  situacaoAgendamento: string;
};

type DiarioFilters = AgendaFilters & {
  tecnico: string;
  situacaoAtendimento: string;
};

const initialAgendaFilters: AgendaFilters = {
  data: "",
  dataInicio: "",
  dataFim: "",
  situacaoAgendamento: ""
};

const initialDiarioFilters: DiarioFilters = {
  data: "",
  dataInicio: "",
  dataFim: "",
  situacaoAgendamento: "",
  tecnico: "",
  situacaoAtendimento: ""
};

const statusAtendimento = [
  "Aberto",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Peça",
  "Finalizado",
  "Cancelado"
];

export default function RelatoriosPage() {
  const [agendaRecords, setAgendaRecords] = useState<AgendaServico[]>([]);
  const [diarioRecords, setDiarioRecords] = useState<DiarioReportRecord[]>([]);
  const [agendaFilters, setAgendaFilters] = useState<AgendaFilters>(initialAgendaFilters);
  const [diarioFilters, setDiarioFilters] = useState<DiarioFilters>(initialDiarioFilters);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [loadingDiario, setLoadingDiario] = useState(true);
  const [agendaError, setAgendaError] = useState("");
  const [diarioError, setDiarioError] = useState("");
  const { email, loading: accessLoading, metadata } = useCurrentAccess();
  const canAccessRelatorios = canAccessModule(email, metadata, "relatorios");

  const loadAgenda = useCallback(async (filters: AgendaFilters) => {
    setLoadingAgenda(true);
    setAgendaError("");

    let query = supabase
      .from("agenda_servicos")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.data) {
      query = query.eq("data", filters.data);
    } else {
      if (filters.dataInicio) {
        query = query.gte("data", filters.dataInicio);
      }

      if (filters.dataFim) {
        query = query.lte("data", filters.dataFim);
      }
    }

    if (filters.situacaoAgendamento) {
      query = query.eq("situacao_agendamento", filters.situacaoAgendamento);
    }

    const { data, error } = await query;

    if (error) {
      setAgendaError(error.message);
    } else {
      setAgendaRecords(data ?? []);
    }

    setLoadingAgenda(false);
  }, []);

  const loadDiario = useCallback(async (filters: DiarioFilters) => {
    setLoadingDiario(true);
    setDiarioError("");

    let query = supabase
      .from("diario_operacional")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    let movementsQuery = supabase
      .from("diario_movimentacoes")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.data) {
      movementsQuery = movementsQuery.eq("data", filters.data);
    } else {
      if (filters.dataInicio) {
        movementsQuery = movementsQuery.gte("data", filters.dataInicio);
      }

      if (filters.dataFim) {
        movementsQuery = movementsQuery.lte("data", filters.dataFim);
      }
    }

    const [
      { data: diarios, error: diarioError },
      { data: movements, error: movementError },
      { data: helpers, error: helpersError },
      { data: funcionarios, error: funcionariosError }
    ] = await Promise.all([
      query,
      movementsQuery,
      supabase.from("diario_movimentacao_ajudantes").select("*"),
      supabase.from("funcionarios").select("*").eq("ativo", true).order("nome", { ascending: true })
    ]);

    if (diarioError || movementError || helpersError || funcionariosError) {
      setDiarioError(
        diarioError?.message ??
          movementError?.message ??
          helpersError?.message ??
          funcionariosError?.message ??
          "Nao foi possivel carregar diario."
      );
    } else {
      setDiarioRecords(
        buildDiarioReportRows(diarios ?? [], movements ?? [], helpers ?? [], funcionarios ?? [], filters)
      );
    }

    setLoadingDiario(false);
  }, []);

  useEffect(() => {
    if (!accessLoading && canAccessRelatorios) {
      loadAgenda(initialAgendaFilters);
      loadDiario(initialDiarioFilters);
    }
  }, [accessLoading, canAccessRelatorios, loadAgenda, loadDiario]);

  function handleAgendaFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadAgenda(agendaFilters);
  }

  function handleDiarioFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadDiario(diarioFilters);
  }

  function clearAgendaFilters() {
    setAgendaFilters(initialAgendaFilters);
    loadAgenda(initialAgendaFilters);
  }

  function clearDiarioFilters() {
    setDiarioFilters(initialDiarioFilters);
    loadDiario(initialDiarioFilters);
  }

  function exportAgendaCsv() {
    downloadCsv(
      "agenda-servicos.csv",
      ["data", "cliente", "situacao_agendamento", "observacao"],
      agendaCsvRows(agendaRecords)
    );
  }

  function exportDiarioCsv() {
    downloadCsv(
      "diario-operacional.csv",
      [
        "data",
        "tecnico",
        "funcao",
        "cliente",
        "servico_realizado",
        "status_atendimento",
        "observacao"
      ],
      diarioCsvRows(diarioRecords)
    );
  }

  function exportAgendaPdf() {
    printPdfReport({
      title: "Relatorio Agenda",
      period: formatPeriod(agendaFilters),
      rows: agendaRecords.map((record) => ({
        data: record.data,
        cliente: record.cliente,
        servico: "Servico agendado",
        status: record.situacao_agendamento ?? "Nao informado",
        observacao: record.observacao ?? ""
      }))
    });
  }

  function exportDiarioPdf() {
    printPdfReport({
      title: "Relatorio Diario",
      period: formatPeriod(diarioFilters),
      tecnico: diarioFilters.tecnico.trim() || "Todos",
      rows: diarioRecords.map((record) => ({
        data: record.data,
        tecnico: record.tecnico,
        funcao: record.funcao,
        cliente: record.cliente,
        servico: record.servico_realizado,
        status: record.status_atendimento ?? "Nao informado",
        observacao: record.observacao ?? ""
      }))
    });
  }

  const agendaSituationCounts = countSituations(
    agendaRecords,
    ["Serviço Técnico", "Retorno", "Garantia"],
    "situacao_agendamento"
  );
  const diarioSituationCounts = countSituations(
    diarioRecords,
    statusAtendimento,
    "status_atendimento"
  );

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <PermissionGate module="relatorios">
            <header className="topbar">
              <div className="brand">
                <h1>Relatorios</h1>
                <p>Consultas internas por data, periodo e tecnico.</p>
              </div>
              <AppNav />
            </header>

            <section className="metric-grid" aria-label="Dashboard">
            <article className="metric-card">
              <span>Total de servicos agendados</span>
              <strong>{agendaRecords.length}</strong>
            </article>
            <article className="metric-card">
              <span>Total de registros do diario</span>
              <strong>{diarioRecords.length}</strong>
            </article>
            </section>

            <section className="panel report-panel" aria-label="Contadores por situacao">
            <h2>Contadores por Situacao</h2>
            <div className="situation-grid">
              {Object.entries(agendaSituationCounts).map(([label, total]) => (
                <article className="situation-card" key={`agenda-${label}`}>
                  <span>Agenda | {label}</span>
                  <strong>{total}</strong>
                </article>
              ))}
              {Object.entries(diarioSituationCounts).map(([label, total]) => (
                <article className="situation-card" key={`diario-${label}`}>
                  <span>Diario | {label}</span>
                  <strong>{total}</strong>
                </article>
              ))}
            </div>
            </section>

            <section className="report-grid">
            <article className="panel report-panel">
              <div className="section-heading">
                <h2>Relatorio Agenda</h2>
                <div className="button-row">
                  <button className="secondary-button" onClick={exportAgendaCsv} type="button">
                    Exportar CSV
                  </button>
                  <button className="secondary-button" onClick={exportAgendaPdf} type="button">
                    Exportar PDF
                  </button>
                </div>
              </div>

              <form className="filter-grid" onSubmit={handleAgendaFilter}>
                <label>
                  Data
                  <input
                    type="date"
                    value={agendaFilters.data}
                    onChange={(event) => setAgendaFilters({ ...agendaFilters, data: event.target.value })}
                  />
                </label>

                <label>
                  Inicio
                  <input
                    type="date"
                    value={agendaFilters.dataInicio}
                    onChange={(event) => setAgendaFilters({ ...agendaFilters, dataInicio: event.target.value })}
                  />
                </label>

                <label>
                  Fim
                  <input
                    type="date"
                    value={agendaFilters.dataFim}
                    onChange={(event) => setAgendaFilters({ ...agendaFilters, dataFim: event.target.value })}
                  />
                </label>

                <label>
                  Status
                  <select
                    value={agendaFilters.situacaoAgendamento}
                    onChange={(event) =>
                      setAgendaFilters({ ...agendaFilters, situacaoAgendamento: event.target.value })
                    }
                  >
                    <option value="">Todas</option>
                    <option value="Serviço Técnico">Serviço Técnico</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Garantia">Garantia</option>
                  </select>
                </label>

                <div className="button-row">
                  <button className="primary-button" type="submit">
                    Filtrar
                  </button>
                  <button className="secondary-button" onClick={clearAgendaFilters} type="button">
                    Limpar
                  </button>
                </div>
              </form>

              {agendaError ? <p className="error-text">{agendaError}</p> : null}
              {loadingAgenda ? <p className="status-text">Carregando agenda...</p> : null}
              {!loadingAgenda && agendaRecords.length === 0 ? (
                <p className="status-text">Nenhum registro encontrado.</p>
              ) : null}

              <div className="record-list">
                {agendaRecords.map((record) => (
                  <article className="record-card report-card" key={record.id}>
                    <div>
                      <strong>{record.cliente}</strong>
                      <span>{record.data}</span>
                      <span>Situacao: {record.situacao_agendamento ?? "Nao informado"}</span>
                      {record.observacao ? <p>{record.observacao}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel report-panel">
              <div className="section-heading">
                <h2>Relatorio Diario</h2>
                <div className="button-row">
                  <button className="secondary-button" onClick={exportDiarioCsv} type="button">
                    Exportar CSV
                  </button>
                  <button className="secondary-button" onClick={exportDiarioPdf} type="button">
                    Exportar PDF
                  </button>
                </div>
              </div>

              <form className="filter-grid" onSubmit={handleDiarioFilter}>
                <label>
                  Data
                  <input
                    type="date"
                    value={diarioFilters.data}
                    onChange={(event) => setDiarioFilters({ ...diarioFilters, data: event.target.value })}
                  />
                </label>

                <label>
                  Inicio
                  <input
                    type="date"
                    value={diarioFilters.dataInicio}
                    onChange={(event) => setDiarioFilters({ ...diarioFilters, dataInicio: event.target.value })}
                  />
                </label>

                <label>
                  Fim
                  <input
                    type="date"
                    value={diarioFilters.dataFim}
                    onChange={(event) => setDiarioFilters({ ...diarioFilters, dataFim: event.target.value })}
                  />
                </label>

                <label>
                  Tecnico
                  <input
                    type="text"
                    value={diarioFilters.tecnico}
                    onChange={(event) => setDiarioFilters({ ...diarioFilters, tecnico: event.target.value })}
                  />
                </label>

                <label>
                  Situacao
                  <select
                    value={diarioFilters.situacaoAtendimento}
                    onChange={(event) =>
                      setDiarioFilters({ ...diarioFilters, situacaoAtendimento: event.target.value })
                    }
                  >
                    <option value="">Todas</option>
                    {statusAtendimento.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="button-row">
                  <button className="primary-button" type="submit">
                    Filtrar
                  </button>
                  <button className="secondary-button" onClick={clearDiarioFilters} type="button">
                    Limpar
                  </button>
                </div>
              </form>

              {diarioError ? <p className="error-text">{diarioError}</p> : null}
              {loadingDiario ? <p className="status-text">Carregando diario...</p> : null}
              {!loadingDiario && diarioRecords.length === 0 ? (
                <p className="status-text">Nenhum registro encontrado.</p>
              ) : null}

              <div className="record-list">
                {diarioRecords.map((record) => (
                  <article className="record-card report-card" key={record.id}>
                    <div>
                      <strong>{record.cliente}</strong>
                      <span>
                        {record.data} | {record.tecnico}
                      </span>
                      <span>Funcao: {record.funcao}</span>
                      <span>Status: {record.status_atendimento ?? "Nao informado"}</span>
                      <p>{record.servico_realizado}</p>
                      {record.observacao ? <p>{record.observacao}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            </article>
            </section>
          </PermissionGate>
        </AuthGate>
      </div>
    </main>
  );
}

function downloadCsv(filename: string, headers: string[], rows: Record<string, string>[]) {
  const csvRows = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(";"))
  ];

  const blob = new Blob([`\uFEFF${csvRows.join("\r\n")}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function agendaCsvRows(records: AgendaServico[]) {
  return records.map((record) => ({
    data: record.data,
    cliente: record.cliente,
    situacao_agendamento: record.situacao_agendamento ?? "",
    observacao: record.observacao ?? ""
  }));
}

function diarioCsvRows(records: DiarioReportRecord[]) {
  return records.map((record) => ({
    data: record.data,
    tecnico: record.tecnico,
    funcao: record.funcao,
    cliente: record.cliente,
    servico_realizado: record.servico_realizado,
    status_atendimento: record.status_atendimento ?? "",
    observacao: record.observacao ?? ""
  }));
}

function buildDiarioReportRows(
  diarios: DiarioOperacional[],
  movements: DiarioMovimentacao[],
  helpers: DiarioMovimentacaoAjudante[],
  funcionarios: Funcionario[],
  filters: DiarioFilters
): DiarioReportRecord[] {
  const funcionarioName = (funcionarioId: string) =>
    funcionarios.find((funcionario) => funcionario.id === funcionarioId)?.nome ?? funcionarioId;
  const technicianFilter = filters.tecnico.trim().toLowerCase();
  const matchesTechnicianFilter = (name: string) => !technicianFilter || name.toLowerCase().includes(technicianFilter);
  const matchesStatusFilter = (status: string | null) => !filters.situacaoAtendimento || status === filters.situacaoAtendimento;
  const helperRows = (movement: DiarioMovimentacao, base: Omit<DiarioReportRecord, "id" | "tecnico" | "funcao">) =>
    helpers
      .filter((helper) => helper.movimentacao_id === movement.id)
      .map((helper) => {
        const helperName = funcionarioName(helper.funcionario_id);

        return {
          ...base,
          id: `${movement.id}-${helper.funcionario_id}`,
          tecnico: helperName,
          funcao: "Ajudante da visita"
        };
      });

  const rowsFromMovements = movements.flatMap((movement) => {
    const diario = diarios.find((record) => record.id === movement.diario_id);

    if (!diario) {
      return [];
    }

    const principalStatus = diario.status_atendimento ?? null;
    const base = {
      data: movement.data,
      cliente: diario.cliente,
      servico_realizado: movement.servico_realizado,
      status_atendimento: principalStatus,
      observacao: movement.observacao
    };
    const rows = [
      {
        id: movement.id,
        ...base,
        tecnico: movement.tecnico,
        funcao: "Técnico da visita"
      },
      ...helperRows(movement, base)
    ];

    return rows.filter((record) => matchesTechnicianFilter(record.tecnico) && matchesStatusFilter(record.status_atendimento));
  });

  if (rowsFromMovements.length > 0) {
    return rowsFromMovements;
  }

  return diarios
    .filter((record) => legacyDiarioMatchesFilters(record, filters))
    .flatMap((record) => {
      const base = {
        data: record.data,
        cliente: record.cliente,
        servico_realizado: record.servico_realizado,
        status_atendimento: record.status_atendimento ?? record.situacao_atendimento ?? null,
        observacao: record.observacao
      };
      const rows = [
        {
          id: record.id,
          ...base,
          tecnico: record.tecnico,
          funcao: "Técnico principal"
        }
      ];

      return rows.filter((row) => matchesTechnicianFilter(row.tecnico) && matchesStatusFilter(row.status_atendimento));
    });
}

function legacyDiarioMatchesFilters(record: DiarioOperacional, filters: DiarioFilters) {
  if (filters.data && record.data !== filters.data) {
    return false;
  }

  if (!filters.data) {
    if (filters.dataInicio && record.data < filters.dataInicio) {
      return false;
    }

    if (filters.dataFim && record.data > filters.dataFim) {
      return false;
    }
  }

  if (filters.situacaoAtendimento && record.status_atendimento !== filters.situacaoAtendimento) {
    return false;
  }

  return true;
}

function formatPeriod(filters: AgendaFilters) {
  if (filters.data) {
    return `Data: ${filters.data}`;
  }

  if (filters.dataInicio && filters.dataFim) {
    return `${filters.dataInicio} ate ${filters.dataFim}`;
  }

  if (filters.dataInicio) {
    return `A partir de ${filters.dataInicio}`;
  }

  if (filters.dataFim) {
    return `Ate ${filters.dataFim}`;
  }

  return "Todos";
}

function printPdfReport({
  title,
  period,
  tecnico,
  rows
}: {
  title: string;
  period: string;
  tecnico?: string;
  rows: Array<{
    data: string;
    tecnico?: string;
    funcao?: string;
    cliente: string;
    servico: string;
    status: string;
    observacao: string;
  }>;
}) {
  const reportWindow = window.open("", "_blank", "width=900,height=700");

  if (!reportWindow) {
    window.alert("Permita pop-ups para exportar o PDF.");
    return;
  }

  const rowsHtml = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.data)}</td>
              <td>${escapeHtml(row.tecnico ?? "")}</td>
              <td>${escapeHtml(row.funcao ?? "")}</td>
              <td>${escapeHtml(row.cliente)}</td>
              <td>${escapeHtml(row.servico)}</td>
              <td>${escapeHtml(row.status)}</td>
              <td>${escapeHtml(row.observacao)}</td>
            </tr>
          `
        )
        .join("")
    : '<tr><td colspan="7">Nenhum registro encontrado.</td></tr>';

  reportWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
            margin: 32px;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 24px;
          }

          p {
            margin: 4px 0;
          }

          table {
            border-collapse: collapse;
            margin-top: 20px;
            width: 100%;
          }

          th,
          td {
            border: 1px solid #d8dee8;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }

          th {
            background: #f7f8fa;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p><strong>Periodo filtrado:</strong> ${escapeHtml(period)}</p>
        ${tecnico ? `<p><strong>Tecnico filtrado:</strong> ${escapeHtml(tecnico)}</p>` : ""}
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tecnico</th>
              <th>Funcao</th>
              <th>Cliente</th>
              <th>Servico</th>
              <th>Status</th>
              <th>Observacao</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countSituations<T extends Record<string, unknown>>(
  records: T[],
  labels: string[],
  field: keyof T
) {
  return labels.reduce<Record<string, number>>((accumulator, label) => {
    accumulator[label] = records.filter((record) => record[field] === label).length;
    return accumulator;
  }, {});
}
