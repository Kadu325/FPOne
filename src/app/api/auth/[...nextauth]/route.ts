import { handlers } from "@/auth";

export const runtime = "nodejs"; // ldapts precisa de net/tls do Node
export const { GET, POST } = handlers;
