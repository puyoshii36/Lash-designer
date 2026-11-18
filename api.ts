import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "tatiane_admin_token";
export const ADMIN_EMAIL_KEY = "tatiane_admin_email";

// SUBSTITUA PELAS CHAVES DO NOVO PROJETO SUPABASE DA TATIANE
const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "SUA-ANON-KEY-AQUI";

const supabaseHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  ...extra,
});

const getCleanSupabaseUrl = () =>
  SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

export async function uploadPortfolioImage(file: File): Promise<string> {
  const cleanUrl = getCleanSupabaseUrl();
  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt || "jpg";
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await fetch(`${cleanUrl}/storage/v1/object/portfolio/${fileName}`, {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": file.type || "image/jpeg",
    }),
    body: file,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ApiError(`Erro ao enviar imagem (${res.status}). ${errText}`.trim(), res.status);
  }

  return `${cleanUrl}/storage/v1/object/public/portfolio/${fileName}`;
}

export type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  description: string;
  price_note: string;
  order: number;
  active: boolean;
};

export type PortfolioPhoto = {
  id: string;
  url: string;
  title: string;
  category?: string;
};

export type BioData = {
  id?: string;
  title: string;
  body: string;
};

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export type Booking = {
  id: string;
  service_id: string;
  service_name: string;
  price: number;
  extra_fee?: number;
  price_note: string;
  duration: number;
  date: string;
  start: string;
  end: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  status: "confirmed" | "cancelled";
  created_at: string;
  deposit_percent: number;
  deposit_amount: number;
  payment_status: PaymentStatus;
  payment_id: string;
  payment_method: string;
  paid_at: string;
};

export type DayInfo = {
  date: string;
  weekday: number;
  available: boolean;
  reason: string;
  holiday: string;
  isChristmasSchedule?: boolean;
};

export type Slot = {
  time: string;
  available: boolean;
  isVip?: boolean;
  extraFee?: number;
  label?: string;
};

export type Block = {
  id: string;
  date: string;
  start: string | null;
  end: string | null;
  reason: string;
};

export type Settings = {
  whatsapp: string;
  booking_link: string;
  instagram: string;
  deposit_percent: number;
  vip_slot_fee: number;
  payments_enabled: boolean;
};

