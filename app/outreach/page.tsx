import { OutreachBatch } from "@/app/outreach/outreach-batch";
import { getContacts } from "@/lib/db";

export default function OutreachPage() {
  const contacts = getContacts();
  const due = contacts.filter(
    (contact) =>
      contact.followUpDate && new Date(contact.followUpDate) <= new Date(),
  );

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <div>
        <h1 className="text-3xl font-semibold">Outreach batch</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Draft short founder, recruiter, and HR messages. Salary is
          intentionally excluded.
        </p>
      </div>

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
