import { JsBridgeNativeInjected } from '@qiaomcfe/native-bridge-injected';
import { injectWeb3Provider } from '@qiaomcfe/inpage-providers-hub';

import {
  injectedProviderReceiveHandler,
  injectJsBridge,
} from '@qiaomcfe/cross-inpage-provider-core';

const bridge = () =>
  new JsBridgeNativeInjected({
    receiveHandler: injectedProviderReceiveHandler,
  });
injectJsBridge(bridge);

injectWeb3Provider();

// eslint-disable-next-line no-void
void 0;
