import { NextResponse } from "next/server";
import { getWeather, WeatherError } from "@/lib/weather-api";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Şehir adı gerekli." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getWeather(q));
  } catch (err) {
    if (err instanceof WeatherError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Hava durumu alınamadı:", err);
    return NextResponse.json(
      { error: "Hava durumu servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin." },
      { status: 502 },
    );
  }
}
