import Link from "next/link";
import { getDailyPlan } from "@/lib/daily-plan";
import { countSentMessagesToday, getContacts, getJobs } from "@/lib/db";
import { getNextApplicationJobs } from "@/lib/pipeline";

export default function Home() {
  const jobs = getJobs();
  const contacts = getContacts();
  const activeJobs = jobs.filter((job) => job.status !== "rejected").length;
  const plan = getDailyPlan({
    jobs,
    contacts,
    linkedinNotesSent: countSentMessagesToday("linkedin", "linkedin_note"),
    linkedinDmsSent: countSentMessagesToday("linkedin", "linkedin_dm"),
  });
  const nextJobs = getNextApplicationJobs(jobs, 3);

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <section className="grid gap-3">
        <p className="text-sm font-medium uppercase text-[var(--accent)]">
          Local job hunt autopilot
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-normal">
          Faster applications and outreach, with every send reviewed by you.
        </h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Manage scraped jobs, generate application answers, and draft founder
          or recruiter messages from one local dashboard.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Today</h2>
            <p className="text-sm text-[var(--muted)]">
              Work the application and outreach targets from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              href="/dashboard"
            >
              Apply next
            </Link>
            <Link
              className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
              href="/outreach"
            >
              Draft outreach
            </Link>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-sm text-[var(--muted)]">Applications</p>
            <p className="mt-1 text-2xl font-semibold">
              {plan.applications.appliedToday}/
              {plan.applications.dailyApplicationTarget}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {plan.applications.targetRemaining} left today
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-sm text-[var(--muted)]">LinkedIn notes</p>
            <p className="mt-1 text-2xl font-semibold">
              {plan.outreach.linkedinNotesSent}/
              {plan.outreach.linkedinNoteTarget}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {plan.outreach.linkedinNotesRemaining} left today
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-sm text-[var(--muted)]">LinkedIn DMs</p>
            <p className="mt-1 text-2xl font-semibold">
              {plan.outreach.linkedinDmsSent}/{plan.outreach.linkedinDmTarget}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {plan.outreach.linkedinDmsRemaining} left today
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-sm text-[var(--muted)]">Follow-ups due</p>
            <p className="mt-1 text-2xl font-semibold">
              {plan.outreach.followUpsDue}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {plan.outreach.unsentContacts} unsent contacts
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">Tracked jobs</p>
          <p className="mt-2 text-3xl font-semibold">{jobs.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">Active pipeline</p>
          <p className="mt-2 text-3xl font-semibold">{activeJobs}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">Human approval</p>
          <p className="mt-2 text-3xl font-semibold">Always</p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="font-semibold">Top application queue</h2>
          <p className="text-sm text-[var(--muted)]">
            Highest-fit discovered jobs to start with.
          </p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {nextJobs.map((job) => (
            <article
              className="grid gap-3 p-4 md:grid-cols-[1fr_120px]"
              key={job.id}
            >
              <div>
                <p className="font-medium">
                  {job.title} · {job.company}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {job.platform} · Fit {job.fitScore ?? "-"}
                </p>
              </div>
              {job.url ? (
                <a
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-white"
                  href={job.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open
                </a>
              ) : (
                <Link
                  className="rounded-md border border-[var(--line)] px-4 py-2 text-center text-sm font-medium"
                  href="/dashboard"
                >
                  Review
                </Link>
              )}
            </article>
          ))}
          {nextJobs.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--muted)]">
              No discovered jobs ready. Run the scraper or save jobs from the
              extension.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
