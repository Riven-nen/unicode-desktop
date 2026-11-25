import { analyzePython } from './pythonAnalysis'
import { analyzeJava } from './javaAnalysis'
import { analyzeC, analyzeCpp } from './cppAnalysis'
import type { CodeAnalysis } from './codeAnalysis'

/**
 * Picks the local analyzer for a Monaco language id. Languages without a
 * bundled parser return null; Monaco's own tokenizer (and, for JavaScript,
 * its TypeScript worker) still handles highlighting and checks for those.
 */
export function analyzeSource(language: string, source: string): CodeAnalysis | null {
  switch (language) {
    case 'python':
      return analyzePython(source)
    case 'java':
      return analyzeJava(source)
    case 'c':
      return analyzeC(source)
    case 'cpp':
      return analyzeCpp(source)
    default:
      return null
  }
}

/** Languages with local parser diagnostics and an outline. */
export function isAnalyzedLanguage(language: string): boolean {
  return language === 'python' || language === 'java' || language === 'c' || language === 'cpp'
}
