# 💰 Fintrackr — Personal Finance Tracker

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite)](https://sqlite.org)

A personal finance tracking application with an offline-first architecture. All data stays on your machine — no cloud, no accounts, no subscriptions.

---

## Features

- **Transaction tracking** — log income and expenses with categories
- **Local SQLite database** — all data stored on disk via Drizzle ORM
- **No cloud dependencies** — runs entirely offline after install
- **Clean UI** — built with shadcn/ui components and Tailwind CSS
- **Docker support** — containerized deployment available

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | App Router, server components |
| TypeScript | Type safety |
| Drizzle ORM | Database queries & migrations |
| SQLite | Local data storage (`.data/fintrackr.db`) |
| Tailwind CSS | Styling |
| shadcn/ui | UI component library |

---

## Getting Started

```bash
# Install dependencies
npm install

# Run database migrations
npx drizzle-kit push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker

```bash
docker build -t fintrackr .
docker run -p 3000:3000 -v fintrackr-data:/app/.data fintrackr
```

The `-v` flag persists your database across container restarts.

---

## Project Structure

```
Fintrackr/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   └── lib/
│       └── db/
│           └── schema.ts # Drizzle database schema
├── drizzle.config.ts     # Drizzle ORM configuration
├── Dockerfile            # Container setup
└── .data/                # SQLite database (gitignored)
```

---

## License

MIT
