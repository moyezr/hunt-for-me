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

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form
          action="/api/message"
          className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
          method="post"
        >
          <label className="grid gap-1 text-sm">
            Name
            <input
              className="rounded-md border border-[var(--line)] px-3 py-2"
              name="name"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Title
            <input
              className="rounded-md border border-[var(--line)] px-3 py-2"
              name="title"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Company
            <input
              className="rounded-md border border-[var(--line)] px-3 py-2"
              name="company"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Company context
            <textarea
              className="min-h-24 rounded-md border border-[var(--line)] px-3 py-2"
              name="companyContext"
            />
          </label>
          <button
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            type="submit"
          >
            Draft message
          </button>
        </form>

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
      </section>
    </main>
  );
}
