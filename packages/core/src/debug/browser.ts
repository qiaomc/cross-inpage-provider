/* eslint-disable */
// @ts-nocheck

/**
 * This is the web browser implementation of `debug()`.
 */

import { DEBUG_LOGGER_STORAGE_KEY } from '../consts';
import { isNil } from 'lodash-es';
import humanize from 'ms';
const storageKey = DEBUG_LOGGER_STORAGE_KEY;

const exportsBrowser = {};
exportsBrowser.formatArgs = formatArgs;
exportsBrowser.save = save;
exportsBrowser.load = load;
exportsBrowser.useColors = useColors;
exportsBrowser.storage = customLocalStorage();
exportsBrowser.humanize = humanize;

exportsBrowser.destroy = (() => {
  let warned = false;

  return () => {
    if (!warned) {
      warned = true;
      console.warn(
        'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
      );
    }
  };
})();

/**
 * Colors.
 */

exportsBrowser.colors = [
  '#0000CC',
  '#0000FF',
  '#0033CC',
  '#0033FF',
  '#0066CC',
  '#0066FF',
  '#0099CC',
  '#0099FF',
  '#00CC00',
  '#00CC33',
  '#00CC66',
  '#00CC99',
  '#00CCCC',
  '#00CCFF',
  '#3300CC',
  '#3300FF',
  '#3333CC',
  '#3333FF',
  '#3366CC',
  '#3366FF',
  '#3399CC',
  '#3399FF',
  '#33CC00',
  '#33CC33',
  '#33CC66',
  '#33CC99',
  '#33CCCC',
  '#33CCFF',
  '#6600CC',
  '#6600FF',
  '#6633CC',
  '#6633FF',
  '#66CC00',
  '#66CC33',
  '#9900CC',
  '#9900FF',
  '#9933CC',
  '#9933FF',
  '#99CC00',
  '#99CC33',
  '#CC0000',
  '#CC0033',
  '#CC0066',
  '#CC0099',
  '#CC00CC',
  '#CC00FF',
  '#CC3300',
  '#CC3333',
  '#CC3366',
  '#CC3399',
  '#CC33CC',
  '#CC33FF',
  '#CC6600',
  '#CC6633',
  '#CC9900',
  '#CC9933',
  '#CCCC00',
  '#CCCC33',
  '#FF0000',
  '#FF0033',
  '#FF0066',
  '#FF0099',
  '#FF00CC',
  '#FF00FF',
  '#FF3300',
  '#FF3333',
  '#FF3366',
  '#FF3399',
  '#FF33CC',
  '#FF33FF',
  '#FF6600',
  '#FF6633',
  '#FF9900',
  '#FF9933',
  '#FFCC00',
  '#FFCC33',
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (
    typeof window !== 'undefined' &&
    window.process &&
    (window.process.type === 'renderer' || window.process.__nwjs)
  ) {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent &&
    navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
  ) {
    return false;
  }

  // Is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (
    (typeof document !== 'undefined' &&
      document.documentElement &&
      document.documentElement.style &&
      document.documentElement.style.WebkitAppearance) ||
    // Is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' &&
      window.console &&
      (window.console.firebug || (window.console.exception && window.console.table))) ||
    // Is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' &&
      navigator.userAgent &&
      navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) &&
      parseInt(RegExp.$1, 10) >= 31) ||
    // Double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' &&
      navigator.userAgent &&
      navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
  );
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  args[0] = `${
    (this.useColors ? '%c' : '') +
    this.namespace +
    (this.useColors ? ' %c' : ' ') +
    args[0] +
    (this.useColors ? '%c ' : ' ')
  }+${exportsBrowser.humanize(this.diff)}`;

  if (!this.useColors) {
    return;
  }

  const c = `color: ${this.color}`;
  args.splice(1, 0, c, 'color: inherit');

  // The final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  let index = 0;
  let lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, (match) => {
    if (match === '%%') {
      return;
    }
    index += 1;
    if (match === '%c') {
      // We only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
exportsBrowser.log = (...args) => {
  if (console.debug) {
    console.debug(...args);
  } else if (console.log) {
    console.log(...args);
  }
};

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
async function save(namespaces) {
  try {
    if (namespaces) {
      await exportsBrowser.storage.setItem(storageKey, namespaces);
    } else {
      if (isNil(namespaces)) {
        await exportsBrowser.storage.removeItem(storageKey);
      } else {
        await exportsBrowser.storage.setItem(storageKey, '');
      }
    }
  } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    console.error('debug logger storage error', error);
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
async function load() {
  let r;
  try {
    r = await exportsBrowser.storage.getItem(storageKey);
  } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    console.error('debug logger storage error', error);
  }

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function customLocalStorage() {
  try {
    if (typeof global !== 'undefined' && global.$$qiaomcAppStorage) {
      return global.$$qiaomcAppStorage;
    }
    // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
    // The Browser also has localStorage in the global context.
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }

    console.warn(
      'debugLogger init warning, neither `global.$$qiaomcAppStorage` nor `window.localStorage` found.',
    );
    return {
      async getItem() {
        return '';
      },
      async setItem() {
        // noop
      },
      async removeItem() {
        // noop
      },
    };
  } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    console.error('debug logger storage error', error);
  }
}

export default exportsBrowser;
