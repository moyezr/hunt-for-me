import {
  detectFields,
  fillField,
  readGenericContext,
} from "@/extension/content/platforms/common";
import { readNaukriContext } from "@/extension/content/platforms/naukri";

function getContext() {
  if (location.hostname.includes("naukri")) {
    return readNaukriContext();
  }

  if (location.hostname.includes("indeed")) {
    return readGenericContext("indeed");
  }

  if (location.hostname.includes("wellfound")) {
    return readGenericContext("wellfound");
  }

  if (location.hostname.includes("linkedin")) {
    return readGenericContext("linkedin");
  }

  return readGenericContext("unknown");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "HFM_SCAN") {
    sendResponse({
      context: getContext(),
      fields: detectFields(),
    });
    return true;
  }

  if (message.type === "HFM_FILL") {
    const results = (
      message.answers as { selector: string; answer: string }[]
    ).map((answer) => ({
      selector: answer.selector,
      filled: fillField(answer.selector, answer.answer),
    }));

    sendResponse({ results });
    return true;
  }

  return false;
});
