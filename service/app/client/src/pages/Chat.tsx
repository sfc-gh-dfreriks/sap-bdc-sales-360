import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import ReactECharts from 'echarts-for-react';
import { Send, Trash2, ChevronDown, ChevronRight, Table as TableIcon, BarChart3, Maximize2, X } from 'lucide-react';
import { fetchRunSql } from '@/lib/api';

const BASE = '/api';
const SF_BLUE = '#29B5E8';
const PALETTE = ['#29B5E8', '#11567F', '#003860', '#0D8ABF', '#FF6F61', '#59A14F', '#F28E2B', '#8B5CF6'];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  results?: { columns: string[]; rows: Record<string, any>[] };
  resultsLoading?: boolean;
  resultsError?: string;
  view?: 'table' | 'chart';
}

const SUGGESTED_QUESTIONS = [
  'What is total SAP revenue broken down by sales organization?',
  'What are the top 10 products by total revenue?',
  "Show me each sales rep's pipeline value and win rate",
  'What is the total open pipeline value by opportunity stage?',
  'Show me quarterly revenue trends for the last 2 years',
  'Which open deals have not been updated in over 30 days?',
  'Which customers have the highest revenue but no open pipeline?',
  'What is the revenue breakdown by product group?',
];

type ColType = 'numeric' | 'temporal' | 'categorical';

function inferColType(rows: Record<string, unknown>[], col: string): ColType {
  const sample = rows.slice(0, 50).map((r) => r[col]).filter((v) => v !== null && v !== undefined);
  if (sample.length === 0) return 'categorical';
  if (sample.every((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v !== ''))) {
    return 'numeric';
  }
  const dateRegex = /^\d{4}-\d{2}(-\d{2})?(T|\s)?/;
  const lower = col.toLowerCase();
  if (lower.includes('date') || lower.includes('month') || lower.includes('period') || lower.includes('time') || lower.includes('year') || lower.includes('fiscal') || lower.includes('qtr') || lower.includes('quarter')) {
    return 'temporal';
  }
  if (sample.every((v) => typeof v === 'string' && dateRegex.test(v as string))) {
    return 'temporal';
  }
  return 'categorical';
}

