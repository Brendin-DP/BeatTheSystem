import { useState, useMemo, createContext, useContext, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

// ── Design tokens (light) ──────────────────────────────────────────────────────
const C = {
  bg: "#ffffff",
  bgSubtle: "#f9fafb",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#d0d5dd",
  borderLight: "#eaecf0",
  primary: "#7f56d9",
  primaryHover: "#6941c6",
  text: "#101828",
  textSecondary: "#344054",
  textTertiary: "#475467",
  blue: "#7f56d9",
  green: "#039855",
  red: "#d92d20",
  orange: "#dc6803",
  shadow: "0px 1px 2px rgba(16,24,40,0.05)",
};

// ── Design tokens (dark) ───────────────────────────────────────────────────────
const C_DARK = {
  bg: "#0f1117",
  bgSubtle: "#16181d",
  surface: "#1a1d24",
  card: "#1a1d24",
  border: "#2d323e",
  borderLight: "#252830",
  primary: "#9f7aea",
  primaryHover: "#b794f6",
  text: "#f0f1f3",
  textSecondary: "#a8adb5",
  textTertiary: "#6b7280",
  blue: "#9f7aea",
  green: "#34d399",
  red: "#f87171",
  orange: "#fb923c",
  shadow: "0px 1px 2px rgba(0,0,0,0.3)",
};

// ── Total IDs for per-field visibility ─────────────────────────────────────────
const ALL_TOTAL_IDS = [
  "header-principal", "sim-base-monthly", "sim-with-extra", "sim-lump-sum", "sim-payoff",
  "sim-total-interest", "sim-total-cost", "sim-interest-saved", "sim-chart-balance",
  "sim-chart-split", "sim-amortization-table",
  "track-months-tracked", "track-avg-extra", "track-total-extra", "track-total-lump-sum",
  "track-extra-vs-target", "track-chart", "track-table", "track-bar-chart",
  "rate-current-payment", "rate-new-payment", "rate-monthly-saving", "rate-balance",
  "rate-total-interest", "rate-chart",
];

// ── Theme context ──────────────────────────────────────────────────────────────
const defaultVisible = () => {
  try {
    const saved = localStorage.getItem("bond-visible-totals");
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return {};
};

const ThemeContext = createContext({
  theme: "light", setTheme: () => {}, tokens: C,
  visibleTotals: {}, setVisibleTotal: () => {}, toggleTotal: () => {}, viewAll: () => {}, hideAll: () => {},
  isVisible: () => false, fmtZAR: (n) => "", fmtShortZAR: (n) => "",
});

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("bond-theme") || "light");
  const [visibleTotals, setVisibleTotals] = useState(defaultVisible);
  const tokens = theme === "dark" ? C_DARK : C;

  useEffect(() => { localStorage.setItem("bond-theme", theme); }, [theme]);
  useEffect(() => { try { localStorage.setItem("bond-visible-totals", JSON.stringify(visibleTotals)); } catch (_) {} }, [visibleTotals]);

  const isVisible = (id) => !!visibleTotals[id];
  const setVisibleTotal = (id, visible) => setVisibleTotals(v => ({ ...v, [id]: visible }));
  const toggleTotal = (id) => setVisibleTotal(id, !isVisible(id));
  const viewAll = () => setVisibleTotals(ALL_TOTAL_IDS.reduce((a, id) => ({ ...a, [id]: true }), {}));
  const hideAll = () => setVisibleTotals({});

  const fmtZAR = useMemo(() => (n, totalId) => {
    if (totalId && !visibleTotals[totalId]) return "••••";
    return fmtZARRaw(n);
  }, [visibleTotals]);
  const fmtShortZAR = useMemo(() => (n, totalId) => {
    if (totalId && !visibleTotals[totalId]) return "••••";
    return fmtShortZARRaw(n);
  }, [visibleTotals]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, tokens, visibleTotals, setVisibleTotal, toggleTotal, viewAll, hideAll, isVisible, fmtZAR, fmtShortZAR }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

// ── Finance helpers ───────────────────────────────────────────────────────────
function calcMonthlyPayment(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function buildAmortization(principal, annualRate, months, extraMonthly = 0, lumpSums = {}) {
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

    const lumpSum = lumpSums[month] ?? 0;
    if (lumpSum > 0) balance = Math.max(0, balance - lumpSum);

    totalInterest += interest;

    rows.push({
      month,
      payment: totalPayment,
      principal: principal_paid,
      interest,
      balance,
      totalInterest,
      extra: extraMonthly > 0 ? extraMonthly : 0,
      lumpSum,
    });
    if (balance < 0.01) break;
  }
  return rows;
}

function fmtZARRaw(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return "R " + Math.round(n).toLocaleString("en-ZA");
}
function fmtShortZARRaw(n) {
  if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `R${(n / 1_000).toFixed(0)}k`;
  return `R${Math.round(n)}`;
}
function monthsToYearsMonths(m) {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return y > 0 ? `${y}y ${mo}m` : `${mo}m`;
}

// ── Stat card (with per-total eye) ─────────────────────────────────────────────
function Stat({ label, value, sub, accent, diff, totalId }) {
  const { tokens: T, fmtZAR, isVisible, toggleTotal } = useTheme();
  const revealed = !totalId || isVisible(totalId);
  const displayValue = revealed ? value : "••••";
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.shadow,
      padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: T.textTertiary, fontFamily: "Inter" }}>{label}</span>
        {totalId && (
          <button
            onClick={() => toggleTotal(totalId)}
            title={revealed ? "Hide" : "Reveal"}
            style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}
          >
            {revealed ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}
      </div>
      <span style={{ fontSize: 26, fontWeight: 600, color: accent ? T.primary : T.text, fontFamily: "Inter", lineHeight: 1 }}>{displayValue}</span>
      {sub && <span style={{ fontSize: 14, color: T.textSecondary, fontFamily: "Inter" }}>{sub}</span>}
      {diff !== undefined && (
        <span style={{ fontSize: 14, color: diff < 0 ? T.green : T.red, fontFamily: "Inter" }}>
          {diff < 0 ? `↓ saves ${fmtZAR(Math.abs(diff), totalId)}` : `↑ costs ${fmtZAR(diff, totalId)} more`}
        </span>
      )}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, chartId }) {
  const { tokens: T, fmtZAR } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", boxShadow: T.shadow, fontFamily: "Inter", fontSize: 14 }}>
      <div style={{ color: T.textTertiary, marginBottom: 6 }}>Month {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtZAR(p.value, chartId)}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — SIMULATOR
// ══════════════════════════════════════════════════════════════════════════════
function SimulatorTab({ params, setParams }) {
  const { tokens: T, fmtZAR, fmtShortZAR, isVisible, toggleTotal } = useTheme();
  const [extra, setExtra] = useState(0);
  const [lumpSumEntries, setLumpSumEntries] = useState([]);
  const [scheduleTab, setScheduleTab] = useState(0);

  const lumpSums = useMemo(() => {
    const out = {};
    for (const e of lumpSumEntries) {
      if (e.amount > 0 && e.month >= 1) out[e.month] = (out[e.month] ?? 0) + e.amount;
    }
    return out;
  }, [lumpSumEntries]);

  const totalLumpSum = useMemo(() => Object.values(lumpSums).reduce((a, b) => a + b, 0), [lumpSums]);
  const hasLumpSums = lumpSumEntries.some(e => e.amount > 0);

  const baseline = useMemo(() => buildAmortization(params.principal, params.rate, params.term), [params]);
  const withExtra = useMemo(() => buildAmortization(params.principal, params.rate, params.term, extra, lumpSums), [params, extra, lumpSums]);

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

  const getTdStyle = (tok) => ({ padding: "16px 24px", textAlign: "right", color: tok.text, borderBottom: `1px solid ${tok.borderLight}`, fontFamily: "Inter" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* ── Input panel ── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 24, boxShadow: T.shadow }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 24 }}>
          <Field label="Principal (ZAR)" value={params.principal} onChange={v => setParams(p => ({ ...p, principal: v }))} prefix="R" />
          <div>
            <Field label="Interest Rate (%)" value={params.rate} onChange={v => setParams(p => ({ ...p, rate: v }))} step={0.05} />
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {[8, 9, 10, 11].map(r => (
                <button key={r} onClick={() => setParams(p => ({ ...p, rate: r }))} style={{
                  fontFamily: "Inter", fontSize: 12, padding: "4px 10px", borderRadius: 6,
                  border: `1px solid ${params.rate === r ? T.primary : T.border}`,
                  background: params.rate === r ? T.bgSubtle : "transparent", color: params.rate === r ? T.primary : T.textSecondary,
                  cursor: "pointer",
                }}>{r}%</button>
              ))}
            </div>
          </div>
          <Field label="Term (months)" value={params.term} onChange={v => setParams(p => ({ ...p, term: v }))} integer />
        </div>

        {/* Extra payment: slider + manual input */}
        <ExtraPaymentControl value={extra} onChange={setExtra} />

        {/* Quick presets */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[0, 500, 1000, 2000, 5000, 10000].map(v => (
            <button key={v} onClick={() => setExtra(v)} style={{
              fontFamily: "Inter", fontSize: 14, fontWeight: 500, padding: "8px 16px", borderRadius: 8,
              border: `1px solid ${extra === v ? T.primary : T.border}`,
              background: extra === v ? T.bgSubtle : T.card,
              color: extra === v ? T.primary : T.textSecondary,
              cursor: "pointer", minHeight: 40, boxShadow: extra === v ? "none" : T.shadow,
            }}>
              +{v === 0 ? "None" : `R${v.toLocaleString()}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Interest saved hero card ── */}
      {(extra > 0 || hasLumpSums) && interestSaved > 0 && (
        <div style={{ background: T.primary, color: "white", borderRadius: 8, padding: 24, boxShadow: T.shadow, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9, marginBottom: 4 }}>INTEREST SAVED</div>
            <button onClick={() => toggleTotal("sim-interest-saved")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.9)" }}>
              {isVisible("sim-interest-saved") ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtZAR(interestSaved, "sim-interest-saved")}</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {extra > 0 && hasLumpSums && `+${fmtZAR(extra, "sim-interest-saved")}/mo + ${fmtZAR(totalLumpSum, "sim-interest-saved")} lump sum(s)`}
            {extra > 0 && !hasLumpSums && `By paying +${fmtZAR(extra, "sim-interest-saved")}/month extra`}
            {extra <= 0 && hasLumpSums && `${fmtZAR(totalLumpSum, "sim-interest-saved")} lump sum(s) to principal`}
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Stat label="Base Monthly" value={fmtZAR(basePayment, "sim-base-monthly")} sub="required payment" totalId="sim-base-monthly" />
        <Stat label="With Extra" value={fmtZAR(basePayment + extra, "sim-with-extra")} sub={extra > 0 ? `+${fmtZAR(extra, "sim-with-extra")} extra` : "no extra"} accent={extra > 0} totalId="sim-with-extra" />
        <Stat label="Lump Sum" value={hasLumpSums ? fmtZAR(totalLumpSum, "sim-lump-sum") : "—"} sub={hasLumpSums ? `${lumpSumEntries.filter(e => e.amount > 0).length} entry(ies)` : "none"} accent={hasLumpSums} totalId="sim-lump-sum" />
        <Stat label="Payoff" value={monthsToYearsMonths(withExtra.length)} sub={(extra > 0 || hasLumpSums) ? `saves ${monthsToYearsMonths(monthsSaved)}` : `${withExtra.length} months`} accent={extra > 0 || hasLumpSums} totalId="sim-payoff" />
        <Stat label="Total Interest" value={fmtShortZAR(extraTotalInterest, "sim-total-interest")} diff={(extra > 0 || hasLumpSums) ? -interestSaved : undefined} totalId="sim-total-interest" />
        <Stat label="Total Cost" value={fmtShortZAR(params.principal + extraTotalInterest, "sim-total-cost")} sub="principal + interest" totalId="sim-total-cost" />
      </div>

      {/* ── Balance chart ── */}
      <ChartCard title="Remaining Balance Over Time" titleAction={
        <button onClick={() => toggleTotal("sim-chart-balance")} title={isVisible("sim-chart-balance") ? "Hide" : "Reveal"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
          {isVisible("sim-chart-balance") ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      }>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="extraGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.primary} stopOpacity={0.4} />
                <stop offset="95%" stopColor={T.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }}
              tickFormatter={v => `M${v}`} />
            <YAxis stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }}
              tickFormatter={v => fmtShortZAR(v, "sim-chart-balance")} width={60} />
            <Tooltip content={<ChartTip chartId="sim-chart-balance" />} />
            <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: T.textSecondary }} />
            <Area type="monotone" dataKey="base" name="Base (no extra)" stroke={T.blue} fill="url(#baseGrad)" strokeWidth={2} dot={false} />
            {(extra > 0 || hasLumpSums) && (
              <Area
                type="monotone"
                dataKey="extra"
                name={extra > 0 && hasLumpSums ? `+${fmtZAR(extra, "sim-chart-balance")}/mo + lump` : extra > 0 ? `+${fmtZAR(extra, "sim-chart-balance")}/mo` : `${fmtZAR(totalLumpSum, "sim-chart-balance")} lump sum(s)`}
                stroke={T.primary}
                fill="url(#extraGrad)"
                strokeWidth={2}
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Interest split chart ── */}
      <ChartCard title="Monthly Interest vs Principal (Base Loan)" titleAction={
        <button onClick={() => toggleTotal("sim-chart-split")} title={isVisible("sim-chart-split") ? "Hide" : "Reveal"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
          {isVisible("sim-chart-split") ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      }>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={splitData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }}
              tickFormatter={v => `M${v}`} />
            <YAxis stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }}
              tickFormatter={v => fmtShortZAR(v, "sim-chart-split")} width={60} />
            <Tooltip content={<ChartTip chartId="sim-chart-split" />} />
            <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: T.textSecondary }} />
            <Bar dataKey="interest" name="Interest" stackId="a" fill={T.red} />
            <Bar dataKey="principal" name="Principal" stackId="a" fill={T.primary} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Amortization / Lump Sum (tabbed) ── */}
      <ChartCard title={scheduleTab === 0 ? `Amortization Schedule${extra > 0 || hasLumpSums ? ` (with +${fmtZAR(extra, "sim-amortization-table")}/mo${hasLumpSums ? ` + ${fmtZAR(totalLumpSum, "sim-amortization-table")} lump` : ""})` : ""}` : "Lump Sum Payments"} titleAction={scheduleTab === 0 && (
          <button onClick={() => toggleTotal("sim-amortization-table")} title={isVisible("sim-amortization-table") ? "Hide table" : "Reveal table"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
            {isVisible("sim-amortization-table") ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, padding: 4, background: T.bgSubtle }}>
            {["Amortization", "Lump Sum"].map((label, i) => (
              <button
                key={label}
                onClick={() => setScheduleTab(i)}
                style={{
                  fontFamily: "Inter", fontWeight: 600, fontSize: 13, padding: "8px 16px", borderRadius: 6,
                  border: "none", cursor: "pointer", background: scheduleTab === i ? T.card : "transparent",
                  color: scheduleTab === i ? T.primary : T.textSecondary, boxShadow: scheduleTab === i ? T.shadow : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {scheduleTab === 0 && (
            <button
              onClick={() => {
                const headers = "Month,Payment,Principal,Interest,Extra,Lump Sum,Balance\n";
                const rows = withExtra.map(r => `${r.month},${r.payment.toFixed(0)},${r.principal.toFixed(0)},${r.interest.toFixed(0)},${r.extra},${r.lumpSum ?? 0},${r.balance.toFixed(0)}`).join("\n");
                const blob = new Blob([headers + rows], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "amortization-schedule.csv";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              style={{
                fontFamily: "Inter", fontSize: 13, fontWeight: 500, padding: "8px 16px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.card, color: T.textSecondary, cursor: "pointer",
              }}
            >
              Export CSV
            </button>
          )}
        </div>

        {scheduleTab === 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Month", "Payment", "Principal", "Interest", "Extra", "Lump Sum", "Balance"].map(h => (
                    <th key={h} style={{ padding: "16px 24px", textAlign: "right", color: T.textTertiary, borderBottom: `1px solid ${T.borderLight}`, fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withExtra.map((r, i) => (
                  <tr key={r.month} style={{ background: i % 2 === 0 ? "transparent" : T.bgSubtle }}>
                    <td style={getTdStyle(T)}>{r.month}</td>
                    <td style={getTdStyle(T)}>{fmtZAR(r.payment, "sim-amortization-table")}</td>
                    <td style={{ ...getTdStyle(T), color: T.primary }}>{fmtZAR(r.principal, "sim-amortization-table")}</td>
                    <td style={{ ...getTdStyle(T), color: T.red }}>{fmtZAR(r.interest, "sim-amortization-table")}</td>
                    <td style={{ ...getTdStyle(T), color: T.orange }}>{r.extra > 0 ? fmtZAR(r.extra, "sim-amortization-table") : "—"}</td>
                    <td style={{ ...getTdStyle(T), color: (r.lumpSum ?? 0) > 0 ? T.orange : T.textTertiary }}>{(r.lumpSum ?? 0) > 0 ? fmtZAR(r.lumpSum, "sim-amortization-table") : "—"}</td>
                    <td style={getTdStyle(T)}>{fmtZAR(r.balance, "sim-amortization-table")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LumpSumEditor entries={lumpSumEntries} setEntries={setLumpSumEntries} maxMonth={params.term} />
        )}
      </ChartCard>
    </div>
  );
}

// ── Lump sum editor (multiple entries) ──────────────────────────────────────
function LumpSumEditor({ entries, setEntries, maxMonth }) {
  const { tokens: T } = useTheme();
  const [newMonth, setNewMonth] = useState("12");
  const [newAmount, setNewAmount] = useState("");
  const [editingCell, setEditingCell] = useState(null); // { i, field }
  const [editingVal, setEditingVal] = useState("");

  const addEntry = () => {
    const amt = parseFloat(String(newAmount).replace(/\s/g, "").replace(",", "")) || 0;
    if (amt <= 0) return;
    const m = Math.max(1, Math.min(maxMonth, parseInt(String(newMonth), 10) || 1));
    setEntries([...entries, { month: m, amount: amt }]);
    setNewAmount("");
  };

  const removeEntry = (idx) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const commitEdit = (idx, field, str) => {
    const v = field === "month"
      ? Math.max(1, Math.min(maxMonth, parseInt(String(str), 10) || 1))
      : (parseFloat(String(str).replace(/\s/g, "").replace(",", "")) || 0);
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: v };
    setEntries(updated);
  };

  const cellVal = (e, i, field) => {
    if (editingCell && editingCell.i === i && editingCell.field === field) return editingVal;
    const v = e[field];
    return v === 0 ? "" : String(v);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontFamily: "Inter", fontSize: 12, color: T.textTertiary, display: "block", marginBottom: 4 }}>Amount (R)</label>
          <input
            type="text"
            inputMode="numeric"
            value={newAmount}
            onChange={e => setNewAmount(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addEntry()}
            placeholder="e.g. 50000"
            style={{
              fontFamily: "Inter", fontSize: 14, background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: "10px 14px", color: T.text, width: 140, outline: "none", minHeight: 40,
            }}
          />
        </div>
        <div>
          <label style={{ fontFamily: "Inter", fontSize: 12, color: T.textTertiary, display: "block", marginBottom: 4 }}>At month</label>
          <input
            type="text"
            inputMode="numeric"
            value={newMonth}
            onChange={e => setNewMonth(e.target.value)}
            onBlur={e => setNewMonth(String(Math.max(1, Math.min(maxMonth, parseInt(e.target.value, 10) || 1))))}
            placeholder="12"
            style={{
              fontFamily: "Inter", fontSize: 14, background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: "10px 14px", color: T.text, width: 90, outline: "none", minHeight: 40,
            }}
          />
        </div>
        <button onClick={addEntry} style={{
          fontFamily: "Inter", fontWeight: 600, fontSize: 14, padding: "10px 18px", minHeight: 40,
          background: T.primary, color: "white", border: "none", borderRadius: 8, cursor: "pointer", boxShadow: T.shadow,
        }}>
          Add
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ padding: "12px 16px", textAlign: "left", color: T.textTertiary, borderBottom: `1px solid ${T.borderLight}`, fontWeight: 500, fontSize: 12 }}>Month</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: T.textTertiary, borderBottom: `1px solid ${T.borderLight}`, fontWeight: 500, fontSize: 12 }}>Amount</th>
              <th style={{ padding: "12px 16px", width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 24, color: T.textTertiary, fontFamily: "Inter", fontSize: 14 }}>
                  No lump sum entries. Add payments to principal above.
                </td>
              </tr>
            ) : (
              entries.map((e, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : T.bgSubtle }}>
                  <td style={{ padding: "12px 16px" }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cellVal(e, i, "month")}
                      onFocus={() => { setEditingCell({ i, field: "month" }); setEditingVal(e.month === 0 ? "" : String(e.month)); }}
                      onChange={ev => setEditingVal(ev.target.value)}
                      onBlur={ev => { commitEdit(i, "month", ev.target.value); setEditingCell(null); }}
                      style={{
                        fontFamily: "Inter", fontSize: 14, background: T.card, border: `1px solid ${T.border}`,
                        borderRadius: 6, padding: "6px 10px", color: T.text, width: 70, outline: "none",
                      }}
                    />
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cellVal(e, i, "amount")}
                      onFocus={() => { setEditingCell({ i, field: "amount" }); setEditingVal(e.amount === 0 ? "" : String(e.amount)); }}
                      onChange={ev => setEditingVal(ev.target.value)}
                      onBlur={ev => { commitEdit(i, "amount", ev.target.value); setEditingCell(null); }}
                      style={{
                        fontFamily: "Inter", fontSize: 14, background: T.card, border: `1px solid ${T.border}`,
                        borderRadius: 6, padding: "6px 10px", color: T.orange, width: 120, outline: "none", textAlign: "right",
                      }}
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => removeEntry(i)}
                      style={{ fontFamily: "Inter", fontSize: 12, padding: "4px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, color: T.red, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Extra payment control (slider + manual input) ─────────────────────────────
function ExtraPaymentControl({ value, onChange }) {
  const { tokens: T } = useTheme();
  const SLIDER_MAX = 50000;
  const [inputStr, setInputStr] = useState("");
  const [focused, setFocused] = useState(false);

  const displayValue = focused ? inputStr : value.toLocaleString("en-ZA", { maximumFractionDigits: 0 });

  const commitInput = () => {
    const parsed = Math.max(0, parseFloat(String(inputStr).replace(/\s/g, "").replace(",", "")) || 0);
    const clamped = Math.min(1000000, parsed);
    onChange(clamped);
    setInputStr("");
    setFocused(false);
  };

  const handleFocus = () => {
    setInputStr(String(value));
    setFocused(true);
  };

  const handleBlur = () => commitInput();

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commitInput();
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: T.textSecondary }}>
          Extra monthly payment
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "Inter", fontSize: 14, color: T.textTertiary }}>R</span>
          <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={e => {
              const str = e.target.value;
              setInputStr(str);
              const parsed = Math.max(0, parseFloat(String(str).replace(/\s/g, "").replace(",", "")) || 0);
              const clamped = Math.min(1000000, parsed);
              onChange(clamped);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              fontFamily: "Inter", fontSize: 16, fontWeight: 600, color: T.primary, width: 120,
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "8px 12px", outline: "none", textAlign: "right",
            }}
          />
          <span style={{ fontFamily: "Inter", fontSize: 14, color: T.textTertiary }}>/ month</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={SLIDER_MAX}
        step={500}
        value={Math.min(value, SLIDER_MAX)}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: T.primary, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontFamily: "Inter", fontSize: 12, color: T.textTertiary }}>R 0</span>
        <span style={{ fontFamily: "Inter", fontSize: 12, color: T.textTertiary }}>R {SLIDER_MAX.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — REALITY TRACKER
// ══════════════════════════════════════════════════════════════════════════════
function TrackerTab({ params }) {
  const { tokens: T, fmtZAR, fmtShortZAR, isVisible, toggleTotal } = useTheme();
  const [startDate, setStartDate] = useState("2026-07");
  const [extraTarget, setExtraTarget] = useState(2000);
  const [entries, setEntries] = useState([]);
  const [inputExtra, setInputExtra] = useState("");
  const [inputLumpSum, setInputLumpSum] = useState("");
  const [editMonth, setEditMonth] = useState(null);

  const basePayment = calcMonthlyPayment(params.principal, params.rate, params.term);
  const projected = useMemo(() => buildAmortization(params.principal, params.rate, params.term, extraTarget), [params, extraTarget]);
  const baseline  = useMemo(() => buildAmortization(params.principal, params.rate, params.term, 0), [params]);

  // Build reality track (includes lump sum payments to principal)
  const realityTrack = useMemo(() => {
    const r_month = params.rate / 100 / 12;
    let balance = params.principal;
    const rows = [];
    for (let i = 0; i < Math.max(projected.length, entries.length + 1); i++) {
      const interest = balance * r_month;
      const entry = entries[i];
      const extraPaid = entry?.extra ?? null;
      const lumpSum = entry?.lumpSum ?? 0;
      const totalPaid = extraPaid !== null ? basePayment + extraPaid : null;
      const principalPaid = totalPaid !== null ? Math.max(0, totalPaid - interest) : null;
      if (principalPaid !== null) balance = Math.max(0, balance - principalPaid);
      if (lumpSum > 0) balance = Math.max(0, balance - lumpSum);

      rows.push({
        month: i + 1,
        projected: projected[i]?.balance ?? 0,
        base: baseline[i]?.balance ?? 0,
        actual: extraPaid !== null ? balance : null,
        extraTarget,
        extraActual: extraPaid,
        lumpSum,
        actualBalance: extraPaid !== null ? balance : null,
      });
    }
    return rows;
  }, [params, projected, baseline, entries, basePayment, extraTarget]);

  const chartData = realityTrack.filter((_, i) => i % 3 === 0);

  const addOrEdit = () => {
    const monthIdx = editMonth !== null ? editMonth : entries.length;
    const updated = [...entries];
    updated[monthIdx] = {
      month: monthIdx + 1,
      extra: parseFloat(inputExtra) || 0,
      lumpSum: parseFloat(inputLumpSum) || 0,
    };
    setEntries(updated);
    setInputExtra("");
    setInputLumpSum("");
    setEditMonth(null);
  };

  const startYearMonth = (idx) => {
    const [y, m] = startDate.split("-").map(Number);
    const date = new Date(y, m - 1 + idx);
    return date.toLocaleString("en-ZA", { month: "short", year: "2-digit" });
  };

  const totalExtraProjected = projected.length * extraTarget;
  const totalExtraActual = entries.reduce((s, e) => s + (e?.extra ?? 0), 0);
  const totalLumpSumActual = entries.reduce((s, e) => s + (e?.lumpSum ?? 0), 0);
  const trackedMonths = entries.filter(e => e !== undefined).length;
  const avgActual = trackedMonths > 0 ? totalExtraActual / trackedMonths : 0;
  const getTdStyle = (tok) => ({ padding: "16px 24px", textAlign: "right", color: tok.text, borderBottom: `1px solid ${tok.borderLight}`, fontFamily: "Inter" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Controls */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 24, boxShadow: T.shadow, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        <Field label="Loan Start Date" value={startDate} onChange={v => setStartDate(v)} type="month" />
        <Field label="Target Extra /month (R)" value={extraTarget} onChange={v => setExtraTarget(v)} prefix="R" />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
        <Stat label="Months Tracked" value={trackedMonths} sub={`of ${projected.length} projected`} totalId="track-months-tracked" />
        <Stat label="Avg Extra Paid" value={fmtZAR(avgActual, "track-avg-extra")} sub={`target: ${fmtZAR(extraTarget, "track-avg-extra")}`} accent={avgActual >= extraTarget} totalId="track-avg-extra" />
        <Stat label="Total Extra Paid" value={fmtShortZAR(totalExtraActual, "track-total-extra")} sub={`target: ${fmtShortZAR(extraTarget * trackedMonths, "track-total-extra")}`} totalId="track-total-extra" />
        <Stat label="Total Lump Sum" value={fmtShortZAR(totalLumpSumActual, "track-total-lump-sum")} sub="to principal" accent={totalLumpSumActual > 0} totalId="track-total-lump-sum" />
        <Stat label="Extra vs Target" value={totalExtraActual >= extraTarget * trackedMonths ? "On track ✓" : "Behind"} accent={totalExtraActual >= extraTarget * trackedMonths} totalId="track-extra-vs-target" />
      </div>

      {/* Balance comparison chart */}
      <ChartCard title="Balance: Projected vs Actual vs No-Extra" titleAction={
        <button onClick={() => toggleTotal("track-chart")} title={isVisible("track-chart") ? "Hide chart" : "Reveal chart"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
          {isVisible("track-chart") ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      }>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }}
              tickFormatter={v => `M${v}`} />
            <YAxis stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }}
              tickFormatter={v => fmtShortZAR(v, "track-chart")} width={60} />
            <Tooltip content={<ChartTip chartId="track-chart" />} />
            <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: T.textSecondary }} />
            <Line type="monotone" dataKey="base" name="No Extra" stroke={T.textTertiary} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="projected" name={`Projected (+${fmtZAR(extraTarget, "track-chart")}/mo)`} stroke={T.blue} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke={T.primary} strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, value } = props;
                if (value === null) return null;
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={T.primary} />;
              }}
              connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly log */}
      <ChartCard title="Monthly Extra Payment Log" titleAction={
        <button onClick={() => toggleTotal("track-table")} title={isVisible("track-table") ? "Hide table" : "Reveal table"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
          {isVisible("track-table") ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      }>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: T.textSecondary, display: "block", marginBottom: 6 }}>
              {editMonth !== null ? `EDITING MONTH ${editMonth + 1}` : `LOG MONTH ${entries.length + 1}`}
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Extra (R)"
                value={inputExtra}
                onChange={e => setInputExtra(e.target.value)}
                style={{
                  fontFamily: "Inter", fontSize: 14, background: T.card,
                  border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px",
                  color: T.text, width: 140, outline: "none", minHeight: 40,
                }}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Lump sum (R)"
                value={inputLumpSum}
                onChange={e => setInputLumpSum(e.target.value)}
                style={{
                  fontFamily: "Inter", fontSize: 14, background: T.card,
                  border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px",
                  color: T.text, width: 140, outline: "none", minHeight: 40,
                }}
              />
            </div>
          </div>
          <button onClick={addOrEdit} style={{
            fontFamily: "Inter", fontWeight: 600, fontSize: 14, padding: "10px 16px", minHeight: 40,
            background: T.primary, color: "white", border: "none", borderRadius: 8, cursor: "pointer", boxShadow: T.shadow,
          }}>
            {editMonth !== null ? "Update" : "Log Month"}
          </button>
          {editMonth !== null && (
            <button onClick={() => { setEditMonth(null); setInputExtra(""); setInputLumpSum(""); }} style={{
              fontFamily: "Inter", fontSize: 14, fontWeight: 500, padding: "10px 16px", minHeight: 40,
              background: T.card, color: T.textSecondary, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer",
            }}>Cancel</button>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter", fontSize: 14 }}>
            <thead>
              <tr>
                {["Month", "Date", "Required", "Target Extra", "Actual Extra", "Lump Sum", "Variance", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "16px 24px", textAlign: "right", color: T.textTertiary, borderBottom: `1px solid ${T.borderLight}`, fontWeight: 500, fontSize: 12 }}>{h}</th>
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
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : T.bgSubtle }}>
                    <td style={getTdStyle(T)}>{i + 1}</td>
                    <td style={getTdStyle(T)}>{startYearMonth(i)}</td>
                    <td style={getTdStyle(T)}>{fmtZAR(basePayment, "track-table")}</td>
                    <td style={{ ...getTdStyle(T), color: T.blue }}>{fmtZAR(extraTarget, "track-table")}</td>
                    <td style={{ ...getTdStyle(T), color: hasData ? T.primary : T.textTertiary }}>
                      {hasData ? fmtZAR(entry.extra, "track-table") : "—"}
                    </td>
                    <td style={{ ...getTdStyle(T), color: hasData && (entry.lumpSum ?? 0) > 0 ? T.orange : T.textTertiary }}>
                      {hasData && (entry.lumpSum ?? 0) > 0 ? fmtZAR(entry.lumpSum, "track-table") : "—"}
                    </td>
                    <td style={{ ...getTdStyle(T), color: variance === null ? T.textTertiary : variance >= 0 ? T.green : T.red }}>
                      {variance === null ? "—" : (variance >= 0 ? "+" : "") + fmtZAR(variance, "track-table")}
                    </td>
                    <td style={{ ...getTdStyle(T), color: !hasData ? T.textTertiary : variance >= 0 ? T.green : T.red, textAlign: "right" }}>{status}</td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      {hasData && (
                        <button onClick={() => { setEditMonth(i); setInputExtra(entry.extra === 0 ? "" : String(entry.extra ?? "")); setInputLumpSum(entry.lumpSum === 0 ? "" : String(entry.lumpSum ?? "")); }}
                          style={{ fontFamily: "Inter", fontSize: 12, padding: "6px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSecondary, cursor: "pointer" }}>
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
        <ChartCard title="Extra Payments: Target vs Actual" titleAction={
          <button onClick={() => toggleTotal("track-bar-chart")} title={isVisible("track-bar-chart") ? "Hide" : "Reveal"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
            {isVisible("track-bar-chart") ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        }>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={entries.map((e, i) => ({ month: i + 1, actual: e?.extra ?? 0, target: extraTarget }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
              <XAxis dataKey="month" stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }} tickFormatter={v => `M${v}`} />
              <YAxis stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }} tickFormatter={v => fmtShortZAR(v, "track-bar-chart")} width={60} />
              <Tooltip content={<ChartTip chartId="track-bar-chart" />} />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: T.textSecondary }} />
              <ReferenceLine y={extraTarget} stroke={T.blue} strokeDasharray="4 4" label={{ value: "Target", fill: T.blue, fontFamily: "Inter", fontSize: 10 }} />
              <Bar dataKey="actual" name="Actual Extra" fill={T.primary} radius={[4, 4, 0, 0]} />
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
  const { tokens: T, fmtZAR, fmtShortZAR, isVisible, toggleTotal } = useTheme();
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
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 24, boxShadow: T.shadow, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        <Field label="Current Rate (%)" value={params.rate} onChange={v => setParams(p => ({ ...p, rate: v }))} step={0.05} />
        <Field label="New Rate After Drop (%)" value={newRate} onChange={setNewRate} step={0.05} />
        <Field label="Rate Drops at Month" value={atMonth} onChange={setAtMonth} integer />
        <Field label="Extra Payment /mo (R)" value={extra} onChange={setExtra} prefix="R" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
        <Stat label="Current Payment" value={fmtZAR(oldPayment, "rate-current-payment")} sub={`at ${params.rate}%`} totalId="rate-current-payment" />
        <Stat label="New Payment" value={fmtZAR(newPayment, "rate-new-payment")} sub={`at ${newRate}% from M${atMonth}`} accent totalId="rate-new-payment" />
        <Stat label="Monthly Saving" value={fmtZAR(saving, "rate-monthly-saving")} sub="after rate drop" accent={saving > 0} totalId="rate-monthly-saving" />
        <Stat label={`Balance at M${atMonth}`} value={fmtShortZAR(balanceAtChange, "rate-balance")} sub="when rate changes" totalId="rate-balance" />
        <Stat label="Total Interest" value={fmtShortZAR(totalInterest, "rate-total-interest")} sub="over full term" totalId="rate-total-interest" />
      </div>

      <ChartCard title="Balance Trajectory with Rate Change" titleAction={
        <button onClick={() => toggleTotal("rate-chart")} title={isVisible("rate-chart") ? "Hide chart" : "Reveal chart"} style={{ display: "flex", padding: 4, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
          {isVisible("rate-chart") ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      }>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }} tickFormatter={v => `M${v}`} />
            <YAxis stroke={T.border} tick={{ fontFamily: "Inter", fontSize: 12, fill: T.textTertiary }} tickFormatter={v => fmtShortZAR(v, "rate-chart")} width={60} />
            <Tooltip content={<ChartTip chartId="rate-chart" />} />
            <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: T.textSecondary }} />
            <ReferenceLine x={atMonth} stroke={T.orange} strokeDasharray="4 4" label={{ value: `Rate → ${newRate}%`, fill: T.orange, fontFamily: "Inter", fontSize: 10 }} />
            <Line type="monotone" dataKey="before" name={`Before (${params.rate}%)`} stroke={T.red} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="after" name={`After (${newRate}%)`} stroke={T.primary} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function ChartCard({ title, children, titleAction }) {
  const { tokens: T } = useTheme();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 24, boxShadow: T.shadow }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: `1px solid ${T.borderLight}`,
      }}>
        <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 18, lineHeight: "28px", color: T.text, flex: "1", minWidth: 0 }}>{title}</div>
        {titleAction && <div style={{ flexShrink: 0 }}>{titleAction}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, prefix, step = 1, integer = false, type = "number" }) {
  const { tokens: T } = useTheme();
  const [focused, setFocused] = useState(false);
  const [inputStr, setInputStr] = useState("");

  const isNumeric = type === "number";

  const handleFocus = () => {
    if (isNumeric) {
      setInputStr(value === 0 ? "" : String(value));
      setFocused(true);
    }
  };

  const handleBlur = (e) => {
    if (isNumeric) {
      const str = e.target.value;
      const parsed = integer ? (parseInt(str, 10) || 0) : (parseFloat(str) || 0);
      onChange(parsed);
      setInputStr("");
      setFocused(false);
    }
  };

  const handleChange = (e) => {
    if (type === "month") {
      onChange(e.target.value);
    } else if (isNumeric) {
      const str = e.target.value;
      setInputStr(str);
      const parsed = integer ? (parseInt(str, 10) || 0) : (parseFloat(str) || 0);
      onChange(parsed);
    } else {
      onChange(integer ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0);
    }
  };

  const showVal = type === "month"
    ? value
    : (isNumeric && focused ? inputStr : (value === 0 ? "" : value));

  return (
    <div>
      <label style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: T.textSecondary, display: "block", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "10px 12px", fontFamily: "Inter", fontSize: 14, color: T.textTertiary, borderRight: `1px solid ${T.border}` }}>{prefix}</span>}
        <input
          type={type === "month" ? "month" : "text"}
          inputMode={isNumeric ? "numeric" : undefined}
          value={showVal}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          step={type === "month" ? undefined : step}
          style={{ fontFamily: "Inter", fontSize: 14, background: "transparent", border: "none", padding: "10px 14px", color: T.text, width: "100%", outline: "none" }}
        />
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
const TABS = ["Simulator", "Rate Change", "Reality Tracker"];
const RATE_PRESETS = [8, 9, 10, 11];

function AppContent() {
  const { theme, setTheme, tokens: T, visibleTotals, viewAll, hideAll, fmtShortZAR, isVisible, toggleTotal } = useTheme();
  const anyVisible = Object.keys(visibleTotals).some(k => visibleTotals[k]);
  const allVisible = ALL_TOTAL_IDS.every(id => visibleTotals[id]);
  const [tab, setTab] = useState(0);
  const [params, setParams] = useState({
    principal: 2_430_595,
    rate: 9.25,
    term: 360,
  });

  return (
    <div className="min-h-screen w-full" style={{ background: T.bg, color: T.text, fontFamily: "Inter" }}>
      {/* Header - full width, Untitled UI style */}
      <div style={{ borderBottom: `1px solid ${T.borderLight}`, padding: "0 24px" }}>
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-3" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 30, lineHeight: "38px", color: T.text }}>Bond Simulator</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter", fontSize: 14, color: T.textTertiary }}>
              <span>{fmtShortZAR(params.principal, "header-principal")}</span>
              <button onClick={() => toggleTotal("header-principal")} title={isVisible("header-principal") ? "Hide" : "Reveal"} style={{ display: "flex", padding: 2, background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary }}>
                {isVisible("header-principal") ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <span> · {params.rate}% · {params.term} months</span>
            </div>
          </div>
          {/* View all / Hide all + Theme toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, padding: 2, background: T.card }}>
              <button onClick={viewAll} title="View all totals" style={{ fontFamily: "Inter", fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: allVisible ? T.bgSubtle : "transparent", color: allVisible ? T.primary : T.textSecondary }}>View all</button>
              <button onClick={hideAll} title="Hide all totals" style={{ fontFamily: "Inter", fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: !anyVisible ? T.bgSubtle : "transparent", color: !anyVisible ? T.primary : T.textSecondary }}>Hide all</button>
            </div>
            <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, padding: 4, background: T.card }}>
            {["light", "dark"].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  fontFamily: "Inter", fontWeight: 500, fontSize: 13, padding: "6px 14px", borderRadius: 6,
                  border: "none", cursor: "pointer", background: theme === t ? T.bgSubtle : "transparent",
                  color: theme === t ? T.primary : T.textSecondary,
                }}
              >
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full" style={{ padding: "32px 24px" }}>
        <div className="max-w-7xl mx-auto" style={{ width: "100%" }}>
        {/* Tab nav */}
        <div style={{ display: "flex", marginBottom: 32, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 4, width: "fit-content", boxShadow: T.shadow }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              fontFamily: "Inter", fontWeight: 600, fontSize: 14, padding: "8px 16px", minHeight: 40, borderRadius: 6,
              border: "none", cursor: "pointer", transition: "all 0.15s",
              background: tab === i ? T.bgSubtle : "transparent",
              color: T.textSecondary,
            }}>{t}</button>
          ))}
        </div>

        {/* Content */}
        {tab === 0 && <SimulatorTab params={params} setParams={setParams} />}
        {tab === 1 && <RateChangePanel params={params} setParams={setParams} />}
        {tab === 2 && <TrackerTab params={params} />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
