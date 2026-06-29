import { ContactImport } from "@/app/outreach/contact-import";
import { OutreachBatch } from "@/app/outreach/outreach-batch";
import { countSentMessagesToday, getContacts } from "@/lib/db";

export default function OutreachPage() {
  const contacts = getContacts();
  const due = contacts.filter(
    (contact) =>
      contact.followUpDate && new Date(contact.followUpDate) <= new Date(),
  );
  const linkedinNotesSent = countSentMessagesToday("linkedin", "linkedin_note");
  const linkedinDmsSent = countSentMessagesToday("linkedin", "linkedin_dm");

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Outreach batch</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Draft short founder, recruiter, and HR messages. Salary is
            intentionally excluded.
          </p>
        </div>
        <a
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
          href="/api/export/contacts"
        >
          Export CSV
        </a>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">LinkedIn notes today</p>
          <p className="mt-1 text-2xl font-semibold">{linkedinNotesSent}/15</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">LinkedIn DMs today</p>
          <p className="mt-1 text-2xl font-semibold">{linkedinDmsSent}/10</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Follow-ups due</p>
          <p className="mt-1 text-2xl font-semibold">{due.length}</p>
        </div>
      </section>

      <ContactImport />

      <OutreachBatch />

      <div className="rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="font-semibold">Recent contacts</h2>
          <p className="text-sm text-[var(--muted)]">
            {due.length} follow-ups due
          </p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {contacts.map((contact) => (
            <article className="grid gap-2 p-4" key={contact.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">
                  {contact.name} · {contact.company}
                </p>
                <span className="text-sm text-[var(--muted)]">
                  {contact.status}
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">{contact.title}</p>
              <p className="text-sm">{contact.messageHistory.at(-1)?.body}</p>
            </article>
          ))}
          {contacts.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--muted)]">
              No outreach contacts yet.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
