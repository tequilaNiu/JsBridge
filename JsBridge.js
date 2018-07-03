export const initJSBridge = () => {
  if (window.JSBridge) return window.JSBridge;
  let callbackId = 0;
  let callbacks = {};
  let registerFuncs = {};
  let nativeBridge = null;
  // Android、UIWebView、WKWebView
  if (window.webkit && window.webkit.messageHandlers
      && window.webkit.messageHandlers.mpos_bridge) {
    nativeBridge = window.webkit.messageHandlers.mpos_bridge;
  } else if (window.mpos_bridge) {
    nativeBridge = window.mpos_bridge;
  } else {
    throw Error('mpos_bridge未注入！');
  }

  window.JSBridge = {
    // js调用native接口
    invoke: (functionName, callback, data) => {
      let thisCallbackId = callbackId++;
      callbacks[thisCallbackId] = callback;
      this._getNativeBridge();
      if (this._getSystem() == 0 && this._getAndroidVersion() <= 4.2) {
        prompt(`mposjs://postMessage?${JSON.stringify({ 
          data,
          functionName,
          callbackId: this.callbackId
        })}`)
      } else {
        nativeBridge.postMessage({
          functionName,
          data: data || {},
          callbackId: thisCallbackId,
        });        
      }
    },
    // native调用js
    receiveMessage: (params) => {
      let functionName = params.functionName;
      let data = params.data || {};
      let callbackId = params.callbackId;
      let responseId = params.responseId;

      if (callbackId && callbacks[callbackId]) {
        callbacks[callbackId](data);
      } else if (functionName) {
        let result = {};
        if (registerFuncs[functionName]) {
          Object.assign(result, registerFuncs[functionName](data));
        } else {
          result.error = '未找到调用方法';
        }
        if (this._getSystem() == 0 && this._getAndroidVersion() >= 4.4) {
          return { responseId, data: result };
        } else {
          nativeBridge.postMessage({
            responseId: responseId,
            data: result,
          });
        }
      }
    },
    // 提供给native调用的方法
    register: (functionName, callback) => {
      if (!registerFuncs[functionName]) {
        registerFuncs[functionName] = {};
      }
      registerFuncs[functionName] = callback;
    },
    // 判断是安卓还是ios 0:android  1:ios -1:错误
    _getSystem: () => {
      const ua = navigator.userAgent;
      if (ua.indexOf('Android') > -1 || ua.indexOf('Adr') > -1) {
        return 0;
      } else if (!!ua.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/)) {
        return 1;
      } else {
        return -1;
      }
    },
    // 判断安卓版本
    _getAndroidVersion: () => {
      const ua = navigator.userAgent.toLowerCase();
      let version = null;
      if (ua.indexOf('android') > 0) {
        const reg = /android [\d._]+/gi;
        const v_info = ua.match(reg);
        // 得到版本号
        version = (v_info + '').replace(/[^0-9|_.]/ig, '').replace(/_/ig, '.'); 
        // 得到版本号第1,2位
        version = parseFloat(`${version.split('.')[0]}.${version.split('.')[1]}`); 
      }
    
      return version;
    },
    // 判断ios版本
    _getIosVersion: () => {
      const ua = navigator.userAgent.toLowerCase();
      let version = null;
      if (ua.indexOf('like mac os x') > 0) {
        const reg = /os [\d._]+/gi;
        const v_info = ua.match(reg);
        // 得到版本号9.3.2或者9.0
        version = (v_info + '').replace(/[^0-9|_.]/ig, '').replace(/_/ig, '.');
        // 得到版本号第1,2位
        version = parseFloat(`${version.split('.')[0]}.${version.split('.')[1]}`);
      }
    
      return version;
    }
  }
}