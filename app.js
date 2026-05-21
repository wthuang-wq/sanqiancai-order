const categories = ["全部", "黄色系", "红色系", "紫色系", "橙色系", "蓝色系", "黑色系"];
const packageOptions = ["60公斤", "1公斤", "5公斤", "25公斤", "自定义"];

const defaultDishRows = [
  ["y102", "柠檬黄", "Y-102", "黄色系", "#ffe900", "3%", "S", "4", "4.5", "4", "4", true],
  ["y103", "嫩黄", "Y-103", "黄色系", "#ffd600", "3%", "SE", "4", "4", "4", "4", false],
  ["y106", "荧光黄", "Y-106", "黄色系", "#fff45c", "3%", "S", "4", "4", "4", "4", true],
  ["r202", "大红", "R-202", "红色系", "#f3272b", "3%", "S", "4", "4", "4", "4", true],
  ["r203", "红玉", "R-203", "红色系", "#bf0b2e", "3%", "S", "4", "4", "4", "4", false],
  ["r205", "桃红", "R-205", "红色系", "#f32f86", "3%", "E", "4", "4", "4", "4", true],
  ["r207", "红玉", "R-207", "红色系", "#bf0034", "3%", "SE", "4", "4", "4", "4", false],
  ["r209", "荧光红", "R-209", "红色系", "#ff2855", "3%", "S", "4", "4", "4", "4", true],
  ["r210", "艳红", "R-210", "红色系", "#dc003d", "3%", "S", "4", "4", "4", "4", false],
  ["r211", "荧光红", "R-211", "红色系", "#ff006e", "3%", "S", "4", "4", "4", "4", true],
  ["r212", "红", "R-212", "红色系", "#e5002d", "3%", "S", "4", "4", "4", "4", false],
  ["v603", "紫", "V-603", "紫色系", "#2d0064", "3%", "SE", "4", "4", "4", "4", false],
  ["v605", "紫", "V-605", "紫色系", "#b62fc1", "3%", "S", "4", "4", "4", "4", false],
  ["o302", "橙", "O-302", "橙色系", "#ff7200", "3%", "SE", "4", "4.5", "4", "3-4", true],
  ["o303", "橙", "O-303", "橙色系", "#ff8400", "3%", "S", "4", "4.5", "4", "3-4", false],
  ["b501a", "翠蓝", "B-501A", "蓝色系", "#0398d8", "3%", "S", "4", "4.5", "4", "4", true],
  ["b503", "深蓝", "B-503", "蓝色系", "#004a94", "3%", "SE", "4", "4", "4", "4", false],
  ["b507", "深蓝", "B-507", "蓝色系", "#003277", "3%", "S", "4-5", "4", "4", "4", false],
  ["b510", "宝蓝", "B-510", "蓝色系", "#001b9a", "3%", "SE", "4", "4", "4", "4", true],
  ["b512", "艳蓝", "B-512", "蓝色系", "#002da8", "3%", "SE", "4", "4", "4", "4", false],
  ["b515", "艳蓝", "B-515", "蓝色系", "#0065d4", "3%", "S", "4", "4", "4", "4", false],
  ["b518", "艳兰", "B-518", "蓝色系", "#00106f", "3%", "S", "4", "4", "4", "4", false],
  ["k801", "黑", "K-801", "黑色系", "#050505", "6%", "SE", "3", "4", "3-4", "4", true],
  ["k803", "黑", "K-803", "黑色系", "#060606", "6%", "SE", "3", "4", "3-4", "4", false],
  ["k805", "黑", "K-805", "黑色系", "#080808", "6%", "SE", "3", "4", "3-4", "4", false],
  ["k900", "黑", "K-900", "黑色系", "#020202", "6%", "SE", "3", "4", "3-4", "4", false],
];

function makeDish(row) {
  const [id, color, number, category, hex = "#8b8b8b", deep = "3%", type = "S", washing = "4", rubbing = "4", sublimation = "4", light = "4", hot = false] = row;
  return {
    id,
    name: `${color} ${number}`,
    color,
    number,
    category,
    price: 0,
    hot,
    icon: number,
    gradient: `linear-gradient(135deg, ${hex}, ${hex})`,
    desc: `类型 ${type} · 牢度：洗涤 ${washing}，摩擦 ${rubbing}，升华/180度 ${sublimation}，日晒 ${light}`,
    specs: packageOptions,
    deep,
    type,
    fastness: { washing, rubbing, sublimation, light },
  };
}

