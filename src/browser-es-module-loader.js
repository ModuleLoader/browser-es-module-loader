import RegisterLoader from 'es-module-loader/core/register-loader.js';
import { InternalModuleNamespace as ModuleNamespace } from 'es-module-loader/core/loader-polyfill.js';

import { baseURI, global, isBrowser } from 'es-module-loader/core/common.js';
import { resolveIfNotPlain } from 'es-module-loader/core/resolve.js';

if (!window.babel || !window.babelPluginTransformES2015ModulesSystemJS || !window.babelPluginSyntaxDynamicImport)
  throw new Error('babel-browser-build.js must be loaded first');

var loader;

// <script type="module"> support
var anonSources = {};
if (typeof document != 'undefined' && document.getElementsByTagName) {
  function ready() {
    document.removeEventListener('DOMContentLoaded', ready, false );

    var anonCnt = 0;

    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.type == 'module' && !script.loaded) {
        script.loaded = true;
        if (script.src) {
          loader.import(script.src);
        }
        // anonymous modules supported via a custom naming scheme and registry
        else {
          var uri = './<anon' + ++anonCnt + '>';
          if (script.id !== ""){
            uri = "./" + script.id;
          }

          var anonName = resolveIfNotPlain(uri, baseURI);
          anonSources[anonName] = script.innerHTML;
          loader.import(anonName);
        }
      }
    }
  }

  // simple DOM ready
  if (document.readyState === 'complete')
    setTimeout(ready);
  else
    document.addEventListener('DOMContentLoaded', ready, false);
}

function BrowserESModuleLoader(baseKey) {
  if (baseKey)
    this.baseKey = resolveIfNotPlain(baseKey, baseURI) || resolveIfNotPlain('./' + baseKey, baseURI);

  RegisterLoader.call(this);

  var loader = this;

  // ensure System.register is available
  global.System = global.System || {};
  if (typeof global.System.register == 'function')
    var prevRegister = global.System.register;
  global.System.register = function() {
    loader.register.apply(loader, arguments);
    if (prevRegister)
      prevRegister.apply(this, arguments);
  };
}
BrowserESModuleLoader.prototype = Object.create(RegisterLoader.prototype);

// normalize is never given a relative name like "./x", that part is already handled
BrowserESModuleLoader.prototype[RegisterLoader.resolve] = function(key, parent) {
  var resolved = RegisterLoader.prototype[RegisterLoader.resolve].call(this, key, parent || this.baseKey) || key;
  if (!resolved)
    throw new RangeError('ES module loader does not resolve plain module names, resolving "' + key + '" to ' + parent);

  return resolved;
};

function xhrFetch(url, resolve, reject) {
  var xhr = new XMLHttpRequest();
  function load(source) {
    resolve(xhr.responseText);
  }
  function error() {
    reject(new Error('XHR error' + (xhr.status ? ' (' + xhr.status + (xhr.statusText ? ' ' + xhr.statusText  : '') + ')' : '') + ' loading ' + url));
  }

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      // in Chrome on file:/// URLs, status is 0
      if (xhr.status == 0) {
        if (xhr.responseText) {
          load();
        }
        else {
          // when responseText is empty, wait for load or error event
          // to inform if it is a 404 or empty file
          xhr.addEventListener('error', error);
          xhr.addEventListener('load', load);
        }
      }
      else if (xhr.status === 200) {
        load();
      }
      else {
        error();
      }
    }
  };
  xhr.open("GET", url, true);
  xhr.send(null);
}

// instantiate just needs to run System.register
// so we fetch the source, convert into the Babel System module format, then evaluate it
BrowserESModuleLoader.prototype[RegisterLoader.instantiate] = function(key, processAnonRegister) {
  var loader = this;

  // load as ES with Babel converting into System.register
  return new Promise(function(resolve, reject) {
    // anonymous module
    if (anonSources[key]) {
      resolve(anonSources[key])
      anonSources[key] = undefined;
    }
    // otherwise we fetch
    else {
      xhrFetch(key, resolve, reject);
    }
  })
  .then(function(source) {
    // transform source with Babel
    var output = babel.transform(source, {
      compact: false,
      filename: key + '!transpiled',
      sourceFileName: key,
      moduleIds: false,
      sourceMaps: 'inline',
      babelrc: false,
      plugins: [babelPluginSyntaxDynamicImport, babelPluginTransformES2015ModulesSystemJS]
    });

    // evaluate without require, exports and module variables
    // we leave module in for now to allow module.require access
    (0, eval)(output.code + '\n//# sourceURL=' + key + '!transpiled');
    processAnonRegister();
  });
};

// create a default loader instance in the browser
if (isBrowser)
  loader = new BrowserESModuleLoader();

export default BrowserESModuleLoader;
