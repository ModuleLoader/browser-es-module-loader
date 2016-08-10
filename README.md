Browser ES Module Loader
===

Loads ES modules in the browser via Babel just like the WhatWG HTML specification for modules.

Also supports the `<script type="module">` tag with both `src` and inline forms.

Throws when loading bare / plain names.

See the `example` folder for a demonstration.

Built with the ES Module Loader polyfill 1.0 branch at https://github.com/ModuleLoader/es-module-loader.

### Installation

```
npm install browser-es-module-loader
```

### Usage

```html
<script src="dist/babel-browser-build.js"></script>
<script src="dist/browser-es-module-loader.js"></script>
<script>
  var loader = new BrowserESModuleLoader();

  // relative path or URL syntax is necessary as plain resolution throws
  loader.import('./path/to/file.js').then(function(m) {
    // ...
  });
</script>

<!-- script type module loading -->
<script type="module" src="path/to/module.js"></script>

<!-- Anonymous script type module loading -->
<script type="module">
import {x} from './y.js';

// this case throws as plain / bare names are not supported as in the WhatWG spec
import thisWillThrow from 'x';
</script>
```

LICENSE
---

MIT