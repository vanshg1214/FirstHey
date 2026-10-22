<p align="center">
  <img src="public/logo-mark.png" alt="FirstHey" width="96" height="96" />
</p>

<h1 align="center">FirstHey</h1>

<p align="center">
  Scan a visiting card at an exhibition, jot down a few notes, and FirstHey writes the follow-up email,<br />
  sends it, and keeps following up every two weeks until the person replies.
</p>

---

## Why this exists

After a trade show you come home with a stack of business cards and a vague memory of who wanted what. The follow-ups either go out a week late as one generic blast, or they don't go out at all.

I built FirstHey for a team that sells virtual plant visits to factory owners at exhibitions. The goal was simple: the person at the booth should be able to capture a lead in under a minute, and the follow-up should reach that lead the same day, written like a human wrote it, mentioning the exhibition and what was actually discussed.

## What it does

1. **Capture.** Take a photo of the visiting card. Gemini reads the name, company, title, phone, email and address. You check the fields and fix anything it got wrong.
2. **Add context.** Optionally say what the lead cared about: record a voice note, photograph handwritten notes, or just type a line. Whatever you give it is merged into one short summary (what they need, what you promised, how interested they seemed).
3. **Preview and send.** The draft email is written from that summary and the exhibition you picked. With no notes you get a clean general email instead. You edit it if you like and press send.
4. **Follow up on a schedule.** Sending starts a sequence. The next email is only written after the previous one goes out, so it can build on what has happened so far. The gap is 14 days, up to 27 emails, and it stops the moment the lead replies, unsubscribes or bounces.
5. **See what worked.** Opens and clicks are tracked per email, per lead and per exhibition. Each lead gets a simple score (open = 1, click = 5, reply = 10), and the whole thing exports to an Excel file with the lead details first and engagement columns after.

Everything is scoped to an organization, so each company only sees its own leads, and each one sends from its own mailbox.

## Stack

| Area | What's used |
| --- | --- |
| App | Next.js 16 (App Router, route handlers), React 19, TypeScript |
| UI | Tailwind CSS 4, Framer Motion, Recharts, Lucide icons |
| Database and auth | Supabase: Postgres with row level security, email/password auth, storage for card images and audio |
| AI | Google Gemini (`gemini-3.6-flash`) through `@google/generative-ai` for card reading, transcription, notes and drafting. LangChain and LangGraph for the lead scoring pipeline |
| Email | Nodemailer over Gmail or Workspace SMTP (App Password). Resend is supported too |
| Reports | ExcelJS |
| Scheduling | A GitHub Actions cron that calls a protected API route (see below) |
| Hosting | Vercel |

It is also an installable PWA with a small offline queue, because exhibition Wi-Fi is not something to rely on.

## Running it locally

You need Node 20+, a Supabase project, and a Gemini API key.

```bash
git clone https://github.com/Avrsxvr/FIrstHey.git
cd FIrstHey
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Open http://localhost:3000. Next.js here is a recent major version, so if something behaves differently from what you remember, check `node_modules/next/dist/docs/`.

The variables that matter:

| Variable | What it is for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser access to Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side access. Never expose this one |
| `GEMINI_API_KEY` | Fallback key when an organization hasn't saved its own in Settings |
| `NEXT_PUBLIC_APP_URL` | Your live address. Used for tracking links and the unsubscribe link, and emails refuse to send without it |
| `CRON_SECRET` | Shared secret for the scheduled sender. Must be identical in Vercel and GitHub |
| `INBOUND_EMAIL_WEBHOOK_SECRET` | Protects the reply webhook. If unset, the webhook stays off |
| `SEQUENCE_DAILY_LIMIT`, `SEQUENCE_PAUSED` | Optional. Per-organization daily cap and a global kill switch |

Email credentials are not environment variables. Each organization enters its own in **Settings**.

### Database

The schema lives in `supabase/migrations`. That folder grew while the data model was still changing and some early files conflict with later ones, so please don't run the whole folder blindly (one of them drops tables). If you already have a project, `supabase/fix_missing_tables.sql` adds whatever is missing and is safe to run more than once. Cleaning the migrations into a single starting file is on the to-do list.

## How the scheduled sending works

Vercel's free plan only allows one cron run a day, which is far too coarse for a sequence that sends in small batches. So `.github/workflows/send-followups.yml` calls `/api/cron/send-followups` every 10 minutes during business hours, using `CRON_SECRET` as a bearer token. Add two repository secrets, `APP_URL` and `CRON_SECRET`, and the workflow does the rest. If a run fails, the log says why (wrong secret, wrong URL, protected deployment and so on).

The sender is deliberately conservative, because a mailbox that gets flagged is hard to un-flag:

- It only runs inside a send window (weekdays, 09:30 to 18:30 IST by default). This is enforced in the sender itself, not just by the cron schedule.
- Each organization has its own daily cap, and a new sender starts small and ramps up a little each day.
- Every email carries a one-click unsubscribe link and `List-Unsubscribe` headers, plus the company name and postal address.
- Obviously bad addresses (usually card-scan typos) are skipped, and a rate-limit response from the mail provider pauses the run instead of hammering it.
- Link scanners and mail previewers that "click" every link are filtered out of the click numbers.

The Queue page shows what is waiting to go out and has a pause-everything button.

## Project layout

```
src/
  app/                 pages and API route handlers
    capture/           the capture flow (card, voice, notes, preview, send)
    (dashboard)/       analytics, queue, settings, profile
    api/               leads, sequence, analytics, cron, webhooks, tracking
  components/          UI pieces (lead panel, scanners, pipeline view)
  lib/
    agents/            Gemini calls: card OCR, notes, context merge, drafting, scoring
    prompts/           the prompts those agents use
    services/          sequence engine, email sending, engagement and reports
    sendPolicy.ts      when sending is allowed
    sequenceConfig.ts  gaps, caps, warm-up
supabase/              SQL
.github/workflows/     the scheduled sender
```

## What is not done yet

- Email passwords are stored as plain text in the database and should be encrypted.
- Voice recordings sit in a public storage bucket and should move to a private one with short-lived links.
- The email header and the demo link are still specific to one company; they should be per-organization settings.
- A "Connect Google" button instead of an App Password. Google reviews apps that send mail on a user's behalf, and that takes a while.
- Tests. There are a few manual scripts in `tests/manual`, but nothing automated.
