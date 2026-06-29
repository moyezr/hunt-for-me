import Link from "next/link";
import { getJobs } from "@/lib/db";

export default function Home() {
  const jobs = getJobs();
  const activeJobs = jobs.filter((job) => job.status !== "rejected").length;

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

      <div className="flex gap-3">
        <Link
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          href="/dashboard"
        >
          Open dashboard
        </Link>
        <Link
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
          href="/outreach"
        >
          Draft outreach
        </Link>
      </div>
    </main>
  );
}
