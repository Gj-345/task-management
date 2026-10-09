# Task Management

Microservice-based task manager.

| Service | Stack | Port | Purpose |
|---|---|---|---|
| `auth-service` | Go, Gin, MySQL | 8080 | Register, login, user lookup, JWT issuing |
| `task-service` | Node.js, Express, MongoDB | 3002 | Task CRUD (requires JWT) |
| `notification-service` | Spring Boot, Java 21 | 8082 | Task e-mail notifications (requires JWT) |
| `frontend` | Next.js | 3000 | Web UI |

`auth-service`, `task-service` and `notification-service` must share the same `JWT_SECRET` (HS256).

## Run everything with Docker

```bash
cp .env.example .env   # fill in the values
docker compose up --build
```

Open http://localhost:3000.

## E-mail notifications

1. Enable 2-Step Verification on the Google account, then create an App Password at https://myaccount.google.com/apppasswords.
2. Put it in `.env` as `GMAIL_USER` and `GMAIL_APP_PASSWORD`, then `docker compose up -d notification-service`.

Recipients must be registered users, and each user may send 30 notifications per hour
(`NOTIFICATION_RATE_LIMIT_PER_HOUR`). Gmail itself allows roughly 500 messages per day.

## Access rules

- A user sees only tasks they created or that are assigned to them.
- The creator or the assignee can edit a task; only the creator can delete it or change the assignee.
- Login and register are limited to 10 requests per minute per IP.

## Development without Docker

Each service has its own `.env.example`.

```bash
cd auth-service && go test ./...
cd task-service && npm test
cd notification-service && ./mvnw test
cd frontend && npm run dev     # needs frontend/.env.local with the NEXT_PUBLIC_*_URL values
```

## Production checklist

- Set `CORS_ALLOW_ORIGIN` to the real frontend origin and use HTTPS.
- Use strong, unique values for `JWT_SECRET`, `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD`.
- Rate limits are in memory per instance; use a shared store (e.g. Redis) when running several replicas.
- The JWT is kept in `localStorage` (valid 24 h, no refresh). Move to httpOnly cookies plus refresh tokens if the threat model requires it.
