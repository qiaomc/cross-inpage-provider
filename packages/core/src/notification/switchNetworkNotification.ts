import notification, { isInSameOriginIframe } from "./notification";
import { IconLogo } from './icon'

let instance: ReturnType<typeof notification> | null;

export const switchNetworkNotification = (networkChangedText: string) => {
  if (isInSameOriginIframe()) {
    return;
  }
  if (instance) {
    instance.dismiss();
    instance = null;
  }
  instance = notification({
    dismissible: false,
    duration: 1500,
    customClass: "qiaomc-alert-network-changed",
    content: `<div style="display: flex; align-items: center; gap: 8px;">
      <img style="width: 32px;" src="${IconLogo}"/>
      <div>
        <div style="color: rgba(0, 0, 0, 0.88); font-size: 13px;"><span style="line-height: 19px; font-weight: 500;">${networkChangedText}</span></div>
      </div>
    </div>
    `,
  });
};
