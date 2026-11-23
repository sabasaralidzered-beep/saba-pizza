"use strict";

/* Everything a client changes per project lives in these lists. */
const BRAND = { currency: "₾", delivery: 5, bakeSeconds: 90, bakeMs: 3400, distanceKm: 4.2 };

const DOUGHS = [
  { id: "classic",  name: "Classic Sourdough", price: 14, note: "48 hours, golden, airy" },
  { id: "charcoal", name: "Black Charcoal",    price: 16, note: "Dark, crisp, a little dramatic" },
];

const INGREDIENTS = [
  { id: "sauce",     name: "San Marzano",   price: 2, kind: "layer" },
  { id: "cheese",    name: "Mozzarella",    price: 4, kind: "layer" },
  { id: "pepperoni", name: "Pepperoni",     price: 5, count: 14, size: 12.5 },
  { id: "mushroom",  name: "Mushroom",      price: 3, count: 12, size: 10.5 },
  { id: "basil",     name: "Basil",         price: 2, count: 8,  size: 11 },
  { id: "olive",     name: "Olives",        price: 3, count: 14, size: 6.5 },
  { id: "onion",     name: "Red onion",     price: 2, count: 10, size: 10 },
  { id: "pepper",    name: "Yellow pepper", price: 3, count: 12, size: 10 },
];

