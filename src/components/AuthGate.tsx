"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { hasActiveSystemAccess } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { UserMetadata } from "@/types/users";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function applySession(currentSession: Session | null) {
      const metadata = currentSession?.user.user_metadata as UserMetadata | undefined;

      if (currentSession && !hasActiveSystemAccess(currentSession.user.email, metadata)) {
        setError("Usuario sem acesso ativo. Solicite acesso ao administrador.");
        await supabase.auth.signOut();
        setSession(null);
        return;
      }

      setSession(currentSession);
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      applySession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      setError(loginError.message);
    }

    setSubmitting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <p className="status-text">Carregando acesso...</p>;
  }

  if (!session) {
    return (
      <section className="panel auth-panel">
        <h1>Acesso ao MRL Gestão</h1>

        <form className="form-grid" onSubmit={handleLogin}>
          <label>
            E-mail
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Senha
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <>
      <div className="session-bar">
        <span>{session.user.email}</span>
        <button className="secondary-button" onClick={handleLogout} type="button">
          Sair
        </button>
      </div>
      {children}
    </>
  );
}
