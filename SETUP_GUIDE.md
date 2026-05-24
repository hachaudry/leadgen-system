# AI Lead Gen System — Setup Guide
## Complete in 35–45 minutes. No coding required.

---

## STEP 1 — Get your Google Places API Key (10 min)

1. Go to https://console.cloud.google.com
2. Click "Create Project" → name it "LeadGen" → click Create
3. In the search bar at top, search "Places API" → click it → click "Enable"
4. In the left menu go to "APIs & Services" → "Credentials"
5. Click "+ Create Credentials" → "API Key"
6. Copy the key (starts with "AIza...") — save it somewhere safe
7. Optional but recommended: click "Restrict Key" → under API restrictions select "Places API only"

💰 Cost: Google gives you $200 free credit monthly = ~10,000 searches free. You won't pay anything to start.

---

## STEP 2 — Get your Hunter.io API Key (5 min)

1. Go to https://hunter.io and create a free account
2. Upgrade to Starter plan ($49/mo) for 500 email searches/month
3. Go to https://hunter.io/api-keys
4. Copy your API key — save it somewhere safe

---

## STEP 3 — Get your Anthropic API Key (3 min)

1. Go to https://console.anthropic.com
2. Sign in with your Anthropic account
3. Click "API Keys" in the left menu
4. Click "Create Key" → copy it (starts with "sk-ant-...")
5. Add $5–10 credit to your account (Settings → Billing)

💰 Cost: ~$0.003 per lead generation run = less than $3/month at heavy use.

---

## STEP 4 — Create a GitHub Account (3 min)

1. Go to https://github.com and sign up for a free account
2. Verify your email

---

## STEP 5 — Upload the code to GitHub (5 min)

1. Go to https://github.com/new
2. Repository name: "leadgen-system"
3. Set to Private → click "Create repository"
4. Click "uploading an existing file"
5. Upload ALL files from the folder I gave you:
   - api/generate.js
   - api/email.js
   - frontend/index.html
   - vercel.json
6. Click "Commit changes"

---

## STEP 6 — Deploy on Vercel (5 min)

1. Go to https://vercel.com and sign up with your GitHub account
2. Click "Add New Project"
3. Find "leadgen-system" in the list → click "Import"
4. Click "Deploy" (no changes needed)
5. Wait ~1 minute for deployment
6. Vercel gives you a URL like: https://leadgen-system-abc.vercel.app

That is your tool URL. Bookmark it.

---

## STEP 7 — Add your API keys to the tool (2 min)

1. Open your Vercel URL
2. Click "Settings" (top right)
3. Paste your Google Places key
4. Paste your Hunter.io key
5. Paste your Anthropic key
6. Click "Save keys"

The keys are stored in your browser only — completely private.

---

## HOW TO USE IT DAILY

1. Open your Vercel URL
2. Pick a niche (Med Spa, Dental, Restaurant, etc.)
3. Pick a US city
4. Click "Generate leads"
5. Wait 15–20 seconds
6. See 10 real businesses with real emails, scores, and pain points
7. Click "Write email" on any hot lead
8. Copy the email and send it from Gmail
9. Click "Export CSV" to save all leads to a spreadsheet

---

## TROUBLESHOOTING

**"No businesses found"** → Try a bigger city or different niche spelling

**"Missing API keys"** → Click Settings and re-paste your keys

**Google Places error** → Make sure Places API is enabled in Google Cloud Console

**Hunter.io returning no emails** → Normal — not every domain has emails indexed. Use the Hunter.io link to search manually.

**Deployment fails on Vercel** → Make sure all 4 files are uploaded to GitHub correctly

---

## YOUR MONTHLY COSTS AT SCALE

| Usage | Google Places | Hunter.io | Anthropic | Total |
|-------|--------------|-----------|-----------|-------|
| 100 leads/mo | FREE (credit) | $49 | ~$1 | ~$50 |
| 500 leads/mo | FREE (credit) | $49 | ~$3 | ~$52 |
| 1000 leads/mo | ~$3 | $99 | ~$5 | ~$107 |
