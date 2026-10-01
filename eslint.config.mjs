import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // Proíbe eslint-disable em linha (CLAUDE.md: sem atalhos).
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": true, "ts-expect-error": "allow-with-description" }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^(ONE Intranet|ONE|Digital Workplace|FPOne Digital Workplace)$/]",
          message: "Use APP_NAME (FPOne Intranet). Ver §181.",
        },
      ],
    },
  },
  {
    // Mocks/fixtures só entram via service layer (CLAUDE.md).
    files: ["src/components/**", "src/app/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/mocks/*", "@/fixtures/*", "**/mocks/**", "**/fixtures/**"] }],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "_atualizacao*/**",
      "docs/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
