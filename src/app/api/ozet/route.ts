import { NextResponse } from "next/server";
import { getWeather, WeatherError } from "@/lib/weather-api";
import { AiSummaryError, getAiSummary } from "@/lib/ai-summary";

// Model yanıtı birkaç saniye sürebilir.
export const maxDuration = 60;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Şehir adı gerekli." }, { status: 400 });
  }

  try {
    const weather = await getWeather(q);
    return NextResponse.json(await getAiSummary(weather));
  } catch (err) {
    if (err instanceof AiSummaryError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof WeatherError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Durum değerlendirmesi alınamadı:", err);
    return NextResponse.json({ error: "Değerlendirme şu an alınamadı.", code: "failed" }, { status: 502 });
  }
}
