# 🐉 MMXM Tarayıcı — MEXC Perpetual

MEXC vadeli (perpetual) grafiklerinde **Market Maker Buy/Sell Model (MMXM)** setup'larını
otomatik tespit edip grafik üzerine çizen tek dosyalık web uygulaması.

## Kullanım

`index.html` dosyasını tarayıcıda aç — hepsi bu. Kurulum gerekmez.

> Canlı veri için internet bağlantısı gerekir. Tüm veri kaynakları engellenirse
> uygulama gömülü BTC_USDT 15dk örnek verisiyle çalışmaya devam eder.

1. **Coin seç** — kutuya yaz (ör. `SOL_USDT`) ya da hazır butonları kullan.
   Liste, MEXC'in tüm USDT perpetual sembolleriyle otomatik dolar.
2. **Zaman dilimi seç** — 5dk / 15dk / 30dk / 1s / 4s / 1G.
3. **Tara 🔍** — bulunan modeller arasında ◀ ▶ ile gezin.

## Tespit edilen model bileşenleri

| # | Bileşen | Açıklama |
|---|---------|----------|
| ① | Likidite süpürme | Önceki swing high/low'un alınması (buyside/sellside likidite) |
| — | **SMR** | Smart Money Reversal — süpürme sonrası dönüş tepesi/dibi |
| ② | **MSB / MSS** | Piyasa yapısı kırılımı (son swing seviyesinin altında/üstünde kapanış) |
| ③ | **BOS** | Break of Structure — impuls ekstremumunun kırılıp devam etmesi |
| ④ | **FVG** | Fiyat boşluğu — düşük riskli giriş bölgesi (premium/discount tarafında) |
| ⑤ | **DOL** | Draw on Liquidity — hedef likidite (orijinal konsolidasyon likiditesi) |

Ek olarak çizilir: **orijinal konsolidasyon** kutusu, **$$$ dağıtım/birikim** bölgesi,
**2ND LEG**, giriş/stop/hedef çizgileri ve **R:R** oranı.

## Checklist (yan panel)

Her model için 5 maddelik kontrol listesi işaretlenir:

- HTF (Orderflow) yönü — Bullish/Bearish uyumu
- DOL (likidite çizimi) belirlendi mi
- HTF PD Array / likidite alındıktan sonra SMR
- Curve'ün sellside/buyside'ından giriş mi (FVG premium/discount bölgede)
- Sadece 2. dağıtım bacağından giriş (BOS sonrası devam)

## Veri kaynakları

Sırayla denenir: MEXC Contract API → CORS proxy'leri → Binance Futures → Bybit →
gömülü örnek veri. Aktif kaynak sol üstte gösterilir.

## Uyarı

Bu araç eğitim amaçlıdır; yatırım tavsiyesi değildir. Tespitler algoritmiktir ve
her zaman doğru olmayabilir — girişten önce kendi analizinle teyit et.
