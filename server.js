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
  admin: { password: process.env.ADMIN_PASSWORD || localDefaultPassword, role: "admin", name: "系统管理" },
};

const roleVisibleStatuses = {
  sales: new Set(["sales", "shortage_sales"]),
  assistant: new Set(["assistant", "shortage_assistant"]),
  owner: null,
  stock: new Set(["stock", "cooking"]),
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
  const session = { role: account.role, name: account.name, createdAt: Date.now() };
  sessions.set(token, session);
  response.setHeader("Set-Cookie", `sqc_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  return session;
}

function clearSession(request, response) {
  const token = parseCookies(request).sqc_session;
  if (token) sessions.delete(token);
  response.setHeader("Set-Cookie", "sqc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function filterOrdersByRole(orders, role) {
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

function extractPhone(value) {
  const match = String(value || "").match(/(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/);
  return match ? match[0].replace(/[-\s]/g, "") : "";
}

function makePublicOrder(payload, orders) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Missing items");
  }

  const stats = getOrderStats(payload.items);
  const createdAt = new Date();
  const customerCode = String(payload.customerCode || "").slice(0, 40);
  const initialStatus = customerCode ? "boss" : "sales";

  return {
    id: `订单 ${String(orders.length + 1).padStart(3, "0")}`,
    customerCode,
    customerName: String(payload.customerName || "").slice(0, 80),
    customerContactName: String(payload.customerContactName || payload.customerContact || "").slice(0, 80),
    customerPhone: String(payload.customerPhone || extractPhone(payload.customerContact || payload.tableNo || "")).slice(0, 40),
    customerAddress: String(payload.customerAddress || "").slice(0, 160),
    tableNo: String(payload.tableNo || "未填写").slice(0, 80),
    time: createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    createdAt: createdAt.toISOString(),
    status: initialStatus,
    approvalHistory: [
      {
        status: initialStatus,
        at: createdAt.toISOString(),
        by: customerCode ? "仓库下单" : "通用客户下单",
      },
    ],
    items: payload.items.map((item) => ({
      name: String(item.name || "未命名菜品").slice(0, 40),
      number: String(item.number || "").slice(0, 20),
      spec: String(item.spec || "默认").slice(0, 30),
      price: Number(item.price),
      unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : null,
      lineTotal: Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : null,
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

  if (request.method === "GET" && url.pathname === "/api/config") {
    const settings = await readSettings();
    const customers = await readCustomers();
    const orders = await readOrders();
    const products = await readProducts();
    const customerCode = url.searchParams.get("customer") || "";
    const customer = customers.find((item) => item.code === customerCode) || null;
    if (customer) {
      customer.frequent = getFrequentNumbers(orders, customer.code);
    }
    sendJson(response, 200, { settings, customer, products });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/products") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    sendJson(response, 200, await readProducts());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/products") {
    if (!requireSession(request, response, ["assistant", "owner", "admin"])) return true;
    const payload = await readJsonBody(request);
    const color = String(payload.color || "").trim();
    const number = String(payload.number || "").trim().toUpperCase();
    const category = String(payload.category || "").trim() || "其他";

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
    const session = requireSession(request, response, ["sales", "assistant", "owner", "stock", "admin"]);
    if (!session) return true;
    const orders = await readOrders();
    sendJson(response, 200, filterOrdersByRole(orders, session.role));
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

    order.status = status;
    if (typeof payload.deliveryQuantity === "string" && payload.deliveryQuantity.trim()) {
      order.deliveryQuantity = payload.deliveryQuantity.trim().slice(0, 80);
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
