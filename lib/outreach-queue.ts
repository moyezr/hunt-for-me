import type { Contact } from "@/lib/types";

function isDue(value: string | null, now = new Date()) {
  return Boolean(value && new Date(value) <= now);
}

export function isInitialOutreachContact(contact: Contact) {
  return contact.status === "new" || contact.status === "drafted";
}

export function isActionableFollowUp(contact: Contact, now = new Date()) {
  return (
    contact.status !== "responded" &&
    contact.status !== "closed" &&
    isDue(contact.followUpDate, now)
  );
}

export function getInitialOutreachContacts(contacts: Contact[]) {
  return contacts.filter(isInitialOutreachContact);
}

export function getDueFollowUpContacts(contacts: Contact[], now = new Date()) {
  return contacts.filter((contact) => isActionableFollowUp(contact, now));
}
