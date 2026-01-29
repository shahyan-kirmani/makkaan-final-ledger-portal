import { useEffect, useMemo, useState } from "react";
import SidebarLayout from "../layout/SidebarLayout";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

/* -------------------- UI HELPERS -------------------- */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 18,
          borderRadius: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn secondary" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ fontSize: 13, fontWeight: 700 }}>
      {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
    </div>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      width: "100%",
      padding: 12,
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      outline: "none",
      ...props.style,
    }}
  />
);

const Select = (props) => (
  <select
    {...props}
    style={{
      width: "100%",
      padding: 12,
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      background: "white",
      outline: "none",
      ...props.style,
    }}
  />
);

/* -------------------- NORMALIZE SERVER FIELDS -------------------- */
function normalizeClient(raw) {
  // TOTAL AMOUNT
  const totalAmount =
    raw?.totalAmount ??
    raw?.total_amount ??
    raw?.total_price ??
    raw?.totalPrice ??
    raw?.total ??
    raw?.amount ??
    0;

  const total = Number(totalAmount || 0);

  // DOWN PAYMENT (amount) - try direct first
  let downPayment =
    raw?.downPayment ??
    raw?.down_payment ??
    raw?.downpayment ??
    raw?.down_payment_amount ??
    raw?.downpayment_amount ??
    raw?.down_payment_amt ??
    raw?.downpayment_amt ??
    raw?.dp ??
    null;

  // DOWN PAYMENT % fallback
  const dpPct =
    raw?.downpaymentPct ??
    raw?.downpayment_pct ??
    raw?.down_payment_pct ??
    raw?.downPaymentPct ??
    0;

  if (downPayment == null || Number(downPayment) === 0) {
    const pct = Number(dpPct || 0);
    if (total > 0 && pct > 0) downPayment = Math.round((total * pct) / 100);
    else downPayment = 0;
  }

  // POSSESSION %
  const possession =
    raw?.possession ??
    raw?.possessionPct ??
    raw?.possession_pct ??
    raw?.possession_percent ??
    0;

  const months = raw?.months ?? raw?.duration ?? raw?.tenure ?? 0;

  // ✅ normalize personal fields (supports different backend keys)
  const email =
    raw?.email ??
    raw?.clientEmail ??
    raw?.client_email ??
    raw?.userEmail ??
    raw?.user_email ??
    raw?.client?.email ??
    "";

  const phone =
    raw?.phone ??
    raw?.phoneNumber ??
    raw?.phone_number ??
    raw?.mobile ??
    raw?.mobileNumber ??
    raw?.mobile_number ??
    raw?.clientPhone ??
    raw?.client_phone ??
    raw?.client?.phone ??
    raw?.client?.phoneNumber ??
    raw?.client?.mobile ??
    "";

  const cnic =
    raw?.cnic ??
    raw?.cnicNumber ??
    raw?.cnic_number ??
    raw?.clientCnic ??
    raw?.client_cnic ??
    raw?.client?.cnic ??
    raw?.client?.cnicNumber ??
    "";

  const address =
    raw?.address ??
    raw?.clientAddress ??
    raw?.client_address ??
    raw?.fullAddress ??
    raw?.full_address ??
    raw?.client?.address ??
    raw?.client?.fullAddress ??
    "";

  // ✅✅✅ ONLY FIX ADDED: make sure contractId is always available
  // Prisma contract primary key is `id`, so list endpoint may return `id` not `contractId`
  const contractId = raw?.contractId ?? raw?.id ?? raw?.contract?.id ?? null;

  return {
    ...raw,
    contractId, // ✅ important for edit fetch: /api/admin/clients/:contractId
    totalAmount: total,
    downPayment: Number(downPayment || 0),
    possession: Number(possession || 0),
    months: Number(months || 0),
    email,
    phone,
    cnic,
    address,
  };
}

