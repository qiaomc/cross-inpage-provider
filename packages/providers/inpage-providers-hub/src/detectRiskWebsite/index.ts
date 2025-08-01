/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { isInSameOriginIframe } from '@qiaomcfe/cross-inpage-provider-core';
import { styleContent } from "./style";

enum EHostSecurityLevel {
  High = "high",
  Medium = "medium",
  Security = "security",
  Unknown = "unknown",
}
interface IAttackType {
  name: string;
  description: string;
}

interface IHostSecurity {
  host: string;
  level: EHostSecurityLevel;
  attackTypes: IAttackType[];
  phishingSite: boolean;
  alert: string;
}

interface IWalletRiskInfo {
  securityInfo: IHostSecurity;
  isExtension: boolean | undefined;
  i18n: {
    title: string;
    description: string;
    continueMessage: string;
    continueLink: string;
    addToWhiteListLink: string;
    sourceMessage: string;
  };
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

class ShadowModal {
  hostElement: HTMLElement | null;
  shadowRoot: ShadowRoot | null | undefined;
  riskInfo: IWalletRiskInfo | undefined;

  constructor(hostElementId: string, riskInfo: IWalletRiskInfo) {
    this.hostElement = document.getElementById(hostElementId);
    if (!this.hostElement) {
      console.error(`Element with ID '${hostElementId}' not found.`);
      return;
    }

    this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });
    this.riskInfo = riskInfo;
    this.render();
  }

  render() {
    const {
      title = "Malicious Dapp",
      description = "The current website may be malicious. Continue visiting could result in loss of assets.",
      continueMessage = "If you understand the risks and want to proceed, you can",
      continueLink = "dismiss",
      addToWhiteListLink = "add to whitelist",
      sourceMessage = "Powered by",
    } = this.riskInfo?.i18n ?? {};
    // 创建样式
    const style = document.createElement("style");
    style.textContent = styleContent;

    // 创建浮层 div
    const overlay = document.createElement("div");
    overlay.className = "qiaomc-inject-overlay";

    // 创建 Modal div
    const modalContainer = document.createElement("div");
    modalContainer.className = "qiaomc-inject-modal-container";

    const modal = document.createElement("div");
    modal.className = "qiaomc-inject-modal";

    // 创建风险提示内容
    const riskWarning = document.createElement("div");
    riskWarning.className = "qiaomc-inject-risk-warning";
    riskWarning.innerHTML = `<div class="qiaomc-inject-title qiaomc-inject-font  qiaomc-inject-headingXl">
			<div class="qiaomc-inject-error-icon">
			</div>
		${title}
		</div>
		<p class="qiaomc-inject-text-wrap qiaomc-inject-font qiaomc-inject-bodyLg">${description}</p>
		<p class="qiaomc-inject-font qiaomc-inject-bodyLg qiaomc-inject-text-subdued">${continueMessage}${" "}<span id="qiaomc-inject-continue" class="qiaomc-inject-continue-link">${continueLink}</span>${" or "}<span id="qiaomc-inject-addToWhiteList" class="qiaomc-inject-continue-link">${addToWhiteListLink}</span>.</p>
		`;

    const footer = document.createElement("div");
    footer.className =
      "qiaomc-inject-footer qiaomc-inject-font qiaomc-inject-bodyLg";
    footer.innerHTML = `<span>${sourceMessage}</span>
		<div class="qiaomc-inject-logo">
      <div class="qiaomc-inject-logo-content"></div>
			<span>QiaoMc</span>
		</div>`;

    // 组装
    modal.appendChild(riskWarning);
    modalContainer.appendChild(modal);
    modalContainer.appendChild(footer);
    overlay.appendChild(modalContainer);
    this.shadowRoot?.appendChild(style);
    this.shadowRoot?.appendChild(overlay);

    const continueButton = this.shadowRoot?.getElementById(
      "qiaomc-inject-continue"
    );
    const addToWhiteListButton = this.shadowRoot?.getElementById(
      "qiaomc-inject-addToWhiteList"
    );
    if (continueButton) {
      console.log("continueButton --> onclick", continueButton);
      continueButton.addEventListener("click", () => this.closeOverlay());
    }
    if (addToWhiteListButton) {
      console.log("addToWhiteListButton --> onclick", addToWhiteListButton);
      addToWhiteListButton.addEventListener("click", () => void this.addToWhiteList());
    }
  }

  closeOverlay() {
    this.hostElement?.remove();
  }
  async addToWhiteList() {
    await window.$qiaomc.$private.request({
      method: "wallet_addBrowserUrlToRiskWhiteList",
    });
    this.closeOverlay();
  }
  closeTab() {
    void window.$qiaomc.$private.request({
      method: "wallet_closeCurrentBrowserTab",
    });
  }
}

function injectRiskErrorScreen(riskInfo: IWalletRiskInfo) {
  const injectDiv = document.createElement("div");
  injectDiv.id = "qiaomc-inject";
  document.body.appendChild(injectDiv);
  new ShadowModal("qiaomc-inject", riskInfo);
}

function ensureInjectRiskErrorScreen(riskInfo: IWalletRiskInfo) {
  console.log("=====>>>>:  Detect Risk website version 6");
  const interval = setInterval(() => {
    if (document.body && document.getElementById("qiaomc-inject")) {
      clearInterval(interval);
    } else {
      injectRiskErrorScreen(riskInfo);
    }
  }, 500);
  injectRiskErrorScreen(riskInfo);
}

export async function detectWebsiteRiskLevel() {
  console.log("=====>>>>:  Detect Risk website detectWebsiteRiskLevel");
  // wait nexttick
  await wait(1000);
  try {
    const riskResult = (await window.$qiaomc.$private.request({
      method: "wallet_detectRiskLevel",
    })) as IWalletRiskInfo;
    if (riskResult.securityInfo.level === "high") {
      ensureInjectRiskErrorScreen(riskResult);
    }
  } catch (e) {
    console.error("Detect Risk website error: ", e);
  }
}

export function listenPageFocus() {
  // Notify the frontend of the last focused URL when the function is called
  const notifyToBackground = () => {
    if (window.top !== window.self) {
      return;
    }
    void window.$qiaomc.$private.request({
      method: "wallet_lastFocusUrl",
    });
  };

  try {
    notifyToBackground();
  } catch {
    // ignore
  }

  // Add a focus event listener to the window
  window.addEventListener('focus', () => {
    try {
      notifyToBackground();
    } catch (error) {
      console.error('Error notifying frontend of page focus:', error);
    }
  });
}
