const pageParams = new URLSearchParams(window.location.search);
const customerCode = pageParams.get("customer") || "";

const els = {
  customer: document.querySelector("#customerOrdersCustomer"),
  list: document.querySelector("#customerOrdersList"),
  backLink: document.querySelector("#customerOrderBackLink"),
  toast: document.querySelector("#toast"),
};

const customerStatusText = {
  warehouse: "待老板确认",
  boss: "待老板确认",
  sales: "业务员处理",
  assistant: "销售助理处理",
  owner: "老板审批",
  stock: "仓库发货",
  cooking: "仓库发货",
  done: "已发货",
  return_requested: "退货申请中",
  shortage_assistant: "缺货处理中",
  shortage_sales: "缺货处理中",
  shortage_customer: "已通知缺货",
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

function formatWeight(kg) {
  return `${Number(kg || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 公斤`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

function getLineAmount(order, item, index) {
  if (item.settlementLineTotal !== undefined && item.settlementLineTotal !== null) return item.settlementLineTotal;
  if (item.lineTotal !== undefined && item.lineTotal !== null) return item.lineTotal;
  if (item.unitPrice === null || item.unitPrice === undefined) return null;
  const weight = Number(item.shippedKg ?? item.actualKg ?? item.kg ?? 0) || 0;
  return Number(item.unitPrice) * weight;
}

function getBatchText(order, index) {
  const allocation = order.batchAllocations?.[index];
  const batches = Array.isArray(allocation?.batches)
    ? allocation.batches
    : allocation?.batchCode
      ? [{ batchCode: allocation.batchCode, qty: allocation.qty }]
      : [];
  if (!batches.length) return "";
  return `批号：${batches.map((batch) => `${batch.batchCode} ${formatWeight(batch.qty)}`).join("；")}`;
}

function renderOrders(orders) {
  if (!orders.length) {
    els.list.innerHTML = `<div class="empty-order large-empty">还没有查到订单</div>`;
    return;
  }

  els.list.innerHTML = orders
    .map(
      (order) => {
        const items = order.items || [];
        const visibleItems = items.slice(0, 3);
        const restCount = Math.max(0, items.length - visibleItems.length);
        return `
        <article class="submitted-order customer-order-card">
          <div class="submitted-order-head">
            <strong>${escapeHtml(order.id)}</strong>
            <span>${escapeHtml(customerStatusText[order.status] || "处理中")} · ${escapeHtml(formatOrderDate(order))}</span>
          </div>
          <div class="customer-order-summary">
            ${visibleItems
              .map(
                (item) => `
                  <span>${escapeHtml(item.name)} × ${escapeHtml(item.qty || 1)}</span>
                `,
              )
              .join("")}
            ${restCount ? `<span>还有 ${restCount} 个产品</span>` : ""}
          </div>
          <p class="submitted-note">下单客户：${escapeHtml(order.customerName || order.tableNo || "未填写")}</p>
          <div class="submitted-items">
            ${items
              .map((item, index) => {
                const lineAmount = getLineAmount(order, item, index);
                return `
                  <div class="submitted-item">
                    <div>
                      <p>${escapeHtml(item.name)} × ${escapeHtml(item.qty || 1)}</p>
                      <span>${escapeHtml(item.spec || "")}${item.unitPrice !== null && item.unitPrice !== undefined ? ` · ${money(item.unitPrice)} / 公斤` : ""}</span>
                      ${getBatchText(order, index) ? `<span>${escapeHtml(getBatchText(order, index))}</span>` : ""}
                    </div>
                    ${lineAmount === null ? "" : `<strong>${money(lineAmount)}</strong>`}
                  </div>
                `;
              })
              .join("")}
          </div>
          ${order.note ? `<p class="submitted-note">备注：${escapeHtml(order.note)}</p>` : ""}
          ${order.returnReason ? `<p class="submitted-note">退货原因：${escapeHtml(order.returnReason)}</p>` : ""}
          <div class="submitted-total">
            <span>总重量 ${formatWeight(order.serviceFee)}</span>
            <strong>${order.settlementTotal || order.total ? money(order.settlementTotal || order.total) : "下单后确认"}</strong>
          </div>
          <div class="customer-order-actions">
            <button class="detail-button" type="button" data-detail-order="${escapeHtml(order.id)}">查看详情</button>
            ${
              order.status === "done"
                ? `<button class="after-sale-button" type="button" data-after-sale-order="${escapeHtml(order.id)}">售后/退货</button>`
                : ""
            }
          </div>
        </article>
      `;
      },
    )
    .join("");
}

async function loadOrders() {
  if (!customerCode) {
    els.customer.textContent = "请使用专属客户链接进入";
    els.list.innerHTML = `<div class="empty-order large-empty">没有客户编号，暂时无法查询订单</div>`;
    return;
  }

  els.backLink.href = `./index.html?customer=${encodeURIComponent(customerCode)}`;

  try {
    const response = await fetch(`/api/customer-orders?customer=${encodeURIComponent(customerCode)}`);
    if (!response.ok) throw new Error("Load failed");
    const data = await response.json();
    const customer = data.customer || null;
    els.customer.textContent = customer ? `${customer.name} · ${customer.contactName || customer.phone || "专属客户"}` : `客户编号：${customerCode}`;
    renderOrders(data.orders || []);
  } catch (error) {
    els.customer.textContent = "订单读取失败";
    els.list.innerHTML = `<div class="empty-order large-empty">读取失败，请稍后再试</div>`;
  }
}

els.list.addEventListener("click", async (event) => {
  const detailButton = event.target.closest("[data-detail-order]");
  if (detailButton) {
    const card = detailButton.closest(".customer-order-card");
    card?.classList.toggle("is-detail-open");
    detailButton.textContent = card?.classList.contains("is-detail-open") ? "收起详情" : "查看详情";
    return;
  }

  const button = event.target.closest("[data-after-sale-order]");
  if (!button) return;

  const reason = window.prompt("请填写售后说明，例如：需要退货 / 数量不对 / 颜色需要确认");
  if (reason === null) return;

  try {
    const response = await fetch(`/api/customer-orders/${encodeURIComponent(button.dataset.afterSaleOrder)}/return`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerCode, reason }),
    });
    if (!response.ok) throw new Error("Return request failed");
    showToast("售后申请已提交");
    await loadOrders();
  } catch (error) {
    showToast("售后申请失败，请联系业务员");
  }
});

loadOrders();
