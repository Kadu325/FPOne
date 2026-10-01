import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks para módulos de servidor do Next.js
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  serverEnv: vi.fn(() => ({
    CPF_PEPPER: "0123456789abcdef0123456789abcdef",
  })),
}));

import { getCurrentUser } from "@/server/auth/session";
import { setActiveAction, setRolesAction } from "@/app/(app)/admin/colaboradores/actions";
import { publishAction, savePublicationAction } from "@/app/(app)/admin/publicacoes/actions";
import type { CurrentUser } from "@/server/auth/session";
import type { PublicationInput } from "@/modules/publications/schema";

describe("Proteção de Server Actions Administrativas contra Acessos Não Autorizados", () => {
  const employeeUser: CurrentUser = {
    id: "usr-emp-1",
    name: "Colaborador Comum",
    matricula: "FP001",
    roles: ["EMPLOYEE"],
  };

  const hrManagerUser: CurrentUser = {
    id: "usr-hr-1",
    name: "Gestor RH",
    matricula: "FP002",
    roles: ["HR_MANAGER"],
  };

  const commManagerUser: CurrentUser = {
    id: "usr-comm-1",
    name: "Gestor Comunicação",
    matricula: "FP003",
    roles: ["COMMUNICATION_MANAGER"],
  };

  const testTargetId = "11111111-1111-4111-8111-111111111111";

  const validPublicationInput: PublicationInput = {
    type: "ANNOUNCEMENT",
    title: "Comunicado de Teste",
    summary: "Resumo do comunicado",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Conteúdo" }] }] },
    categoryId: null,
    isFeatured: false,
    pinned: false,
    requiresAcknowledgement: false,
    audiences: [{ audienceType: "ALL", audienceId: null }],
    publishAt: "",
    expiresAt: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Tentativas de Execução por Usuário Anônimo (sem sessão)", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
    });

    it("bloqueia setActiveAction e retorna mensagem 'Faça login para continuar.'", async () => {
      const result = await setActiveAction(testTargetId, false);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Faça login para continuar.");
    });

    it("bloqueia setRolesAction e retorna mensagem 'Faça login para continuar.'", async () => {
      const result = await setRolesAction(testTargetId, ["ADMIN"]);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Faça login para continuar.");
    });

    it("bloqueia publishAction e retorna mensagem 'Faça login para continuar.'", async () => {
      const result = await publishAction(testTargetId);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Faça login para continuar.");
    });

    it("bloqueia savePublicationAction e retorna mensagem 'Faça login para continuar.'", async () => {
      const result = await savePublicationAction(null, validPublicationInput, false);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Faça login para continuar.");
    });
  });

  describe("2. Tentativas de Execução por Colaborador Comum (EMPLOYEE)", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(employeeUser);
    });

    it("bloqueia inativação/ativação de colaboradores (setActiveAction)", async () => {
      const result = await setActiveAction(testTargetId, false);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });

    it("bloqueia alteração de perfis de usuário (setRolesAction)", async () => {
      const result = await setRolesAction(testTargetId, ["ADMIN"]);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });

    it("bloqueia publicação de comunicados (publishAction)", async () => {
      const result = await publishAction(testTargetId);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });

    it("bloqueia criação e salvamento de rascunhos de comunicados (savePublicationAction)", async () => {
      const result = await savePublicationAction(null, validPublicationInput, false);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });
  });

  describe("3. Segregação de Funções entre HR_MANAGER e COMMUNICATION_MANAGER", () => {
    it("HR_MANAGER é bloqueado de publicar comunicados", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(hrManagerUser);
      const result = await publishAction(testTargetId);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });

    it("HR_MANAGER é bloqueado de gerenciar perfis de sistema (setRolesAction)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(hrManagerUser);
      const result = await setRolesAction(testTargetId, ["ADMIN"]);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });

    it("COMMUNICATION_MANAGER é bloqueado de inativar colaboradores", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(commManagerUser);
      const result = await setActiveAction(testTargetId, false);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });

    it("COMMUNICATION_MANAGER é bloqueado de alterar perfis de usuário", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(commManagerUser);
      const result = await setRolesAction(testTargetId, ["ADMIN"]);
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Você não tem permissão para esta ação.");
    });
  });
});
