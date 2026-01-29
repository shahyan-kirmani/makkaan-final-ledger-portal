// src/routes/adminClients.js
const router = require("express").Router();
const bcrypt = require("bcrypt");
const prisma = require("../prisma");
const { auth, requireRole } = require("../middleware/auth");

// Only Acquisition/Admin users can access
router.use(auth, requireRole("ACQUISITION"));

/**
 * GET /api/admin/clients
 * List contracts with user + unit (summary)
 */
router.get("/", async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true, unit: true },
    });

    res.json(
      contracts.map((c) => ({
        contractId: c.id,
        clientId: c.clientId,
        clientName: c.user?.name || "",
        email: c.user?.email || "",
        phone: c.user?.phone || "",
        cnic: c.user?.cnic || "",
        address: c.user?.address || "",
        project: c.unit?.project || "",
        unitNumber: c.unit?.unitNumber || "",
        unitSize: c.unit?.unitSize || 0,
        unitType: c.unit?.unitType || "",
        status: c.status || "Active",
        totalAmount: c.totalAmount,
        downPayment: c.downPayment || 0,
        downpaymentPct: c.downpaymentPct,
        possession: c.possession || 0,
        months: c.months,
        bookingDate: c.bookingDate,
        startDate: c.startDate,
      })),
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

/**
 * ✅ NEW (REQUIRED)
 * GET /api/admin/clients/:contractId
 * Fetch single contract with user + unit (for Edit modal auto-fill)
 */
router.get("/:contractId", async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);
    if (!contractId) {
      return res.status(400).json({ error: "Invalid contractId" });
    }

    const c = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { user: true, unit: true },
    });

    if (!c) return res.status(404).json({ error: "Contract not found" });

    return res.json({
      contractId: c.id,
      clientId: c.clientId,
      clientName: c.user?.name || "",
      email: c.user?.email || "",
      phone: c.user?.phone || "",
      cnic: c.user?.cnic || "",
      address: c.user?.address || "",
      project: c.unit?.project || "",
      unitNumber: c.unit?.unitNumber || "",
      unitSize: c.unit?.unitSize || 0,
      unitType: c.unit?.unitType || "",
      status: c.status || "Active",
      totalAmount: c.totalAmount,
      downPayment: c.downPayment || 0,
      downpaymentPct: c.downpaymentPct,
      possession: c.possession || 0,
      months: c.months,
      bookingDate: c.bookingDate,
      startDate: c.startDate,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch client details" });
  }
});

/**
 * POST /api/admin/clients
 * Create user + unit + contract in one transaction
 */
router.post("/", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      cnic,
      address,
      password,
      project,
      unitNumber,
      unitType,
      unitSize,
      status,
      totalAmount,
      downPayment,
      months,
      bookingDate,
      downpaymentPct,
      startDate,
      possession,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !password ||
      !unitNumber ||
      !totalAmount ||
      !months
    ) {
      return res.status(400).json({
        error:
          "fullName, email, phone, password, unitNumber, totalAmount, months are required",
      });
    }

    const emailLower = String(email).toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing)
      return res.status(400).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(String(password), 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: fullName,
          email: emailLower,
          phone: String(phone),
          cnic: cnic ? String(cnic) : null,
          address: address ? String(address).trim() : null,
          passwordHash,
          role: "CLIENT",
        },
      });

      const unit = await tx.unit.create({
        data: {
          project: project || "Avenue 18",
          unitNumber: String(unitNumber),
          unitType: unitType || null,
          unitSize: unitSize ? Number(unitSize) : 0,
        },
      });

      const contract = await tx.contract.create({
        data: {
          clientId: user.id,
          unitId: unit.id,
          totalAmount: Number(totalAmount),
          downpaymentPct: downpaymentPct ? Number(downpaymentPct) : 20,
          startDate: startDate ? new Date(startDate) : new Date(),
          months: Number(months),
          status: status || "Active",
          downPayment: downPayment ? Number(downPayment) : 0,
          bookingDate: bookingDate ? new Date(bookingDate) : null,
          possession:
            possession === "" || possession === null || possession === undefined
              ? 0
              : Number(possession),
        },
        include: { user: true, unit: true },
      });

      return contract;
    });

    return res.json({
      contractId: created.id,
      clientId: created.clientId,
      clientName: created.user?.name || "",
      email: created.user?.email || "",
      phone: created.user?.phone || "",
      cnic: created.user?.cnic || "",
      address: created.user?.address || "",
      project: created.unit?.project || "",
      unitNumber: created.unit?.unitNumber || "",
      unitSize: created.unit?.unitSize || 0,
      unitType: created.unit?.unitType || "",
      status: created.status || "Active",
      totalAmount: created.totalAmount,
      downPayment: created.downPayment || 0,
      possession: created.possession || 0,
      months: created.months,
      bookingDate: created.bookingDate,
      startDate: created.startDate,
      downpaymentPct: created.downpaymentPct,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create client" });
  }
});

