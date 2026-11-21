/** Local HTML preview served from a loopback-only temporary directory. */

export interface HtmlPreviewSession {
  id: string
  url: string
}

export interface HtmlPreviewFileInput {
  /** Absolute class folder to serve; relative assets are read from here. */
  root: string
  /** Absolute HTML file inside `root` that receives the live editor content. */
  filePath: string
  html: string
}

export interface HtmlPreviewApi {
  /** Writes the document to a fresh temp directory and serves it on 127.0.0.1. */
  start(html: string): Promise<HtmlPreviewSession>
  /** Serves a real class folder with the active HTML file overlaid live. */
  startFile(input: HtmlPreviewFileInput): Promise<HtmlPreviewSession>
  /** Replaces the document; the same session URL serves the new content. */
  update(id: string, html: string): Promise<HtmlPreviewSession>
  /** Stops the server and deletes the temporary directory, when it owns one. */
  stop(id: string): void
}
