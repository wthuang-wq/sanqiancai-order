const statusText = {
  warehouse: "待老板确认",
  boss: "待老板确认",
  sales: "业务员处理",
  assistant: "销售助理处理",
  owner: "老板审批",
  stock: "仓库发货",
  cooking: "仓库发货",
  done: "已发货",
  shortage_assistant: "缺货退回助理",
  shortage_sales: "缺货退回业务员",
  shortage_customer: "已通知对方仓库",
};

const statusActions = {
  warehouse: [],
  boss: [],
  sales: ["assistant"],
  assistant: ["owner"],
  owner: ["stock"],
  stock: [],
  cooking: [],
  shortage_assistant: ["shortage_sales"],
  shortage_sales: ["shortage_customer"],
  done: [],
  shortage_customer: [],
};

const statusActionText = {
  assistant: "转给助理",
  owner: "提交老板",
  stock: "老板通过，给仓库",
  done: "库存够，正常发货",
  shortage_assistant: "缺货，退回助理",
  shortage_sales: "退回业务员",
  shortage_customer: "通知对方仓库",
};

const roleFromPage = document.body.dataset.role || "";
const roleParam = roleFromPage || new URLSearchParams(window.location.search).get("role") || "sales";
const currentRole = ["sales", "assistant", "owner", "stock", "all"].includes(roleParam) ? roleParam : "sales";
const canDeleteOrders = document.body.dataset.canDelete !== "false";
let latestOrders = [];
let ordersTimer = null;

const productList = [
  ["柠檬黄", "Y-102"],
  ["嫩黄", "Y-103"],
  ["荧光黄", "Y-106"],
  ["大红", "R-202"],
  ["红玉", "R-203"],
  ["桃红", "R-205"],
  ["红玉", "R-207"],
  ["荧光红", "R-209"],
  ["艳红", "R-210"],
  ["荧光红", "R-211"],
  ["红", "R-212"],
  ["紫", "V-603"],
  ["紫", "V-605"],
  ["橙", "O-302"],
  ["橙", "O-303"],
  ["翠蓝", "B-501A"],
  ["深蓝", "B-503"],
  ["深蓝", "B-507"],
  ["宝蓝", "B-510"],
  ["艳蓝", "B-512"],
  ["艳蓝", "B-515"],
  ["艳兰", "B-518"],
  ["黑", "K-801"],
  ["黑", "K-803"],
  ["黑", "K-805"],
  ["黑", "K-900"],
];

