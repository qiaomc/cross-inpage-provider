import type { ProviderAptosMartian } from '@qiaomcfe/qiaomc-aptos-provider';

export type IProviderApi = ProviderAptosMartian

export interface IProviderInfo {
  uuid: string;
  name: string;
  inject?: string; // window.ethereum
}
