import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Snowflake,
  Sun,
} from "lucide-react";

type Tone = "yellow" | "gray" | "blue" | "cyan" | "purple";

interface Condition {
  label: string;
  icon: LucideIcon;
  nightIcon?: LucideIcon;
  tone: Tone;
}

// WMO hava durumu kodları → Türkçe açıklama, ikon ve renk tonu
const CONDITIONS: Record<number, Condition> = {
  0: { label: "Açık", icon: Sun, nightIcon: Moon, tone: "yellow" },
  1: { label: "Az bulutlu", icon: CloudSun, nightIcon: CloudMoon, tone: "yellow" },
  2: { label: "Parçalı bulutlu", icon: CloudSun, nightIcon: CloudMoon, tone: "gray" },
  3: { label: "Kapalı", icon: Cloudy, tone: "gray" },
  45: { label: "Sisli", icon: CloudFog, tone: "gray" },
  48: { label: "Kırağılı sis", icon: CloudFog, tone: "gray" },
  51: { label: "Hafif çisenti", icon: CloudDrizzle, tone: "cyan" },
  53: { label: "Çisenti", icon: CloudDrizzle, tone: "cyan" },
  55: { label: "Yoğun çisenti", icon: CloudDrizzle, tone: "cyan" },
  56: { label: "Donan çisenti", icon: CloudDrizzle, tone: "cyan" },
  57: { label: "Yoğun donan çisenti", icon: CloudDrizzle, tone: "cyan" },
  61: { label: "Hafif yağmur", icon: CloudRain, tone: "blue" },
  63: { label: "Yağmurlu", icon: CloudRain, tone: "blue" },
  65: { label: "Şiddetli yağmur", icon: CloudRain, tone: "blue" },
  66: { label: "Donan yağmur", icon: CloudRain, tone: "blue" },
  67: { label: "Şiddetli donan yağmur", icon: CloudRain, tone: "blue" },
  71: { label: "Hafif kar", icon: CloudSnow, tone: "cyan" },
  73: { label: "Karlı", icon: CloudSnow, tone: "cyan" },
  75: { label: "Yoğun kar", icon: Snowflake, tone: "cyan" },
  77: { label: "Kar taneleri", icon: Snowflake, tone: "cyan" },
  80: { label: "Hafif sağanak", icon: CloudRain, tone: "blue" },
  81: { label: "Sağanak", icon: CloudRain, tone: "blue" },
  82: { label: "Şiddetli sağanak", icon: CloudRain, tone: "blue" },
  85: { label: "Hafif kar sağanağı", icon: CloudSnow, tone: "cyan" },
  86: { label: "Yoğun kar sağanağı", icon: CloudSnow, tone: "cyan" },
  95: { label: "Gök gürültülü fırtına", icon: CloudLightning, tone: "purple" },
  96: { label: "Dolulu fırtına", icon: CloudHail, tone: "purple" },
  99: { label: "Şiddetli dolulu fırtına", icon: CloudHail, tone: "purple" },
};

const UNKNOWN: Condition = { label: "Bilinmiyor", icon: Cloud, tone: "gray" };

export function describe(code: number, isDay = true) {
  const c = CONDITIONS[code] ?? UNKNOWN;
  return {
    label: c.label,
    icon: !isDay && c.nightIcon ? c.nightIcon : c.icon,
    tone: !isDay && c.nightIcon ? ("purple" as Tone) : c.tone,
  };
}

// Tailwind'in sınıfları bulabilmesi için tam sınıf adları (Astryx token köprüsü üzerinden)
export const TONE_TEXT_CLASS: Record<Tone, string> = {
  yellow: "text-yellow-vivid",
  gray: "text-gray-vivid",
  blue: "text-blue-vivid",
  cyan: "text-cyan-vivid",
  purple: "text-purple-vivid",
};

const tr = "tr-TR";

export const formatDay = (isoDate: string, index: number) => {
  if (index === 0) return "Bugün";
  if (index === 1) return "Yarın";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(tr, { weekday: "long" });
};

export const formatShortDate = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString(tr, { day: "numeric", month: "long" });

// Open-Meteo saatleri konumun yerel saatinde ve saat dilimi eki olmadan döner ("2026-11-25T14:00").
export const formatHour = (isoLocal: string) => isoLocal.slice(11, 16);

export const formatLongDateTime = (isoLocal: string) => {
  const d = new Date(`${isoLocal.slice(0, 10)}T12:00:00`);
  const date = d.toLocaleDateString(tr, { weekday: "long", day: "numeric", month: "long" });
  return `${date} · ${formatHour(isoLocal)}`;
};
