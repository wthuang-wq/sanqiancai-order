const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const ordersFile = path.join(dataDir, "orders.json");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const allowedStatuses = new Set(["new", "cooking", "done"]);

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(ordersFile);
  } catch (error) {
    await fs.writeFile(ordersFile, "[]\n", "utf8");
  }
}

async function readOrders() {
  await ensureStore();
  const content = await fs.readFile(ordersFile, "utf8");
  return JSON.parse(content || "[]");
}

async function writeOrders(orders) {
  await ensureStore();
  await fs.writeFile(ordersFile, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
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

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function getOrderStats(items) {
  let count = 0;
  let subtotal = 0;

  for (const item of items) {
    const qty = Number(item.qty);
    const price = Number(item.price);
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) {
      throw new Error("Invalid item");
    }

    count += qty;
    subtotal += qty * price;
  }

  const serviceFee = subtotal > 0 ? Math.max(2, Math.round(subtotal * 0.05)) : 0;
  return { count, subtotal, serviceFee, total: subtotal + serviceFee };
}

function makePublicOrder(payload, orders) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Missing items");
  }

  const stats = getOrderStats(payload.items);
  const createdAt = new Date();

  return {
    id: `询价 ${String(orders.length + 1).padStart(3, "0")}`,
    tableNo: String(payload.tableNo || "未填写").slice(0, 24),
    time: createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    createdAt: createdAt.toISOString(),
    status: "new",
    items: payload.items.map((item) => ({
      name: String(item.name || "未命名菜品").slice(0, 40),
      spec: String(item.spec || "默认").slice(0, 30),
      spice: String(item.spice || "默认").slice(0, 30),
      price: Number(item.price),
      qty: Number(item.qty),
    })),
    note: String(payload.note || "").slice(0, 200),
    ...stats,
  };
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/orders") {
    const orders = await readOrders();
    sendJson(response, 200, orders);
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

  const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
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
    await writeOrders(orders);
    sendJson(response, 200, order);
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