const els = {
  orders: document.querySelector("#adminOrders"),
  newCount: document.querySelector("#newCount"),
  salesCount: document.querySelector("#salesCount"),
  cookingCount: document.querySelector("#cookingCount"),
  ownerCount: document.querySelector("#ownerCount"),
  stockCount: document.querySelector("#stockCount"),
  totalCount: document.querySelector("#totalCount"),
  dailySummary: document.querySelector("#dailySummary"),
  copyDailySummary: document.querySelector("#copyDailySummary"),
  copyBackup: document.querySelector("#copyBackup"),
  copyCsv: document.querySelector("#copyCsv"),
  showPrices: document.querySelector("#showPrices"),
  customerForm: document.querySelector("#customerForm"),
  customerCode: document.querySelector("#customerCode"),
  customerName: document.querySelector("#customerName"),
  customerContact: document.querySelector("#customerContact"),
  customerShowPrices: document.querySelector("#customerShowPrices"),
  priceEditor: document.querySelector("#priceEditor"),
  customerList: document.querySelector("#customerList"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function money(value) {
  return `¥${Number(value).toFixed(value % 1 ? 2 : 0)}`;
}

function formatOrderDate(order) {
  const date = new Date(order.createdAt);
  if (Number.isNaN(date.getTime())) return order.time || "";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${order.time || date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function getOrderDateKey(order) {
  const date = new Date(order.createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getSpecKg(spec) {
  const match = String(spec || "").match(/(\d+(?:\.\d+)?)\s*(kg|公斤)/i);
  return match ? Number(match[1]) : 0;
}

function getOrderTotalKg(order) {
  return (order.items || []).reduce((sum, item) => sum + getSpecKg(item.spec) * Number(item.qty || 0), 0);
}

function getTodayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function makeDeliveryNoteHtml(order) {
  const orderDate = new Date(order.createdAt);
  const dateText = Number.isNaN(orderDate.getTime())
    ? formatOrderDate(order)
    : `${orderDate.getFullYear()} 年 ${orderDate.getMonth() + 1} 月 ${orderDate.getDate()} 日`;
  const items = order.items || [];
  const totalKg = items.reduce((sum, item) => sum + getSpecKg(item.spec) * Number(item.qty || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const summaryKgText = totalKg ? `${totalKg} KG` : "";
  const rows = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="name-cell">${escapeHtml(item.name)}</td>
          <td>KG</td>
          <td>${getSpecKg(item.spec) * Number(item.qty || 0)}</td>
          <td>${item.unitPrice === null ? "" : Number(item.unitPrice).toFixed(2)}</td>
          <td>${item.lineTotal ? Number(item.lineTotal).toFixed(2) : ""}</td>
          <td>${escapeHtml(item.spec)} * ${escapeHtml(item.qty)} 桶</td>
        </tr>
      `,
    )
    .join("");
  const emptyRows = Array.from({ length: Math.max(0, 5 - items.length) }, (_, index) =>
    index === 0
      ? `<tr><td></td><td class="name-cell">*** 以下空白 ***</td><td></td><td></td><td></td><td></td><td></td></tr>`
      : `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
  ).join("");

  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(order.id)} 送货单</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: "SimSun", "Songti SC", "PingFang SC", "Microsoft YaHei", serif; color: #111; padding: 18px; background: #fff; }
          .print-button { margin-bottom: 12px; border: 1px solid #111; background: #fff; padding: 8px 14px; font-size: 14px; }
          .note-sheet { position: relative; width: 100%; max-width: 1080px; margin: 0 auto; border: 3px solid #111; padding: 18px 22px 12px; }
          .copy-mark { position: absolute; right: -38px; top: 150px; writing-mode: vertical-rl; line-height: 1.8; font-size: 14px; }
          .top-row { display: grid; grid-template-columns: 1fr 190px; align-items: start; gap: 12px; }
          h1 { margin: 0; text-align: center; font-size: 28px; letter-spacing: 3px; font-weight: 900; }
          h2 { margin: 6px 0 10px; text-align: center; font-size: 24px; letter-spacing: 16px; font-weight: 900; }
          .recycle { font-size: 14px; line-height: 1.8; }
          .no { margin-top: 6px; font-size: 20px; }
          .no strong { color: #b13328; letter-spacing: 3px; }
          .meta { display: grid; grid-template-columns: 1fr 220px; gap: 4px 18px; margin-top: 6px; font-size: 16px; }
          .line { border-bottom: 1px solid #111; min-height: 24px; padding: 0 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
          th, td { border: 2px solid #111; padding: 7px 6px; text-align: center; vertical-align: middle; font-size: 16px; }
          th { font-weight: 900; }
          .name-cell { text-align: center; font-weight: 900; letter-spacing: 1px; }
          .summary-row td { height: 42px; font-weight: 900; }
          .summary-text { letter-spacing: 10px; }
          .terms { display: grid; grid-template-columns: 64px 1fr; border-left: 2px solid #111; border-right: 2px solid #111; border-bottom: 2px solid #111; }
          .terms-title { display: grid; place-items: center; border-right: 2px solid #111; font-size: 18px; line-height: 1.6; }
          .terms-body { padding: 8px 10px; font-size: 14px; line-height: 1.65; }
          .footer-sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 20px; font-size: 16px; }
          .footer-sign div { min-height: 32px; }
          .muted-line { display: inline-block; min-width: 150px; border-bottom: 1px solid #111; }
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body { padding: 0; }
            .print-button { display: none; }
            .note-sheet { max-width: none; border-width: 2px; }
          }
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">打印送货单</button>
        <div class="note-sheet">
          <div class="copy-mark">第一联：存根（白）　第二联：客户（黄）　第三联：回单（红）　第四联：财务（蓝）</div>
          <div class="top-row">
            <div>
              <h1>三千彩纳米新材料有限公司</h1>
              <h2>送货单</h2>
            </div>
            <div class="recycle">
              塑料桶无需回收<br />
              1000KG（　）只<br />
              60KG（　）只
              <div class="no">NO：<strong>${escapeHtml(order.id.replace(/\D/g, "") || order.id)}</strong></div>
            </div>
          </div>

          <div class="meta">
            <div>收货单位：<span class="line">${escapeHtml(order.customerName || order.tableNo || "未填写")}</span></div>
            <div>日期：<span class="line">${escapeHtml(dateText)}</span></div>
            <div>收货地址：<span class="line">${escapeHtml(order.tableNo || "")}</span></div>
            <div>备注：<span class="line">${escapeHtml(order.note || "")}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 7%">序号</th>
                <th style="width: 28%">品名及型号</th>
                <th style="width: 8%">单位</th>
                <th style="width: 12%">数量</th>
                <th style="width: 10%">单价</th>
                <th style="width: 13%">金额</th>
                <th style="width: 22%">规格*桶数</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              ${emptyRows}
              <tr class="summary-row">
                <td>合计</td>
                <td colspan="3" class="summary-text">${escapeHtml(summaryKgText)}</td>
                <td colspan="2">￥：${totalAmount ? totalAmount.toFixed(2) : ""}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="terms">
            <div class="terms-title">供需<br />双方<br />约定<br />协议</div>
            <div class="terms-body">
              1、需方单位或收货人一经在本送货单上盖章或签名，即视为供需双方买卖合同关系成立，表明供需双方均认可本送货单上载明货品名称、型号、数量、单价及金额无误，即视为需方已收到供方的全部产品。<br />
              2、需方如认为所购买产品质量、数量存在问题，限在收货后7天内向供方提出书面异议，合理的异议供方将给予退货、换货。<br />
              3、本送货单合同的履行地点在供方或供方代理单位仓库。
            </div>
          </div>

          <div class="footer-sign">
            <div>收货单位（盖章）：<span class="muted-line"></span><br /><br />及收货人（签名）：<span class="muted-line"></span></div>
            <div>送货单位：<span class="muted-line"></span><br /><br />及经手人：<span class="muted-line"></span></div>
            <div>送货车辆：<span class="muted-line"></span><br /><br />及送货人：<span class="muted-line"></span></div>
          </div>
        </div>
      </body>
    </html>`;
}

function getDeliveryInputValues(orderId) {
  const escapedId = CSS.escape(orderId);
  return {
    deliveryQuantity: document.querySelector(`[data-delivery-qty="${escapedId}"]`)?.value.trim() || "",
    shortageReason: document.querySelector(`[data-shortage-reason="${escapedId}"]`)?.value.trim() || "",
  };
}

function canEditDelivery(order) {
  return currentRole === "stock" && ["stock", "cooking"].includes(order.status);
}

function canPrintDeliveryNote(order) {
  return currentRole === "stock" && ["stock", "cooking", "done"].includes(order.status);
}

function printDeliveryNote(orderId) {
  const order = latestOrders.find((item) => item.id === orderId);
  if (!order) {
    showToast("找不到订单");
    return;
  }
  const inputValues = getDeliveryInputValues(orderId);
  const noteOrder = {
    ...order,
    deliveryQuantity: inputValues.deliveryQuantity || order.deliveryQuantity || "",
    shortageReason: inputValues.shortageReason || order.shortageReason || "",
  };
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("浏览器拦截了打印窗口");
    return;
  }
  printWindow.document.write(makeDeliveryNoteHtml(noteOrder));
  printWindow.document.close();
  printWindow.focus();
}

function getDailySummaryRows(orders) {
  const today = getTodayKey();
  const productMap = new Map();
  const customerMap = new Map();
  let orderCount = 0;
  let totalKg = 0;

  orders
    .filter((order) => getOrderDateKey(order) === today)
    .forEach((order) => {
      orderCount += 1;
      const customer = order.customerName || order.tableNo || "未填写";
      (order.items || []).forEach((item) => {
        const kg = getSpecKg(item.spec) * Number(item.qty || 0);
        totalKg += kg;
        const productKey = `${item.name || ""} ${item.number || ""}`.trim();
        productMap.set(productKey, (productMap.get(productKey) || 0) + kg);
        customerMap.set(customer, (customerMap.get(customer) || 0) + kg);
      });
    });

  return {
    orderCount,
    totalKg,
    products: [...productMap.entries()].sort((a, b) => b[1] - a[1]),
    customers: [...customerMap.entries()].sort((a, b) => b[1] - a[1]),
  };
}

function makeDailySummaryText(orders) {
  const summary = getDailySummaryRows(orders);
  const productLines = summary.products.map(([name, kg]) => `${name}\t${kg}公斤`).join("\n");
  const customerLines = summary.customers.map(([name, kg]) => `${name}\t${kg}公斤`).join("\n");
  return [`今日订单\t${summary.orderCount}单`, `今日销量\t${summary.totalKg}公斤`, "", "按色号汇总", productLines, "", "按客户汇总", customerLines].join("\n");
}

function renderDailySummary(orders) {
  if (!els.dailySummary) return;
  const summary = getDailySummaryRows(orders);
  const productRows = summary.products
    .map(([name, kg]) => `<tr><td>${escapeHtml(name)}</td><td>${kg} 公斤</td></tr>`)
    .join("");
  const customerRows = summary.customers
    .map(([name, kg]) => `<tr><td>${escapeHtml(name)}</td><td>${kg} 公斤</td></tr>`)
    .join("");

  els.dailySummary.innerHTML = `
    <div class="daily-summary-cards">
      <div><span>今日订单</span><strong>${summary.orderCount}</strong></div>
      <div><span>今日销量</span><strong>${summary.totalKg} 公斤</strong></div>
    </div>
    <div class="daily-summary-tables">
      <div>
        <h3>按色号</h3>
        <table><tbody>${productRows || `<tr><td colspan="2">今天还没有销量</td></tr>`}</tbody></table>
      </div>
      <div>
        <h3>按客户</h3>
        <table><tbody>${customerRows || `<tr><td colspan="2">今天还没有订单</td></tr>`}</tbody></table>
      </div>
    </div>
  `;
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

function renderPriceEditor(prices = {}) {
  if (!els.priceEditor) return;
  const agreed = new Set(Array.isArray(prices.__agreedNumbers) ? prices.__agreedNumbers : []);
  els.priceEditor.innerHTML = productList
    .map(
      ([name, code]) => `
        <label class="price-row">
          <span class="price-row-name">${escapeHtml(name)} ${escapeHtml(code)}</span>
          <input type="number" min="0" step="0.01" data-price-code="${escapeHtml(code)}" value="${prices[code] ?? ""}" placeholder="单价" />
          <label class="agreed-check">
            <input type="checkbox" data-agreed-code="${escapeHtml(code)}" ${agreed.has(code) ? "checked" : ""} />
            <span>已沟通</span>
          </label>
        </label>
      `,
    )
    .join("");
}

function collectPrices() {
  const prices = {};
  if (!els.priceEditor) return prices;
  els.priceEditor.querySelectorAll("[data-price-code]").forEach((input) => {
    const price = Number(input.value);
    if (Number.isFinite(price) && input.value !== "") {
      prices[input.dataset.priceCode] = price;
    }
  });
  return prices;
}

function collectAgreedNumbers() {
  if (!els.priceEditor) return [];
  return [...els.priceEditor.querySelectorAll("[data-agreed-code]:checked")].map((input) => input.dataset.agreedCode);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

async function requestText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Request failed");
  return response.text();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function loadSettings() {
  if (!els.showPrices) return;
  const settings = await requestJson("/api/settings");
  els.showPrices.checked = Boolean(settings.showPrices);
}

async function loadCustomers() {
  if (!els.customerList) return;
  const customers = await requestJson("/api/customers");
  renderCustomers(customers);
}

async function loadOrders() {
  try {
    const orders = await requestJson("/api/orders");
    latestOrders = orders;
    renderOrders(orders);
    renderDailySummary(orders);
  } catch (error) {
    if (els.orders) els.orders.innerHTML = `<div class="admin-empty">暂时连不上订单服务</div>`;
  }
}

function getVisibleOrders(orders) {
  if (currentRole === "sales") return orders.filter((order) => ["sales", "shortage_sales"].includes(order.status));
  if (currentRole === "assistant") return orders.filter((order) => ["assistant", "shortage_assistant"].includes(order.status));
  if (currentRole === "owner") return orders.filter((order) => order.status === "owner");
  if (currentRole === "stock") return orders.filter((order) => ["stock", "cooking"].includes(order.status));
  return orders;
}

function renderCustomers(customers) {
  if (!els.customerList) return;
  if (!customers.length) {
    els.customerList.innerHTML = `<div class="admin-empty compact">还没有客户，先录入客户信息</div>`;
    return;
  }

  els.customerList.innerHTML = customers
    .map((customer) => {
      const orderLink = `${window.location.origin}/?customer=${encodeURIComponent(customer.code)}`;
      const bossLink = `${window.location.origin}/boss.html?customer=${encodeURIComponent(customer.code)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(orderLink)}`;
      return `
        <article class="customer-card">
          <img src="${qrUrl}" alt="${escapeHtml(customer.name)} 客户二维码" />
          <div>
            <strong>${escapeHtml(customer.name)}</strong>
            <span>${escapeHtml(customer.code)} · ${escapeHtml(customer.contact || "未填联系方式")}</span>
            <span>${customer.showPrices ? "该客户显示价格" : "该客户隐藏价格"}</span>
            <span>已沟通：${escapeHtml((customer.agreedNumbers || []).join("、") || "未设置")}</span>
            <span>常购：系统按订单记录自动统计</span>
          </div>
          <p>仓库下单：${escapeHtml(orderLink)}</p>
          <p>老板确认：${escapeHtml(bossLink)}</p>
          <div class="admin-actions">
            <button type="button" data-edit-customer="${escapeHtml(customer.code)}">编辑</button>
            <button type="button" data-copy-link="${escapeHtml(orderLink)}">复制下单链接</button>
            <button type="button" data-copy-link="${escapeHtml(bossLink)}">复制老板链接</button>
            <button class="danger-button" type="button" data-delete-customer="${escapeHtml(customer.code)}">删除客户</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderOrders(orders) {
  if (els.newCount) els.newCount.textContent = orders.filter((order) => ["warehouse", "boss"].includes(order.status)).length;
  if (els.salesCount) els.salesCount.textContent = orders.filter((order) => ["sales", "shortage_sales"].includes(order.status)).length;
  if (els.cookingCount) els.cookingCount.textContent = orders.filter((order) => ["assistant", "shortage_assistant"].includes(order.status)).length;
  if (els.ownerCount) els.ownerCount.textContent = orders.filter((order) => order.status === "owner").length;
  if (els.stockCount) els.stockCount.textContent = orders.filter((order) => ["stock", "cooking"].includes(order.status)).length;
  if (els.totalCount) els.totalCount.textContent = orders.filter((order) => ["stock", "cooking", "done", "shortage_customer"].includes(order.status)).length;
  const visibleOrders = getVisibleOrders(orders);

  if (!visibleOrders.length) {
    els.orders.innerHTML = `<div class="admin-empty">还没有订单</div>`;
    return;
  }

  els.orders.innerHTML = visibleOrders
    .map(
      (order) => `
        <article class="admin-order" data-id="${escapeHtml(order.id)}">
          <div class="admin-order-head">
            <div>
              <p class="eyebrow">${escapeHtml(order.tableNo)} · ${escapeHtml(formatOrderDate(order))}</p>
              <h2>${escapeHtml(order.id)}</h2>
              ${order.customerName ? `<p class="cart-item-meta">客户：${escapeHtml(order.customerName)}</p>` : ""}
            </div>
            <span class="status-pill status-${escapeHtml(order.status)}">${statusText[order.status] || "未知"}</span>
          </div>

          <div class="submitted-items">
            ${order.items
              .map(
                (item) => `
                  <div class="submitted-item">
                    <div>
                      <p>${escapeHtml(item.name)} × ${item.qty}</p>
                      <span>${escapeHtml(item.spec)}${item.unitPrice !== null ? ` · ${money(item.unitPrice)} / 公斤` : ""}</span>
                    </div>
                    <strong>${item.lineTotal ? money(item.lineTotal) : "下单后确认"}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>

          ${order.note ? `<p class="submitted-note">备注：${escapeHtml(order.note)}</p>` : ""}
          ${
            currentRole === "stock" && (order.deliveryQuantity || order.shortageReason)
              ? `<p class="submitted-note">发货情况：${escapeHtml(order.deliveryQuantity || "未填")}；${escapeHtml(order.shortageReason || "无备注")}</p>`
              : ""
          }

          <div class="submitted-total">
            <span>共 ${order.count} 份需求</span>
            <strong>${order.total ? money(order.total) : "下单后确认"}</strong>
          </div>

          ${
            canEditDelivery(order)
              ? `<div class="delivery-fields">
                  <label>
                    <span>实际发货数量</span>
                    <input data-delivery-qty="${escapeHtml(order.id)}" value="${escapeHtml(order.deliveryQuantity || "")}" placeholder="例如 120公斤" />
                  </label>
                  <label>
                    <span>缺货说明</span>
                    <input data-shortage-reason="${escapeHtml(order.id)}" value="${escapeHtml(order.shortageReason || "")}" placeholder="例如 只能发 60公斤" />
                  </label>
                </div>`
              : ""
          }

          <div class="admin-actions">
            ${
              canEditDelivery(order)
                ? `<button class="secondary-action-button" type="button" data-status="${escapeHtml(order.status)}" data-id="${escapeHtml(order.id)}">保存发货信息</button>`
                : ""
            }
            ${(statusActions[order.status] || [])
              .map(
                (status) => `
                  <button type="button" data-status="${status}" data-id="${escapeHtml(order.id)}">
                    ${statusActionText[status] || `标记为${statusText[status]}`}
                  </button>
                `,
              )
              .join("")}
            ${
              ["stock", "cooking"].includes(order.status)
                ? `<button type="button" data-status="done" data-id="${escapeHtml(order.id)}">库存够，正常发货</button>
                   <button class="warning-button" type="button" data-status="shortage_assistant" data-id="${escapeHtml(order.id)}">不够货，退回助理</button>`
                : ""
            }
            ${canPrintDeliveryNote(order) ? `<button type="button" data-delivery-note="${escapeHtml(order.id)}">送货单</button>` : ""}
            ${canDeleteOrders ? `<button class="danger-button" type="button" data-delete-order="${escapeHtml(order.id)}">删除订单</button>` : ""}
          </div>
        </article>
      `,
    )
    .join("");
}

els.showPrices?.addEventListener("change", async () => {
  try {
    await requestJson("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showPrices: els.showPrices.checked }),
    });
    showToast(els.showPrices.checked ? "前台已显示价格" : "前台已隐藏价格");
  } catch (error) {
    showToast("保存失败，请稍后再试");
  }
});

els.copyCsv?.addEventListener("click", async () => {
  try {
    await copyText(await requestText("/api/export.csv"));
    showToast("Excel 数据已复制，可以粘贴到 Excel");
  } catch (error) {
    showToast("复制失败，请稍后再试");
  }
});

els.copyBackup?.addEventListener("click", async () => {
  try {
    const data = await requestJson("/api/export");
    await copyText(JSON.stringify(data, null, 2));
    showToast("备份数据已复制");
  } catch (error) {
    showToast("复制失败，请稍后再试");
  }
});

els.copyDailySummary?.addEventListener("click", async () => {
  try {
    await copyText(makeDailySummaryText(latestOrders));
    showToast("每日汇总已复制，可以粘贴到 Excel");
  } catch (error) {
    showToast("复制失败，请稍后再试");
  }
});

els.customerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const shouldCopyOrderLink = event.submitter?.value === "copyOrderLink";
  const customerCode = els.customerCode.value.trim();
  try {
    await requestJson("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: customerCode,
        name: els.customerName.value.trim(),
        contact: els.customerContact.value.trim(),
        agreedNumbers: collectAgreedNumbers(),
        showPrices: els.customerShowPrices.checked,
        prices: collectPrices(),
      }),
    });
    if (shouldCopyOrderLink) {
      await copyText(`${window.location.origin}/?customer=${encodeURIComponent(customerCode)}`);
    }
    els.customerForm.reset();
    els.customerShowPrices.checked = false;
    renderPriceEditor();
    showToast(shouldCopyOrderLink ? "本次沟通已保存，下单链接已复制" : "客户已保存");
    await loadCustomers();
  } catch (error) {
    showToast("客户保存失败，请检查编号和名称");
  }
});

els.customerList?.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-customer]");
  const copyButton = event.target.closest("[data-copy-link]");
  const deleteButton = event.target.closest("[data-delete-customer]");

  if (copyButton) {
    await navigator.clipboard.writeText(copyButton.dataset.copyLink);
    showToast("客户链接已复制");
    return;
  }

  if (deleteButton) {
    const customerCode = deleteButton.dataset.deleteCustomer;
    if (!window.confirm(`确定删除客户 ${customerCode} 吗？删除后不能恢复。`)) return;

    try {
      await requestJson(`/api/customers/${encodeURIComponent(customerCode)}`, { method: "DELETE" });
      showToast("客户已删除");
      await loadCustomers();
    } catch (error) {
      showToast("删除失败，请稍后再试");
    }
    return;
  }

  if (editButton) {
    const customers = await requestJson("/api/customers");
    const customer = customers.find((item) => item.code === editButton.dataset.editCustomer);
    if (!customer) return;
    els.customerCode.value = customer.code;
    els.customerName.value = customer.name;
    els.customerContact.value = customer.contact || "";
    els.customerShowPrices.checked = Boolean(customer.showPrices);
    renderPriceEditor(customer.prices);
  }
});

els.orders?.addEventListener("click", async (event) => {
  const deliveryNoteButton = event.target.closest("button[data-delivery-note]");
  if (deliveryNoteButton) {
    printDeliveryNote(deliveryNoteButton.dataset.deliveryNote);
    return;
  }

  const deleteButton = event.target.closest("button[data-delete-order]");
  if (deleteButton) {
    const orderId = deleteButton.dataset.deleteOrder;
    if (!window.confirm(`确定删除 ${orderId} 吗？删除后不能恢复。`)) return;

    try {
      await requestJson(`/api/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" });
      showToast("订单已删除");
      await loadOrders();
    } catch (error) {
      showToast("删除失败，请稍后再试");
    }
    return;
  }

  const button = event.target.closest("button[data-status]");
  if (!button) return;

  try {
    const order = latestOrders.find((item) => item.id === button.dataset.id);
    const inputValues = getDeliveryInputValues(button.dataset.id);
    const deliveryQty =
      inputValues.deliveryQuantity ||
      (button.dataset.status === "done" && order ? `${getOrderTotalKg(order)}公斤` : "");
    const shortageReason = inputValues.shortageReason;
    await requestJson(`/api/orders/${encodeURIComponent(button.dataset.id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: button.dataset.status, deliveryQuantity: deliveryQty, shortageReason }),
    });
    showToast("订单状态已更新");
    await loadOrders();
  } catch (error) {
    showToast("更新失败，请稍后再试");
  }
});

function getLoginUsername() {
  return currentRole === "all" ? "admin" : currentRole;
}

async function checkSession() {
  const response = await fetch("/api/session");
  return response.ok ? response.json() : null;
}

function showLoginScreen() {
  const roleName = {
    sales: "业务员",
    assistant: "销售助理",
    owner: "老板",
    stock: "仓库",
    admin: "系统管理",
  };
  const username = getLoginUsername();
  const screen = document.createElement("div");
  screen.className = "login-screen";
  screen.innerHTML = `
    <form class="login-box" id="loginForm">
      <h2>后台登录</h2>
      <input name="username" value="${escapeHtml(username)}" placeholder="账号" autocomplete="username" />
      <input name="password" type="password" placeholder="密码" autocomplete="current-password" autofocus />
      <button type="submit">登录</button>
      <p id="loginError" aria-live="polite"></p>
      <p>${escapeHtml(roleName[username] || "后台")}账号登录后才能查看订单，防止公网泄漏。</p>
    </form>
  `;
  document.body.appendChild(screen);

  return new Promise((resolve) => {
    const form = screen.querySelector("#loginForm");
    const error = screen.querySelector("#loginError");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const formData = new FormData(form);
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(formData.get("username") || "").trim(),
          password: String(formData.get("password") || ""),
        }),
      });
      if (!response.ok) {
        error.textContent = "账号或密码不对";
        return;
      }
      screen.remove();
      resolve();
    });
  });
}

async function ensureLogin() {
  const session = await checkSession();
  if (session?.ok && (session.user.role === "admin" || currentRole === "all" || session.user.role === currentRole)) return;
  if (session?.ok) {
    await fetch("/api/logout", { method: "POST" });
  }
  await showLoginScreen();
}

async function init() {
  await ensureLogin();
  renderPriceEditor();
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.roleLink === currentRole);
  });
  await Promise.all([loadSettings(), loadCustomers(), loadOrders()]);
  ordersTimer = window.setInterval(loadOrders, 5000);
}

init();