function buildChartOption(rows: Record<string, unknown>[]): any {
  if (!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  const types = Object.fromEntries(cols.map((c) => [c, inferColType(rows, c)]));
  const numericCols = cols.filter((c) => types[c] === 'numeric');
  const temporalCols = cols.filter((c) => types[c] === 'temporal');
  const categoricalCols = cols.filter((c) => types[c] === 'categorical');
  if (numericCols.length === 0) return null;

  const xCol = temporalCols[0] ?? categoricalCols[0] ?? cols[0];
  const isTemporal = types[xCol] === 'temporal';
  const groupCol = categoricalCols.find((c) => c !== xCol);

  if (groupCol && numericCols.length === 1 && (isTemporal || rows.length > 5)) {
    const yCol = numericCols[0];
    const groups = Array.from(new Set(rows.map((r) => String(r[groupCol] ?? ''))));
    const xVals = Array.from(new Set(rows.map((r) => String(r[xCol] ?? '')))); xVals.sort();
    const series = groups.map((g, i) => ({
      name: g, type: isTemporal ? 'line' : 'bar', smooth: isTemporal, symbolSize: 6,
      lineStyle: isTemporal ? { width: 2 } : undefined,
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      data: xVals.map((x) => { const row = rows.find((r) => String(r[xCol]) === x && String(r[groupCol]) === g); return row ? Number(row[yCol]) : null; }),
    }));
    return { tooltip: { trigger: 'axis' }, legend: { top: 0, type: 'scroll' }, grid: { left: 50, right: 20, top: 40, bottom: isTemporal ? 50 : 70, containLabel: true }, xAxis: { type: 'category', data: xVals, axisLabel: { rotate: isTemporal ? 0 : 30, fontSize: 10 } }, yAxis: { type: 'value', name: yCol, nameTextStyle: { fontSize: 10 } }, series };
  }
  if (isTemporal && numericCols.length >= 1) {
    const xVals = rows.map((r) => String(r[xCol] ?? ''));
    const series = numericCols.map((c, i) => ({ name: c, type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2 }, itemStyle: { color: PALETTE[i % PALETTE.length] }, data: rows.map((r) => Number(r[c])) }));
    return { tooltip: { trigger: 'axis' }, legend: { top: 0, type: 'scroll' }, grid: { left: 50, right: 20, top: 40, bottom: 50, containLabel: true }, xAxis: { type: 'category', data: xVals, axisLabel: { fontSize: 10 } }, yAxis: { type: 'value', nameTextStyle: { fontSize: 10 } }, series };
  }
  const yCol = numericCols[0];
  const xVals = rows.map((r) => String(r[xCol] ?? ''));
  return { tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 50, right: 20, top: 30, bottom: xVals.length > 8 ? 90 : 50, containLabel: true }, xAxis: { type: 'category', data: xVals, axisLabel: { rotate: xVals.length > 8 ? 35 : 0, fontSize: 10 } }, yAxis: { type: 'value', name: yCol, nameTextStyle: { fontSize: 10 } }, series: [{ type: 'bar', data: rows.map((r) => Number(r[yCol])), itemStyle: { color: SF_BLUE, borderRadius: [4, 4, 0, 0] } }] };
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expandedSql, setExpandedSql] = useState<Set<number>>(new Set());
  const [popoutIndex, setPopoutIndex] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPopoutIndex(null); }
    if (popoutIndex !== null) { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }
  }, [popoutIndex]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function toggleSql(index: number) { setExpandedSql((prev) => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; }); }
  function setMessageView(index: number, view: 'table' | 'chart') { setMessages((prev) => { const next = [...prev]; if (next[index]) next[index] = { ...next[index], view }; return next; }); }

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setSending(true);

    try {
      // Try Agent SSE first
      const agentMessages = updated.map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      }));

      const res = await fetch(`${BASE}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: agentMessages }),
      });

      if (!res.ok) throw new Error(`Agent error: ${res.status}`);

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let textContent = '';
      let sqlContent: string | undefined;
      let resultSetData: { columns: string[]; rows: Record<string, any>[] } | undefined;

      const assistantIdx = updated.length;
      setMessages((prev) => [...prev, { role: 'assistant', content: '', resultsLoading: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const rawData = line.slice(6).trim();
          if (!rawData || rawData === '[DONE]') continue;

          try {
            const parsed = JSON.parse(rawData);

            // Error
            if (parsed.error_code) {
              textContent += `Error: ${parsed.message ?? 'Unknown'}`;
              continue;
            }
            // Text chunk
            if (parsed.text) {
              textContent += parsed.text;
              setMessages((prev) => prev.map((m, i) => i === assistantIdx ? { ...m, content: textContent } : m));
              continue;
            }
            // Content array
            if (parsed.content && Array.isArray(parsed.content)) {
              for (const item of parsed.content) {
                if (!item || typeof item !== 'object') continue;
                if (item.type === 'text' && item.text) {
                  textContent += item.text;
                  setMessages((prev) => prev.map((m, i) => i === assistantIdx ? { ...m, content: textContent } : m));
                }
                if (item.tool_result) {
                  const tr = item.tool_result;
                  for (const c of (tr.content ?? [])) {
                    const inner = c?.json;
                    if (inner?.result_set) {
                      const rs = inner.result_set;
                      const rawRows = rs.data ?? [];
                      const meta = rs.resultSetMetaData ?? {};
                      const cols = (meta.rowType ?? []).map((col: any) => col.name);
                      if (rawRows.length && cols.length) {
                        const rows = rawRows.map((row: any[]) => Object.fromEntries(cols.map((c: string, j: number) => [c, row[j]])));
                        resultSetData = { columns: cols, rows };
                      }
                    }
                  }
                }
                if (item.json?.result_set) {
                  const rs = item.json.result_set;
                  const rawRows = rs.data ?? [];
                  const meta = rs.resultSetMetaData ?? {};
                  const cols = (meta.rowType ?? []).map((col: any) => col.name);
                  if (rawRows.length && cols.length) {
                    const rows = rawRows.map((row: any[]) => Object.fromEntries(cols.map((c: string, j: number) => [c, row[j]])));
                    resultSetData = { columns: cols, rows };
                  }
                }
              }
            }
          } catch { /* skip parse errors */ }
        }
      }

      // Finalize
      const canChart = resultSetData ? buildChartOption(resultSetData.rows) !== null : false;
      setMessages((prev) => prev.map((m, i) =>
        i === assistantIdx
          ? { ...m, content: textContent || 'No response received.', resultsLoading: false, results: resultSetData, view: canChart ? 'chart' : 'table' }
          : m
      ));
    } catch (agentErr: any) {
      // Fallback to Analyst
      try {
        const apiMessages = updated.map((m) => ({
          role: m.role === 'assistant' ? 'analyst' : m.role,
          content: [{ type: 'text', text: m.content }],
        }));
        const res = await fetch(`${BASE}/analyst`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
        });
        if (!res.ok) throw new Error(`Analyst error: ${res.status}`);
        const data = await res.json();
        const contentParts = data?.message?.content ?? [];
        let textContent = '';
        let sqlContent: string | undefined;
        for (const part of contentParts) {
          if (part.type === 'text') textContent += part.text;
          else if (part.type === 'sql') sqlContent = part.statement;
        }
        const assistantMsg: Message = { role: 'assistant', content: textContent || 'No response.', sql: sqlContent, resultsLoading: !!sqlContent };
        setMessages((prev) => [...prev, assistantMsg]);
        if (sqlContent) {
          try {
            const sqlData = await fetchRunSql(sqlContent);
            const canChart = sqlData.rows?.length > 0 && buildChartOption(sqlData.rows) !== null;
            setMessages((prev) => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, resultsLoading: false, results: sqlData, view: canChart ? 'chart' : 'table' } : m));
          } catch (sqlErr: any) {
            setMessages((prev) => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, resultsLoading: false, resultsError: sqlErr.message } : m));
          }
        }
      } catch (fallbackErr: any) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${agentErr.message}. Fallback also failed: ${fallbackErr.message}` }]);
      }
    } finally {
      setSending(false);
    }
  }

  function clearChat() { setMessages([]); setExpandedSql(new Set()); }
  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col rounded-xl border border-sf-blue/30 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-sf-dark">Cortex Agent — Ask Questions About Sales Data</h3>
        {messages.length > 0 && (
          <button onClick={clearChat} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <Trash2 className="h-3.5 w-3.5" /> Clear conversation
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="mb-6 text-sm text-gray-500">Ask questions about your SAP sales data in natural language.</p>
            <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} className="rounded-lg border border-sf-blue/30 bg-sky-50/50 px-3 py-2.5 text-left text-xs text-sf-dark transition-colors hover:border-sf-blue hover:bg-sky-100/50">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'max-w-[75%] bg-sf-blue text-white' : msg.results && msg.results.rows.length > 0 ? 'w-full max-w-[95%] bg-gray-100 text-gray-800' : 'max-w-[75%] bg-gray-100 text-gray-800'}`}>
                  {msg.role === 'assistant' ? (<div className="prose prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>) : (<p>{msg.content}</p>)}
                  {msg.sql && (
                    <div className="mt-3">
                      <button onClick={() => toggleSql(i)} className="flex items-center gap-1 text-xs font-medium text-sf-dark/70 hover:text-sf-dark">
                        {expandedSql.has(i) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} SQL Query
                      </button>
                      {expandedSql.has(i) && <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-green-300"><code>{msg.sql}</code></pre>}
                    </div>
                  )}
                  {msg.resultsLoading && <div className="mt-3 flex items-center gap-2 text-xs text-gray-500"><div className="h-3 w-3 animate-spin rounded-full border-2 border-sf-blue border-t-transparent" />Running query...</div>}
                  {msg.resultsError && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">Query error: {msg.resultsError}</div>}
                  {msg.results && msg.results.rows.length > 0 && (() => {
                    const chartOption = buildChartOption(msg.results.rows);
                    const canChart = chartOption !== null;
                    const view = msg.view ?? (canChart ? 'chart' : 'table');
                    return (
                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-sf-dark/70">
                            <span>Results</span>
                            <span className="rounded-full bg-sf-blue/20 px-2 py-0.5 text-[10px] text-sf-dark">{msg.results.rows.length} row{msg.results.rows.length === 1 ? '' : 's'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {canChart && (
                              <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5">
                                <button onClick={() => setMessageView(i, 'chart')} className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${view === 'chart' ? 'bg-sf-blue text-white' : 'text-gray-600 hover:bg-gray-100'}`}><BarChart3 className="h-3 w-3" />Chart</button>
                                <button onClick={() => setMessageView(i, 'table')} className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${view === 'table' ? 'bg-sf-blue text-white' : 'text-gray-600 hover:bg-gray-100'}`}><TableIcon className="h-3 w-3" />Table</button>
                              </div>
                            )}
                            <button onClick={() => setPopoutIndex(i)} title="Expand" className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"><Maximize2 className="h-3 w-3" />Expand</button>
                          </div>
                        </div>
                        {view === 'chart' && canChart ? (
                          <div className="rounded-lg border border-gray-200 bg-white p-2"><ReactECharts option={chartOption} style={{ height: 380, width: '100%' }} /></div>
                        ) : (
                          <div className="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-white">
                            <table className="min-w-full text-xs">
                              <thead className="sticky top-0 bg-sf-dark text-white"><tr>{msg.results.columns.map((col) => <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">{col}</th>)}</tr></thead>
                              <tbody>{msg.results.rows.slice(0, 100).map((row, ri) => <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-sky-50/50'}>{msg.results!.columns.map((col) => <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{row[col] === null || row[col] === undefined ? '—' : typeof row[col] === 'number' ? row[col].toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(row[col])}</td>)}</tr>)}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="rounded-xl bg-gray-100 px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-sf-blue [animation-delay:0ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-sf-blue [animation-delay:150ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-sf-blue [animation-delay:300ms]" /></div></div></div>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 px-5 py-3">
        <div className="flex gap-3">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask a question about your sales data..." disabled={sending} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-sf-blue focus:ring-1 focus:ring-sf-blue disabled:opacity-50" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || sending} className="flex items-center gap-2 rounded-lg bg-sf-blue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sf-dark disabled:opacity-50"><Send className="h-4 w-4" />Send</button>
        </div>
      </div>
      {/* Fullscreen Modal */}
      {popoutIndex !== null && messages[popoutIndex]?.results && (() => {
        const msg = messages[popoutIndex]; const chartOption = buildChartOption(msg.results!.rows); const canChart = chartOption !== null; const view = msg.view ?? (canChart ? 'chart' : 'table');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setPopoutIndex(null)}>
            <div className="flex h-[92vh] w-[92vw] max-w-[1600px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-sf-dark">Results</h3>
                  <span className="rounded-full bg-sf-blue/20 px-2 py-0.5 text-[11px] text-sf-dark">{msg.results!.rows.length} rows</span>
                  {canChart && (
                    <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5">
                      <button onClick={() => setMessageView(popoutIndex, 'chart')} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs ${view === 'chart' ? 'bg-sf-blue text-white' : 'text-gray-600 hover:bg-gray-100'}`}><BarChart3 className="h-3.5 w-3.5" />Chart</button>
                      <button onClick={() => setMessageView(popoutIndex, 'table')} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs ${view === 'table' ? 'bg-sf-blue text-white' : 'text-gray-600 hover:bg-gray-100'}`}><TableIcon className="h-3.5 w-3.5" />Table</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setPopoutIndex(null)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" title="Close (Esc)"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {view === 'chart' && canChart ? <ReactECharts option={chartOption} style={{ height: '100%', width: '100%', minHeight: 500 }} /> : (
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-sf-dark text-white"><tr>{msg.results!.columns.map((col) => <th key={col} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{col}</th>)}</tr></thead>
                    <tbody>{msg.results!.rows.map((row, ri) => <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-sky-50/50'}>{msg.results!.columns.map((col) => <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap">{row[col] === null || row[col] === undefined ? '—' : typeof row[col] === 'number' ? row[col].toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(row[col])}</td>)}</tr>)}</tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
