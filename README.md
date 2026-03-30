# Internet Library

A web-based library application for managing a book catalog, loans, users, and notifications. Book metadata is sourced from the Open Library API.

---

## 1. Prerequisites

| Software | Minimum version | Notes |
|---|---|---|
| Docker Desktop | 4.x | Required for running all services |
| Docker Compose | 2.x | Included with Docker Desktop |
| Git | any | For cloning the repository |
| Node.js | 20.x | Only for local frontend development without Docker |
| Python | 3.13 | Only for local backend development without Docker |

---

## 2. First-time setup

```bash
# Clone the repository
git clone <repository-url>
cd Internet-Library

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Build and start all services
docker compose up --build
```

> **Note:** On first run Docker will download base images and install all dependencies. This may take 5–10 minutes depending on your internet connection.

---

## 3. Running the application

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Stop all services
docker compose down

# View logs (all services)
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f celery
```

---

## 4. Application URLs

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:3000 | Main application |
| Backend API | http://localhost:8000/api/v1/ | REST API |
| Django Admin | http://localhost:8000/django-admin/ | Django admin panel |
| API Docs (Swagger) | http://localhost:8000/api/schema/swagger-ui/ | Interactive API documentation |
| API Docs (ReDoc) | http://localhost:8000/api/schema/redoc/ | Alternative API documentation |

---

## 5. Creating an admin account

### Method A — via Django management command (recommended)

```bash
# Create superuser via terminal
docker compose exec backend python manage.py createsuperuser

# Then set the role to admin (required for frontend admin panel access)
docker compose exec backend python manage.py shell -c "
from apps.users.models import User
u = User.objects.get(email='your@email.com')
u.role = 'admin'
u.save()
print(f'Done — {u.email} is now an admin')
"
```

### Method B — via Django Admin panel

1. First create a superuser using Method A
2. Go to http://localhost:8000/django-admin/
3. Log in with the superuser credentials
4. Go to **Users → Add User**
5. Fill in the form and set **Role** to `admin`
6. Save

---

## 6. Running tests

```bash
# Backend tests
docker compose exec backend pytest apps/ -v

# Backend tests with coverage report
docker compose exec backend pytest apps/ --cov=apps --cov-report=term-missing

# Frontend tests
docker compose exec frontend npm run test

# Frontend type check
docker compose exec frontend npm run type-check

# Frontend lint
docker compose exec frontend npm run lint
```

---

## 7. Useful development commands

```bash
# Run Django migrations after model changes
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Open Django shell
docker compose exec backend python manage.py shell

# Import a book from Open Library by ISBN
docker compose exec backend python manage.py shell -c "
from apps.catalog.tasks import import_book_task
import_book_task.delay('9780261102217')
"

# Generate library statistics report
docker compose exec backend python manage.py generate_report

# Clear Redis cache
docker compose exec redis redis-cli FLUSHDB

# Access PostgreSQL directly
docker compose exec postgres psql -U postgres -d library_db
```

---

## 8. Environment variables

Key variables in `backend/.env`:

| Variable | Description | Example |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django secret key — change in production | `your-secret-key-here` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@postgres:5432/library_db` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `EMAIL_HOST_USER` | SMTP email address for sending notifications | `library@gmail.com` |
| `EMAIL_HOST_PASSWORD` | SMTP email password or app password | `your-app-password` |
| `DJANGO_SETTINGS_MODULE` | Settings module to use | `config.settings.development` |

---

## 9. Troubleshooting

**Docker containers not starting:**

```bash
# Check which port is already in use
docker compose ps
docker compose logs backend
```

**Database connection error:**

```bash
# Restart postgres and run migrations
docker compose restart postgres
docker compose exec backend python manage.py migrate
```

**Frontend cannot reach backend (CORS or network error):**

```bash
# Verify NEXT_PUBLIC_API_URL in frontend/.env.local
cat frontend/.env.local
# Should contain: NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**Celery tasks not running:**

```bash
# Check Celery worker logs
docker compose logs celery
docker compose logs celery-beat

# Restart workers
docker compose restart celery celery-beat
```

**Changes not reflected after code edit:**

```bash
# Rebuild the affected service
docker compose up --build backend
docker compose up --build frontend
```
