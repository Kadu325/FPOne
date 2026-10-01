import type { Metadata } from "next";
import Image from "next/image";

import { APP_NAME } from "@/lib/constants";
import { LoginForm } from "@/components/login/LoginForm";
import { ChartIcon, GearIcon, LeafIcon, TeamIcon } from "@/components/login/Icons";
import { poppins } from "./fonts";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Entrar | FPOne Intranet",
  robots: { index: false, follow: false },
};

// Lê variáveis de ambiente em tempo de execução (não no build).
export const dynamic = "force-dynamic";

const PILLARS = [
  { Icon: ChartIcon, title: "Informação", subtitle: "em tempo real" },
  { Icon: TeamIcon, title: "Colaboração", subtitle: "entre equipes" },
  { Icon: GearIcon, title: "Processos", subtitle: "mais eficientes" },
  { Icon: LeafIcon, title: "Resultados", subtitle: "sustentáveis" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";

  const support = {
    glpiTicketUrl: process.env.GLPI_TICKET_URL || null,
    phone: process.env.IT_SUPPORT_PHONE || null,
    email: process.env.IT_SUPPORT_EMAIL || null,
  };

  const year = new Date().getFullYear();

  return (
    <main className={`${styles.page} ${poppins.variable}`}>
      <div className={styles.bgLayer} aria-hidden="true">
        <Image
          src="/login/login-bg.jpg"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className={styles.background}
        />
      </div>
      <div className={styles.bgShade} aria-hidden="true" />

      <section className={styles.brand} aria-label={APP_NAME}>
        <div className={styles.brandInner}>
          <h1 className={styles.srOnly}>FPOne Intranet</h1>
          <Image
            src="/brand/one-intranet-logo.png"
            alt={APP_NAME}
            width={900}
            height={332}
            priority
            className={styles.logo}
          />
          <p className={styles.tagline}>Conectando pessoas, processos e resultados</p>
          <span className={styles.taglineBar} aria-hidden="true" />

          <ul className={styles.pillars}>
            {PILLARS.map(({ Icon, title, subtitle }) => (
              <li key={title} className={styles.pillar}>
                <span className={styles.pillarBadge}>
                  <Icon className={styles.pillarIcon} />
                </span>
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.cardWrap}>
        <LoginForm callbackUrl={callbackUrl} support={support} />
      </section>

      <footer className={styles.pageFooter}>
        <span>© {year} Fazenda Progresso</span>
        <span aria-hidden="true">•</span>
        <span>Acesso exclusivo para colaboradores</span>
      </footer>
    </main>
  );
}
