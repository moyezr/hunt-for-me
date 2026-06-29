import { DashboardActions } from "@/app/dashboard/dashboard-actions";
import { JobStatusSelect } from "@/app/dashboard/job-status-select";
import { ManualJobForm } from "@/app/dashboard/manual-job-form";
import { getJobs } from "@/lib/db";
import { getNextApplicationJobs, getPipelineSummary } from "@/lib/pipeline";
import { recommendResume } from "@/lib/resumes";

export default function DashboardPage() {
  const jobs = getJobs();
  const summary = getPipelineSummary(jobs);
  const nextApplications = getNextApplicationJobs(jobs);

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Job pipeline</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Track discovered jobs, generated answers, and application status.
          </p>
        </div>
        <a
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
          href="/api/export/jobs"
        >
          Export CSV
        </a>
      </div>

      <DashboardActions />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Applied today</p>
          <p className="mt-1 text-2xl font-semibold">
            {summary.appliedToday}/{summary.dailyApplicationTarget}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Target remaining</p>
          <p className="mt-1 text-2xl font-semibold">
            {summary.targetRemaining}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Ready to apply</p>
          <p className="mt-1 text-2xl font-semibold">{summary.readyToApply}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">High-fit backlog</p>
          <p className="mt-1 text-2xl font-semibold">{summary.highFit}</p>
        </div>
      </section>

      <ManualJobForm />

      <section className="rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="font-semibold">Next applications</h2>
          <p className="text-sm text-[var(--muted)]">
            Highest-fit discovered jobs to work through first.
          </p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {nextApplications.map((job) => {
            const resume = recommendResume({
              role: job.title,
              jdText: job.jdText,
            });

            return (
              <article
                className="grid gap-3 p-4 md:grid-cols-[1fr_180px_150px]"
                key={job.id}
              >
                <div>
                  <p className="font-medium">
                    {job.title} · {job.company}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {job.platform} · Fit {job.fitScore ?? "-"} ·{" "}
                    {resume.filename}
                  </p>
                </div>
                <JobStatusSelect jobId={job.id} status={job.status} />
                {job.url ? (
                  <a
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-white"
                    href={job.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open job
                  </a>
                ) : (
                  <span className="rounded-md border border-[var(--line)] px-4 py-2 text-center text-sm text-[var(--muted)]">
                    No URL
                  </span>
                )}
              </article>
            );
          })}
          {nextApplications.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--muted)]">
              No discovered jobs ready. Save jobs from the extension or run the
              scraper.
            </p>
          ) : null}
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[#eef2f7] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Fit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr className="border-t border-[var(--line)]" key={job.id}>
                <td className="px-4 py-3 font-medium">{job.title}</td>
                <td className="px-4 py-3">{job.company}</td>
                <td className="px-4 py-3">{job.platform}</td>
                <td className="px-4 py-3">{job.fitScore ?? "-"}</td>
                <td className="px-4 py-3">
                  <JobStatusSelect jobId={job.id} status={job.status} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {job.url ? (
                    <a
                      className="text-[var(--accent-strong)] underline"
                      href={job.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-[var(--muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-[var(--muted)]"
                  colSpan={7}
                >
                  No jobs saved yet. Use the extension or trigger the scraper.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
