"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { Layout, LayoutContent, LayoutHeader, VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { Token } from "@astryxdesign/core/Token";
import { Banner } from "@astryxdesign/core/Banner";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { Link } from "@astryxdesign/core/Link";
import { StackItem } from "@astryxdesign/core/Stack";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudSun, Droplets, MapPin, Sparkles, Sunrise, Thermometer, TriangleAlert, Umbrella, Wind } from "lucide-react";

import type { WeatherData } from "@/lib/weather-api";
import type { AiSummary } from "@/lib/ai-summary";
import {
  TONE_TEXT_CLASS,
  describe,
  formatDay,
  formatHour,
  formatLongDateTime,
  formatShortDate,
} from "./weather";

const QUICK_CITIES = ["İstanbul", "Ankara", "İzmir", "Antalya", "Bursa", "Trabzon"];
const STORAGE_KEY = "havadurumu:sonSehir";

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

type SummaryState =
  | { status: "loading" }
  | { status: "ready"; value: AiSummary }
  | { status: "error"; message: string }
  | { status: "unavailable" };

// ============= ÖZET KUTUCUKLARI =============

function MetricTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: SvgIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Icon icon={icon} size="sm" color="secondary" />
          <Text type="supporting" color="secondary">
            {label}
          </Text>
        </HStack>
        <Heading level={2} accessibilityLevel={3}>
          {value}
        </Heading>
        <Text type="supporting" color="secondary">
          {hint}
        </Text>
      </VStack>
    </Card>
  );
}

// ============= SAATLİK GRAFİK =============

type HourPoint = WeatherData["saatlik"][number];

const chartColor = "var(--color-data-categorical-orange)";
const axisTick = {
  fontSize: "var(--font-size-sm)",
  fill: "var(--color-text-secondary)",
};

function HourTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HourPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const cond = describe(point.kod, point.gunduz);
  return (
    <Card padding={3} elevation="med">
      <VStack gap={1}>
        <Text type="supporting" color="secondary">
          {formatHour(point.zaman)}
        </Text>
        <HStack gap={2} vAlign="center">
          <Icon icon={cond.icon} size="sm" color={cond.tone} />
          <Text weight="semibold">{point.sicaklik}°</Text>
          <Text type="supporting" color="secondary">
            {cond.label}
          </Text>
        </HStack>
        <Text type="supporting" color="secondary">
          Yağış ihtimali %{point.yagisOlasiligi}
        </Text>
      </VStack>
    </Card>
  );
}

function HourlyChart({ data }: { data: HourPoint[] }) {
  const temps = data.map((d) => d.sicaklik);
  const min = Math.floor(Math.min(...temps)) - 2;
  const max = Math.ceil(Math.max(...temps)) + 2;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="zaman"
          tickFormatter={formatHour}
          interval="preserveStartEnd"
          minTickGap={24}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[min, max]}
          allowDecimals={false}
          tickFormatter={(v: number) => `${v}°`}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<HourTooltip />} cursor={{ stroke: "var(--color-border-emphasized)" }} />
        <Area
          type="monotone"
          dataKey="sicaklik"
          name="Sıcaklık"
          stroke={chartColor}
          strokeWidth={2}
          fill="url(#tempFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============= YÜKLENİYOR =============

function LoadingState() {
  return (
    <VStack gap={6}>
      <Skeleton height={220} radius={4} />
      <Grid columns={{ minWidth: 180, repeat: "fit" }} gap={4}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={120} radius={4} index={i} />
        ))}
      </Grid>
      <Skeleton height={280} radius={4} index={4} />
    </VStack>
  );
}

// ============= DURUM DEĞERLENDİRMESİ (YAPAY ZEKA) =============

