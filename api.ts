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
