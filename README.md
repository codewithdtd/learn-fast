<div align="center">

# Learn Fast

### English vocabulary. Active recall. Lasting progress.

Build a vocabulary library, practise with bilingual flashcards, and return when your next review is due.

**Next.js 16 · React 19 · FastAPI · SQLAlchemy · SQLite / PostgreSQL**

[Get started](#quick-start) · [Explore features](#features) · [Learning workflow](#learning-workflow) · [Configuration](#configuration) · [Development](#development--verification)

</div>

---

## Overview

Learn Fast is an English–Vietnamese vocabulary learning application that combines Excel imports, optional AI-assisted content creation, round-based study sessions, and sheet-level spaced repetition. It runs locally with SQLite and supports PostgreSQL through the psycopg driver.

Vocabulary is organized into **workbooks → study sheets → flashcards**. Each card contains an English phrase, its meaning, and optional example sentences. A shared library makes content available to learners and guests, while administrators manage imports and library changes.

## Features

| Area | What you can do |
| --- | --- |
| **Vocabulary library** | Import multi-sheet `.xlsx` workbooks, browse sheets, inspect table views, and manage names and priorities as an administrator. |
| **Flashcard practice** | Study English → Vietnamese, Vietnamese → English, or mixed directions; choose all cards or weak cards. |
| **Mastery rounds** | Record **Again** or **Remembered**, then repeat forgotten cards or the full set until the latest round reaches 100% recall. |
| **Quick Recall** | Run a shorter recognition exercise and identify vocabulary that needs more attention. |
| **Spaced repetition** | Track review dates and sheet-level progress with automatic session ratings and a backend scheduler supporting **Forgot**, **Hard**, **Good**, and **Easy**. |
| **AI content tools** | Generate cards by topic or extract useful phrases from a passage, preview the results, and save them to new or existing content. Requires an AI endpoint and administrator access. |
| **Pronunciation** | Listen to English phrases through the browser's speech synthesis and use study keyboard shortcuts. |
| **Daily progress** | View due reviews, active sessions, new sheets, weak cards, recent activity, a check-in calendar, and study streaks. |
| **Accounts and alerts** | Register, sign in with JWT authentication, change passwords, and view in-app notifications. |
| **Appearance** | Switch between Light, Dark, Retro Farm, and Playful EdTech themes on responsive layouts. |

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Excel workbook format](#excel-workbook-format)
- [Learning workflow](#learning-workflow)
- [Accounts and permissions](#accounts--permissions)
- [Architecture and project structure](#architecture--project-structure)
- [Pages and API](#pages--api)
- [Development and verification](#development--verification)
- [Deployment checklist](#deployment-checklist)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Quick start

The commands below use **Windows PowerShell** and start from the repository root. Python 3.13 and Node.js 22 are the documented development targets; install npm alongside Node.js. Other platforms can use the equivalent virtual environment paths and run each service separately.

### 1. Prepare local configuration

Copy the example files on a fresh checkout. Preserve your existing local files if you have already configured the project.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.local.example frontend/.env.local
```

### 2. Install dependencies

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm.cmd --prefix frontend ci
```

`npm ci` uses `frontend/package-lock.json`. If your checkout does not include that lockfile, use `npm.cmd --prefix frontend install` instead.

### 3. Initialize the database

```powershell
Set-Location backend
New-Item -ItemType Directory -Force data | Out-Null
.\.venv\Scripts\python.exe -m alembic upgrade head
Set-Location ..
```

By default, the database is stored at `backend/data/app.db`. Run backend commands from `backend/` so relative database paths and `.env` loading resolve correctly.

### 4. Create a local administrator

On a fresh local database, initialize the account needed to import vocabulary:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m scripts.seed_admin
Set-Location ..
```

The default local login is **`admin` / `admin123`**, with email `admin@example.com`. The account is created by this command; it is not automatically created at application startup.

> **Existing database:** this seed script transfers **all workbooks** to the selected administrator, including workbooks with another owner. It also promotes an existing matching account without resetting its password. Use it intentionally when working with populated databases. See [Accounts and permissions](#accounts--permissions) for custom seed settings.

### 5. Start both services

From the project root:

```powershell
npm.cmd run dev
```

The root runner starts the backend and frontend together. Press **Ctrl+C** or **q** to stop its jobs. It expects dependencies to be installed and does not apply database migrations.

<details>
<summary><strong>Run services in separate terminals</strong></summary>

Backend terminal, starting from the repository root:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend terminal, starting from the repository root:

```powershell
Set-Location frontend
npm.cmd run dev
```

On macOS/Linux, use `backend/.venv/bin/python` for root-level commands and `.venv/bin/python` inside `backend/`.

</details>

| Service | Local address |
| --- | --- |
| Application | [localhost:3000](http://localhost:3000) |
| Swagger API docs | [localhost:8000/docs](http://localhost:8000/docs) |
| ReDoc | [localhost:8000/redoc](http://localhost:8000/redoc) |
| Health endpoint | [localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) |

Sign in as the local administrator, open **Import**, and upload the [sample workbook](samples/english-srs-sample.xlsx) to begin.

## Configuration

### Backend — `backend/.env`

Settings are defined in [`backend/app/core/config.py`](backend/app/core/config.py). The example environment file includes network, database, and AI settings; authentication and demo settings can be added as needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./data/app.db` | SQLAlchemy connection URL. |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Exact allowed browser origin for CORS. |
| `API_HOST` | `0.0.0.0` | Application network setting; explicit Uvicorn CLI flags determine the listener in the documented commands. |
| `API_PORT` | `8000` | Application port setting; the root runner explicitly starts port 8000. |
| `SECRET_KEY` | Built-in development key | JWT signing secret. Set a unique secret for a public deployment. |
| `ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Token lifetime; seven days by default. |
| `DEMO_MODE` | `false` | Enables selected mutation restrictions for showcase use. |
| `AI_BASE_URL` | `http://localhost:20128/v1` | OpenAI-compatible AI endpoint; the local default targets 9Router. |
| `AI_API_KEY` | Empty in code | AI endpoint credential; the example file contains a placeholder to replace. |
| `AI_MODEL` | `Anti_2` | Model identifier accepted by your configured endpoint. |
| `AI_REQUEST_TIMEOUT` | `90.0` | AI request timeout in seconds. |

For PostgreSQL, set a connection URL using the installed psycopg driver:

```dotenv
DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:5432/<database>
```

Add connection options such as `sslmode=require` when your database host requires them. Apply migrations against the selected database before starting the backend.

**AI is optional.** Excel imports and ordinary study flows do not require an AI service. To use the generation tools, start your compatible endpoint, replace `AI_API_KEY`, and set `AI_MODEL` to an available model. Restart the backend after changing configuration.

**Demo mode has a limited scope.** The current middleware blocks workbook import, workbook rename/delete, registration, and password changes. It permits study interactions and does not block every database write or AI save operation. See [`demo_guard.py`](backend/app/core/demo_guard.py) for the exact rules.

### Frontend — `frontend/.env.local`

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

The browser calls this URL directly. It must be reachable from the user's device; on a deployment, use the public backend URL. `NEXT_PUBLIC_*` values are public and must not contain secrets.

`FRONTEND_ORIGIN` must match the actual frontend origin, including protocol and port. `localhost`, `127.0.0.1`, and different ports represent different origins. Restart the frontend after changing its environment; rebuild for production changes.

## Excel workbook format

Each nonempty worksheet becomes a study sheet. Put column headers in the **first row**:

| Phrase | Meaning | Example EN | Example VI |
| --- | --- | --- | --- |
| keep in mind | remember or consider something | Keep in mind that the deadline is Friday. | Optional translated example. |
| make progress | improve or move forward | You make progress when you practise regularly. | Optional translated example. |

- **Phrase** and **Meaning** headers and values are required.
- **Example EN** and **Example VI** are optional.
- Header matching ignores capitalization and normalizes whitespace.
- Empty worksheets and blank vocabulary rows are skipped.
- Duplicate recognized headers and missing required values produce validation errors with sheet, row, and column details.
- The supported upload format is **`.xlsx`**.

The example above uses English definitions for readability; the **Meaning** column can contain Vietnamese translations for bilingual practice.

Download the [sample workbook](samples/english-srs-sample.xlsx), or regenerate it with:

```powershell
.\backend\.venv\Scripts\python.exe scripts/create_sample_workbook.py
```

## Learning workflow

1. **Build your library.** As an administrator, import a workbook or use the AI tools to generate, preview, and save cards.
2. **Inspect a sheet.** Browse examples in Table View and mark difficult cards as **Weak** or useful cards as **Bookmarked**.
3. **Choose your practice.** Use Quick Recall for a shorter exercise, or start a full study session with your preferred direction and card scope.
4. **Practise actively.** Reveal the answer and record **Again** or **Remembered**. Complete the round and repeat forgotten cards or all cards as needed.
5. **Finish and review.** A full session can finish when its latest completed round reaches **100% recall**. Review the result and sheet schedule.
6. **Return to Today.** Use the dashboard to find due reviews and resume active sessions. Check the calendar to see your study activity.

### Study keyboard shortcuts

| Key | Action |
| --- | --- |
| `1` | Record **Again** when answer controls are available. |
| `2` | Record **Remembered** when answer controls are available. |
| `A` or `P` | Pronounce the current English phrase. |

Cards can also be flipped by clicking or tapping. Speech availability and voice quality depend on the browser and installed voices.

### Spaced repetition

Scheduling is managed by the backend at the **sheet level**. The interval ladder is:

```text
1 day → 3 days → 7 days → 14 days → 30 days → 60 days → 90 days
```

| Rating | Scheduling rule |
| --- | --- |
| **Forgot** | Reset to level 1 with a one-day interval and increment the lapse count. |
| **Hard** | Keep the current level and interval; initialize new sheets at one day. |
| **Good** | Advance one level, up to the maximum level. |
| **Easy** | Advance two levels, up to the maximum level. |

Completed full sessions derive an automatic rating from mastery and Again counts. The table describes backend scheduling rules; the automatic path selects Forgot, Hard, or Good. Changing an already-saved rating currently returns a conflict, so the result page's manual review action may be rejected. The scheduler and rating rules live in [`backend/app/services/srs.py`](backend/app/services/srs.py).

## Accounts & permissions

Passwords are hashed with bcrypt; signed JWTs authenticate protected API requests. Administrator privileges are represented by `is_superuser`.

| Action | Administrator | Learner / guest |
| --- | --- | --- |
| Browse the shared library | Yes | Yes |
| Use study and recall flows | Yes | Supported by learning endpoints |
| Import Excel or generate/save AI cards | Yes | No |
| Rename workbooks/sheets or change sheet priority | Yes | No |
| Delete workbooks | Yes | No |

The current library is shared. Weak/bookmark flags and sheet-level SRS fields are stored on shared content models; do not assume that all learning state is isolated per account.

### Customize administrator initialization

The seed script reads these values from **process environment variables**: `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_FULLNAME`.

For example, set them in the PowerShell session before running the seed command:

```powershell
$env:ADMIN_USERNAME = 'library-admin'
$env:ADMIN_EMAIL = 'owner@example.com'
$env:ADMIN_PASSWORD = '<choose-a-unique-password>'
$env:ADMIN_FULLNAME = 'Library Administrator'
Set-Location backend
.\.venv\Scripts\python.exe -m scripts.seed_admin
Set-Location ..
```

Replace the password placeholder before running. The script logs its configured initialization password, so keep that output private. For an existing account, use the application's password-change flow; rerunning the seed script does not reset its password.

## Architecture & project structure

```text
Browser / Next.js UI
         │ HTTP requests
         ▼
FastAPI routes / Pydantic schemas
         │
         ▼
Services / repositories / SQLAlchemy models
         │
         ▼
SQLite or PostgreSQL

AI tools → configured OpenAI-compatible endpoint
```

| Layer | Main technologies |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, CSS variables |
| Backend | FastAPI, Uvicorn, Pydantic Settings, SQLAlchemy, Alembic |
| Data and imports | SQLite, PostgreSQL with psycopg, openpyxl |
| Authentication | PyJWT, bcrypt |
| Verification | pytest, HTTPX, TypeScript, ESLint |

```text
learn-fast/
├── backend/
│   ├── app/
│   │   ├── api/            # HTTP routes and authentication dependencies
│   │   ├── core/           # Settings, database, security, demo guard
│   │   ├── models/         # SQLAlchemy entities and enums
│   │   ├── repositories/   # Data access helpers
│   │   ├── schemas/        # Request and response models
│   │   └── services/       # Imports, AI, study rounds, SRS, activity
│   ├── alembic/            # Versioned database migrations
│   ├── scripts/            # Administrator initialization
│   ├── tests/              # Unit, API, and migration tests
│   ├── data/               # Local SQLite database directory
│   └── requirements.txt
├── frontend/
│   ├── app/                # Pages, layouts, and global styles
│   ├── components/         # Feature and shared UI components
│   ├── context/            # Authentication context
│   ├── lib/                # Study, formatting, and speech utilities
│   ├── services/           # API client and API types
│   └── public/             # Static assets
├── samples/                # Example vocabulary workbook
├── scripts/                # Local startup and verification helpers
├── plan/                   # Task plans
├── guide/                  # Implementation and usage guides
├── .agents/                # Project rules and skills
├── dev.ps1                 # Windows development runner
└── README.md
```

## Pages & API

### Application pages

| Route | Purpose |
| --- | --- |
| `/` | Today dashboard |
| `/workbooks` | Shared vocabulary library |
| `/workbooks/:workbookId` | Workbook details and sheets |
| `/import` | Excel import and AI content tools |
| `/sheets/:sheetId` | Sheet overview |
| `/sheets/:sheetId/table` | Card table and flags |
| `/sheets/:sheetId/quick-recall` | Quick Recall |
| `/sheets/:sheetId/study` | Study setup |
| `/study-sessions/:sessionId` | Active study session |
| `/study-sessions/:sessionId/result` | Results and review schedule |
| `/calendar` | Study activity calendar |
| `/notifications` | In-app notifications |

Account actions are available through the application's authentication and profile UI.

### Backend API

All application endpoints use the **`/api/v1`** prefix. Major groups cover health, authentication, workbooks, sheets, flashcards, study sessions, Quick Recall, dashboard, calendar, notifications, and AI.

```text
GET  /api/v1/health
GET  /api/v1/workbooks
POST /api/v1/workbooks/import
POST /api/v1/ai/generate
POST /api/v1/ai/mine
POST /api/v1/ai/save
```

Import and AI endpoints require an administrator bearer token. Use the running backend's [Swagger UI](http://localhost:8000/docs) to inspect the complete endpoint list, payload schemas, and authorization controls. The browser client is [`frontend/services/api.ts`](frontend/services/api.ts).

## Development & verification

### Backend tests

From the repository root:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -v -p no:cacheprovider
Set-Location ..
```

Test fixtures migrate isolated SQLite databases. `backend/pytest.ini` keeps temporary test data inside the workspace; do not point tests at a production database.

### Frontend checks

From the repository root:

```powershell
Set-Location frontend
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run lint
npm.cmd run build
Set-Location ..
```

To serve an already-built frontend, run `npm.cmd run start` from `frontend/`. Start the backend separately.

### Migration consistency

Against an intentionally selected development database, from the repository root:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic check
Set-Location ..
```

`alembic check` checks for model changes requiring migration operations; it does not apply them. Review schema changes and rollback behavior before applying new migrations.

The optional root helper `scripts/verify-mvp.ps1` runs backend tests, Alembic consistency, frontend lint, and a production build. It stops at the first failure and uses your configured database for its Alembic check.

### Browser smoke test

1. Start both services and sign in as an administrator.
2. Import the sample workbook and open one of its sheets.
3. Open Table View and toggle a Weak or Bookmark flag.
4. Complete Quick Recall, then start a full study session.
5. Flip cards, try pronunciation, and record both answer types.
6. Repeat rounds until the latest round reaches 100% recall, then finish.
7. Inspect the result and schedule; return to the dashboard and calendar.
8. Reload the page and confirm that saved content and progress remain available.
9. Switch themes and check the layout at mobile and desktop widths.

## Deployment checklist

Deploy the frontend as a Next.js application and the backend as a Python ASGI service. This repository does not require a particular hosting provider.

- Install backend dependencies from `backend/requirements.txt` and apply reviewed migrations during a controlled release step.
- Run Uvicorn with `app.main:app`, binding to the host and port expected by your platform.
- Use a persistent database. If the host does not retain local files, use PostgreSQL rather than a local SQLite file.
- Set `DATABASE_URL`, a unique `SECRET_KEY`, and the exact HTTPS `FRONTEND_ORIGIN` on the backend.
- Set `NEXT_PUBLIC_API_BASE_URL` to the publicly reachable backend URL before building the frontend.
- Initialize the administrator intentionally and replace development credentials before public access.
- Configure AI credentials server-side only if the AI features are needed.
- Check `/api/v1/health`, authentication, CORS, imports, and the learning flow after deployment.

Environment files, credentials, virtual environments, dependency folders, build output, and local database files should remain outside version control.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Development runner cannot find Python | Create `backend/.venv` and install backend dependencies first. |
| `no such table` or migration errors | Run Alembic from `backend/` against the intended database. Inspect migration output before starting the app. |
| SQLite cannot open the database | Confirm `backend/data/` exists and run the backend from `backend/`. |
| Frontend cannot reach the API | Confirm the backend is running and `NEXT_PUBLIC_API_BASE_URL` is correct. Restart the frontend after edits. |
| Browser reports CORS errors | Match `FRONTEND_ORIGIN` to the actual browser origin, including its port. |
| Import or AI action returns 401/403 | Sign in as an administrator and check whether demo mode blocks that action. |
| Default admin login fails | Run initialization on a fresh database; an existing account keeps its previous password. |
| Workbook validation fails | Use `.xlsx`, put headers in row 1, and provide Phrase and Meaning for each vocabulary row. |
| AI generation fails or times out | Check endpoint availability, API key, model identifier, and timeout configuration. |
| Pronunciation is unavailable | Check browser speech support and available English voices. |
| Session cannot finish | Complete the active round and ensure the latest completed round reaches 100% recall. |

## Contributing

Follow [`AGENTS.md`](AGENTS.md) and the applicable rules in [`.agents/rules/`](.agents/rules/). For implementation work, create a plan in `plan/`, keep edits within its declared scope, explain business rules in code comments, and record verification and usage instructions in `guide/`.

Run the checks relevant to your changes and document failures clearly. Keep credentials and personal datasets out of commits.

**Documentation visibility:** the current root `.gitignore` ignores `*.md`, `plan/`, `guide/`, and several documentation/helper directories. New local documentation may require an intentional force-add or an agreed ignore-rule change to be included in a Git commit.

---

<div align="center">

**Build a useful library. Practise a little every day. Return when it matters.**

[Back to top](#learn-fast)

</div>