function AiSummaryCard({ state }: { state: SummaryState }) {
  if (state.status === "unavailable") return null;
  return (
    <Card>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center">
          <Icon icon={Sparkles} size="sm" color="accent" />
          <Text type="supporting" color="secondary" weight="medium">
            Durum değerlendirmesi
          </Text>
        </HStack>
        {state.status === "loading" && (
          <VStack gap={2} aria-busy="true" aria-label="Durum değerlendirmesi hazırlanıyor">
            <Skeleton height={24} width="40%" />
            <Skeleton height={16} index={1} />
            <Skeleton height={16} width="85%" index={2} />
          </VStack>
        )}
        {state.status === "error" && (
          <Text color="secondary">{state.message}</Text>
        )}
        {state.status === "ready" && (
          <VStack gap={3}>
            <Heading level={3} accessibilityLevel={2}>
              {state.value.baslik}
            </Heading>
            <Text as="p" textWrap="pretty">
              {state.value.ozet}
            </Text>
            {state.value.uyarilar.length > 0 && (
              <VStack gap={2}>
                {state.value.uyarilar.map((u) => (
                  <HStack key={u} gap={2} vAlign="start">
                    <Icon icon={TriangleAlert} size="sm" color="warning" />
                    <Text>{u}</Text>
                  </HStack>
                ))}
              </VStack>
            )}
            <Text type="supporting" color="secondary">
              Bu değerlendirme yapay zeka tarafından aşağıdaki verilerden otomatik oluşturulmuştur.
            </Text>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

// ============= HAVA DURUMU İÇERİĞİ =============

function Forecast({ data, summary }: { data: WeatherData; summary: SummaryState }) {
  const { konum, simdi, saatlik, gunluk } = data;
  const now = describe(simdi.kod, simdi.gunduz);
  const today = gunluk[0];
  const HeroIcon = now.icon;
  const subtitle = [konum.bolge, konum.ulke].filter(Boolean).join(", ");

  return (
    <VStack gap={6}>
      {/* Anlık durum */}
      <Card padding={6} variant={simdi.gunduz ? "blue" : "purple"}>
        <HStack gap={6} hAlign="between" vAlign="center" wrap="wrap">
          <VStack gap={3}>
            <VStack gap={1}>
              {subtitle && (
                <HStack gap={1} vAlign="center">
                  <Icon icon={MapPin} size="xsm" color="secondary" />
                  <Text type="supporting" color="secondary">
                    {subtitle}
                  </Text>
                </HStack>
              )}
              <Heading level={1}>{konum.ad}</Heading>
              <Text type="supporting" color="secondary">
                {formatLongDateTime(simdi.zaman)} (yerel saat)
              </Text>
            </VStack>
            <HStack gap={4} vAlign="center">
              <Text type="display-1" hasTabularNumbers>
                {simdi.sicaklik}°
              </Text>
              <VStack gap={1}>
                <Text type="large" weight="semibold">
                  {now.label}
                </Text>
                <Text color="secondary">
                  En yüksek {today.enYuksek}° · En düşük {today.enDusuk}°
                </Text>
              </VStack>
            </HStack>
          </VStack>
          <HeroIcon aria-hidden className={`hidden size-28 sm:block ${TONE_TEXT_CLASS[now.tone]}`} strokeWidth={1.25} />
        </HStack>
      </Card>

      <AiSummaryCard state={summary} />

      {/* Özet kutucukları */}
      <Grid columns={{ minWidth: 150, repeat: "fit" }} gap={4}>
        <MetricTile
          icon={Thermometer}
          label="Hissedilen"
          value={`${simdi.hissedilen}°`}
          hint={
            simdi.hissedilen < simdi.sicaklik
              ? "Rüzgar yüzünden daha soğuk"
              : simdi.hissedilen > simdi.sicaklik
                ? "Nem yüzünden daha sıcak"
                : "Gerçek sıcaklıkla aynı"
          }
        />
        <MetricTile icon={Droplets} label="Nem" value={`%${simdi.nem}`} hint={`Günlük ortalama %${today.nem}`} />
        <MetricTile
          icon={Wind}
          label="Rüzgar"
          value={`${simdi.ruzgar} km/s`}
          hint={`Bugün en fazla ${today.ruzgar} km/s`}
        />
        <MetricTile
          icon={Umbrella}
          label="Yağış ihtimali"
          value={`%${today.yagisOlasiligi}`}
          hint={today.yagis > 0 ? `Bugün toplam ${today.yagis} mm` : "Bugün yağış beklenmiyor"}
        />
        <MetricTile
          icon={Sunrise}
          label="Gün doğumu / batımı"
          value={`${formatHour(today.gunDogumu)} · ${formatHour(today.gunBatimi)}`}
          hint={`UV indeksi en fazla ${today.uv}`}
        />
      </Grid>

      {/* Saatlik sıcaklık */}
      <Card>
        <VStack gap={4}>
          <Heading level={3} accessibilityLevel={2}>
            Önümüzdeki 24 saat
          </Heading>
          <HourlyChart data={saatlik} />
        </VStack>
      </Card>

      {/* 7 günlük tahmin */}
      <Card>
        <VStack gap={2}>
          <Heading level={3} accessibilityLevel={2}>
            7 günlük tahmin
          </Heading>
          <List hasDividers edge="flush">
            {gunluk.map((day, i) => {
              const cond = describe(day.kod);
              return (
                <Item
                  key={day.tarih}
                  as="li"
                  startContent={<Icon icon={cond.icon} size="lg" color={cond.tone} />}
                  label={formatDay(day.tarih, i)}
                  description={`${formatShortDate(day.tarih)} · ${cond.label}`}
                  endContent={
                    <HStack gap={4} vAlign="center">
                      {day.yagisOlasiligi >= 20 && (
                        <HStack gap={1} vAlign="center">
                          <Icon icon={Droplets} size="xsm" color="blue" />
                          <Text type="supporting" color="secondary" hasTabularNumbers>
                            %{day.yagisOlasiligi}
                          </Text>
                        </HStack>
                      )}
                      <HStack gap={2} vAlign="center">
                        <Text color="secondary" hasTabularNumbers>
                          {day.enDusuk}°
                        </Text>
                        <Text color="secondary">/</Text>
                        <Text weight="semibold" hasTabularNumbers>
                          {day.enYuksek}°
                        </Text>
                      </HStack>
                    </HStack>
                  }
                />
              );
            })}
          </List>
        </VStack>
      </Card>
    </VStack>
  );
}

// ============= SAYFA =============

export default function Home() {
  const [city, setCity] = useState("");
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryState>({ status: "loading" });
  const requestId = useRef(0);

  // Hava verisi ekrana gelir gelmez değerlendirmeyi ayrıca ister; eski şehrin geç gelen yanıtı yok sayılır.
  const loadSummary = useCallback(async (q: string, id: number) => {
    setSummary({ status: "loading" });
    try {
      const res = await fetch(`/api/ozet?q=${encodeURIComponent(q)}`);
      const body = await res.json().catch(() => ({}));
      if (id !== requestId.current) return;
      if (res.ok) setSummary({ status: "ready", value: body as AiSummary });
      else if (body.code === "unavailable") setSummary({ status: "unavailable" });
      else setSummary({ status: "error", message: body.error || "Değerlendirme şu an alınamadı." });
    } catch {
      if (id === requestId.current) setSummary({ status: "error", message: "Değerlendirme şu an alınamadı." });
    }
  }, []);

  const load = useCallback(async (name: string) => {
    const q = name.trim();
    if (!q) {
      setError("Lütfen bir şehir adı girin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy?q=${encodeURIComponent(q)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || "error" in body) {
        throw new Error(body.error || "Bir hata oluştu.");
      }
      setData(body as WeatherData);
      void loadSummary(q, ++requestId.current);
      try {
        localStorage.setItem(STORAGE_KEY, q);
      } catch {
        // Tarayıcı depolaması kapalıysa son şehri hatırlamayız; sorun değil.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [loadSummary]);

  // İlk açılışta son aranan şehri (yoksa İstanbul'u) göster
  useEffect(() => {
    let initial = "İstanbul";
    try {
      initial = localStorage.getItem(STORAGE_KEY) || initial;
    } catch {
      // yok say
    }
    void load(initial);
  }, [load]);

  return (
    <Layout
      height="auto"
      contentWidth={960}
      header={
        <LayoutHeader hasDivider padding={4}>
          <HStack gap={2} vAlign="center">
            <Icon icon={CloudSun} color="accent" />
            <Heading level={4} accessibilityLevel={2}>
              Hava Durumu
            </Heading>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" padding={6} isScrollable={false}>
          <VStack gap={6}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="end">
                <StackItem size="fill">
                  <TextInput
                  type="search"
                  label="Şehir ara"
                  isLabelHidden
                  placeholder="Şehir adı yazın, örneğin Eskişehir"
                  startIcon="search"
                  value={city}
                  onChange={(v) => setCity(v)}
                  onEnter={() => void load(city)}
                  enterKeyHint="search"
                  hasClear
                  width="100%"
                  size="lg"
                  />
                </StackItem>
                <Button label="Ara" variant="primary" size="lg" isLoading={loading} onClick={() => void load(city)} />
              </HStack>
              <HStack gap={2} wrap="wrap">
                {QUICK_CITIES.map((c) => (
                  <Token
                    key={c}
                    label={c}
                    size="sm"
                    onClick={() => {
                      setCity(c);
                      void load(c);
                    }}
                  />
                ))}
              </HStack>
            </VStack>

            {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}

            {data ? <Forecast data={data} summary={summary} /> : loading ? <LoadingState /> : null}

            <Text type="supporting" color="secondary" justify="center">
              Veriler{" "}
              <Link href="https://open-meteo.com" isExternalLink type="supporting">
                Open-Meteo
              </Link>{" "}
              tarafından sağlanmaktadır.
            </Text>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
