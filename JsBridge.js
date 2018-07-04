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
    // js调用native接口, 如果只是注册，并不调用isRegister设为true，返回一个id
    // 当想执行时 callback设为返回的id
    invoke: function(functionName, callback, data, isRegister = false) {
      let thisCallbackId;
      if (typeof callback === 'function') {
        thisCallbackId = callbackId++;
        callbacks[thisCallbackId] = callback;

        if (isRegister) {
          return thisCallbackId;
        }
      } else {
        thisCallbackId = callback;
      }

      if (this._getSystem() == 0 && this._getAndroidVersion() <= 4.2) {
        const result = prompt(`mposjs://postMessage?jsonParams=${JSON.stringify({ 
          data,
          functionName,
          callbackId: thisCallbackId
        })}`)
        if (result) {
          this.receiveMessage(result);
        }
      } else {
        nativeBridge.postMessage({
          functionName,
          data: data || {},
          callbackId: thisCallbackId,
        });        
      }
    },
    // native调用js
    receiveMessage: function(params) {
      let functionName = params.functionName;
      let data = params.data || {};
      let callbackId = params.callbackId;
      let responseId = params.responseId;
      let errorCode = params.errorCode;
      let errorMsg = params.errorMsg;
      
      if (errorCode) {
        console.log(errorCode, errorMsg);
      }

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