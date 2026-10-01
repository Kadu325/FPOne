import type { ReactNode } from "react";
import { isSafeHref, type RichDoc, type RichMark, type RichNode } from "@/modules/publications/content";

/**
 * Renderiza o documento validado com elementos React: o texto é sempre escapado e não há
 * dangerouslySetInnerHTML. Usado na leitura e na pré-visualização (mesmo design, §67).
 */
export function RichContent({ doc }: { doc: RichDoc }) {
  return <div className="space-y-4 text-base leading-7 text-slate-700">{renderNodes(doc.content)}</div>;
}

function renderNodes(nodes: readonly RichNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, i) => renderNode(node, i));
}

function renderNode(node: RichNode, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return <span key={key}>{applyMarks(node.text, node.marks ?? [])}</span>;
    case "paragraph":
      return <p key={key}>{renderNodes(node.content)}</p>;
    case "heading":
      return node.attrs.level === 2 ? (
        <h2 key={key} className="pt-2 text-2xl font-extrabold text-brand-ink">
          {renderNodes(node.content)}
        </h2>
      ) : (
        <h3 key={key} className="pt-1 text-xl font-extrabold text-brand-ink">
          {renderNodes(node.content)}
        </h3>
      );
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-6">
          {renderNodes(node.content)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-6">
          {renderNodes(node.content)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderNodes(node.content)}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-brand-emerald/40 pl-4 italic text-slate-700">
          {renderNodes(node.content)}
        </blockquote>
      );
    case "horizontalRule":
      return <hr key={key} className="border-line" />;
    case "hardBreak":
      return <br key={key} />;
  }
}

function applyMarks(text: string, marks: readonly RichMark[]): ReactNode {
  return marks.reduce<ReactNode>((acc, mark) => {
    if (mark.type === "bold") return <strong className="font-extrabold">{acc}</strong>;
    if (mark.type === "italic") return <em>{acc}</em>;
    // Revalida na renderização: um link inseguro vira texto simples.
    return isSafeHref(mark.attrs.href) ? (
      <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue underline underline-offset-2">
        {acc}
      </a>
    ) : (
      acc
    );
  }, text);
}
