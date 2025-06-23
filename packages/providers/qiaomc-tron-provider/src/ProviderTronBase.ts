import { IInjectedProviderNames } from '@qiaomcfe/cross-inpage-provider-types';
import { ProviderBase, IInpageProviderConfig } from '@qiaomcfe/cross-inpage-provider-core';

class ProviderTronBase extends ProviderBase {
  constructor(props: IInpageProviderConfig) {
    super(props);
  }

  protected readonly providerName = IInjectedProviderNames.tron;

  request(data: unknown) {
    return this.bridgeRequest(data);
  }
}

export { ProviderTronBase };
