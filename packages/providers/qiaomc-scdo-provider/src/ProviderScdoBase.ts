import { IInjectedProviderNames } from '@qiaomcfe/cross-inpage-provider-types';

import { ProviderBase, IInpageProviderConfig } from '@qiaomcfe/cross-inpage-provider-core';

class ProviderScdoBase extends ProviderBase {
  constructor(props: IInpageProviderConfig) {
    super(props);
  }

  protected providerName = IInjectedProviderNames.scdo;

  request(data: unknown) {
    return this.bridgeRequest(data);
  }
}

export { ProviderScdoBase };
