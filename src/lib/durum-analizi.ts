import type { WeatherData } from "./weather-api";

/**
 * Uygulamanın kendi durum değerlendirme motoru.
 *
 * Hiçbir harici servise bağlı değildir: anlık, saatlik ve günlük veriyi kurallarla inceler,
 * kayda değer olanı seçer ve bülten dilinde kısa bir rapor yazar. Sohbet etmez; durumu bildirir.
 * Bugün için yalnızca günün kalan saatlerine bakar, böylece geçmişte kalan yağış ya da rüzgar
 * için uyarı vermez.
 */

export interface DurumRaporu {
  baslik: string;
  bugun: string;
  gelecek: string;
  uyarilar: string[];
}

type Gunluk = WeatherData["gunluk"][number];

// ============= EŞİKLER =============

const YAGISLI_OLASILIK = 50; // %
const YAGISLI_MM = 1; // günlük toplam
const HAFIF_MM = 2;
const YOGUN_YAGIS_MM = 10;
const DIKKAT_RUZGAR = 30; // km/s
const KUVVETLI_RUZGAR = 40;
const FIRTINA_RUZGAR = 60;
const YUKSEK_UV = 6;
const ASIRI_SICAK = 35;
const BELIRGIN_DEGISIM = 4; // °

// ============= HAVA KODU GRUPLARI (WMO) =============

type Grup = "acik" | "parcali" | "kapali" | "sis" | "ciseleme" | "yagmur" | "kar" | "firtina";
type YagisTuru = "yagmur" | "kar" | "firtina";

function grup(kod: number): Grup {
  if (kod <= 1) return "acik";
  if (kod === 2) return "parcali";
  if (kod === 3) return "kapali";
  if (kod === 45 || kod === 48) return "sis";
  if (kod >= 51 && kod <= 57) return "ciseleme";
  if ((kod >= 61 && kod <= 67) || (kod >= 80 && kod <= 82)) return "yagmur";
  if ((kod >= 71 && kod <= 77) || kod === 85 || kod === 86) return "kar";
  if (kod >= 95) return "firtina";
  return "kapali";
}

const GRUP_SIFAT: Record<Grup, string> = {
  acik: "açık",
  parcali: "parçalı bulutlu",
  kapali: "kapalı",
  sis: "sisli",
  ciseleme: "çiseleyen yağmurlu",
  yagmur: "yağmurlu",
  kar: "karlı",
  firtina: "gök gürültülü sağanaklı",
};

const yagisliGrup = (g: Grup) => g === "ciseleme" || g === "yagmur" || g === "kar" || g === "firtina";

function yagisTuru(kod: number, enYuksek: number): YagisTuru {
  const g = grup(kod);
  if (g === "firtina") return "firtina";
  if (g === "kar" || (!yagisliGrup(g) && enYuksek <= 1)) return "kar";
  return "yagmur";
}

function sicaklikSifati(t: number): string {
  if (t <= 0) return "Dondurucu";
  if (t <= 8) return "Soğuk";
  if (t <= 15) return "Serin";
  if (t <= 22) return "Ilık";
  if (t <= 29) return "Sıcak";
  return "Çok sıcak";
}

// ============= TÜRKÇE YARDIMCILAR =============

const GUN_ADLARI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function gunAdi(tarih: string, i: number): string {
  if (i === 0) return "bugün";
  if (i === 1) return "yarın";
  return GUN_ADLARI[new Date(`${tarih}T12:00:00`).getDay()];
}

const ozelAd = (ad: string) => ad !== "bugün" && ad !== "yarın";

const INCE = new Set(["e", "i", "ö", "ü"]);
const KALIN = new Set(["a", "ı", "o", "u"]);
const SERT = new Set(["f", "s", "t", "k", "ç", "ş", "h", "p"]);

function sonUnlu(kelime: string): "a" | "e" {
  for (let i = kelime.length - 1; i >= 0; i--) {
    const c = kelime[i].toLocaleLowerCase("tr-TR");
    if (INCE.has(c)) return "e";
    if (KALIN.has(c)) return "a";
  }
  return "e";
}

/** Ayrılma hâli: Pazar'dan, Perşembe'den, yarından */
function den(ad: string): string {
  const son = ad[ad.length - 1].toLocaleLowerCase("tr-TR");
  const ek = `${SERT.has(son) ? "t" : "d"}${sonUnlu(ad)}n`;
  return ozelAd(ad) ? `${ad}'${ek}` : `${ad}${ek}`;
}

