/** Minimal depth-aware OOXML tree. No external entities, relationships or executable content are evaluated. */
type Node = { tag: string; attrs: string; children: Node[]; text: string };
export function wordTree(xml: string) {
  const root: Node = { tag: "root", attrs: "", children: [], text: "" }; const stack = [root];
  for (const token of xml.match(/<[^>]*>|[^<]+/g) ?? []) {
    const current = stack[stack.length - 1]; if (!current) break;
    if (token.startsWith("</")) { if (stack.length > 1) stack.pop(); }
    else if (/^<[^!?/]/.test(token)) {
      const tag = token.match(/^<([^\s/>]+)/)?.[1]; if (!tag) continue;
      const node: Node = { tag, attrs: token, children: [], text: "" }; current.children.push(node);
      if (!token.endsWith("/>")) stack.push(node);
    } else if (!token.startsWith("<")) current.text += token;
  }
  return root;
}
export const children = (n: Node, tag: string) => n.children.filter(c => c.tag === tag);
export function descendants(n: Node, tag: string): Node[] { return n.children.flatMap(c => [...(c.tag === tag ? [c] : []), ...descendants(c, tag)]); }
export function wordText(n: Node): string { return (n.tag === "w:t" ? n.text : n.tag === "w:tab" ? "\t" : n.tag === "w:br" ? "\n" : n.children.filter(c => c.tag !== "w:tbl").map(wordText).join("")).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
export const val = (n: Node | undefined) => n?.attrs.match(/w:val=["']([^"']+)["']/)?.[1];