/* -------------------- CLIENT CARD (UPGRADED UI) -------------------- */
function ClientCard({ c, onEdit, onLedger, onDelete }) {
  const active = (c.status || "Active") === "Active";

  const total = Number(c.totalAmount || 0);
  const down = Number(c.downPayment || 0);
  const posPct = Number(c.possession || 0);
  const months = Number(c.months || 0);

  const possessionAmount = Math.round((total * posPct) / 100);
  const monthlyTotal = Math.max(0, total - down - possessionAmount);
  const monthly = months > 0 ? Math.round(monthlyTotal / months) : 0;

  const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

  const paidInstallments = Number(c.paidInstallments || 0);
  const totalInstallments =
    Number(c.totalInstallments || 0) || Number(months || 0);

  const paidAmount = Number(c.paidAmount || 0);

  const progressPct = useMemo(() => {
    if (totalInstallments > 0) {
      return Math.round(
        (Math.max(0, paidInstallments) / totalInstallments) * 100,
      );
    }
    if (total > 0) {
      return Math.round((Math.max(0, paidAmount) / total) * 100);
    }
    return 0;
  }, [paidInstallments, totalInstallments, paidAmount, total]);

  const safePct = Math.max(0, Math.min(100, progressPct));

  const progressText =
    totalInstallments > 0
      ? `${paidInstallments}/${totalInstallments} installments`
      : `${fmt(paidAmount)} paid`;

  const chip = (text) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,.45)",
        background: "rgba(248,250,252,.75)",
        color: "#0f172a",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        backdropFilter: "blur(6px)",
      }}
    >
      {text}
    </span>
  );

  const Stat = ({ label, value, tone = "blue" }) => {
    const tones = {
      blue: {
        bg: "linear-gradient(135deg, rgba(37,99,235,.12) 0%, rgba(147,197,253,.18) 100%)",
        border: "rgba(37,99,235,.20)",
        dot: "#2563eb",
      },
      green: {
        bg: "linear-gradient(135deg, rgba(34,197,94,.12) 0%, rgba(134,239,172,.20) 100%)",
        border: "rgba(34,197,94,.20)",
        dot: "#22c55e",
      },
      amber: {
        bg: "linear-gradient(135deg, rgba(245,158,11,.14) 0%, rgba(253,230,138,.22) 100%)",
        border: "rgba(245,158,11,.22)",
        dot: "#f59e0b",
      },
      slate: {
        bg: "linear-gradient(135deg, rgba(15,23,42,.06) 0%, rgba(148,163,184,.18) 100%)",
        border: "rgba(148,163,184,.30)",
        dot: "#334155",
      },
      rose: {
        bg: "linear-gradient(135deg, rgba(244,63,94,.10) 0%, rgba(253,164,175,.20) 100%)",
        border: "rgba(244,63,94,.18)",
        dot: "#f43f5e",
      },
    };

    const t = tones[tone] || tones.blue;

    return (
      <div
        style={{
          padding: "11px 12px",
          borderRadius: 14,
          border: `1px solid ${t.border}`,
          background: t.bg,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 90,
            height: 90,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: t.dot,
              boxShadow: "0 6px 14px rgba(15,23,42,.10)",
            }}
          />
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 900 }}>
            {label}
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
          {value}
        </div>
      </div>
    );
  };

  return (
    <div
      className="card"
      style={{
        padding: 18,
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,.35)",
        background:
          "linear-gradient(135deg, rgba(37,99,235,.08) 0%, rgba(16,185,129,.06) 45%, rgba(255,255,255,1) 100%)",
        boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
        transition:
          "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 18px 48px rgba(15, 23, 42, 0.12)";
        e.currentTarget.style.borderColor = "rgba(59,130,246,.45)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow = "0 12px 34px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.borderColor = "rgba(148,163,184,.35)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 240,
          height: 240,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59,130,246,.25) 0%, rgba(59,130,246,0) 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                color: "white",
                fontWeight: 900,
                flex: "0 0 auto",
                boxShadow: "0 10px 20px rgba(37,99,235,.25)",
              }}
              title="Client"
            >
              {(c.clientName || "?").trim().charAt(0).toUpperCase()}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={c.clientName}
              >
                {c.clientName}
              </div>

              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {chip(`${c.unitNumber} • ${c.unitType || "Unit"}`)}
                {chip(c.project || "Avenue 18")}
              </div>
            </div>
          </div>
        </div>

        <span
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            background: active ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.12)",
            color: active ? "#166534" : "#991b1b",
            fontWeight: 900,
            fontSize: 12,
            height: "fit-content",
            border: `1px solid ${
              active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"
            }`,
            flex: "0 0 auto",
          }}
        >
          {c.status || "Active"}
        </span>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <Stat label="Total" value={fmt(total)} tone="blue" />
        <Stat label="Monthly" value={fmt(monthly)} tone="green" />
        <Stat label="Down Payment" value={fmt(down)} tone="amber" />
        <Stat label="Duration" value={`${months} months`} tone="slate" />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <button className="btn secondary" onClick={() => onEdit(c)}>
          ✎ Edit
        </button>

        <button className="btn" onClick={() => onLedger(c)}>
          👁 Ledger
        </button>

        <button
          className="btn secondary"
          onClick={() => onDelete(c)}
          style={{
            borderColor: "#fecaca",
            color: "#991b1b",
            background: "#fff1f2",
          }}
          title="Delete client"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

