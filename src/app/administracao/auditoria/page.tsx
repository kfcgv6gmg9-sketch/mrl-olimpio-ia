"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { hasAdminAccess } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { Auditoria } from "@/types/database";
import { UserMetadata } from "@/types/users";

type AuditFilters = {
  dataInicio: string;
  dataFim: string;
  usuario: string;
  modulo: string;
};

const initialFilters: AuditFilters = {
  dataInicio: "",
  dataFim: "",
  usuario: "",
  modulo: ""
};

const auditModules = ["Agenda", "Diário", "Veículos", "Usuários"];

export default function AuditoriaPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<Auditoria[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const metadata = session?.user.user_metadata as UserMetadata | undefined;
  const isAdmin = hasAdminAccess(session?.user.email, metadata);

  const loadRecords = useCallback(async (currentFilters: AuditFilters) => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("auditoria")
      .select("*")
      .order("data", { ascending: false })
      .order("hora", { ascending: false })
      .order("created_at", { ascending: false });

    if (currentFilters.dataInicio) {
      query = query.gte("data", currentFilters.dataInicio);
    }

    if (currentFilters.dataFim) {
      query = query.lte("data", currentFilters.dataFim);
    }

    if (currentFilters.usuario.trim()) {
      query = query.ilike("usuario", `%${currentFilters.usuario.trim()}%`);
    }

    if (currentFilters.modulo) {
      query = query.eq("modulo", currentFilters.modulo);
    }

    const { data, error: listError } = await query;

    if (listError) {
      setError(listError.message);
      setRecords([]);
    } else {
      setRecords(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && isAdmin) {
      loadRecords(initialFilters);
    }
  }, [isAdmin, loadRecords, session]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadRecords(filters);
  }

  function clearFilters() {
    setFilters(initialFilters);
    loadRecords(initialFilters);
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <header className="topbar">
            <div className="brand">
              <h1>Auditoria</h1>
              <p>Historico de alteracoes realizadas no sistema.</p>
            </div>
            <nav className="nav" aria-label="Navegacao">
              <Link href="/">Inicio</Link>
              <Link href="/administracao/usuarios">Usuarios</Link>
            </nav>
          </header>

          {!isAdmin ? (
            <section className="panel">
              <p className="error-text">Acesso permitido apenas para Administrador.</p>
            </section>
          ) : (
            <section className="panel report-panel">
              <form className="filter-grid" onSubmit={handleFilter}>
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
                  Usuario
                  <input
                    type="text"
                    value={filters.usuario}
                    onChange={(event) => setFilters({ ...filters, usuario: event.target.value })}
                  />
                </label>

                <label>
                  Modulo
                  <select
                    value={filters.modulo}
                    onChange={(event) => setFilters({ ...filters, modulo: event.target.value })}
                  >
                    <option value="">Todos</option>
                    {auditModules.map((module) => (
                      <option key={module} value={module}>
                        {module}
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

              {error ? <p className="error-text">{error}</p> : null}
              {loading ? <p className="status-text">Carregando auditoria...</p> : null}
              {!loading && records.length === 0 ? <p className="status-text">Nenhum registro encontrado.</p> : null}

              <div className="record-list">
                {records.map((record) => (
                  <article className="record-card report-card" key={record.id}>
                    <div>
                      <strong>
                        {record.modulo} | {record.acao}
                      </strong>
                      <span>
                        {record.data} | {record.hora} | {record.usuario}
                      </span>
                      <span>Registro afetado: {record.registro_afetado}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </AuthGate>
      </div>
    </main>
  );
}
