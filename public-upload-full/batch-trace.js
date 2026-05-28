const els = {
  form: document.querySelector("#traceForm"),
  batch: document.querySelector("#traceBatch"),
  results: document.querySelector("#traceResults"),
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

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatWeight(kg) {
  return `${Number(kg || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 公斤`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function renderRows(rows) {
  if (!rows.length) {
    els.results.innerHTML = `<div class="admin-empty">没有查到这个批号的发货记录</div>`;
    return;
  }

  els.results.innerHTML = rows
    .map(
      (row) => `
        <article class="admin-order">
          <div class="admin-order-head">
            <div>
              <p class="eyebrow">${escapeHtml(row.batchCode)} · ${escapeHtml(formatDate(row.createdAt))}</p>
              <h2>${escapeHtml(row.orderId)}</h2>
              <p class="cart-item-meta">客户：${escapeHtml(row.customerName)}</p>
            </div>
            <span class="status-pill status-done">${escapeHtml(formatWeight(row.qty))}</span>
          </div>
          <div class="submitted-items">
            <div class="submitted-item">
              <div>
                <p>${escapeHtml(row.productName)}</p>
                <span>${escapeHtml(row.productNumber)}</span>
              </div>
              <strong>${escapeHtml(formatWeight(row.qty))}</strong>
            </div>
          </div>
          <p class="submitted-note">
            联系人：${escapeHtml(row.customerContactName || "未填")}　
            电话：${escapeHtml(row.customerPhone || "未填")}　
            地址：${escapeHtml(row.customerAddress || "未填")}
          </p>
        </article>
      `,
    )
    .join("");
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const batch = els.batch.value.trim();
  if (!batch) return;

  try {
    const response = await fetch(`/api/batch-trace?batch=${encodeURIComponent(batch)}`);
    if (!response.ok) throw new Error("Trace failed");
    const data = await response.json();
    renderRows(data.rows || []);
  } catch (error) {
    showToast("查询失败，请稍后再试");
  }
});
