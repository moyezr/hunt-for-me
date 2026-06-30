import { generateOutreach } from "@/lib/ai";
import { maxOutreachDraftBatchSize } from "@/lib/batch-limits";
import { addMessageToContact, createContact, getContact } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { OutreachMessage } from "@/lib/types";
import { defaultPlatformForChannel, isOutreachChannel } from "@/lib/validation";

export const runtime = "nodejs";

type BatchContact = {
  id?: string;
  name?: string;
  title?: string;
  company?: string;
  companyContext?: string;
  platform?: string;
  profileUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<{
      contacts?: BatchContact[];
      channel?: OutreachMessage["channel"];
    }>(request);

    if (body.channel && !isOutreachChannel(body.channel)) {
      return jsonError("Invalid outreach channel", 400);
    }

    const channel = body.channel ?? "linkedin_note";
    const contacts = body.contacts ?? [];

    if (contacts.length === 0) {
      return jsonError("At least one contact is required", 400);
    }

    if (contacts.length > maxOutreachDraftBatchSize) {
      return jsonError(
        `Batch outreach drafts are capped at ${maxOutreachDraftBatchSize} contacts`,
        400,
      );
    }

    const invalidContact = contacts.find((contact) => {
      if (contact.id?.trim()) {
        return false;
      }

      return (
        !contact.name?.trim() ||
        !contact.title?.trim() ||
        !contact.company?.trim()
      );
    });
    if (invalidContact) {
      return jsonError("Every new contact needs name, title, and company", 400);
    }

    const drafts = await Promise.all(
      contacts.map(async (input, index) => {
        const existingContact = input.id ? getContact(input.id) : null;
        const name = existingContact?.name ?? input.name ?? "";
        const title = existingContact?.title ?? input.title ?? "";
        const company = existingContact?.company ?? input.company ?? "";
        const companyContext =
          input.companyContext?.trim() || existingContact?.notes || "";

        const messageBody = await generateOutreach({
          name,
          title,
          company,
          channel,
          companyContext,
        });
        const message = {
          channel,
          body: messageBody,
          createdAt: new Date().toISOString(),
        };
        const contact = existingContact
          ? addMessageToContact({
              id: existingContact.id,
              message,
              status: "drafted",
            })
          : createContact({
              name,
              title,
              company,
              platform: input.platform ?? defaultPlatformForChannel(channel),
              profileUrl: input.profileUrl ?? "",
              status: "drafted",
              message,
              notes: input.companyContext,
            });

        return {
          index,
          contact,
          message,
        };
      }),
    );

    return jsonOk({ drafts });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate messages",
      500,
    );
  }
}
