import { useState, useCallback, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#0a0a0f",
  surface: "#111118",
  card:    "#16161f",
  border:  "#1e1e2e",
  accent:  "#c8f04a",       // sharp lime‑yellow
  accentDim:"#8fb033",
  blue:    "#4a90e2",
  orange:  "#f0884a",
  red:     "#e25a5a",
  muted:   "#666680",
  text:    "#e8e8f0",
  textDim: "#9898b0",
};

// ── Finance helpers ───────────────────────────────────────────────────────────
function calcMonthlyPayment(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function buildAmortization(principal, annualRate, months, extraMonthly = 0) {
  const r = annualRate / 100 / 12;
  const basePayment = calcMonthlyPayment(principal, annualRate, months);
  const rows = [];
  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  while (balance > 0.01 && month < months) {
    month++;
    const interest = balance * r;
    const totalPayment = Math.min(basePayment + extraMonthly, balance + interest);
    const principal_paid = totalPayment - interest;
    balance = Math.max(0, balance - principal_paid);
    totalInterest += interest;

    rows.push({
      month,
      payment: totalPayment,
      principal: principal_paid,
      interest,
      balance,
      totalInterest,
      extra: extraMonthly > 0 ? extraMonthly : 0,
    });
    if (balance < 0.01) break;
  }
  return rows;
}

function fmtZAR(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return "R " + Math.round(n).toLocaleString("en-ZA");
}
function fmtShortZAR(n) {
  if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `R${(n / 1_000).toFixed(0)}k`;
  return `R${Math.round(n)}`;
}
function monthsToYearsMonths(m) {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return y > 0 ? `${y}y ${mo}m` : `${mo}m`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, accent, diff }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <span style={{ fontSize: 11, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase", fontFamily: "DM Mono" }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: accent ? C.accent : C.text, fontFamily: "Syne", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: C.textDim, fontFamily: "DM Mono" }}>{sub}</span>}
      {diff !== undefined && (
        <span style={{ fontSize: 12, color: diff < 0 ? C.accent : C.red, fontFamily: "DM Mono" }}>
          {diff < 0 ? `↓ saves ${fmtZAR(Math.abs(diff))}` : `↑ costs ${fmtZAR(diff)} more`}
        </span>
      )}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "DM Mono", fontSize: 12 }}>
      <div style={{ color: C.muted, marginBottom: 6 }}>Month {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtZAR(p.value)}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — SIMULATOR
// ══════════════════════════════════════════════════════════════════════════════
function SimulatorTab({ params, setParams }) {
  const [extra, setExtra] = useState(0);

  const baseline = useMemo(() => buildAmortization(params.principal, params.rate, params.term), [params]);
  const withExtra = useMemo(() => buildAmortization(params.principal, params.rate, params.term, extra), [params, extra]);

  const basePayment = calcMonthlyPayment(params.principal, params.rate, params.term);
  const baseTotalInterest = baseline[baseline.length - 1]?.totalInterest ?? 0;
  const extraTotalInterest = withExtra[withExtra.length - 1]?.totalInterest ?? 0;
  const interestSaved = baseTotalInterest - extraTotalInterest;
  const monthsSaved = baseline.length - withExtra.length;

  // Downsample to monthly markers (every 6 months) for chart
  const chartData = useMemo(() => {
    const out = [];
    const maxM = Math.max(baseline.length, withExtra.length);
    for (let i = 0; i < maxM; i += 3) {
      out.push({
        month: i + 1,
        base: baseline[i]?.balance ?? 0,
        extra: withExtra[i]?.balance ?? 0,
        baseInterest: baseline[i]?.totalInterest ?? baseTotalInterest,
        extraInterest: withExtra[i]?.totalInterest ?? extraTotalInterest,
      });
    }
    return out;
  }, [baseline, withExtra, baseTotalInterest, extraTotalInterest]);

  const splitData = useMemo(() => {
    return baseline.filter((_, i) => i % 6 === 0).map(r => ({
      month: r.month,
      interest: Math.round(r.interest),
      principal: Math.round(r.principal),
    }));
  }, [baseline]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* ── Input panel ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
          <Field label="Principal (ZAR)" value={params.principal} onChange={v => setParams(p => ({ ...p, principal: v }))} prefix="R" />
          <Field label="Interest Rate (%)" value={params.rate} onChange={v => setParams(p => ({ ...p, rate: v }))} step={0.05} />
          <Field label="Term (months)" value={params.term} onChange={v => setParams(p => ({ ...p, term: v }))} integer />
        </div>

        {/* Extra payment slider */}
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: "DM Mono", fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Extra monthly payment
            </span>
            <span style={{ fontFamily: "DM Mono", fontSize: 16, color: C.accent, fontWeight: 500 }}>
              {fmtZAR(extra)} / month
            </span>
          </div>
          <input
            type="range" min={0} max={30000} step={500} value={extra}
            onChange={e => setExtra(+e.target.value)}
            style={{ width: "100%", accentColor: C.accent, cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }}>R 0</span>
            <span style={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }}>R 30 000</span>
          </div>
        </div>

        {/* Quick presets */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[0, 500, 1000, 2000, 5000, 10000].map(v => (
            <button key={v} onClick={() => setExtra(v)} style={{
              fontFamily: "DM Mono", fontSize: 11, padding: "5px 12px", borderRadius: 6,
              border: `1px solid ${extra === v ? C.accent : C.border}`,
              background: extra === v ? C.accent + "18" : "transparent",
              color: extra === v ? C.accent : C.muted,
              cursor: "pointer", letterSpacing: "0.06em",
            }}>
              +{v === 0 ? "None" : `R${v.toLocaleString()}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Stat label="Base Monthly" value={fmtZAR(basePayment)} sub="required payment" />
        <Stat label="With Extra" value={fmtZAR(basePayment + extra)} sub={extra > 0 ? `+${fmtZAR(extra)} extra` : "no extra"} accent={extra > 0} />
        <Stat label="Payoff" value={monthsToYearsMonths(withExtra.length)} sub={extra > 0 ? `saves ${monthsToYearsMonths(monthsSaved)}` : `${withExtra.length} months`} accent={extra > 0} />
        <Stat label="Total Interest" value={fmtShortZAR(extraTotalInterest)} diff={extra > 0 ? -interestSaved : undefined} />
        <Stat label="Total Cost" value={fmtShortZAR(params.principal + extraTotalInterest)} sub="principal + interest" />
      </div>

      {/* ── Balance chart ── */}
      <ChartCard title="Remaining Balance Over Time">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="extraGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }}
              tickFormatter={v => `M${v}`} />
            <YAxis stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }}
              tickFormatter={fmtShortZAR} width={60} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }} />
            <Area type="monotone" dataKey="base" name="Base (no extra)" stroke={C.blue} fill="url(#baseGrad)" strokeWidth={2} dot={false} />
            {extra > 0 && <Area type="monotone" dataKey="extra" name={`+${fmtZAR(extra)}/mo`} stroke={C.accent} fill="url(#extraGrad)" strokeWidth={2} dot={false} />}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Interest split chart ── */}
      <ChartCard title="Monthly Interest vs Principal (Base Loan)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={splitData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }}
              tickFormatter={v => `M${v}`} />
            <YAxis stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }}
              tickFormatter={fmtShortZAR} width={60} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }} />
            <Bar dataKey="interest" name="Interest" stackId="a" fill={C.red} />
            <Bar dataKey="principal" name="Principal" stackId="a" fill={C.accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Amortization table ── */}
      <ChartCard title={`Amortization Schedule${extra > 0 ? ` (with +${fmtZAR(extra)}/mo)` : ""}`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Mono", fontSize: 12 }}>
            <thead>
              <tr>
                {["Month", "Payment", "Principal", "Interest", "Extra", "Balance"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: C.muted, borderBottom: `1px solid ${C.border}`, letterSpacing: "0.08em", fontWeight: 400, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withExtra.map((r, i) => (
                <tr key={r.month} style={{ background: i % 2 === 0 ? "transparent" : C.surface + "60" }}>
                  <td style={tdStyle}>{r.month}</td>
                  <td style={tdStyle}>{fmtZAR(r.payment)}</td>
                  <td style={{ ...tdStyle, color: C.accent }}>{fmtZAR(r.principal)}</td>
                  <td style={{ ...tdStyle, color: C.red }}>{fmtZAR(r.interest)}</td>
                  <td style={{ ...tdStyle, color: C.orange }}>{r.extra > 0 ? fmtZAR(r.extra) : "—"}</td>
                  <td style={tdStyle}>{fmtZAR(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

const tdStyle = { padding: "9px 14px", textAlign: "right", color: C.text, borderBottom: `1px solid ${C.border}18` };

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — REALITY TRACKER
// ══════════════════════════════════════════════════════════════════════════════
function TrackerTab({ params }) {
  const [startDate, setStartDate] = useState("2025-01");
  const [extraTarget, setExtraTarget] = useState(2000);
  const [entries, setEntries] = useState([]);
  const [inputExtra, setInputExtra] = useState("");
  const [editMonth, setEditMonth] = useState(null);

  const basePayment = calcMonthlyPayment(params.principal, params.rate, params.term);
  const projected = useMemo(() => buildAmortization(params.principal, params.rate, params.term, extraTarget), [params, extraTarget]);
  const baseline  = useMemo(() => buildAmortization(params.principal, params.rate, params.term, 0), [params]);

  // Build reality track
  const realityTrack = useMemo(() => {
    const r_month = params.rate / 100 / 12;
    let balance = params.principal;
    const rows = [];
    for (let i = 0; i < Math.max(projected.length, entries.length + 1); i++) {
      const interest = balance * r_month;
      const entry = entries[i];
      const extraPaid = entry?.extra ?? null;
      const totalPaid = extraPaid !== null ? basePayment + extraPaid : null;
      const principalPaid = totalPaid !== null ? Math.max(0, totalPaid - interest) : null;
      if (principalPaid !== null) balance = Math.max(0, balance - principalPaid);

      rows.push({
        month: i + 1,
        projected: projected[i]?.balance ?? 0,
        base: baseline[i]?.balance ?? 0,
        actual: extraPaid !== null ? balance : null,
        extraTarget,
        extraActual: extraPaid,
        actualBalance: extraPaid !== null ? balance : null,
      });
    }
    return rows;
  }, [params, projected, baseline, entries, basePayment, extraTarget]);

  const chartData = realityTrack.filter((_, i) => i % 3 === 0);

  const addOrEdit = () => {
    const monthIdx = editMonth !== null ? editMonth : entries.length;
    const updated = [...entries];
    updated[monthIdx] = { month: monthIdx + 1, extra: parseFloat(inputExtra) || 0 };
    setEntries(updated);
    setInputExtra("");
    setEditMonth(null);
  };

  const startYearMonth = (idx) => {
    const [y, m] = startDate.split("-").map(Number);
    const date = new Date(y, m - 1 + idx);
    return date.toLocaleString("en-ZA", { month: "short", year: "2-digit" });
  };

  const totalExtraProjected = projected.length * extraTarget;
  const totalExtraActual = entries.reduce((s, e) => s + (e?.extra ?? 0), 0);
  const trackedMonths = entries.filter(e => e !== undefined).length;
  const avgActual = trackedMonths > 0 ? totalExtraActual / trackedMonths : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Controls */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        <Field label="Loan Start Date" value={startDate} onChange={v => setStartDate(v)} type="month" />
        <Field label="Target Extra /month (R)" value={extraTarget} onChange={v => setExtraTarget(v)} prefix="R" />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat label="Months Tracked" value={trackedMonths} sub={`of ${projected.length} projected`} />
        <Stat label="Avg Extra Paid" value={fmtZAR(avgActual)} sub={`target: ${fmtZAR(extraTarget)}`} accent={avgActual >= extraTarget} />
        <Stat label="Total Extra Paid" value={fmtShortZAR(totalExtraActual)} sub={`target: ${fmtShortZAR(extraTarget * trackedMonths)}`} />
        <Stat label="Extra vs Target" value={totalExtraActual >= extraTarget * trackedMonths ? "On track ✓" : "Behind"} accent={totalExtraActual >= extraTarget * trackedMonths} />
      </div>

      {/* Balance comparison chart */}
      <ChartCard title="Balance: Projected vs Actual vs No-Extra">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }}
              tickFormatter={v => `M${v}`} />
            <YAxis stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }}
              tickFormatter={fmtShortZAR} width={60} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }} />
            <Line type="monotone" dataKey="base" name="No Extra" stroke={C.muted} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="projected" name={`Projected (+${fmtZAR(extraTarget)}/mo)`} stroke={C.blue} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke={C.accent} strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, value } = props;
                if (value === null) return null;
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={C.accent} />;
              }}
              connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly log */}
      <ChartCard title="Monthly Extra Payment Log">
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted, display: "block", marginBottom: 6, letterSpacing: "0.08em" }}>
              {editMonth !== null ? `EDITING MONTH ${editMonth + 1}` : `LOG MONTH ${entries.length + 1}`}
            </label>
            <input
              type="number"
              placeholder="Extra amount (R)"
              value={inputExtra}
              onChange={e => setInputExtra(e.target.value)}
              style={{
                fontFamily: "DM Mono", fontSize: 14, background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px",
                color: C.text, width: 180, outline: "none",
              }}
            />
          </div>
          <button onClick={addOrEdit} style={{
            fontFamily: "Syne", fontWeight: 600, fontSize: 13, padding: "11px 22px",
            background: C.accent, color: "#0a0a0f", border: "none", borderRadius: 8, cursor: "pointer",
          }}>
            {editMonth !== null ? "Update" : "Log Month"}
          </button>
          {editMonth !== null && (
            <button onClick={() => { setEditMonth(null); setInputExtra(""); }} style={{
              fontFamily: "DM Mono", fontSize: 12, padding: "11px 16px",
              background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer",
            }}>Cancel</button>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Mono", fontSize: 12 }}>
            <thead>
              <tr>
                {["Month", "Date", "Required", "Target Extra", "Actual Extra", "Variance", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: C.muted, borderBottom: `1px solid ${C.border}`, letterSpacing: "0.08em", fontWeight: 400, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(entries.length + 1, 6) }, (_, i) => {
                const entry = entries[i];
                const hasData = entry !== undefined;
                const variance = hasData ? entry.extra - extraTarget : null;
                const status = !hasData ? "—" : variance >= 0 ? "✓ On track" : "✗ Short";
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.surface + "50" }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{startYearMonth(i)}</td>
                    <td style={tdStyle}>{fmtZAR(basePayment)}</td>
                    <td style={{ ...tdStyle, color: C.blue }}>{fmtZAR(extraTarget)}</td>
                    <td style={{ ...tdStyle, color: hasData ? C.accent : C.muted }}>
                      {hasData ? fmtZAR(entry.extra) : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: variance === null ? C.muted : variance >= 0 ? C.accent : C.red }}>
                      {variance === null ? "—" : (variance >= 0 ? "+" : "") + fmtZAR(variance)}
                    </td>
                    <td style={{ ...tdStyle, color: !hasData ? C.muted : variance >= 0 ? C.accent : C.red, textAlign: "right" }}>{status}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      {hasData && (
                        <button onClick={() => { setEditMonth(i); setInputExtra(entry.extra); }}
                          style={{ fontFamily: "DM Mono", fontSize: 10, padding: "3px 8px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, cursor: "pointer" }}>
                          edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Extra paid bar chart */}
      {entries.length > 0 && (
        <ChartCard title="Extra Payments: Target vs Actual">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={entries.map((e, i) => ({ month: i + 1, actual: e?.extra ?? 0, target: extraTarget }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }} tickFormatter={v => `M${v}`} />
              <YAxis stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }} tickFormatter={fmtShortZAR} width={60} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }} />
              <ReferenceLine y={extraTarget} stroke={C.blue} strokeDasharray="4 4" label={{ value: "Target", fill: C.blue, fontFamily: "DM Mono", fontSize: 10 }} />
              <Bar dataKey="actual" name="Actual Extra" fill={C.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RATE CHANGE PANEL
// ══════════════════════════════════════════════════════════════════════════════
function RateChangePanel({ params, setParams }) {
  const [newRate, setNewRate] = useState(8.9);
  const [atMonth, setAtMonth] = useState(12);
  const [extra, setExtra] = useState(2000);

  const before = useMemo(() => buildAmortization(params.principal, params.rate, params.term, extra), [params, extra]);
  const balanceAtChange = before[atMonth - 1]?.balance ?? params.principal;
  const remainingMonths = params.term - atMonth;

  const after = useMemo(() => buildAmortization(balanceAtChange, newRate, remainingMonths, extra), [balanceAtChange, newRate, remainingMonths, extra]);

  const totalInterest = (before.slice(0, atMonth).reduce((s, r) => s + r.interest, 0)) +
    (after.reduce((s, r) => s + r.interest, 0));
  const newPayment = calcMonthlyPayment(balanceAtChange, newRate, remainingMonths);
  const oldPayment = calcMonthlyPayment(params.principal, params.rate, params.term);
  const saving = oldPayment - newPayment;

  const chartData = useMemo(() => {
    const combined = [];
    for (let i = 0; i < Math.max(before.length, atMonth + after.length); i++) {
      combined.push({
        month: i + 1,
        before: i < before.length ? before[i].balance : null,
        after: i >= atMonth ? after[i - atMonth]?.balance ?? null : null,
      });
    }
    return combined.filter((_, i) => i % 3 === 0);
  }, [before, after, atMonth]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        <Field label="Current Rate (%)" value={params.rate} onChange={v => setParams(p => ({ ...p, rate: v }))} step={0.05} />
        <Field label="New Rate After Drop (%)" value={newRate} onChange={setNewRate} step={0.05} />
        <Field label="Rate Drops at Month" value={atMonth} onChange={setAtMonth} integer />
        <Field label="Extra Payment /mo (R)" value={extra} onChange={setExtra} prefix="R" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat label="Current Payment" value={fmtZAR(oldPayment)} sub={`at ${params.rate}%`} />
        <Stat label="New Payment" value={fmtZAR(newPayment)} sub={`at ${newRate}% from M${atMonth}`} accent />
        <Stat label="Monthly Saving" value={fmtZAR(saving)} sub="after rate drop" accent={saving > 0} />
        <Stat label={`Balance at M${atMonth}`} value={fmtShortZAR(balanceAtChange)} sub="when rate changes" />
        <Stat label="Total Interest" value={fmtShortZAR(totalInterest)} sub="over full term" />
      </div>

      <ChartCard title="Balance Trajectory with Rate Change">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }} tickFormatter={v => `M${v}`} />
            <YAxis stroke={C.muted} tick={{ fontFamily: "DM Mono", fontSize: 10, fill: C.muted }} tickFormatter={fmtShortZAR} width={60} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }} />
            <ReferenceLine x={atMonth} stroke={C.orange} strokeDasharray="4 4" label={{ value: `Rate → ${newRate}%`, fill: C.orange, fontFamily: "DM Mono", fontSize: 10 }} />
            <Line type="monotone" dataKey="before" name={`Before (${params.rate}%)`} stroke={C.red} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="after" name={`After (${newRate}%)`} stroke={C.accent} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function ChartCard({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
      <div style={{ fontFamily: "Syne", fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 20, letterSpacing: "0.02em" }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, prefix, step = 1, integer = false, type = "number" }) {
  return (
    <div>
      <label style={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted, display: "block", marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "10px 12px", fontFamily: "DM Mono", fontSize: 13, color: C.muted, borderRight: `1px solid ${C.border}` }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(type === "month" ? e.target.value : (integer ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0))}
          step={step}
          style={{ fontFamily: "DM Mono", fontSize: 14, background: "transparent", border: "none", padding: "10px 14px", color: C.text, width: "100%", outline: "none" }}
        />
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
const TABS = ["Simulator", "Rate Change", "Reality Tracker"];

export default function App() {
  const [tab, setTab] = useState(0);
  const [params, setParams] = useState({
    principal: 2_420_000,
    rate: 9.25,
    term: 360,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Syne" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: C.accent }}>BOND</span>
            <span style={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted, letterSpacing: "0.14em" }}>SIMULATOR</span>
          </div>
          <div style={{ fontFamily: "DM Mono", fontSize: 11, color: C.muted }}>
            R{(params.principal / 1_000_000).toFixed(2)}m · {params.rate}% · {params.term}mo
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px" }}>
        {/* Tab nav */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, width: "fit-content" }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              fontFamily: "Syne", fontWeight: 600, fontSize: 13, padding: "9px 22px", borderRadius: 7,
              border: "none", cursor: "pointer", letterSpacing: "0.01em", transition: "all 0.15s",
              background: tab === i ? C.accent : "transparent",
              color: tab === i ? "#0a0a0f" : C.textDim,
            }}>{t}</button>
          ))}
        </div>

        {/* Content */}
        {tab === 0 && <SimulatorTab params={params} setParams={setParams} />}
        {tab === 1 && <RateChangePanel params={params} setParams={setParams} />}
        {tab === 2 && <TrackerTab params={params} />}
      </div>
    </div>
  );
}
