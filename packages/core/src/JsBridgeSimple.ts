import { IJsBridgeMessagePayload } from '@qiaomcfe/cross-inpage-provider-types';

import { JsBridgeBase } from './JsBridgeBase';

class JsBridgeSimple extends JsBridgeBase {
  sendAsString = true;

  isInjected = true;

  private remote: JsBridgeBase | null = null;

  callbacksExpireTimeout = 0;

  sendPayload(payload: IJsBridgeMessagePayload | string): void {
    if (!this.remote) {
      throw new Error('JsBridgeSimple ERROR: remote not set.');
    }
    this.remote.receive(payload as string);
  }

  setRemote(remote: JsBridgeBase) {
    this.remote = remote;
  }
}

export { JsBridgeSimple };
