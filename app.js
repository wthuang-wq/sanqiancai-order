const categories = ["全部", "黄色系", "红色系", "紫色系", "橙色系", "蓝色系", "黑色系"];
const packageOptions = ["样卡", "1kg", "5kg", "25kg"];

const dishes = [
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
].map(([id, color, number, category, hex, deep, type, washing, rubbing, sublimation, light, hot]) => ({
  id,
  name: `${color} ${number}`,
  color,
  number,
  category,
  price: 0,
  hot,
  icon: number,
  gradient: `linear-gradient(135deg, ${hex}, ${hex})`,
  desc: `染色深度 ${deep} · 类型 ${type} · 牢度：洗涤 ${washing}，摩擦 ${rubbing}，升华/180度 ${sublimation}，日晒 ${light}`,
  specs: packageOptions,
  spice: [deep],
  deep,
  type,
  fastness: { washing, rubbing, sublimation, light },
}));

const state = {
  category: "全部",
  query: "",
  onlyHot: false,
  cart: new Map(),
  submittedOrders: [],
};

const els = {
  categoryTabs: document.querySelector("#categoryTabs"),
  dishList: document.querySelector("#dishList"),
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
  return `¥${value.toFixed(value % 1 ? 1 : 0)}`;
}

function cartKey(dishId, spec, spice) {
  return `${dishId}__${spec}__${spice}`;
}

function getCartStats() {
  let count = 0;

  state.cart.forEach((item) => {
    count += item.qty;
  });

  return { count, subtotal: state.cart.size, serviceFee: count, total: 0 };
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
  return dishes.filter((dish) => {
    const matchesCategory = state.category === "全部" || dish.category === state.category;
    const matchesQuery =
      dish.name.includes(state.query) ||
      dish.number.toLowerCase().includes(state.query.toLowerCase()) ||
      dish.type.toLowerCase().includes(state.query.toLowerCase()) ||
      dish.desc.includes(state.query);
    const matchesHot = !state.onlyHot || dish.hot;
    return matchesCategory && matchesQuery && matchesHot;
  });
}

function renderDishes() {
  const filtered = getFilteredDishes();

  if (!filtered.length) {
    els.dishList.innerHTML = `<div class="empty-cart">没有找到菜品</div>`;
    return;
  }

  els.dishList.innerHTML = filtered
    .map(
      (dish) => `
      <article class="dish-card" data-id="${dish.id}">
        <div class="dish-photo" style="--photo: ${dish.gradient}">
          ${dish.hot ? '<strong class="tag">推荐</strong>' : ""}
          <span>${dish.icon}</span>
        </div>
        <div class="dish-body">
          <div class="dish-name-row">
            <h3 class="dish-name">${dish.name}</h3>
            <strong class="price">询价</strong>
          </div>
          <p class="dish-desc">${dish.desc}</p>
          <label class="option-row">
            <span>包装</span>
            <select data-role="spec">
              ${dish.specs.map((spec) => `<option>${spec}</option>`).join("")}
            </select>
          </label>
          <label class="option-row">
            <span>深度</span>
            <select data-role="spice">
              ${dish.spice.map((spice) => `<option>${spice}</option>`).join("")}
            </select>
          </label>
          <div class="dish-action-row">
            <span>${dish.category}</span>
            <button class="add-button" type="button" data-add="${dish.id}">加入询价</button>
          </div>
        </div>
      </article>
    `,
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
              <p class="cart-item-meta">${item.spec} · ${item.spice}</p>
            </div>
            <strong>询价</strong>
          </div>
          <div class="cart-item-footer">
            <span>${item.qty} 份需求</span>
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
  els.serviceFee.textContent = `${stats.serviceFee} 份`;
  els.totalPrice.textContent = stats.count ? "待确认" : "待确认";
  els.submitOrder.disabled = stats.count === 0;
}

function renderSubmittedOrders() {
  if (!state.submittedOrders.length) {
    els.submittedList.innerHTML = `<div class="empty-order">提交后会在这里看到询价明细</div>`;
    return;
  }

  els.submittedList.innerHTML = state.submittedOrders
    .map(
      (order) => `
        <article class="submitted-order">
          <div class="submitted-order-head">
            <strong>${escapeHtml(order.id)}</strong>
            <span>${escapeHtml(order.tableNo)} · ${escapeHtml(order.time)}</span>
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
        </article>
      `,
    )
    .join("");
}

function render() {
  renderCategories();
  renderDishes();
  renderCart();
  renderSubmittedOrders();
  els.onlyHot.classList.toggle("active", state.onlyHot);
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

els.dishList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-add]");
  if (!button) return;

  const card = button.closest(".dish-card");
  const dish = dishes.find((item) => item.id === button.dataset.add);
  const spec = card.querySelector('[data-role="spec"]').value;
  const spice = card.querySelector('[data-role="spice"]').value;
  const key = cartKey(dish.id, spec, spice);
  const existing = state.cart.get(key);

  state.cart.set(key, {
    key,
    dishId: dish.id,
    name: dish.name,
    price: dish.price,
    spec,
    spice,
    qty: existing ? existing.qty + 1 : 1,
  });

  renderCart();
  showToast(`已加入询价：${dish.name}`);
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
  showToast("询价单已清空");
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
    tableNo,
    items: [...state.cart.values()].map((item) => ({ ...item })),
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
  showToast(`提交成功：${count} 份需求${note ? "，已备注" : ""}`);
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
      id: `本机询价 ${String(state.submittedOrders.length + 1).padStart(2, "0")}`,
      status: "new",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
    };
  }
}

render();
