const statusText = {
  warehouse: "待老板确认",
  boss: "待老板确认",
  sales: "已提交业务员",
  cooking: "处理中",
  done: "已完成",
};

const state = {
  customerCode: new URLSearchParams(window.location.search).get("customer") || "",
  customer: null,
  orders: [],
};

const els = {
  customer: document.querySelector("#bossCustomer"),
  orders: document.querySelector("#bossOrders"),
  pendingCount: document.querySelector("#bossPendingCount"),
  salesCount: document.querySelector("#bossSalesCount"),
  orderPageLink: document.querySelector("#orderPageLink"),
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

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

function isPendingBoss(order) {
  return ["warehouse", "boss"].includes(order.status);
}

function renderCustomer() {
  if (!state.customerCode) {
    els.customer.innerHTML = `
      <strong>缺少客户编号</strong>
      <span>请使用后台生成的老板确认链接打开</span>
    `;
    els.orderPageLink.href = "./index.html";
    return;
  }

  els.orderPageLink.href = `./index.html?customer=${encodeURIComponent(state.customerCode)}`;
  els.customer.innerHTML = `
    <strong>${escapeHtml(state.customer?.name || state.customerCode)}</strong>
    <span>${escapeHtml(state.customer?.contact || "确认后订单会发给三千彩业务员")}</span>
  `;
}

function renderOrders() {
  const pendingOrders = state.orders.filter(isPendingBoss);
  els.pendingCount.textContent = pendingOrders.length;
  els.salesCount.textContent = state.orders.filter((order) => order.status === "sales").length;

  if (!state.customerCode) {
    els.orders.innerHTML = `<div class="admin-empty">请使用正确的老板确认链接</div>`;
    return;
  }

  if (!pendingOrders.length) {
    els.orders.innerHTML = `<div class="admin-empty">暂无需要确认的订单</div>`;
    return;
  }

  els.orders.innerHTML = pendingOrders
    .map(
      (order) => `
        <article class="admin-order boss-order" data-id="${escapeHtml(order.id)}">
          <div class="admin-order-head">
            <div>
              <p class="eyebrow">${escapeHtml(order.tableNo)} · ${escapeHtml(formatOrderDate(order))}</p>
              <h2>${escapeHtml(order.id)}</h2>
              ${order.customerName ? `<p class="cart-item-meta">客户：${escapeHtml(order.customerName)}</p>` : ""}
            </div>
            <span class="status-pill status-${escapeHtml(order.status)}">${statusText[order.status] || "待确认"}</span>
          </div>

          <div class="submitted-items">
            ${(order.items || [])
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

          <div class="submitted-total">
            <span>共 ${order.count} 份需求</span>
            <strong>${order.total ? money(order.total) : "下单后确认"}</strong>
          </div>

          <div class="admin-actions">
            <button type="button" data-approve="${escapeHtml(order.id)}">确认并发给业务员</button>
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadOrders() {
  if (!state.customerCode) {
    renderCustomer();
    renderOrders();
    return;
  }

  try {
    const data = await requestJson(`/api/customer-orders?customer=${encodeURIComponent(state.customerCode)}`);
    state.customer = data.customer;
    state.orders = data.orders || [];
    renderCustomer();
    renderOrders();
  } catch (error) {
    els.orders.innerHTML = `<div class="admin-empty">暂时连不上订单服务</div>`;
  }
}

els.orders.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-approve]");
  if (!button) return;

  try {
    await requestJson(`/api/customer-orders/${encodeURIComponent(button.dataset.approve)}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerCode: state.customerCode }),
    });
    showToast("已确认，订单已发给业务员");
    await loadOrders();
  } catch (error) {
    showToast("确认失败，请刷新后再试");
  }
});

loadOrders();
window.setInterval(loadOrders, 5000);