let dishes = defaultDishRows.map((row) => makeDish(row));

function applyCustomProducts(products = []) {
  const customRows = products.map((product) => [
    product.id || product.number.toLowerCase(),
    product.color,
    product.number,
    product.category || "其他",
    "#8b8b8b",
    "3%",
    "S",
    "4",
    "4",
    "4",
    "4",
    false,
  ]);
  dishes = [...defaultDishRows, ...customRows].map((row) => makeDish(row));
}

const state = {
  category: "全部",
  query: "",
  onlyHot: false,
  cart: new Map(),
  submittedOrders: [],
  settings: { showPrices: false },
  customer: null,
  customerCode: new URLSearchParams(window.location.search).get("customer") || "",
};

const els = {
  categoryTabs: document.querySelector("#categoryTabs"),
  dishList: document.querySelector("#dishList"),
  customerBanner: document.querySelector("#customerBanner"),
  frequentSection: document.querySelector("#frequentSection"),
  frequentList: document.querySelector("#frequentList"),
  cartList: document.querySelector("#cartList"),
  cartCount: document.querySelector("#cartCount"),
  subtotal: document.querySelector("#subtotal"),
  serviceFee: document.querySelector("#serviceFee"),
  totalPrice: document.querySelector("#totalPrice"),
  clearCart: document.querySelector("#clearCart"),
  submitOrder: document.querySelector("#submitOrder"),
  searchInput: document.querySelector("#searchInput"),
  onlyHot: document.querySelector("#onlyHot"),
  tableNo: document.querySelector("#tableNo"),
  lockedCustomer: document.querySelector("#lockedCustomer"),
  orderNote: document.querySelector("#orderNote"),
  submittedList: document.querySelector("#submittedList"),
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
  return `¥${Number(value).toFixed(value % 1 ? 2 : 0)}`;
}

