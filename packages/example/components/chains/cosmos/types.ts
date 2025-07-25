import type { ProviderCosmos } from '@qiaomcfe/qiaomc-cosmos-provider';

export type IProviderApi = ProviderCosmos

export interface IProviderInfo {
  uuid: string;
  name: string;
  inject?: string; // window.ethereum
}
