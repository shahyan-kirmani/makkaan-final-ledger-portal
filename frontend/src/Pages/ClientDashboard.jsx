// ✅ ClientLedger.jsx (TABLE MATCHES ADMIN LEDGER STYLE + CHILD ROWS + LOCKED SURCHARGE)
// ✅ Desktop + Mobile: SAME TABLE (horizontal scroll on mobile)
// ✅ Uses backend locked surcharge: r.latePaymentSurcharge (NO recalculation)
// ✅ Table columns, header rows (TOTAL AMOUNT / DOWNPAYMENT / MONTHLY), zebra + sticky header like Admin
// ✅ Child rows panel matches Admin look (VIEW-ONLY)

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SidebarLayout from "../layout/SidebarLayout";
import { api } from "../api";

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString("en-PK")}`;

const BACKEND_ORIGIN =
  import.meta?.env?.VITE_API_ORIGIN || "https://makkaandevelopments.online";

function fileUrl(u) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${BACKEND_ORIGIN}${u.startsWith("/") ? "" : "/"}${u}`;
}

// ✅ Parse YYYY-MM-DD safely (no timezone shift)
function toDateOnly(d) {
  if (!d) return null;
  const s = String(d).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    const x = new Date(y, mo, day);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ✅ Today in Pakistan timezone (fixes date shift issues)
function todayPKDateOnly() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = Number(parts.find((p) => p.type === "year")?.value || "1970");
  const m = Number(parts.find((p) => p.type === "month")?.value || "01") - 1;
  const d = Number(parts.find((p) => p.type === "day")?.value || "01");

  const x = new Date(y, m, d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ✅ Late days = (paymentDate if exists else todayPK) - dueDate
function lateDays(dueDate, paymentDate) {
  const due = toDateOnly(dueDate);
  if (!due) return 0;

  const end = paymentDate ? toDateOnly(paymentDate) : todayPKDateOnly();
  if (!end) return 0;

  const diffMs = end.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * ✅ CHILD PAYMENTS HELPERS
 * Balance / totals / surcharge should consider:
 * parent.amountPaid + sum(children.amountPaid)
 */
function childPaidSum(row) {
  const children = row?.children || [];
  return children.reduce((sum, c) => sum + Number(c.amountPaid || 0), 0);
}

function effectivePaid(row) {
  return Number(row?.amountPaid || 0) + childPaidSum(row);
}

// latest payment date among parent + children (YYYY-MM-DD)
function effectivePaymentDate(row) {
  const dates = [];
  if (row?.paymentDate) dates.push(String(row.paymentDate).slice(0, 10));
  const children = row?.children || [];
  for (const c of children) {
    if (c?.paymentDate) dates.push(String(c.paymentDate).slice(0, 10));
  }
  if (!dates.length) return "";
  dates.sort(); // lex sort works for YYYY-MM-DD
  return dates[dates.length - 1];
}

function Pill({ tone = "gray", children }) {
  const tones = {
    gray: { bg: "#f1f5f9", fg: "#0f172a", bd: "#e2e8f0" },
    green: { bg: "#ecfdf5", fg: "#065f46", bd: "#a7f3d0" },
    orange: { bg: "#fff7ed", fg: "#9a3412", bd: "#fed7aa" },
    blue: { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
    red: { bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
    purple: { bg: "#f5f3ff", fg: "#6d28d9", bd: "#ddd6fe" },
  };

  const t = tones[tone] || tones.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        fontWeight: 800,
        fontSize: 12,
        fontFamily: "Poppins, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function GhostButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        border: "1px solid #e5e7eb",
        padding: "10px 12px",
        borderRadius: 12,
        background: "white",
        color: "#0f172a",
        fontWeight: 900,
        cursor: props.disabled ? "not-allowed" : "pointer",
        transition: "150ms ease",
        fontFamily: "Poppins, sans-serif",
        opacity: props.disabled ? 0.6 : 1,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

function MiniActionLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        textDecoration: "none",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        fontWeight: 900,
        fontSize: 12,
        color: "#0f172a",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {label}
    </a>
  );
}

function ProofThumb({ src, alt = "Proof" }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: 130,
        height: 78,
        objectFit: "cover",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        display: "block",
      }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

function ChildRowsViewOnly({ row }) {
  const children = Array.isArray(row?.children) ? row.children : [];
  if (!children.length) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "white",
        boxShadow: "0 10px 24px rgba(2,6,23,0.05)",
        padding: 14,
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 980,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                background: "linear-gradient(135deg, #0f172a, #111827)",
                color: "white",
              }}
            >
              {[
                "Line No",
                "Description",
                "Amount Paid",
                "Payment Date",
                "Instrument Type",
                "Instrument No",
                "Proof",
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    padding: "12px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {children.map((c, cidx) => {
              const proofHref = fileUrl(c.paymentProof);
              const proofSrc = fileUrl(c.paymentProof);

              return (
                <tr
                  key={c.id || c.__ckey || c.lineNo || cidx}
                  style={{ background: cidx % 2 === 0 ? "#ffffff" : "#fbfdff" }}
                >
                  <td style={td()}>{c.lineNo ?? "—"}</td>
                  <td style={td()}>{c.description || "—"}</td>
                  <td style={td({ fontWeight: 900 })}>{fmt(c.amountPaid || 0)}</td>
                  <td style={td()}>
                    {c.paymentDate ? String(c.paymentDate).slice(0, 10) : "—"}
                  </td>
                  <td style={td()}>{c.instrumentType || "—"}</td>
                  <td style={td()}>{c.instrumentNo || "—"}</td>
                  <td style={td()}>
                    {c.paymentProof ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <MiniActionLink href={proofHref} label="View" />
                        <ProofThumb src={proofSrc} alt="Child Proof" />
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>No file</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Pill tone="blue">Child Paid: {fmt(childPaidSum(row))}</Pill>
        <Pill tone="green">Total Paid (Parent+Child): {fmt(effectivePaid(row))}</Pill>
      </div>
    </div>
  );
}

export default function ClientLedger({ token, user, onLogout }) {
  const nav = useNavigate();
  const client = useMemo(() => api(token), [token]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [contract, setContract] = useState(null);
  const [rows, setRows] = useState([]);

  // ✅ expanded child sections (by key)
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  function toggleChildren(key) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await client.get("/api/client/ledger");
      const c = res.data.contract || null;
      const r = Array.isArray(res.data.rows) ? res.data.rows : [];

      setContract(c);
      setRows(r);

      // auto expand rows that have children
      const auto = new Set();
      for (const row of r) {
        if (Array.isArray(row.children) && row.children.length > 0) {
          auto.add(row.id || row.srNo);
        }
      }
      setExpandedKeys(auto);
    } catch (e) {
      console.error(e);
      setMsg(e.response?.data?.error || "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  async function downloadLedgerPdf() {
    try {
      setMsg("");
      setDownloadingPdf(true);

      const res = await client.get(`/api/client/ledger/export/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ledger.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setMsg(e.response?.data?.error || e.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  // ---------- TOTALS (client view-only; uses locked surcharge from backend row.latePaymentSurcharge) ----------
  const totalAmount = Number(contract?.totalAmount || 0);
  const downPayment = Number(contract?.downPayment || 0);
  const months = Number(contract?.months || 0);
  const possessionPct = Number(contract?.possession || 0);

  const possessionAmount = Math.round((totalAmount * possessionPct) / 100);
  const monthlyTotal = Math.max(0, totalAmount - downPayment - possessionAmount);
  const totalPayable = Math.round(possessionAmount + monthlyTotal);

  const totalPaid = rows.reduce((sum, r) => sum + effectivePaid(r), 0);

  // ✅ Receivable = pure balance only (no surcharge) like admin UI
  const totalReceivable = Math.max(0, totalPayable - totalPaid);

  // ✅ Surcharge: locked from backend row.latePaymentSurcharge
  const totalSurcharge = rows.reduce(
    (sum, r) => sum + Number(r.latePaymentSurcharge || 0),
    0
  );

  // ✅ In Admin you show Total Due as receivable (no surcharge)
  const totalDue = totalReceivable;

  const navItems = [{ key: "ledger", label: "Ledger", icon: "📒" }];

  function handleNav(key) {
    if (key === "ledger") nav("/client/ledger");
  }

  const msgTone = msg?.includes("✅") ? "green" : "orange";

  return (
    <SidebarLayout
      title="Client Ledger"
      subtitle={contract ? `${contract.clientName || ""} • ${contract.unitNumber || ""}` : ""}
      navItems={navItems}
      activeKey="ledger"
      onNav={handleNav}
      user={user}
      onLogout={onLogout}
      children={{
        topRight: (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <GhostButton onClick={downloadLedgerPdf} disabled={loading || downloadingPdf}>
              {downloadingPdf ? "Downloading PDF..." : "⬇ PDF"}
            </GhostButton>

            <GhostButton onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </GhostButton>
          </div>
        ),
        content: (
          <div
            className="ledgerWrap card"
            style={{
              padding: 14,
              fontFamily: "Poppins, sans-serif",
              background: "linear-gradient(180deg, rgba(239,246,255,0.6), rgba(255,255,255,1))",
              borderRadius: 18,
              border: "1px solid #e5e7eb",
            }}
          >
            {/* Poppins font import (page-only) */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link
              href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap"
              rel="stylesheet"
            />

            {/* ✅ Responsive tweaks like admin (table stays, scrolls) */}
            <style>{`
              .ledgerTopActions{ display:flex; gap:10px; flex-wrap:wrap; }
              @media (max-width: 720px){
                .ledgerTopActions{ width:100%; }
                .ledgerTopActions button{ flex:1; width:100%; }
              }
            `}</style>

            {msg && (
              <div style={{ marginBottom: 12 }}>
                <Pill tone={msgTone}>{msg}</Pill>
              </div>
            )}

            {loading ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>Loading…</div>
            ) : !contract ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>No contract found.</div>
            ) : (
              <>
                {/* TOP SUMMARY STRIP (matches admin) */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Pill tone="blue">Payable: {fmt(totalPayable)}</Pill>
                    <Pill tone="green">Paid: {fmt(totalPaid)}</Pill>
                    <Pill tone="orange">Receivable: {fmt(totalReceivable)}</Pill>
                    <Pill tone={totalSurcharge > 0 ? "red" : "purple"}>
                      Surcharge: {fmt(totalSurcharge)}
                    </Pill>
                    <Pill tone="purple">Total Due: {fmt(totalDue)}</Pill>
                  </div>

                  <div style={{ color: "#64748b", fontWeight: 700, fontSize: 12 }}>
                    View-only
                  </div>
                </div>

                {/* HEADER PANELS (same look as admin) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={panel()}>
                    <div style={label()}>TOTAL AMOUNT</div>
                    <div style={{ fontWeight: 900 }}>{fmt(totalAmount)}</div>
                  </div>

                  <div style={panel()}>
                    <div style={label()}>DOWNPAYMENT</div>
                    <div style={{ fontWeight: 900 }}>{fmt(downPayment)}</div>
                  </div>

                  <div style={panel()}>
                    <div style={label()}>POSSESSION %</div>
                    <div style={{ fontWeight: 900 }}>{possessionPct}%</div>
                  </div>

                  <div style={panel()}>
                    <div style={label()}>MONTHS</div>
                    <div style={{ fontWeight: 900 }}>{months}</div>
                  </div>
                </div>

                {/* ✅ TABLE (MATCH ADMIN COLUMNS + HEADER ROWS) */}
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      minWidth: 1780,
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 16,
                      overflow: "hidden",
                      boxShadow: "0 18px 40px rgba(2,6,23,0.06)",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
                          color: "white",
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                        }}
                      >
                        {[
                          "", // expand button column
                          "Sr No",
                          "Description",
                          "Installment Amount",
                          "Due Date",
                          "Installment Paid",
                          "Payment Date",
                          "Instrument Type",
                          "Instrument No",
                          "Balance",
                          "Late Payment Surcharge",
                          "Late Payment Days",
                          "Payment Proof",
                          "Actions",
                        ].map((h, i) => (
                          <th
                            key={i}
                            style={{
                              textAlign: "left",
                              padding: "12px 12px",
                              fontSize: 12,
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                              borderBottom: "1px solid rgba(255,255,255,0.18)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {/* TOTAL AMOUNT */}
                      <tr style={zebra(0)}>
                        <td style={td()}></td>
                        <td style={td()}></td>
                        <td style={td({ fontWeight: 900 })}>
                          <Pill tone="blue">TOTAL AMOUNT</Pill>
                        </td>
                        <td style={td({ fontWeight: 900 })}>{fmt(totalAmount)}</td>
                        {Array.from({ length: 9 }).map((_, i) => (
                          <td key={i} style={td()}></td>
                        ))}
                        <td style={td()}></td>
                        <td style={td()}></td>
                      </tr>

                      {/* DOWNPAYMENT */}
                      <tr style={zebra(1)}>
                        <td style={td()}></td>
                        <td style={td()}></td>
                        <td style={td({ fontWeight: 900 })}>
                          <Pill tone="green">DOWNPAYMENT</Pill>
                        </td>
                        <td style={td({ fontWeight: 900 })}>{fmt(downPayment)}</td>
                        <td style={td()}>
                          {contract.bookingDate ? String(contract.bookingDate).slice(0, 10) : ""}
                        </td>
                        <td style={td({ fontWeight: 900 })}>{fmt(downPayment)}</td>
                        <td style={td()}>
                          {contract.bookingDate ? String(contract.bookingDate).slice(0, 10) : ""}
                        </td>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <td key={i} style={td()}></td>
                        ))}
                        <td style={td()}></td>
                      </tr>

                      {/* MONTHLY TOTAL */}
                      <tr style={zebra(0)}>
                        <td style={td()}></td>
                        <td style={td()}></td>
                        <td style={td({ fontWeight: 900 })}>
                          <Pill tone="purple">{months} MONTHLY INSTALLMENTS</Pill>
                        </td>
                        <td style={td({ fontWeight: 900 })}>{fmt(monthlyTotal)}</td>
                        {Array.from({ length: 9 }).map((_, i) => (
                          <td key={i} style={td()}></td>
                        ))}
                        <td style={td()}></td>
                        <td style={td()}></td>
                      </tr>

                      {/* INSTALLMENT ROWS */}
                      {rows.map((r, i) => {
                        const inst = Number(r.installmentAmount || 0);
                        const paid = effectivePaid(r);

                        // ✅ balance like admin "displayBalanceForRow" idea:
                        // before any payment => 0, after any payment => remaining
                        const balance = paid > 0 ? Math.max(0, inst - paid) : 0;

                        const payDate = effectivePaymentDate(r);
                        const lDays = lateDays(r.dueDate, payDate || "");

                        const surcharge = Number(r.latePaymentSurcharge || 0);

                        const rowTone =
                          surcharge > 0 ? "#fef2f2" : lDays > 0 ? "#fff7ed" : "transparent";

                        const proofHref = fileUrl(r.paymentProof);
                        const proofSrc = fileUrl(r.paymentProof);

                        const hasChildren = (r?.children || []).length > 0;
                        const key = r.id || r.srNo || i;
                        const isExpanded = expandedKeys.has(key);

                        return (
                          <>
                            <tr key={`row-${key}`} style={{ background: rowTone }}>
                              {/* expand toggle */}
                              <td style={td({ width: 56, background: rowTone })}>
                                {hasChildren ? (
                                  <GhostButton
                                    onClick={() => toggleChildren(key)}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 12,
                                      fontSize: 12,
                                      lineHeight: 1,
                                    }}
                                  >
                                    {isExpanded ? "Hide" : "Show"}
                                  </GhostButton>
                                ) : (
                                  <span style={{ color: "#cbd5e1", fontWeight: 900 }}>—</span>
                                )}
                              </td>

                              <td style={td({ background: rowTone })}>{r.srNo}</td>

                              <td style={td({ background: rowTone })}>{r.description || ""}</td>

                              <td style={td({ background: rowTone, fontWeight: 900 })}>
                                {fmt(inst)}
                              </td>

                              <td style={td({ background: rowTone })}>
                                {r.dueDate ? String(r.dueDate).slice(0, 10) : ""}
                              </td>

                              <td style={td({ background: rowTone })}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <Pill tone={paid > 0 ? "green" : "gray"}>{fmt(paid)}</Pill>
                                  {hasChildren && (
                                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                                      Child Paid: {fmt(childPaidSum(r))}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td style={td({ background: rowTone })}>
                                {r.paymentDate ? String(r.paymentDate).slice(0, 10) : "—"}
                              </td>

                              <td style={td({ background: rowTone })}>{r.instrumentType || "—"}</td>

                              <td style={td({ background: rowTone })}>{r.instrumentNo || "—"}</td>

                              <td style={td({ background: rowTone, fontWeight: 900 })}>
                                <Pill tone={balance > 0 ? "orange" : "green"}>{fmt(balance)}</Pill>
                              </td>

                              <td style={td({ background: rowTone, fontWeight: 900 })}>
                                {surcharge > 0 ? (
                                  <Pill tone="red">{fmt(surcharge)}</Pill>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontWeight: 800 }}>—</span>
                                )}
                              </td>

                              <td style={td({ background: rowTone, fontWeight: 900 })}>
                                {lDays > 0 ? (
                                  <Pill tone={lDays >= 30 ? "red" : "orange"}>{lDays} day(s)</Pill>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontWeight: 800 }}>—</span>
                                )}
                              </td>

                              <td style={td({ background: rowTone })}>
                                {r.paymentProof ? (
                                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <MiniActionLink href={proofHref} label="View" />
                                    <ProofThumb src={proofSrc} alt="Payment Proof" />
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                                    No file
                                  </span>
                                )}
                              </td>

                              <td style={td({ background: rowTone })}>
                                <span style={{ color: "#64748b", fontWeight: 800, fontSize: 12 }}>
                                  View-only
                                </span>
                              </td>
                            </tr>

                            {/* CHILD ROWS PANEL */}
                            {hasChildren && isExpanded && (
                              <tr key={`childpanel-${key}`}>
                                <td
                                  colSpan={14}
                                  style={{
                                    padding: 14,
                                    background: "#fbfdff",
                                    borderBottom: "1px solid #eef2f7",
                                  }}
                                >
                                  <ChildRowsViewOnly row={r} />
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}

                      {/* TOTAL */}
                      <tr
                        style={{
                          background: "linear-gradient(135deg, #0ea5e9, #22c55e)",
                          color: "white",
                        }}
                      >
                        <td style={td({ fontWeight: 900, color: "white" })}></td>
                        <td style={td({ fontWeight: 900, color: "white" })}></td>
                        <td style={td({ fontWeight: 900, color: "white" })}>TOTAL</td>
                        <td style={td({ fontWeight: 900, color: "white" })}>{fmt(totalPayable)}</td>
                        <td style={td({ color: "white" })}></td>
                        <td style={td({ fontWeight: 900, color: "white" })}>{fmt(totalPaid)}</td>
                        <td style={td({ color: "white" })}></td>
                        <td style={td({ color: "white" })}></td>
                        <td style={td({ color: "white" })}></td>
                        <td style={td({ fontWeight: 900, color: "white" })}>{fmt(totalReceivable)}</td>
                        <td style={td({ fontWeight: 900, color: "white" })}>{fmt(totalSurcharge)}</td>
                        <td style={td({ fontWeight: 900, color: "white" })}>—</td>
                        <td style={td({ color: "white" })}></td>
                        <td style={td({ color: "white" })}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ),
      }}
    />
  );
}

function td(extra = {}) {
  return {
    padding: 10,
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    fontSize: 13,
    ...extra,
  };
}

function panel() {
  return {
    background: "white",
    borderRadius: 16,
    padding: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 22px rgba(2,6,23,0.05)",
  };
}

function label() {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
    letterSpacing: 0.3,
  };
}

function zebra(i) {
  return {
    background: i % 2 === 0 ? "#ffffff" : "#fbfdff",
  };
}