/**
 * PUT /api/admin/clients/:contractId
 */
router.put("/:contractId", async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);

    const {
      fullName,
      email,
      phone,
      cnic,
      address,
      project,
      unitNumber,
      unitType,
      unitSize,
      status,
      totalAmount,
      downPayment,
      months,
      bookingDate,
      possession,
      downpaymentPct,
      startDate,
    } = req.body;

    const existingContract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { user: true, unit: true },
    });

    if (!existingContract)
      return res.status(404).json({ error: "Contract not found" });

    await prisma.user.update({
      where: { id: existingContract.clientId },
      data: {
        name: fullName ?? existingContract.user?.name,
        email: email
          ? String(email).toLowerCase().trim()
          : existingContract.user?.email,

        // ✅ CHANGE: update only if provided
        phone:
          phone !== undefined
            ? phone === "" || phone === null
              ? null
              : String(phone).trim()
            : (existingContract.user?.phone ?? null),

        // ✅ CHANGE: update only if provided + normalize empty to null
        cnic:
          cnic !== undefined
            ? cnic === "" || cnic === null
              ? null
              : String(cnic).trim()
            : (existingContract.user?.cnic ?? null),

        // ✅ already correct, just kept
        address:
          address !== undefined
            ? address === "" || address === null
              ? null
              : String(address).trim()
            : (existingContract.user?.address ?? null),
      },
    });

    await prisma.unit.update({
      where: { id: existingContract.unitId },
      data: {
        project: project ?? existingContract.unit?.project,
        unitNumber: unitNumber ?? existingContract.unit?.unitNumber,
        unitType: unitType ?? existingContract.unit?.unitType,
        unitSize:
          unitSize !== undefined
            ? Number(unitSize)
            : existingContract.unit?.unitSize,
      },
    });

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        totalAmount:
          totalAmount !== undefined
            ? Number(totalAmount)
            : existingContract.totalAmount,
        months: months !== undefined ? Number(months) : existingContract.months,
        status: status ?? existingContract.status,
        downPayment:
          downPayment !== undefined
            ? Number(downPayment)
            : existingContract.downPayment,
        bookingDate: bookingDate
          ? new Date(bookingDate)
          : existingContract.bookingDate,
        possession:
          possession !== undefined
            ? possession === "" || possession === null
              ? 0
              : Number(possession)
            : existingContract.possession,
        downpaymentPct:
          downpaymentPct !== undefined
            ? Number(downpaymentPct)
            : existingContract.downpaymentPct,
        startDate: startDate ? new Date(startDate) : existingContract.startDate,
      },
      include: { user: true, unit: true },
    });

    res.json({
      contractId: updated.id,
      clientId: updated.clientId,
      clientName: updated.user?.name || "",
      email: updated.user?.email || "",
      phone: updated.user?.phone || "",
      cnic: updated.user?.cnic || "",
      address: updated.user?.address || "",
      project: updated.unit?.project || "",
      unitNumber: updated.unit?.unitNumber || "",
      unitSize: updated.unit?.unitSize || 0,
      unitType: updated.unit?.unitType || "",
      status: updated.status || "Active",
      totalAmount: updated.totalAmount,
      downPayment: updated.downPayment || 0,
      possession: updated.possession || 0,
      months: updated.months,
      bookingDate: updated.bookingDate,
      startDate: updated.startDate,
      downpaymentPct: updated.downpaymentPct,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update client" });
  }
});

/**
 * DELETE /api/admin/clients/:contractId
 * Deletes ledger rows + contract + unit + client user
 */
router.delete("/:contractId", async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);
    if (!contractId)
      return res.status(400).json({ error: "Invalid contractId" });

    const existing = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true, unitId: true },
    });

    if (!existing) return res.status(404).json({ error: "Contract not found" });

    await prisma.$transaction(async (tx) => {
      await tx.ledgerrow.deleteMany({ where: { contractId: existing.id } });
      await tx.contract.delete({ where: { id: existing.id } });
      await tx.unit.delete({ where: { id: existing.unitId } });

      const u = await tx.user.findUnique({
        where: { id: existing.clientId },
        select: { id: true, role: true },
      });
      if (u && u.role === "CLIENT") {
        await tx.user.delete({ where: { id: u.id } });
      }
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to delete client" });
  }
});

module.exports = router;
