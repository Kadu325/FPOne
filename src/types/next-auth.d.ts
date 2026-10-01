import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    username: string;
    department?: string | null;
    jobTitle?: string | null;
    groups?: string[];
    /** Id do usuário local (banco) vinculado à conta do AD ou login local. */
    uid?: string;
    sessionVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      matricula: string;
      roles: Role[];
      username: string;
      department: string | null;
      jobTitle: string | null;
      groups: string[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    sv?: number;
    name?: string | null;
    matricula?: string;
    roles?: Role[];
    username?: string;
    department?: string | null;
    title?: string | null;
    groups?: string[];
  }
}
