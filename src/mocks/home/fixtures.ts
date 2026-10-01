import { zonedParts } from "@/modules/home/time";
import type { HomeData } from "@/modules/home/types";

/**
 * Dados fictícios da Home para o modo demo (§123–146, §187), baseados no protótipo 1.3.
 * Só entram via modules/home/service.ts com DEMO_MODE ligado; nunca importar em componente.
 * Datas relativas a `now` para a demonstração nunca "envelhecer".
 */

/** America/Bahia é UTC−3 fixo (sem horário de verão). */
const BAHIA_OFFSET_HOURS = 3;

function todayAt(now: Date, hour: number, minute: number): Date {
  const { year, month, day } = zonedParts(now);
  return new Date(Date.UTC(year, month - 1, day, hour + BAHIA_OFFSET_HOURS, minute));
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

function birthdayIn(now: Date, days: number): { day: number; month: number } {
  const { day, month } = zonedParts(new Date(now.getTime() + days * 86_400_000));
  return { day, month };
}

export function demoHomeData(now: Date): HomeData {
  return {
    announcements: [
      {
        id: "demo-com-1",
        title: "Nova Política de Compras e Suprimentos",
        summary: "A versão revisada entra em vigor no próximo mês. Todos os gestores devem realizar a leitura e confirmar ciência no portal.",
        category: "Governança",
        publishedAt: new Date(now.getTime() - 2 * 3_600_000),
        pinned: true,
        pendingAcknowledgement: true,
      },
      {
        id: "demo-com-2",
        title: "Boas-vindas aos novos colaboradores",
        summary: "Doze pessoas chegaram este mês às equipes de campo e da Matriz. Conheça quem está chegando.",
        category: "Cultura",
        publishedAt: daysAgo(now, 1),
        pinned: false,
        pendingAcknowledgement: false,
      },
      {
        id: "demo-com-3",
        title: "FP Nexus: nova etapa de implantação",
        summary: "Os painéis operacionais passam a cobrir também a Unidade Sul a partir da próxima semana.",
        category: "Tecnologia",
        publishedAt: daysAgo(now, 2),
        pinned: false,
        pendingAcknowledgement: false,
      },
    ],
    eventsToday: [
      { id: "demo-evt-1", title: "Reunião de resultados FP Nexus", location: "Sala Diretoria", startsAt: todayAt(now, 14, 30) },
      { id: "demo-evt-2", title: "Integração de novos colaboradores", location: "Auditório · Matriz", startsAt: todayAt(now, 16, 0) },
    ],
    birthdays: [
      { id: "demo-niv-1", name: "Ana Carolina Mendes", department: "Financeiro", unit: "Matriz", ...birthdayIn(now, 0) },
      { id: "demo-niv-2", name: "Rafael Souza Lima", department: "Logística", unit: "Unidade Sul", ...birthdayIn(now, 1) },
      { id: "demo-niv-3", name: "Juliana Lima Santos", department: "Pessoas & Cultura", unit: "Matriz", ...birthdayIn(now, 3) },
      { id: "demo-niv-4", name: "Bruno Martins", department: "Compras", unit: "Matriz", ...birthdayIn(now, 4) },
      { id: "demo-niv-5", name: "Carla Rocha", department: "Fiscal", unit: "Matriz", ...birthdayIn(now, 5) },
    ],
    links: [
      { id: "demo-lnk-1", label: "Sankhya", description: "ERP corporativo", href: null },
      { id: "demo-lnk-2", label: "FP Nexus", description: "Painel operacional", href: null },
      { id: "demo-lnk-3", label: "Chamados", description: "Suporte de TI", href: null },
      { id: "demo-lnk-4", label: "Portal RH", description: "Holerite e férias", href: null },
      { id: "demo-lnk-5", label: "E-mail", description: "Webmail", href: null },
      { id: "demo-lnk-6", label: "Treinamentos", description: "Trilhas e cursos", href: null },
    ],
    banners: [
      {
        id: "demo-ban-1",
        eyebrow: "Destaque da semana",
        title: "Programa Ideias que Transformam",
        body: "Envie uma sugestão para melhorar processos, reduzir custos ou simplificar a rotina. As melhores ideias serão apresentadas à Diretoria.",
        note: "Inscrições abertas",
      },
      {
        id: "demo-ban-2",
        eyebrow: "Campanha interna",
        title: "Semana da Segurança",
        body: "Treinamentos rápidos sobre segurança da informação e boas práticas digitais, em 4 sessões.",
        note: null,
      },
    ],
    news: [
      {
        id: "demo-nov-1",
        title: "Plantio da safra 2026/27 começa na próxima semana",
        summary: "As equipes de campo iniciam a operação nas unidades. O cronograma por área estará em Documentos.",
        category: "Empresa",
        publishedAt: now,
      },
      {
        id: "demo-nov-2",
        title: "Encontre quem cuida de cada assunto",
        summary: "A busca por responsabilidade vai mostrar com quem falar sobre fiscal, almoxarifado e outros temas.",
        category: "Sistemas",
        publishedAt: daysAgo(now, 1),
      },
      {
        id: "demo-nov-3",
        title: "Programa de estágio 2027 com inscrições abertas",
        summary: "Há vagas para Agronomia, TI e Administração. Indique talentos.",
        category: "Pessoas",
        publishedAt: daysAgo(now, 4),
      },
    ],
    documents: [
      { id: "demo-doc-1", title: "POP — Onboarding e Offboarding", area: "TI / RH", version: "2.0", updatedAt: now, isNew: true },
      { id: "demo-doc-2", title: "Política de Segurança da Informação", area: "TI", version: "2.1", updatedAt: now, isNew: true },
      { id: "demo-doc-3", title: "Política de Compras e Suprimentos", area: "Governança", version: "4.0", updatedAt: daysAgo(now, 1), isNew: false },
    ],
  };
}
