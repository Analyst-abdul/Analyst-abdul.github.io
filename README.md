# 💸 FinTrack — Personal Budget PWA

A mobile-first Progressive Web App for personal budget & expense management.
Vanilla HTML/CSS/JS + Chart.js + Supabase. Deployable to GitHub Pages.

## Features
- Email/password auth with session persistence + forgot-password
- Multiple accounts (Cash, Bank, Wallet, UPI, Credit Card) with transfers
- Income / Expense / Transfer transactions, search & filters, image receipts
- Dynamic income/expense categories with emoji icons
- Monthly budgets with progress bars & overspend alerts
- Charts: line trend, pie, bar, income vs expense, savings
- Read-only sharing between users (view other users' summary)
- Realtime sync via Supabase Realtime
- Export to JSON / CSV / PDF
- Dark mode, installable PWA with offline app shell

---

## 1) Supabase Setup
1. Create a free project at https://supabase.com
2. In **SQL Editor**, paste & run `sql/schema.sql`
3. In **Authentication → Providers**, enable **Email** (disable "Confirm email" for fast local testing if you wish)
4. Copy your **Project URL** and **anon public key** from **Project Settings → API**
5. Edit `js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...'
   ```

The schema creates: `profiles`, `accounts`, `categories`, `transactions`, `budgets`, `shared_users`, `notifications`, plus a private `receipts` storage bucket, RLS policies (owner can write, owner + shared users can read), and a `handle_new_user` trigger that auto-creates profiles.

## 2) Run locally
Open `index.html` via any static server (service workers require http/https, not file://):
```bash
npx serve .
# or
python3 -m http.server 8080
```

## 3) Deploy to GitHub Pages
1. Create a new GitHub repo and push these files to `main`
2. Settings → **Pages** → Source: `main` / `(root)` → Save
3. Visit `https://<user>.github.io/<repo>/`
4. In Supabase **Auth → URL Configuration**, add your Pages URL to **Site URL** and **Redirect URLs** (for password reset & email confirm links)

## 4) Sharing data with another user
- Both users sign up
- Owner → **Settings → Sharing** → enter the other user's email
- The other user can now switch the user picker in the top-right to view (read-only) the owner's data

## 5) File structure
```
.
├── index.html
├── manifest.json
├── sw.js
├── README.md
├── css/styles.css
├── js/
│   ├── config.js          ← put your Supabase URL/key here
│   ├── supabaseClient.js
│   ├── utils.js
│   ├── auth.js
│   ├── data.js
│   ├── ui.js
│   ├── charts.js
│   └── app.js
├── assets/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── sql/schema.sql
```

## Security notes
- The anon key is public; security is enforced via RLS in `sql/schema.sql`.
- Receipts bucket is private; files are namespaced by `user_id/...` and only the owner can read them.
- Never put `service_role` keys in this client.

## Notes / Limits
- Notifications are in-app toasts (Web Push isn't included; can be added later).
- For local dev with email confirmation off, users can sign in immediately. In production keep it on.
