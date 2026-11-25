"use client";

import { useState } from "react";

interface DailyForecast {
  tarih: string;
  en_dusuk: string;
  en_yuksek: string;
  durum: string;
  nem: string;  
  ruzgarHizi: string;
  yagis: string;
}

interface WeatherResponse {
  konum: string;
  gunluk_tahmin: DailyForecast[];
  tarih_saat: string;
  success?: boolean;
  error?: string;
}

export default function Home() {
  const [city, setCity] = useState("");
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const searchCity = city.trim();
    if (!searchCity) {
      setError("Şehir adı girin.");
      return;
    }

    setLoading(true);
    setError(null);
    setWeatherData(null);
    
    try {
      const response = await fetch(`/api/proxy?q=${encodeURIComponent(searchCity)}`);
      const data: WeatherResponse = await response.json().catch(() => ({}) as WeatherResponse);
      if (!response.ok || data.error) {
        throw new Error(data.error || "Bir hata oluştu.");
      }
      setWeatherData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 p-6 flex flex-col items-center font-sans tracking-tight">
      <div className="w-full max-w-2xl space-y-12 py-10">
        <header className="text-center">
          <h1 className="text-2xl font-bold">Hava Durumu</h1>
        </header>

        <form onSubmit={fetchWeather} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Şehir adı..."
            value={city}
            onClick={() => setError(null)}
            onChange={(e) => setCity(e.target.value)}
            className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 outline-none focus:border-blue-500 text-center transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-medium hover:opacity-80 disabled:opacity-50 transition-all"
          >
            {loading ? "..." : "Sorgula"}
          </button>
        </form>

        {error && (
          <p className="text-center text-red-500 text-sm font-medium">{error}</p>
        )}

        {weatherData && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-3xl font-bold">{weatherData.konum}</h2>
              <p className="text-zinc-400 text-xs mt-1 uppercase tracking-widest">{weatherData.tarih_saat}</p>
              
              {weatherData.gunluk_tahmin?.[0] && (
                <div className="mt-6">
                  <div className="text-6xl font-bold text-blue-600 block mb-2">
                    {weatherData.gunluk_tahmin[0].en_yuksek}
                  </div>
                  <div className="text-sm font-medium opacity-70 uppercase tracking-wide">
                    {weatherData.gunluk_tahmin[0].durum}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {weatherData.gunluk_tahmin.slice(0, 8).map((day, index) => (
                <div key={index} className="p-4 border border-zinc-100 dark:border-zinc-900 rounded-xl text-center">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mb-2">
                    {new Date(day.tarih).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" })}
                  </p>
                  <p className="text-xl font-bold">{day.en_yuksek}</p>
                  <p className="text-[10px] text-blue-500 font-bold uppercase mt-1">{day.durum}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="pt-12 border-t border-zinc-100 dark:border-zinc-900 text-center">
          <p className="text-zinc-400 text-[10px] font-medium tracking-wide leading-relaxed">
            Hava Durumu verileri <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Open-Meteo</a> adresinden alınmaktadır.
          </p>
        </footer>
      </div>
    </div>
  );
}

