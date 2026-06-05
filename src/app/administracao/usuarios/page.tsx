"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { ManagedUser, UserProfile, UserMetadata, userProfiles } from "@/types/users";

type CreateForm = {
  email: string;
  password: string;
  nome: string;
  perfil: UserProfile;
  ativo: boolean;
};

type EditForm = {
  nome: string;
  perfil: UserProfile;
  ativo: boolean;
};

const initialCreateForm: CreateForm = {
  email: "",
  password: "",
  nome: "",
  perfil: "Técnico",
  ativo: true
};

const initialEditForm: EditForm = {
  nome: "",
  perfil: "Técnico",
  ativo: true
};

export default function UsuariosPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [createForm, setCreateForm] = useState<CreateForm>(initialCreateForm);
  const [editForm, setEditForm] = useState<EditForm>(initialEditForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const metadata = session?.user.user_metadata as UserMetadata | undefined;
  const isAdmin = metadata?.perfil === "Administrador" && metadata.ativo !== false;

  const authHeaders = useCallback((): Record<string, string> => {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, [session]);

  const loadUsers = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/users", {
      headers: authHeaders()
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel carregar usuarios.");
      setUsers([]);
    } else {
      setUsers(payload.users ?? []);
    }

    setLoading(false);
  }, [authHeaders, session]);

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
      loadUsers();
    }
  }, [isAdmin, loadUsers, session]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(createForm)
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel criar usuario.");
    } else {
      setCreateForm(initialCreateForm);
      setMessage("Usuario criado.");
      await loadUsers();
    }

    setSaving(false);
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    const response = await fetch(`/api/admin/users/${editingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(editForm)
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar usuario.");
    } else {
      setEditingId(null);
      setEditForm(initialEditForm);
      setMessage("Usuario atualizado.");
      await loadUsers();
    }

    setSaving(false);
  }

  function handleEdit(user: ManagedUser) {
    setEditingId(user.id);
    setEditForm({
      nome: user.nome,
      perfil: user.perfil || "Técnico",
      ativo: user.ativo
    });
    setMessage("");
    setError("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm(initialEditForm);
    setMessage("");
    setError("");
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <header className="topbar">
            <div className="brand">
              <h1>Usuários</h1>
              <p>Administração de acessos do Supabase.</p>
            </div>
            <nav className="nav" aria-label="Navegacao">
              <Link href="/">Inicio</Link>
              <Link href="/administracao/auditoria">Auditoria</Link>
              <Link href="/agenda">Agenda</Link>
              <Link href="/diario">Diario</Link>
            </nav>
          </header>

          {!isAdmin ? (
            <section className="panel">
              <p className="error-text">Acesso permitido apenas para Administrador.</p>
            </section>
          ) : (
            <section className="work-layout">
              <div className="panel form-grid">
                <form className="form-grid" onSubmit={handleCreate}>
                  <h2>Novo usuário</h2>

                  <label>
                    Nome
                    <input
                      required
                      type="text"
                      value={createForm.nome}
                      onChange={(event) => setCreateForm({ ...createForm, nome: event.target.value })}
                    />
                  </label>

                  <label>
                    E-mail
                    <input
                      autoComplete="off"
                      required
                      type="email"
                      value={createForm.email}
                      onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                    />
                  </label>

                  <label>
                    Senha inicial
                    <input
                      autoComplete="new-password"
                      required
                      minLength={6}
                      type="password"
                      value={createForm.password}
                      onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
                    />
                  </label>

                  <label>
                    Perfil
                    <select
                      required
                      value={createForm.perfil}
                      onChange={(event) =>
                        setCreateForm({ ...createForm, perfil: event.target.value as UserProfile })
                      }
                    >
                      {userProfiles.map((profile) => (
                        <option key={profile} value={profile}>
                          {profile}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="checkbox-label">
                    <input
                      checked={createForm.ativo}
                      type="checkbox"
                      onChange={(event) => setCreateForm({ ...createForm, ativo: event.target.checked })}
                    />
                    Ativo
                  </label>

                  <button className="primary-button" disabled={saving} type="submit">
                    {saving ? "Salvando..." : "Criar usuário"}
                  </button>
                </form>

                {editingId ? (
                  <form className="form-grid" onSubmit={handleUpdate}>
                    <h2>Editar usuário</h2>

                    <label>
                      Nome
                      <input
                        required
                        type="text"
                        value={editForm.nome}
                        onChange={(event) => setEditForm({ ...editForm, nome: event.target.value })}
                      />
                    </label>

                    <label>
                      Perfil
                      <select
                        required
                        value={editForm.perfil}
                        onChange={(event) => setEditForm({ ...editForm, perfil: event.target.value as UserProfile })}
                      >
                        {userProfiles.map((profile) => (
                          <option key={profile} value={profile}>
                            {profile}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="checkbox-label">
                      <input
                        checked={editForm.ativo}
                        type="checkbox"
                        onChange={(event) => setEditForm({ ...editForm, ativo: event.target.checked })}
                      />
                      Ativo
                    </label>

                    <div className="button-row">
                      <button className="primary-button" disabled={saving} type="submit">
                        {saving ? "Salvando..." : "Atualizar"}
                      </button>
                      <button className="secondary-button" onClick={handleCancelEdit} type="button">
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>

              <section className="panel">
                <div className="section-heading">
                  <h2>Usuários cadastrados</h2>
                  <button className="secondary-button" onClick={loadUsers} type="button">
                    Atualizar
                  </button>
                </div>

                {error ? <p className="error-text">{error}</p> : null}
                {message ? <p className="success-text">{message}</p> : null}
                {loading ? <p className="status-text">Carregando usuários...</p> : null}
                {!loading && users.length === 0 ? <p className="status-text">Nenhum usuário encontrado.</p> : null}

                <div className="record-list">
                  {users.map((user) => (
                    <article className="record-card" key={user.id}>
                      <div>
                        <strong>{user.nome || user.email}</strong>
                        <span>{user.email}</span>
                        <span>Perfil: {user.perfil || "Nao informado"}</span>
                        <span>Status: {user.ativo ? "Ativo" : "Inativo"}</span>
                        <span>Criado em: {new Date(user.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="button-row">
                        <button className="secondary-button" onClick={() => handleEdit(user)} type="button">
                          Editar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          )}
        </AuthGate>
      </div>
    </main>
  );
}