/** Yönelme hâli: Salı'ya, Pazar'a, yarına */
function ye(ad: string): string {
  const son = ad[ad.length - 1].toLocaleLowerCase("tr-TR");
  const unlu = sonUnlu(ad);
  const ek = INCE.has(son) || KALIN.has(son) ? `y${unlu}` : unlu;
  return ozelAd(ad) ? `${ad}'${ek}` : `${ad}${ek}`;
}

function liste(ogeler: string[]): string {
  if (ogeler.length <= 1) return ogeler.join("");
  return `${ogeler.slice(0, -1).join(", ")} ve ${ogeler[ogeler.length - 1]}`;
}

const buyukHarf = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
const saat = (zaman: string) => zaman.slice(11, 16);

/** Ardışık gün indekslerini [başlangıç, bitiş] aralıklarına böler. */
function araliklar(indeksler: number[]): [number, number][] {
  const sonuc: [number, number][] = [];
  for (const i of indeksler) {
    const son = sonuc[sonuc.length - 1];
    if (son && son[1] === i - 1) son[1] = i;
    else sonuc.push([i, i]);
  }
  return sonuc;
}

/**
 * Günleri doğal dille anar:
 * "Pazar günü", "yarın", "Cuma ve Cumartesi", "Pazar'dan itibaren", "bugünden Pazartesi'ye kadar",
 * ayrık günlerde "Cuma, Cumartesi ve Salı günleri".
 */
function gunlerIfadesi(idx: number[], adlar: string[]): string {
  const parcalar = araliklar(idx);
  const sonGun = adlar.length - 1;
  if (parcalar.length === 1) {
    const [a, b] = parcalar[0];
    if (a === b) return ozelAd(adlar[a]) ? `${adlar[a]} günü` : adlar[a];
    if (b === sonGun && a > 0) return `${den(adlar[a])} itibaren`;
    if (b === a + 1) return `${adlar[a]} ve ${adlar[b]}`;
    return `${den(adlar[a])} ${ye(adlar[b])} kadar`;
  }
  if (idx.length >= 4) return "hafta boyunca aralıklarla";
  const isimler = idx.map((i) => adlar[i]);
  return isimler.some((ad) => !ozelAd(ad)) ? liste(isimler) : `${liste(isimler)} günleri`;
}

// ============= GÜN ÖZETLERİ =============

interface GunOzeti {
  yagisli: boolean;
  turler: YagisTuru[];
  hafif: boolean;
  yagis: number;
  ruzgar: number;
  enDusuk: number;
  enYuksek: number;
  uv: number;
}

/**
 * Her gün için analizde kullanılan değerler. Bugün (i = 0) için günün kalan saatleri esas alınır:
 * sabah yağıp dinen kar için "bugün kar yağışı" denmez.
 */
function gunOzetleri(data: WeatherData): GunOzeti[] {
  const { saatlik, gunluk, simdi } = data;
  return gunluk.map((d, i) => {
    if (i > 0) {
      const yagisli = d.yagisOlasiligi >= YAGISLI_OLASILIK || d.yagis >= YAGISLI_MM;
      return {
        yagisli,
        turler: yagisli ? [yagisTuru(d.kod, d.enYuksek)] : [],
        hafif: d.yagis < HAFIF_MM && d.yagisOlasiligi < 60,
        yagis: d.yagis,
        ruzgar: d.ruzgar,
        enDusuk: d.enDusuk,
        enYuksek: d.enYuksek,
        uv: d.uv,
      };
    }
    const kalan = saatlik.filter((h) => h.zaman.startsWith(d.tarih));
    const yagisSaatleri = kalan.filter((h) => h.yagisOlasiligi >= YAGISLI_OLASILIK || yagisliGrup(grup(h.kod)));
    const turler = [...new Set(yagisSaatleri.map((h) => yagisTuru(h.kod, d.enYuksek)))];
    const gece = saatlik.filter((h) => !h.gunduz);
    const ogleden = Number(saat(simdi.zaman).slice(0, 2));
    const kalanYagis = Math.round(kalan.reduce((t, h) => t + h.yagis, 0) * 10) / 10;
    return {
      yagisli: yagisSaatleri.length > 0,
      turler,
      hafif: kalanYagis < HAFIF_MM && Math.max(0, ...kalan.map((h) => h.yagisOlasiligi)) < 60,
      yagis: kalanYagis,
      ruzgar: kalan.length ? Math.max(...kalan.map((h) => h.ruzgar)) : simdi.ruzgar,
      enDusuk: gece.length ? Math.min(...gece.map((h) => h.sicaklik)) : d.enDusuk,
      enYuksek: kalan.length ? Math.max(simdi.sicaklik, ...kalan.map((h) => h.sicaklik)) : simdi.sicaklik,
      uv: ogleden >= 15 ? 0 : d.uv, // öğleden sonra geç saatlerde bugünün UV uyarısı anlamsız
    };
  });
}