const RIDE_STOPS = [
  "Out of the oven, into the night.",
  "The long way round. Good pizza deserves a view.",
  "Door. Still hot.",
];

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const money = (n) => `${BRAND.currency}${n.toFixed(2)}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));
const asset = (name) => `assets/${name}.webp`;
const byId = (id) => INGREDIENTS.find((item) => item.id === id);
const pageStart = Date.now();

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- State ---------- */

const state = { stage: "intro", dough: null, chosen: [], orderNo: 0, busy: false, placed: {}, people: 2, eaten: 0, finalImage: "" };

function setStage(stage) {
  state.stage = stage;
  document.body.dataset.stage = stage;
  $("doughs").inert = stage !== "dough";
  $("trays").inert = stage !== "build";
  $("cardIntro").inert = stage !== "intro";
  $("cardTicket").inert = stage === "intro" || stage === "done";
  $("cardDone").inert = stage !== "done";
}

const doughItem = () => DOUGHS.find((d) => d.id === state.dough);
const orderTotal = () => state.chosen.reduce((sum, id) => sum + byId(id).price, (doughItem() || DOUGHS[0]).price) + BRAND.delivery;

function renderOrder() {
  const lines = $("lines");
  const wanted = [...(doughItem() ? [doughItem()] : []), ...state.chosen.map(byId)];
  [...lines.children].forEach((li) => { if (!wanted.some((w) => w.id === li.dataset.key)) li.remove(); });
  for (const entry of wanted) {
    if (lines.querySelector(`[data-key="${entry.id}"]`)) continue;
    const li = document.createElement("li");
    li.dataset.key = entry.id;
    const name = document.createElement("span");
    const price = document.createElement("span");
    name.textContent = entry.name;
    price.textContent = money(entry.price);
    li.append(name, price);
    if (DOUGHS.includes(entry)) lines.prepend(li);
    else lines.append(li);
  }
  const total = money(orderTotal());
  $("pillTotal").textContent = total;
  $("total").textContent = total;
  $("bake").disabled = !state.dough || state.stage === "baking";
  document.querySelectorAll(".tray").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.chosen.includes(button.dataset.id)));
  });
  document.querySelectorAll(".dough-card").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.id === state.dough));
  });
}

/* ---------- Dough and toppings ---------- */

function chooseDough(id) {
  const changed = state.dough !== id;
  state.dough = id;
  const dough = $("dough");
  dough.src = asset(`dough-${id}`);
  dough.hidden = false;
  if (changed && !reducedMotion) {
    dough.animate(
      [{ transform: "scale(1.22) rotate(-14deg)", opacity: 0 }, { transform: "scale(.97)", opacity: 1, offset: 0.75 }, { transform: "none", opacity: 1 }],
      { duration: 520, easing: "cubic-bezier(.3,.7,.3,1)" }
    );
    flourPuff(10);
  }
  renderOrder();
  setTimeout(() => { if (state.stage === "dough") setStage("build"); }, reducedMotion ? 0 : 620);
}

/* Rejection sampling, so one topping never piles onto itself. */
function scatter(item, seed) {
  const rand = seededRandom(seed);
  const points = [];
  const maxRadius = 33 - item.size / 3;
  for (let tries = 0; tries < 900 && points.length < item.count; tries++) {
    const a = rand() * Math.PI * 2, d = maxRadius * Math.sqrt(rand());
    const x = 50 + Math.cos(a) * d, y = 50 + Math.sin(a) * d;
    if (points.every((p) => Math.hypot(p.x - x, p.y - y) > item.size * 0.92)) {
      points.push({ x, y, angle: rand() * 360, variant: Math.floor(rand() * 3) });
    }
  }
  return points;
}

function addTopping(item) {
  const points = scatter(item, item.id.length * 97 + state.orderNo);
  state.placed[item.id] = points;
  const group = document.createElement("div");
  group.dataset.id = item.id;
  points.forEach((p, i) => {
    const piece = document.createElement("img");
    const turn = `rotate(${p.angle.toFixed(0)}deg)`;
    piece.src = asset(`t-${item.id}-${p.variant}`);
    piece.alt = "";
    piece.style.cssText = `left:${p.x}%;top:${p.y}%;width:${item.size}%;transform:translate(-50%,-50%) ${turn}`;
    group.append(piece);
    if (reducedMotion) return;
    piece.animate(
      [
        { transform: `translate(-50%,-50%) ${turn} translateY(-90px) scale(1.7)`, opacity: 0 },
        { transform: `translate(-50%,-50%) ${turn} scale(.93)`, opacity: 1, offset: 0.78 },
        { transform: `translate(-50%,-50%) ${turn} scale(1)`, opacity: 1 },
      ],
      { duration: 360, delay: i * 34, easing: "cubic-bezier(.4,0,.7,1)", fill: "backwards" }
    );
  });
  $("toppings").append(group);
}

function removeTopping(id) {
  delete state.placed[id];
  const group = $("toppings").querySelector(`[data-id="${id}"]`);
  if (!group) return;
  group.style.transition = "opacity .22s";
  group.style.opacity = 0;
  setTimeout(() => group.remove(), 240);
}

function toggle(id) {
  if (state.stage !== "build") return;
  const item = byId(id);
  const removing = state.chosen.includes(id);
  state.chosen = removing ? state.chosen.filter((x) => x !== id) : [...state.chosen, id];
  if (item.kind === "layer") $(id).classList.toggle("on", !removing);
  else if (removing) removeTopping(id);
  else addTopping(item);
  renderOrder();
}

function buildPickers() {
  for (const dough of DOUGHS) {
    const button = document.createElement("button");
    button.className = "dough-card";
    button.type = "button";
    button.dataset.id = dough.id;
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<img src="${asset(`dough-${dough.id}`)}" alt=""><span><b>${dough.name}</b><small>${dough.note}</small><i>${money(dough.price)}</i></span>`;
    button.addEventListener("click", () => chooseDough(dough.id));
    $("doughGrid").append(button);
  }
  for (const item of INGREDIENTS) {
    const button = document.createElement("button");
    button.className = `tray tray-${item.id}`;
    button.type = "button";
    button.dataset.id = item.id;
    button.setAttribute("aria-pressed", "false");

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    if (item.kind !== "layer") {
      const rand = seededRandom(item.id.length * 13);
      for (let i = 0; i < 7; i++) {
        const piece = document.createElement("img");
        piece.src = asset(`t-${item.id}-${i % 3}`);
        piece.alt = "";
        piece.style.cssText = `left:${6 + (i % 4) * 23 + rand() * 6}%;top:${6 + (i % 2) * 40 + rand() * 10}%;transform:rotate(${(rand() * 360).toFixed(0)}deg)`;
        swatch.append(piece);
      }
    }
    const label = document.createElement("span");
    label.innerHTML = `<i>${item.name}</i><i>+${BRAND.currency}${item.price}</i>`;
    button.append(swatch, label);
    button.addEventListener("click", () => toggle(item.id));
    $("trayGrid").append(button);
  }
}

