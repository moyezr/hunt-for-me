import { DashboardActions } from "@/app/dashboard/dashboard-actions";
import { JobStatusSelect } from "@/app/dashboard/job-status-select";
import { getJobs } from "@/lib/db";

export default function DashboardPage() {
  const jobs = getJobs();

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Job pipeline</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Track discovered jobs, generated answers, and application status.
          </p>
        </div>
      </div>

      <DashboardActions />

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
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-[var(--muted)]"
                  colSpan={6}
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
