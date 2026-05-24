const TZ = "Asia/Kuala_Lumpur";

export function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export async function telegram(method, body) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

export async function supabase(path, options = {}) {
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

export async function getJobs() {
  const table = process.env.SUPABASE_TABLE || "jobs";
  return supabase(`${table}?select=*&order=post_due.asc.nullslast,created_at.asc`);
}

export function answer(text, jobs) {
  const q = clean(text);
  if (q === "debug" || q === "/debug") {
    return `Debug 🛠\n我读到 ${jobs.length} 行资料。\n第一行：${jobs[0] ? title(jobs[0]) : "No rows"}`;
  }
  if (q === "/start" || has(q, ["help", "可以问", "怎么问", "你会什么", "hello", "hi", "哈呀"])) return help();
  if (has(q, ["已付款", "已经付款", "已经付", "已付", "付了", "paid", "这个月付", "这个月已经付"])) return paid(jobs, q);
  if (has(q, ["钱", "收钱", "付款", "payment", "invoice", "还没付", "未付"])) return unpaid(jobs);
  if (has(q, ["brief", "link", "资料", "视频", "posting", "post link", "video link"])) return brief(jobs, q);
  if (has(q, ["今天", "today"])) return due(jobs, 0, 0, "今日优先事项 ✨");
  if (has(q, ["明天", "tomorrow"])) return due(jobs, 1, 1, "明天要注意 ✨");
  if (has(q, ["五日", "5日", "5天", "五天"])) return due(jobs, 0, 5, "5日内要注意 📌");
  if (has(q, ["这个礼拜", "这星期", "本周", "this week", "week"])) return due(jobs, 0, 7, "这个礼拜要注意 📌");
  if (has(q, ["下个礼拜", "下星期", "next week"])) return due(jobs, 8, 14, "下个礼拜要注意 🎬");
  if (has(q, ["拍", "拍摄", "shoot", "film", "需要拍"])) return shoot(jobs);
  if (has(q, ["active", "目前", "现在", "进行中", "全部", "所有", "job", "jobs", "event", "events", "活动"])) return list(jobs);
  const found = find(jobs, q);
  if (found.length) return rows("有的，我帮你找到相关 job 了 ✨", found);
  return dontKnow();
}

function list(jobs) {
  const active = jobs.filter(isActive);
  if (!active.length) return "目前没有看到 Active jobs / events ✨";
  return `目前 Active Jobs & Events ✨\n\n${active.slice(0, 12).map((j, i) => `${i + 1}. ${title(j)}${j.post_due ? `\n   ⏰ Post ${fmt(j.post_due)}` : ""}${j.notes ? `\n   Notes：${j.notes}` : ""}`).join("\n\n")}`;
}

function due(jobs, from, to, heading) {
  const items = [];
  jobs.filter(isActive).forEach((job) => {
    ["storyline_due", "draft_due", "post_due"].forEach((field) => {
      const days = diffDays(job[field]);
      if (days !== null && days >= from && days <= to) items.push({ job, field, days });
    });
  });
  items.sort((a, b) => a.days - b.days);
  if (!items.length) return `${heading}\n暂时没有看到 due，可以稍微喘口气 🫶`;
  return `${heading}\n\n${items.map((item, i) => `${i + 1}. ${title(item.job)}\n   ⏰ ${label(item.field)} ${fmt(item.job[item.field])}${item.job.notes ? `\n   备注：${item.job.notes}` : ""}`).join("\n\n")}`;
}

function unpaid(jobs) {
  const pending = jobs.filter((j) => (num(j.payment_amount) > 0 || j.is_payment) && clean(j.payment_status) !== "completed");
  if (!pending.length) return "Payment 这边看起来很干净 ✨\n暂时没有 pending payment。";
  return `还没收钱 💰\n\n${pending.map((j, i) => `${i + 1}. ${title(j)} - ${money(j)}${j.payment_notes || j.notes ? `\n   ${j.payment_notes || j.notes}` : ""}`).join("\n\n")}`;
}

function paid(jobs, q) {
  const monthOnly = has(q, ["这个月", "this month"]);
  const now = new Date();
  const paidRows = jobs.filter((j) => clean(j.payment_status) === "completed").filter((j) => {
    if (!monthOnly) return true;
    const d = dateOf(j.payday);
    const text = clean([j.payment_notes, j.notes].join(" "));
    return (d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) || has(text, ["this month", "这个月", "paid this month"]);
  });
  if (!paidRows.length) return monthOnly ? "这个月暂时没有看到已付款记录 🥺" : "暂时没有看到已付款记录 🥺";
  return `${monthOnly ? "这个月已经付款的有这些 💸✨" : "已经付款的有这些 💸✨"}\n\n${paidRows.map((j, i) => `${i + 1}. ${title(j)} - ${money(j)}${j.payday ? `\n   Payday：${fmt(j.payday)}` : ""}${j.payment_notes || j.notes ? `\n   ${j.payment_notes || j.notes}` : ""}`).join("\n\n")}`;
}

function brief(jobs, q) {
  const found = find(jobs, q);
  return found.length ? rows("找到了，这个是资料 🔗", found) : "我暂时找不到这个 brand 的资料 🥺\n可能是名字拼法跟表格不一样。";
}

function shoot(jobs) {
  const found = jobs.filter((j) => isActive(j) && has(clean(j.filming_needed || j.notes), ["yes", "shoot", "拍", "filming", "before", "after"]));
  return found.length ? rows("接下来需要拍 🎬", found) : "暂时没有看到一定要拍的 job，可以先不用紧张 🫶";
}

function rows(heading, data) {
  return `${heading}\n\n${data.slice(0, 6).map((j, i) => `${i + 1}. ${title(j)}${j.deliverables ? `\n   Deliverables：${j.deliverables}` : ""}${j.brief_url ? `\n   Brief：${j.brief_url}` : ""}${j.brief_text ? `\n   Brief notes：${j.brief_text}` : ""}${j.posting_link || j.video_link ? `\n   Post/Video：${j.posting_link || j.video_link}` : ""}${j.notes ? `\n   Notes：${j.notes}` : ""}`).join("\n\n")}`;
}

function find(jobs, q) {
  const words = clean(q)
    .replace(/brief|link|资料|是什么|有什么|可以发我吗|可以发吗|发我|给我|的|目前|现在|active|job|event/g, "")
    .split(" ")
    .filter((w) => w.length > 1);
  return jobs.filter((j) => words.some((w) => clean([j.brand, j.campaign, j.content_type, j.deliverables, j.notes, j.brief_url, j.brief_text, j.posting_link, j.video_link].join(" ")).includes(w)));
}

function help() {
  return "我在这里呀 Coco 🫶\n你可以问：\n✨ 今天/这个礼拜要做什么\n📌 目前 active jobs/event\n🎬 下个礼拜要拍什么\n💰 还有什么没收钱\n🔗 Kiehl's brief 是什么";
}

function dontKnow() {
  return "我有点没抓到这个问题 🥺\n你可以换一种问法，例如：\n\n✨ 目前 active jobs\n📌 这个礼拜有什么 due\n🎬 下个礼拜要拍什么\n💰 还有什么没收钱\n🔗 Kiehl's brief 是什么";
}

function title(j) {
  return [j.brand, j.campaign].filter(Boolean).join(" - ") || "Untitled";
}

function clean(v) {
  return String(v || "").toLowerCase().replace(/kiehl['’]?s/g, "kiehls").replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim();
}
function has(s, arr) { return arr.some((x) => s.includes(clean(x))); }
function isActive(j) { return clean(j.status || "active") === "active" && j.completed !== true; }
function num(v) { return Number(String(v || "").replace(/[^0-9.]/g, "")) || 0; }
function money(j) {
  const amount = num(j.payment_amount);
  const text = String([j.payment_currency, j.payment_notes, j.notes].join(" ")).toUpperCase();
  const currency = text.includes("USD") ? "USD" : (j.payment_currency || "RM");
  return amount ? `${currency} ${amount.toLocaleString("en-MY")}` : "金额待确认";
}
function dateOf(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v)) return v;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function diffDays(v) {
  const d = dateOf(v);
  if (!d) return null;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86400000);
}
function fmt(v) {
  const d = dateOf(v);
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : "TBC";
}
function label(field) {
  return { storyline_due: "Storyline", draft_due: "Draft", post_due: "Post" }[field] || field;
}
