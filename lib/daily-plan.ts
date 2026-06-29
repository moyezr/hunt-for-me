import { getPipelineSummary } from "@/lib/pipeline";
import type { Contact, Job } from "@/lib/types";

const linkedinNoteTarget = 15;
const linkedinDmTarget = 10;

function isDue(value: string | null) {
  return Boolean(value && new Date(value) <= new Date());
}

export function getDailyPlan(input: {
  jobs: Job[];
  contacts: Contact[];
  linkedinNotesSent: number;
  linkedinDmsSent: number;
}) {
  const pipeline = getPipelineSummary(input.jobs);
  const followUpsDue = input.contacts.filter((contact) =>
    isDue(contact.followUpDate),
  ).length;
  const unsentContacts = input.contacts.filter(
    (contact) => contact.status === "new" || contact.status === "drafted",
  ).length;

  return {
    applications: pipeline,
    outreach: {
      linkedinNotesSent: input.linkedinNotesSent,
      linkedinNoteTarget,
      linkedinNotesRemaining: Math.max(
        linkedinNoteTarget - input.linkedinNotesSent,
        0,
      ),
      linkedinDmsSent: input.linkedinDmsSent,
      linkedinDmTarget,
      linkedinDmsRemaining: Math.max(
        linkedinDmTarget - input.linkedinDmsSent,
        0,
      ),
      followUpsDue,
      unsentContacts,
    },
  };
}