function turIfadesi(gunler: GunOzeti[]): string {
  const turler: YagisTuru[] = [];
  for (const g of gunler) for (const t of g.turler) if (!turler.includes(t)) turler.push(t);
  if (turler.includes("firtina")) return "gök gürültülü sağanak";
  if (turler.includes("kar") && turler.includes("yagmur")) {
    return turler.indexOf("kar") < turler.indexOf("yagmur") ? "kar ve yağmur" : "yağmur ve kar";
  }
  if (turler.includes("kar")) return "kar yağışı";
  return gunler.every((g) => g.hafif) ? "hafif yağmur" : "yağmur";
}

function turSifati(gunler: GunOzeti[]): string {
  const tur = turIfadesi(gunler);
  if (tur === "kar yağışı") return "karlı";
  if (tur === "gök gürültülü sağanak") return "sağanaklı";
  return "yağışlı";
}

// ============= ANLATIM =============

function bugunuAnlat(data: WeatherData, ozetler: GunOzeti[]): string {
  const { simdi, saatlik, gunluk } = data;
  const g = grup(simdi.kod);
  const cumleler: string[] = [];

  // Şu an
  let simdiCumle = `Şu an hava ${GRUP_SIFAT[g]}, sıcaklık ${simdi.sicaklik}°`;
  const fark = simdi.hissedilen - simdi.sicaklik;
  if (fark <= -2) {
    simdiCumle +=
      simdi.ruzgar >= 15
        ? `; rüzgarın etkisiyle ${simdi.hissedilen}° gibi hissediliyor`
        : `, hissedilen ${simdi.hissedilen}°`;
  } else if (fark >= 2) {
    simdiCumle +=
      simdi.nem >= 60 ? `; nemle birlikte ${simdi.hissedilen}° gibi hissediliyor` : `, hissedilen ${simdi.hissedilen}°`;
  }
  cumleler.push(`${simdiCumle}.`);

  // Günün kalanı: en yüksek
  const bugunKalan = saatlik.filter((h) => h.zaman.startsWith(gunluk[0].tarih));
  const zirve = enBuyuk(bugunKalan, (h) => h.sicaklik);
  if (zirve && zirve.sicaklik > simdi.sicaklik && zirve !== bugunKalan[0]) {
    cumleler.push(`Sıcaklık saat ${saat(zirve.zaman)} sularında ${zirve.sicaklik}° ile günün en yüksek değerine ulaşacak.`);
  } else if (bugunKalan.length > 3) {
    cumleler.push("Günün en sıcak saatleri geride kaldı; sıcaklık akşama doğru düşecek.");
  }

  // Gece
  const geceDip = enKucuk(
    saatlik.filter((h) => !h.gunduz),
    (h) => h.sicaklik,
  );
  if (geceDip) {
    cumleler.push(
      geceDip.sicaklik <= 0
        ? `Gece sıcaklık ${geceDip.sicaklik}° değerine kadar düşecek; don oluşabilir.`
        : `Gece en düşük ${geceDip.sicaklik}° bekleniyor.`,
    );
  }

  // Önümüzdeki 24 saatte yağış
  const enYuksekOlasilik = Math.max(0, ...saatlik.map((h) => h.yagisOlasiligi));
  const yagisSaati = saatlik.find((h) => h.yagisOlasiligi >= YAGISLI_OLASILIK || yagisliGrup(grup(h.kod)));
  if (yagisliGrup(g)) {
    const bitis = saatlik.find((h, i) => i > 0 && h.yagisOlasiligi < 30 && !yagisliGrup(grup(h.kod)));
    cumleler.push(
      bitis
        ? `Yağışın saat ${saat(bitis.zaman)} sularında zayıflaması bekleniyor.`
        : "Yağışın önümüzdeki saatlerde de sürmesi bekleniyor.",
    );
  } else if (yagisSaati === saatlik[0]) {
    cumleler.push(`Yakın saatlerde yağış görülebilir (olasılık en fazla %${enYuksekOlasilik}).`);
  } else if (yagisSaati) {
    cumleler.push(`Saat ${saat(yagisSaati.zaman)} sularından itibaren yağış ihtimali artıyor (en fazla %${enYuksekOlasilik}).`);
  } else if (enYuksekOlasilik >= 20) {
    cumleler.push(`Önümüzdeki 24 saatte yağış ihtimali düşük (en fazla %${enYuksekOlasilik}).`);
  } else {
    cumleler.push("Önümüzdeki 24 saatte yağış beklenmiyor.");
  }

  // Rüzgar (kuvvetli ise uyarılarda yer alır)
  const ruzgar = ozetler[0].ruzgar;
  if (ruzgar >= DIKKAT_RUZGAR && ruzgar < KUVVETLI_RUZGAR) {
    cumleler.push(`Rüzgar gün içinde zaman zaman ${ruzgar} km/s hıza ulaşabilir.`);
  }

  // Tek bir pratik sonuç
  if (yagisliGrup(g) || (yagisSaati && yagisSaati.yagisOlasiligi >= 60)) {
    cumleler.push("Dışarı çıkarken şemsiye almakta fayda var.");
  } else if (simdi.hissedilen <= 0) {
    cumleler.push("Dışarıda kalın giyinmek gerekiyor.");
  }

  return cumleler.join(" ");
}

