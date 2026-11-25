# ⛅ 7 Günlük Hava Durumu Uygulaması

Bu proje, modern web teknolojilerini kullanarak geliştirdiğim, kullanıcı dostu ve minimal tasarıma sahip bir hava durumu sorgulama uygulamasıdır. Güncel API entegrasyonu ve TypeScript odaklı mimarisiyle temiz bir kod yapısına sahiptir.

## 🚀 Öne Çıkan Özellikler

- **Güncel Veri Akışı:** Anlık, saatlik ve 7 günlük verileri [Open-Meteo](https://open-meteo.com)'dan çeker (API anahtarı gerektirmez).
- **Yapay Zeka Durum Değerlendirmesi:** Uygulamanın kendi değerlendirme sistemi, verileri Claude ile yorumlayıp kısa ve nesnel bir durum raporu ile dikkat gerektiren uyarıları (don, kuvvetli rüzgar, yoğun yağış vb.) gösterir. Sohbet etmez, yalnızca durumu bildirir.
- **Astryx Tasarım Sistemi:** Arayüz, Meta'nın açık kaynak tasarım sistemi [Astryx](https://astryx.atmeta.com) ile kuruldu; açık/koyu modu sistem ayarına göre izler.
- **Minimalist Tasarım:** "Focus on data" prensibiyle, kullanıcıyı yormayan sade ve modern bir arayüz.
- **7 Günlük Tahmin ve Saatlik Grafik:** Önümüzdeki 24 saatin sıcaklık grafiği ve 1 haftalık tahmin listesi.
- **Mobil Uyumlu (Responsive):** Telefon, tablet ve masaüstü cihazlar için tam uyumlu layout.
- **CORS Proxy Çözümü:** Dış API'lere erişimde yaşanan CORS sorunlarını Next.js API Routes (Proxy) ile profesyonelce çözdüm.
- **Tip Güvenliği:** TypeScript interfaces kullanarak veri tutarlılığını sağladım.

## 🛠️ Teknik Stack

- **Frontend:** React 19, Next.js 16 (App Router)
- **UI:** Astryx (`@astryxdesign/core`, neutral tema), Tailwind CSS köprüsü, Recharts, Lucide ikonları
- **Yapay Zeka:** Anthropic Claude API (`@anthropic-ai/sdk`, yapılandırılmış çıktı)
- **Language:** TypeScript (Profesyonel kod yapısı)
- **Data Fetching:** Fetch API & Next.js API Routes

## 💡 Neden Bu Projeyi Yaptım?

Bu projeyi geliştirirken amacım hem modern Next.js 16 özelliklerini (Client/Server components) pekiştirmek hem de API yönetiminde karşılaşılan yaygın sorunlara (CORS, error handling vb.) pratik çözümler üretmekti. Özellikle minimalist tasarım ve kullanıcı deneyimi (UX) arasındaki dengeyi kurmaya odaklandım.

## 🏁 Kurulum

Projeyi yerelinizde çalıştırmak için:

1. Depoyu klonlayın veya indirin.
2. `npm install` ile bağımlılıkları yükleyin.
3. Yapay zeka değerlendirmesi için proje kökünde `.env.local` dosyası oluşturup Claude API anahtarınızı ekleyin:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Anahtar yoksa uygulama yine çalışır; yalnızca değerlendirme kartı gösterilmez. Vercel'de aynı değişkeni proje ayarlarındaki Environment Variables bölümüne ekleyin.
4. `npm run dev` komutu ile uygulamayı başlatın.
5. Tarayıcıda `localhost:3000` adresine gidin.

---

_Bu proje geliştirme sürecimin bir parçasıdır. Sorularınız veya geri bildirimleriniz için benimle iletişime geçebilirsiniz._
