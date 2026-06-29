# GOAL.md — JobHunt Autopilot

## What We're Building

A two-part system:

1. **A Chrome Extension** — detects job application form fields, fills them with AI-generated answers, and waits for human approval before anything is submitted.
2. **A local Next.js app** — runs on `localhost:3000`, serves the API the extension talks to, stores all data, and provides a dashboard for managing the job pipeline and outreach.

One `bun run dev` starts everything. The extension calls `localhost:3000/api/...`.

**Core principle**: Volume without quality loss. Every application must feel specific to that company. The human always approves before submit.

---

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript with
- **Styling**: Tailwind CSS
- **Database**: Postgres
- **AI**: OpenRouter API (key is in `.env` as `OPENROUTER_API_KEY`). Use `gpt-5.5-min` as the model via OpenRouter's OpenAI-compatible endpoint.
- **Scraping**: Puppeteer or Playwright
- **Linting/Formatting**: Biome
- **Extension build**: esbuild
- **Testing**: Bun test

---

## Code Best Practices

Keep it simple. These are the rules:

**TypeScript**
- Don't write types for the sake of it. If TypeScript can infer it cleanly, let it.
- follow a consistent patter either use `type` or `interface`.


**File and function size**
- keep the code modular if the same function or piece of code can be reused.
- don't over complexify by creating too many files.
- keep the code simple and easy to understand.

 
**Imports**
- Use `@/` absolute imports (configured in tsconfig).
- No barrel `index.ts` files — import directly from the source file.

**Error handling**
- API routes always return typed JSON or `{ error: string }` with the right HTTP status.
- Use a consistent response format across API routes for efficient status handling and error logging.
- Never swallow errors silently.

**Architecture**
- Keep route handlers thin — business logic goes in `lib/`.
- No unnecessary abstractions. Don't create a class or wrapper where a plain function works.
- If you need to state management, use Zustand.
- Secrets only in `.env`. Never in code or committed files.

