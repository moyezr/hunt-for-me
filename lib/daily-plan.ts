import {
  getDueFollowUpContacts,
  getInitialOutreachContacts,
} from "@/lib/outreach-queue";
import { getPipelineSummary } from "@/lib/pipeline";
import type { Contact, Job } from "@/lib/types";

const linkedinNoteTarget = 15;
const linkedinDmTarget = 10;

export function getDailyPlan(input: {
  jobs: Job[];
  contacts: Contact[];
  linkedinNotesSent: number;
  linkedinDmsSent: number;
}) {
  const pipeline = getPipelineSummary(input.jobs);
  const followUpsDue = getDueFollowUpContacts(input.contacts).length;
  const unsentContacts = getInitialOutreachContacts(input.contacts).length;

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
