# Hunt For Me User Guide

This guide explains how to run the app, use the dashboard, fill applications with the Chrome extension, manage outreach, and verify that the local workflow is working.

Hunt For Me is a local job hunt cockpit. It helps you:

- Discover and track jobs in a local SQLite pipeline.
- Generate application answers from your profile and the job description.
- Recommend the best local resume for a role.
- Fill job application forms after you review and approve the generated answers.
- Import founder, recruiter, and HR contacts.
- Draft outreach messages and follow-ups.
- Export jobs and contacts as CSV.

The app is intentionally review-first. It does not submit applications, send messages, or hide generated text from you. You review, edit, copy, fill, and submit manually.

## 1. What Runs Locally

The project has three main parts:

- Next.js app at `http://localhost:3000`
- SQLite database at `data/jobhunt.db`
- Chrome extension loaded from `extension/`

The app uses:

- `data/profile.json` as your candidate profile source.
- `data/outreach-templates.json` as the outreach style and channel template source.
- Resume PDFs at the repo root, referenced by `data/profile.json`.
- `OPENROUTER_API_KEY` from `.env` for AI answer and outreach generation.

## 2. First-Time Setup

From the project root:

```bash
npm install
```

Create or update `.env`:

```bash
OPENROUTER_API_KEY=your_openrouter_key
```

Start the local app:

```bash
npm run dev
```

The `dev` command builds the extension bundle first, then starts Next.js at:

```text
http://localhost:3000
```

Keep this terminal running while using the dashboard or extension.

## 3. Load the Chrome Extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select the repo's `extension/` directory.
6. Pin the Hunt For Me extension if you want fast access from the toolbar.

When code changes are made to the extension, rebuild it:

```bash
npm run build:extension
```

Then reload the unpacked extension in `chrome://extensions`.

Supported job-page hosts:

- LinkedIn
- Naukri
- Indeed
- Wellfound

The extension can only talk to the local app if `npm run dev` is running.

## 4. Daily Operating Loop

Use this order for a normal job-hunt session:

1. Start the app with `npm run dev`.
2. Open `http://localhost:3000`.
3. Review the Today panel.
4. Go to `/dashboard` to get jobs into the pipeline.
5. Open jobs from the queue and use the extension to generate and fill answers.
6. Mark applications as applied only after submitting manually on the job site.
7. Go to `/outreach` to draft and track outreach.
8. Export jobs or contacts when you need a spreadsheet snapshot.

## 5. Home Page

Open:

```text
http://localhost:3000
```

The home page is the daily control panel. It shows:

- Applications completed today versus the daily target.
- LinkedIn notes sent today versus the daily target.
- LinkedIn DMs sent today versus the daily target.
- Follow-ups due.
- Total tracked jobs.
- Active pipeline size.
- Top application queue.

Use:

- Apply next: opens `/dashboard`.
- Draft outreach: opens `/outreach`.
- Open: opens a specific job from the top queue.
- Review: opens the dashboard when a job has no URL.

## 6. Job Dashboard

Open:

```text
http://localhost:3000/dashboard
```

The dashboard is for discovering, saving, prioritizing, and tracking jobs.

### Dashboard Metrics

The metric cards show:

- Applied today
- Target remaining
- Ready to apply
- High-fit backlog
- Saved answers

These are derived from the jobs stored in `data/jobhunt.db`.

### Scrape Jobs

Use the Scraper run panel to pull jobs from supported sources.

Inputs:

- Role query: default is `AI Engineer`.
- Location: default is `India Remote`.
- Max jobs per platform: default is `8`, max is `20`.
- Platforms: `naukri`, `indeed`, `wellfound`.

Click Trigger scraper.

The scraper result shows:

- Scanned
- Saved
- Duplicates
- Low-fit skipped
- Platform diagnostics, if a platform failed or returned unusable results

Saved jobs are scored for fit and added to the dashboard. Duplicate jobs are skipped.

### Add a Manual Job

Use the manual job form when you find a job outside the scraper or want to track one directly.

Required:

- Role title
- Company

Optional but useful:

- Job URL
- Job description text
- Initial status: `discovered` or `applied`

Click Save job.

If you include a job description, the app also recommends a resume and stores the job context for later answer generation.

### Work the Next Applications Queue

The Next applications section shows the highest-fit discovered jobs first.

For each job, you can:

- See platform, fit score, recommended resume, and saved answer count.
- Change status.
- Open the job URL.

Recommended workflow:

1. Open the highest-fit job.
2. Use the Chrome extension to scan the application page.
3. Review generated answers.
4. Fill approved answers.
5. Submit manually on the job site.
6. Return to the dashboard and mark the job as `applied`.

### Job Statuses

Jobs can be:

- `discovered`
- `applied`
- `interviewing`
- `rejected`
- `offer`

