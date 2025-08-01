import { IInjectedProviderNames, IJsonRpcRequest } from '@qiaomcfe/cross-inpage-provider-types';

import { ProviderBase, IInpageProviderConfig } from '@qiaomcfe/cross-inpage-provider-core';

class ProviderNearBase extends ProviderBase {
  constructor(props: IInpageProviderConfig) {
    super(props);
  }

  protected providerName = IInjectedProviderNames.near;

  request(data: unknown) {
    return this.bridgeRequest(data);
  }
}

export { ProviderNearBase };
