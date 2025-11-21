const WebSocketPolyfill = class {
  constructor(url, protocols, options) {
    this._ws = new WebSocket(url, protocols);
    this.readyState = WebSocket.CONNECTING;
    this.url = url;
    this.protocols = protocols;
    this.options = options || {};
    
    this._ws.onopen = () => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    };
    
    this._ws.onclose = (event) => {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) this.onclose(event);
    };
    
    this._ws.onerror = (error) => {
      if (this.onerror) this.onerror(error);
    };
    
    this._ws.onmessage = (event) => {
      if (this.onmessage) this.onmessage(event);
    };
  }
  
  send(data, cb) {
    try {
      this._ws.send(data);
      if (cb) cb();
    } catch (err) {
      if (cb) cb(err);
    }
  }
  
  close(code, reason) {
    this._ws.close(code, reason);
  }
  
  addEventListener(type, listener) {
    this._ws.addEventListener(type, listener);
  }
  
  removeEventListener(type, listener) {
    this._ws.removeEventListener(type, listener);
  }
  
  ping(data, mask, cb) {
    if (cb) cb();
  }
  
  pong(data, mask, cb) {
    if (cb) cb();
  }
  
  terminate() {
    this._ws.close();
  }
};

WebSocketPolyfill.CONNECTING = 0;
WebSocketPolyfill.OPEN = 1;
WebSocketPolyfill.CLOSING = 2;
WebSocketPolyfill.CLOSED = 3;

WebSocketPolyfill.Server = class {};
WebSocketPolyfill.Receiver = class {};
WebSocketPolyfill.Sender = class {};

module.exports = WebSocketPolyfill;

