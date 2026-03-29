# ShopSense — Local Setup Guide

> Read this once. After setup, all you need is `npm run dev`.

---

## Prerequisites

Install these **before** anything else:

| Tool | Download | Check if installed |
|------|----------|--------------------|
| **Node.js 18+** | https://nodejs.org (choose LTS) | `node -v` in terminal |
| **Git** | https://git-scm.com | `git -v` in terminal |

---

## Step 1 — Get the Code (if you haven't already)

```bash
git clone https://github.com/YOUR_USERNAME/shop-sense.git
cd shop-sense
```

> If you already cloned it and opened it in VS Code, skip this step.

---

## Step 2 — Open a Terminal in VS Code

Press **Ctrl + `` ` ``** (backtick key, top-left of keyboard) to open the built-in terminal.  
Make sure the terminal shows the `shop-sense` folder path.

---

## Step 3 — Install Dependencies

```bash
npm install
```

This downloads all the packages the project needs (~1–2 minutes first time).

---

## Step 4 — Set Up Environment Variables

1. Copy the example file:
   ```bash
   copy .env.local.example .env.local
   ```
2. Open `.env.local` in VS Code and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
   > You can find these in your Supabase project → Settings → API.

---

## Step 5 — Start the Local Server

```bash
npm run dev
```

You will see output like:
```
▲ Next.js 15.x
- Local:  http://localhost:3000
- Ready in 1.2s
```

---

## Step 6 — Open the Website

Open your browser and go to:  
**http://localhost:3000**

The site will open — searches, login, and all features work locally.

---

## Daily Usage (after first setup)

Every time you want to run the site:
1. Open VS Code
2. Press **Ctrl + `** to open terminal
3. Type `npm run dev` and press Enter
4. Go to **http://localhost:3000** in your browser
5. Press **Ctrl + C** in the terminal to stop the server when done

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm: command not found` | Install Node.js from nodejs.org |
| `Error: Cannot find module` | Run `npm install` again |
| Page shows "Supabase not configured" | Check your `.env.local` file has correct keys |
| Port 3000 already in use | Change port: `npm run dev -- --port 3001` |

---

## What the Pages Look Like

| URL | What you see |
|-----|-------------|
| `http://localhost:3000` | Redirects to search |
| `http://localhost:3000/search` | Public product search (no login needed) |
| `http://localhost:3000/login` | Login page |
| `http://localhost:3000/register` | Register page |
| `http://localhost:3000/dashboard` | Dashboard (login required) |
