"use client";

import { useEffect, useRef } from "react";
import styles from "@/app/login/login.module.css";
import { CloseIcon, MailIcon, PhoneIcon, TicketIcon } from "./Icons";

export interface SupportInfo {
  glpiTicketUrl: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * A senha é a mesma da rede (AD), então a intranet NÃO redefine senha.
 * O usuário é orientado a abrir chamado no GLPI e/ou procurar a TI.
 */
export function ForgotPasswordDialog({
  open,
  onClose,
  support,
}: {
  open: boolean;
  onClose: () => void;
  support: SupportInfo;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="forgot-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // clique fora fecha
      }}
    >
      <div className={styles.dialogBody}>
        <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </button>

        <h3 id="forgot-title" className={styles.dialogTitle}>
          Esqueceu sua senha?
        </h3>
        <p className={styles.dialogText}>
          Sua senha da intranet é a <strong>mesma usada para entrar no computador e na rede da empresa</strong>.
          Por segurança, ela só pode ser redefinida pela equipe de TI.
        </p>

        <div className={styles.dialogActions}>
          {support.glpiTicketUrl ? (
            <a className={styles.dialogPrimary} href={support.glpiTicketUrl} target="_blank" rel="noopener noreferrer">
              <TicketIcon />
              Abrir chamado no GLPI
            </a>
          ) : null}

          {support.phone ? (
            <a className={styles.dialogContact} href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>
              <PhoneIcon />
              {support.phone}
            </a>
          ) : null}

          {support.email ? (
            <a className={styles.dialogContact} href={`mailto:${support.email}?subject=Redefini%C3%A7%C3%A3o%20de%20senha%20de%20rede`}>
              <MailIcon />
              {support.email}
            </a>
          ) : null}

          {!support.glpiTicketUrl && !support.phone && !support.email ? (
            <p className={styles.dialogText}>Procure a equipe de TI da sua unidade.</p>
          ) : null}
        </div>

        <button type="button" className={styles.dialogSecondary} onClick={onClose}>
          Voltar ao login
        </button>
      </div>
    </dialog>
  );
}
