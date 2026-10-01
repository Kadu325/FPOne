"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Undo2, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { isSafeHref, type RichDoc } from "@/modules/publications/content";

/**
 * Editor TipTap (§63) só com os recursos do MVP: título, subtítulo, parágrafo, negrito, itálico,
 * listas, link, citação, divisor, desfazer/refazer. Imagem entra com o storage (Fase 6).
 * O servidor revalida o JSON; aqui só limitamos o que o editor consegue produzir.
 */
export function RichTextEditor({ initial, onChange, labelledBy }: { initial: RichDoc; onChange: (doc: RichDoc) => void; labelledBy: string }) {
  const helpId = useId();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", isAllowedUri: (url) => isSafeHref(url) },
      }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        "aria-describedby": helpId,
        class: "min-h-[280px] rounded-b-2xl px-4 py-3 text-base leading-7 text-slate-800 outline-none [&_h2]:text-2xl [&_h2]:font-extrabold [&_h3]:text-xl [&_h3]:font-extrabold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_a]:text-brand-blue [&_a]:underline [&_p]:my-2",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichDoc),
  });

  return (
    <div className="rounded-2xl border border-slate-300 bg-white focus-within:border-brand-blue">
      {editor ? <Toolbar editor={editor} /> : <div className="h-[52px] border-b border-slate-200" aria-hidden="true" />}
      <EditorContent editor={editor} />
      <p id={helpId} className="sr-only">
        Use a barra de ferramentas acima para formatar o texto. Atalhos: Ctrl+B negrito, Ctrl+I itálico, Ctrl+Z desfazer.
      </p>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link (https:// ou mailto:). Deixe vazio para remover.", current ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!isSafeHref(url.trim())) {
      window.alert("Link inválido: use um endereço que comece com https:// ou mailto:.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const buttons: { label: string; icon: LucideIcon; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { label: "Título", icon: Heading2, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Subtítulo", icon: Heading3, active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Negrito", icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Itálico", icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Lista", icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Lista numerada", icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Link", icon: Link2, active: state.link, run: setLink },
    { label: "Citação", icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Divisor", icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() },
    { label: "Desfazer", icon: Undo2, disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
    { label: "Refazer", icon: Redo2, disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatação" className="flex flex-wrap gap-1 border-b border-slate-200 p-2">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={b.run}
          disabled={b.disabled}
          aria-label={b.label}
          aria-pressed={b.active === undefined ? undefined : b.active}
          title={b.label}
          className={`grid h-9 w-9 place-items-center rounded-lg transition disabled:opacity-40 ${b.active ? "bg-brand-ink text-white" : "text-slate-700 hover:bg-slate-100"}`}
        >
          <b.icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
