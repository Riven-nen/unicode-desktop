import { describe, expect, it } from 'vitest'
import { analyzeJava } from './javaAnalysis'
import { analyzeC, analyzeCpp } from './cppAnalysis'
import { analyzeSource, isAnalyzedLanguage } from './sourceAnalysis'
import { languageFromName } from './languages'

const JAVA_SOURCE = [
  'package demo;',
  '',
  'import java.util.List;',
  '',
  'public class Greeter extends Base implements Runnable {',
  '    private static final int LIMIT = 10;',
  '    private final String name;',
  '',
  '    public Greeter(String name) {',
  '        this.name = name;',
  '    }',
  '',
  '    public void run() {',
  '        System.out.println(name);',
  '    }',
  '',
  '    public static int twice(int value) {',
  '        return value * 2;',
  '    }',
  '',
  '    interface Listener {',
  '        void onEvent(String message);',
  '    }',
  '',
  '    enum Kind { A, B }',
  '}',
  ''
].join('\n')

const CPP_SOURCE = [
  '#include <iostream>',
  '',
  'namespace demo {',
  '',
  'constexpr int LIMIT = 10;',
  '',
  'struct Point {',
  '    int x;',
  '    int y;',
  '    int sum() const { return x + y; }',
  '};',
  '',
  'class Greeter {',
  'public:',
  '    explicit Greeter(std::string name) : name_(std::move(name)) {}',
  '    void run() const { std::cout << name_; }',
  'private:',
  '    std::string name_;',
  '};',
  '',
  'int twice(int value) {',
  '    return value * 2;',
  '}',
  '',
  '} // namespace demo',
  '',
  'int main() {',
  '    demo::Greeter greeter("hi");',
  '    greeter.run();',
  '    return 0;',
  '}',
  ''
].join('\n')

describe('languageFromName', (): void => {
  it('maps Java and C++ source headers to Monaco languages', (): void => {
    expect(languageFromName('Main.java')).toBe('java')
    expect(languageFromName('solver.cpp')).toBe('cpp')
    expect(languageFromName('solver.cc')).toBe('cpp')
    expect(languageFromName('solver.cxx')).toBe('cpp')
    expect(languageFromName('solver.hpp')).toBe('cpp')
    expect(languageFromName('solver.h')).toBe('cpp')
  })
})

describe('analyzeSource', (): void => {
  it('dispatches each analyzed language and skips unsupported ones', (): void => {
    expect(isAnalyzedLanguage('python')).toBe(true)
    expect(isAnalyzedLanguage('java')).toBe(true)
    expect(isAnalyzedLanguage('c')).toBe(true)
    expect(isAnalyzedLanguage('cpp')).toBe(true)
    expect(isAnalyzedLanguage('markdown')).toBe(false)
    expect(analyzeSource('python', 'x = 1\n')).not.toBeNull()
    expect(analyzeSource('java', 'class A {}\n')).not.toBeNull()
    expect(analyzeSource('cpp', 'int main() { return 0; }\n')).not.toBeNull()
    expect(analyzeSource('markdown', '# Title\n')).toBeNull()
  })
})

describe('analyzeJava', (): void => {
  it('extracts classes, members, and no diagnostics from valid code', (): void => {
    const analysis = analyzeJava(JAVA_SOURCE)
    const names = analysis.symbols.map((symbol) => symbol.name)

    expect(analysis.diagnostics).toEqual([])
    expect(names).toContain('Greeter')
    expect(names).toContain('run')
    expect(names).toContain('twice')
    expect(names).toContain('Listener')
    expect(names).toContain('Kind')
    expect(names).toContain('LIMIT')
    expect(names).toContain('name')
    expect(analysis.symbols.find((symbol) => symbol.name === 'Greeter')?.kind).toBe('class')
    expect(analysis.symbols.find((symbol) => symbol.name === 'run')?.kind).toBe('method')
  })

  it('reports a Java syntax error', (): void => {
    const analysis = analyzeJava('public class Main {\n    void run( {\n}\n')

    expect(analysis.diagnostics.length).toBeGreaterThan(0)
    expect(analysis.diagnostics[0].message).toContain('Java')
  })
})

describe('analyzeCpp', (): void => {
  it('extracts namespaces, types, functions, and fields from valid code', (): void => {
    const analysis = analyzeCpp(CPP_SOURCE)
    const byName = new Map(analysis.symbols.map((symbol) => [symbol.name, symbol]))

    expect(analysis.diagnostics).toEqual([])
    expect(byName.get('demo')?.kind).toBe('class')
    expect(byName.get('Point')?.kind).toBe('class')
    expect(byName.get('sum')?.kind).toBe('method')
    expect(
      analysis.symbols.some((symbol) => symbol.name === 'Greeter' && symbol.kind === 'class')
    ).toBe(true)
    expect(
      analysis.symbols.some((symbol) => symbol.name === 'Greeter' && symbol.kind === 'method')
    ).toBe(true)
    expect(byName.get('run')?.kind).toBe('method')
    expect(byName.get('twice')?.kind).toBe('function')
    expect(byName.get('main')?.kind).toBe('function')
    expect(byName.get('name_')?.kind).toBe('variable')
    expect(byName.get('demo')?.depth).toBe(0)
    expect(byName.get('Point')?.depth).toBe(1)
    expect(byName.get('sum')?.depth).toBe(2)
  })

  it('reports a C++ syntax error', (): void => {
    const analysis = analyzeCpp('int main( {\n  return 0;\n}\n')

    expect(analysis.diagnostics.length).toBeGreaterThan(0)
    expect(analysis.diagnostics[0].message).toContain('C++')
  })

  it('labels C diagnostics separately', (): void => {
    const analysis = analyzeC('int main( {\n  return 0;\n}\n')

    expect(analysis.diagnostics.length).toBeGreaterThan(0)
    expect(analysis.diagnostics[0].message).toContain('C syntax')
  })
})
