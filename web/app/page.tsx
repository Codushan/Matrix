'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';

type Matrix = { name: string; rows: number; cols: number; data: string[][] };
type EvalResponse = { kind: 'matrix' | 'scalar'; value: string | string[][] };

export default function Page() {
  const [matrices, setMatrices] = useState<Matrix[]>([
    { name: 'A', rows: 2, cols: 2, data: [['a', '0'], ['0', 'a']] },
    { name: 'B', rows: 2, cols: 2, data: [['1', 'a'], ['3', '0']] },
  ]);
  const [expr, setExpr] = useState(''); // was: useState(null as string | null);
  const [result, setResult] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const varButtons = useMemo(() => matrices.map(m => m.name), [matrices]);

  const formatExpr = (s: string): string => {
    if (!s) return s;
    let t = s;
    
    // Handle fractions: a/b -> a/b with proper formatting
    t = t.replace(/(\w+)\/(\w+)/g, '($1)/($2)');
    
    // Handle powers: a**b -> a^b
    t = t.replace(/\*\*/g, '^');
    
    // Handle implicit multiplication: 2a -> 2·a, 2(a+b) -> 2·(a+b)
    t = t.replace(/(\d+)([a-zA-Z(])/g, '$1·$2');
    
    // Handle negative signs: -a -> −a (proper minus sign)
    t = t.replace(/-/g, '−');
    
    // Handle multiplication: a*b -> a·b
    t = t.replace(/\*/g, '·');
    
    // Handle common mathematical expressions
    t = t.replace(/\bexp\b/g, 'e^');
    t = t.replace(/\bln\b/g, 'ln');
    t = t.replace(/\bsin\b/g, 'sin');
    t = t.replace(/\bcos\b/g, 'cos');
    t = t.replace(/\btan\b/g, 'tan');
    
    // Add proper spacing around operators for better readability
    t = t.replace(/([+\-])/g, ' $1 ');
    t = t.replace(/\s+/g, ' ').trim();
    
    // Handle powers with proper spacing: a^2 -> a^2 (no extra spaces)
    t = t.replace(/(\w+)\s*\^\s*(\w+)/g, '$1^$2');
    
    // Handle multiplication dots with proper spacing
    t = t.replace(/(\w+)\s*·\s*(\w+)/g, '$1·$2');
    
    return t;
  };

  // Function to render mathematical expressions with proper formatting
  const renderMathExpr = (expr: string) => {
    const formatted = formatExpr(expr);
    
    // Check if it's a fraction
    if (formatted.includes('/')) {
      const [numerator, denominator] = formatted.split('/');
      return (
        <div className="flex flex-col items-center">
          <div className="border-b border-gray-400 px-2">{renderMathExpr(numerator)}</div>
          <div className="px-2">{renderMathExpr(denominator)}</div>
        </div>
      );
    }
    
    // Check if it contains powers (handle multiple powers in the same expression)
    if (formatted.includes('^')) {
      // Split by + and - to handle multiple terms
      const terms = formatted.split(/([+\-])/);
      return terms.map((term, index) => {
        if (term === '+' || term === '-') {
          return <span key={index} className="mx-1">{term}</span>;
        }
        
        // Check if this term contains powers
        if (term.includes('^')) {
          const powerParts = term.split('^');
          if (powerParts.length === 2) {
            return (
              <span key={index}>
                {powerParts[0]}<sup className="text-sm">{powerParts[1]}</sup>
              </span>
            );
          }
        }
        
        return <span key={index}>{term}</span>;
      });
    }
    
    // Check if it contains multiplication dots
    if (formatted.includes('·')) {
      return formatted.split('·').map((part, i) => (
        <span key={i}>
          {part}{i < formatted.split('·').length - 1 && <span className="text-gray-500">·</span>}
        </span>
      ));
    }
    
    // Handle expressions with parentheses and multiple terms
    if (formatted.includes('(') || formatted.includes('+') || formatted.includes('−')) {
      // Split by operators while preserving them
      const parts = formatted.split(/([+\-·])/);
      return parts.map((part, index) => {
        if (part === '+' || part === '−' || part === '·') {
          return <span key={index} className="mx-1">{part}</span>;
        }
        
        // Check if this part contains powers
        if (part.includes('^')) {
          const powerParts = part.split('^');
          if (powerParts.length === 2) {
            return (
              <span key={index}>
                {powerParts[0]}<sup className="text-sm">{powerParts[1]}</sup>
              </span>
            );
          }
        }
        
        return <span key={index}>{part}</span>;
      });
    }
    
    // Default case
    return formatted;
  };

  const setSize = (name: string, rows: number, cols: number) => {
    setMatrices(prev => prev.map(m => {
      if (m.name !== name) return m;
      const r = Math.max(1, Math.min(8, Math.floor(rows)));
      const c = Math.max(1, Math.min(8, Math.floor(cols)));
      const data: string[][] = Array.from({ length: r }, (_, i) => (
        Array.from({ length: c }, (_, j) => (m.data[i]?.[j] ?? ''))
      ));
      return { ...m, rows: r, cols: c, data };
    }));
  };

  const setCell = (name: string, r: number, c: number, v: string) => {
    setMatrices(prev => prev.map(m => {
      if (m.name !== name) return m;
      const copy = m.data.map(row => row.slice());
      copy[r][c] = v;
      return { ...m, data: copy };
    }));
  };

  const addMatrix = () => {
    const used = new Set(matrices.map(m => m.name));
    let code = 65;
    while (used.has(String.fromCharCode(code))) code++;
    const name = String.fromCharCode(code);
    setMatrices(prev => [...prev, { name, rows: 2, cols: 2, data: [['', ''], ['', '']] }]);
  };

  const removeMatrix = (name: string) => {
    setMatrices(prev => prev.filter(m => m.name !== name));
  };

  const insertToken = (t: string) => {
    setExpr(s => s + t);
  };

  const evaluate = async () => {
    setError(null);
    setResult(null);
    try {
             const res = await fetch(`${process.env.API_URL || 'http://localhost:8000'}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrices, expression: expr })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error');
      setResult(json);
    } catch (e: any) {
      setError(String(e.message || e));
    }
  };

  const storeResult = () => {
    if (!result || result.kind !== 'matrix') return;
    const used = new Set(matrices.map(m => m.name));
    let code = 65;
    while (used.has(String.fromCharCode(code))) code++;
    const name = String.fromCharCode(code);
    const value = result.value as string[][];
    setMatrices(prev => [...prev, { name, rows: value.length, cols: value[0].length, data: value.map(r => r.slice()) }]);
  };

  return (
    <div className="p-4 space-y-4">
      <header className="bg-gradient-to-r from-blue-900 to-sky-500 text-white rounded-xl p-6 text-center">
        <div className="text-2xl font-extrabold">Advanced Matrix Calculator</div>
        <div className="opacity-90">By Chandrabhushan</div>
        {/* <div className="opacity-90">Python (SymPy) + Next.js</div> */}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white rounded-lg shadow p-3">
          <div className="font-semibold mb-2">Matrices</div>
          <div className="space-y-3">
            {matrices.map(m => (
              <div key={m.name} className="border rounded p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Matrix {m.name}</div>
                  <div className="flex items-center gap-2">
                    <span>Rows:</span>
                    <input type="number" className="border rounded px-2 py-1 w-16" value={m.rows} onChange={e => setSize(m.name, parseInt(e.target.value || '1', 10), m.cols)} />
                    <span>Cols:</span>
                    <input type="number" className="border rounded px-2 py-1 w-16" value={m.cols} onChange={e => setSize(m.name, m.rows, parseInt(e.target.value || '1', 10))} />
                    <button className="bg-red-100 text-red-700 px-2 py-1 rounded" onClick={() => removeMatrix(m.name)}>×</button>
                  </div>
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${m.cols}, minmax(60px, 1fr))` }}>
                  {Array.from({ length: m.rows }).map((_, r) => (
                    Array.from({ length: m.cols }).map((_, c) => (
                      <input key={`${r}-${c}`} className="border rounded px-2 py-1" value={m.data[r]?.[c] ?? ''} onChange={e => setCell(m.name, r, c, e.target.value)} />
                    ))
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button className="w-full bg-[#5a67d8] text-white font-semibold px-3 py-2 rounded" onClick={addMatrix}>Add New Matrix</button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-3">
          <div className="font-semibold mb-2">Operations</div>
          <input className="w-full border rounded px-3 py-2 mb-2" value={expr} onChange={e => setExpr(e.target.value)} placeholder="e.g. (2/3) * A * B + T(A)" />
          <div className="flex flex-wrap gap-2 mb-2">
            {varButtons.map(v => (
              <button key={v} className="bg-[#4ca1af] text-white rounded px-2 py-1" onClick={() => insertToken(v)}>{v}</button>
            ))}
            {/* Number and fraction buttons */}
            {[1,2,3,4,5,6,7,8,9,0].map(n => (
              <button key={n} className="bg-gray-200 text-gray-800 rounded px-2 py-1" onClick={() => insertToken(String(n))}>{n}</button>
            ))}
            <button className="bg-gray-200 text-gray-800 rounded px-2 py-1" onClick={() => insertToken('/')}>/</button>
            <button className="bg-gray-200 text-gray-800 rounded px-2 py-1" onClick={() => insertToken('(')}>(</button>
            <button className="bg-gray-200 text-gray-800 rounded px-2 py-1" onClick={() => insertToken(')')}>)</button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              [')', ')'],
              ['+', '+'],
              ['-', '-'],
              ['*', '*'],
              ['Trans(T)', 'T('],
              ['Inv(I)', 'INV('],
              ['Det(|D|)', 'DET('],
              ['Trace', 'TRACE('],
              ['Rank', 'RANK('],
              ['RREF', 'RREF(']
            ].map(([label, tok]) => (
              <button key={label} className="bg-[#2c3e50] text-white rounded px-2 py-2" onClick={() => insertToken(tok as string)}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button className="bg-green-600 text-white rounded px-3 py-2 font-semibold" onClick={evaluate}>Calculate</button>
            <button className="bg-[#007aff] text-white rounded px-3 py-2 font-semibold" onClick={storeResult}>Store Result</button>
            <button className="bg-red-600 text-white rounded px-3 py-2 font-semibold" onClick={() => { setExpr(''); setResult(null); setError(null); }}>Clear</button>
          </div>

          <div className="font-semibold mt-3 mb-1">Result</div>
          <div className="min-h-[140px] border rounded p-2 bg-slate-50 overflow-auto">
            {error && (<pre className="text-red-700 whitespace-pre-wrap">Error: {error}</pre>)}
                         {!error && result?.kind === 'scalar' && (
               <div><strong>Scalar:</strong> {renderMathExpr(String(result.value))}</div>
             )}
            {!error && result?.kind === 'matrix' && Array.isArray(result.value) && (
              <table className="border-collapse">
                <tbody>
                  {(result.value as string[][]).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="border px-2 py-1 text-center">{renderMathExpr(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