Use statuses consistently so the daily plan and pipeline metrics stay useful.

### Export Jobs

Click Export CSV on `/dashboard`, or open:

```text
http://localhost:3000/api/export/jobs
```

This downloads the local jobs table as CSV.

## 7. Application Filling With the Extension

Use the extension on a supported job application page while the local app is running.

### Scan a Page

1. Open a job application page in Chrome.
2. Click the Hunt For Me extension.
3. Confirm the health indicator is green.
4. Click Scan.

The extension detects:

- Company
- Role
- Job URL
- Job description text, when available
- Form fields and selectable options

The extension requires usable company and role context. If the page is too generic and shows `Unknown company` or `Open role`, it will ask you to fix the context before generating answers.

### Review Generated Answers

After scanning, the extension:

- Recommends a resume.
- Generates answers for up to 20 detected fields.
- Displays every generated answer in editable textareas.
- Leaves extra fields for manual review if more than 20 fields were detected.

Edit any answer that looks wrong, too long, too generic, or not appropriate for that application.

### Save or Mark the Job

From the extension popup:

- Save job: saves the current job to the dashboard as `discovered`.
- Mark applied: saves the current job and marks it as `applied`.

Only use Mark applied after you actually submit the application manually on the job site.

### Fill Approved Answers

The fill flow is intentionally gated:

1. Review every generated answer.
2. Edit answers as needed.
3. Check the approval checkbox.
4. Click Fill.
5. Review the page after filling.
6. Submit manually on the job site.

The extension fills fields but does not submit the form.

If the popup reports that some fields need manual review, inspect those fields on the page and fill them yourself.

## 8. Outreach Page

Open:

```text
http://localhost:3000/outreach
```

The outreach page is for importing contacts, drafting messages, reviewing drafts, copying messages, and marking messages as sent.

### Outreach Metrics

The top cards show:

- LinkedIn notes today, target `15`
- LinkedIn DMs today, target `10`
- Follow-ups due

These counts are based on contacts and message history in `data/jobhunt.db`.

### Import Contacts

Paste CSV into the import box and click Import contacts.

Expected columns:

```csv
name,title,company,platform,profile_url,notes
```

Example:

```csv
name,title,company,platform,profile_url,notes
Asha,Founder,Acme AI,linkedin,https://linkedin.com/in/asha,building AI workflows
```

The importer is flexible about common header variants, but the safest format is the one above.

### Draft a Single Message

In Outreach batch:

1. Fill Name.
2. Fill Title.
3. Fill Company.
4. Choose Channel.
5. Add Company context.
6. Click Draft message.

Channels:

- `linkedin_note`
- `linkedin_dm`
- `twitter_dm`
- `email`

The generated draft appears in Current draft. Edit it before using it.

### Load a Manual Queue

Paste one contact per line in this format:

```text
Name | Title | Company | Company context | Profile URL
```

Example:

```text
Asha Rao | Founder | Acme AI | building AI workflow tooling for recruiters | https://linkedin.com/in/asha
Ravi Mehta | Head of Engineering | Vector Labs | hiring AI engineers for applied LLM products | https://linkedin.com/in/ravi
```

Click Load queue.

### Draft a Batch

After loading a queue:

- Click Draft remaining queue to draft up to 20 messages from the current queue position.
- Review each item in Batch review.
- Click a queued contact to inspect or edit that draft.
- Use Skip to move to the next contact without marking sent.

Batch drafts are saved to contacts as they are generated.

### Load Saved Contacts

Click Load saved contacts to queue contacts that are ready for initial outreach.

This is useful after importing contacts from CSV.

### Load Follow-Ups Due

Click Load follow-ups due to queue contacts whose follow-up date is today or earlier.

Follow-up drafts include context from the latest message where available.

### Copy and Mark Sent

For each draft:

1. Edit the draft.
2. Click Copy.
3. Paste and send manually in LinkedIn, Twitter/X, email, or the relevant channel.
4. Click Mark sent only after sending manually.

Mark sent:

- Sets the contact status to `sent`.
- Stores the final message body.
- Sets a follow-up date 3 days later.
- Advances to the next queued contact.

The app does not send outreach messages for you.

### Contact Statuses

Contacts can be:

- `new`
- `drafted`
- `sent`
- `follow_up_due`
- `responded`
- `closed`

Use:

- `responded` when someone replies.
- `closed` when you no longer want follow-ups for that contact.
- `follow_up_due` for contacts that need another touch.

### Outreach Templates

The Outreach templates editor shows the JSON from `data/outreach-templates.json`.

Use it to change:

- Global writing rules
- Proof points
- Channel-specific goals
- Character limits
- Structure
- Examples

Click Save templates after editing.

If the JSON is invalid or required channels are missing, the save will fail with an error.

