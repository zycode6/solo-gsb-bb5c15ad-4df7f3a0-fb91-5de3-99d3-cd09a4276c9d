import type { Redundancy } from '../types';

interface SlimPanelProps {
  report: { redundant: Redundancy[]; count: number } | null;
  selectedEdgeId: number | null;
  busy: boolean;
  titleOf: (id: string) => string;
  onSelect: (edgeId: number | null) => void;
  onApply: () => void;
  onRefresh: () => void;
}

/** 约束瘦身：逐条展示可被替代路径取代的冗余连线，确认后批量移除 */
export default function SlimPanel({ report, selectedEdgeId, busy, titleOf, onSelect, onApply, onRefresh }: SlimPanelProps) {
  const count = report?.count ?? 0;

  return (
    <section className="panel slim-panel">
      <div className="slim-head">
        <h2>
          约束瘦身
          <button className="slim-refresh" type="button" onClick={onRefresh} disabled={busy} title="重新检测冗余连线">
            ⟳
          </button>
        </h2>
      </div>

      {report === null ? (
        <p className="muted">正在检测冗余连线…</p>
      ) : count === 0 ? (
        <div className="slim-empty">
          <span className="slim-empty-mark">✓</span>
          <div>
            <strong>没有冗余连线</strong>
            <p className="muted">每条「必须早于」约束都不可由其他连线推导，时间线已是最简。</p>
          </div>
        </div>
      ) : (
        <>
          <p className="slim-intro">
            发现 <b className="slim-count">{count}</b> 条冗余连线：删掉它们后，证据间的先后（可达）关系完全不变。
            点击条目可在画布上同时查看原连线与替代路径。
          </p>
          <ul className="slim-list">
            {report.redundant.map((r) => {
              const active = selectedEdgeId === r.edgeId;
              const chain = r.alternativePath.map(titleOf).join(' → ');
              return (
                <li key={r.edgeId}>
                  <button
                    type="button"
                    className={`slim-item${active ? ' active' : ''}`}
                    onClick={() => onSelect(active ? null : r.edgeId)}
                  >
                    <span className="slim-item-edge">
                      <span className="ev-title">{titleOf(r.fromId)}</span>
                      <b>必须早于</b>
                      <span className="ev-title">{titleOf(r.toId)}</span>
                    </span>
                    <span className="slim-item-alt muted">替代路径（{r.alternativePath.length - 1} 跳）：{chain}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="btn primary slim-apply" type="button" onClick={onApply} disabled={busy}>
            批量移除 {count} 条冗余连线
          </button>
          <p className="muted slim-note">在单个事务中删除当前仍冗余的连线，并返回最新分层。</p>
        </>
      )}
    </section>
  );
}
