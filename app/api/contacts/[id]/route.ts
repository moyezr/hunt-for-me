import { countSentMessagesToday, getContact, updateContact } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { ContactStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contact = getContact(id);
    const body = await readRequestBody<{
      status?: ContactStatus;
      messageBody?: string;
    }>(request);

    if (body.status === "sent") {
      const channel = contact.messageHistory.at(-1)?.channel;
      if (
        channel === "linkedin_note" &&
        countSentMessagesToday(contact.platform, "linkedin_note") >= 15
      ) {
        return jsonError("LinkedIn connection request daily cap reached", 429);
      }

      if (
        channel === "linkedin_dm" &&
        countSentMessagesToday(contact.platform, "linkedin_dm") >= 10
      ) {
        return jsonError("LinkedIn DM daily cap reached", 429);
      }
    }

    return jsonOk({
      contact: updateContact({
        id,
        status: body.status,
        messageBody: body.messageBody,
      }),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update contact",
      500,
    );
  }
}
