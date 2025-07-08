const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlMinimizerPlugin = require('html-minimizer-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: './background.js',
    'book_page_info': './book_page_info.js',
    report: './report.js',
    offscreen: './offscreen.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]'
        }
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Keep console logs for debugging
            drop_debugger: false,
          },
          mangle: {
            reserved: ['chrome'] // Don't mangle chrome API calls
          }
        }
      }),
      new CssMinimizerPlugin({
        test: /\.css$/i,
      }),
      new HtmlMinimizerPlugin({
        test: /\.html$/i,
      })
    ]
  },
  devtool: 'source-map', // Generate source maps for debugging
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: '*.html', 
          to: '[name][ext]',
          noErrorOnMissing: true
        },
        { 
          from: '*.css', 
          to: '[name][ext]',
          noErrorOnMissing: true
        },
        {
          from: 'scrapers.js',
          to: 'scrapers.js'
        },
        {
          from: 'icons/',
          to: 'icons/',
          noErrorOnMissing: true
        },
        {
          from: 'manifest.json',
          to: 'manifest.json'
        }
      ],
    }),
  ]
};