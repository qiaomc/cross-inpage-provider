import { JsBridgeDesktopInjected } from '@qiaomcfe/desktop-bridge-injected';
import {
  injectedProviderReceiveHandler,
  injectJsBridge,
} from '@qiaomcfe/cross-inpage-provider-core';

import { injectWeb3Provider } from '@qiaomcfe/inpage-providers-hub';

const bridge = () =>
  new JsBridgeDesktopInjected({
    receiveHandler: injectedProviderReceiveHandler,
  });
injectJsBridge(bridge);

injectWeb3Provider();

// eslint-disable-next-line no-void
void 0;
