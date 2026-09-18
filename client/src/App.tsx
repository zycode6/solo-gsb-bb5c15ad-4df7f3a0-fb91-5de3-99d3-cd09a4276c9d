import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import Board, { type SlimHighlight } from './components/Board';
import CardForm from './components/CardForm';
import ConflictBanner from './components/ConflictBanner';
import SlimPanel from './components/SlimPanel';
import TimelinePanel from './components/TimelinePanel';
import type { Evidence, EvidenceFormValues, GraphState, SlimReport } from './types';

export interface Conflict {
  cycle: string[];
  message: string;
}

export default function App() {
  const [state, setState] = useState<GraphState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [slim, setSlim] = useState<SlimReport | null>(null);
  const [selectedRedundantId, setSelectedRedundantId] = useState<number | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [editing, setEditing] = useState<Evidence | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshSlim = useCallback(() => {
    api
      .slimReport()
      .then((report) => {
        setSlim(report);
        setSelectedRedundantId((cur) => (cur !== null && report.redundant.some((r) => r.edgeId === cur) ? cur : null));
      })
      .catch(() => setSlim({ redundant: [], count: 0 }));
  }, []);

  useEffect(() => {
    api
      .state()
      .then(setState)
      .catch(() => setError('无法连接服务器，请确认后端已启动'));
  }, []);

  // 图结构变化后重新检测冗余连线（首次加载也会触发）
  const edgeSignature = state?.edges.map((e) => e.id).join(',') ?? '';
  useEffect(() => {
    if (state) refreshSlim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeSignature]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLinkFrom(null);
        setEditing(null);
        setSelectedRedundantId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleApiError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.payload.cycle) {
      setConflict({ cycle: e.payload.cycle, message: e.payload.message ?? e.message });
      setError(null);
    } else {
      setError(e instanceof Error ? e.message : '操作失败');
    }
  }, []);

  /** 执行一次会改变图状态的操作；成功后清除冲突高亮与连线模式 */
  const run = useCallback(
    async (fn: () => Promise<GraphState>) => {
      setBusy(true);
      try {
        setState(await fn());
        setConflict(null);
        setLinkFrom(null);
        setError(null);
        setNotice(null);
        setSelectedRedundantId(null);
      } catch (e) {
        handleApiError(e);
      } finally {
        setBusy(false);
      }
    },
    [handleApiError],
  );

  const connect = useCallback((fromId: string, toId: string) => run(() => api.createEdge(fromId, toId)), [run]);

  const submitCard = useCallback(
    async (values: EvidenceFormValues) => {
      if (editing === null) return;
      setBusy(true);
      try {
        setState(editing === 'new' ? await api.createEvidence(values) : await api.updateEvidence(editing.id, values));
        setEditing(null);
        setConflict(null);
        setError(null);
      } catch (e) {
        handleApiError(e);
      } finally {
        setBusy(false);
      }
    },
    [editing, handleApiError],
  );

  const deleteCard = useCallback(
    (ev: Evidence) => {
      if (!window.confirm(`删除证据「${ev.title}」？相关连线将一并删除。`)) return;
      void run(() => api.deleteEvidence(ev.id));
    },
    [run],
  );

  const deleteEdge = useCallback(
    (id: number) => {
      if (!window.confirm('删除这条「必须早于」连线？')) return;
      void run(() => api.deleteEdge(id));
    },
    [run],
  );

  const applySlim = useCallback(async () => {
    const count = slim?.count ?? 0;
    if (count === 0) return;
    if (!window.confirm(`批量移除当前 ${count} 条冗余连线？\n所有证据间的先后（可达）关系保持不变，仅删除可被替代路径推导的直接连线。`)) {
      return;
    }
    setBusy(true);
    try {
      const result = await api.slimApply();
      const { removed, ...next } = result;
      setState(next);
      setSelectedRedundantId(null);
      setConflict(null);
      setError(null);
      setNotice(removed > 0 ? `已移除 ${removed} 条冗余连线，证据间可达关系保持不变。` : '没有需要移除的冗余连线（可能已被其他操作处理）。');
      // 图已变更，edgeSignature effect 会重新拉取瘦身报告
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }, [slim?.count, handleApiError]);

  const onImportFile = useCallback(
    async (file: File) => {
      let payload: unknown;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        setError('导入失败：文件不是合法 JSON');
        return;
      }
      if (!window.confirm('导入将覆盖当前全部证据与连线，确定继续？')) return;
      await run(() => api.importSnapshot(payload));
    },
    [run],
  );

  const loadSample = useCallback(() => {
    if (!window.confirm('载入示例将覆盖当前全部数据，确定继续？')) return;
    void run(() => api.seed());
  }, [run]);

  const titleOf = useCallback(
    (id: string) => state?.evidence.find((e) => e.id === id)?.title ?? id.slice(0, 8),
    [state],
  );

  const slimHighlight: SlimHighlight | null =
    slim && selectedRedundantId !== null
      ? (() => {
            const redundancy = slim.redundant.find((r) => r.edgeId === selectedRedundantId);
            return redundancy ? { redundancy } : null;
          })()
      : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">⛓</span>
          <div>
            <h1>事故证据链编排器</h1>
            <p>用「必须早于」约束编排证据，自动推演可解释时间线</p>
          </div>
        </div>
        <div className="toolbar">
          <button className="btn primary" onClick={() => setEditing('new')} disabled={busy}>
            ＋ 新增证据
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            导入 JSON
          </button>
          <a className="btn" href="/api/export" download="evidence-snapshot.json">
            导出 JSON
          </a>
          <button className="btn" onClick={loadSample} disabled={busy}>
            载入示例
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {error && (
        <div className="toast error" role="alert">
          <span>⚠ {error}</span>
          <button className="toast-close" onClick={() => setError(null)} aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {notice && (
        <div className="toast notice" role="status">
          <span>✓ {notice}</span>
          <button className="toast-close" onClick={() => setNotice(null)} aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {conflict && <ConflictBanner conflict={conflict} titleOf={titleOf} onClose={() => setConflict(null)} />}

      {linkFrom && state && (
        <div className="link-hint">
          连线模式：点击另一张卡片，使「{titleOf(linkFrom)}」<b>必须早于</b>它（Esc 取消）
        </div>
      )}

      <main className="main">
        {state ? (
          <>
            <Board
              state={state}
              conflict={conflict}
              linkFrom={linkFrom}
              slimHighlight={slimHighlight}
              onStartLink={setLinkFrom}
              onCancelLink={() => setLinkFrom(null)}
              onConnect={connect}
              onEdit={setEditing}
              onDelete={deleteCard}
              onDeleteEdge={deleteEdge}
            />
            <div className="sidebar">
              <SlimPanel
                report={slim}
                selectedEdgeId={selectedRedundantId}
                busy={busy}
                titleOf={titleOf}
                onSelect={setSelectedRedundantId}
                onApply={() => void applySlim()}
                onRefresh={refreshSlim}
              />
              <TimelinePanel state={state} />
            </div>
          </>
        ) : (
          <div className="loading">加载中…</div>
        )}
      </main>

      {editing !== null && (
        <CardForm
          initial={editing === 'new' ? null : editing}
          busy={busy}
          onSubmit={submitCard}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
