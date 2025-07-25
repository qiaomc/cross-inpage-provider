/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IPostMessageEventData,
  IOptionsWithDebugLogger,
} from '@qiaomcfe/cross-inpage-provider-types';
import { JsBridgeBase } from './JsBridgeBase';

let postMessageListenerAdded = false;
export type ISetupPostMessageListenerOptions = IOptionsWithDebugLogger & {
  bridge?: JsBridgeIframe;
  origin?: string
};

export type IPostMessageEventDataIframe = IPostMessageEventData & {
  frameName: string;
};

/**
 * When the JsBridgeIframe instance changes, the tag can be changed manually
 */
 function setPostMessageListenerFlag(value: boolean) {
  postMessageListenerAdded = value;
}

function setupPostMessageListener(options: ISetupPostMessageListenerOptions = {}) {
  if (postMessageListenerAdded) {
    return;
  }
  postMessageListenerAdded = true;
  // - receive
  window.addEventListener(
    'message',
    (event: MessageEvent) => {
      // TODO source whitelist
      /**
       * This origin is not guaranteed to be the current or future origin of the window
       * temporarily comment this line
       */
      // if (event.origin !== options.origin) {
      //   return;
      // }

      const eventData = event.data as IPostMessageEventDataIframe;
      const config = options.bridge?.bridgeConfig;
      if (
        config &&
        eventData.channel === config.channel &&
        eventData.frameName === config.remoteFrameName
      ) {
        const payload = eventData.payload as IJsBridgeMessagePayload;
        const jsBridge = options.bridge ?? (window?.$qiaomc?.jsBridge as JsBridgeBase);
        if (jsBridge) {
          jsBridge.receive(payload);
        }
      }
    },
    false,
  );
}

export type IJsBridgeIframeConfig = IJsBridgeConfig & {
  remoteFrame: Window;
  selfFrameName: string;
  remoteFrameName: string;
  channel: string;
  targetOrigin?: string;
};
class JsBridgeIframe extends JsBridgeBase {
  targetOrigin: string;

  constructor(config: IJsBridgeIframeConfig) {
    super(config);
    this.bridgeConfig = config;
    this.targetOrigin = config.targetOrigin ?? window.location.origin
    // receive message
    setupPostMessageListener({
      debugLogger: this.debugLogger,
      bridge: this,
      origin: this.targetOrigin,
    });
  }

  bridgeConfig: IJsBridgeIframeConfig;

  sendAsString = false;

  isInjected = true;

  // send message
  sendPayload(payloadObj: IJsBridgeMessagePayload | string) {
    const eventData: IPostMessageEventDataIframe = {
      channel: this.bridgeConfig.channel,
      frameName: this.bridgeConfig.selfFrameName,
      payload: payloadObj,
      direction: '',
    };
    this.bridgeConfig.remoteFrame.postMessage(eventData, this.targetOrigin);
  }
}

export { JsBridgeIframe, setPostMessageListenerFlag };