/* ---------- Order flow ---------- */

function flourPuff(amount = 26) {
  if (reducedMotion) return;
  const box = $("box").getBoundingClientRect();
  for (let i = 0; i < amount; i++) {
    const dot = document.createElement("i");
    const size = 8 + Math.random() * 30;
    const edge = Math.random() * Math.PI * 2;
    Object.assign(dot.style, {
      position: "fixed", zIndex: 4, pointerEvents: "none", borderRadius: "50%", width: `${size}px`, height: `${size}px`,
      left: `${box.left + box.width / 2 + Math.cos(edge) * box.width * 0.5}px`,
      top: `${box.top + box.height / 2 + Math.sin(edge) * box.height * 0.5}px`,
      background: "radial-gradient(circle, rgba(255,250,240,.8), transparent 70%)",
    });
    document.body.append(dot);
    dot.animate(
      [{ transform: "scale(.4)", opacity: 0.9 }, { transform: `translate(${Math.cos(edge) * 80}px, ${Math.sin(edge) * 80}px) scale(1.8)`, opacity: 0 }],
      { duration: 800 + Math.random() * 500, easing: "ease-out" }
    ).onfinish = () => dot.remove();
  }
}

function newOrderNumber() {
  state.orderNo = 1000 + Math.floor(Math.random() * 9000);
  for (const id of ["orderNo", "stampNo", "rideOrder"]) $(id).textContent = `#${state.orderNo}`;
}

function openBox() {
  if (state.stage !== "intro") return;
  $("box").classList.add("is-open");
  flourPuff();
  setStage("dough");
  renderOrder();
}

async function surpriseMe() {
  if (state.busy || state.stage !== "build") return;
  state.busy = true;
  for (const id of [...state.chosen]) toggle(id);
  await wait(260);
  const extras = INGREDIENTS.filter((item) => item.kind !== "layer").sort(() => Math.random() - 0.5).slice(0, 3);
  for (const item of [byId("sauce"), byId("cheese"), ...extras]) {
    if (!state.busy || state.stage !== "build") break;
    toggle(item.id);
    await wait(item.kind === "layer" ? 720 : 620);
  }
  state.busy = false;
}

function spinTimer() {
  const text = $("timerText"), hand = $("hand");
  if (reducedMotion) { text.textContent = "0s"; return; }
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - started) / BRAND.bakeMs, 1);
    hand.style.transform = `rotate(${progress * 360}deg)`;
    text.textContent = `${Math.ceil((1 - progress) * BRAND.bakeSeconds)}s`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function arrivalWindow() {
  const format = (date) => date.toTimeString().slice(0, 5);
  const now = Date.now();
  return `${format(new Date(now + 25 * 60000))} – ${format(new Date(now + 40 * 60000))}`;
}

async function bake() {
  if (state.stage !== "build" || !state.dough) return;
  state.busy = false;
  setStage("baking");
  renderOrder();
  $("bake").textContent = "In the oven…";
  spinTimer();
  await wait(BRAND.bakeMs * 0.4);
  const pizza = $("pizza");
  pizza.classList.toggle("has-cheese", state.chosen.includes("cheese"));
  pizza.classList.toggle("is-classic", state.dough === "classic");
  pizza.classList.add("is-baked");
  await wait(BRAND.bakeMs * 0.6);
  $("eta").textContent = arrivalWindow();
  $("box").classList.remove("is-open");
  setStage("done");
  await wait(960);
  $("stamp").classList.add("on");
  await unlockJourney();
}

