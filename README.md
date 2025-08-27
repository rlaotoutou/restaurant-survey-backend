# Restaurant Survey Backend (Express + SQLite) — Railway Ready

Minimal backend to collect submissions from your existing HTML survey. Stores data in SQLite.

## 1) Local run
```bash
npm install
cp .env.example .env
# optionally edit .env
npm start
# -> server on http://localhost:3000
```

## 2) Railway deploy (personal-friendly)
1. Push this folder to a GitHub repo.
2. On Railway: **New Project → Deploy from GitHub** → select your repo.
3. In Railway → Variables:
   - `CORS_ORIGIN` = your front-end origin(s), e.g. `https://your-frontend.example.com`
   - `ADMIN_KEY` = a strong random string
   - `DB_FILE` = `/data/surveys.db`
4. In Railway → **Add a Volume** and mount it at `/data` (so your SQLite file persists).
5. Deploy. Note the public URL, e.g. `https://your-app.up.railway.app`.

> If you don't mount a volume, the SQLite file may be lost on redeploys. For production-grade persistence you can also switch to Railway Postgres later.

## 3) API
- `GET /api/health` → `{ ok: true }`
- `POST /api/saveSurvey` → body = JSON fields from your form → `{ ok: true, id }`
- `GET /api/surveys?limit=100&offset=0` (admin) → header `x-admin-key: <ADMIN_KEY>`
- `GET /api/export` (admin) → CSV download → header `x-admin-key: <ADMIN_KEY>`

## 4) Front-end hookup (inside your HTML)
Add a base URL constant and call the API when user clicks “保存数据”:
```html
<script>
  const API_BASE = 'https://your-app.up.railway.app'; // ← replace with your Railway URL

  // replace your existing submitBtn click with this:
  submitBtn.addEventListener('click', async function() {
    if (validateStep(currentStep)) {
      const formData = {
        storeName: document.getElementById('storeName').value,
        businessType: document.getElementById('businessType').value,
        monthlyRevenue: document.getElementById('monthlyRevenue').value,
        foodCost: document.getElementById('foodCost').value,
        laborCost: document.getElementById('laborCost').value,
        rentCost: document.getElementById('rentCost').value,
        dailyCustomers: document.getElementById('dailyCustomers').value,
        seats: document.getElementById('seats').value,
        onlineRevenue: document.getElementById('onlineRevenue').value,
        marketingCost: document.getElementById('marketingCost').value,
        repeatPurchases: document.getElementById('repeatPurchases').value,
        totalCustomers: document.getElementById('totalCustomers').value,
        utilityCost: document.getElementById('utilityCost').value,
        averageRating: document.getElementById('averageRating').value,
        badReviews: document.getElementById('badReviews').value,
        totalReviews: document.getElementById('totalReviews').value,
        socialMediaMentions: document.getElementById('socialMediaMentions').value,
        serviceBadReviewRate: document.getElementById('serviceBadReviewRate').value,
        tasteBadReviewRate: document.getElementById('tasteBadReviewRate').value
      };
      try {
        const resp = await fetch(`${API_BASE}/api/saveSurvey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || '提交失败');
        alert('数据已提交！记录编号：' + data.id);
        // 可选：仍然保留本地保存与下一步
        savedData.push({ ...formData, timestamp: new Date().toISOString() });
        currentStep++; showStep(currentStep);
      } catch (e) {
        alert('提交失败：' + e.message);
      }
    }
  });
</script>
```

## 5) Test with curl
```bash
curl -X POST https://your-app.up.railway.app/api/saveSurvey     -H 'Content-Type: application/json'     -d '{"storeName":"示例店铺","businessType":"快餐","monthlyRevenue":150000}'
```

## 6) Export CSV (admin)
```bash
curl -H "x-admin-key: $ADMIN_KEY" https://your-app.up.railway.app/api/export -o surveys.csv
```
# restaurant-survey-backend
# restaurant-survey-backend
