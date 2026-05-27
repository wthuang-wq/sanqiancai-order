const statusText = {
  warehouse: "待老板确认",
  boss: "待老板确认",
  sales: "业务员处理",
  assistant: "销售助理处理",
  owner: "老板审批",
  stock: "仓库发货",
  cooking: "仓库发货",
  done: "已发货",
  return_requested: "退货申请",
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

const pageParams = new URLSearchParams(window.location.search);
const salesPeople = {
  sales1: "业务员1",
  sales2: "业务员2",
  sales3: "业务员3",
  sales4: "业务员4",
  sales5: "业务员5",
  sales6: "业务员6",
  sales7: "业务员7",
  sales8: "业务员8",
};
const roleFromPage = document.body.dataset.role || "";
const roleParam = roleFromPage || pageParams.get("role") || "sales";
const currentRole = ["sales", "assistant", "owner", "stock", "finance", "all"].includes(roleParam) ? roleParam : "sales";
const currentSalesCode = pageParams.get("sales") || "";
const currentSalesName = salesPeople[currentSalesCode] || "";
const isRecordsPage = document.body.dataset.records === "true";
const isSummaryPage = document.body.dataset.summary === "true";
const canDeleteOrders = document.body.dataset.canDelete !== "false";
let latestOrders = [];
let ordersTimer = null;
let inventory = {};
let batches = [];
const expandedSettlementOrders = new Set();
const salesSummaryState = {
  period: "month",
  startDate: "",
  endDate: "",
  customer: "",
  product: "",
};

const defaultProductList = [
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
let productList = [...defaultProductList];
let customProductNumbers = new Set();
let productCategories = ["色浆", "助剂", "分散染料", "其他"];
let hiddenProductNumbers = new Set();

const els = {
  orders: document.querySelector("#adminOrders"),
  stockDoneOrders: document.querySelector("#stockDoneOrders"),
  newCount: document.querySelector("#newCount"),
  salesCount: document.querySelector("#salesCount"),
  cookingCount: document.querySelector("#cookingCount"),
  ownerCount: document.querySelector("#ownerCount"),
  stockCount: document.querySelector("#stockCount"),
  totalCount: document.querySelector("#totalCount"),
  dailySummary: document.querySelector("#dailySummary"),
  shipmentNotices: document.querySelector("#shipmentNotices"),
  salesIdentity: document.querySelector("#salesIdentity"),
  salesOrderLink: document.querySelector("#salesOrderLink"),
  salesRecordsLink: document.querySelector("#salesRecordsLink"),
  salesSummaryLink: document.querySelector("#salesSummaryLink"),
  salesBackLink: document.querySelector("#salesBackLink"),
  copyDailySummary: document.querySelector("#copyDailySummary"),
  copyBackup: document.querySelector("#copyBackup"),
  copyCsv: document.querySelector("#copyCsv"),
  showPrices: document.querySelector("#showPrices"),
  customerForm: document.querySelector("#customerForm"),
  customerCode: document.querySelector("#customerCode"),
  customerName: document.querySelector("#customerName"),
  customerContactName: document.querySelector("#customerContactName"),
  customerPhone: document.querySelector("#customerPhone"),
  customerAddress: document.querySelector("#customerAddress"),
  customerShowPrices: document.querySelector("#customerShowPrices"),
  priceEditor: document.querySelector("#priceEditor"),
  customerList: document.querySelector("#customerList"),
  productForm: document.querySelector("#productForm"),
  productColor: document.querySelector("#productColor"),
  productNumber: document.querySelector("#productNumber"),
  productCategory: document.querySelector("#productCategory"),
  newProductCategory: document.querySelector("#newProductCategory"),
  addProductCategory: document.querySelector("#addProductCategory"),
  productList: document.querySelector("#productList"),
  inventoryList: document.querySelector("#inventoryList"),
  saveInventory: document.querySelector("#saveInventory"),
  batchForm: document.querySelector("#batchForm"),
  batchProduct: document.querySelector("#batchProduct"),
  batchCode: document.querySelector("#batchCode"),
  batchQuantity: document.querySelector("#batchQuantity"),
  batchDate: document.querySelector("#batchDate"),
  batchNote: document.querySelector("#batchNote"),
  batchList: document.querySelector("#batchList"),
  salesSummary: document.querySelector("#salesSummary"),
  paymentForm: document.querySelector("#paymentForm"),
  paymentCustomer: document.querySelector("#paymentCustomer"),
  paymentAmount: document.querySelector("#paymentAmount"),
  paymentMethod: document.querySelector("#paymentMethod"),
  paymentNote: document.querySelector("#paymentNote"),
  paymentList: document.querySelector("#paymentList"),
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

function formatWeight(kg) {
  return `${Number(kg || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 公斤`;
}

function getDefaultItemKg(item) {
  return getSpecKg(item.spec) * Number(item.qty || 0);
}

function formatPlainNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "";
}

function getDeliveryItems(order) {
  const items = order.items || [];
  return items.map((item, index) => {
    const saved = order.deliveryItems?.[index];
    const parsed = Number(saved);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : getDefaultItemKg(item);
  });
}

function getDeliveryTotalKg(order) {
  return getDeliveryItems(order).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function getDeliveryLineTotal(item, deliveryQty) {
  const unitPrice = getEffectiveUnitPrice(item);
  return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice * Number(deliveryQty || 0) : null;
}

function getDeliveryUnitPriceText(item) {
  const unitPrice = getEffectiveUnitPrice(item);
  return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice.toFixed(2) : "";
}

function getEffectiveUnitPrice(item) {
  const settlementUnitPrice = Number(item.settlementUnitPrice);
  if (Number.isFinite(settlementUnitPrice) && settlementUnitPrice > 0) return settlementUnitPrice;
  const unitPrice = Number(item.unitPrice);
  return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null;
}

function getEffectiveLineTotal(item, deliveryQty = null) {
  if (item.settlementLineTotal !== null && item.settlementLineTotal !== undefined && item.settlementLineTotal !== "") return Number(item.settlementLineTotal || 0);
  if (item.lineTotal !== null && item.lineTotal !== undefined && item.lineTotal !== "") return Number(item.lineTotal || 0);
  const unitPrice = getEffectiveUnitPrice(item);
  const kg = deliveryQty ?? getSpecKg(item.spec) * Number(item.qty || 0);
  return unitPrice ? unitPrice * Number(kg || 0) : null;
}

function getOrderDisplayTotal(order) {
  const total = (order.items || []).reduce((sum, item, index) => sum + Number(getEffectiveLineTotal(item, getDeliveryItems(order)[index]) || 0), 0);
  return total || null;
}

function canEditSettlement(order) {
  return ["assistant", "owner", "finance", "all"].includes(currentRole) && ["done", "stock", "cooking", "owner", "assistant"].includes(order.status);
}

function renderSettlementEditor(order) {
  if (!canEditSettlement(order)) return "";
  if (!expandedSettlementOrders.has(order.id)) {
    return `<button class="settlement-toggle-button" type="button" data-toggle-settlement="${escapeHtml(order.id)}">调整结算价</button>`;
  }
  return `
    <div class="settlement-editor">
      <div class="settlement-title">
        <span>结算单价</span>
        <button type="button" data-toggle-settlement="${escapeHtml(order.id)}">收起</button>
      </div>
      ${(order.items || [])
        .map(
          (item, index) => `
            <label>
              <span>${escapeHtml(item.name)}</span>
              <input type="number" min="0" step="0.01" data-settlement-price="${escapeHtml(order.id)}" data-settlement-index="${index}" value="${
                item.settlementUnitPrice ?? item.unitPrice ?? ""
              }" placeholder="单价/公斤" />
            </label>
          `,
        )
        .join("")}
      <button class="save-settlement-button" type="button" data-save-settlement="${escapeHtml(order.id)}">保存结算价</button>
    </div>
  `;
}

function getStockQty(number) {
  const qty = Number(inventory[String(number || "").toUpperCase()] || 0);
  return Number.isFinite(qty) ? qty : 0;
}

function extractPhone(value) {
  const match = String(value || "").match(/(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/);
  return match ? match[0].replace(/[-\s]/g, "") : "";
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
  const deliveryItems = getDeliveryItems(order);
  const totalAmount = items.reduce((sum, item, index) => sum + Number(getDeliveryLineTotal(item, deliveryItems[index]) || 0), 0);
  const receiverName = order.customerName || order.tableNo || "未填写";
  const receiverAddress = order.customerAddress || "";
  const receiverContactName = order.customerContactName || "";
  const receiverPhone = order.customerPhone || extractPhone(order.customerContact || order.tableNo || "");
  const rows = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="name-cell">${escapeHtml(item.name)}</td>
          <td>KG</td>
          <td>${formatPlainNumber(deliveryItems[index])}</td>
          <td>${getDeliveryUnitPriceText(item)}</td>
          <td>${getDeliveryLineTotal(item, deliveryItems[index]) ? Number(getDeliveryLineTotal(item, deliveryItems[index])).toFixed(2) : ""}</td>
          <td>${formatPlainNumber(deliveryItems[index])} KG * ${escapeHtml(item.qty)} 桶</td>
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
            <div>收货单位：<span class="line">${escapeHtml(receiverName)}</span></div>
            <div>日期：<span class="line">${escapeHtml(dateText)}</span></div>
            <div>收货地址：<span class="line">${escapeHtml(receiverAddress)}</span></div>
            <div>联系人：<span class="line">${escapeHtml(receiverContactName)}</span></div>
            <div>联系电话：<span class="line">${escapeHtml(receiverPhone)}</span></div>
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
                <td colspan="4" class="summary-text">拾　万　仟　佰　拾　元　角　分</td>
                <td colspan="2">￥：${totalAmount ? totalAmount.toFixed(2) : ""}</td>
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

function makeDeliveryExcelHtml(order) {
  const orderDate = new Date(order.createdAt);
  const dateText = Number.isNaN(orderDate.getTime())
    ? formatOrderDate(order)
    : `${orderDate.getFullYear()}年${orderDate.getMonth() + 1}月${orderDate.getDate()}日`;
  const receiverName = order.customerName || order.tableNo || "未填写";
  const receiverAddress = order.customerAddress || "";
  const receiverContactName = order.customerContactName || "";
  const receiverPhone = order.customerPhone || extractPhone(order.customerContact || order.tableNo || "");
  const items = order.items || [];
  const deliveryItems = getDeliveryItems(order);
  const totalAmount = items.reduce((sum, item, index) => sum + Number(getDeliveryLineTotal(item, deliveryItems[index]) || 0), 0);
  const rows = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>KG</td>
          <td>${formatPlainNumber(deliveryItems[index])}</td>
          <td>${getDeliveryUnitPriceText(item)}</td>
          <td>${getDeliveryLineTotal(item, deliveryItems[index]) ? Number(getDeliveryLineTotal(item, deliveryItems[index])).toFixed(2) : ""}</td>
          <td>${formatPlainNumber(deliveryItems[index])} KG * ${escapeHtml(item.qty)} 桶</td>
        </tr>
      `,
    )
    .join("");
  const emptyRows = Array.from({ length: Math.max(0, 5 - items.length) }, (_, index) =>
    index === 0
      ? `<tr><td></td><td>*** 以下空白 ***</td><td></td><td></td><td></td><td></td><td></td></tr>`
      : `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
  ).join("");

  return `<!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: SimSun, serif; font-size: 12pt; }
          td, th { border: 1px solid #000; padding: 6px; text-align: center; }
          .no-border td { border: 0; text-align: left; }
          .title { font-size: 20pt; font-weight: bold; text-align: center; }
          .subtitle { font-size: 18pt; font-weight: bold; letter-spacing: 12px; text-align: center; }
          .left { text-align: left; }
        </style>
      </head>
      <body>
        <table>
          <tr class="no-border"><td colspan="7" class="title">三千彩纳米新材料有限公司</td></tr>
          <tr class="no-border"><td colspan="7" class="subtitle">送货单</td></tr>
          <tr class="no-border">
            <td colspan="4">收货单位：${escapeHtml(receiverName)}</td>
            <td colspan="3">日期：${escapeHtml(dateText)}</td>
          </tr>
          <tr class="no-border">
            <td colspan="4">收货地址：${escapeHtml(receiverAddress)}</td>
            <td colspan="3">NO：${escapeHtml(order.id.replace(/\D/g, "") || order.id)}</td>
          </tr>
          <tr class="no-border">
            <td colspan="3">联系人：${escapeHtml(receiverContactName)}</td>
            <td colspan="4">联系电话：${escapeHtml(receiverPhone)}</td>
          </tr>
          <tr>
            <th>序号</th>
            <th>品名及型号</th>
            <th>单位</th>
            <th>数量</th>
            <th>单价</th>
            <th>金额</th>
            <th>规格*桶数</th>
          </tr>
          ${rows}
          ${emptyRows}
          <tr>
            <td>合计</td>
            <td colspan="4">拾　万　仟　佰　拾　元　角　分</td>
            <td colspan="2">￥：${totalAmount ? totalAmount.toFixed(2) : ""}</td>
          </tr>
          <tr class="no-border"><td colspan="7">备注：${escapeHtml(order.note || "")}</td></tr>
          <tr class="no-border"><td colspan="3">收货单位（盖章）：</td><td colspan="2">送货单位：</td><td colspan="2">送货车辆：</td></tr>
          <tr class="no-border"><td colspan="3">及收货人（签名）：</td><td colspan="2">及经手人：</td><td colspan="2">及送货人：</td></tr>
        </table>
      </body>
    </html>`;
}

function downloadDeliveryExcel(orderId) {
  const order = latestOrders.find((item) => item.id === orderId);
  if (!order) {
    showToast("找不到订单");
    return;
  }
  const inputValues = getDeliveryInputValues(orderId);
  const excelOrder = {
    ...order,
    deliveryQuantity: inputValues.deliveryQuantity || order.deliveryQuantity || "",
    deliveryItems: Object.keys(inputValues.deliveryItems).length ? inputValues.deliveryItems : order.deliveryItems,
  };
  const blob = new Blob(["\uFEFF", makeDeliveryExcelHtml(excelOrder)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${order.id.replace(/\s+/g, "")}-送货单.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("Excel送货单已导出");
}

function getDeliveryInputValues(orderId) {
  const escapedId = CSS.escape(orderId);
  const order = latestOrders.find((item) => item.id === orderId);
  const deliveryItems = Object.fromEntries((order?.items || []).map((item, index) => [String(index), getDefaultItemKg(item)]));
  const deliveryTotal = Object.values(deliveryItems).reduce((sum, value) => sum + Number(value || 0), 0);
  const batchAllocations = {};
  document.querySelectorAll(`[data-batch-select="${escapedId}"]`).forEach((select) => {
    if (!select.value) return;
    const index = select.dataset.batchIndex;
    batchAllocations[index] = {
      batchId: select.value,
      batchCode: select.selectedOptions[0]?.dataset.batchCode || "",
      qty: deliveryItems[index] || 0,
    };
  });
  return {
    deliveryQuantity: document.querySelector(`[data-delivery-qty="${escapedId}"]`)?.value.trim() || "",
    deliveryItems,
    batchAllocations,
    deliveryTotal: deliveryTotal || null,
  };
}

function canEditDelivery(order) {
  return currentRole === "stock" && ["stock", "cooking"].includes(order.status);
}

function canPrintDeliveryNote(order) {
  return ["stock", "all"].includes(currentRole) && ["stock", "cooking", "done"].includes(order.status);
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
    deliveryItems: Object.keys(inputValues.deliveryItems).length ? inputValues.deliveryItems : order.deliveryItems,
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

async function loadProducts() {
  if (!els.productList && !els.priceEditor && !els.inventoryList && !els.batchProduct) return;
  await loadProductCategories();
  await loadHiddenProducts();
  const products = await requestJson("/api/products");
  customProductNumbers = new Set(products.map((product) => product.number));
  productList = [
    ...defaultProductList.filter(([, code]) => !hiddenProductNumbers.has(code)),
    ...products.filter((product) => !hiddenProductNumbers.has(product.number)).map((product) => [product.color, product.number, product.category || "其他"]),
  ];
  renderPriceEditor();
  renderProducts(products);
  renderInventory();
  renderBatchProductOptions();
}

async function loadHiddenProducts() {
  hiddenProductNumbers = new Set(await requestJson("/api/hidden-products"));
}

async function loadProductCategories() {
  if (!els.productCategory && !els.productList) return;
  productCategories = await requestJson("/api/product-categories");
  renderProductCategoryOptions();
}

function renderProductCategoryOptions() {
  if (!els.productCategory) return;
  const current = els.productCategory.value;
  els.productCategory.innerHTML = productCategories.map((category) => `<option>${escapeHtml(category)}</option>`).join("");
  if (current && productCategories.includes(current)) {
    els.productCategory.value = current;
  }
}

function renderSalesLinks() {
  if (!currentSalesCode) return;
  if (els.salesIdentity) {
    els.salesIdentity.textContent = currentSalesName || currentSalesCode;
  }
  if (els.salesOrderLink) {
    els.salesOrderLink.href = `./index.html?source=sales&sales=${encodeURIComponent(currentSalesCode)}`;
  }
  if (els.salesRecordsLink) {
    els.salesRecordsLink.href = `./sales-records.html?sales=${encodeURIComponent(currentSalesCode)}`;
  }
  if (els.salesSummaryLink) {
    els.salesSummaryLink.href = `./summary.html?sales=${encodeURIComponent(currentSalesCode)}`;
  }
  if (els.salesBackLink) {
    els.salesBackLink.href = `./sales.html?sales=${encodeURIComponent(currentSalesCode)}`;
  }
}

async function loadInventory() {
  if (!els.inventoryList) return;
  inventory = await requestJson("/api/inventory");
  renderInventory();
}

async function loadBatches() {
  if (!els.batchList && currentRole !== "stock") return;
  batches = await requestJson("/api/batches");
  renderBatchList();
}

async function loadSalesSummary() {
  if (!els.salesSummary) return;
  const query = new URLSearchParams({
    period: salesSummaryState.period,
    startDate: salesSummaryState.startDate,
    endDate: salesSummaryState.endDate,
    customer: salesSummaryState.customer,
    product: salesSummaryState.product,
  });
  if (currentSalesCode) query.set("sales", currentSalesCode);
  const summary = await requestJson(`/api/sales-summary?${query.toString()}`);
  renderSalesSummary(summary);
  renderPaymentList(summary.recentPayments || []);
}

function renderSalesSummary(summary) {
  if (!els.salesSummary) return;
  const customerOptions = (summary.customerOptions || [])
    .map((customer) => `<option value="${escapeHtml(customer.key)}" ${salesSummaryState.customer === customer.key ? "selected" : ""}>${escapeHtml(customer.name)}</option>`)
    .join("");
  const productOptions = (summary.productOptions || [])
    .map((product) => `<option value="${escapeHtml(product.key)}" ${salesSummaryState.product === product.key ? "selected" : ""}>${escapeHtml(product.name)}</option>`)
    .join("");
  const productRows = (summary.productSales || [])
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td>${formatWeight(product.kg)}</td>
          <td>${product.qty || 0} 份</td>
          <td>${money(product.amount)}</td>
        </tr>
      `,
    )
    .join("");
  const debtRows = (summary.customerDebts || [])
    .map(
      (customer) => `
        <tr>
          <td>${escapeHtml(customer.name)}</td>
          <td>${money(customer.amount)}</td>
          <td>${money(customer.paid)}</td>
          <td><strong>${money(customer.debt)}</strong></td>
        </tr>
      `,
    )
    .join("");

  els.salesSummary.innerHTML = `
    <div class="sales-summary-filters">
      <div class="period-tabs">
        <button type="button" data-summary-period="day" class="${summary.period === "day" ? "active" : ""}">日</button>
        <button type="button" data-summary-period="week" class="${summary.period === "week" ? "active" : ""}">周</button>
        <button type="button" data-summary-period="month" class="${summary.period === "month" ? "active" : ""}">月</button>
      </div>
      <label>
        <span>开始日期</span>
        <input type="date" data-summary-filter="startDate" value="${escapeHtml(summary.startDate || salesSummaryState.startDate)}" />
      </label>
      <label>
        <span>结束日期</span>
        <input type="date" data-summary-filter="endDate" value="${escapeHtml(summary.endDate || salesSummaryState.endDate)}" />
      </label>
      <label>
        <span>公司</span>
        <select data-summary-filter="customer">
          <option value="">全部公司</option>
          ${customerOptions}
        </select>
      </label>
      <label>
        <span>产品</span>
        <select data-summary-filter="product">
          <option value="">全部产品</option>
          ${productOptions}
        </select>
      </label>
    </div>
    <div class="daily-summary-cards">
      <div><span>${escapeHtml(summary.periodLabel)}销售额</span><strong>${money(summary.salesAmount)}</strong></div>
      <div><span>${escapeHtml(summary.periodLabel)}订单</span><strong>${summary.orderCount || 0}</strong></div>
      <div><span>客户总欠款</span><strong>${money(summary.totalDebt)}</strong></div>
    </div>
    <div class="daily-summary-tables">
      <div>
        <h3>按产品销量</h3>
        <table>
          <thead><tr><td>产品</td><td>销量</td><td>数量</td><td>销售额</td></tr></thead>
          <tbody>${productRows || `<tr><td colspan="4">这个范围还没有产品销量</td></tr>`}</tbody>
        </table>
      </div>
      <div>
        <h3>客户欠款</h3>
        <table>
          <thead><tr><td>客户</td><td>应收</td><td>已收</td><td>欠款</td></tr></thead>
          <tbody>${debtRows || `<tr><td colspan="4">还没有欠款记录</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPaymentList(payments) {
  if (!els.paymentList) return;
  if (!payments.length) {
    els.paymentList.innerHTML = `<div class="admin-empty compact">还没有收款记录</div>`;
    return;
  }
  els.paymentList.innerHTML = payments
    .map((payment) => {
      const date = new Date(payment.createdAt);
      const dateText = Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}月${date.getDate()}日 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
      return `
        <article class="payment-row">
          <strong>${escapeHtml(payment.customerName)}</strong>
          <span>${money(payment.amount)} · ${escapeHtml(payment.method || "未填方式")} · ${escapeHtml(dateText)}</span>
          ${payment.note ? `<small>${escapeHtml(payment.note)}</small>` : ""}
        </article>
      `;
    })
    .join("");
}

els.salesSummary?.addEventListener("click", async (event) => {
  const periodButton = event.target.closest("[data-summary-period]");
  if (!periodButton) return;
  salesSummaryState.period = periodButton.dataset.summaryPeriod;
  salesSummaryState.startDate = "";
  salesSummaryState.endDate = "";
  await loadSalesSummary();
});

els.salesSummary?.addEventListener("change", async (event) => {
  const filter = event.target.closest("[data-summary-filter]");
  if (!filter) return;
  salesSummaryState[filter.dataset.summaryFilter] = filter.value;
  await loadSalesSummary();
});

async function loadOrders() {
  try {
    const query = currentSalesCode ? `?sales=${encodeURIComponent(currentSalesCode)}` : "";
    const orders = await requestJson(`/api/orders${query}`);
    latestOrders = orders;
    renderOrders(orders);
    renderStockDoneOrders(orders);
    await loadShipmentNotices();
    renderDailySummary(orders);
  } catch (error) {
    if (els.orders) els.orders.innerHTML = `<div class="admin-empty">暂时连不上订单服务</div>`;
  }
}

async function loadShipmentNotices() {
  if (!els.shipmentNotices) return;
  const query = currentSalesCode ? `?sales=${encodeURIComponent(currentSalesCode)}` : "";
  const notices = await requestJson(`/api/shipment-notices${query}`);
  renderShipmentNotices(notices);
}

function getVisibleOrders(orders) {
  if (currentRole === "sales" && !isRecordsPage) return orders.filter((order) => ["sales", "shortage_sales"].includes(order.status));
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
            <span>${escapeHtml(customer.code)} · ${escapeHtml(customer.contactName || customer.contact || "未填联系人")}</span>
            <span>电话：${escapeHtml(customer.phone || extractPhone(customer.contact) || "未填电话")}</span>
            <span>地址：${escapeHtml(customer.address || "未填地址")}</span>
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

function renderProducts(products) {
  if (!els.productList) return;
  const customRows = products.map((product) => ({
    name: product.color,
    number: product.number,
    category: product.category || "其他",
    source: "custom",
    hidden: hiddenProductNumbers.has(product.number),
  }));
  const defaultRows = defaultProductList.map(([name, number]) => ({
    name,
    number,
    category: "色浆",
    source: "default",
    hidden: hiddenProductNumbers.has(number),
  }));
  const rows = [...defaultRows, ...customRows];

  els.productList.innerHTML = rows
    .map(
      (product) => `
        <article class="product-row ${product.hidden ? "is-hidden-product" : ""}">
          <strong>${escapeHtml(product.name)} ${escapeHtml(product.number)}</strong>
          <span>${escapeHtml(product.category)}${product.hidden ? " · 已删除" : ""}</span>
          ${
            product.hidden
              ? `<button type="button" data-restore-product="${escapeHtml(product.number)}">恢复</button>`
              : `<button class="danger-button" type="button" data-delete-product="${escapeHtml(product.number)}" data-product-source="${escapeHtml(product.source)}">删除</button>`
          }
        </article>
      `,
    )
    .join("");
}

function renderInventory() {
  if (!els.inventoryList) return;
  els.inventoryList.innerHTML = productList
    .map(
      ([name, code]) => `
        <label class="inventory-row">
          <span>${escapeHtml(name)} ${escapeHtml(code)}</span>
          <input type="number" min="0" step="0.01" data-inventory-code="${escapeHtml(code)}" value="${getStockQty(code) || ""}" placeholder="库存公斤" />
        </label>
      `,
    )
    .join("");
}

function renderBatchProductOptions() {
  if (!els.batchProduct) return;
  els.batchProduct.innerHTML = productList
    .map(([name, code]) => `<option value="${escapeHtml(code)}" data-product-name="${escapeHtml(name)}">${escapeHtml(name)} ${escapeHtml(code)}</option>`)
    .join("");
}

function renderBatchList() {
  if (!els.batchList) return;
  if (!batches.length) {
    els.batchList.innerHTML = `<div class="admin-empty compact">还没有入库批号</div>`;
    return;
  }

  els.batchList.innerHTML = batches
    .map(
      (batch) => `
        <article class="batch-row">
          <div>
            <strong>${escapeHtml(batch.productName || "")} ${escapeHtml(batch.productNumber)}</strong>
            <span>批号：${escapeHtml(batch.batchCode)} · 生产日期：${escapeHtml(batch.producedAt || "未填")}</span>
            ${batch.note ? `<small>${escapeHtml(batch.note)}</small>` : ""}
          </div>
          <div>
            <strong>${formatWeight(batch.remaining)}</strong>
            <span>入库 ${formatWeight(batch.quantity)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderBatchSelector(order, item, index) {
  const allocation = order.batchAllocations?.[index];
  if (currentRole !== "stock" || !["stock", "cooking"].includes(order.status)) {
    return allocation?.batchCode ? `<span class="batch-inline">批号：${escapeHtml(allocation.batchCode)}</span>` : "";
  }

  const productBatches = batches.filter((batch) => batch.productNumber === String(item.number || "").toUpperCase() && Number(batch.remaining || 0) > 0);
  if (!productBatches.length) return `<span class="batch-inline warning">暂无可用批号</span>`;

  return `
    <label class="batch-select-row">
      <span>出库批号</span>
      <select data-batch-select="${escapeHtml(order.id)}" data-batch-index="${index}">
        <option value="">请选择批号</option>
        ${productBatches
          .map(
            (batch) =>
              `<option value="${escapeHtml(batch.id)}" data-batch-code="${escapeHtml(batch.batchCode)}" ${
                allocation?.batchId === batch.id ? "selected" : ""
              }>${escapeHtml(batch.batchCode)} · 余 ${formatWeight(batch.remaining)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

function renderShipmentNotices(orders) {
  if (!els.shipmentNotices) return;
  const doneOrders = orders.filter((order) => order.status === "done").slice(0, 6);

  if (!doneOrders.length) {
    els.shipmentNotices.innerHTML = `<div class="admin-empty compact">还没有发货通知</div>`;
    return;
  }

  els.shipmentNotices.innerHTML = doneOrders
    .map(
      (order) => `
        <article class="shipment-notice">
          <div>
            <strong>${escapeHtml(order.id)}</strong>
            <span>${escapeHtml(order.customerName || order.tableNo || "未填写")} · ${escapeHtml(formatOrderDate(order))}</span>
          </div>
          <small>${(order.items || [])
            .map((item, index) => `${escapeHtml(item.name)} ${formatWeight(getDeliveryItems(order)[index])}`)
            .join("；")}</small>
        </article>
      `,
    )
    .join("");
}

function renderOrders(orders) {
  if (els.newCount) els.newCount.textContent = orders.filter((order) => ["warehouse", "boss"].includes(order.status)).length;
  if (els.salesCount) els.salesCount.textContent = orders.filter((order) => ["sales", "shortage_sales"].includes(order.status)).length;
  if (els.cookingCount) els.cookingCount.textContent = orders.filter((order) => ["assistant", "shortage_assistant"].includes(order.status)).length;
  if (els.ownerCount) els.ownerCount.textContent = orders.filter((order) => order.status === "owner").length;
  if (els.stockCount) els.stockCount.textContent = orders.filter((order) => ["stock", "cooking"].includes(order.status)).length;
  if (els.totalCount) els.totalCount.textContent = orders.filter((order) => ["stock", "cooking", "done", "shortage_customer"].includes(order.status)).length;
  if (!els.orders) return;
  const visibleOrders = getVisibleOrders(orders);

  if (!visibleOrders.length) {
    els.orders.innerHTML = `<div class="admin-empty">还没有订单</div>`;
    return;
  }

  els.orders.innerHTML = visibleOrders
    .map(
      (order) => {
        const deliveryItems = getDeliveryItems(order);
        const displayTotal = getOrderDisplayTotal(order);
        return `
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
                (item, index) => `
                  <div class="submitted-item">
                    <div>
                      <p>${escapeHtml(item.name)} × ${item.qty}</p>
                      <span>${escapeHtml(item.spec)}${getEffectiveUnitPrice(item) ? ` · ${money(getEffectiveUnitPrice(item))} / 公斤` : ""}${
                        item.settlementUnitPrice ? " · 结算价" : ""
                      }</span>
                      ${currentRole === "stock" ? `<span class="stock-inline">当前库存</span>` : ""}
                      ${renderBatchSelector(order, item, index)}
                    </div>
                    <strong class="stock-qty-display">${formatWeight(getStockQty(item.number))}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>

          ${order.note ? `<p class="submitted-note">备注：${escapeHtml(order.note)}</p>` : ""}
          ${
            currentRole === "stock"
              ? ""
              : `<div class="submitted-total">
                  <span>总重量 ${formatWeight(order.serviceFee || getOrderTotalKg(order))}</span>
                  <strong>${displayTotal ? money(displayTotal) : "下单后确认"}</strong>
                </div>`
          }

          ${renderSettlementEditor(order)}

          <div class="admin-actions">
            ${
              canEditDelivery(order)
                ? `<button class="secondary-action-button" type="button" data-status="${escapeHtml(order.status)}" data-id="${escapeHtml(order.id)}">保存发货数量</button>`
                : ""
            }
            ${(statusActions[order.status] || [])
              .filter(() => currentRole !== "finance")
              .map(
                (status) => `
                  <button type="button" data-status="${status}" data-id="${escapeHtml(order.id)}">
                    ${statusActionText[status] || `标记为${statusText[status]}`}
                  </button>
                `,
              )
              .join("")}
            ${
              currentRole !== "finance" && ["stock", "cooking"].includes(order.status)
                ? `<button type="button" data-status="done" data-id="${escapeHtml(order.id)}">库存够，正常发货</button>
                   <button class="warning-button" type="button" data-status="shortage_assistant" data-id="${escapeHtml(order.id)}">不够货，退回助理</button>`
                : ""
            }
            ${canPrintDeliveryNote(order) ? `<button type="button" data-delivery-note="${escapeHtml(order.id)}">送货单</button>` : ""}
            ${canPrintDeliveryNote(order) ? `<button type="button" data-delivery-excel="${escapeHtml(order.id)}">导出Excel</button>` : ""}
            ${canDeleteOrders ? `<button class="danger-button" type="button" data-delete-order="${escapeHtml(order.id)}">删除订单</button>` : ""}
          </div>
        </article>
      `;
      },
    )
    .join("");
}

function renderStockDoneOrders(orders) {
  if (!els.stockDoneOrders) return;
  const doneOrders = orders.filter((order) => order.status === "done");

  if (!doneOrders.length) {
    els.stockDoneOrders.innerHTML = `<div class="admin-empty compact">还没有已发货订单</div>`;
    return;
  }

  els.stockDoneOrders.innerHTML = doneOrders
    .map(
      (order) => `
        <article class="admin-order stock-done-order" data-id="${escapeHtml(order.id)}">
          <div class="admin-order-head">
            <div>
              <p class="eyebrow">${escapeHtml(order.tableNo)} · ${escapeHtml(formatOrderDate(order))}</p>
              <h2>${escapeHtml(order.id)}</h2>
              ${order.customerName ? `<p class="cart-item-meta">客户：${escapeHtml(order.customerName)}</p>` : ""}
            </div>
            <span class="status-pill status-done">已发货</span>
          </div>
          <div class="submitted-items">
            ${(order.items || [])
              .map(
                (item, index) => `
                  <div class="submitted-item">
                    <div>
                      <p>${escapeHtml(item.name)} × ${item.qty}</p>
                      <span>${escapeHtml(item.spec)}${getEffectiveUnitPrice(item) ? ` · ${money(getEffectiveUnitPrice(item))} / 公斤` : ""}${
                        item.settlementUnitPrice ? " · 结算价" : ""
                      }</span>
                    </div>
                    <strong>${formatWeight(getDeliveryItems(order)[index])}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
          ${order.note ? `<p class="submitted-note">备注：${escapeHtml(order.note)}</p>` : ""}
          <div class="admin-actions">
            <button type="button" data-delivery-note="${escapeHtml(order.id)}">送货单</button>
            <button type="button" data-delivery-excel="${escapeHtml(order.id)}">导出Excel</button>
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
        contactName: els.customerContactName?.value.trim() || "",
        phone: els.customerPhone?.value.trim() || "",
        address: els.customerAddress?.value.trim() || "",
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
    if (els.customerContactName) els.customerContactName.value = customer.contactName || customer.contact || "";
    if (els.customerPhone) els.customerPhone.value = customer.phone || extractPhone(customer.contact);
    if (els.customerAddress) els.customerAddress.value = customer.address || "";
    els.customerShowPrices.checked = Boolean(customer.showPrices);
    renderPriceEditor(customer.prices);
  }
});

els.productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await requestJson("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        color: els.productColor.value.trim(),
        number: els.productNumber.value.trim(),
        category: els.productCategory.value,
      }),
    });
    els.productForm.reset();
    showToast("产品已添加");
    await loadProducts();
    await loadCustomers();
  } catch (error) {
    showToast("产品添加失败，请检查名称和编号");
  }
});

els.addProductCategory?.addEventListener("click", async () => {
  const name = els.newProductCategory.value.trim();
  if (!name) {
    showToast("请填写类别名称");
    return;
  }

  try {
    productCategories = await requestJson("/api/product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    els.newProductCategory.value = "";
    renderProductCategoryOptions();
    els.productCategory.value = name;
    showToast("类别已添加");
  } catch (error) {
    showToast("类别添加失败");
  }
});

els.productList?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-product]");
  const restoreButton = event.target.closest("[data-restore-product]");

  if (restoreButton) {
    const number = restoreButton.dataset.restoreProduct;
    try {
      await requestJson("/api/hidden-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, hidden: false }),
      });
      showToast("产品已恢复");
      await loadProducts();
    } catch (error) {
      showToast("恢复失败，请稍后再试");
    }
    return;
  }

  if (deleteButton) {
    const number = deleteButton.dataset.deleteProduct;
    if (!window.confirm(`确定删除 ${number} 吗？删除后前台不会再显示。`)) return;
    try {
      if (deleteButton.dataset.productSource === "custom") {
        await requestJson(`/api/products/${encodeURIComponent(number)}`, { method: "DELETE" });
      } else {
        await requestJson("/api/hidden-products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number, hidden: true }),
        });
      }
      showToast("产品已删除");
      await loadProducts();
    } catch (error) {
      showToast("删除失败，请稍后再试");
    }
  }
});

els.saveInventory?.addEventListener("click", async () => {
  const items = {};
  els.inventoryList.querySelectorAll("[data-inventory-code]").forEach((input) => {
    const qty = Number(input.value);
    if (Number.isFinite(qty) && input.value !== "" && qty >= 0) {
      items[input.dataset.inventoryCode] = qty;
    }
  });

  try {
    inventory = await requestJson("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    showToast("库存已保存");
    await loadOrders();
  } catch (error) {
    showToast("库存保存失败");
  }
});

els.batchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selected = els.batchProduct.selectedOptions[0];

  try {
    await requestJson("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productNumber: els.batchProduct.value,
        productName: selected?.dataset.productName || "",
        batchCode: els.batchCode.value.trim(),
        quantity: els.batchQuantity.value,
        producedAt: els.batchDate.value,
        note: els.batchNote.value.trim(),
      }),
    });
    els.batchForm.reset();
    showToast("入库批号已保存");
    await Promise.all([loadInventory(), loadBatches()]);
  } catch (error) {
    showToast("入库保存失败，请检查产品、批号和数量");
  }
});

els.paymentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await requestJson("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: els.paymentCustomer.value.trim(),
        amount: els.paymentAmount.value,
        method: els.paymentMethod.value.trim(),
        note: els.paymentNote.value.trim(),
      }),
    });
    els.paymentForm.reset();
    showToast("收款已保存");
    await loadSalesSummary();
  } catch (error) {
    showToast("收款保存失败，请检查客户和金额");
  }
});

async function handleOrderActionClick(event) {
  const deliveryNoteButton = event.target.closest("button[data-delivery-note]");
  if (deliveryNoteButton) {
    printDeliveryNote(deliveryNoteButton.dataset.deliveryNote);
    return;
  }

  const deliveryExcelButton = event.target.closest("button[data-delivery-excel]");
  if (deliveryExcelButton) {
    downloadDeliveryExcel(deliveryExcelButton.dataset.deliveryExcel);
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

  const settlementButton = event.target.closest("button[data-save-settlement]");
  if (settlementButton) {
    const orderId = settlementButton.dataset.saveSettlement;
    const prices = {};
    document.querySelectorAll(`[data-settlement-price="${CSS.escape(orderId)}"]`).forEach((input) => {
      prices[input.dataset.settlementIndex] = input.value;
    });

    try {
      await requestJson(`/api/orders/${encodeURIComponent(orderId)}/settlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      });
      showToast("结算价已保存");
      await loadOrders();
      await loadSalesSummary();
    } catch (error) {
      showToast("结算价保存失败");
    }
    return;
  }

  const settlementToggleButton = event.target.closest("button[data-toggle-settlement]");
  if (settlementToggleButton) {
    const orderId = settlementToggleButton.dataset.toggleSettlement;
    if (expandedSettlementOrders.has(orderId)) {
      expandedSettlementOrders.delete(orderId);
    } else {
      expandedSettlementOrders.add(orderId);
    }
    renderOrders(latestOrders);
    return;
  }

  const button = event.target.closest("button[data-status]");
  if (!button) return;

  try {
    const order = latestOrders.find((item) => item.id === button.dataset.id);
    const inputValues = getDeliveryInputValues(button.dataset.id);
    const deliveryQty =
      inputValues.deliveryQuantity ||
      (button.dataset.status === "done" && order ? `${inputValues.deliveryTotal || getDeliveryTotalKg(order)}公斤` : "");
    await requestJson(`/api/orders/${encodeURIComponent(button.dataset.id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: button.dataset.status,
        deliveryQuantity: deliveryQty,
        deliveryItems: inputValues.deliveryItems,
        batchAllocations: inputValues.batchAllocations,
      }),
    });
      showToast("订单状态已更新");
      await loadInventory();
      await loadBatches();
      await loadOrders();
  } catch (error) {
    showToast("更新失败，请稍后再试");
  }
}

els.orders?.addEventListener("click", handleOrderActionClick);
els.stockDoneOrders?.addEventListener("click", handleOrderActionClick);

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
    finance: "财务",
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
  renderSalesLinks();
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.roleLink === currentRole);
  });
  if (isSummaryPage) {
    await loadSalesSummary();
    return;
  }
  await loadProducts();
  renderPriceEditor();
  await Promise.all([loadSettings(), loadCustomers(), loadInventory(), loadSalesSummary()]);
  await loadBatches();
  await loadOrders();
  ordersTimer = window.setInterval(loadOrders, 5000);
}

init();
