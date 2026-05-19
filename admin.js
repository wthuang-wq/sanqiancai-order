const statusText = {
  new: "新询价",
  cooking: "跟进中",
  done: "已完成",
};

const statusActions = {
  new: ["cooking", "done"],
  cooking: ["done"],
  done: ["new"],
};

const els = {
  orders: document.querySelector("#adminOrders"),
  newCount: document.querySelector("#newCount"),
  cookingCount: document.querySelector("#cookingCount"),
  totalCount: document.querySelector("#totalCount"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
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
  return `¥${Number(value).toFixed(value % 1 ? 1 : 0)}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

async function loadOrders() {
  try {
    const response = await fetch("/api/orders");
    if (!response.ok) throw new Error("Load orders failed");
    const orders = await response.json();
    renderOrders(orders);
  } catch (error) {
    els.orders.innerHTML = `<div class="admin-empty">暂时连不上询价服务</div>`;
  }
}

function renderOrders(orders) {
  els.newCount.textContent = orders.filter((order) => order.status === "new").length;
  els.cookingCount.textContent = orders.filter((order) => order.status === "cooking").length;
  els.totalCount.textContent = orders.length;

  if (!orders.length) {
    els.orders.innerHTML = `<div class="admin-empty">还没有询价</div>`;
    return;
  }

  els.orders.innerHTML = orders
    .map(
      (order) => `
        <article class="admin-order" data-id="${escapeHtml(order.id)}">
          <div class="admin-order-head">
            <div>
              <p class="eyebrow">${escapeHtml(order.tableNo)} · ${escapeHtml(order.time)}</p>
              <h2>${escapeHtml(order.id)}</h2>
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
                      <span>${escapeHtml(item.spec)} · ${escapeHtml(item.spice)}</span>
                    </div>
                    <strong>询价</strong>
                  </div>
                `,
              )
              .join("")}
          </div>

          ${order.note ? `<p class="submitted-note">备注：${escapeHtml(order.note)}</p>` : ""}

          <div class="submitted-total">
            <span>共 ${order.count} 份需求</span>
            <strong>待报价</strong>
          </div>

          <div class="admin-actions">
            ${(statusActions[order.status] || [])
              .map(
                (status) => `
                  <button type="button" data-status="${status}" data-id="${escapeHtml(order.id)}">
                    标记为${statusText[status]}
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

els.orders.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-status]");
  if (!button) return;

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(button.dataset.id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: button.dataset.status }),
    });

    if (!response.ok) throw new Error("Update status failed");
    showToast("订单状态已更新");
    await loadOrders();
  } catch (error) {
    showToast("更新失败，请稍后再试");
  }
});

loadOrders();
window.setInterval(loadOrders, 5000);
