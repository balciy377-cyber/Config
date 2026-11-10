# YargıConfig v6 — Cloudflare Full Stack

Bu paket tek bir Cloudflare Worker projesidir: statik site + API + D1 + R2. `yargiconfig.com` DNS/route ayarını kendiliğinden değiştirmez. İlk dağıtımı workers.dev üzerinde test edebilirsin.

## 1) Gerekli kaynakları oluştur
Cloudflare Dashboard > Workers & Pages bölümünde veya Wrangler ile:

```bash
npx wrangler login
npx wrangler d1 create yargiconfig
npx wrangler r2 bucket create yargiconfig-media
```

D1 komutunun döndürdüğü `database_id` değerini `wrangler.toml` içindeki `REPLACE_WITH_D1_DATABASE_ID` yerine yaz. R2 bucket adını değiştirdiysen `bucket_name` değerini de güncelle.

## 2) Veritabanı şemasını yükle
Proje klasöründe:

```bash
npm install
npx wrangler d1 execute yargiconfig --remote --file=./schema.sql
```

## 3) Cloudflare Access ile admin'i koru
Cloudflare Zero Trust > Access > Applications > Add application > Self-hosted.

Aynı Worker hostname'i için iki uygulama oluştur:
- `https://WORKER-ADRESIN.workers.dev/admin*`
- `https://WORKER-ADRESIN.workers.dev/api/admin/*`

Her iki uygulamada da yalnızca kendi yönetici e-posta adresine izin veren bir Allow policy tanımla. Workers.dev hostname Access uygulamasına kabul edilmezse önce Worker'a kendi zone'unda geçici bir test alt alan adı bağla (ör. `test-admin.yargiconfig.com`) ve Access uygulamalarını bu hostname/path'leri kullanarak oluştur. Ana `yargiconfig.com` kök adresine route bağlama.

Worker Access JWT doğrulaması için `wrangler.toml` içindeki şu değerleri doldur:
- `ACCESS_TEAM_DOMAIN`: `takimadiniz.cloudflareaccess.com` (protokol olmadan)
- `ACCESS_AUD`: Access uygulamasının AUD tag'i
- `ADMIN_EMAILS`: izinli yönetici e-postaları, virgülle ayrılmış

`ACCESS_AUD` her iki Access uygulamasında da aynı olacak şekilde aynı Access app policy/uygulama yapılandırmasını kullanmak yerine iki farklı AUD üretirse, iki uygulamanın AUD değerini kodda doğrulama listesi olarak destekleyecek şekilde güncellemek gerekir. En kolay kurulum: `/admin*` ve `/api/admin/*` için aynı hostname üzerinde tek Access uygulamasını `/admin*` ve `/api/admin/*` yollarını kapsayan path pattern ile tanımla (Dashboard'ın path pattern kabulüne göre).

## 4) Deploy

```bash
npx wrangler deploy
```

Çıkan `https://yargiconfig.<subdomain>.workers.dev` adresini aç. `/` ana sayfa, `/admin/` yönetim panelidir.

## 5) Test listesi
- Ana sayfada katalog boş görünmeli.
- `/admin/` açılmalı; Access oturumu olmadan yönetim API'si 401 dönmeli.
- Access ile izinli e-posta üzerinden giriş yapınca kayıt ekleme/düzenleme/silme çalışmalı.
- JPG/PNG/WebP kapak yükleme (5 MB sınırı) çalışmalı.
- Kaydedilen kayıt ana sayfada görünmeli; Telegram butonu gönderiye gitmeli.

## Güvenlik ve kapsam
- `GET /api/items` herkese açık katalog okumasıdır.
- Yazma ve upload endpoint'leri `/api/admin/*` altında; Cloudflare Access JWT ve `ADMIN_EMAILS` ile doğrulanır.
- Görseller R2'de saklanır ve `/media/*` üzerinden herkese açık sunulur; gizli dosya değildir.
- Site üzerinden dosya indirme yoktur; Telegram gönderisine yönlendirme vardır.
- Bu Worker'ı `yargiconfig.com` alan adına bağlamak bu paketin parçası değildir. Önce workers.dev/ayrı test alt alanında doğrula; canlıya geçerken mevcut sitenin yedeğini al ve ancak ondan sonra domain route değiştir.
