/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
const path = require('path');
const webpack = require('webpack');
const packageJson = require('./package.json');
const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const IS_PRD = process.env.NODE_ENV === 'production';

console.log('============ , IS_PRD', IS_PRD, process.env.NODE_ENV);

const createAnalyzer = (name) => {
  return new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    reportFilename: `${name}.bundle-report.html`,
    openAnalyzer: false,
  });
};

const commonConfig = {
  mode: IS_PRD ? 'production' : 'development', // development, production
  optimization: {
    usedExports: true,
    minimize: true,
  },
  resolve: {
    // DO NOT need alias if injected working in all platforms
    //    alias module should be ES module export
    alias: {
      // secp256k1 required in @solana/web3.js index.iife.js
      // './precomputed/secp256k1': path.resolve(__dirname, 'development/resolveAlias/secp256k1-mock'),
      // '@solana/web3.js': path.resolve(__dirname, 'development/resolveAlias/@solana-web3'),
      tronweb: path.resolve(
        __dirname,
        'node_modules/@qiaomcfe/inpage-providers-hub/node_modules/@qiaomcfe/qiaomc-tron-provider/node_modules/tronweb/dist/TronWeb.js',
      ),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
    fallback: {
      'crypto': false,
      'crypto-browserify': require.resolve('crypto-browserify'),
    },
  },
  module: {
    rules: [
      {
        test: /\.text-(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: ['raw-loader'],
      },
      {
        test: /\.(c|m)?(js|jsx)$/,
        exclude: (modulePath) => {
          const includeModules = [
            // force third party library to compile
            '@solana/web3.js',
          ];
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (includeModules.some((module) => modulePath.includes(module))) {
            console.log('webpack babel loader includeModules: ', modulePath);
            return false;
          }
          const excludeModulesRegex = [/node_modules/, /\.text\.(js|jsx|ts|tsx)$/];
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return excludeModulesRegex.some((regex) => regex.test(modulePath));
        },
        use: [
          {
            loader: 'babel-loader',
            options: require('./babel.config.cjs'),
          },
        ],
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: ['ts-loader'],
      },
    ],
  },
  plugins: [].filter(Boolean),

  devtool: IS_PRD ? undefined : 'inline-source-map',
  output: {
    // Fix: "Uncaught ReferenceError: exports is not defined".
    // Fix: JIRA window.require('...') error
    libraryTarget: 'umd',
    // Fix: "Uncaught ReferenceError: global is not defined"
    globalObject: 'window',
    path: path.resolve(__dirname, 'dist/injected'),
    filename: '[name].js',
  },
};

const extensionConfig = merge(commonConfig, {
  resolve: {
    fallback: {
      buffer: require.resolve('buffer/'),
    },
  },
  target: 'web',
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    createAnalyzer('extension-and-native'),
  ],
  entry: {
    injectedExtension: './src/injectedExtension.ts',
    injectedNative: './src/injectedNative.ts',
  },
});

const desktopConfig = merge(commonConfig, {
  target: 'web',
  entry: {
    injectedDesktop: './src/injectedDesktop.ts',
  },
  externals: {
    electron: 'commonjs electron', // 将 Electron 标记为外部模块
  },
  plugins: [createAnalyzer('desktop')],
});

module.exports = [extensionConfig, desktopConfig];
