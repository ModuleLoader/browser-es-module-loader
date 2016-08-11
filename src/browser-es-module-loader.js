import RegisterLoader from 'es-module-loader/core/register-loader.js';
import { PrivateInternalModuleNamespace as ModuleNamespace } from 'es-module-loader/core/loader-polyfill.js';

import { baseURI, global, isBrowser } from 'es-module-loader/core/common.js';
import { resolveUrlToParentIfNotPlain } from 'es-module-loader/core/resolve.js';
import { envFetch } from 'es-module-loader/core/fetch.js';

if (!window.babel || !window.babelPluginTransformES2015ModulesSystemJS)
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
          var anonName = resolveUrlToParentIfNotPlain('./<anon' + ++anonCnt + '>', baseURI);
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
  baseKey = baseKey ? resolveUrlToParentIfNotPlain(baseKey, baseURI) || baseKey : baseURI;
  RegisterLoader.call(this, baseKey);

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
BrowserESModuleLoader.prototype.normalize = function(key, parent, metadata) {
  if (key.indexOf(':') === -1)
    throw new RangeError('ES module loader does not resolve plain module names, resolving "' + key + '" to ' + parent);

  return key;
};

// instantiate just needs to run System.register
// so we fetch the source, convert into the Babel System module format, then evaluate it
BrowserESModuleLoader.prototype.instantiate = function(key, metadata) {
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
      envFetch(key, undefined, resolve, reject);
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
      plugins: [babelPluginTransformES2015ModulesSystemJS]
    });

    // evaluate without require, exports and module variables
    // we leave module in for now to allow module.require access
    eval('var require,exports;' + output.code + '\n//# sourceURL=' + key + '!transpiled');
    loader.processRegisterQueue(key);      
  });
};

// create a default loader instance in the browser
if (isBrowser)
  loader = new BrowserESModuleLoader();

export default BrowserESModuleLoader;