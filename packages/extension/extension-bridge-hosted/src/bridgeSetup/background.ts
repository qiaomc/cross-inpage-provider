import { JsBridgeExtBackground } from '../JsBridgeExtBackground';
import { IJsBridgeReceiveHandler } from '@qiaomcfe/cross-inpage-provider-types';

function createHostBridge({ receiveHandler }: { receiveHandler: IJsBridgeReceiveHandler }) {
  const bridge = new JsBridgeExtBackground({
    receiveHandler,
  });
  return bridge;
}

export default {
  createHostBridge,
};
