import { describe, expect, it } from 'vitest'
import { analyzePython } from './pythonAnalysis'

const SOURCE = [
  'import math',
  '',
  'LIMIT = 10',
  '',
  'def double(value):',
  '    return value * 2',
  '',
  'class Greeter:',
  '    def hello(self):',
  '        return "hi"',
  ''
].join('\n')

describe('analyzePython', (): void => {
  it('extracts functions, methods, classes, and module-level names', (): void => {
    const analysis = analyzePython(SOURCE)
    const byName = new Map(analysis.symbols.map((symbol) => [symbol.name, symbol]))

    expect(analysis.diagnostics).toEqual([])
    expect(byName.get('double')?.kind).toBe('function')
    expect(byName.get('Greeter')?.kind).toBe('class')
    expect(byName.get('hello')?.kind).toBe('method')
    expect(byName.get('LIMIT')?.kind).toBe('variable')
    expect(byName.get('double')?.line).toBe(5)
    expect(analysis.names).toContain('value')
  })

  it('reports syntax errors with a line number', (): void => {
    const analysis = analyzePython('def broken(\n    return 1\n')
    expect(analysis.diagnostics.length).toBeGreaterThan(0)
    expect(analysis.diagnostics[0].line).toBeGreaterThanOrEqual(1)
    expect(analysis.diagnostics[0].line).toBeLessThanOrEqual(2)
  })

  it('returns an empty analysis for an empty file', (): void => {
    expect(analyzePython('')).toEqual({ symbols: [], names: [], diagnostics: [] })
  })
})

/** Only the semantic diagnostics; parser errors are covered separately. */
function undefinedNames(source: string): string[] {
  return analyzePython(source)
    .diagnostics.filter((diagnostic) => diagnostic.message.startsWith('Name '))
    .map((diagnostic) => diagnostic.message)
}

describe('analyzePython undefined names', (): void => {
  it('flags an undefined name while leaving syntax errors to the parser', (): void => {
    const source = [
      'hello = "hello world!"',
      'x = 1',
      'y = 2',
      'print(f"{x} {y} {x+y}"+a) he'
    ].join('\n')
    const diagnostics = analyzePython(source).diagnostics

    expect(
      diagnostics.some((diagnostic) => diagnostic.message === "Name 'a' is not defined.")
    ).toBe(true)
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("'he'"))).toBe(false)
  })

  it('accepts builtins, imports, parameters, defaults, locals, and special names', (): void => {
    const source = [
      'import math',
      'import os.path',
      'import sys as system',
      'from collections import defaultdict',
      'from math import pi as PI, tau',
      '',
      'PREFIX = "r"',
      '',
      'def area(radius, scale=2, *args, **kwargs):',
      '    result = PI * radius ** 2 * scale',
      '    print(math.pi, os.path, system.argv, defaultdict, tau, args, kwargs)',
      '    print(__name__, __file__, True, None)',
      '    print(f"{PREFIX}:{result}", sep=",", end="\\n")',
      '    return result',
      '',
      'class Circle:',
      '    label = "circle"',
      '',
      '    def __init__(self, radius):',
      '        self.radius = radius',
      '',
      '    def label_for(self, prefix=PREFIX):',
      '        return prefix + self.label',
      ''
    ].join('\n')

    expect(undefinedNames(source)).toEqual([])
  })

  it('accepts loop, with, except, and global targets', (): void => {
    const source = [
      'counter = 0',
      'pairs = [(1, 2)]',
      '',
      'def bump(step):',
      '    global counter',
      '    counter = counter + step',
      '',
      'for key, value in pairs:',
      '    print(key, value)',
      '',
      'with open("data.txt") as handle:',
      '    content = handle.read()',
      '',
      'try:',
      '    parsed = int(content)',
      'except (ValueError, TypeError) as error:',
      '    print(error)',
      'finally:',
      '    handle.close()',
      ''
    ].join('\n')

    expect(undefinedNames(source)).toEqual([])
  })

  it('resolves comprehension and lambda parameters', (): void => {
    const source = [
      'numbers = [1, 2, 3]',
      'pairs = [(1, 2)]',
      'factor = 2',
      '',
      'doubled = [n * factor for n in numbers]',
      'mapped = {row: col for row, col in pairs}',
      'gen = (item for item in numbers)',
      'double = lambda value, bonus=1: value * bonus * factor',
      'print(doubled, mapped, list(gen), double(2))',
      ''
    ].join('\n')

    expect(undefinedNames(source)).toEqual([])
  })

  it('resolves nested closures and forward references', (): void => {
    const source = [
      'limit = 10',
      '',
      'def outer(value):',
      '    def inner():',
      '        return value + later() + limit',
      '    return inner',
      '',
      'def later():',
      '    return 1',
      '',
      'print(outer(2)())',
      ''
    ].join('\n')

    expect(undefinedNames(source)).toEqual([])
  })

  it('flags undefined names in module, function, and method bodies', (): void => {
    const source = [
      'limit = 10',
      '',
      'def broken():',
      '    return missing_in_function',
      '',
      'class Thing:',
      '    def method(self):',
      '        return missing_in_method',
      '',
      'print(missing_at_module, limit)',
      ''
    ].join('\n')

    expect(undefinedNames(source)).toEqual([
      "Name 'missing_in_function' is not defined.",
      "Name 'missing_in_method' is not defined.",
      "Name 'missing_at_module' is not defined."
    ])
  })

  it('treats match-pattern captures as definitions', (): void => {
    const source = [
      'from dataclasses import dataclass',
      '',
      '@dataclass',
      'class Point:',
      '    x: int',
      '    y: int',
      '',
      'def describe(command):',
      '    match command:',
      '        case "quit":',
      '            return "bye"',
      '        case Point(x=px, y=py) as point if px > 0:',
      '            return f"{px} {py} {point} {command}"',
      '        case [first, *rest]:',
      '            return first + len(rest)',
      '        case {"key": value, **extra}:',
      '            return value + len(extra)',
      '        case _:',
      '            return "unknown"',
      ''
    ].join('\n')

    expect(undefinedNames(source)).toEqual([])
  })

  it('suppresses undefined-name warnings when a star import is present', (): void => {
    const source = ['from os import *', 'print(unknown_name, path)'].join('\n')

    expect(undefinedNames(source)).toEqual([])
  })
})
