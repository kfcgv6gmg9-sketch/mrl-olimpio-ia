"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { PermissionGate } from "@/components/PermissionGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { logAudit } from "@/lib/audit";
import { canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { DespesaVeiculo } from "@/types/database";

const expenseTypes = ["Combustível", "Pedágio", "Manutenção", "Pneus", "Outros"] as const;

type ExpenseType = (typeof expenseTypes)[number];

type VehicleForm = {
  data: string;
  placa: string;
  veiculo: string;
  tipo_despesa: ExpenseType | "";
  valor: string;
  observacao: string;
};

type VehicleFilters = {
  placa: string;
  veiculo: string;
  dataInicio: string;
  dataFim: string;
  tipo_despesa: string;
};

const initialForm: VehicleForm = {
  data: "",
  placa: "",
  veiculo: "",
  tipo_despesa: "",
  valor: "",
  observacao: ""
};

const initialFilters: VehicleFilters = {
  placa: "",
  veiculo: "",
  dataInicio: "",
  dataFim: "",
  tipo_despesa: ""
};

export default function VeiculosPage() {
  const [records, setRecords] = useState<DespesaVeiculo[]>([]);
  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [filters, setFilters] = useState<VehicleFilters>(initialFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { email, loading: accessLoading, metadata } = useCurrentAccess();
  const canAccessVeiculos = canAccessModule(email, metadata, "veiculos");

  const loadRecords = useCallback(async (currentFilters: VehicleFilters) => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("despesas_veiculos")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (currentFilters.placa.trim()) {
      query = query.ilike("placa", `%${currentFilters.placa.trim()}%`);
    }

    if (currentFilters.veiculo.trim()) {
      query = query.ilike("veiculo", `%${currentFilters.veiculo.trim()}%`);
    }

    if (currentFilters.dataInicio) {
      query = query.gte("data", currentFilters.dataInicio);
    }

    if (currentFilters.dataFim) {
      query = query.lte("data", currentFilters.dataFim);
    }

    if (currentFilters.tipo_despesa) {
      query = query.eq("tipo_despesa", currentFilters.tipo_despesa);
    }

    const { data, error: listError } = await query;

    if (listError) {
      setError(listError.message);
    } else {
      setRecords(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!accessLoading && canAccessVeiculos) {
      loadRecords(initialFilters);
    }
  }, [accessLoading, canAccessVeiculos, loadRecords]);

  const totals = useMemo(() => {
    const initialTotals = expenseTypes.reduce<Record<ExpenseType, number>>((accumulator, type) => {
      accumulator[type] = 0;
      return accumulator;
    }, {} as Record<ExpenseType, number>);

    return records.reduce(
      (accumulator, record) => {
        accumulator.byType[record.tipo_despesa] += Number(record.valor);
        accumulator.total += Number(record.valor);
        return accumulator;
      },
      { byType: initialTotals, total: 0 }
    );
  }, [records]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      data: form.data,
      placa: form.placa.trim().toUpperCase(),
      veiculo: form.veiculo.trim(),
      tipo_despesa: form.tipo_despesa,
      valor: Number(form.valor),
      observacao: form.observacao.trim() || null
    };

    const response = editingId
      ? await supabase.from("despesas_veiculos").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("despesas_veiculos").insert(payload).select("id").single();

    if (response.error) {
      setError(response.error.message);
    } else {
      await logAudit({
        modulo: "Veículos",
        acao: editingId ? "Editar" : "Criar",
        registro_afetado: response.data?.id ?? editingId ?? payload.placa
      });
      setForm(initialForm);
      setEditingId(null);
      setMessage(editingId ? "Despesa atualizada." : "Despesa salva.");
      await loadRecords(filters);
    }

    setSaving(false);
  }

  function handleEdit(record: DespesaVeiculo) {
    setEditingId(record.id);
    setForm({
      data: record.data,
      placa: record.placa,
      veiculo: record.veiculo,
      tipo_despesa: record.tipo_despesa,
      valor: String(record.valor),
      observacao: record.observacao ?? ""
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
    const confirmed = window.confirm("Excluir esta despesa de veiculo?");

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("despesas_veiculos").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      await logAudit({
        modulo: "Veículos",
        acao: "Excluir",
        registro_afetado: id
      });
      setMessage("Despesa excluida.");
      await loadRecords(filters);
    }
  }

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadRecords(filters);
  }

  function clearFilters() {
    setFilters(initialFilters);
    loadRecords(initialFilters);
  }

  function exportCsv() {
    downloadCsv(
      "despesas-veiculos.csv",
      ["data", "placa", "veiculo", "tipo_despesa", "valor", "observacao"],
      records.map((record) => ({
        data: record.data,
        placa: record.placa,
        veiculo: record.veiculo,
        tipo_despesa: record.tipo_despesa,
        valor: formatCurrency(record.valor),
        observacao: record.observacao ?? ""
      }))
    );
  }

  function exportPdf() {
    printPdfReport({
      period: formatPeriod(filters),
      placa: filters.placa.trim() || "Todas",
      veiculo: filters.veiculo.trim() || "Todos",
      tipoDespesa: filters.tipo_despesa || "Todos",
      rows: records
    });
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <PermissionGate module="veiculos">
            <header className="topbar">
              <div className="brand">
                <h1>Veiculos</h1>
                <p>Controle de despesas operacionais por veiculo.</p>
              </div>
              <AppNav />
            </header>

            <section className="metric-grid" aria-label="Dashboard de despesas">
            {expenseTypes.map((type) => (
              <article className="metric-card" key={type}>
                <span>Total {type}</span>
                <strong>{formatCurrency(totals.byType[type])}</strong>
              </article>
            ))}
            <article className="metric-card">
              <span>Total Geral</span>
              <strong>{formatCurrency(totals.total)}</strong>
            </article>
            </section>

            <section className="work-layout">
            <form className="panel form-grid" onSubmit={handleSubmit}>
              <h2>{editingId ? "Editar despesa" : "Nova despesa"}</h2>

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
                Placa
                <input
                  required
                  type="text"
                  value={form.placa}
                  onChange={(event) => setForm({ ...form, placa: event.target.value })}
                />
              </label>

              <label>
                Veiculo
                <input
                  required
                  type="text"
                  value={form.veiculo}
                  onChange={(event) => setForm({ ...form, veiculo: event.target.value })}
                />
              </label>

              <label>
                Tipo de Despesa
                <select
                  required
                  value={form.tipo_despesa}
                  onChange={(event) => setForm({ ...form, tipo_despesa: event.target.value as ExpenseType | "" })}
                >
                  <option value="">Selecione</option>
                  {expenseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Valor
                <input
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={form.valor}
                  onChange={(event) => setForm({ ...form, valor: event.target.value })}
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

            <section className="panel report-panel">
              <div className="section-heading">
                <h2>Despesas cadastradas</h2>
                <div className="button-row">
                  <button className="secondary-button" onClick={exportCsv} type="button">
                    Exportar CSV
                  </button>
                  <button className="secondary-button" onClick={exportPdf} type="button">
                    Exportar PDF
                  </button>
                </div>
              </div>

              <form className="filter-grid" onSubmit={handleFilter}>
                <label>
                  Placa
                  <input
                    type="text"
                    value={filters.placa}
                    onChange={(event) => setFilters({ ...filters, placa: event.target.value })}
                  />
                </label>

                <label>
                  Veiculo
                  <input
                    type="text"
                    value={filters.veiculo}
                    onChange={(event) => setFilters({ ...filters, veiculo: event.target.value })}
                  />
                </label>

                <label>
                  Inicio
                  <input
                    type="date"
                    value={filters.dataInicio}
                    onChange={(event) => setFilters({ ...filters, dataInicio: event.target.value })}
                  />
                </label>

                <label>
                  Fim
                  <input
                    type="date"
                    value={filters.dataFim}
                    onChange={(event) => setFilters({ ...filters, dataFim: event.target.value })}
                  />
                </label>

                <label>
                  Tipo
                  <select
                    value={filters.tipo_despesa}
                    onChange={(event) => setFilters({ ...filters, tipo_despesa: event.target.value })}
                  >
                    <option value="">Todos</option>
                    {expenseTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="button-row">
                  <button className="primary-button" type="submit">
                    Filtrar
                  </button>
                  <button className="secondary-button" onClick={clearFilters} type="button">
                    Limpar
                  </button>
                </div>
              </form>

              {loading ? <p className="status-text">Carregando despesas...</p> : null}
              {!loading && records.length === 0 ? <p className="status-text">Nenhuma despesa cadastrada.</p> : null}

              <div className="record-list">
                {records.map((record) => (
                  <article className="record-card" key={record.id}>
                    <div>
                      <strong>
                        {record.veiculo} | {record.placa}
                      </strong>
                      <span>
                        {record.data} | {record.tipo_despesa} | {formatCurrency(record.valor)}
                      </span>
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
          </PermissionGate>
        </AuthGate>
      </div>
    </main>
  );
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
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

function formatPeriod(filters: VehicleFilters) {
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
  period,
  placa,
  veiculo,
  tipoDespesa,
  rows
}: {
  period: string;
  placa: string;
  veiculo: string;
  tipoDespesa: string;
  rows: DespesaVeiculo[];
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
              <td>${escapeHtml(row.placa)}</td>
              <td>${escapeHtml(row.veiculo)}</td>
              <td>${escapeHtml(row.tipo_despesa)}</td>
              <td>${escapeHtml(formatCurrency(row.valor))}</td>
              <td>${escapeHtml(row.observacao ?? "")}</td>
            </tr>
          `
        )
        .join("")
    : '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';

  reportWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatorio de Veiculos</title>
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
        <h1>Relatorio de Veiculos</h1>
        <p><strong>Periodo filtrado:</strong> ${escapeHtml(period)}</p>
        <p><strong>Placa filtrada:</strong> ${escapeHtml(placa)}</p>
        <p><strong>Veiculo filtrado:</strong> ${escapeHtml(veiculo)}</p>
        <p><strong>Tipo de despesa:</strong> ${escapeHtml(tipoDespesa)}</p>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Placa</th>
              <th>Veiculo</th>
              <th>Tipo de Despesa</th>
              <th>Valor</th>
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