function reset() {
  document.documentElement.classList.remove("unlocked");
  $("journey").hidden = true;
  scrollTo({ top: 0, behavior: "instant" });
  $("stamp").classList.remove("on");
  $("pizza").classList.remove("is-baked", "has-cheese", "is-classic");
  $("sauce").classList.remove("on");
  $("cheese").classList.remove("on");
  $("dough").hidden = true;
  $("toppings").replaceChildren();
  Object.assign(state, { dough: null, chosen: [], placed: {}, people: 2, eaten: 0 });
  $("bake").textContent = "Bake this pizza";
  newOrderNumber();
  setStage("intro");
  renderOrder();
}

/* ---------- Part two: the ride ---------- */

function setRide(progress) {
  const photos = document.querySelectorAll(".scene-photo");
  const stop = Math.min(Math.floor(progress * photos.length), photos.length - 1);
  photos.forEach((photo, i) => {
    const local = progress * photos.length - i;
    const fade = Math.max(0, Math.min(1, 1.12 - Math.abs(local - 0.5) * 2.1));
    const held = (i === 0 && local < 0.5) || (i === photos.length - 1 && local > 0.5);
    photo.style.opacity = held ? 1 : fade;
    photo.style.transform = `scale(1.1) translateX(${(0.5 - local) * 3}%)`;
  });
  $("rideStep").textContent = `Stop ${stop + 1} of ${photos.length}`;
  $("rideTitle").textContent = RIDE_STOPS[stop];
  $("rideKm").textContent = `${(BRAND.distanceKm * (1 - progress)).toFixed(1)} km`;
  $("rideTemp").textContent = `${Math.round(82 - progress * 6)}°C`;
  $("rideBar").style.width = `${progress * 100}%`;
  $("lane").style.backgroundPositionX = `${-progress * 5200}px`;
  const scooterX = 8 + Math.min(progress / 0.9, 1) * 44;
  $("scooter").style.transform = `translate(${scooterX}vw, ${Math.sin(progress * 180) * 2.4}px)`;
  for (const [id, cx] of [["wheelBack", 88], ["wheelFront", 240]]) {
    $(id).setAttribute("transform", `rotate(${progress * 3200} ${cx} 172)`);
  }
}

