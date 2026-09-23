# Anacra Pack — Backend

API Express + TypeScript + MySQL pour le TCG **Anacra Pack**. Architecture calquée sur `level-up-your-day-back` : `routes` → `controllers` → `services` → `db`.

## Setup

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev          # http://localhost:3001
```

Compte admin (aucun catalogue n’est seedé — crée univers, cartes et boosters depuis l’UI) :

- `admin@anacra.local` / `password`

## API

Base : `http://localhost:3001/api`

### Auth

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | — |
| POST | `/auth/login` | — |
| GET | `/auth/profile` | Bearer |

### Catalogue

| Method | Path | Auth |
|--------|------|------|
| GET | `/catalog/universes` | Bearer |
| GET | `/catalog/editions` | Bearer |
| GET | `/catalog/cards` | Bearer |
| GET | `/catalog/boosters` | Bearer |

### Collection

| Method | Path | Auth |
|--------|------|------|
| GET | `/collection/boosters` | Bearer |
| POST | `/collection/boosters/:id/open` | Bearer |
| GET | `/collection/notebooks` | Bearer |
| GET | `/collection/carnet` | Bearer |
| GET | `/collection/notebooks/:editionId` | Bearer |
| POST | `/collection/notebooks/:editionId/place` | Bearer |
| POST | `/collection/notebooks/:editionId/unplace` | Bearer |

### Admin

| Method | Path | Auth |
|--------|------|------|
| POST | `/admin/universes` | Admin |
| POST | `/admin/editions` | Admin |
| POST | `/admin/cards` | Admin |
| PATCH | `/admin/cards/:id` | Admin |
| POST | `/admin/boosters` | Admin |
| GET | `/admin/users` | Admin |
| POST | `/admin/users/:id/boosters` | Admin |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | 127.0.0.1 | MySQL host |
| `DB_PORT` | 3306 | MySQL port |
| `DB_USER` | root | MySQL user |
| `DB_PASSWORD` | root | MySQL password |
| `DB_NAME` | anacra_pack | Database name |
| `PORT` | 3001 | API port |
| `JWT_SECRET` | — | Change in production |
| `CORS_ORIGIN` | http://localhost:5173 | Front origin |
| `OPENAI_API_KEY` | — | Optional, IA cards |
| `GIPHY_API_KEY` | — | Optional, GIF search |

## Docker

Image pushed by Jenkins/kaniko as `villaroyakevin/anacra-pack-back:latest` (same pipeline as `level-up-your-day-back`).

```bash
docker build -t villaroyakevin/anacra-pack-back:latest .
docker push villaroyakevin/anacra-pack-back:latest
```

Kubernetes manifests live in `Anacra-Cards/infra` (`anacra/`).
