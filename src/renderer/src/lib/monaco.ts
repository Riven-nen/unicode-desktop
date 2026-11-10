// Local Monaco setup for @monaco-editor/react.
//
// By default @monaco-editor/react downloads Monaco from a CDN at runtime,
// which the app's Content-Security-Policy (`script-src 'self'`) blocks — that
// left the editor stuck on "Loading…". Instead we bundle Monaco with the app
// (no network needed, works offline) and hand the local instance to the
// loader. Monaco's workers (diff computation, language services) are bundled
// as local chunks via Vite's `?worker` imports.
//
// Note: since monaco-editor 0.56 the package "exports" map no longer accepts
// the old `monaco-editor/esm/vs/...` deep imports, so workers must use the
// new short form (`monaco-editor/editor/editor.worker`).

import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

// Monaco runs diff computation and language services inside web workers. The
// CSP only allows same-origin scripts, so each worker is a bundled chunk.
// Languages used by the lab (Python, Java, C++, Markdown) are tokenized on
// the main thread and only need the shared editor worker.
globalThis.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  }
}

// Use the bundled Monaco instance instead of fetching one from the CDN.
loader.config({ monaco })
