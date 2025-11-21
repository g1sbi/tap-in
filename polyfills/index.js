import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import process from 'process';
import 'react-native-get-random-values';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (typeof global.process === 'undefined') {
  global.process = process;
}

if (typeof global.EventEmitter === 'undefined') {
  global.EventEmitter = EventEmitter;
}
