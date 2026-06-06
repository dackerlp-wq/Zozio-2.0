import DOMPurify from "isomorphic-dompurify";

/** Bezpečné HTML pro renderování obsahu (články/příběhy) na veřejném profilu. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h2", "h3", "h4", "blockquote", "img", "figure", "figcaption", "hr",
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i,
  });
}