function gelecegiAnlat(gunluk: Gunluk[], ozetler: GunOzeti[]): string {
  const adlar = gunluk.map((d, i) => gunAdi(d.tarih, i));
  const cumleler: string[] = [];

  // Yağış dönemleri (yarından itibaren)
  const yagisli = ozetler.map((o, i) => (i > 0 && o.yagisli ? i : -1)).filter((i) => i > 0);
  if (yagisli.length === 0) {
    cumleler.push("Önümüzdeki günlerde yağış beklenmiyor.");
  } else {
    const parcalar = araliklar(yagisli);
    const turlerAyni = new Set(parcalar.map(([a, b]) => turIfadesi(ozetler.slice(a, b + 1)))).size === 1;
    if (turlerAyni) {
      const tur = turIfadesi(yagisli.map((i) => ozetler[i]));
      cumleler.push(`${buyukHarf(gunlerIfadesi(yagisli, adlar))} ${tur} bekleniyor.`);
    } else {
      const ifadeler = parcalar.map(
        ([a, b]) => `${gunlerIfadesi(rangeOf(a, b), adlar)} ${turIfadesi(ozetler.slice(a, b + 1))}`,
      );
      cumleler.push(`${buyukHarf(liste(ifadeler))} bekleniyor.`);
    }
    const son = yagisli[yagisli.length - 1];
    if (yagisli.length >= 2 && son < gunluk.length - 1) {
      cumleler.push(`${buyukHarf(den(adlar[son + 1]))} itibaren hava yeniden düzeliyor.`);
    }
  }

  // Sıcaklık eğilimi
  const ileri = gunluk.slice(1);
  const enSicak = enBuyuk(ileri, (d) => d.enYuksek)!;
  const enSoguk = enKucuk(ileri, (d) => d.enYuksek)!;
  const bugunMax = gunluk[0].enYuksek;
  if (enSicak.enYuksek - bugunMax >= BELIRGIN_DEGISIM) {
    const i = gunluk.indexOf(enSicak);
    cumleler.push(`Sıcaklıklar yükseliyor; en yüksek değerin ${gunlerIfadesi([i], adlar)} ${enSicak.enYuksek}° olması bekleniyor.`);
  } else if (bugunMax - enSoguk.enYuksek >= BELIRGIN_DEGISIM) {
    const i = gunluk.indexOf(enSoguk);
    cumleler.push(`Belirgin bir soğuma var; ${gunlerIfadesi([i], adlar)} en yüksek sıcaklık ${enSoguk.enYuksek}° civarında kalacak.`);
  } else {
    const min = Math.min(...ileri.map((d) => d.enDusuk));
    const max = Math.max(...ileri.map((d) => d.enYuksek));
    cumleler.push(`Sıcaklıklarda büyük bir değişiklik beklenmiyor; değerler ${min}° ile ${max}° arasında seyredecek.`);
  }

  return cumleler.join(" ");
}

