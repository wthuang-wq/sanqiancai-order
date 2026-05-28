const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const backupDir = path.join(dataDir, "backups");
const ordersFile = path.join(dataDir, "orders.json");
const customersFile = path.join(dataDir, "customers.json");
const settingsFile = path.join(dataDir, "settings.json");
const productsFile = path.join(dataDir, "products.json");
const productCategoriesFile = path.join(dataDir, "product-categories.json");
const hiddenProductsFile = path.join(dataDir, "hidden-products.json");
const inventoryFile = path.join(dataDir, "inventory.json");
const batchesFile = path.join(dataDir, "batches.json");
const paymentsFile = path.join(dataDir, "payments.json");
const port = Number(process.env.PORT || 4173);
const sessions = new Map();
const localDefaultPassword = !process.env.PORT && process.env.NODE_ENV !== "production" ? "123456" : "";
const authRequired = process.env.DISABLE_AUTH === "1" ? false : Boolean(process.env.PORT || process.env.FORCE_AUTH === "1");
const localBypassSession = { role: "admin", name: "私域免登录", createdAt: Date.now() };

const accounts = {
  sales: { password: process.env.SALES_PASSWORD || localDefaultPassword, role: "sales", name: "业务员" },
  assistant: { password: process.env.ASSISTANT_PASSWORD || localDefaultPassword, role: "assistant", name: "销售助理" },
  owner: { password: process.env.OWNER_PASSWORD || localDefaultPassword, role: "owner", name: "老板" },
  stock: { password: process.env.STOCK_PASSWORD || localDefaultPassword, role: "stock", name: "仓库" },
  finance: { password: process.env.FINANCE_PASSWORD || localDefaultPassword, role: "finance", name: "财务" },
  admin: { password: process.env.ADMIN_PASSWORD || localDefaultPassword, role: "admin", name: "系统管理" },
};

for (let index = 1; index <= 8; index += 1) {
  const code = `sales${index}`;
  accounts[code] = {
    password: process.env[`SALES${index}_PASSWORD`] || process.env.SALES_PASSWORD || localDefaultPassword,
    role: "sales",
    name: `业务员${index}`,
    salesCode: code,
  };
}

const roleVisibleStatuses = {
  sales: new Set(["sales", "shortage_sales"]),
  assistant: new Set(["assistant", "shortage_assistant", "return_requested"]),
  owner: null,
  stock: new Set(["stock", "cooking", "done"]),
  finance: null,
  admin: null,
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const allowedStatuses = new Set([
  "warehouse",
  "boss",
  "sales",
  "assistant",
  "owner",
  "stock",
  "cooking",
  "done",
  "return_requested",
  "shortage_assistant",
  "shortage_sales",
  "shortage_customer",
]);

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(backupDir, { recursive: true });
  await ensureJsonFile(ordersFile, []);
  await ensureJsonFile(customersFile, []);
  await ensureJsonFile(settingsFile, { showPrices: false });
  await ensureJsonFile(productsFile, []);
  await ensureJsonFile(productCategoriesFile, ["色浆", "助剂", "分散染料", "其他"]);
  await ensureJsonFile(hiddenProductsFile, []);
  await ensureJsonFile(inventoryFile, {});
  await ensureJsonFile(batchesFile, []);
  await ensureJsonFile(paymentsFile, []);
}

async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function readJsonFile(filePath, fallback) {
  await ensureStore();
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content || JSON.stringify(fallback));
}

async function writeJsonFile(filePath, data) {
  await ensureStore();
  await backupJsonFile(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function backupJsonFile(filePath) {
  try {
    const current = await fs.readFile(filePath, "utf8");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const basename = path.basename(filePath, ".json");
    await fs.writeFile(path.join(backupDir, `${basename}-${timestamp}.json`), current, "utf8");
  } catch (error) {
    // No existing file yet; nothing to back up.
  }
}

async function readOrders() {
  return readJsonFile(ordersFile, []);
}

async function writeOrders(orders) {
  await writeJsonFile(ordersFile, orders);
}

async function readCustomers() {
  return readJsonFile(customersFile, []);
}

async function writeCustomers(customers) {
  await writeJsonFile(customersFile, customers);
}

async function readSettings() {
  return readJsonFile(settingsFile, { showPrices: false });
}

async function writeSettings(settings) {
  await writeJsonFile(settingsFile, settings);
}

async function readProducts() {
  return readJsonFile(productsFile, []);
}

async function writeProducts(products) {
  await writeJsonFile(productsFile, products);
}

async function readProductCategories() {
  return readJsonFile(productCategoriesFile, ["色浆", "助剂", "分散染料", "其他"]);
}

async function writeProductCategories(categories) {
  await writeJsonFile(productCategoriesFile, categories);
}

async function readHiddenProducts() {
  return readJsonFile(hiddenProductsFile, []);
}

async function writeHiddenProducts(products) {
  await writeJsonFile(hiddenProductsFile, products);
}

async function readInventory() {
  return readJsonFile(inventoryFile, {});
}

async function writeInventory(inventory) {
  await writeJsonFile(inventoryFile, inventory);
}

async function readBatches() {
  return readJsonFile(batchesFile, []);
}

async function writeBatches(batches) {
  await writeJsonFile(batchesFile, batches);
}

async function getInventoryFromBatches() {
  const batches = await readBatches();
  return batches.reduce((inventory, batch) => {
    const number = String(batch.productNumber || "").trim().toUpperCase();
    if (!number) return inventory;
    inventory[number] = Number(inventory[number] || 0) + Number(batch.remaining || 0);
    return inventory;
  }, {});
}

async function readPayments() {
  return readJsonFile(paymentsFile, []);
}

async function writePayments(payments) {
  await writeJsonFile(paymentsFile, payments);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("Body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index >= 0 ? [item.slice(0, index), decodeURIComponent(item.slice(index + 1))] : [item, ""];
      }),
  );
}

