import type { Job } from "@/lib/types";

const dailyApplicationTarget = 20;

function isToday(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function getPipelineSummary(jobs: Job[]) {
  const appliedToday = jobs.filter((job) => isToday(job.appliedAt)).length;
  const readyToApply = jobs.filter((job) => job.status === "discovered").length;
  const highFit = jobs.filter(
    (job) => job.status === "discovered" && (job.fitScore ?? 0) >= 8,
  ).length;
  const targetRemaining = Math.max(dailyApplicationTarget - appliedToday, 0);

  return {
    appliedToday,
    dailyApplicationTarget,
    targetRemaining,
    readyToApply,
    highFit,
  };
}

export function getNextApplicationJobs(jobs: Job[], limit = 8) {
  return jobs
    .filter((job) => job.status === "discovered")
    .sort((a, b) => {
      const fitDifference = (b.fitScore ?? 0) - (a.fitScore ?? 0);
      if (fitDifference !== 0) {
        return fitDifference;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}
