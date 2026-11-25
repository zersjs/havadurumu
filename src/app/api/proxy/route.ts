import { NextResponse } from "next/server";

// Veriler Open-Meteo'dan alınır (ücretsiz, API anahtarı gerektirmez).
// Yanıt, ön yüzün beklediği formata (konum, tarih_saat, gunluk_tahmin) dönüştürülür.

const WMO_TR: Record<number, string> = {
  0: "Açık",
  1: "Az bulutlu",
  2: "Parçalı bulutlu",
  3: "Kapalı",
  45: "Sisli",
  48: "Kırağılı sis",
  51: "Hafif çisenti",
  53: "Çisenti",
  55: "Yoğun çisenti",
  56: "Donan çisenti",
  57: "Yoğun donan çisenti",
  61: "Hafif yağmur",
  63: "Yağmur",
  65: "Şiddetli yağmur",
  66: "Donan yağmur",
  67: "Şiddetli donan yağmur",
  71: "Hafif kar",
  73: "Kar",
  75: "Yoğun kar",
  77: "Kar taneleri",
  80: "Hafif sağanak",
  81: "Sağanak",
  82: "Şiddetli sağanak",
  85: "Hafif kar sağanağı",
  86: "Yoğun kar sağanağı",
  95: "Gök gürültülü fırtına",
  96: "Dolulu fırtına",
  99: "Şiddetli dolulu fırtına",
};

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface ForecastResponse {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    relative_humidity_2m_mean: number[];
    wind_speed_10m_max: number[];
    precipitation_sum: number[];
  };
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
      return NextResponse.json({ error: "Şehir bulunamadı." }, { status: 404 });
    }

    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "relative_humidity_2m_mean",
        "wind_speed_10m_max",
        "precipitation_sum",
      ].join(","),
      timezone: "auto",
      forecast_days: "7",
    });
    const fcRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!fcRes.ok) throw new Error(`Forecast HTTP ${fcRes.status}`);
    const { daily }: ForecastResponse = await fcRes.json();

    const gunluk_tahmin = daily.time.map((tarih, i) => ({
      tarih,
      en_yuksek: `${Math.round(daily.temperature_2m_max[i])}°C`,
      en_dusuk: `${Math.round(daily.temperature_2m_min[i])}°C`,
      durum: WMO_TR[daily.weather_code[i]] ?? "Bilinmiyor",
      nem: `%${Math.round(daily.relative_humidity_2m_mean[i])}`,
      ruzgarHizi: `${Math.round(daily.wind_speed_10m_max[i])} km/s`,
      yagis: `${daily.precipitation_sum[i]} mm`,
    }));

    const konum = [place.name, place.admin1 !== place.name ? place.admin1 : null, place.country]
      .filter(Boolean)
      .join(", ");

    return NextResponse.json({
      success: true,
      konum,
      tarih_saat: new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
      gunluk_tahmin,
    });
  } catch (err) {
    console.error("Hava durumu alınamadı:", err);
    return NextResponse.json(
      { error: "Hava durumu servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin." },
      { status: 502 },
    );
  }
}
