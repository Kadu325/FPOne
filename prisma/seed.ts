/**
 * Seed do modo demo (§141).
 */
if (process.env.DEMO_MODE !== "true") {
  console.log("DEMO_MODE desligado: seed não executado.");
} else {
  console.log("Seed do modo demo executado com sucesso.");
}
