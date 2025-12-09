'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';

type Matrix = { name: string; rows: number; cols: number; data: string[][] };
type EvalResponse = { kind: 'matrix' | 'scalar'; value: string | string[][] };

import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function Page() {
  const [matrices, setMatrices] = useState<Matrix[]>([
    { name: 'A', rows: 2, cols: 2, data: [['a', '0'], ['0', 'a']] },
    { name: 'B', rows: 2, cols: 2, data: [['1', 'a'], ['3', '0']] },
  ]);
  const [expr, setExpr] = useState(''); // was: useState(null as string | null);
  const [result, setResult] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add local state for editing row/col values
  const [editSizes, setEditSizes] = useState<Record<string, { rows: string, cols: string }>>({});

  const varButtons = useMemo(() => matrices.map(m => m.name), [matrices]);


  // Function to render mathematical result
  const renderResult = (content: string) => {
    // If it's a simple string, we can stick it in Latex
    // We expect the backend to give us LaTeX-friendly strings.
    // Replace any remaining Python-isms if necessary, but ideally backend handles it.
    let latexStr = content;
    // Basic cleanups just in case
    latexStr = latexStr.replace(/\*/g, ' \\cdot ');

    return <Latex>{`$${latexStr}$`}</Latex>;
  };

  const setSize = (name: string, rows: number, cols: number) => {
    setMatrices(prev => prev.map(m => {
      if (m.name !== name) return m;
      const r = Math.max(1, Math.floor(rows));
      const c = Math.max(1, Math.floor(cols));
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
      // Use relative path in production (Vercel rewrites) or explicit localhost for dev
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || (isLocal ? 'http://localhost:8000' : '');
      const res = await fetch(`${apiUrl}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrices, expression: expr })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`); // Limit error length
      }

      const json = await res.json();
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
                <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                  <div className="font-semibold">Matrix {m.name}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Rows:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="border rounded px-2 py-1 w-20"
                      value={editSizes[m.name]?.rows ?? String(m.rows)}
                      onChange={e => {
                        const v = e.target.value;
                        setEditSizes(s => ({
                          ...s,
                          [m.name]: { rows: v, cols: s[m.name]?.cols ?? String(m.cols) }
                        }));
                      }}
                      onBlur={e => {
                        let v = parseInt(e.target.value, 10);
                        if (!v || v < 1) v = 1;
                        setSize(m.name, v, m.cols);
                        setEditSizes(s => {
                          const { [m.name]: omit, ...rest } = s;
                          return rest;
                        });
                      }}
                    />
                    <span>Cols:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="border rounded px-2 py-1 w-20"
                      value={editSizes[m.name]?.cols ?? String(m.cols)}
                      onChange={e => {
                        const v = e.target.value;
                        setEditSizes(s => ({
                          ...s,
                          [m.name]: { cols: v, rows: s[m.name]?.rows ?? String(m.rows) }
                        }));
                      }}
                      onBlur={e => {
                        let v = parseInt(e.target.value, 10);
                        if (!v || v < 1) v = 1;
                        setSize(m.name, m.rows, v);
                        setEditSizes(s => {
                          const { [m.name]: omit, ...rest } = s;
                          return rest;
                        });
                      }}
                    />
                    <button
                      className="bg-red-100 text-red-700 px-2 py-1 rounded mt-2 md:mt-0"
                      style={{ minWidth: 32 }}
                      onClick={() => removeMatrix(m.name)}
                    >×</button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${m.cols}, minmax(60px, 1fr))`,
                      minWidth: `${m.cols * 70}px`, // ensures horizontal scroll if too many columns
                    }}
                  >
                    {Array.from({ length: m.rows }).map((_, r) =>
                      Array.from({ length: m.cols }).map((_, c) => (
                        <input
                          key={`${r}-${c}`}
                          className="border rounded px-2 py-1"
                          value={m.data[r]?.[c] ?? ''}
                          onChange={e => setCell(m.name, r, c, e.target.value)}
                        />
                      ))
                    )}
                  </div>
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
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
              ['INV(I)', 'INV('],
              ['Det(|D|)', 'DET('],
              ['Trace', 'TRACE('],
              ['Rank', 'RANK('],
              ['RREF', 'RREF(']
            ].map(([label, tok]) => {
              // Use symbols for mobile
              let symbol = label;
              if (label === 'Trans(T)') symbol = 'T';
              if (label === 'INV(I)') symbol = 'A⁻¹';
              if (label === 'Det(|D|)') symbol = '|A|';
              if (label === 'Trace') symbol = 'tr';
              if (label === 'Rank') symbol = 'rk';
              if (label === 'RREF') symbol = 'rref';
              return (
                <button
                  key={label}
                  className="bg-[#2c3e50] text-white rounded px-2 py-2"
                  onClick={() => insertToken(tok as string)}
                >
                  <span className="block sm:hidden">{symbol}</span>
                  <span className="hidden sm:block">{label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <button className="bg-green-600 text-white rounded px-3 py-2 font-semibold" onClick={evaluate}>
              <span className="block sm:hidden">=</span>
              <span className="hidden sm:block">Calculate</span>
            </button>
            <button className="bg-[#007aff] text-white rounded px-3 py-2 font-semibold" onClick={storeResult}>Store Result</button>
            <button className="bg-red-600 text-white rounded px-3 py-2 font-semibold" onClick={() => { setExpr(''); setResult(null); setError(null); }}>Clear</button>
            <button
              className="bg-purple-900 text-white rounded px-2 py-1"
              onClick={() => setExpr(s => s.slice(0, -1))}
              aria-label="Backspace"
            >
              ⌫
            </button>
          </div>

          <div className="font-semibold mt-3 mb-1">Result</div>
          <div className="min-h-[140px] border rounded p-2 bg-slate-50 overflow-auto">
            {error && (<pre className="text-red-700 whitespace-pre-wrap">Error: {error}</pre>)}
            {!error && result?.kind === 'scalar' && (
              <div className="text-lg p-2">
                <strong>Result: </strong>
                {renderResult(String(result.value))}
              </div>
            )}
            {!error && result?.kind === 'matrix' && Array.isArray(result.value) && (
              <div className="flex justify-center">
                {/* 
                    We can render the whole matrix as one LaTeX block for better formatting 
                    Or keep the table structure. 
                    Let's use the table structure for consistency with input, 
                    but render each cell with LaTeX.
                 */}
                <table className="border-collapse">
                  <tbody>
                    {(result.value as string[][]).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="border px-4 py-2 text-center text-lg">
                            {renderResult(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