function formatOrderDate(order) {
  const date = new Date(order.createdAt);
  if (Number.isNaN(date.getTime())) return order.time || "";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${order.time || date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function cartKey(dishId, spec) {
  return `${dishId}__${spec}`;
}

function shouldShowPrices() {
  return Boolean(state.settings.showPrices && state.customer?.showPrices);
}

function getUnitPrice(dish) {
  const price = state.customer?.prices?.[dish.number];
  return Number.isFinite(Number(price)) ? Number(price) : null;
}

function getSpecKg(spec) {
  const match = String(spec).match(/(\d+(?:\.\d+)?)\s*(kg|公斤)/i);
  return match ? Number(match[1]) : 0;
}

function formatWeight(kg) {
  return `${Number(kg || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 公斤`;
}

function getLineTotal(item) {
  if (!shouldShowPrices() || item.unitPrice === null) return null;
  const kg = getSpecKg(item.spec);
  return item.unitPrice * (kg || 1) * item.qty;
}

function getPriceText(value) {
  return value === null ? "下单" : money(value);
}

function getDishPriceText(dish) {
  const unitPrice = getUnitPrice(dish);
  return unitPrice === null ? "" : `${money(unitPrice)} / 公斤`;
}

function getCartStats() {
  let count = 0;
  let kg = 0;
  let total = 0;
  let hasPrice = false;

  state.cart.forEach((item) => {
    count += item.qty;
    kg += getSpecKg(item.spec) * item.qty;
    const lineTotal = getLineTotal(item);
    if (lineTotal !== null) {
      hasPrice = true;
      total += lineTotal;
    }
  });

  return { count, subtotal: state.cart.size, serviceFee: kg, total: hasPrice ? total : null };
}

function renderCategories() {
  els.categoryTabs.innerHTML = categories
    .map(
      (category) => `
        <button type="button" class="${category === state.category ? "active" : ""}" data-category="${category}">
          ${category}
        </button>
      `,
    )
    .join("");
}

function getFilteredDishes() {
  const agreedNumbers = new Set((state.customer?.agreedNumbers || []).map((item) => String(item).toUpperCase()));
  return dishes
    .filter((dish) => {
      const matchesCategory = state.category === "全部" || dish.category === state.category;
      const matchesQuery =
        dish.name.includes(state.query) ||
        dish.number.toLowerCase().includes(state.query.toLowerCase()) ||
        dish.type.toLowerCase().includes(state.query.toLowerCase()) ||
        dish.desc.includes(state.query);
      const matchesHot = !state.onlyHot || dish.hot;
      return matchesCategory && matchesQuery && matchesHot;
    })
    .sort((a, b) => Number(agreedNumbers.has(b.number)) - Number(agreedNumbers.has(a.number)));
}

function renderDishes() {
  const filtered = getFilteredDishes();

  if (!filtered.length) {
    els.dishList.innerHTML = `<div class="empty-cart">没有找到菜品</div>`;
    return;
  }

  els.dishList.innerHTML = filtered
    .map(
      (dish) => {
        const agreed = (state.customer?.agreedNumbers || []).includes(dish.number);
        return `
      <article class="dish-card compact-dish-card ${agreed ? "agreed-dish" : ""}" data-id="${dish.id}">
        <div class="dish-body">
          <div class="dish-name-row">
            <h3 class="dish-name">${dish.name}${agreed ? `<span class="agreed-badge">已沟通</span>` : ""}</h3>
            ${getDishPriceText(dish) ? `<strong class="price">${getDishPriceText(dish)}</strong>` : ""}
          </div>
          <label class="option-row">
            <span>规格</span>
            <select data-role="spec">
              ${dish.specs.map((spec) => `<option>${spec}</option>`).join("")}
            </select>
          </label>
          <input class="custom-spec" data-role="custom-spec" type="text" placeholder="输入规格，例如 120公斤" />
          <div class="dish-action-row">
            <div class="qty-control dish-qty-control" aria-label="${dish.name} 数量">
              <button class="qty-button" type="button" data-card-dec="${dish.id}">−</button>
              <input data-role="card-qty" type="number" min="1" step="1" value="1" />
              <button class="qty-button" type="button" data-card-inc="${dish.id}">+</button>
            </div>
            <button class="add-button" type="button" data-add="${dish.id}">加入订单</button>
          </div>
        </div>
      </article>
    `;
      },
    )
    .join("");
}

function renderCart() {
  const items = [...state.cart.values()];

  if (!items.length) {
    els.cartList.innerHTML = `<div class="empty-cart">还没选色号<br />从左边挑选需要的产品</div>`;
  } else {
    els.cartList.innerHTML = items
      .map(
        (item) => `
        <div class="cart-item">
          <div class="cart-item-main">
            <div>
              <p class="cart-item-title">${item.name}</p>
              <p class="cart-item-meta">${item.spec}${item.unitPrice !== null ? ` · ${money(item.unitPrice)} / 公斤` : ""}</p>
            </div>
            <strong>${getPriceText(getLineTotal(item))}</strong>
          </div>
          <div class="cart-item-footer">
            <span>总重量 ${formatWeight(getSpecKg(item.spec) * item.qty)}</span>
            <div class="qty-control" aria-label="${item.name} 数量">
              <button class="qty-button" type="button" data-dec="${item.key}">−</button>
              <span>${item.qty}</span>
              <button class="qty-button" type="button" data-inc="${item.key}">+</button>
            </div>
          </div>
        </div>
      `,
      )
      .join("");
  }

  const stats = getCartStats();
  els.cartCount.textContent = stats.count;
  els.subtotal.textContent = `${stats.subtotal} 个`;
  els.serviceFee.textContent = formatWeight(stats.serviceFee);
  els.totalPrice.textContent = stats.total === null ? "下单后确认" : money(stats.total);
  els.submitOrder.disabled = stats.count === 0;
}

function renderSubmittedOrders() {
  if (!state.submittedOrders.length) {
    els.submittedList.innerHTML = `<div class="empty-order">提交后会在这里看到订单明细</div>`;
    return;
  }

  els.submittedList.innerHTML = state.submittedOrders
    .map(
      (order) => `
        <article class="submitted-order">
          <div class="submitted-order-head">
            <strong>${escapeHtml(order.id)}</strong>
            <span>${escapeHtml(order.tableNo)} · ${escapeHtml(formatOrderDate(order))}</span>
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
                    <strong>${getPriceText(item.lineTotal ?? null)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
          ${order.note ? `<p class="submitted-note">备注：${escapeHtml(order.note)}</p>` : ""}
          <div class="submitted-total">
            <span>总重量 ${formatWeight(order.serviceFee)}</span>
            <strong>${order.total ? money(order.total) : "下单后确认"}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function render() {
  renderCategories();
  renderDishes();
  renderFrequentDishes();
  renderCart();
  renderSubmittedOrders();
  els.onlyHot.classList.toggle("active", state.onlyHot);
}

function renderFrequentDishes() {
  const frequentNumbers = state.customer?.frequent || [];
  const frequentDishes = frequentNumbers
    .map((number) => dishes.find((dish) => dish.number === number))
    .filter(Boolean);

  if (!frequentDishes.length) {
    els.frequentSection.hidden = true;
    els.frequentList.innerHTML = "";
    return;
  }

  els.frequentSection.hidden = false;
  els.frequentList.innerHTML = frequentDishes
    .map(
      (dish) => `
        <button type="button" data-frequent-add="${dish.id}">
          <span>${escapeHtml(dish.name)}</span>
          <strong>${getPriceText(getUnitPrice(dish))}${getUnitPrice(dish) !== null ? " / 公斤" : ""}</strong>
        </button>
      `,
    )
    .join("");
}

function renderCustomerBanner() {
  if (state.customer) {
    const contactName = state.customer.contactName || state.customer.contact || "";
    const phone = state.customer.phone || "";
    els.customerBanner.innerHTML = `
      <strong>${escapeHtml(state.customer.name)}</strong>
      <span>${escapeHtml([contactName, phone].filter(Boolean).join(" ") || "专属客户价格")}</span>
      ${state.customer.address ? `<small>${escapeHtml(state.customer.address)}</small>` : ""}
    `;
    if (!els.tableNo.value) {
      els.tableNo.value = `${state.customer.name}${contactName ? ` ${contactName}` : ""}${phone ? ` ${phone}` : ""}`;
    }
    els.tableNo.closest(".table-box").hidden = true;
    els.lockedCustomer.hidden = false;
    els.lockedCustomer.innerHTML = `
      <span>下单客户</span>
      <strong>${escapeHtml(state.customer.name)}</strong>
      ${contactName ? `<small>${escapeHtml(contactName)}</small>` : ""}
      ${phone ? `<small>${escapeHtml(phone)}</small>` : ""}
      ${state.customer.address ? `<small>${escapeHtml(state.customer.address)}</small>` : ""}
    `;
    return;
  }

  els.customerBanner.innerHTML = `
    <strong>通用客户</strong>
    <span>请填写公司 / 联系方式后下单</span>
  `;
  els.tableNo.closest(".table-box").hidden = false;
  els.lockedCustomer.hidden = true;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

els.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  render();
});

els.dishList.addEventListener("change", (event) => {
  const select = event.target.closest('select[data-role="spec"]');
  if (select) {
    const card = select.closest(".dish-card");
    card.classList.toggle("has-custom-spec", select.value === "自定义");
    return;
  }

  const qtyInput = event.target.closest('[data-role="card-qty"]');
  if (!qtyInput) return;
  const value = Math.max(1, Math.floor(Number(qtyInput.value) || 1));
  qtyInput.value = value;
});

els.dishList.addEventListener("click", (event) => {
  const qtyButton = event.target.closest("[data-card-inc], [data-card-dec]");
  if (qtyButton) {
    const card = qtyButton.closest(".dish-card");
    const qtyInput = card.querySelector('[data-role="card-qty"]');
    const nextQty = Math.max(1, Math.floor(Number(qtyInput.value) || 1) + (qtyButton.dataset.cardInc ? 1 : -1));
    qtyInput.value = nextQty;
    return;
  }

  const button = event.target.closest("button[data-add]");
  if (!button) return;

  const card = button.closest(".dish-card");
  const dish = dishes.find((item) => item.id === button.dataset.add);
  const selectedSpec = card.querySelector('[data-role="spec"]').value;
  const customSpec = card.querySelector('[data-role="custom-spec"]').value.trim();
  const spec = selectedSpec === "自定义" ? customSpec : selectedSpec;

  if (!spec) {
    showToast("请先填写自定义规格");
    return;
  }

  const key = cartKey(dish.id, spec);
  const existing = state.cart.get(key);
  const unitPrice = getUnitPrice(dish);
  const qty = Math.max(1, Math.floor(Number(card.querySelector('[data-role="card-qty"]').value) || 1));

  state.cart.set(key, {
    key,
    dishId: dish.id,
    number: dish.number,
    name: dish.name,
    price: unitPrice || 0,
    unitPrice,
    spec,
    qty: existing ? existing.qty + qty : qty,
  });

  renderCart();
  showToast(`已加入订单：${dish.name} × ${qty}`);
});

els.frequentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-frequent-add]");
  if (!button) return;
  const dish = dishes.find((item) => item.id === button.dataset.frequentAdd);
  const spec = "60公斤";
  const key = cartKey(dish.id, spec);
  const existing = state.cart.get(key);
  const unitPrice = getUnitPrice(dish);

  state.cart.set(key, {
    key,
    dishId: dish.id,
    number: dish.number,
    name: dish.name,
    price: unitPrice || 0,
    unitPrice,
    spec,
    qty: existing ? existing.qty + 1 : 1,
  });

  renderCart();
  showToast(`已加入订单：${dish.name}`);
});

els.cartList.addEventListener("click", (event) => {
  const inc = event.target.closest("[data-inc]");
  const dec = event.target.closest("[data-dec]");
  const key = inc?.dataset.inc || dec?.dataset.dec;
  if (!key) return;

  const item = state.cart.get(key);
  if (!item) return;

  item.qty += inc ? 1 : -1;
  if (item.qty <= 0) {
    state.cart.delete(key);
  }

  renderCart();
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderDishes();
});

els.onlyHot.addEventListener("click", () => {
  state.onlyHot = !state.onlyHot;
  render();
});

els.clearCart.addEventListener("click", () => {
  if (!state.cart.size) return;
  state.cart.clear();
  renderCart();
  showToast("订单已清空");
});

els.submitOrder.addEventListener("click", () => {
  submitOrder();
});

async function submitOrder() {
  const { count, subtotal, serviceFee, total } = getCartStats();
  if (!count) return;

  const note = els.orderNote.value.trim();
  const tableNo = els.tableNo.value.trim() || "未填写";
  const orderPayload = {
    customerCode: state.customer?.code || state.customerCode,
    customerName: state.customer?.name || "",
    customerContactName: state.customer?.contactName || state.customer?.contact || "",
    customerPhone: state.customer?.phone || "",
    customerAddress: state.customer?.address || "",
    tableNo,
    items: [...state.cart.values()].map((item) => ({ ...item, lineTotal: getLineTotal(item) })),
    count,
    subtotal,
    serviceFee,
    total,
    note,
  };

  els.submitOrder.disabled = true;

  const order = await saveOrder(orderPayload);
  state.submittedOrders.unshift(order);
  state.cart.clear();
  els.orderNote.value = "";
  renderCart();
  renderSubmittedOrders();
  showToast(`订单已提交：${order.id}，等待老板确认`);
}

async function saveOrder(orderPayload) {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      throw new Error("Order API failed");
    }

    return await response.json();
  } catch (error) {
    return {
      ...orderPayload,
      id: `本机订单 ${String(state.submittedOrders.length + 1).padStart(2, "0")}`,
      status: "new",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
    };
  }
}

async function loadConfig() {
  try {
    const url = state.customerCode ? `/api/config?customer=${encodeURIComponent(state.customerCode)}` : "/api/config";
    const response = await fetch(url);
    if (!response.ok) return;
    const config = await response.json();
    state.settings = config.settings || state.settings;
    state.customer = config.customer || null;
    applyCustomProducts(config.products || []);
  } catch (error) {
    state.settings = { showPrices: false };
  }
}

async function init() {
  await loadConfig();
  renderCustomerBanner();
  render();
}

init();
