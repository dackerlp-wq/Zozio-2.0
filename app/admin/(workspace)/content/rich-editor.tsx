"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Plnohodnotný WYSIWYG editor (Tiptap) pro články, příběhy a akce.
 * Pracovník neřeší žádné HTML — píše jako ve Wordu. Výstup `onChange` je HTML,
 * které se na serveru ještě bezpečně očistí (sanitizeHtml).
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  onImproveSelection,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Volitelné: vylepšit označený text přes AI. Vrací upravený prostý text. */
  onImproveSelection?: (text: string) => Promise<string | null>;
}) {
  const [improving, setImproving] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Začni psát…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] max-w-none px-4 py-3 text-[15px] leading-relaxed text-ink-800 focus:outline-none " +
          "[&_a]:font-semibold [&_a]:text-meadow-700 [&_a]:underline " +
          "[&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink-900 " +
          "[&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink-900 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-meadow-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 " +
          "[&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:my-0.5 " +
          "[&_hr]:my-4 [&_hr]:border-ink-900/10 [&_p]:my-2 " +
          "[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left " +
          "[&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-ink-400 " +
          "[&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Synchronizace zvenčí (např. po AI vygenerování celého článku).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "<p></p>";
    if (current !== next && next !== "") {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[320px] rounded-2xl border border-sand2 bg-warm" aria-hidden />
    );
  }

  async function improve() {
    if (!editor || !onImproveSelection) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ").trim();
    if (!text) {
      alert("Nejdřív označ text, který chceš vylepšit.");
      return;
    }
    setImproving(true);
    try {
      const improved = await onImproveSelection(text);
      if (improved) {
        editor.chain().focus().insertContentAt({ from, to }, improved).run();
      }
    } finally {
      setImproving(false);
    }
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Odkaz (URL):", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sand2 bg-warm focus-within:border-meadow-500">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-sand2 bg-cream px-2 py-1.5">
        <Tb onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Tučně">
          <Bold className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Kurzíva">
          <Italic className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Podtržení">
          <UnderlineIcon className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Přeškrtnutí">
          <Strikethrough className="size-4" />
        </Tb>
        <Sep />
        <Tb onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Nadpis">
          <Heading2 className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Podnadpis">
          <Heading3 className="size-4" />
        </Tb>
        <Sep />
        <Tb onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Odrážky">
          <List className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Číslovaný seznam">
          <ListOrdered className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citace">
          <Quote className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Oddělovač">
          <Minus className="size-4" />
        </Tb>
        <Sep />
        <Tb onClick={setLink} active={editor.isActive("link")} title="Odkaz">
          <LinkIcon className="size-4" />
        </Tb>
        <Sep />
        <Tb onClick={() => editor.chain().focus().undo().run()} title="Zpět">
          <Undo2 className="size-4" />
        </Tb>
        <Tb onClick={() => editor.chain().focus().redo().run()} title="Vpřed">
          <Redo2 className="size-4" />
        </Tb>
        {onImproveSelection && (
          <>
            <span className="ml-auto" />
            <button
              type="button"
              onClick={improve}
              disabled={improving}
              className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-50 px-3 py-1.5 text-xs font-bold text-meadow-700 hover:bg-meadow-100 disabled:opacity-50"
              title="Vylepšit označený text pomocí AI"
            >
              <Sparkles className="size-3.5" /> {improving ? "Vylepšuji…" : "Vylepšit výběr"}
            </button>
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function Tb({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-ink-600 hover:bg-cream-warm",
        active && "bg-meadow-500 text-cream hover:bg-meadow-600",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-sand2" />;
}

export type { Editor };
