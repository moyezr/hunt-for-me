import { generateOutreach } from "@/lib/ai";
import { addMessageToContact, getContact } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { OutreachMessage } from "@/lib/types";
import { isOutreachChannel, isUsableOutreachContact } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contact = getContact(id);
    const body = await readRequestBody<{
      channel?: OutreachMessage["channel"];
      companyContext?: string;
    }>(request);

    if (body.channel && !isOutreachChannel(body.channel)) {
      return jsonError("Invalid outreach channel", 400);
    }

    if (
      !isUsableOutreachContact({
        company: contact.company,
        title: contact.title,
      })
    ) {
      return jsonError("Detected company and title are required", 400);
    }

    const channel = body.channel ?? "linkedin_note";
    const messageBody = await generateOutreach({
      name: contact.name,
      title: contact.title,
      company: contact.company,
      channel,
      companyContext: body.companyContext?.trim() || contact.notes,
    });

    const message = {
      channel,
      body: messageBody,
      createdAt: new Date().toISOString(),
    };
    const updatedContact = addMessageToContact({
      id,
      message,
      status: "drafted",
    });

    return jsonOk({ contact: updatedContact, message });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to draft contact message",
      500,
    );
  }
}
