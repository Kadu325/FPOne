/**
 * Dados da Home 1.3 (§185). Cada bloco é uma lista; lista vazia = estado vazio (RN-HOME-006).
 * Os módulos de origem (Comunicados, Agenda, Documentos, Links, Banners) entram nas Fases 5–6
 * e passam a alimentar estes mesmos tipos via service layer.
 */

export interface HomeAnnouncement {
  id: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: Date;
  pinned: boolean;
  /** Exige "Li e estou ciente" e o usuário ainda não confirmou. */
  pendingAcknowledgement: boolean;
}

export interface HomeEvent {
  id: string;
  title: string;
  location: string;
  startsAt: Date;
}

export interface HomeBirthday {
  id: string;
  name: string;
  department: string;
  unit: string;
  /** Só dia e mês (LGPD): o ano nunca chega à tela. */
  day: number;
  month: number;
}

export interface HomeLink {
  id: string;
  label: string;
  description: string;
  /** null = link sem destino configurado (ex.: modo demo); renderizado sem âncora. */
  href: string | null;
  /** Abre em nova aba (destino fora da intranet). */
  external?: boolean;
}

export interface HomeBanner {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  note: string | null;
}

export interface HomeNews {
  id: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: Date;
}

export interface HomeDocument {
  id: string;
  title: string;
  area: string;
  version: string;
  updatedAt: Date;
  isNew: boolean;
}

export interface HomeData {
  announcements: HomeAnnouncement[];
  eventsToday: HomeEvent[];
  birthdays: HomeBirthday[];
  links: HomeLink[];
  banners: HomeBanner[];
  news: HomeNews[];
  documents: HomeDocument[];
}

export type MeuDiaItem =
  | { kind: "acknowledgement"; id: string; title: string }
  | { kind: "event"; id: string; title: string; location: string; startsAt: Date }
  | { kind: "documents"; count: number; titles: string[] };