/* -------------------- MAIN PAGE -------------------- */
export default function AdminClients({ token, user, onLogout }) {
  const nav = useNavigate();
  const client = useMemo(() => api(token), [token]);

  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editTarget, setEditTarget] = useState(null);
  const [msg, setMsg] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    cnic: "",
    address: "",
    password: "",
    project: "Avenue 18",
    unitNumber: "",
    unitType: "Apartment",
    status: "Active",
    totalPrice: "",
    downPayment: "",
    possession: "",
    months: "",
    bookingDate: "",
  });

  const [editOriginal, setEditOriginal] = useState(null);

  async function enrichInstallmentProgress(list) {
    const results = await Promise.allSettled(
      list.map(async (c) => {
        const contractId = c.contractId;
        if (!contractId) return { contractId, paid: 0 };

        const r = await client.get(`/api/admin/ledger/${contractId}`);
        const rows = r.data?.rows || [];

        let paidCount = 0;
        for (const row of rows) {
          const inst = Number(row.installmentAmount || 0);
          const parentPaid = Number(row.amountPaid || 0);
          const childPaid = (row.children || []).reduce(
            (s, ch) => s + Number(ch.amountPaid || 0),
            0,
          );
          const totalPaid = parentPaid + childPaid;
          if (inst > 0 && totalPaid >= inst) paidCount += 1;
        }

        return { contractId, paid: paidCount };
      }),
    );

    const map = new Map();
    for (const r of results) {
      if (r.status === "fulfilled") map.set(r.value.contractId, r.value.paid);
    }

    return list.map((c) => ({
      ...c,
      paidInstallments: map.get(c.contractId) || 0,
      totalInstallments: Number(c.months || 0),
    }));
  }

  async function enrichDownPayments(list) {
    const results = await Promise.allSettled(
      list.map(async (c) => {
        const contractId = c.contractId;
        if (!contractId) return { contractId, downPayment: 0 };

        const r = await client.get(`/api/admin/ledger/${contractId}`);
        const dp = Number(r.data?.contract?.downPayment || 0);

        return { contractId, downPayment: dp };
      }),
    );

    const map = new Map();
    for (const x of results) {
      if (x.status === "fulfilled")
        map.set(x.value.contractId, x.value.downPayment);
    }
    return list.map((c) => ({
      ...c,
      downPayment: map.get(c.contractId) ?? c.downPayment ?? 0,
    }));
  }

  async function load() {
    const res = await client.get("/api/admin/clients");
    const list = Array.isArray(res.data) ? res.data : [];

    const normalized = list.map(normalizeClient);
    const withRealDownPayment = await enrichDownPayments(normalized);
    const withProgress = await enrichInstallmentProgress(withRealDownPayment);

    setClients(withProgress);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  function openCreate() {
    setMode("create");
    setEditTarget(null);
    setEditOriginal(null);
    setMsg("");
    setForm({
      fullName: "",
      email: "",
      phone: "",
      cnic: "",
      address: "",
      password: "",
      project: "Avenue 18",
      unitNumber: "",
      unitType: "Apartment",
      status: "Active",
      totalPrice: "",
      downPayment: "",
      possession: "",
      months: "",
      bookingDate: "",
    });
    setOpen(true);
  }

  async function fetchClientDetails(contractId) {
    try {
      const r = await client.get(`/api/admin/clients/${contractId}`);
      return r.data;
    } catch {
      return null;
    }
  }

  async function openEdit(rawC) {
    const base = normalizeClient(rawC);

    setMode("edit");
    setEditTarget(base);
    setMsg("");

    const full = await fetchClientDetails(base.contractId);
    const c = normalizeClient(full || base);

    const nextForm = {
      fullName: c.clientName || "",
      email: c.email || "",
      phone: c.phone || "",
      cnic: c.cnic || "",
      address: c.address || "",
      password: "",

      project: c.project || "Avenue 18",
      unitNumber: c.unitNumber || "",
      unitType: c.unitType || "Apartment",
      status: c.status || "Active",

      totalPrice: String(c.totalAmount || ""),
      downPayment: String(c.downPayment || 0),
      possession: String(c.possession || 0),
      months: String(c.months || ""),
      bookingDate: c.bookingDate?.slice(0, 10) || "",
    };

    setForm(nextForm);
    setEditOriginal(nextForm);
    setOpen(true);
  }

  function buildOnlyChangedPayload() {
    const base = editOriginal || {};
    const diff = {};

    const same = (a, b) => String(a ?? "") === String(b ?? "");

    if (!same(form.fullName.trim(), base.fullName))
      diff.fullName = form.fullName.trim();
    if (!same(form.email.trim(), base.email)) diff.email = form.email.trim();
    if (!same(form.phone.trim(), base.phone)) diff.phone = form.phone.trim();
    if (!same(form.cnic.trim(), base.cnic))
      diff.cnic = form.cnic.trim() ? form.cnic.trim() : null;
    if (!same(form.address.trim(), base.address))
      diff.address = form.address.trim();

    if (!same(form.project, base.project)) diff.project = form.project;
    if (!same(form.unitNumber.trim(), base.unitNumber))
      diff.unitNumber = form.unitNumber.trim();
    if (!same(form.unitType, base.unitType)) diff.unitType = form.unitType;
    if (!same(form.status, base.status)) diff.status = form.status;

    if (Number(form.totalPrice || 0) !== Number(base.totalPrice || 0))
      diff.totalAmount = Number(form.totalPrice || 0);
    if (Number(form.downPayment || 0) !== Number(base.downPayment || 0))
      diff.downPayment = Number(form.downPayment || 0);
    if (Number(form.possession || 0) !== Number(base.possession || 0))
      diff.possession = Number(form.possession || 0);
    if (Number(form.months || 0) !== Number(base.months || 0))
      diff.months = Number(form.months || 0);

    const bdNow = form.bookingDate ? form.bookingDate : "";
    const bdOld = base.bookingDate ? base.bookingDate : "";
    if (!same(bdNow, bdOld)) diff.bookingDate = bdNow ? bdNow : null;

    return diff;
  }

  async function submit() {
    setMsg("");

    if (
      !form.fullName ||
      !form.email ||
      !form.phone ||
      !form.unitNumber ||
      !form.totalPrice ||
      !form.months ||
      (mode === "create" && !form.password)
    ) {
      setMsg("Please fill all required fields (*)");
      return;
    }

    try {
      setSaving(true);

      if (mode === "create") {
        const payload = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          cnic: form.cnic ? form.cnic.trim() : null,
          address: form.address ? form.address.trim() : "",

          project: form.project || "Avenue 18",
          unitNumber: form.unitNumber.trim(),
          unitType: form.unitType,
          status: form.status,

          totalAmount: Number(form.totalPrice),
          downPayment: Number(form.downPayment || 0),
          possession: Number(form.possession || 0),
          months: Number(form.months),
          bookingDate: form.bookingDate ? form.bookingDate : null,
        };

        await client.post("/api/admin/clients", {
          ...payload,
          password: form.password,
        });
      } else {
        const onlyChanged = buildOnlyChangedPayload();
        if (Object.keys(onlyChanged).length === 0) {
          setOpen(false);
          return;
        }
        await client.put(
          `/api/admin/clients/${editTarget.contractId}`,
          onlyChanged,
        );
      }

      setOpen(false);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(rawC) {
    const c = normalizeClient(rawC);
    const ok = window.confirm(
      `Delete this client?\n\n${c.clientName || ""} • ${c.unitNumber || ""}\n\nThis action cannot be undone.`,
    );
    if (!ok) return;

    setMsg("");
    setDeleting(true);
    try {
      await client.delete(`/api/admin/clients/${c.contractId}`);
      await load();
      setMsg("Client deleted ✅");
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed to delete client");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteFromModal() {
    if (!editTarget?.contractId) return;
    await deleteClient(editTarget);
    setOpen(false);
  }

  const filtered = clients.filter((c) =>
    `${c.clientName} ${c.unitNumber} ${c.email} ${c.phone} ${c.cnic || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <SidebarLayout
      title="Clients"
      subtitle="Manage Avenue 18 Clients"
      navItems={[
        { key: "dashboard", label: "Dashboard", icon: "▦" },
        { key: "clients", label: "Clients", icon: "👥" },
        { key: "installments", label: "Installments", icon: "💳" },
      ]}
      activeKey="clients"
      onNav={(k) => nav(`/admin/${k === "dashboard" ? "" : k}`)}
      user={user}
      onLogout={onLogout}
      children={{
        topRight: (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={openCreate} disabled={deleting}>
              ＋ Add Client
            </button>
            {deleting && (
              <span style={{ color: "#64748b", fontWeight: 700 }}>
                Deleting...
              </span>
            )}
          </div>
        ),
        content: (
          <>
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            {msg && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: msg.includes("✅") ? "#ecfdf5" : "#fff7ed",
                  border: msg.includes("✅")
                    ? "1px solid #a7f3d0"
                    : "1px solid #fed7aa",
                  color: msg.includes("✅") ? "#065f46" : "#9a3412",
                  fontWeight: 700,
                }}
              >
                {msg}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))",
                gap: 18,
                alignItems: "start",
              }}
            >
              {filtered.map((c) => (
                <ClientCard
                  key={c.contractId}
                  c={c}
                  onEdit={openEdit}
                  onLedger={() => nav(`/admin/ledger/${c.contractId}`)}
                  onDelete={deleteClient}
                />
              ))}
            </div>

            <Modal
              open={open}
              onClose={() => setOpen(false)}
              title={mode === "create" ? "Add Client" : "Edit Client"}
            >
              {msg && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412",
                    fontWeight: 700,
                  }}
                >
                  {msg}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                <Field label="Full Name" required>
                  <Input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    placeholder="Enter full name"
                  />
                </Field>

                <Field label="Email" required>
                  <Input
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="Enter email"
                  />
                </Field>

                <Field label="Phone" required>
                  <Input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="Enter phone number"
                  />
                </Field>

                <Field label="CNIC">
                  <Input
                    value={form.cnic}
                    onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                    placeholder="Enter CNIC"
                  />
                </Field>

                <Field label="Address">
                  <Input
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    placeholder="Enter address"
                  />
                </Field>
                <div />

                {mode === "create" && (
                  <>
                    <Field label="Password" required>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        placeholder="Enter password"
                      />
                    </Field>
                    <div />
                  </>
                )}

                <Field label="Project">
                  <Select
                    value={form.project}
                    onChange={(e) =>
                      setForm({ ...form, project: e.target.value })
                    }
                  >
                    <option value="Avenue 18">Avenue 18</option>
                  </Select>
                </Field>

                <Field label="Status">
                  <Select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </Select>
                </Field>

                <Field label="Unit Number" required>
                  <Input
                    value={form.unitNumber}
                    onChange={(e) =>
                      setForm({ ...form, unitNumber: e.target.value })
                    }
                    placeholder="e.g., A-101"
                  />
                </Field>

                <Field label="Unit Type">
                  <Select
                    value={form.unitType}
                    onChange={(e) =>
                      setForm({ ...form, unitType: e.target.value })
                    }
                  >
                    <option>Apartment</option>
                    <option>Shop</option>
                    <option>Office</option>
                    <option>Food Court</option>
                  </Select>
                </Field>

                <Field label="Total Price (Rs.)" required>
                  <Input
                    type="number"
                    value={form.totalPrice}
                    onChange={(e) =>
                      setForm({ ...form, totalPrice: e.target.value })
                    }
                    placeholder="Enter total price"
                  />
                </Field>

                <Field label="Down Payment (Rs.)">
                  <Input
                    type="number"
                    value={form.downPayment}
                    onChange={(e) =>
                      setForm({ ...form, downPayment: e.target.value })
                    }
                    placeholder="Enter down payment"
                  />
                </Field>

                <Field label="Possession (%)">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.possession}
                    onChange={(e) =>
                      setForm({ ...form, possession: e.target.value })
                    }
                    placeholder="e.g., 10"
                  />
                </Field>

                <Field label="Months" required>
                  <Input
                    type="number"
                    value={form.months}
                    onChange={(e) =>
                      setForm({ ...form, months: e.target.value })
                    }
                    placeholder="e.g., 36"
                  />
                </Field>

                <Field label="Booking Date">
                  <Input
                    type="date"
                    value={form.bookingDate}
                    onChange={(e) =>
                      setForm({ ...form, bookingDate: e.target.value })
                    }
                  />
                </Field>
                <div />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 16,
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {mode === "edit" ? (
                  <button
                    className="btn secondary"
                    onClick={deleteFromModal}
                    disabled={deleting}
                    style={{ borderColor: "#fecaca", color: "#991b1b" }}
                  >
                    {deleting ? "Deleting..." : "🗑 Delete Client"}
                  </button>
                ) : (
                  <div />
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="btn secondary"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>

                  <button className="btn" onClick={submit} disabled={saving}>
                    {saving
                      ? "Saving..."
                      : mode === "create"
                        ? "Add Client"
                        : "Update"}
                  </button>
                </div>
              </div>
            </Modal>
          </>
        ),
      }}
    />
  );
}
