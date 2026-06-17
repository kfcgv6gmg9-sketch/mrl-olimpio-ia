"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { PermissionGate } from "@/components/PermissionGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { logAudit } from "@/lib/audit";
import { canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { DespesaVeiculo, Funcionario, Veiculo } from "@/types/database";

const movementTypes = ["Abastecimento", "Manutenção", "Lavagem", "Pedágio", "Documentação", "Multa", "Outros"] as const;

type MovementType = (typeof movementTypes)[number];
type ExpenseType = DespesaVeiculo["tipo_despesa"];

type VehicleForm = {
  data: string;
  placa: string;
  veiculo: string;
  fornecedor: string;
  tipo_despesa: ExpenseType | "";
  tecnico_responsavel: string;
  valor: string;
  quilometragem: string;
  descricao: string;
  observacao: string;
};

type VehicleFilters = {
  placa: string;
  fornecedor: string;
  dataInicio: string;
  dataFim: string;
  tipo_despesa: string;
  tecnico_responsavel: string;
};

type PlateForm = {
  placa: string;
  veiculo: string;
};

type VehicleReportRow = DespesaVeiculo & {
  veiculo_visual: string;
};

const initialForm: VehicleForm = {
  data: "",
  placa: "",
  veiculo: "",
  fornecedor: "",
  tipo_despesa: "",
  tecnico_responsavel: "",
  valor: "",
  quilometragem: "",
  descricao: "",
  observacao: ""
};

const initialFilters: VehicleFilters = {
  placa: "",
  fornecedor: "",
  dataInicio: "",
  dataFim: "",
  tipo_despesa: "",
  tecnico_responsavel: ""
};

const initialPlateForm: PlateForm = {
  placa: "",
  veiculo: ""
};

export default function VeiculosPage() {
  const [records, setRecords] = useState<DespesaVeiculo[]>([]);
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [plateForm, setPlateForm] = useState<PlateForm>(initialPlateForm);
  const [filters, setFilters] = useState<VehicleFilters>(initialFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPlate, setSavingPlate] = useState(false);
  const [showPlateForm, setShowPlateForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { email, loading: accessLoading, metadata } = useCurrentAccess();
  const canAccessVeiculos = canAccessModule(email, metadata, "veiculos");

  const loadVehicles = useCallback(async () => {
    const { data, error: vehicleError } = await supabase
      .from("veiculos")
      .select("id,placa,modelo,ativo,created_at")
      .eq("ativo", true)
      .order("placa", { ascending: true });

    if (vehicleError) {
      setError(vehicleError.message);
      return;
    }

    setVehicles((data ?? []) as Veiculo[]);
  }, []);

  const loadFuncionarios = useCallback(async () => {
    const { data, error: funcionariosError } = await supabase
      .from("funcionarios")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (funcionariosError) {
      setError(funcionariosError.message);
      return;
    }

    setFuncionarios((data ?? []) as Funcionario[]);
  }, []);

  const loadRecords = useCallback(async (currentFilters: VehicleFilters) => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("despesas_veiculos")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (currentFilters.placa.trim()) {
      query = query.eq("placa", currentFilters.placa.trim());
    }

    if (currentFilters.fornecedor.trim()) {
      query = query.ilike("fornecedor", `%${currentFilters.fornecedor.trim()}%`);
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

    if (currentFilters.tecnico_responsavel) {
      query = query.eq("tecnico_responsavel", currentFilters.tecnico_responsavel);
    }

    const { data, error: listError } = await query;

    if (listError) {
      setError(listError.message);
    } else {
      setRecords((data ?? []) as DespesaVeiculo[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!accessLoading && canAccessVeiculos) {
      loadRecords(initialFilters);
      loadVehicles();
      loadFuncionarios();
    }
  }, [accessLoading, canAccessVeiculos, loadFuncionarios, loadRecords, loadVehicles]);

  const totals = useMemo(() => {
    const initialTotals = movementTypes.reduce<Record<MovementType, number>>((accumulator, type) => {
      accumulator[type] = 0;
      return accumulator;
    }, {} as Record<MovementType, number>);

    return records.reduce(
      (accumulator, record) => {
        if (record.tipo_despesa in accumulator.byType) {
          accumulator.byType[record.tipo_despesa as MovementType] += Number(record.valor);
        }
        accumulator.total += Number(record.valor);
        return accumulator;
      },
      { byType: initialTotals, total: 0 }
    );
  }, [records]);

  function getVehicleNameByPlate(plate: string) {
    const vehicle = vehicles.find((item) => item.placa === plate);
    return vehicle ? vehicleName(vehicle) : "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      data: form.data,
      placa: form.placa.trim().toUpperCase(),
      fornecedor: form.fornecedor.trim() || null,
      tipo_despesa: form.tipo_despesa,
      tecnico_responsavel: form.tipo_despesa === "Multa" ? form.tecnico_responsavel.trim() : null,
      valor: Number(form.valor),
      quilometragem: form.quilometragem ? Number(form.quilometragem) : null,
      descricao: form.descricao.trim() || null,
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
      setMessage(editingId ? "Movimentação atualizada." : "Movimentação salva.");
      await loadRecords(filters);
    }

    setSaving(false);
  }

  function handleVehicleSelection(plate: string) {
    setForm({
      ...form,
      placa: plate,
      veiculo: getVehicleNameByPlate(plate)
    });
  }

  async function handleCreatePlate() {
    const placa = plateForm.placa.trim().toUpperCase();
    const veiculo = plateForm.veiculo.trim();

    if (!placa || !veiculo) {
      setError("Informe a placa e o veÃ­culo.");
      return;
    }

    setSavingPlate(true);
    setMessage("");
    setError("");

    const { data, error: insertError } = await supabase
      .from("veiculos")
      .insert({
        placa,
        modelo: veiculo,
        ativo: true
      })
      .select("id,placa,modelo,ativo,created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else {
      const newVehicle = data as Veiculo;
      setVehicles((currentVehicles) =>
        [...currentVehicles.filter((vehicle) => vehicle.placa !== newVehicle.placa), newVehicle].sort((left, right) =>
          left.placa.localeCompare(right.placa)
        )
      );
      setForm({ ...form, placa: newVehicle.placa, veiculo: vehicleName(newVehicle) });
      setPlateForm(initialPlateForm);
      setShowPlateForm(false);
      setMessage("Placa cadastrada.");
    }

    setSavingPlate(false);
  }

  function handleEdit(record: DespesaVeiculo) {
    setEditingId(record.id);
    setForm({
      data: record.data,
      placa: record.placa,
      veiculo: getVehicleNameByPlate(record.placa),
      fornecedor: vehicleSupplier(record),
      tipo_despesa: record.tipo_despesa,
      tecnico_responsavel: record.tecnico_responsavel ?? "",
      valor: String(record.valor),
      quilometragem: record.quilometragem ? String(record.quilometragem) : "",
      descricao: record.descricao ?? "",
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
    const confirmed = window.confirm("Excluir esta movimentação de veículo?");

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
      setMessage("Movimentação excluída.");
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
      "movimentacoes-veiculos.csv",
      [
        "data",
        "placa",
        "veiculo",
        "fornecedor",
        "tipo_despesa",
        "tecnico_responsavel",
        "valor",
        "quilometragem",
        "descricao",
        "observacao"
      ],
      records.map((record) => vehicleCsvRow(record, getVehicleNameByPlate(record.placa)))
    );
  }

  function exportReportByPlate() {
    printPdfReport({
      title: "Relatório por Placa",
      period: formatPeriod(filters),
      placa: filters.placa.trim() || "Todas",
      fornecedor: filters.fornecedor.trim() || "Todos",
      tipoDespesa: filters.tipo_despesa || "Todos",
      tecnicoResponsavel: filters.tecnico_responsavel.trim() || "Todos",
      rows: records.map((record) => ({ ...record, veiculo_visual: getVehicleNameByPlate(record.placa) }))
    });
  }

  function exportReportByPeriod() {
    printPdfReport({
      title: "Relatório por Período",
      period: formatPeriod(filters),
      placa: filters.placa.trim() || "Todas",
      fornecedor: filters.fornecedor.trim() || "Todos",
      tipoDespesa: filters.tipo_despesa || "Todos",
      tecnicoResponsavel: filters.tecnico_responsavel.trim() || "Todos",
      rows: records.map((record) => ({ ...record, veiculo_visual: getVehicleNameByPlate(record.placa) }))
    });
  }

  const formPlateIsLegacy = Boolean(form.placa) && !vehicles.some((vehicle) => vehicle.placa === form.placa);
  const filterPlateIsLegacy = Boolean(filters.placa) && !vehicles.some((vehicle) => vehicle.placa === filters.placa);
  const formTypeIsLegacy = Boolean(form.tipo_despesa) && !movementTypes.some((type) => type === form.tipo_despesa);

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <PermissionGate module="veiculos">
            <header className="topbar">
              <div className="brand">
                <h1>Veículos</h1>
                <p>Controle de despesas e movimentações de veículos.</p>
              </div>
              <AppNav />
            </header>

            <section className="metric-grid" aria-label="Resumo de movimentações">
              {movementTypes.map((type) => (
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
                <h2>{editingId ? "Editar movimentação" : "Nova movimentação"}</h2>

                <button className="secondary-button" onClick={() => setShowPlateForm((current) => !current)} type="button">
                  Adicionar placa
                </button>

                {showPlateForm ? (
                  <fieldset className="inline-fieldset">
                    <legend>Nova placa</legend>
                    <label>
                      Placa
                      <input
                        type="text"
                        value={plateForm.placa}
                        onChange={(event) => setPlateForm({ ...plateForm, placa: event.target.value })}
                      />
                    </label>
                    <label>
                      Veículo
                      <input
                        type="text"
                        value={plateForm.veiculo}
                        onChange={(event) => setPlateForm({ ...plateForm, veiculo: event.target.value })}
                      />
                    </label>
                    <div className="button-row">
                      <button className="primary-button" disabled={savingPlate} onClick={handleCreatePlate} type="button">
                        {savingPlate ? "Salvando..." : "Salvar placa"}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={savingPlate}
                        onClick={() => {
                          setShowPlateForm(false);
                          setPlateForm(initialPlateForm);
                        }}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  </fieldset>
                ) : null}

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
                  <select
                    required
                    value={form.placa}
                    onChange={(event) => handleVehicleSelection(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {formPlateIsLegacy ? (
                      <option value={form.placa}>
                        {form.placa} | {form.veiculo || "Registro antigo"}
                      </option>
                    ) : null}
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.placa}>
                        {vehicle.placa} | {vehicleName(vehicle)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Veículo
                  <input
                    readOnly
                    type="text"
                    value={form.veiculo}
                  />
                </label>

                <label>
                  Fornecedor
                  <input
                    type="text"
                    value={form.fornecedor}
                    onChange={(event) => setForm({ ...form, fornecedor: event.target.value })}
                  />
                </label>

                <label>
                  Tipo
                  <select
                    required
                    value={form.tipo_despesa}
                    onChange={(event) => {
                      const tipoDespesa = event.target.value as ExpenseType | "";
                      setForm({
                        ...form,
                        tipo_despesa: tipoDespesa,
                        tecnico_responsavel: tipoDespesa === "Multa" ? form.tecnico_responsavel : ""
                      });
                    }}
                  >
                    <option value="">Selecione</option>
                    {formTypeIsLegacy ? <option value={form.tipo_despesa}>{form.tipo_despesa}</option> : null}
                    {movementTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                {form.tipo_despesa === "Multa" ? (
                  <label>
                    Técnico responsável
                    <select
                      required
                      value={form.tecnico_responsavel}
                      onChange={(event) => setForm({ ...form, tecnico_responsavel: event.target.value })}
                    >
                      <option value="">Selecione</option>
                      {funcionarios.map((funcionario) => (
                        <option key={funcionario.id} value={funcionario.nome}>
                          {funcionario.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

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
                  Quilometragem
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={form.quilometragem}
                    onChange={(event) => setForm({ ...form, quilometragem: event.target.value })}
                  />
                </label>

                <label>
                  Descrição
                  <textarea
                    rows={3}
                    value={form.descricao}
                    onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                  />
                </label>

                <label>
                  Observações
                  <textarea
                    rows={3}
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
                  <h2>Movimentações cadastradas</h2>
                  <div className="button-row">
                    <button className="secondary-button" onClick={exportCsv} type="button">
                      Exportar CSV
                    </button>
                    <button className="secondary-button" onClick={exportReportByPlate} type="button">
                      Relatório por placa
                    </button>
                    <button className="secondary-button" onClick={exportReportByPeriod} type="button">
                      Relatório por período
                    </button>
                  </div>
                </div>

                <form className="filter-grid" onSubmit={handleFilter}>
                  <label>
                    Placa
                    <select
                      value={filters.placa}
                      onChange={(event) => setFilters({ ...filters, placa: event.target.value })}
                    >
                      <option value="">Todas</option>
                      {filterPlateIsLegacy ? <option value={filters.placa}>{filters.placa}</option> : null}
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.placa}>
                          {vehicle.placa} | {vehicleName(vehicle)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Fornecedor
                    <input
                      type="text"
                      value={filters.fornecedor}
                      onChange={(event) => setFilters({ ...filters, fornecedor: event.target.value })}
                    />
                  </label>

                  <label>
                    Início
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
                      {movementTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Técnico responsável
                    <select
                      value={filters.tecnico_responsavel}
                      onChange={(event) => setFilters({ ...filters, tecnico_responsavel: event.target.value })}
                    >
                      <option value="">Todos</option>
                      {funcionarios.map((funcionario) => (
                        <option key={funcionario.id} value={funcionario.nome}>
                          {funcionario.nome}
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

                {loading ? <p className="status-text">Carregando movimentações...</p> : null}
                {!loading && records.length === 0 ? (
                  <p className="status-text">Nenhuma movimentação cadastrada.</p>
                ) : null}

                <div className="record-list">
                  {records.map((record) => (
                    <article className="record-card" key={record.id}>
                      <div>
                        <strong>
                          {getVehicleNameByPlate(record.placa) || "Veiculo nao cadastrado"} | {record.placa}
                        </strong>
                        <span>
                          {record.data} | {record.tipo_despesa} | {formatCurrency(record.valor)}
                        </span>
                        <span>Fornecedor: {vehicleSupplier(record) || "Não informado"}</span>
                        {record.tipo_despesa === "Multa" ? (
                          <span>Técnico responsável: {record.tecnico_responsavel || "Não informado"}</span>
                        ) : null}
                        <span>Quilometragem: {formatMileage(record.quilometragem)}</span>
                        {record.descricao ? <p>{record.descricao}</p> : null}
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

function vehicleSupplier(record: DespesaVeiculo) {
  return record.fornecedor ?? record.motorista ?? "";
}

function vehicleName(vehicle: Veiculo) {
  return vehicle.veiculo ?? vehicle.modelo ?? "";
}

function vehicleCsvRow(record: DespesaVeiculo, veiculo: string) {
  return {
    data: record.data,
    placa: record.placa,
    veiculo,
    fornecedor: vehicleSupplier(record),
    tipo_despesa: record.tipo_despesa,
    tecnico_responsavel: record.tecnico_responsavel ?? "",
    valor: formatCurrency(record.valor),
    quilometragem: record.quilometragem ? String(record.quilometragem) : "",
    descricao: record.descricao ?? "",
    observacao: record.observacao ?? ""
  };
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatMileage(value: number | null) {
  return value === null ? "Não informado" : `${Number(value).toLocaleString("pt-BR")} km`;
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
  title,
  period,
  placa,
  fornecedor,
  tipoDespesa,
  tecnicoResponsavel,
  rows
}: {
  title: string;
  period: string;
  placa: string;
  fornecedor: string;
  tipoDespesa: string;
  tecnicoResponsavel: string;
  rows: VehicleReportRow[];
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
              <td>${escapeHtml(row.veiculo_visual)}</td>
              <td>${escapeHtml(vehicleSupplier(row))}</td>
              <td>${escapeHtml(row.tipo_despesa)}</td>
              <td>${escapeHtml(row.tipo_despesa === "Multa" ? `Técnico responsável: ${row.tecnico_responsavel ?? ""}` : "")}</td>
              <td>${escapeHtml(formatCurrency(row.valor))}</td>
              <td>${escapeHtml(formatMileage(row.quilometragem))}</td>
              <td>${escapeHtml(row.descricao ?? "")}</td>
              <td>${escapeHtml(row.observacao ?? "")}</td>
            </tr>
          `
        )
        .join("")
    : '<tr><td colspan="10">Nenhum registro encontrado.</td></tr>';

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
        <p><strong>Período filtrado:</strong> ${escapeHtml(period)}</p>
        <p><strong>Placa filtrada:</strong> ${escapeHtml(placa)}</p>
        <p><strong>Fornecedor filtrado:</strong> ${escapeHtml(fornecedor)}</p>
        <p><strong>Tipo:</strong> ${escapeHtml(tipoDespesa)}</p>
        <p><strong>Técnico responsável filtrado:</strong> ${escapeHtml(tecnicoResponsavel)}</p>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Placa</th>
              <th>Veículo</th>
              <th>Fornecedor</th>
              <th>Tipo</th>
              <th>Técnico responsável</th>
              <th>Valor</th>
              <th>Quilometragem</th>
              <th>Descrição</th>
              <th>Observações</th>
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
