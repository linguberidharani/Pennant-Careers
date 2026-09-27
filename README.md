# Pennant Careers — Recruitment Portal

A responsive, multi-tab careers/recruitment portal styled after Pennant's brand
(orange `#f47920` + black + white/light-blue, `pennant future ready` logo), with a
password-protected admin panel to manage registered candidates.

Built with **Node.js + Express**. Applications are stored in **MongoDB** when configured,
otherwise in a **local JSON file** — so local testing needs no database, and production
keeps data safely.

> Demo / student project build — not the official Pennant Technologies website.
> Applications are stored only where you configure and are not sent anywhere else.

---

## Tabs

| Tab | What it shows |
|-----|----------------|
| **Home** | Hero, company stats, featured 2027 walk-in, why-join, recognition |
| **Open roles** | Current openings (the Visakhapatnam SQA role) |
| **Job detail** | Full JD, eligibility, 4-round process, prep guide, walk-in schedule |
| **Life at Pennant** | Team, benefits, offices |
| **FAQ** | Common questions |
| **Apply** | Application form → saved, returns a reference ID |
| **Admin** | 🔒 Sign-in protected — view/manage candidates (open `/#admin`) |

---

## 1. Requirements

- [Node.js](https://nodejs.org/) 18 or newer (`node -v`, `npm -v`)

## 2. Configure (create your `.env`)

Copy the template and fill it in:

```bash
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux
```

Then edit `.env`:

```
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=<long random string>
MONGODB_URI=                # leave empty to use the local JSON file
PORT=3000
```

Generate a good `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Run

```bash
npm install
npm start
```

Open **http://localhost:3000** — admin at **http://localhost:3000/#admin**.

> With `MONGODB_URI` empty, the startup log says `Storage: local JSON file`.
> With it set, it says `Storage: MongoDB`.

Auto-restart while developing: `npm run dev`.

---

## 4. Set up MongoDB (MongoDB Atlas — free)

1. Create a free account at **https://www.mongodb.com/cloud/atlas** and create a
   free **M0 cluster**.
2. **Database Access** → Add a database user (username + password). Remember these.
3. **Network Access** → Add IP `0.0.0.0/0` (allow from anywhere) so your host can connect.
4. **Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Put your username/password in it, and add a database name (`pennant`) before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/pennant?retryWrites=true&w=majority
   ```
6. Paste that as `MONGODB_URI` in your `.env` (locally) or in your host's env vars (deploy).

Now applications persist in MongoDB and survive restarts and redeploys.

---

## 5. Deploy to Render (recommended for this app)

1. Push the project to GitHub.
2. **https://render.com** → sign in with GitHub → **New + → Web Service** → pick your repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment** → add variables:
   ```
   ADMIN_PASSWORD = your-strong-password
   SESSION_SECRET = <long random string>
   MONGODB_URI    = <your Atlas connection string>
   NODE_ENV       = production
   ```
   (Do **not** set `PORT` — Render provides it.)
5. **Create Web Service** → you get a URL like `https://pennant-careers.onrender.com`.

Notes: on Render's **free** tier the service sleeps after ~15 min idle (first request
after that is slow). With `MONGODB_URI` set, your candidate data is safe regardless.

---

## 6. Deploy to Vercel

This app serves the frontend **and** the API together, so on Vercel you deploy the
**whole project as one** — Vercel runs `server.js` as a serverless function that serves
your pages and the API from the same URL (so the admin login cookie works). A
`vercel.json` is already included.

Because Vercel's filesystem is read-only, **`MONGODB_URI` is required** here (the local
JSON-file mode won't persist on Vercel).

1. Push the project to GitHub.
2. **https://vercel.com** → sign in with GitHub → **Add New → Project** → import your repo.
3. **Settings → Environment Variables** → add:
   ```
   ADMIN_PASSWORD = your-strong-password
   SESSION_SECRET = <long random string>
   MONGODB_URI    = <your Atlas connection string>
   NODE_ENV       = production
   ```
   (Don't set `PORT` — Vercel handles it.)
4. **Deploy.** You get a URL like `https://pennant-careers.vercel.app`.
5. Verify: open the URL, submit a test application, then sign in at `/#admin` and check
   it appears.

The included `vercel.json` already routes all requests to `server.js` and bundles the
`public/` and `data/` folders, so no extra config is needed.

---

## Project structure

```
pennant-careers/
├── server.js              # Express server + API
├── db.js                  # storage layer (MongoDB or JSON file)
├── vercel.json            # Vercel serverless config
├── package.json
├── .env.example           # copy to .env and fill in
├── .gitignore             # ignores node_modules and .env
├── README.md
├── data/
│   ├── jobs.json          # job postings (edit to add/change roles)
│   └── applications.json  # used only in local file mode
└── public/
    ├── index.html
    ├── css/styles.css
    ├── js/app.js
    └── assets/images/     # logo, team, awards, banking visuals
```

## API

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| `GET`  | `/api/jobs` | public | List roles |
| `GET`  | `/api/jobs/:id` | public | Role detail |
| `POST` | `/api/applications` | public | Submit an application |
| `POST` | `/api/admin/login` | public | Admin sign in |
| `POST` | `/api/admin/logout` | public | Admin sign out |
| `GET`  | `/api/admin/me` | admin | Check session |
| `GET`  | `/api/applications` | admin | List applications |
| `PATCH`| `/api/applications/:id` | admin | Update status |
| `GET`  | `/api/applications.csv` | admin | Export CSV |

## Security checklist before deploying

1. Strong `ADMIN_PASSWORD` (never `admin123`).
2. Fixed random `SESSION_SECRET`.
3. Set `MONGODB_URI` (Atlas) so data persists.
4. `NODE_ENV=production` and serve over HTTPS (the admin cookie is then marked `Secure`).
5. Never commit `.env` — it's git-ignored.

## Editing content

- **Jobs:** edit `data/jobs.json` (`"featured": true` pins one to Home).
- **FAQs:** the `FAQS` array in `public/js/app.js`.
- **Colours/fonts:** CSS variables at the top of `public/css/styles.css`.
