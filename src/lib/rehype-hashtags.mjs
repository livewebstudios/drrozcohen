// Marks paragraphs that contain only hashtags (e.g. "#Connectifier #RadicalConnections")
// with class="post-hashtags" so they render as a muted line. Text stays verbatim, not links.
const text = (node) => (node.type === 'text' ? node.value : (node.children || []).map(text).join(''));

export function rehypeHashtags() {
  return (tree) => {
    const visit = (node) => {
      for (const child of node.children || []) {
        if (child.type === 'element' && child.tagName === 'p') {
          const t = text(child).trim();
          if (t && /^(#[\p{L}\p{N}_]+[\s]*)+$/u.test(t)) {
            child.properties = { ...(child.properties || {}), className: ['post-hashtags'] };
          }
        } else visit(child);
      }
    };
    visit(tree);
  };
}
