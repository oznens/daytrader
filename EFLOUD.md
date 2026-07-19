# Efloud Stil Analizi (gayriresmî)

Bu doküman, @Efloud'un herkese açık X arşivinden (9.671 tweet, 2021→2026, 1.530 grafik
görseli) çıkarılan ve bu projedeki "Efloud Stili" modunun dayandığı gözlemleri özetler.
Kişisel eğitim amaçlıdır; Efloud ile bir bağı veya onayı yoktur, yatırım tavsiyesi değildir.

## Grafik estetiği (görsel analizden)

- TradingView **krem/açık zemin**, **monokrom siyah mumlar** (yükselişte içi boş)
- **Tam genişlik pastel şeritler**: kırmızımsı = direnç/arz bölgesi, yeşilimsi = destek/talep
- Sağ eksende renkli fiyat etiketleri: kırmızı (direnç), yeşil (destek), siyah (açılışlar)
- Etiketli seviyeler: **Range High / Range Low / EQ (Equilibrium) / Major S/R** ve
  **WO / PWO / MO / PMO** (haftalık/aylık açılışlar), YO (yıllık)
- **Mavi yüzen fiyat etiketleri** (giriş/önemli seviye) + ince kılavuz çizgisi
- **Projeksiyon kutusu**: girişten hedefe lavanta kutu, yeşil ok, `fark (%) hacim` ölçüm metni
- **Beyaz zeminli açıklama notları**: kısa, sade Türkçe beklenti cümleleri; ⚡ işareti
- HTF grafiklerde paralel **trend kanalı**, kesikli **Major S/R**

## Terminoloji (9.485 kendi tweetinde)

| Kavram | Sıklık | | Kavram | Sıklık |
|---|---|---|---|---|
| yapı / structure | 609 | | HTF / LTF | 753 |
| destek / support | 713 | | direnç / resistance | 509 |
| pozisyon | 544 | | stop | 368 |
| long / short | 686 | | entry / giriş | 362 |
| risk | 288 | | BE (breakeven) | 217 |
| range | 194 | | EQ | 142 |
| kırılım | 108 | | likidite | 76+ |
| imbalance | 77 | | swing | 149 |

## İşlem yönetimi imzaları

- **"stop->entry"** — 171 kez; TP sonrası stopu girişe çekme, en belirgin imzası:
  *"Aralarda TP alın, stop->entry yapın"*, *"Kâr alın, stop->entry yapın"*
- **Kademeli TP**: *"Closed 50% of it from WO and stop is moved to entry-level"*,
  *"Left 10% portion for extreme pump situation"*
- **Geçersizlik kalıbı**: *"Yeşil çizgi altı kapanış = stop"* — seviye + "altı/üstü kapanış = stop"
- Başlık formatı: **"$COIN | Update"**, **"$COIN | HTF Update"**, "$COIN | Pozisyon Güncellemesi"

## Metodoloji (eğitim içerikleri + tweetlerden)

1. **HTF → LTF hiyerarşisi**: önce yüksek zaman dilimi yapısı ve bölgeleri, sonra düşük
   zaman diliminde tetik
2. **Bölge bazlı düşünme**: çizgi değil bölge; destek/direnç şeritleri, EQ ile premium/discount
3. **Likidite + deviation**: range/tepe dışına sapma ve geri dönüş = likidite alımı
4. **Yapı kırılımı + retest** girişi; Efloud Order Block (birikimi sonlandıran son karşıt mum)
5. **Plan B**: her analizde alternatif senaryo; geçersizlik seviyesi baştan belli
6. **Risk yönetimi**: kademeli kâr, stop->entry, pozisyonun bir kısmını uç senaryoya bırakma

## Uygulamadaki karşılıkları

| Efloud öğesi | Uygulamadaki karşılığı |
|---|---|
| Destek/direnç şeritleri | HTF swing kümelemesiyle `findZones()` pastel şeritler |
| WO/PWO/MO/PMO | `computeOpenLevels()` otomatik açılış seviyeleri |
| EQ / Range High-Low | Dealing range %50 çizgisi + uç etiketleri |
| Deviation / likidite alımı | Süpürme tespiti + pastel deviation kutusu |
| EOB girişi | MSB öncesi son karşıt mum gövdesi, retest girişi |
| TP1/TP2 + stop->entry | Girişle hedef arasındaki ilk bölge = TP1; panelde BE notu |
| Projeksiyon kutusu | Girişten TP2'ye % ölçümlü lavanta kutu |
| ⚡ not kutusu | Setup'ı onun üslubuyla özetleyen otomatik açıklama |
