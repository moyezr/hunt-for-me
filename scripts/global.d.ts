import type { Runtime } from "chrome";

declare global {
  interface Window {
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener: Runtime.MessageListener): void;
        };
      };
    };
    __hfmContentListener: Runtime.MessageListener;
    hfmEvents: string[];
    hfmSubmitted: boolean;
  }
}
