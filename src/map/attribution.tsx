import type { ReactNode } from "react"

/**
 * Renders style attribution strings, which are HTML. Only text and http(s) links
 * survive; a style can't inject other markup into the Studio.
 */
export function Attribution({ html }: { html: string[] }): ReactNode {
  if (!html.length || typeof DOMParser === "undefined")
    return null
  const parser = new DOMParser()
  return html.map((item, index) => (
    // eslint-disable-next-line react/no-array-index-key -- the strings are static per style
    <span key={index}>
      {index > 0 && " "}
      {toReact(parser.parseFromString(item, "text/html").body)}
    </span>
  ))
}

// Elements whose text isn't meant to be read.
const HIDDEN_CONTENT = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"])

function toReact(node: Node): ReactNode {
  return [...node.childNodes].map((child, index) => {
    if (child.nodeType === Node.TEXT_NODE)
      return child.textContent
    if (!(child instanceof Element) || HIDDEN_CONTENT.has(child.tagName))
      return null
    const href = child.tagName === "A" ? child.getAttribute("href") : null
    if (href && /^https?:\/\//i.test(href)) {
      return (
        // eslint-disable-next-line react/no-array-index-key -- static content
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
          {child.textContent}
        </a>
      )
    }
    // eslint-disable-next-line react/no-array-index-key -- static content
    return <span key={index}>{toReact(child)}</span>
  })
}