### Export Contacts

Click Export CSV on `/outreach`, or open:

```text
http://localhost:3000/api/export/contacts
```

This downloads contacts and message state as CSV.

## 9. Updating Profile, Resumes, and Templates

### Candidate Profile

Edit:

```text
data/profile.json
```

This controls:

- Contact information
- Summary
- Skills
- Experience
- Education
- Projects
- Preferred roles
- Location preferences
- Salary expectation
- Notice period
- Narrative answers
- Outreach voice
- Resume mapping

Restart the app after profile edits if you do not see changes immediately.

### Resumes

Resume filenames are configured in `data/profile.json`.

Keep the referenced PDFs available at the paths listed there. The dashboard and extension can recommend a resume even if the file is missing, but the UI will report that the local file was not found.

### Outreach Templates

You can edit templates in either place:

- `/outreach` using the Outreach templates editor.
- `data/outreach-templates.json` directly.

Use the app editor for safer validation before saving.

## 10. Verification Commands

Run full static, type, test, extension, and build verification:

```bash
npm run verify
```

Run extension-only verification:

```bash
npm run verify:extension
```

Run runtime API verification while the app is already running on `localhost:3000`:

```bash
npm run verify:runtime
```

Run authenticated live Chrome smoke while the app is already running:

```bash
npm run verify:live:chrome
```

For the live Chrome smoke:

- Quit Chrome fully first.
- The script opens Chrome profile `Profile 1`, named `Moyez Work`.
- It opens read-only pages for configured job platforms.
- It checks whether those pages land on login walls.
- It closes Chrome when done.
- It does not print cookies.
- It does not submit applications.

To test specific pages:

```bash
HFM_LIVE_URLS=https://example.com/job-a,https://example.com/job-b npm run verify:live:chrome
```

If live verification fails with a login URL or login title, sign into that platform once in the `Moyez Work` Chrome profile, then rerun it. You can also limit `HFM_LIVE_URLS` to pages where that profile is already authenticated.

## 11. Common Problems

### Extension Health Indicator Is Red

The local app is not reachable.

Fix:

```bash
npm run dev
```

Then reopen the extension popup.

### Extension Does Not Detect Company or Role

The current page does not expose enough context.

Fix:

- Make sure you are on the actual job or application page.
- Try opening the job details page before the application form.
- Save the job manually from `/dashboard` if the site layout prevents detection.

### Generated Answers Look Too Generic

The model likely has weak job context.

Fix:

- Paste a fuller job description into the manual job form.
- Use the actual job page before scanning.
- Edit the answer before approving fill.
- Update `data/profile.json` with stronger projects, skills, or narrative details.

### Fill Works But Some Fields Are Empty

Some fields may use custom widgets or unsupported controls.

Fix:

- Read the popup status for failed field count.
- Fill those fields manually.
- Check select, radio, country code, notice period, relocation, and experience fields carefully before submitting.

### Scraper Saves Few Jobs

The scraper filters low-fit jobs and skips duplicates.

Fix:

- Increase max jobs per platform.
- Try a broader role query.
- Try a different location.
- Check platform diagnostics after the scraper run.
- Sign into relevant job boards in Chrome if live sites block public results.

### Outreach Draft Fails

The contact may be missing required context or the AI provider may be unavailable.

Fix:

- Ensure name, title, and company are filled.
- Add company context.
- Check `OPENROUTER_API_KEY`.
- Try one draft first before drafting the remaining queue.

### Live Chrome Smoke Opens Login Pages

The `Moyez Work` Chrome profile is not authenticated for that platform.

Fix:

- Open Chrome normally with the `Moyez Work` profile.
- Sign into the platform.
- Quit Chrome fully.
- Rerun `npm run verify:live:chrome`.

### Live Chrome Smoke Says Chrome Is Already Running

The script needs to launch the work profile itself.

Fix:

- Quit Chrome completely.
- Check macOS Dock and Activity Monitor if needed.
- Rerun the command.

## 12. Safety Rules for Using the App

Use these rules every session:

- Review every generated application answer.
- Do not submit an application before checking filled fields manually.
- Mark a job `applied` only after submitting it on the job site.
- Review outreach drafts before copying them.
- Mark outreach `sent` only after sending manually.
- Keep salary expectations and sensitive details aligned with your current preferences in `data/profile.json`.
- Export CSVs regularly if you want backup snapshots outside SQLite.

## 13. Quick Command Reference

```bash
npm run dev
npm run build:extension
npm run verify
npm run verify:extension
npm run verify:runtime
npm run verify:live:chrome
```

Useful URLs:

```text
http://localhost:3000
http://localhost:3000/dashboard
http://localhost:3000/outreach
http://localhost:3000/api/export/jobs
http://localhost:3000/api/export/contacts
```