/** Dikkat gerektiren durumlar, önem sırasına göre en fazla 3 tane. */
function uyarilariBul(gunluk: Gunluk[], ozetler: GunOzeti[]): string[] {
  const adlar = gunluk.map((d, i) => gunAdi(d.tarih, i));
  const sec = (kosul: (o: GunOzeti, i: number) => boolean) =>
    ozetler.map((o, i) => (kosul(o, i) ? i : -1)).filter((i) => i >= 0);
  const gunler = (idx: number[]) => buyukHarf(gunlerIfadesi(idx, adlar));
  const uyarilar: string[] = [];

  const firtina = sec((o) => o.turler.includes("firtina"));
  if (firtina.length) uyarilar.push(`${gunler(firtina)} gök gürültülü sağanak bekleniyor.`);

  const ruzgar = sec((o) => o.ruzgar >= KUVVETLI_RUZGAR);
  if (ruzgar.length) {
    const max = Math.max(...ruzgar.map((i) => ozetler[i].ruzgar));
    const siddet = max >= FIRTINA_RUZGAR ? "fırtına şiddetinde" : "kuvvetli";
    uyarilar.push(`${gunler(ruzgar)} ${siddet} rüzgar bekleniyor (en fazla ${max} km/s).`);
  }

  const yogun = sec((o) => o.yagisli && o.yagis >= YOGUN_YAGIS_MM);
  if (yogun.length) {
    const max = Math.max(...yogun.map((i) => ozetler[i].yagis));
    uyarilar.push(`${gunler(yogun)} yoğun yağış bekleniyor (günlük en fazla ${max} mm).`);
  }

  const kar = sec((o) => o.turler.includes("kar"));
  if (kar.length) uyarilar.push(`${gunler(kar)} kar yağışı bekleniyor; yollarda buzlanmaya dikkat edin.`);

  const don = sec((o) => o.enDusuk <= 0);
  if (don.length) {
    const min = Math.min(...don.map((i) => ozetler[i].enDusuk));
    uyarilar.push(`${gunler(don)} don ve buzlanma riski var; en düşük sıcaklık ${min}°.`);
  }

  const sicak = sec((o) => o.enYuksek >= ASIRI_SICAK);
  if (sicak.length) {
    const max = Math.max(...sicak.map((i) => ozetler[i].enYuksek));
    uyarilar.push(`${gunler(sicak)} aşırı sıcak bekleniyor; en yüksek sıcaklık ${max}°.`);
  }

  const uv = sec((o, i) => i <= 2 && o.uv >= YUKSEK_UV);
  if (uv.length) {
    const max = Math.max(...uv.map((i) => ozetler[i].uv));
    uyarilar.push(`${gunler(uv)} UV indeksi yüksek (en fazla ${max}); öğle saatlerinde güneşten korunun.`);
  }

  return uyarilar.slice(0, 3);
}

function basligiYaz(data: WeatherData, ozetler: GunOzeti[]): string {
  const { simdi, gunluk } = data;
  const adlar = gunluk.map((d, i) => gunAdi(d.tarih, i));
  const g = grup(simdi.kod);
  let baslik = `${sicaklikSifati(Math.max(simdi.sicaklik, ozetler[0].enYuksek - 2))} ve ${GRUP_SIFAT[g]}`;

  const bugunYagisli = yagisliGrup(g) || ozetler[0].yagisli;
  const yagisli = ozetler.map((o, i) => (i > 0 && o.yagisli ? i : -1)).filter((i) => i > 0);
  if (!bugunYagisli && yagisli.length) {
    const [a, b] = araliklar(yagisli)[0];
    baslik += `, ${gunlerIfadesi(rangeOf(a, b), adlar)} ${turSifati(ozetler.slice(a, b + 1))}`;
  } else if (bugunYagisli && yagisli.length === 0) {
    baslik += ", yarından itibaren kuru";
  }
  return baslik;
}

export function durumuDegerlendir(data: WeatherData): DurumRaporu {
  const ozetler = gunOzetleri(data);
  return {
    baslik: basligiYaz(data, ozetler),
    bugun: bugunuAnlat(data, ozetler),
    gelecek: gelecegiAnlat(data.gunluk, ozetler),
    uyarilar: uyarilariBul(data.gunluk, ozetler),
  };
}

/** "Hissedilen" kutucuğu için kısa ve doğru açıklama. */
export function hissedilenAciklamasi(simdi: WeatherData["simdi"]): string {
  const fark = simdi.hissedilen - simdi.sicaklik;
  if (Math.abs(fark) < 2) return "Gerçek sıcaklığa yakın";
  if (fark < 0) {
    return simdi.ruzgar >= 15 ? "Rüzgar nedeniyle daha soğuk" : `Gerçek sıcaklıktan ${-fark}° daha soğuk`;
  }
  return simdi.nem >= 60 ? "Nem nedeniyle daha sıcak" : `Gerçek sıcaklıktan ${fark}° daha sıcak`;
}

// ============= KÜÇÜK YARDIMCILAR =============

function rangeOf(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}

function enBuyuk<T>(dizi: T[], f: (x: T) => number): T | undefined {
  return dizi.reduce<T | undefined>((m, x) => (m === undefined || f(x) > f(m) ? x : m), undefined);
}

function enKucuk<T>(dizi: T[], f: (x: T) => number): T | undefined {
  return dizi.reduce<T | undefined>((m, x) => (m === undefined || f(x) < f(m) ? x : m), undefined);
}