export type AdminSettings = Settings & {
  infinitepay_handle: string;
  infinitepay_api_key_hint: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const INITIAL_SERVICES: Service[] = [
  {
    id: "1",
    name: "Aplicação Volume Brasileiro",
    category: "Extensão",
    price: 150,
    duration: 150,
    description: "Fios em formato Y que garantem volume marcante e retenção prolongada.",
    price_note: "",
    order: 1,
    active: true,
  },
  {
    id: "2",
    name: "Aplicação Fox Eyes / Efeito Delineado",
    category: "Extensão",
    price: 170,
    duration: 150,
    description: "Alongamento estratégico no canto externo para um olhar felino e sofisticado.",
    price_note: "",
    order: 2,
    active: true,
  },
  {
    id: "3",
    name: "Manutenção (até 21 dias)",
    category: "Manutenção",
    price: 100,
    duration: 150,
    description: "Reposição e higienização dos fios para manter sua extensão impecável.",
    price_note: "",
    order: 3,
    active: true,
  },
];

export const INITIAL_BIO: BioData = {
  id: "main",
  title: "Realçar o seu olhar não é mudar quem você é,\né revelar a beleza que já existe em você.",
  body: "Especialista em Extensão de Cílios, Volume Brasileiro, Fox Eyes e Lash Lifting. Escolha o seu procedimento e reserve o melhor horário para você.",
};

// VERIFICA SE ESTÁ NA AGENDA DE NATAL (A PARTIR DE 19/12)
function isChristmasScheduleDate(dateStr: string): boolean {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [, mm, dd] = parts;
  return mm === 12 && dd >= 19;
}

// FERIADOS FECHADOS
function getClosedDateReason(mm: number, dd: number): string | null {
  const key = `${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  if (key === "12-24") return "Véspera de Natal (sem atendimento)";
  if (key === "12-25") return "Natal (sem atendimento)";
  if (key === "12-31") return "Véspera de Ano Novo (sem atendimento)";
  if (key === "01-01") return "Ano Novo (sem atendimento)";
  return null;
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutesToAdd;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

// HORÁRIOS REGULARES (09:00 ÀS 21:00 COM ALMOÇO 13:40-14:40 E DURAÇÃO DE 2H30)
const REGULAR_SLOTS = ["09:00", "14:40", "17:30"];

// HORÁRIOS FIXOS DA AGENDA DE NATAL (A PARTIR DE 19/12)
const CHRISTMAS_SLOTS = ["09:00", "11:20", "14:40", "17:00", "19:20", "21:00"];

async function fetchSettingsFromDb(): Promise<AdminSettings> {
  const fallback: AdminSettings = {
    whatsapp: "11999999999",
    booking_link: typeof window !== "undefined" ? window.location.origin : "",
    instagram: "@tatianenovais.lash",
    deposit_percent: 40,
    vip_slot_fee: 30,
    payments_enabled: false,
    infinitepay_handle: "",
    infinitepay_api_key_hint: "",
  };
  try {
    const res = await fetch(`${getCleanSupabaseUrl()}/rest/v1/settings?id=eq.main&select=*`, {
      headers: supabaseHeaders(),
    });
    if (!res.ok) return fallback;
    const rows = await res.json();
    return rows[0] ? { ...fallback, ...rows[0] } : fallback;
  } catch {
    return fallback;
  }
}

async function fetchBlocksFromDb(): Promise<Block[]> {
  try {
    const res = await fetch(`${getCleanSupabaseUrl()}/rest/v1/blocks?select=*&order=date.asc`, {
      headers: supabaseHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchBookingsFromDb(dateFilter?: string): Promise<Booking[]> {
  try {
    const query = dateFilter ? `date=eq.${dateFilter}&` : "";
    const res = await fetch(
      `${getCleanSupabaseUrl()}/rest/v1/bookings?${query}select=*&order=created_at.desc`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function generateDaysWithBlocks(): Promise<DayInfo[]> {
  const blocks = await fetchBlocksFromDb();
  const days: DayInfo[] = [];
  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const dateStr = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const weekday = d.getDay();

    const closedReason = getClosedDateReason(mm, dd);
    const dayBlock = blocks.find((b) => b.date === dateStr && !b.start && !b.end);

    let available = true;
    let reason = "";

    if (closedReason) {
      available = false;
      reason = closedReason;
    } else if (dayBlock) {
      available = false;
      reason = dayBlock.reason || "Agenda fechada";
    }

    days.push({
      date: dateStr,
      weekday,
      available,
      reason,
      holiday: closedReason || "",
      isChristmasSchedule: isChristmasScheduleDate(dateStr),
    });
  }
  return days;
}

async function getSlotsForDate(dateStr: string): Promise<Slot[]> {
  const [blocks, bookings, settings] = await Promise.all([
    fetchBlocksFromDb(),
    fetchBookingsFromDb(dateStr),
    fetchSettingsFromDb(),
  ]);

  const isChristmas = isChristmasScheduleDate(dateStr);
  const shifts = isChristmas ? CHRISTMAS_SLOTS : REGULAR_SLOTS;
  const vipFee = Number(settings.vip_slot_fee ?? 30);

  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && getClosedDateReason(parts[1], parts[2])) {
    return shifts.map((time) => ({ time, available: false }));
  }

  return shifts.map((time) => {
    const hasBooking = bookings.some(
      (b) => b.date === dateStr && b.start === time && b.status !== "cancelled"
    );

    const hasBlock = blocks.some((blk) => {
      if (blk.date !== dateStr) return false;
      if (!blk.start && !blk.end) return true;
      return Boolean(blk.start && time === blk.start);
    });

    const isVip = isChristmas && time === "21:00";

    return {
      time,
      available: !hasBooking && !hasBlock,
      isVip,
      extraFee: isVip ? vipFee : 0,
      label: isVip ? `21:00 (Horário Especial +R$ ${vipFee},00)` : time,
    };
  });
}

function mapServiceRow(row: any): Service {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    category: String(row.category || "Extensão"),
    price: Number(row.price ?? 0),
    duration: Number(row.duration ?? 150),
    description: String(row.description || ""),
    price_note: String(row.price_note || ""),
    order: Number(row.sort_order ?? row.order ?? 0),
    active: row.active !== undefined ? Boolean(row.active) : true,
  };
}

async function fetchServices(onlyActive: boolean): Promise<Service[]> {
  const filter = onlyActive ? "active=eq.true&" : "";
const url = ${getCleanSupabaseUrl()}/rest/v1/services?${filter}select=*&order=sort_order.asc,created_at.asc;
const res = await fetch(url, { headers: supabaseHeaders() });
if (!res.ok) throw new Error("Erro ao buscar serviços");
const rows = (await res.json()) as any[];
return rows.map(mapServiceRow);
}
export const whatsappUrl = (number: string, text: string) => {
const digits = number.replace(/\D/g, "");
const full = digits && digits.length <= 11 ? 55${digits} : digits;
return https://wa.me{full}?text=${encodeURIComponent(text)};
};
type ApiOpts = { method?: string; body?: any; auth?: boolean };
export async function api(path: string, opts: ApiOpts = {}): Promise {
const method = opts.method ?? "GET";
const cleanUrl = getCleanSupabaseUrl();
// --- TRAVA DE SEGURANÇA /admin ---
if (path.startsWith("/admin") && path !== "/auth/login") {
const token = await storage.secureGet(TOKEN_KEY, "");
if (!token || token !== "token_auth_tatiane_logada") {
throw new ApiError("Acesso restrito. Faça login para continuar.", 401);
}
}
// --- 1. AUTENTICAÇÃO ---
if (path === "/auth/login" && method === "POST") {
const body = typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body || {};
const email = (body.email || body.username || "").trim().toLowerCase();
const password = (body.password || "").trim();
if (email !== "tatiane@lash.com" || password !== "Tatiane2026#") {
throw new ApiError("E-mail ou senha incorretos.", 401);
}
const token = "token_auth_tatiane_logada";
await storage.secureSet(TOKEN_KEY, token);
await storage.secureSet(ADMIN_EMAIL_KEY, "tatiane@lash.com");
return {
access_token: token,
token_type: "bearer",
user: { email: "tatiane@lash.com", name: "Tatiane Novais" },
} as unknown as T;
}
if ((path === "/auth/logout" || path === "/admin/logout") && method === "POST") {
await storage.secureRemove(TOKEN_KEY);
await storage.secureRemove(ADMIN_EMAIL_KEY);
return { ok: true } as unknown as T;
}
if (path === "/auth/me" || path === "/auth/user") {
const token = await storage.secureGet(TOKEN_KEY, "");
if (!token || token !== "token_auth_tatiane_logada") {
throw new ApiError("Não autenticado", 401);
}
return { id: "admin", email: "tatiane@lash.com", name: "Tatiane Novais" } as unknown as T;
}
// --- 2. PORTFÓLIO ---
if (path === "/portfolio" || path === "/admin/portfolio") {
const baseUrl = ${cleanUrl}/rest/v1/portfolio;
if (method === "GET") {
const res = await fetch(${baseUrl}?select=id,url,title,category&order=created_at.desc, {
headers: supabaseHeaders(),
});
return (res.ok ? await res.json() : []) as unknown as T;
}
if (method === "POST") {
const newPhoto = {
id: photo_${Date.now()},
url: opts.body?.url || "",
title: opts.body?.title || "Novo Trabalho",
category: opts.body?.category || "Extensão",
};
const res = await fetch(baseUrl, {
method: "POST",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "return=representation",
}),
body: JSON.stringify(newPhoto),
});
if (!res.ok) throw new ApiError("Erro ao salvar foto.", res.status);
const inserted = await res.json();
return (inserted[0] || newPhoto) as unknown as T;
}
}
if (path.startsWith("/admin/portfolio/") && method === "DELETE") {
const id = encodeURIComponent(path.split("/").pop() || "");
const res = await fetch(${cleanUrl}/rest/v1/portfolio?id=eq.${id}, {
method: "DELETE",
headers: supabaseHeaders(),
});
if (!res.ok) throw new ApiError("Erro ao excluir foto.", res.status);
return { ok: true } as unknown as T;
}
// --- 3. BIO ---
if (path === "/bio" || path === "/admin/bio") {
const baseUrl = ${cleanUrl}/rest/v1/bio;
if (method === "GET") {
try {
const res = await fetch(${baseUrl}?id=eq.main&select=id,title,body, {
headers: supabaseHeaders(),
});
const data = await res.json();
return (data?.[0] || INITIAL_BIO) as unknown as T;
} catch {
return INITIAL_BIO as unknown as T;
}
}
if (method === "PUT" || method === "POST") {
const payload = {
id: "main",
title: opts.body?.title || INITIAL_BIO.title,
body: opts.body?.body || INITIAL_BIO.body,
updated_at: new Date().toISOString(),
};
const res = await fetch(${baseUrl}?on_conflict=id, {
method: "POST",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "resolution=merge-duplicates,return=representation",
}),
body: JSON.stringify(payload),
});
if (!res.ok) throw new ApiError("Erro ao salvar bio.", res.status);
const saved = await res.json();
return (saved[0] || payload) as unknown as T;
}
}
// --- 4. SERVIÇOS ---
if (path === "/services" || path === "/admin/services") {
const baseUrl = ${cleanUrl}/rest/v1/services;
if (method === "GET") {
try {
return (await fetchServices(path === "/services")) as unknown as T;
} catch {
return INITIAL_SERVICES as unknown as T;
}
}
if (method === "POST") {
const payload = {
id: svc_${Date.now()},
name: opts.body?.name || "Novo Procedimento",
category: opts.body?.category || "Extensão",
price: Number(opts.body?.price ?? 0),
duration: Number(opts.body?.duration ?? 150),
description: opts.body?.description || "",
price_note: opts.body?.price_note || "",
sort_order: Number(opts.body?.order ?? 99),
active: opts.body?.active !== undefined ? Boolean(opts.body.active) : true,
};
const res = await fetch(baseUrl, {
method: "POST",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "return=representation",
}),
body: JSON.stringify(payload),
});
if (!res.ok) throw new ApiError("Erro ao salvar serviço.", res.status);
const inserted = await res.json();
return mapServiceRow(inserted[0] || payload) as unknown as T;
}
}
if (path.startsWith("/admin/services/") && (method === "PUT" || method === "PATCH")) {
const id = encodeURIComponent(path.split("/").pop() || "");
const b = opts.body || {};
const payload: Record<string, any> = {};
if (b.name !== undefined) payload.name = b.name;
if (b.category !== undefined) payload.category = b.category;
if (b.price !== undefined) payload.price = Number(b.price);
if (b.duration !== undefined) payload.duration = Number(b.duration);
if (b.description !== undefined) payload.description = b.description;
if (b.price_note !== undefined) payload.price_note = b.price_note;
if (b.order !== undefined) payload.sort_order = Number(b.order);
if (b.active !== undefined) payload.active = Boolean(b.active);
const res = await fetch(${cleanUrl}/rest/v1/services?id=eq.${id}, {
method: "PATCH",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "return=representation",
}),
body: JSON.stringify(payload),
});
if (!res.ok) throw new ApiError("Erro ao atualizar serviço.", res.status);
const updated = await res.json();
return (updated[0] ? mapServiceRow(updated[0]) : opts.body) as unknown as T;
}
if (path.startsWith("/admin/services/") && method === "DELETE") {
const id = encodeURIComponent(path.split("/").pop() || "");
const res = await fetch(${cleanUrl}/rest/v1/services?id=eq.${id}, {
method: "DELETE",
headers: supabaseHeaders(),
});
if (!res.ok) throw new ApiError("Erro ao excluir serviço.", res.status);
return { ok: true } as unknown as T;
}
// --- 5. DISPONIBILIDADE (DIAS E SLOTS) ---
if (path === "/availability/dates") {
return (await generateDaysWithBlocks()) as unknown as T;
}
if (path.startsWith("/availability/slots")) {
const matchDate = path.match(/date=([^&]+)/);
const dateParam = matchDate ? matchDate[1] : "";
return { slots: await getSlotsForDate(dateParam) } as unknown as T;
}
// --- 6. AGENDAMENTOS ADMIN (PERSISTIDO NO SUPABASE) ---
if (path === "/admin/bookings" && method === "GET") {
return (await fetchBookingsFromDb()) as unknown as T;
}
if (
(path.startsWith("/admin/bookings/") || path.startsWith("/bookings/")) &&
(method === "PUT" || method === "PATCH")
) {
const id = encodeURIComponent(path.split("/").pop() || "");
const res = await fetch(${cleanUrl}/rest/v1/bookings?id=eq.${id}, {
method: "PATCH",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "return=representation",
}),
body: JSON.stringify(opts.body),
});
const updated = await res.json();
return (updated[0] || opts.body) as unknown as T;
}
if (
((path.startsWith("/admin/bookings/") || path.startsWith("/bookings/")) && method === "DELETE") ||
path.includes("/cancel")
) {
const parts = path.split("/");
const rawId = path.includes("/cancel") ? parts[parts.length - 2] : parts[parts.length - 1];
const id = encodeURIComponent(rawId || "");
await fetch(${cleanUrl}/rest/v1/bookings?id=eq.${id}, {
method: "PATCH",
headers: supabaseHeaders({ "Content-Type": "application/json" }),
body: JSON.stringify({ status: "cancelled" }),
});
return { ok: true } as unknown as T;
}
// --- 7. BLOQUEIOS DE AGENDA ---
if (path === "/admin/blocks") {
const baseUrl = ${cleanUrl}/rest/v1/blocks;
if (method === "GET") return (await fetchBlocksFromDb()) as unknown as T;
if (method === "POST") {
const newBlock: Block = {
id: block_${Date.now()},
date: opts.body?.date || "",
start: opts.body?.start || null,
end: opts.body?.end || null,
reason: opts.body?.reason || "Horário bloqueado",
};
const res = await fetch(baseUrl, {
method: "POST",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "return=representation",
}),
body: JSON.stringify(newBlock),
});
const inserted = await res.json();
return (inserted[0] || newBlock) as unknown as T;
}
}
if (path.startsWith("/admin/blocks/") && method === "DELETE") {
const id = encodeURIComponent(path.split("/").pop() || "");
await fetch(${cleanUrl}/rest/v1/blocks?id=eq.${id}, {
method: "DELETE",
headers: supabaseHeaders(),
});
return { ok: true } as unknown as T;
}
// --- 8. CONFIGURAÇÕES ---
if (path === "/settings" || path === "/admin/settings" || path.includes("infinitepay")) {
if (method === "GET") {
return (await fetchSettingsFromDb()) as unknown as T;
}
if (method === "PUT" || method === "POST") {
const current = await fetchSettingsFromDb();
const b = opts.body || {};
const handle = b.infinitepay_handle ?? current.infinitepay_handle ?? "";
const apiKey = b.infinitepay_api_key ?? b.api_key ?? "";
const isConfigured = Boolean(handle.trim() || apiKey.trim());
const updated = {
id: "main",
whatsapp: b.whatsapp ?? current.whatsapp,
booking_link: b.booking_link ?? current.booking_link,
instagram: b.instagram ?? current.instagram,
deposit_percent: Number(b.deposit_percent ?? current.deposit_percent ?? 40),
vip_slot_fee: Number(b.vip_slot_fee ?? current.vip_slot_fee ?? 30),
infinitepay_handle: handle,
infinitepay_api_key_hint: apiKey
? ••••${String(apiKey).slice(-4)}
: current.infinitepay_api_key_hint || (isConfigured ? "••••Ativa" : ""),
payments_enabled:
b.payments_enabled !== undefined ? Boolean(b.payments_enabled) : isConfigured,
updated_at: new Date().toISOString(),
};
const res = await fetch(${cleanUrl}/rest/v1/settings?on_conflict=id, {
method: "POST",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "resolution=merge-duplicates,return=representation",
}),
body: JSON.stringify(updated),
});
const saved = await res.json();
return (saved[0] || updated) as unknown as T;
}
}
// --- 9. NOVO AGENDAMENTO (COM REGRA DE HORÁRIO VIP DAS 21:00) ---
if (path === "/bookings" && method === "POST") {
const b = opts.body || {};
const [services, settings] = await Promise.all([
fetchServices(false).catch(() => INITIAL_SERVICES),
fetchSettingsFromDb(),
]);
const service = services.find((s) => s.id === b.service_id) || services[0];
const isChristmas = isChristmasScheduleDate(b.date || "");
const isVipSlot = isChristmas && b.start === "21:00";
const extraFee = isVipSlot ? Number(settings.vip_slot_fee ?? 30) : 0;
const totalPrice = service.price + extraFee;
const depositPercent = Number(settings.deposit_percent ?? 40);
const deposit = Math.round(totalPrice * (depositPercent / 100));
const chosenPayment = b.payment_method || "Pix";
const newBooking: Booking = {
id: booking_${Date.now()},
service_id: service.id,
service_name: service.name,
price: totalPrice,
extra_fee: extraFee,
price_note: isVipSlot ? Inclui taxa de horário especial 21:00 (+R$ ${extraFee},00) : "",
duration: service.duration,
date: b.date || "",
start: b.start || "",
end: b.start ? addMinutesToTime(b.start, service.duration) : "",
client_name: b.client_name || "",
client_phone: b.client_phone || "",
status: "confirmed",
created_at: new Date().toISOString(),
deposit_percent: depositPercent,
deposit_amount: deposit,
payment_status: "pending",
payment_id: "",
payment_method: chosenPayment,
paid_at: "",
};
const res = await fetch(${cleanUrl}/rest/v1/bookings, {
method: "POST",
headers: supabaseHeaders({
"Content-Type": "application/json",
Prefer: "return=representation",
}),
body: JSON.stringify(newBooking),
});
if (!res.ok) {
throw new ApiError("Não foi possível concluir o agendamento. Tente novamente.", res.status);
}
const vipText = isVipSlot ? \n✨ *Taxa Horário Especial (21:00):* +R$ ${extraFee},00 : "";
const message =
Olá, Tatiane! Gostaria de confirmar meu agendamento:\n\n +
👁️ *Procedimento:* ${service.name}\n +
📅 *Data:* ${b.date}\n +
⏰ *Horário:* ${b.start}\n +
👤 *Cliente:* ${b.client_name}\n +
📱 *WhatsApp:* ${b.client_phone}\n +
💵 *Valor do Procedimento:* R$ ${service.price},00${vipText}\n +
💰 *Valor Total:* R$ ${totalPrice},00\n +
💳 *Sinal (${depositPercent}%):* R$ ${deposit},00\n +
💠 *Forma de Pagamento:* ${chosenPayment}\n\n +
Aguardo a chave Pix para envio do comprovante do sinal e confirmação do horário!;
if (typeof window !== "undefined") {
window.open(whatsappUrl(settings.whatsapp, message), "_blank");
}
return newBooking as unknown as T;
}
return [] as unknown as T;
}
export const bookingLink = (s?: Settings | null) => {
if (s?.booking_link && s.booking_link.trim().length > 0) {
return s.booking_link.trim();
}
if (typeof window !== "undefined") {
return window.location.origin;
}
return "onrender.com";
};
