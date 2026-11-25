import { NextResponse } from "next/server";

// Veriler Open-Meteo'dan alınır (ücretsiz, API anahtarı gerektirmez).

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

interface ForecastResponse {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
    weather_code: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    relative_humidity_2m_mean: number[];
    wind_speed_10m_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
}

export interface WeatherData {
  konum: { ad: string; bolge: string | null; ulke: string | null };
  simdi: {
    zaman: string;
    sicaklik: number;
    hissedilen: number;
    nem: number;
    ruzgar: number;
    yagis: number;
    kod: number;
    gunduz: boolean;
  };
  saatlik: { zaman: string; sicaklik: number; yagisOlasiligi: number; kod: number; gunduz: boolean }[];
  gunluk: {
    tarih: string;
    kod: number;
    enYuksek: number;
    enDusuk: number;
    nem: number;
    ruzgar: number;
    yagis: number;
    yagisOlasiligi: number;
    gunDogumu: string;
    gunBatimi: string;
    uv: number;
  }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Şehir adı gerekli." }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr&format=json`,
    );
    if (!geoRes.ok) throw new Error(`Geocoding HTTP ${geoRes.status}`);
    const geo: { results?: GeoResult[] } = await geoRes.json();
    const place = geo.results?.[0];

    if (!place) {
      return NextResponse.json({ error: `"${q}" adında bir şehir bulunamadı.` }, { status: 404 });
    }

    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "wind_speed_10m",
        "precipitation",
        "weather_code",
        "is_day",
      ].join(","),
      hourly: ["temperature_2m", "precipitation_probability", "weather_code", "is_day"].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "relative_humidity_2m_mean",
        "wind_speed_10m_max",
        "precipitation_sum",
        "precipitation_probability_max",
        "sunrise",
        "sunset",
        "uv_index_max",
      ].join(","),
      timezone: "auto",
      forecast_days: "7",
    });
    const fcRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!fcRes.ok) throw new Error(`Forecast HTTP ${fcRes.status}`);
    const fc: ForecastResponse = await fcRes.json();
    const { current, hourly, daily } = fc;

    // Önümüzdeki 24 saat (şu anki saatten başlayarak, konumun yerel saatine göre)
    const currentHour = current.time.slice(0, 13); // "YYYY-MM-DDTHH"
    const startIdx = Math.max(0, hourly.time.findIndex((t) => t.startsWith(currentHour)));
    const saatlik = hourly.time.slice(startIdx, startIdx + 24).map((zaman, j) => {
      const i = startIdx + j;
      return {
        zaman,
        sicaklik: Math.round(hourly.temperature_2m[i]),
        yagisOlasiligi: hourly.precipitation_probability[i] ?? 0,
        kod: hourly.weather_code[i],
        gunduz: hourly.is_day[i] === 1,
      };
    });

    const data: WeatherData = {
      konum: {
        ad: place.name,
        bolge: place.admin1 && place.admin1 !== place.name ? place.admin1 : null,
        ulke: place.country ?? null,
      },
      simdi: {
        zaman: current.time,
        sicaklik: Math.round(current.temperature_2m),
        hissedilen: Math.round(current.apparent_temperature),
        nem: Math.round(current.relative_humidity_2m),
        ruzgar: Math.round(current.wind_speed_10m),
        yagis: current.precipitation,
        kod: current.weather_code,
        gunduz: current.is_day === 1,
      },
      saatlik,
      gunluk: daily.time.map((tarih, i) => ({
        tarih,
        kod: daily.weather_code[i],
        enYuksek: Math.round(daily.temperature_2m_max[i]),
        enDusuk: Math.round(daily.temperature_2m_min[i]),
        nem: Math.round(daily.relative_humidity_2m_mean[i]),
        ruzgar: Math.round(daily.wind_speed_10m_max[i]),
        yagis: Math.round(daily.precipitation_sum[i] * 10) / 10,
        yagisOlasiligi: daily.precipitation_probability_max[i] ?? 0,
        gunDogumu: daily.sunrise[i],
        gunBatimi: daily.sunset[i],
        uv: Math.round(daily.uv_index_max[i] ?? 0),
      })),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("Hava durumu alınamadı:", err);
    return NextResponse.json(
      { error: "Hava durumu servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin." },
      { status: 502 },
    );
  }
}