function watchRide() {
  const ride = $("ride");
  let queued = false;
  const update = () => {
    queued = false;
    const rect = ride.getBoundingClientRect();
    setRide(Math.max(0, Math.min(1, -rect.top / (rect.height - innerHeight))));
  };
  addEventListener("scroll", () => {
    if (queued || $("journey").hidden) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
}

/* ---------- Part two: the table ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/* Paints the finished pizza into one picture, so slices can be cut from it. */
async function paintFinalPizza() {
  const size = 900;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const layers = [asset(`dough-${state.dough}`)];
  if (state.dough === "classic") layers.push(asset("baked-crust"));
  if (state.chosen.includes("sauce")) layers.push(asset("sauce"));
  if (state.chosen.includes("cheese")) layers.push(asset("baked-cheese"));
  for (const image of await Promise.all(layers.map(loadImage))) ctx.drawImage(image, 0, 0, size, size);

  for (const [id, points] of Object.entries(state.placed)) {
    const width = (byId(id).size / 100) * size;
    for (const p of points) {
      const image = await loadImage(asset(`t-${id}-${p.variant}`));
      ctx.save();
      ctx.translate((p.x / 100) * size, (p.y / 100) * size);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.drawImage(image, -width / 2, -(width * image.height) / image.width / 2, width, (width * image.height) / image.width);
      ctx.restore();
    }
  }
  return canvas.toDataURL("image/webp", 0.86);
}

function wedgePath(from, to) {
  const points = ["50% 50%"];
  for (let i = 0; i <= 14; i++) {
    const angle = from + ((to - from) * i) / 14;
    points.push(`${(50 + Math.cos(angle) * 72).toFixed(2)}% ${(50 + Math.sin(angle) * 72).toFixed(2)}%`);
  }
  return `polygon(${points.join(",")})`;
}

function cutPizza() {
  const plate = $("plate");
  const count = Math.max(4, Math.min(12, state.people * 2));
  state.eaten = 0;
  plate.classList.remove("cut");
  plate.replaceChildren();
  for (let i = 0; i < count; i++) {
    const from = -Math.PI / 2 + (i / count) * Math.PI * 2;
    const to = from + (Math.PI * 2) / count;
    const middle = (from + to) / 2;
    const slice = document.createElement("button");
    slice.type = "button";
    slice.className = "slice";
    slice.setAttribute("aria-label", `Slice ${i + 1}`);
    slice.style.cssText = `clip-path:${wedgePath(from, to)};background-image:url(${state.finalImage});--x:${(Math.cos(middle) * 1.5).toFixed(2)}%;--y:${(Math.sin(middle) * 1.5).toFixed(2)}%;--lx:${(Math.cos(middle) * 6).toFixed(2)}%;--ly:${(Math.sin(middle) * 6).toFixed(2)}%`;
    slice.addEventListener("click", () => eatSlice(slice, count));
    plate.append(slice);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => plate.classList.add("cut")));
  $("people").textContent = state.people;
  $("each").textContent = money(orderTotal() / state.people);
  $("eatNote").textContent = "Tap a slice to eat it.";
}

function eatSlice(slice, count) {
  slice.classList.add("eaten");
  slice.disabled = true;
  state.eaten += 1;
  const left = count - state.eaten;
  if (left === 0) $("eatNote").textContent = "All gone. Nobody saw who had the last one.";
  else if (left === 1) $("eatNote").textContent = "One left. Everyone is being polite.";
  else $("eatNote").textContent = `${left} slices left.`;
}

function changePeople(step) {
  const next = Math.max(1, Math.min(8, state.people + step));
  if (next === state.people) return;
  state.people = next;
  cutPizza();
}

/* ---------- Part two: the pitch ---------- */

function watchPitch() {
  new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    const seconds = Math.round((Date.now() - pageStart) / 1000);
    const minutes = Math.floor(seconds / 60);
    const parts = [];
    if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
    if (seconds % 60 || !minutes) parts.push(`${seconds % 60} seconds`);
    $("played").textContent = parts.join(" and ");
  }, { threshold: 0.4 }).observe($("pitch"));
}

async function unlockJourney() {
  state.finalImage = await paintFinalPizza();
  $("journey").hidden = false;
  document.documentElement.classList.add("unlocked");
  setRide(0);
  cutPizza();
}

/* ---------- Slice cursor, only where a real mouse exists ---------- */

function enableCursor() {
  if (!matchMedia("(pointer: fine)").matches) return;
  const cursor = $("cursor");
  addEventListener("pointermove", (event) => {
    document.documentElement.classList.add("custom-cursor");
    cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    cursor.classList.toggle("hot", !!event.target.closest("button, a"));
  }, { passive: true });
}

/* ---------- Start ---------- */

buildPickers();
newOrderNumber();
renderOrder();
setStage("intro");
enableCursor();
watchRide();
watchPitch();

for (let i = 0; i < 12; i++) {
  const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
  tick.setAttribute("x1", 100); tick.setAttribute("y1", 26);
  tick.setAttribute("x2", 100); tick.setAttribute("y2", 36);
  tick.setAttribute("stroke", "#1f5a3c");
  tick.setAttribute("stroke-width", 4);
  tick.setAttribute("transform", `rotate(${i * 30} 100 100)`);
  $("ticks").append(tick);
}

$("lid").addEventListener("click", openBox);
$("start").addEventListener("click", openBox);
$("bake").addEventListener("click", bake);
$("again").addEventListener("click", reset);
$("againBottom").addEventListener("click", reset);
$("surprise").addEventListener("click", surpriseMe);
$("swapDough").addEventListener("click", () => { if (state.stage === "build") setStage("dough"); });
$("fewer").addEventListener("click", () => changePeople(-1));
$("more").addEventListener("click", () => changePeople(1));
$("pill").addEventListener("click", () => { if (state.stage === "intro") openBox(); });
$("follow").addEventListener("click", () => $("ride").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }));
document.querySelector(".logo").addEventListener("click", (event) => { event.preventDefault(); if (state.stage === "done") reset(); });
