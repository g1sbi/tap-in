// Only apply polyfills on native platforms, not web
// Check platform using process.env or typeof window
const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

if (!isWeb) {
  const { Buffer } = require('buffer');
  const { EventEmitter } = require('events');
  const process = require('process');
  require('react-native-get-random-values');

  if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
  }

  if (typeof global.process === 'undefined') {
    global.process = process;
  }

  if (typeof global.EventEmitter === 'undefined') {
    global.EventEmitter = EventEmitter;
  }
}
