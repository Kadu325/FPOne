"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "@/app/login/actions";
import styles from "@/app/login/login.module.css";
import { ForgotPasswordDialog, type SupportInfo } from "./ForgotPasswordDialog";
import { AlertIcon, ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, LockIcon, UserIcon } from "./Icons";

/** "Lembrar de mim" guarda apenas o NOME DE USUÁRIO neste navegador — nunca a senha. */
const REMEMBER_KEY = "fpone:login:username";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submit} disabled={pending} aria-busy={pending}>
      <span>{pending ? "Entrando…" : "Entrar"}</span>
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : <ArrowRightIcon className={styles.submitIcon} />}
    </button>
  );
}

export function LoginForm({ callbackUrl, support }: { callbackUrl: string; support: SupportInfo }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    // Lido após a hidratação (localStorage não existe no servidor); setState fora do corpo do efeito.
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(REMEMBER_KEY);
        if (saved) {
          setUsername(saved);
          passwordRef.current?.focus();
        }
      } catch {
        /* armazenamento indisponível (modo privado etc.) */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (state.error) passwordRef.current?.focus();
  }, [state]);

  function onSubmit() {
    try {
      if (remember && username.trim()) localStorage.setItem(REMEMBER_KEY, username.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignorar */
    }
  }

  return (
    <div className={styles.card}>
      <span className={styles.cardAccent} aria-hidden="true" />

      <div className={styles.cardBody}>
        <h2 className={styles.welcome}>
          Seja <span className={styles.welcomeHighlight}>bem-vindo!</span>
        </h2>
        <p className={styles.welcomeSub}>Acesse sua conta para continuar.</p>
        <p className={styles.welcomeHint}>Use o mesmo usuário e senha do computador.</p>

        <form action={formAction} onSubmit={onSubmit} className={styles.form}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <label className={styles.field}>
            <span className={styles.srOnly}>Usuário de rede</span>
            <UserIcon className={styles.fieldIcon} />
            <input
              name="username"
              type="text"
              placeholder="Seu usuário"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={128}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-describedby={state.error ? errorId : undefined}
              aria-invalid={Boolean(state.error)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.srOnly}>Senha</span>
            <LockIcon className={styles.fieldIcon} />
            <input
              ref={passwordRef}
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              autoComplete="current-password"
              required
              maxLength={256}
              aria-describedby={state.error ? errorId : undefined}
              aria-invalid={Boolean(state.error)}
              onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onBlur={() => setCapsLock(false)}
            />
            <button
              type="button"
              className={styles.eye}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </label>

          {capsLock ? (
            <p className={styles.capsWarning} role="status">
              Caps Lock está ativado
            </p>
          ) : null}

          <div className={styles.errorSlot} aria-live="assertive">
            {state.error ? (
              <p id={errorId} className={styles.error} role="alert">
                <AlertIcon className={styles.errorIcon} />
                {state.error}
              </p>
            ) : null}
          </div>

          <div className={styles.row}>
            <label className={styles.remember}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className={styles.checkbox} aria-hidden="true">
                <CheckIcon />
              </span>
              Lembrar de mim
            </label>

            <button type="button" className={styles.forgot} onClick={() => setForgotOpen(true)}>
              Esqueceu sua senha?
            </button>
          </div>

          <SubmitButton />
        </form>
      </div>

      <footer className={styles.cardFooter}>
        <span className={styles.cardFooterBar} aria-hidden="true" />
        <span>ONE INTRANET</span>
      </footer>

      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} support={support} />
    </div>
  );
}
