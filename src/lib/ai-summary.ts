import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { describe } from "@/app/weather";
import type { WeatherData } from "./weather-api";

// Uygulamanın kendi durum değerlendirme sistemi: hava verisinden kısa, nesnel bir rapor çıkarır.
// Sohbet etmez; yalnızca durumu bildirir.

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `Sen bu hava durumu uygulamasının içindeki durum değerlendirme sistemisin. Görevin, sana verilen ölçüm ve tahmin verisinden kısa ve gerçekçi bir durum raporu çıkarmak.

Nasıl yazacaksın:
- Bir meteoroloji bülteni gibi nesnel ve sakin bir dille yaz. Okura hitap etme, selam verme, soru sorma, kendinden söz etme. Sohbet etmiyorsun; durumu bildiriyorsun.
- Yalnızca verideki bilgiye dayan. Veride olmayan bir şeyi (hava kalitesi, trafik, resmi uyarılar, olaylar) ekleme. Abartma, dramatize etme, belirsiz olanı kesinmiş gibi yazma.
- Somut ol: sıcaklıkları, saatleri ve günleri veriden alarak an. Değerleri olduğu gibi kullan, yeni sayı üretme.
- Önemli olanı öne al: önce şu anki durum ve bugünün gidişatı, sonra önümüzdeki günlerdeki belirgin değişiklik (yağışın başlaması ya da bitmesi, belirgin ısınma ya da soğuma, kuvvetli rüzgar). Kayda değer bir değişiklik yoksa bunu tek cümleyle söyle.
- Pratik bir sonuç ancak veriden açıkça çıkıyorsa ekle (örneğin yağış olasılığı yüksekse şemsiye) ve tek cümleyi geçmesin.
- Emoji, ünlem, madde işareti ya da Markdown kullanma. Türkçe yaz.

Alanlar:
- baslik: durumu özetleyen 3-6 kelimelik başlık, nokta yok (örnek: "Serin ve açık, hafta sonu yağışlı").
- ozet: 2-4 cümle.
- uyarilar: yalnızca gerçekten dikkat gerektiren durumlar; her biri günü belirten tek kısa cümle, en fazla 3 tane. Ölçüt: en düşük sıcaklık 0° veya altı (don ve buzlanma), rüzgar 40 km/s veya üstü, günlük yağış 10 mm veya üstü ya da yağış olasılığı %80 veya üstü, UV indeksi 6 veya üstü, sıcaklık 35° veya üstü. Hiçbiri yoksa boş liste döndür.`;

const SummarySchema = z.object({
  baslik: z.string(),
  ozet: z.string(),
  uyarilar: z.array(z.string()),
});

export type AiSummary = z.infer<typeof SummarySchema>;

export class AiSummaryError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "unavailable" | "rate_limited" | "failed",
  ) {
    super(message);
  }
}

/** Modele verilecek kısa, okunur veri özeti (durum etiketleri Türkçe). */
function buildContext(data: WeatherData): string {
  const { konum, simdi, saatlik, gunluk } = data;
  const yer = [konum.ad, konum.bolge, konum.ulke].filter(Boolean).join(", ");
  const lines = [
    `Konum: ${yer}`,
    `Yerel saat: ${simdi.zaman.replace("T", " ")}`,
    `Şu an: ${simdi.sicaklik}° (hissedilen ${simdi.hissedilen}°), ${describe(simdi.kod, simdi.gunduz).label}, nem %${simdi.nem}, rüzgar ${simdi.ruzgar} km/s, son saatteki yağış ${simdi.yagis} mm`,
    "",
    "Önümüzdeki 24 saat (saat: sıcaklık, durum, yağış olasılığı):",
    ...saatlik.map(
      (h) =>
        `${h.zaman.slice(11, 16)}: ${h.sicaklik}°, ${describe(h.kod, h.gunduz).label}, %${h.yagisOlasiligi}`,
    ),
    "",
    "7 günlük tahmin (tarih: en düşük/en yüksek, durum, yağış miktarı ve olasılığı, en yüksek rüzgar, UV, gün doğumu-batımı):",
    ...gunluk.map(
      (d, i) =>
        `${d.tarih}${i === 0 ? " (bugün)" : ""}: ${d.enDusuk}°/${d.enYuksek}°, ${describe(d.kod).label}, ${d.yagis} mm (%${d.yagisOlasiligi}), rüzgar ${d.ruzgar} km/s, UV ${d.uv}, ${d.gunDogumu.slice(11, 16)}-${d.gunBatimi.slice(11, 16)}`,
    ),
  ];
  return lines.join("\n");
}

// Aynı konum ve aynı ölçüm zamanı için modeli tekrar çağırmamak adına küçük bir bellek içi önbellek.
// Open-Meteo anlık veriyi 15 dakikada bir günceller; anahtar bu zamanı içerdiği için önbellek kendiliğinden tazelenir.
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; value: AiSummary }>();

let client: Anthropic | null = null;

export async function getAiSummary(data: WeatherData): Promise<AiSummary> {
  const key = `${data.konum.ad}|${data.konum.bolge}|${data.konum.ulke}|${data.simdi.zaman}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Bir güvenlik sınıflandırıcısı isteği reddederse sunucu tarafında uygun modele düşer.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildContext(data) }],
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(SummarySchema),
      },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new AiSummaryError("Değerlendirme üretilemedi.", 502, "failed");
    }

    const value: AiSummary = {
      baslik: response.parsed_output.baslik.trim(),
      ozet: response.parsed_output.ozet.trim(),
      uyarilar: response.parsed_output.uyarilar.map((u) => u.trim()).filter(Boolean).slice(0, 3),
    };

    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (err instanceof AiSummaryError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AiSummaryError("Yapay zeka yapılandırılmamış.", 503, "unavailable");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiSummaryError("Çok fazla istek; biraz sonra tekrar deneyin.", 429, "rate_limited");
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Claude API hatası ${err.status}:`, err.message);
      throw new AiSummaryError("Değerlendirme şu an alınamadı.", 502, "failed");
    }
    // Kimlik bilgisi hiç yoksa SDK istek öncesinde hata verir.
    console.error("Yapay zeka özeti alınamadı:", err);
    throw new AiSummaryError("Yapay zeka yapılandırılmamış.", 503, "unavailable");
  }
}