function getSession(request) {
  if (!authRequired) return localBypassSession;
  const token = parseCookies(request).sqc_session;
  if (!token) return null;
  return sessions.get(token) || null;
}

function sendUnauthorized(response) {
  sendJson(response, 401, { error: "Unauthorized" });
}

function requireSession(request, response, roles = []) {
  const session = getSession(request);
  if (!session) {
    sendUnauthorized(response);
    return null;
  }
  if (roles.length && !roles.includes(session.role)) {
    sendJson(response, 403, { error: "Forbidden" });
    return null;
  }
  return session;
}

function createSession(response, account) {
  const token = crypto.randomUUID();
  const session = { role: account.role, name: account.name, salesCode: account.salesCode || "", createdAt: Date.now() };
  sessions.set(token, session);
  response.setHeader("Set-Cookie", `sqc_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  return session;
}

function clearSession(request, response) {
  const token = parseCookies(request).sqc_session;
  if (token) sessions.delete(token);
  response.setHeader("Set-Cookie", "sqc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function filterBySalesCode(orders, salesCode) {
  const code = String(salesCode || "").trim();
  return code ? orders.filter((order) => order.salesCode === code) : orders;
}

function filterOrdersByRole(orders, role, salesCode = "") {
  if (role === "sales") {
    return filterBySalesCode(orders, salesCode);
  }
  const visibleStatuses = roleVisibleStatuses[role];
  if (!visibleStatuses) return orders;
  return orders.filter((order) => visibleStatuses.has(order.status));
}

function sendCsv(response, filename, csv) {
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  });
  response.end(`\uFEFF${csv}`);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function makeCsvSection(title, headers, rows) {
  return [
    [title].map(csvValue).join(","),
    headers.map(csvValue).join(","),
    ...rows.map((row) => row.map(csvValue).join(",")),
    "",
  ].join("\n");
}

function makeExportCsv({ settings, customers, orders }) {
  const customerRows = customers.map((customer) => [
    customer.code,
    customer.name,
    customer.contactName || customer.contact,
    customer.phone,
    customer.address,
    Object.entries(customer.prices || {})
      .map(([code, price]) => `${code}=${price}`)
      .join("; "),
  ]);

  const orderRows = orders.flatMap((order) =>
    (order.items || []).map((item) => [
      order.id,
      order.status,
      order.customerName || order.tableNo,
      order.time,
      item.name,
      item.spec,
      item.qty,
      item.unitPrice ?? "",
      item.lineTotal ?? "",
      order.total ?? "",
      order.note || "",
    ]),
  );

  return [
    makeCsvSection("设置", ["前台显示价格"], [[settings.showPrices ? "是" : "否"]]),
    makeCsvSection("客户", ["客户编号", "客户名称", "联系人", "联系电话", "收货地址", "专属单价"], customerRows),
    makeCsvSection("订单", ["订单号", "状态", "客户", "时间", "产品", "规格", "数量", "单价/公斤", "行金额", "订单金额", "备注"], orderRows),
  ].join("\n");
}

function getCustomerKeyFromOrder(order) {
  return order.customerCode || order.customerName || order.tableNo || "未填写";
}

function getPeriodRange(period) {
  const now = new Date();
  if (period === "day") {
    return {
      label: "今日",
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }
  if (period === "week") {
    const day = now.getDay() || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    return { label: "本周", start };
  }
  return {
    label: `${now.getFullYear()}年${now.getMonth() + 1}月`,
    start: new Date(now.getFullYear(), now.getMonth(), 1),
  };
}

function parseDateStart(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseDateEnd(value) {
  const start = parseDateStart(value);
  if (!start) return null;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

function formatDateLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getOrderProductKey(item) {
  const name = String(item.name || "").trim();
  const number = String(item.number || "").trim();
  if (name && number && name.includes(number)) return name;
  return `${name} ${number}`.trim() || "未命名产品";
}

function getOrderItemKg(item) {
  const match = String(item.spec || "").match(/(\d+(?:\.\d+)?)\s*(kg|公斤)/i);
  return (match ? Number(match[1]) : 0) * Number(item.qty || 0);
}

function getOrderLineAmount(item) {
  if (item.settlementLineTotal !== null && item.settlementLineTotal !== undefined && item.settlementLineTotal !== "") return Number(item.settlementLineTotal || 0);
  const settlementUnitPrice = Number(item.settlementUnitPrice);
  if (Number.isFinite(settlementUnitPrice) && settlementUnitPrice > 0) return settlementUnitPrice * getOrderItemKg(item);
  if (item.lineTotal !== null && item.lineTotal !== undefined && item.lineTotal !== "") return Number(item.lineTotal || 0);
  const unitPrice = Number(item.unitPrice);
  return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice * getOrderItemKg(item) : 0;
}

function getOrderAmount(order) {
  return (order.items || []).reduce((sum, item) => sum + getOrderLineAmount(item), 0);
}

function makeSalesSummary(orders, payments = [], filters = {}) {
  const period = ["day", "week", "month"].includes(filters.period) ? filters.period : "month";
  const customerFilter = String(filters.customer || "").trim();
  const productFilter = String(filters.product || "").trim();
  const customStart = parseDateStart(filters.startDate);
  const customEnd = parseDateEnd(filters.endDate);
  const periodRange = customStart || customEnd ? { label: "", start: customStart || new Date(0), end: customEnd || null } : getPeriodRange(period);
  let scopedOrders = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= periodRange.start && (!periodRange.end || createdAt < periodRange.end);
  });

  if (customerFilter) {
    scopedOrders = scopedOrders.filter((order) => getCustomerKeyFromOrder(order) === customerFilter);
  }
  if (productFilter) {
    scopedOrders = scopedOrders
      .map((order) => ({
        ...order,
        items: (order.items || []).filter((item) => getOrderProductKey(item) === productFilter || item.number === productFilter),
      }))
      .filter((order) => order.items.length);
  }

  const sumAmount = (list) =>
    list.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + getOrderLineAmount(item), 0), 0);
  const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const customerMap = new Map();
  const productMap = new Map();
  const allCustomerOptions = new Map();
  const allProductOptions = new Map();

  orders.forEach((order) => {
    const customerKey = getCustomerKeyFromOrder(order);
    allCustomerOptions.set(customerKey, order.customerName || order.tableNo || "未填写");
    (order.items || []).forEach((item) => {
      const productKey = getOrderProductKey(item);
      allProductOptions.set(productKey, productKey);
    });
  });

  scopedOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = getOrderProductKey(item);
      const current = productMap.get(key) || { key, name: key, kg: 0, amount: 0, qty: 0 };
      current.kg += getOrderItemKg(item);
      current.amount += getOrderLineAmount(item);
      current.qty += Number(item.qty || 0);
      productMap.set(key, current);
    });
  });

  orders.forEach((order) => {
    const key = getCustomerKeyFromOrder(order);
    const name = order.customerName || order.tableNo || "未填写";
    const current = customerMap.get(key) || { key, name, amount: 0, paid: 0, debt: 0, orders: 0 };
    current.amount += getOrderAmount(order);
    current.debt = current.amount - current.paid;
    current.orders += 1;
    customerMap.set(key, current);
  });

  payments.forEach((payment) => {
    const key = payment.customerCode || payment.customerName || "未填写";
    const current = customerMap.get(key) || { key, name: payment.customerName || key, amount: 0, paid: 0, debt: 0, orders: 0 };
    current.paid += Number(payment.amount || 0);
    current.debt = current.amount - current.paid;
    customerMap.set(key, current);
  });

  return {
    period,
    startDate: filters.startDate || "",
    endDate: filters.endDate || "",
    periodLabel:
      customStart || customEnd
        ? `${customStart ? formatDateLabel(customStart) : "最早"} 至 ${customEnd ? formatDateLabel(new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate() - 1)) : "今天"}`
        : periodRange.label,
    orderCount: scopedOrders.length,
    salesAmount: sumAmount(scopedOrders),
    totalReceivable: sumAmount(orders),
    totalPaid: paidTotal,
    totalDebt: sumAmount(orders) - paidTotal,
    customerOptions: [...allCustomerOptions.entries()].map(([key, name]) => ({ key, name })),
    productOptions: [...allProductOptions.entries()].map(([key, name]) => ({ key, name })),
    productSales: [...productMap.values()].sort((a, b) => b.amount - a.amount || b.kg - a.kg),
    customerDebts: [...customerMap.values()].sort((a, b) => b.debt - a.debt).slice(0, 12),
    recentPayments: payments.slice(0, 12),
  };
}

function getFrequentNumbers(orders, customerCode) {
  const counts = new Map();

  orders
    .filter((order) => order.customerCode === customerCode)
    .forEach((order) => {
      (order.items || []).forEach((item) => {
        const number = String(item.number || "").trim();
        if (!number) return;
        counts.set(number, (counts.get(number) || 0) + Number(item.qty || 1));
      });
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([number]) => number);
}

function getOrderStats(items) {
  let count = 0;
  let subtotal = 0;
  let kg = 0;

  for (const item of items) {
    const qty = Number(item.qty);
    const price = Number(item.lineTotal || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) {
      throw new Error("Invalid item");
    }

    count += qty;
    subtotal += price;
    const specMatch = String(item.spec || "").match(/(\d+(?:\.\d+)?)\s*(kg|公斤)/i);
    kg += specMatch ? Number(specMatch[1]) * qty : 0;
  }

  return { count, subtotal, serviceFee: kg, total: subtotal };
}

function getDeliveryItems(order) {
  return (order.items || []).map((item, index) => {
    const saved = order.deliveryItems?.[index];
    const parsed = Number(saved);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    const specMatch = String(item.spec || "").match(/(\d+(?:\.\d+)?)\s*(kg|公斤)/i);
    return (specMatch ? Number(specMatch[1]) : 0) * Number(item.qty || 0);
  });
}

async function deductInventoryForOrder(order) {
  const inventory = await readInventory();
  const deliveryItems = getDeliveryItems(order);

  (order.items || []).forEach((item, index) => {
    const number = String(item.number || "").trim().toUpperCase();
    if (!number) return;
    const current = Number(inventory[number] || 0);
    const shipped = Number(deliveryItems[index] || 0);
    inventory[number] = Math.max(0, current - shipped);
  });

  await writeInventory(inventory);
  return inventory;
}

async function allocateBatchesForOrder(order) {
  const batches = await readBatches();
  const deliveryItems = getDeliveryItems(order);
  const batchAllocations = {};

  (order.items || []).forEach((item, index) => {
    const productNumber = String(item.number || "").trim().toUpperCase();
    let requiredQty = Number(deliveryItems[index] || 0);
    if (!productNumber || !requiredQty) return;

    const productBatches = batches
      .filter((batch) => batch.productNumber === productNumber && Number(batch.remaining || 0) > 0)
      .sort((a, b) => {
        const dateA = new Date(a.producedAt || a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.producedAt || b.createdAt || 0).getTime() || 0;
        return dateA - dateB;
      });

    const allocations = [];
    for (const batch of productBatches) {
      if (requiredQty <= 0) break;
      const available = Number(batch.remaining || 0);
      const usedQty = Math.min(available, requiredQty);
      batch.remaining = Math.max(0, available - usedQty);
      batch.updatedAt = new Date().toISOString();
      requiredQty -= usedQty;
      allocations.push({
        batchId: batch.id,
        batchCode: batch.batchCode,
        qty: usedQty,
      });
    }

    if (requiredQty > 0) {
      const error = new Error(`批号库存不足：${item.name || productNumber} 差 ${requiredQty} 公斤`);
      error.statusCode = 409;
      throw error;
    }

    batchAllocations[String(index)] = {
      productNumber,
      productName: item.name || "",
      qty: Number(deliveryItems[index] || 0),
      batches: allocations,
    };
  });

  await writeBatches(batches);
  order.batchAllocations = batchAllocations;
  return { batches, batchAllocations };
}

function extractPhone(value) {
  const match = String(value || "").match(/(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/);
  return match ? match[0].replace(/[-\s]/g, "") : "";
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getSettlementLineTotal(order, item, index, unitPrice) {
  const deliveryQty = getDeliveryItems(order)[index] ?? getOrderItemKg(item);
  return unitPrice * Number(deliveryQty || 0);
}

function makePublicOrder(payload, orders) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Missing items");
  }

  const stats = getOrderStats(payload.items);
  const createdAt = new Date();
  const customerCode = String(payload.customerCode || "").slice(0, 40);
  const salesCode = String(payload.salesCode || "").trim().slice(0, 40);
  const salesName = String(payload.salesName || "").trim().slice(0, 40);
  const source = String(payload.source || "").trim().slice(0, 40);
  const isSalesOrder = source === "sales" || Boolean(salesCode);
  const skipBossApproval = Boolean(payload.skipBossApproval);
  const initialStatus = isSalesOrder ? "assistant" : customerCode && !skipBossApproval ? "boss" : "sales";

  return {
    id: `订单 ${String(orders.length + 1).padStart(3, "0")}`,
    customerCode,
    customerName: String(payload.customerName || "").slice(0, 80),
    customerContactName: String(payload.customerContactName || payload.customerContact || "").slice(0, 80),
    customerPhone: String(payload.customerPhone || extractPhone(payload.customerContact || payload.tableNo || "")).slice(0, 40),
    customerAddress: String(payload.customerAddress || "").slice(0, 160),
    salesCode,
    salesName,
    source,
    tableNo: String(payload.tableNo || "未填写").slice(0, 80),
    time: createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    createdAt: createdAt.toISOString(),
    status: initialStatus,
    approvalHistory: [
      {
        status: initialStatus,
        at: createdAt.toISOString(),
        by: isSalesOrder ? salesName || "业务员下单" : customerCode && !skipBossApproval ? "仓库下单" : "客户直接下单",
      },
    ],
    items: payload.items.map((item) => ({
      name: String(item.name || "未命名菜品").slice(0, 40),
      number: String(item.number || "").slice(0, 20),
      spec: String(item.spec || "默认").slice(0, 30),
      price: Number(item.price),
      unitPrice: normalizeOptionalNumber(item.unitPrice),
      lineTotal: normalizeOptionalNumber(item.lineTotal),
      settlementUnitPrice: null,
      settlementLineTotal: null,
      qty: Number(item.qty),
    })),
    note: String(payload.note || "").slice(0, 200),
    ...stats,
  };
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/session") {
    const session = getSession(request);
    sendJson(response, session ? 200 : 401, session ? { ok: true, user: session } : { error: "Unauthorized" });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    const payload = await readJsonBody(request);
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "");
    const account = accounts[username];

    if (!account || account.password !== password) {
      sendJson(response, 401, { error: "Invalid username or password" });
      return true;
    }

    const session = createSession(response, account);
    sendJson(response, 200, { ok: true, user: session });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    clearSession(request, response);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/export") {
    if (!requireSession(request, response, ["owner", "admin"])) return true;
    sendJson(response, 200, {
      exportedAt: new Date().toISOString(),
      settings: await readSettings(),
      customers: await readCustomers(),
      orders: await readOrders(),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/export.csv") {
    if (!requireSession(request, response, ["owner", "admin"])) return true;
    const data = {
      settings: await readSettings(),
      customers: await readCustomers(),
      orders: await readOrders(),
    };
    sendCsv(response, "sanqiancai-data.csv", makeExportCsv(data));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/sales-summary") {
    if (!requireSession(request, response, ["sales", "assistant", "finance", "owner", "admin"])) return true;
    const session = getSession(request);
    const requestedSalesCode = url.searchParams.get("sales") || "";
    const salesCode = session?.role === "sales" ? session.salesCode || requestedSalesCode : "";
    const orders = session?.role === "sales" && !salesCode ? [] : filterBySalesCode(await readOrders(), salesCode);
    sendJson(
      response,
      200,
      makeSalesSummary(orders, await readPayments(), {
        period: url.searchParams.get("period") || "month",
        startDate: url.searchParams.get("startDate") || "",
        endDate: url.searchParams.get("endDate") || "",
        customer: url.searchParams.get("customer") || "",
        product: url.searchParams.get("product") || "",
      }),
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/shipment-notices") {
    if (!requireSession(request, response, ["sales", "assistant", "owner", "admin"])) return true;
    const session = getSession(request);
    const salesCode = session?.role === "sales" ? session.salesCode || url.searchParams.get("sales") || "" : "";
    const baseOrders = session?.role === "sales" && !salesCode ? [] : filterBySalesCode(await readOrders(), salesCode);
    const orders = baseOrders
      .filter((order) => order.status === "done")
      .slice(0, 8);
    sendJson(response, 200, orders);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/payments") {
    if (!requireSession(request, response, ["finance", "owner", "admin"])) return true;
    sendJson(response, 200, await readPayments());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/payments") {
    if (!requireSession(request, response, ["finance", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const customerName = String(payload.customerName || "").trim();
    const amount = Number(payload.amount);

    if (!customerName || !Number.isFinite(amount) || amount <= 0) {
      sendJson(response, 400, { error: "Missing customer name or amount" });
      return true;
    }

    const payments = await readPayments();
    const payment = {
      id: crypto.randomUUID(),
      customerCode: String(payload.customerCode || "").trim().slice(0, 40),
      customerName: customerName.slice(0, 80),
      amount,
      method: String(payload.method || "").trim().slice(0, 40),
      note: String(payload.note || "").trim().slice(0, 160),
      createdAt: new Date().toISOString(),
    };
    payments.unshift(payment);
    await writePayments(payments);
    sendJson(response, 201, payment);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    const settings = await readSettings();
    const customers = await readCustomers();
    const orders = await readOrders();
    const products = await readProducts();
    const productCategories = await readProductCategories();
    const hiddenProducts = await readHiddenProducts();
    const customerCode = url.searchParams.get("customer") || "";
    const customer = customers.find((item) => item.code === customerCode) || null;
    if (customer) {
      customer.frequent = getFrequentNumbers(orders, customer.code);
    }
    sendJson(response, 200, { settings, customer, products, productCategories, hiddenProducts });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/products") {
    if (!requireSession(request, response, ["assistant", "owner", "stock", "admin"])) return true;
    sendJson(response, 200, await readProducts());
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/hidden-products") {
    if (!requireSession(request, response, ["assistant", "owner", "stock", "admin"])) return true;
    sendJson(response, 200, await readHiddenProducts());
    return true;
  }

  if (request.method === "PATCH" && url.pathname === "/api/hidden-products") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const number = String(payload.number || "").trim().toUpperCase();
    if (!number) {
      sendJson(response, 400, { error: "Missing product number" });
      return true;
    }

    const hidden = new Set(await readHiddenProducts());
    if (payload.hidden === false) {
      hidden.delete(number);
    } else {
      hidden.add(number);
    }
    const nextHidden = [...hidden];
    await writeHiddenProducts(nextHidden);
    sendJson(response, 200, nextHidden);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/product-categories") {
    if (!requireSession(request, response, ["assistant", "owner", "stock", "admin"])) return true;
    sendJson(response, 200, await readProductCategories());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/product-categories") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const name = String(payload.name || "").trim();
    if (!name) {
      sendJson(response, 400, { error: "Missing category name" });
      return true;
    }

    const categories = await readProductCategories();
    if (!categories.includes(name)) {
      categories.push(name.slice(0, 20));
      await writeProductCategories(categories);
    }
    sendJson(response, 201, categories);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/inventory") {
    if (!requireSession(request, response, ["stock", "owner", "admin"])) return true;
    sendJson(response, 200, await getInventoryFromBatches());
    return true;
  }

  if (request.method === "PATCH" && url.pathname === "/api/inventory") {
    if (!requireSession(request, response, ["stock", "owner", "admin"])) return true;
    sendJson(response, 409, { error: "库存由入库批号自动汇总，不能手动修改" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/batches") {
    if (!requireSession(request, response, ["stock", "owner", "admin"])) return true;
    const product = String(url.searchParams.get("product") || "").trim().toUpperCase();
    const batches = await readBatches();
    sendJson(response, 200, product ? batches.filter((batch) => batch.productNumber === product) : batches);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/batch-trace") {
    if (!requireSession(request, response, ["assistant", "owner", "stock", "admin"])) return true;
    const keyword = String(url.searchParams.get("batch") || "").trim().toUpperCase();
    if (!keyword) {
      sendJson(response, 200, { batch: "", rows: [] });
      return true;
    }

    const orders = await readOrders();
    const rows = [];
    for (const order of orders) {
      Object.entries(order.batchAllocations || {}).forEach(([index, allocation]) => {
        const batchesInLine = Array.isArray(allocation?.batches)
          ? allocation.batches
          : allocation?.batchCode
            ? [{ batchId: allocation.batchId, batchCode: allocation.batchCode, qty: allocation.qty }]
            : [];

        batchesInLine
          .filter((batch) => String(batch.batchCode || "").toUpperCase().includes(keyword))
          .forEach((batch) => {
            const item = (order.items || [])[Number(index)] || {};
            rows.push({
              orderId: order.id,
              status: order.status,
              customerName: order.customerName || order.tableNo || "未填写",
              customerContactName: order.customerContactName || "",
              customerPhone: order.customerPhone || "",
              customerAddress: order.customerAddress || "",
              createdAt: order.createdAt,
              time: order.time,
              productName: item.name || allocation.productName || "",
              productNumber: item.number || allocation.productNumber || "",
              batchCode: batch.batchCode,
              qty: Number(batch.qty || 0),
            });
          });
      });
    }

    sendJson(response, 200, { batch: keyword, rows });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/batches") {
    if (!requireSession(request, response, ["stock", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const batchCode = String(payload.batchCode || "").trim();
    const rawItems = Array.isArray(payload.items)
      ? payload.items
      : [
          {
            productNumber: payload.productNumber,
            productName: payload.productName,
            quantity: payload.quantity,
          },
        ];
    const items = rawItems
      .map((item) => ({
        productNumber: String(item.productNumber || "").trim().toUpperCase(),
        productName: String(item.productName || "").trim(),
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productNumber && Number.isFinite(item.quantity) && item.quantity > 0);

    if (!batchCode || !items.length) {
      sendJson(response, 400, { error: "Missing batch product, code or quantity" });
      return true;
    }

    const batches = await readBatches();
    const createdAt = new Date().toISOString();
    const createdBatches = items.map((item) => ({
      id: crypto.randomUUID(),
      batchCode: batchCode.slice(0, 60),
      productNumber: item.productNumber,
      productName: item.productName.slice(0, 80),
      quantity: item.quantity,
      remaining: item.quantity,
      producedAt: String(payload.producedAt || "").slice(0, 20),
      note: String(payload.note || "").slice(0, 160),
      createdAt,
    }));
    batches.unshift(...createdBatches);
    await writeBatches(batches);

    sendJson(response, 201, { batchCode: batchCode.slice(0, 60), batches: createdBatches });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/products") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const color = String(payload.color || "").trim();
    const number = String(payload.number || "").trim().toUpperCase();
    const category = String(payload.category || "").trim() || "其他";
    const categories = await readProductCategories();
    if (category && !categories.includes(category)) {
      categories.push(category.slice(0, 20));
      await writeProductCategories(categories);
    }

    if (!color || !number) {
      sendJson(response, 400, { error: "Missing product color or number" });
      return true;
    }

    const products = await readProducts();
    const product = {
      id: number.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      color: color.slice(0, 40),
      number: number.slice(0, 30),
      category: category.slice(0, 20),
    };
    const index = products.findIndex((item) => item.number === product.number);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.unshift(product);
    }
    await writeProducts(products);
    sendJson(response, 201, product);
    return true;
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (request.method === "DELETE" && productMatch) {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const number = decodeURIComponent(productMatch[1]).toUpperCase();
    const products = await readProducts();
    const nextProducts = products.filter((item) => item.number !== number);
    if (nextProducts.length === products.length) {
      sendJson(response, 404, { error: "Product not found" });
      return true;
    }
    await writeProducts(nextProducts);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/settings") {
    if (!requireSession(request, response, ["owner", "admin"])) return true;
    sendJson(response, 200, await readSettings());
    return true;
  }

  if (request.method === "PATCH" && url.pathname === "/api/settings") {
    if (!requireSession(request, response, ["owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const settings = { ...(await readSettings()), showPrices: Boolean(payload.showPrices) };
    await writeSettings(settings);
    sendJson(response, 200, settings);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/customers") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    sendJson(response, 200, await readCustomers());
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/sales-customers") {
    if (!requireSession(request, response, ["sales", "assistant", "owner", "admin"])) return true;
    const customers = (await readCustomers()).map((customer) => ({
      code: customer.code,
      name: customer.name,
      contactName: customer.contactName || customer.contact || "",
      phone: customer.phone || extractPhone(customer.contact || ""),
      address: customer.address || "",
      showPrices: Boolean(customer.showPrices),
    }));
    sendJson(response, 200, customers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/customers") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const code = String(payload.code || "").trim();
    const name = String(payload.name || "").trim();

    if (!code || !name) {
      sendJson(response, 400, { error: "Missing customer code or name" });
      return true;
    }

    const customers = await readCustomers();
    const legacyContact = String(payload.contact || "").trim();
    const customer = {
      code: code.slice(0, 40),
      name: name.slice(0, 80),
      contactName: String(payload.contactName || legacyContact).slice(0, 80),
      phone: String(payload.phone || extractPhone(legacyContact)).slice(0, 40),
      contact: legacyContact.slice(0, 80),
      address: String(payload.address || "").slice(0, 160),
      agreedNumbers: Array.isArray(payload.agreedNumbers)
        ? payload.agreedNumbers.map((item) => String(item).trim().toUpperCase()).filter(Boolean).slice(0, 20)
        : [],
      showPrices: Boolean(payload.showPrices),
      prices: typeof payload.prices === "object" && payload.prices ? payload.prices : {},
    };
    const index = customers.findIndex((item) => item.code === customer.code);

    if (index >= 0) {
      customers[index] = customer;
    } else {
      customers.unshift(customer);
    }

    await writeCustomers(customers);
    sendJson(response, 201, customer);
    return true;
  }

  const customerMatch = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (request.method === "DELETE" && customerMatch) {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const customerCode = decodeURIComponent(customerMatch[1]);
    const customers = await readCustomers();
    const nextCustomers = customers.filter((item) => item.code !== customerCode);

    if (nextCustomers.length === customers.length) {
      sendJson(response, 404, { error: "Customer not found" });
      return true;
    }

    await writeCustomers(nextCustomers);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/orders") {
    const session = requireSession(request, response, ["sales", "assistant", "owner", "stock", "finance", "admin"]);
    if (!session) return true;
    const orders = await readOrders();
    const salesCode = session.role === "sales" ? session.salesCode || url.searchParams.get("sales") || "" : url.searchParams.get("sales") || "";
    sendJson(response, 200, session.role === "sales" && !salesCode ? [] : filterOrdersByRole(orders, session.role, salesCode));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/customer-orders") {
    const customerCode = String(url.searchParams.get("customer") || "").trim();
    if (!customerCode) {
      sendJson(response, 400, { error: "Missing customer code" });
      return true;
    }

    const customers = await readCustomers();
    const customer = customers.find((item) => item.code === customerCode) || null;
    const orders = (await readOrders()).filter((order) => order.customerCode === customerCode);
    sendJson(response, 200, { customer, orders });
    return true;
  }

  const settlementMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/settlement$/);
  if (request.method === "PATCH" && settlementMatch) {
    const session = requireSession(request, response, ["assistant", "owner", "finance", "admin"]);
    if (!session) return true;
    const orderId = decodeURIComponent(settlementMatch[1]);
    const payload = await readJsonBody(request);
    const prices = payload.prices && typeof payload.prices === "object" ? payload.prices : {};
    const orders = await readOrders();
    const order = orders.find((item) => item.id === orderId);

    if (!order) {
      sendJson(response, 404, { error: "Order not found" });
      return true;
    }

    order.items = (order.items || []).map((item, index) => {
      if (!Object.prototype.hasOwnProperty.call(prices, index)) return item;
      const unitPrice = normalizeOptionalNumber(prices[index]);
      return {
        ...item,
        settlementUnitPrice: unitPrice,
        settlementLineTotal: unitPrice === null ? null : getSettlementLineTotal(order, item, index, unitPrice),
      };
    });
    order.settlementTotal = getOrderAmount(order);
    order.settlementHistory = Array.isArray(order.settlementHistory) ? order.settlementHistory : [];
    order.settlementHistory.push({
      at: new Date().toISOString(),
      by: session.name || session.role,
      prices: Object.fromEntries(Object.entries(prices).map(([index, value]) => [index, normalizeOptionalNumber(value)])),
    });

    await writeOrders(orders);
    sendJson(response, 200, order);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    const payload = await readJsonBody(request);
    const orders = await readOrders();
    const order = makePublicOrder(payload, orders);
    orders.unshift(order);
    await writeOrders(orders);
    sendJson(response, 201, order);
    return true;
  }

  const customerApproveMatch = url.pathname.match(/^\/api\/customer-orders\/([^/]+)\/approve$/);
  if (request.method === "PATCH" && customerApproveMatch) {
    const payload = await readJsonBody(request);
    const customerCode = String(payload.customerCode || url.searchParams.get("customer") || "").trim();
    const orderId = decodeURIComponent(customerApproveMatch[1]);
    const orders = await readOrders();
    const order = orders.find((item) => item.id === orderId && item.customerCode === customerCode);

    if (!order) {
      sendJson(response, 404, { error: "Order not found" });
      return true;
    }

    if (!["warehouse", "boss"].includes(order.status)) {
      sendJson(response, 409, { error: "Order is not waiting for boss approval" });
      return true;
    }

    order.status = "sales";
    order.approvalHistory = Array.isArray(order.approvalHistory) ? order.approvalHistory : [];
    order.approvalHistory.push({ status: "sales", at: new Date().toISOString(), by: "买方老板" });
    await writeOrders(orders);
    sendJson(response, 200, order);
    return true;
  }

  const customerReturnMatch = url.pathname.match(/^\/api\/customer-orders\/([^/]+)\/return$/);
  if (request.method === "PATCH" && customerReturnMatch) {
    const payload = await readJsonBody(request);
    const customerCode = String(payload.customerCode || url.searchParams.get("customer") || "").trim();
    const orderId = decodeURIComponent(customerReturnMatch[1]);
    const orders = await readOrders();
    const order = orders.find((item) => item.id === orderId && item.customerCode === customerCode);

    if (!order) {
      sendJson(response, 404, { error: "Order not found" });
      return true;
    }

    if (order.status !== "done") {
      sendJson(response, 409, { error: "Only shipped orders can request return" });
      return true;
    }

    order.status = "return_requested";
    order.returnReason = String(payload.reason || "").slice(0, 200);
    order.returnRequestedAt = new Date().toISOString();
    order.approvalHistory = Array.isArray(order.approvalHistory) ? order.approvalHistory : [];
    order.approvalHistory.push({ status: "return_requested", at: new Date().toISOString(), by: "客户申请退货", reason: order.returnReason });
    await writeOrders(orders);
    sendJson(response, 200, order);
    return true;
  }

  const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
    const session = requireSession(request, response, ["sales", "assistant", "owner", "stock", "admin"]);
    if (!session) return true;
    const payload = await readJsonBody(request);
    const status = String(payload.status || "");
    if (!allowedStatuses.has(status)) {
      sendJson(response, 400, { error: "Invalid status" });
      return true;
    }

    const orderId = decodeURIComponent(statusMatch[1]);
    const orders = await readOrders();
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      sendJson(response, 404, { error: "Order not found" });
      return true;
    }

    const previousStatus = order.status;
    order.status = status;
    if (typeof payload.deliveryQuantity === "string" && payload.deliveryQuantity.trim()) {
      order.deliveryQuantity = payload.deliveryQuantity.trim().slice(0, 80);
    }
    if (payload.deliveryItems && typeof payload.deliveryItems === "object") {
      order.deliveryItems = Object.fromEntries(
        Object.entries(payload.deliveryItems)
          .map(([index, value]) => [String(index), Number(value)])
          .filter(([, value]) => Number.isFinite(value) && value >= 0),
      );
    }
    if (status === "done" && previousStatus !== "done" && !order.inventoryDeductedAt) {
      try {
        await allocateBatchesForOrder(order);
        await deductInventoryForOrder(order);
        order.inventoryDeductedAt = new Date().toISOString();
      } catch (error) {
        sendJson(response, error.statusCode || 500, { error: error.message || "Batch allocation failed" });
        return true;
      }
    }
    order.approvalHistory = Array.isArray(order.approvalHistory) ? order.approvalHistory : [];
    const byMap = {
      assistant: "业务员",
      owner: "销售助理",
      stock: "老板",
      done: "仓库",
      shortage_assistant: "仓库",
      shortage_sales: "销售助理",
      shortage_customer: "业务员",
    };
    order.approvalHistory.push({
      status,
      at: new Date().toISOString(),
      by: byMap[status] || "处理",
      deliveryQuantity: order.deliveryQuantity || "",
      deliveryItems: order.deliveryItems || {},
      batchAllocations: order.batchAllocations || {},
    });
    await writeOrders(orders);
    sendJson(response, 200, order);
    return true;
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (request.method === "DELETE" && orderMatch) {
    if (!requireSession(request, response, ["owner", "admin"])) return true;
    const orderId = decodeURIComponent(orderMatch[1]);
    const orders = await readOrders();
    const nextOrders = orders.filter((item) => item.id !== orderId);

    if (nextOrders.length === orders.length) {
      sendJson(response, 404, { error: "Order not found" });
      return true;
    }

    await writeOrders(nextOrders);
    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

async function serveStatic(request, response, url) {
  const safePath = path
    .normalize(decodeURIComponent(url.pathname))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]/, "");
  const requestPath = safePath || "index.html";
  const filePath = path.join(rootDir, requestPath);

  if (!filePath.startsWith(rootDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    sendText(response, 404, "Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (await handleApi(request, response, url)) return;
    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 500, { error: "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Sanqiancai ordering app listening on http://localhost:${port}`);
});
