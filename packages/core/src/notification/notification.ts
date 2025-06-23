/* eslint-disable @typescript-eslint/no-explicit-any */
import { IconDismiss } from './icon'

interface NotificationSettings {
  content: string;
  triggerElement: HTMLElement | string;
  hostElement: HTMLElement;
  duration: number;
  onDismiss?: () => void;
  customClass?: string;
  dismissible: boolean;
}
class Notification {
  settings: NotificationSettings;
  element: HTMLDivElement | null;
  eventHandlers: Record<string, (...args: any) => void>;

  dismissButton?: HTMLElement;

  dismissalTimer?: number | null;

  constructor(settings: NotificationSettings) {
    this.settings = settings;
    this.element = document.createElement("div");
    this.element.className = `qiaomc-alert-message ${
      this.settings.customClass ? this.settings.customClass : ""
    }`;

    // initialize event handlers
    this.eventHandlers = {};

    // add inner content
    this.insert();

    // start auto-dismiss timer
    if (this.settings.duration) {
      this.initiateTimer();
    }

    // mouse interaction events
    this.bindEvents();
  }

  insert() {
    if (!this.element) {
      return;
    }

    // content container
    const contentContainer = document.createElement("div");
    contentContainer.className = "qiaomc-alert-message-body";
    contentContainer.innerHTML = this.settings.content;
    this.element?.appendChild(contentContainer);

    // dismiss button
    if (this.settings.dismissible) {
      this.dismissButton = document.createElement("div");
      this.dismissButton.className = "qiaomc-alert-message-dismiss";
      const dismissIcon = document.createElement("img");
      dismissIcon.setAttribute("src", IconDismiss);
      dismissIcon.className = "qiaomc-alert-close-icon";
      this.dismissButton.appendChild(dismissIcon);
      this.element.appendChild(this.dismissButton);
    }

    this.settings.hostElement.appendChild(this.element);
  }

  bindEvents() {
    this.eventHandlers.dismiss = () => this.dismiss();

    this.dismissButton?.addEventListener("click", this.eventHandlers.dismiss, false);
  }

  initiateTimer(duration = this.settings.duration) {
    this.dismissalTimer = setTimeout(() => {
      this.dismiss();
    }, duration) as unknown as number;
  }

  cancelTimer() {
    if (this.dismissalTimer) {
      clearTimeout(this.dismissalTimer);
      this.dismissalTimer = null;
    }
  }

  dismiss() {
    if (!this.element) {
      return;
    }
    this.element.classList.add(".qiaomc-alert-message-hidden");
    this.settings.hostElement.removeChild(this.element);
    this.element = null;
    if (this.settings.onDismiss) {
      this.settings.onDismiss();
    }
    this.cancelTimer();
  }
}

let container: HTMLDivElement | null = null;
let style: HTMLStyleElement | null = null;

const styles = `
    .qiaomc-alert-container {
      position: fixed;
      z-index: 99999;
      top: 60px;
      right: 42px;
    }
    .qiaomc-alert-message {
      min-width: 230px;
      min-height: 44px;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
      box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.10);
      border-radius: 8px;
      display: flex;
      align-items: center;

      font-family: 'Arial', sans-serif;
      font-style: normal;
      font-weight: 500;
      font-size: 13px;
      line-height: 19px;
      color: rgba(0, 0, 0, 0.88);

      padding: 16px;
      gap: 8px;

      opacity: 1;
    }
    .qiaomc-alert-message + .qiaomc-alert-message {
      margin-top: 30px;
    }
    .qiaomc-alert-message-body {
      display: flex;
      align-items: center;
      color: #13141A;
    }
    .qiaomc-alert-message-hidden {
      opacity: 0;
      transition: 0.3s;
    }

    .qiaomc-alert-message-dismiss {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      cursor: pointer;
    }
    .qiaomc-alert-close-icon-close {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
    }
    .qiaomc-strong {
      font-weight: bold;
      color: #13141A;
    }
    .qiaomc-alert-default-wallet {
      border-radius: 8px;
      height: 71px;

      font-size: 12px;
      line-height: 16px;
      color: #13141A;
    }

    .qiaomc-alert-network-changed {
      border-radius: 8px;
      height: 71px;

      font-size: 12px;
      line-height: 16px;
      color: #13141A;
    }
  `;

function notification(options: Partial<NotificationSettings>) {
  const {
    content = "",
    duration = 0,
    triggerElement = "×",
    customClass = "",
    dismissible = false,
  } = options || {};

  if (!container) {
    const hostElement = document.createElement('div');
    hostElement.id = 'qiaomc-notification-center';
    const shadowRoot = hostElement.attachShadow({ mode: 'open' })
    container = document.createElement("div");
    container.classList.add("qiaomc-alert-container");
    style = document.createElement("style");
    style.innerHTML = styles;
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(container);
    document.body.appendChild(hostElement);
  }

  return new Notification({
    content,
    duration,
    triggerElement,
    hostElement: container,
    customClass,
    dismissible,
    onDismiss: () => {
      if (container && !container?.hasChildNodes()) {
        const rootNode = container.getRootNode()
        if (rootNode instanceof ShadowRoot) {
          document.body.removeChild(rootNode.host);
        } else {
          document.body.removeChild(rootNode)
        }
        style = null;
        container = null;
      }
    },
  });
}

export default notification;

const isInIframe = () => {
  return window.self !== window.top;
};

export const isInSameOriginIframe = () => {
  if (!isInIframe()) {
    return false;
  }

  try {
    return window.self.location.origin === window.top?.location?.origin;
  } catch (e) {
    return false;
  }
};