# Containerzing, Commiting and Pushing.
- the repo is already initialized with Git and linked to a repo in GitHub.
- create and push a commit in every major feature buidup or working change.
- dockerize the entire app (don't make this overly complex).

---

## Project Structure

```
hunt-for-me/
├── app/
│   ├── api/                  # Next.js API routes (thin handlers)
│   ├── dashboard/page.tsx    # Job pipeline UI
│   └── outreach/page.tsx     # Outreach contacts UI
├── extension/
│   ├── manifest.json
│   ├── popup/
│   └── content/
│       └── platforms/        # naukri.ts, wellfound.ts, indeed.ts, linkedin.ts
├── lib/                      # All business logic
│   ├── ai.ts
│   ├── db.ts
│   ├── scraper.ts
│   └── types.ts
├── prompts/                  # .md files for prompt templates
├── data/
│   ├── profile.json          # Candidate master profile
│   ├── resumes/
│   └── jobhunt.db
└── .env
```

---

## Candidate Profile (`data/profile.json`)

Single source of truth for all personal data. Includes: name, contact, skills, experience, education, projects, preferred roles, salary expectation (12–18 LPA), location preferences, and short narrative fields for "why I'm looking", "career goal", and "why I left my previous company".

---

## Database (`data/jobhunt.db`)

Two tables, that's it:

- **jobs** — id, title, company, url, platform, jd_text, fit_score, status, answers (JSON), applied_at, notes, created_at
- **contacts** — id, name, title, company, platform, profile_url, status, message_history (JSON), follow_up_date, notes, created_at.
- you can use an ORM like Primsa or Drizzle as you seem necessary.

All IDs are should be prefixed with entities like `job_` or `con_` or `app_`. Create a singular overall id generator that creates short ids that don't bloat our database. Dates are ISO strings. No migrations framework — plain SQL in an array at the top of `db.ts`, run once on startup.


---

## What the System Does

**AI answer engine** — given a form question + company/role context + candidate profile, generates a personalized answer. Classifies the question into a category (why this company, why leaving, 5-year plan, salary, cover letter, etc.) and uses the matching prompt template. Checks that the answer contains keywords from the JD. Caches answers per job so the same question isn't regenerated.

**Chrome extension** — detects form fields on Naukri, Indeed, Wellfound, and LinkedIn Easy Apply. Calls the local API for answers. Shows them in the popup for review. Fills fields only after the user approves. Never auto-submits. Uses React-compatible input simulation (native setter + `dispatchEvent`) to work with framework-rendered forms.

**Dashboard** — table of all jobs with status (discovered / applied / interviewing / rejected / offer). Can trigger the scraper from here.

**Job scraper** — Puppeteeri/Playwright scrapes Naukri, Indeed India, and Wellfound for matching roles. Scores each job against the candidate profile via AI (1–10). Only saves jobs scoring ≥ 6. Skips duplicates. Random 2–4s delay between requests.

**Outreach engine** — generates personalized LinkedIn notes (280 chars), LinkedIn DMs, and Twitter DMs for founders and recruiters. Batch session UI: one contact at a time, generated message, edit box, copy-to-clipboard, mark sent, next. Follow-up reminders surface contacts where `follow_up_date <= today`. Messages never mention salary. Always reference something specific about the company.

---

## Guardrails (enforced in code, not just convention)

- No auto-submit. Extension "Apply" button is disabled until user approves answers.
- Company name is required for answer generation — API returns 400 if missing.
- No duplicate applications — `POST /api/jobs` returns 409 if same company + title already exists with status other than 'discovered'.
- Salary always stated as "12–18 LPA" — prompt templates enforce this explicitly.
- LinkedIn connection requests capped at 15/day, DMs at 10/day — enforced by counting today's rows in the contacts table before saving.

---

## Build Order

1. Repo setup — Bun, Next.js, Biome, tsconfig with `@/` alias, esbuild for extension
2. `data/profile.json` schema + placeholder data, `lib/types.ts`, `lib/db.ts` with schema init
3. `GET /api/health` + extension skeleton that pings it — **checkpoint: green dot in popup**
4. `lib/ai.ts` + all prompt templates + `POST /api/answer` route
5. Extension field classifier, filler (React-compatible), and platform handlers (Naukri first)
6. Popup review UI — show answers, allow edit, enable Apply button — **checkpoint: full fill flow on Naukri**
7. `POST /api/jobs` + `GET /api/jobs` + dashboard page + "Save job" in extension
8. Scrapers (Naukri → Indeed → Wellfound) + scorer + scrape trigger in dashboard
9. `POST /api/message` + outreach routes + `/outreach` page + batch session UI
10. Guardrails (duplicate check, rate limits, keyword check), Biome lint pass, tests for core functions

---

## Definition of Done

- `bun run dev` starts with no errors
- Extension loads in Chrome, shows green health dot
- Opening a Naukri job → clicking extension → fields filled with personalized answers in < 60 seconds
- Answers reference the specific company and role — nothing generic
- Human approves before anything is submitted
- Scraper adds scored, deduped jobs to the dashboard
- Can draft 20 outreach messages in < 30 minutes using batch session
- Zero TypeScript errors, zero Biome warnings, core functions have tests


# Things to keep in mind
- this is not a build-one-time and leave product, we're going to constantly improve and iterate as we apply to more and more jobs.
- the templates for sending cold dms, linkedin messages and email should be configurable and our AI layer should be intelligent enough to add compay related nuances that can help us land better role.
- when sending dms or emails to people, we should always think from the hr's, founder's or the person the message is being sent to's perspective as these people are probably busy. They don't have much time to read all the text. We should keep our messages short, to the point and make sure that it createsaan `itch` in the reader's mind. Some point you can include are that I'm high-agency, tech agnostic, don't need hand holding, I've talked to 500+ customers and closed 26 clients, build fast, ship fast, can learn new tech on the fly. So, these are the things that we need to keep in mind when sending messages to people.  
