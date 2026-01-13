var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// node_modules/fast-content-type-parse/index.js
var require_fast_content_type_parse = __commonJS((exports2, module2) => {
  var NullObject = function NullObject() {};
  NullObject.prototype = Object.create(null);
  var paramRE = /; *([!#$%&'*+.^\w`|~-]+)=("(?:[\v\u0020\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\v\u0020-\u00ff])*"|[!#$%&'*+.^\w`|~-]+) */gu;
  var quotedPairRE = /\\([\v\u0020-\u00ff])/gu;
  var mediaTypeRE = /^[!#$%&'*+.^\w|~-]+\/[!#$%&'*+.^\w|~-]+$/u;
  var defaultContentType = { type: "", parameters: new NullObject };
  Object.freeze(defaultContentType.parameters);
  Object.freeze(defaultContentType);
  function parse2(header) {
    if (typeof header !== "string") {
      throw new TypeError("argument header is required and must be a string");
    }
    let index = header.indexOf(";");
    const type = index !== -1 ? header.slice(0, index).trim() : header.trim();
    if (mediaTypeRE.test(type) === false) {
      throw new TypeError("invalid media type");
    }
    const result = {
      type: type.toLowerCase(),
      parameters: new NullObject
    };
    if (index === -1) {
      return result;
    }
    let key;
    let match;
    let value;
    paramRE.lastIndex = index;
    while (match = paramRE.exec(header)) {
      if (match.index !== index) {
        throw new TypeError("invalid parameter format");
      }
      index += match[0].length;
      key = match[1].toLowerCase();
      value = match[2];
      if (value[0] === '"') {
        value = value.slice(1, value.length - 1);
        quotedPairRE.test(value) && (value = value.replace(quotedPairRE, "$1"));
      }
      result.parameters[key] = value;
    }
    if (index !== header.length) {
      throw new TypeError("invalid parameter format");
    }
    return result;
  }
  function safeParse(header) {
    if (typeof header !== "string") {
      return defaultContentType;
    }
    let index = header.indexOf(";");
    const type = index !== -1 ? header.slice(0, index).trim() : header.trim();
    if (mediaTypeRE.test(type) === false) {
      return defaultContentType;
    }
    const result = {
      type: type.toLowerCase(),
      parameters: new NullObject
    };
    if (index === -1) {
      return result;
    }
    let key;
    let match;
    let value;
    paramRE.lastIndex = index;
    while (match = paramRE.exec(header)) {
      if (match.index !== index) {
        return defaultContentType;
      }
      index += match[0].length;
      key = match[1].toLowerCase();
      value = match[2];
      if (value[0] === '"') {
        value = value.slice(1, value.length - 1);
        quotedPairRE.test(value) && (value = value.replace(quotedPairRE, "$1"));
      }
      result.parameters[key] = value;
    }
    if (index !== header.length) {
      return defaultContentType;
    }
    return result;
  }
  module2.exports.default = { parse: parse2, safeParse };
  module2.exports.parse = parse2;
  module2.exports.safeParse = safeParse;
  module2.exports.defaultContentType = defaultContentType;
});

// src/main.ts
var exports_main = {};
__export(exports_main, {
  default: () => ObsidianPublisher
});
module.exports = __toCommonJS(exports_main);
var import_obsidian4 = require("obsidian");

// src/publisher.ts
var import_obsidian2 = require("obsidian");

// src/content-processor.ts
var import_obsidian = require("obsidian");

class ContentProcessor {
  settings;
  constructor(settings) {
    this.settings = settings;
  }
  process(content, originalFilename) {
    const { frontmatter, body } = this.extractFrontmatter(content);
    const processedFrontmatter = this.processFrontmatter(frontmatter);
    const images = this.extractImages(body);
    let processedBody = body;
    processedBody = this.convertWikilinks(processedBody);
    processedBody = this.convertImageReferences(processedBody);
    const processedContent = this.assembleFrontmatter(processedFrontmatter, processedBody);
    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
      frontmatter: processedFrontmatter
    };
  }
  extractFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (!match) {
      return { frontmatter: {}, body: content };
    }
    try {
      const frontmatter = import_obsidian.parseYaml(match[1]) || {};
      const body = match[2];
      return {
        frontmatter: typeof frontmatter === "object" ? frontmatter : {},
        body
      };
    } catch (error) {
      console.error("Failed to parse frontmatter:", error);
      return { frontmatter: {}, body: content };
    }
  }
  processFrontmatter(frontmatter) {
    const processed = { ...frontmatter };
    if (this.settings.removePublishFlag) {
      processed.publish = undefined;
    }
    for (const [key, value] of Object.entries(this.settings.frontmatterTemplate)) {
      if (!(key in processed)) {
        processed[key] = value;
      }
    }
    if (!processed.date) {
      processed.date = new Date().toISOString();
    }
    return processed;
  }
  assembleFrontmatter(frontmatter, body) {
    if (Object.keys(frontmatter).length === 0) {
      return body;
    }
    try {
      const yaml = import_obsidian.stringifyYaml(frontmatter);
      return `---
${yaml}---
${body}`;
    } catch (error) {
      console.error("Failed to stringify frontmatter:", error);
      return body;
    }
  }
  extractImages(content) {
    const imageRegex = /!\[\[([^\]]+)\]\]/g;
    const images = [];
    let match = imageRegex.exec(content);
    while (match !== null) {
      images.push(match[1]);
      match = imageRegex.exec(content);
    }
    return images;
  }
  convertWikilinks(content) {
    return content.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_match, page, _, displayText) => {
      const display = displayText || page;
      const slug = this.sanitizeFilename(page);
      return `[${display}](${slug})`;
    });
  }
  convertImageReferences(content) {
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, imageName) => {
      const sanitizedName = this.sanitizeFilename(imageName);
      return `![${imageName}](/images/${sanitizedName})`;
    });
  }
  sanitizeFilename(filename) {
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;
    let name = filename;
    let extension = "";
    if (hasExtension) {
      name = filename.slice(0, lastDotIndex);
      extension = filename.slice(lastDotIndex);
    }
    name = name.toLowerCase().replace(/\s+/g, "-");
    name = name.replace(/[^a-z0-9\-_]/g, "");
    name = name.replace(/-+/g, "-");
    name = name.replace(/^-+|-+$/g, "");
    if (!name) {
      name = "untitled";
    }
    return name + extension;
  }
  sanitizeImageName(imageName) {
    return this.sanitizeFilename(imageName);
  }
}

// node_modules/universal-user-agent/index.js
function getUserAgent() {
  if (typeof navigator === "object" && "userAgent" in navigator) {
    return navigator.userAgent;
  }
  if (typeof process === "object" && process.version !== undefined) {
    return `Node.js/${process.version.substr(1)} (${process.platform}; ${process.arch})`;
  }
  return "<environment undetectable>";
}

// node_modules/before-after-hook/lib/register.js
function register(state, name, method, options) {
  if (typeof method !== "function") {
    throw new Error("method for before hook must be a function");
  }
  if (!options) {
    options = {};
  }
  if (Array.isArray(name)) {
    return name.reverse().reduce((callback, name2) => {
      return register.bind(null, state, name2, callback, options);
    }, method)();
  }
  return Promise.resolve().then(() => {
    if (!state.registry[name]) {
      return method(options);
    }
    return state.registry[name].reduce((method2, registered) => {
      return registered.hook.bind(null, method2, options);
    }, method)();
  });
}

// node_modules/before-after-hook/lib/add.js
function addHook(state, kind, name, hook) {
  const orig = hook;
  if (!state.registry[name]) {
    state.registry[name] = [];
  }
  if (kind === "before") {
    hook = (method, options) => {
      return Promise.resolve().then(orig.bind(null, options)).then(method.bind(null, options));
    };
  }
  if (kind === "after") {
    hook = (method, options) => {
      let result;
      return Promise.resolve().then(method.bind(null, options)).then((result_) => {
        result = result_;
        return orig(result, options);
      }).then(() => {
        return result;
      });
    };
  }
  if (kind === "error") {
    hook = (method, options) => {
      return Promise.resolve().then(method.bind(null, options)).catch((error) => {
        return orig(error, options);
      });
    };
  }
  state.registry[name].push({
    hook,
    orig
  });
}

// node_modules/before-after-hook/lib/remove.js
function removeHook(state, name, method) {
  if (!state.registry[name]) {
    return;
  }
  const index = state.registry[name].map((registered) => {
    return registered.orig;
  }).indexOf(method);
  if (index === -1) {
    return;
  }
  state.registry[name].splice(index, 1);
}

// node_modules/before-after-hook/index.js
var bind = Function.bind;
var bindable = bind.bind(bind);
function bindApi(hook, state, name) {
  const removeHookRef = bindable(removeHook, null).apply(null, name ? [state, name] : [state]);
  hook.api = { remove: removeHookRef };
  hook.remove = removeHookRef;
  ["before", "error", "after", "wrap"].forEach((kind) => {
    const args = name ? [state, kind, name] : [state, kind];
    hook[kind] = hook.api[kind] = bindable(addHook, null).apply(null, args);
  });
}
function Singular() {
  const singularHookName = Symbol("Singular");
  const singularHookState = {
    registry: {}
  };
  const singularHook = register.bind(null, singularHookState, singularHookName);
  bindApi(singularHook, singularHookState, singularHookName);
  return singularHook;
}
function Collection() {
  const state = {
    registry: {}
  };
  const hook = register.bind(null, state);
  bindApi(hook, state);
  return hook;
}
var before_after_hook_default = { Singular, Collection };

// node_modules/@octokit/endpoint/dist-bundle/index.js
var VERSION = "0.0.0-development";
var userAgent = `octokit-endpoint.js/${VERSION} ${getUserAgent()}`;
var DEFAULTS = {
  method: "GET",
  baseUrl: "https://api.github.com",
  headers: {
    accept: "application/vnd.github.v3+json",
    "user-agent": userAgent
  },
  mediaType: {
    format: ""
  }
};
function lowercaseKeys(object) {
  if (!object) {
    return {};
  }
  return Object.keys(object).reduce((newObj, key) => {
    newObj[key.toLowerCase()] = object[key];
    return newObj;
  }, {});
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null)
    return false;
  if (Object.prototype.toString.call(value) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null)
    return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}
function mergeDeep(defaults, options) {
  const result = Object.assign({}, defaults);
  Object.keys(options).forEach((key) => {
    if (isPlainObject(options[key])) {
      if (!(key in defaults))
        Object.assign(result, { [key]: options[key] });
      else
        result[key] = mergeDeep(defaults[key], options[key]);
    } else {
      Object.assign(result, { [key]: options[key] });
    }
  });
  return result;
}
function removeUndefinedProperties(obj) {
  for (const key in obj) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
}
function merge(defaults, route, options) {
  if (typeof route === "string") {
    let [method, url] = route.split(" ");
    options = Object.assign(url ? { method, url } : { url: method }, options);
  } else {
    options = Object.assign({}, route);
  }
  options.headers = lowercaseKeys(options.headers);
  removeUndefinedProperties(options);
  removeUndefinedProperties(options.headers);
  const mergedOptions = mergeDeep(defaults || {}, options);
  if (options.url === "/graphql") {
    if (defaults && defaults.mediaType.previews?.length) {
      mergedOptions.mediaType.previews = defaults.mediaType.previews.filter((preview) => !mergedOptions.mediaType.previews.includes(preview)).concat(mergedOptions.mediaType.previews);
    }
    mergedOptions.mediaType.previews = (mergedOptions.mediaType.previews || []).map((preview) => preview.replace(/-preview/, ""));
  }
  return mergedOptions;
}
function addQueryParameters(url, parameters) {
  const separator = /\?/.test(url) ? "&" : "?";
  const names = Object.keys(parameters);
  if (names.length === 0) {
    return url;
  }
  return url + separator + names.map((name) => {
    if (name === "q") {
      return "q=" + parameters.q.split("+").map(encodeURIComponent).join("+");
    }
    return `${name}=${encodeURIComponent(parameters[name])}`;
  }).join("&");
}
var urlVariableRegex = /\{[^{}}]+\}/g;
function removeNonChars(variableName) {
  return variableName.replace(/(?:^\W+)|(?:(?<!\W)\W+$)/g, "").split(/,/);
}
function extractUrlVariableNames(url) {
  const matches = url.match(urlVariableRegex);
  if (!matches) {
    return [];
  }
  return matches.map(removeNonChars).reduce((a, b) => a.concat(b), []);
}
function omit(object, keysToOmit) {
  const result = { __proto__: null };
  for (const key of Object.keys(object)) {
    if (keysToOmit.indexOf(key) === -1) {
      result[key] = object[key];
    }
  }
  return result;
}
function encodeReserved(str) {
  return str.split(/(%[0-9A-Fa-f]{2})/g).map(function(part) {
    if (!/%[0-9A-Fa-f]/.test(part)) {
      part = encodeURI(part).replace(/%5B/g, "[").replace(/%5D/g, "]");
    }
    return part;
  }).join("");
}
function encodeUnreserved(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
function encodeValue(operator, value, key) {
  value = operator === "+" || operator === "#" ? encodeReserved(value) : encodeUnreserved(value);
  if (key) {
    return encodeUnreserved(key) + "=" + value;
  } else {
    return value;
  }
}
function isDefined(value) {
  return value !== undefined && value !== null;
}
function isKeyOperator(operator) {
  return operator === ";" || operator === "&" || operator === "?";
}
function getValues(context, operator, key, modifier) {
  var value = context[key], result = [];
  if (isDefined(value) && value !== "") {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      value = value.toString();
      if (modifier && modifier !== "*") {
        value = value.substring(0, parseInt(modifier, 10));
      }
      result.push(encodeValue(operator, value, isKeyOperator(operator) ? key : ""));
    } else {
      if (modifier === "*") {
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            result.push(encodeValue(operator, value2, isKeyOperator(operator) ? key : ""));
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              result.push(encodeValue(operator, value[k], k));
            }
          });
        }
      } else {
        const tmp = [];
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            tmp.push(encodeValue(operator, value2));
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              tmp.push(encodeUnreserved(k));
              tmp.push(encodeValue(operator, value[k].toString()));
            }
          });
        }
        if (isKeyOperator(operator)) {
          result.push(encodeUnreserved(key) + "=" + tmp.join(","));
        } else if (tmp.length !== 0) {
          result.push(tmp.join(","));
        }
      }
    }
  } else {
    if (operator === ";") {
      if (isDefined(value)) {
        result.push(encodeUnreserved(key));
      }
    } else if (value === "" && (operator === "&" || operator === "?")) {
      result.push(encodeUnreserved(key) + "=");
    } else if (value === "") {
      result.push("");
    }
  }
  return result;
}
function parseUrl(template) {
  return {
    expand: expand.bind(null, template)
  };
}
function expand(template, context) {
  var operators = ["+", "#", ".", "/", ";", "?", "&"];
  template = template.replace(/\{([^\{\}]+)\}|([^\{\}]+)/g, function(_, expression, literal) {
    if (expression) {
      let operator = "";
      const values = [];
      if (operators.indexOf(expression.charAt(0)) !== -1) {
        operator = expression.charAt(0);
        expression = expression.substr(1);
      }
      expression.split(/,/g).forEach(function(variable) {
        var tmp = /([^:\*]*)(?::(\d+)|(\*))?/.exec(variable);
        values.push(getValues(context, operator, tmp[1], tmp[2] || tmp[3]));
      });
      if (operator && operator !== "+") {
        var separator = ",";
        if (operator === "?") {
          separator = "&";
        } else if (operator !== "#") {
          separator = operator;
        }
        return (values.length !== 0 ? operator : "") + values.join(separator);
      } else {
        return values.join(",");
      }
    } else {
      return encodeReserved(literal);
    }
  });
  if (template === "/") {
    return template;
  } else {
    return template.replace(/\/$/, "");
  }
}
function parse(options) {
  let method = options.method.toUpperCase();
  let url = (options.url || "/").replace(/:([a-z]\w+)/g, "{$1}");
  let headers = Object.assign({}, options.headers);
  let body;
  let parameters = omit(options, [
    "method",
    "baseUrl",
    "url",
    "headers",
    "request",
    "mediaType"
  ]);
  const urlVariableNames = extractUrlVariableNames(url);
  url = parseUrl(url).expand(parameters);
  if (!/^http/.test(url)) {
    url = options.baseUrl + url;
  }
  const omittedParameters = Object.keys(options).filter((option) => urlVariableNames.includes(option)).concat("baseUrl");
  const remainingParameters = omit(parameters, omittedParameters);
  const isBinaryRequest = /application\/octet-stream/i.test(headers.accept);
  if (!isBinaryRequest) {
    if (options.mediaType.format) {
      headers.accept = headers.accept.split(/,/).map((format) => format.replace(/application\/vnd(\.\w+)(\.v3)?(\.\w+)?(\+json)?$/, `application/vnd$1$2.${options.mediaType.format}`)).join(",");
    }
    if (url.endsWith("/graphql")) {
      if (options.mediaType.previews?.length) {
        const previewsFromAcceptHeader = headers.accept.match(/(?<![\w-])[\w-]+(?=-preview)/g) || [];
        headers.accept = previewsFromAcceptHeader.concat(options.mediaType.previews).map((preview) => {
          const format = options.mediaType.format ? `.${options.mediaType.format}` : "+json";
          return `application/vnd.github.${preview}-preview${format}`;
        }).join(",");
      }
    }
  }
  if (["GET", "HEAD"].includes(method)) {
    url = addQueryParameters(url, remainingParameters);
  } else {
    if ("data" in remainingParameters) {
      body = remainingParameters.data;
    } else {
      if (Object.keys(remainingParameters).length) {
        body = remainingParameters;
      }
    }
  }
  if (!headers["content-type"] && typeof body !== "undefined") {
    headers["content-type"] = "application/json; charset=utf-8";
  }
  if (["PATCH", "PUT"].includes(method) && typeof body === "undefined") {
    body = "";
  }
  return Object.assign({ method, url, headers }, typeof body !== "undefined" ? { body } : null, options.request ? { request: options.request } : null);
}
function endpointWithDefaults(defaults, route, options) {
  return parse(merge(defaults, route, options));
}
function withDefaults(oldDefaults, newDefaults) {
  const DEFAULTS2 = merge(oldDefaults, newDefaults);
  const endpoint2 = endpointWithDefaults.bind(null, DEFAULTS2);
  return Object.assign(endpoint2, {
    DEFAULTS: DEFAULTS2,
    defaults: withDefaults.bind(null, DEFAULTS2),
    merge: merge.bind(null, DEFAULTS2),
    parse
  });
}
var endpoint = withDefaults(null, DEFAULTS);

// node_modules/@octokit/request/dist-bundle/index.js
var import_fast_content_type_parse = __toESM(require_fast_content_type_parse(), 1);

// node_modules/@octokit/request-error/dist-src/index.js
class RequestError extends Error {
  name;
  status;
  request;
  response;
  constructor(message, statusCode, options) {
    super(message);
    this.name = "HttpError";
    this.status = Number.parseInt(statusCode);
    if (Number.isNaN(this.status)) {
      this.status = 0;
    }
    if ("response" in options) {
      this.response = options.response;
    }
    const requestCopy = Object.assign({}, options.request);
    if (options.request.headers.authorization) {
      requestCopy.headers = Object.assign({}, options.request.headers, {
        authorization: options.request.headers.authorization.replace(/(?<! ) .*$/, " [REDACTED]")
      });
    }
    requestCopy.url = requestCopy.url.replace(/\bclient_secret=\w+/g, "client_secret=[REDACTED]").replace(/\baccess_token=\w+/g, "access_token=[REDACTED]");
    this.request = requestCopy;
  }
}

// node_modules/@octokit/request/dist-bundle/index.js
var VERSION2 = "9.2.4";
var defaults_default = {
  headers: {
    "user-agent": `octokit-request.js/${VERSION2} ${getUserAgent()}`
  }
};
function isPlainObject2(value) {
  if (typeof value !== "object" || value === null)
    return false;
  if (Object.prototype.toString.call(value) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null)
    return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}
async function fetchWrapper(requestOptions) {
  const fetch = requestOptions.request?.fetch || globalThis.fetch;
  if (!fetch) {
    throw new Error("fetch is not set. Please pass a fetch implementation as new Octokit({ request: { fetch }}). Learn more at https://github.com/octokit/octokit.js/#fetch-missing");
  }
  const log = requestOptions.request?.log || console;
  const parseSuccessResponseBody = requestOptions.request?.parseSuccessResponseBody !== false;
  const body = isPlainObject2(requestOptions.body) || Array.isArray(requestOptions.body) ? JSON.stringify(requestOptions.body) : requestOptions.body;
  const requestHeaders = Object.fromEntries(Object.entries(requestOptions.headers).map(([name, value]) => [
    name,
    String(value)
  ]));
  let fetchResponse;
  try {
    fetchResponse = await fetch(requestOptions.url, {
      method: requestOptions.method,
      body,
      redirect: requestOptions.request?.redirect,
      headers: requestHeaders,
      signal: requestOptions.request?.signal,
      ...requestOptions.body && { duplex: "half" }
    });
  } catch (error) {
    let message = "Unknown Error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        error.status = 500;
        throw error;
      }
      message = error.message;
      if (error.name === "TypeError" && "cause" in error) {
        if (error.cause instanceof Error) {
          message = error.cause.message;
        } else if (typeof error.cause === "string") {
          message = error.cause;
        }
      }
    }
    const requestError = new RequestError(message, 500, {
      request: requestOptions
    });
    requestError.cause = error;
    throw requestError;
  }
  const status = fetchResponse.status;
  const url = fetchResponse.url;
  const responseHeaders = {};
  for (const [key, value] of fetchResponse.headers) {
    responseHeaders[key] = value;
  }
  const octokitResponse = {
    url,
    status,
    headers: responseHeaders,
    data: ""
  };
  if ("deprecation" in responseHeaders) {
    const matches = responseHeaders.link && responseHeaders.link.match(/<([^<>]+)>; rel="deprecation"/);
    const deprecationLink = matches && matches.pop();
    log.warn(`[@octokit/request] "${requestOptions.method} ${requestOptions.url}" is deprecated. It is scheduled to be removed on ${responseHeaders.sunset}${deprecationLink ? `. See ${deprecationLink}` : ""}`);
  }
  if (status === 204 || status === 205) {
    return octokitResponse;
  }
  if (requestOptions.method === "HEAD") {
    if (status < 400) {
      return octokitResponse;
    }
    throw new RequestError(fetchResponse.statusText, status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  if (status === 304) {
    octokitResponse.data = await getResponseData(fetchResponse);
    throw new RequestError("Not modified", status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  if (status >= 400) {
    octokitResponse.data = await getResponseData(fetchResponse);
    throw new RequestError(toErrorMessage(octokitResponse.data), status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  octokitResponse.data = parseSuccessResponseBody ? await getResponseData(fetchResponse) : fetchResponse.body;
  return octokitResponse;
}
async function getResponseData(response) {
  const contentType = response.headers.get("content-type");
  if (!contentType) {
    return response.text().catch(() => "");
  }
  const mimetype = import_fast_content_type_parse.safeParse(contentType);
  if (isJSONResponse(mimetype)) {
    let text = "";
    try {
      text = await response.text();
      return JSON.parse(text);
    } catch (err) {
      return text;
    }
  } else if (mimetype.type.startsWith("text/") || mimetype.parameters.charset?.toLowerCase() === "utf-8") {
    return response.text().catch(() => "");
  } else {
    return response.arrayBuffer().catch(() => new ArrayBuffer(0));
  }
}
function isJSONResponse(mimetype) {
  return mimetype.type === "application/json" || mimetype.type === "application/scim+json";
}
function toErrorMessage(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return "Unknown error";
  }
  if ("message" in data) {
    const suffix = "documentation_url" in data ? ` - ${data.documentation_url}` : "";
    return Array.isArray(data.errors) ? `${data.message}: ${data.errors.map((v) => JSON.stringify(v)).join(", ")}${suffix}` : `${data.message}${suffix}`;
  }
  return `Unknown error: ${JSON.stringify(data)}`;
}
function withDefaults2(oldEndpoint, newDefaults) {
  const endpoint2 = oldEndpoint.defaults(newDefaults);
  const newApi = function(route, parameters) {
    const endpointOptions = endpoint2.merge(route, parameters);
    if (!endpointOptions.request || !endpointOptions.request.hook) {
      return fetchWrapper(endpoint2.parse(endpointOptions));
    }
    const request2 = (route2, parameters2) => {
      return fetchWrapper(endpoint2.parse(endpoint2.merge(route2, parameters2)));
    };
    Object.assign(request2, {
      endpoint: endpoint2,
      defaults: withDefaults2.bind(null, endpoint2)
    });
    return endpointOptions.request.hook(request2, endpointOptions);
  };
  return Object.assign(newApi, {
    endpoint: endpoint2,
    defaults: withDefaults2.bind(null, endpoint2)
  });
}
var request = withDefaults2(endpoint, defaults_default);

// node_modules/@octokit/graphql/dist-bundle/index.js
var VERSION3 = "0.0.0-development";
function _buildMessageForResponseErrors(data) {
  return `Request failed due to following response errors:
` + data.errors.map((e) => ` - ${e.message}`).join(`
`);
}
var GraphqlResponseError = class extends Error {
  constructor(request2, headers, response) {
    super(_buildMessageForResponseErrors(response));
    this.request = request2;
    this.headers = headers;
    this.response = response;
    this.errors = response.errors;
    this.data = response.data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  name = "GraphqlResponseError";
  errors;
  data;
};
var NON_VARIABLE_OPTIONS = [
  "method",
  "baseUrl",
  "url",
  "headers",
  "request",
  "query",
  "mediaType",
  "operationName"
];
var FORBIDDEN_VARIABLE_OPTIONS = ["query", "method", "url"];
var GHES_V3_SUFFIX_REGEX = /\/api\/v3\/?$/;
function graphql(request2, query, options) {
  if (options) {
    if (typeof query === "string" && "query" in options) {
      return Promise.reject(new Error(`[@octokit/graphql] "query" cannot be used as variable name`));
    }
    for (const key in options) {
      if (!FORBIDDEN_VARIABLE_OPTIONS.includes(key))
        continue;
      return Promise.reject(new Error(`[@octokit/graphql] "${key}" cannot be used as variable name`));
    }
  }
  const parsedOptions = typeof query === "string" ? Object.assign({ query }, options) : query;
  const requestOptions = Object.keys(parsedOptions).reduce((result, key) => {
    if (NON_VARIABLE_OPTIONS.includes(key)) {
      result[key] = parsedOptions[key];
      return result;
    }
    if (!result.variables) {
      result.variables = {};
    }
    result.variables[key] = parsedOptions[key];
    return result;
  }, {});
  const baseUrl = parsedOptions.baseUrl || request2.endpoint.DEFAULTS.baseUrl;
  if (GHES_V3_SUFFIX_REGEX.test(baseUrl)) {
    requestOptions.url = baseUrl.replace(GHES_V3_SUFFIX_REGEX, "/api/graphql");
  }
  return request2(requestOptions).then((response) => {
    if (response.data.errors) {
      const headers = {};
      for (const key of Object.keys(response.headers)) {
        headers[key] = response.headers[key];
      }
      throw new GraphqlResponseError(requestOptions, headers, response.data);
    }
    return response.data.data;
  });
}
function withDefaults3(request2, newDefaults) {
  const newRequest = request2.defaults(newDefaults);
  const newApi = (query, options) => {
    return graphql(newRequest, query, options);
  };
  return Object.assign(newApi, {
    defaults: withDefaults3.bind(null, newRequest),
    endpoint: newRequest.endpoint
  });
}
var graphql2 = withDefaults3(request, {
  headers: {
    "user-agent": `octokit-graphql.js/${VERSION3} ${getUserAgent()}`
  },
  method: "POST",
  url: "/graphql"
});
function withCustomRequest(customRequest) {
  return withDefaults3(customRequest, {
    method: "POST",
    url: "/graphql"
  });
}

// node_modules/@octokit/auth-token/dist-bundle/index.js
var b64url = "(?:[a-zA-Z0-9_-]+)";
var sep = "\\.";
var jwtRE = new RegExp(`^${b64url}${sep}${b64url}${sep}${b64url}$`);
var isJWT = jwtRE.test.bind(jwtRE);
async function auth(token) {
  const isApp = isJWT(token);
  const isInstallation = token.startsWith("v1.") || token.startsWith("ghs_");
  const isUserToServer = token.startsWith("ghu_");
  const tokenType = isApp ? "app" : isInstallation ? "installation" : isUserToServer ? "user-to-server" : "oauth";
  return {
    type: "token",
    token,
    tokenType
  };
}
function withAuthorizationPrefix(token) {
  if (token.split(/\./).length === 3) {
    return `bearer ${token}`;
  }
  return `token ${token}`;
}
async function hook(token, request2, route, parameters) {
  const endpoint2 = request2.endpoint.merge(route, parameters);
  endpoint2.headers.authorization = withAuthorizationPrefix(token);
  return request2(endpoint2);
}
var createTokenAuth = function createTokenAuth2(token) {
  if (!token) {
    throw new Error("[@octokit/auth-token] No token passed to createTokenAuth");
  }
  if (typeof token !== "string") {
    throw new Error("[@octokit/auth-token] Token passed to createTokenAuth is not a string");
  }
  token = token.replace(/^(token|bearer) +/i, "");
  return Object.assign(auth.bind(null, token), {
    hook: hook.bind(null, token)
  });
};

// node_modules/@octokit/core/dist-src/version.js
var VERSION4 = "6.1.6";

// node_modules/@octokit/core/dist-src/index.js
var noop = () => {};
var consoleWarn = console.warn.bind(console);
var consoleError = console.error.bind(console);
function createLogger(logger = {}) {
  if (typeof logger.debug !== "function") {
    logger.debug = noop;
  }
  if (typeof logger.info !== "function") {
    logger.info = noop;
  }
  if (typeof logger.warn !== "function") {
    logger.warn = consoleWarn;
  }
  if (typeof logger.error !== "function") {
    logger.error = consoleError;
  }
  return logger;
}
var userAgentTrail = `octokit-core.js/${VERSION4} ${getUserAgent()}`;

class Octokit {
  static VERSION = VERSION4;
  static defaults(defaults) {
    const OctokitWithDefaults = class extends this {
      constructor(...args) {
        const options = args[0] || {};
        if (typeof defaults === "function") {
          super(defaults(options));
          return;
        }
        super(Object.assign({}, defaults, options, options.userAgent && defaults.userAgent ? {
          userAgent: `${options.userAgent} ${defaults.userAgent}`
        } : null));
      }
    };
    return OctokitWithDefaults;
  }
  static plugins = [];
  static plugin(...newPlugins) {
    const currentPlugins = this.plugins;
    const NewOctokit = class extends this {
      static plugins = currentPlugins.concat(newPlugins.filter((plugin) => !currentPlugins.includes(plugin)));
    };
    return NewOctokit;
  }
  constructor(options = {}) {
    const hook2 = new before_after_hook_default.Collection;
    const requestDefaults = {
      baseUrl: request.endpoint.DEFAULTS.baseUrl,
      headers: {},
      request: Object.assign({}, options.request, {
        hook: hook2.bind(null, "request")
      }),
      mediaType: {
        previews: [],
        format: ""
      }
    };
    requestDefaults.headers["user-agent"] = options.userAgent ? `${options.userAgent} ${userAgentTrail}` : userAgentTrail;
    if (options.baseUrl) {
      requestDefaults.baseUrl = options.baseUrl;
    }
    if (options.previews) {
      requestDefaults.mediaType.previews = options.previews;
    }
    if (options.timeZone) {
      requestDefaults.headers["time-zone"] = options.timeZone;
    }
    this.request = request.defaults(requestDefaults);
    this.graphql = withCustomRequest(this.request).defaults(requestDefaults);
    this.log = createLogger(options.log);
    this.hook = hook2;
    if (!options.authStrategy) {
      if (!options.auth) {
        this.auth = async () => ({
          type: "unauthenticated"
        });
      } else {
        const auth2 = createTokenAuth(options.auth);
        hook2.wrap("request", auth2.hook);
        this.auth = auth2;
      }
    } else {
      const { authStrategy, ...otherOptions } = options;
      const auth2 = authStrategy(Object.assign({
        request: this.request,
        log: this.log,
        octokit: this,
        octokitOptions: otherOptions
      }, options.auth));
      hook2.wrap("request", auth2.hook);
      this.auth = auth2;
    }
    const classConstructor = this.constructor;
    for (let i = 0;i < classConstructor.plugins.length; ++i) {
      Object.assign(this, classConstructor.plugins[i](this, options));
    }
  }
  request;
  graphql;
  log;
  hook;
  auth;
}

// node_modules/@octokit/plugin-request-log/dist-src/version.js
var VERSION5 = "5.3.1";

// node_modules/@octokit/plugin-request-log/dist-src/index.js
function requestLog(octokit) {
  octokit.hook.wrap("request", (request2, options) => {
    octokit.log.debug("request", options);
    const start = Date.now();
    const requestOptions = octokit.request.endpoint.parse(options);
    const path = requestOptions.url.replace(options.baseUrl, "");
    return request2(options).then((response) => {
      const requestId = response.headers["x-github-request-id"];
      octokit.log.info(`${requestOptions.method} ${path} - ${response.status} with id ${requestId} in ${Date.now() - start}ms`);
      return response;
    }).catch((error) => {
      const requestId = error.response?.headers["x-github-request-id"] || "UNKNOWN";
      octokit.log.error(`${requestOptions.method} ${path} - ${error.status} with id ${requestId} in ${Date.now() - start}ms`);
      throw error;
    });
  });
}
requestLog.VERSION = VERSION5;

// node_modules/@octokit/plugin-paginate-rest/dist-bundle/index.js
var VERSION6 = "0.0.0-development";
function normalizePaginatedListResponse(response) {
  if (!response.data) {
    return {
      ...response,
      data: []
    };
  }
  const responseNeedsNormalization = "total_count" in response.data && !("url" in response.data);
  if (!responseNeedsNormalization)
    return response;
  const incompleteResults = response.data.incomplete_results;
  const repositorySelection = response.data.repository_selection;
  const totalCount = response.data.total_count;
  delete response.data.incomplete_results;
  delete response.data.repository_selection;
  delete response.data.total_count;
  const namespaceKey = Object.keys(response.data)[0];
  const data = response.data[namespaceKey];
  response.data = data;
  if (typeof incompleteResults !== "undefined") {
    response.data.incomplete_results = incompleteResults;
  }
  if (typeof repositorySelection !== "undefined") {
    response.data.repository_selection = repositorySelection;
  }
  response.data.total_count = totalCount;
  return response;
}
function iterator(octokit, route, parameters) {
  const options = typeof route === "function" ? route.endpoint(parameters) : octokit.request.endpoint(route, parameters);
  const requestMethod = typeof route === "function" ? route : octokit.request;
  const method = options.method;
  const headers = options.headers;
  let url = options.url;
  return {
    [Symbol.asyncIterator]: () => ({
      async next() {
        if (!url)
          return { done: true };
        try {
          const response = await requestMethod({ method, url, headers });
          const normalizedResponse = normalizePaginatedListResponse(response);
          url = ((normalizedResponse.headers.link || "").match(/<([^<>]+)>;\s*rel="next"/) || [])[1];
          return { value: normalizedResponse };
        } catch (error) {
          if (error.status !== 409)
            throw error;
          url = "";
          return {
            value: {
              status: 200,
              headers: {},
              data: []
            }
          };
        }
      }
    })
  };
}
function paginate(octokit, route, parameters, mapFn) {
  if (typeof parameters === "function") {
    mapFn = parameters;
    parameters = undefined;
  }
  return gather(octokit, [], iterator(octokit, route, parameters)[Symbol.asyncIterator](), mapFn);
}
function gather(octokit, results, iterator2, mapFn) {
  return iterator2.next().then((result) => {
    if (result.done) {
      return results;
    }
    let earlyExit = false;
    function done() {
      earlyExit = true;
    }
    results = results.concat(mapFn ? mapFn(result.value, done) : result.value.data);
    if (earlyExit) {
      return results;
    }
    return gather(octokit, results, iterator2, mapFn);
  });
}
var composePaginateRest = Object.assign(paginate, {
  iterator
});
function paginateRest(octokit) {
  return {
    paginate: Object.assign(paginate.bind(null, octokit), {
      iterator: iterator.bind(null, octokit)
    })
  };
}
paginateRest.VERSION = VERSION6;

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/version.js
var VERSION7 = "13.5.0";

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/generated/endpoints.js
var Endpoints = {
  actions: {
    addCustomLabelsToSelfHostedRunnerForOrg: [
      "POST /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    addCustomLabelsToSelfHostedRunnerForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    addRepoAccessToSelfHostedRunnerGroupInOrg: [
      "PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    approveWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve"
    ],
    cancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel"
    ],
    createEnvironmentVariable: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/variables"
    ],
    createHostedRunnerForOrg: ["POST /orgs/{org}/actions/hosted-runners"],
    createOrUpdateEnvironmentSecret: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    createOrUpdateOrgSecret: ["PUT /orgs/{org}/actions/secrets/{secret_name}"],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    createOrgVariable: ["POST /orgs/{org}/actions/variables"],
    createRegistrationTokenForOrg: [
      "POST /orgs/{org}/actions/runners/registration-token"
    ],
    createRegistrationTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/registration-token"
    ],
    createRemoveTokenForOrg: ["POST /orgs/{org}/actions/runners/remove-token"],
    createRemoveTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/remove-token"
    ],
    createRepoVariable: ["POST /repos/{owner}/{repo}/actions/variables"],
    createWorkflowDispatch: [
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
    ],
    deleteActionsCacheById: [
      "DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}"
    ],
    deleteActionsCacheByKey: [
      "DELETE /repos/{owner}/{repo}/actions/caches{?key,ref}"
    ],
    deleteArtifact: [
      "DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"
    ],
    deleteEnvironmentSecret: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    deleteEnvironmentVariable: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    deleteHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/actions/secrets/{secret_name}"],
    deleteOrgVariable: ["DELETE /orgs/{org}/actions/variables/{name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    deleteRepoVariable: [
      "DELETE /repos/{owner}/{repo}/actions/variables/{name}"
    ],
    deleteSelfHostedRunnerFromOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}"
    ],
    deleteSelfHostedRunnerFromRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    deleteWorkflowRun: ["DELETE /repos/{owner}/{repo}/actions/runs/{run_id}"],
    deleteWorkflowRunLogs: [
      "DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    disableSelectedRepositoryGithubActionsOrganization: [
      "DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    disableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable"
    ],
    downloadArtifact: [
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}"
    ],
    downloadJobLogsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs"
    ],
    downloadWorkflowRunAttemptLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs"
    ],
    downloadWorkflowRunLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    enableSelectedRepositoryGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    enableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable"
    ],
    forceCancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel"
    ],
    generateRunnerJitconfigForOrg: [
      "POST /orgs/{org}/actions/runners/generate-jitconfig"
    ],
    generateRunnerJitconfigForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig"
    ],
    getActionsCacheList: ["GET /repos/{owner}/{repo}/actions/caches"],
    getActionsCacheUsage: ["GET /repos/{owner}/{repo}/actions/cache/usage"],
    getActionsCacheUsageByRepoForOrg: [
      "GET /orgs/{org}/actions/cache/usage-by-repository"
    ],
    getActionsCacheUsageForOrg: ["GET /orgs/{org}/actions/cache/usage"],
    getAllowedActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/selected-actions"
    ],
    getAllowedActionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    getArtifact: ["GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"],
    getCustomOidcSubClaimForRepo: [
      "GET /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    getEnvironmentPublicKey: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key"
    ],
    getEnvironmentSecret: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    getEnvironmentVariable: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    getGithubActionsDefaultWorkflowPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions/workflow"
    ],
    getGithubActionsDefaultWorkflowPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    getGithubActionsPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions"
    ],
    getGithubActionsPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions"
    ],
    getHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    getHostedRunnersGithubOwnedImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/github-owned"
    ],
    getHostedRunnersLimitsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/limits"
    ],
    getHostedRunnersMachineSpecsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/machine-sizes"
    ],
    getHostedRunnersPartnerImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/partner"
    ],
    getHostedRunnersPlatformsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/platforms"
    ],
    getJobForWorkflowRun: ["GET /repos/{owner}/{repo}/actions/jobs/{job_id}"],
    getOrgPublicKey: ["GET /orgs/{org}/actions/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/actions/secrets/{secret_name}"],
    getOrgVariable: ["GET /orgs/{org}/actions/variables/{name}"],
    getPendingDeploymentsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    getRepoPermissions: [
      "GET /repos/{owner}/{repo}/actions/permissions",
      {},
      { renamed: ["actions", "getGithubActionsPermissionsRepository"] }
    ],
    getRepoPublicKey: ["GET /repos/{owner}/{repo}/actions/secrets/public-key"],
    getRepoSecret: ["GET /repos/{owner}/{repo}/actions/secrets/{secret_name}"],
    getRepoVariable: ["GET /repos/{owner}/{repo}/actions/variables/{name}"],
    getReviewsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals"
    ],
    getSelfHostedRunnerForOrg: ["GET /orgs/{org}/actions/runners/{runner_id}"],
    getSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    getWorkflow: ["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}"],
    getWorkflowAccessToRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/access"
    ],
    getWorkflowRun: ["GET /repos/{owner}/{repo}/actions/runs/{run_id}"],
    getWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}"
    ],
    getWorkflowRunUsage: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing"
    ],
    getWorkflowUsage: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing"
    ],
    listArtifactsForRepo: ["GET /repos/{owner}/{repo}/actions/artifacts"],
    listEnvironmentSecrets: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets"
    ],
    listEnvironmentVariables: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables"
    ],
    listGithubHostedRunnersInGroupForOrg: [
      "GET /orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners"
    ],
    listHostedRunnersForOrg: ["GET /orgs/{org}/actions/hosted-runners"],
    listJobsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
    ],
    listJobsForWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs"
    ],
    listLabelsForSelfHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    listLabelsForSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    listOrgSecrets: ["GET /orgs/{org}/actions/secrets"],
    listOrgVariables: ["GET /orgs/{org}/actions/variables"],
    listRepoOrganizationSecrets: [
      "GET /repos/{owner}/{repo}/actions/organization-secrets"
    ],
    listRepoOrganizationVariables: [
      "GET /repos/{owner}/{repo}/actions/organization-variables"
    ],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/actions/secrets"],
    listRepoVariables: ["GET /repos/{owner}/{repo}/actions/variables"],
    listRepoWorkflows: ["GET /repos/{owner}/{repo}/actions/workflows"],
    listRunnerApplicationsForOrg: ["GET /orgs/{org}/actions/runners/downloads"],
    listRunnerApplicationsForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/downloads"
    ],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    listSelectedReposForOrgVariable: [
      "GET /orgs/{org}/actions/variables/{name}/repositories"
    ],
    listSelectedRepositoriesEnabledGithubActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/repositories"
    ],
    listSelfHostedRunnersForOrg: ["GET /orgs/{org}/actions/runners"],
    listSelfHostedRunnersForRepo: ["GET /repos/{owner}/{repo}/actions/runners"],
    listWorkflowRunArtifacts: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"
    ],
    listWorkflowRuns: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"
    ],
    listWorkflowRunsForRepo: ["GET /repos/{owner}/{repo}/actions/runs"],
    reRunJobForWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun"
    ],
    reRunWorkflow: ["POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun"],
    reRunWorkflowFailedJobs: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    removeCustomLabelFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeCustomLabelFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgVariable: [
      "DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    reviewCustomGatesForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule"
    ],
    reviewPendingDeploymentsForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    setAllowedActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/selected-actions"
    ],
    setAllowedActionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    setCustomLabelsForSelfHostedRunnerForOrg: [
      "PUT /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    setCustomLabelsForSelfHostedRunnerForRepo: [
      "PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    setCustomOidcSubClaimForRepo: [
      "PUT /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    setGithubActionsDefaultWorkflowPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/workflow"
    ],
    setGithubActionsDefaultWorkflowPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    setGithubActionsPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions"
    ],
    setGithubActionsPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories"
    ],
    setSelectedRepositoriesEnabledGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories"
    ],
    setWorkflowAccessToRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/access"
    ],
    updateEnvironmentVariable: [
      "PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    updateHostedRunnerForOrg: [
      "PATCH /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    updateOrgVariable: ["PATCH /orgs/{org}/actions/variables/{name}"],
    updateRepoVariable: [
      "PATCH /repos/{owner}/{repo}/actions/variables/{name}"
    ]
  },
  activity: {
    checkRepoIsStarredByAuthenticatedUser: ["GET /user/starred/{owner}/{repo}"],
    deleteRepoSubscription: ["DELETE /repos/{owner}/{repo}/subscription"],
    deleteThreadSubscription: [
      "DELETE /notifications/threads/{thread_id}/subscription"
    ],
    getFeeds: ["GET /feeds"],
    getRepoSubscription: ["GET /repos/{owner}/{repo}/subscription"],
    getThread: ["GET /notifications/threads/{thread_id}"],
    getThreadSubscriptionForAuthenticatedUser: [
      "GET /notifications/threads/{thread_id}/subscription"
    ],
    listEventsForAuthenticatedUser: ["GET /users/{username}/events"],
    listNotificationsForAuthenticatedUser: ["GET /notifications"],
    listOrgEventsForAuthenticatedUser: [
      "GET /users/{username}/events/orgs/{org}"
    ],
    listPublicEvents: ["GET /events"],
    listPublicEventsForRepoNetwork: ["GET /networks/{owner}/{repo}/events"],
    listPublicEventsForUser: ["GET /users/{username}/events/public"],
    listPublicOrgEvents: ["GET /orgs/{org}/events"],
    listReceivedEventsForUser: ["GET /users/{username}/received_events"],
    listReceivedPublicEventsForUser: [
      "GET /users/{username}/received_events/public"
    ],
    listRepoEvents: ["GET /repos/{owner}/{repo}/events"],
    listRepoNotificationsForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/notifications"
    ],
    listReposStarredByAuthenticatedUser: ["GET /user/starred"],
    listReposStarredByUser: ["GET /users/{username}/starred"],
    listReposWatchedByUser: ["GET /users/{username}/subscriptions"],
    listStargazersForRepo: ["GET /repos/{owner}/{repo}/stargazers"],
    listWatchedReposForAuthenticatedUser: ["GET /user/subscriptions"],
    listWatchersForRepo: ["GET /repos/{owner}/{repo}/subscribers"],
    markNotificationsAsRead: ["PUT /notifications"],
    markRepoNotificationsAsRead: ["PUT /repos/{owner}/{repo}/notifications"],
    markThreadAsDone: ["DELETE /notifications/threads/{thread_id}"],
    markThreadAsRead: ["PATCH /notifications/threads/{thread_id}"],
    setRepoSubscription: ["PUT /repos/{owner}/{repo}/subscription"],
    setThreadSubscription: [
      "PUT /notifications/threads/{thread_id}/subscription"
    ],
    starRepoForAuthenticatedUser: ["PUT /user/starred/{owner}/{repo}"],
    unstarRepoForAuthenticatedUser: ["DELETE /user/starred/{owner}/{repo}"]
  },
  apps: {
    addRepoToInstallation: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "addRepoToInstallationForAuthenticatedUser"] }
    ],
    addRepoToInstallationForAuthenticatedUser: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    checkToken: ["POST /applications/{client_id}/token"],
    createFromManifest: ["POST /app-manifests/{code}/conversions"],
    createInstallationAccessToken: [
      "POST /app/installations/{installation_id}/access_tokens"
    ],
    deleteAuthorization: ["DELETE /applications/{client_id}/grant"],
    deleteInstallation: ["DELETE /app/installations/{installation_id}"],
    deleteToken: ["DELETE /applications/{client_id}/token"],
    getAuthenticated: ["GET /app"],
    getBySlug: ["GET /apps/{app_slug}"],
    getInstallation: ["GET /app/installations/{installation_id}"],
    getOrgInstallation: ["GET /orgs/{org}/installation"],
    getRepoInstallation: ["GET /repos/{owner}/{repo}/installation"],
    getSubscriptionPlanForAccount: [
      "GET /marketplace_listing/accounts/{account_id}"
    ],
    getSubscriptionPlanForAccountStubbed: [
      "GET /marketplace_listing/stubbed/accounts/{account_id}"
    ],
    getUserInstallation: ["GET /users/{username}/installation"],
    getWebhookConfigForApp: ["GET /app/hook/config"],
    getWebhookDelivery: ["GET /app/hook/deliveries/{delivery_id}"],
    listAccountsForPlan: ["GET /marketplace_listing/plans/{plan_id}/accounts"],
    listAccountsForPlanStubbed: [
      "GET /marketplace_listing/stubbed/plans/{plan_id}/accounts"
    ],
    listInstallationReposForAuthenticatedUser: [
      "GET /user/installations/{installation_id}/repositories"
    ],
    listInstallationRequestsForAuthenticatedApp: [
      "GET /app/installation-requests"
    ],
    listInstallations: ["GET /app/installations"],
    listInstallationsForAuthenticatedUser: ["GET /user/installations"],
    listPlans: ["GET /marketplace_listing/plans"],
    listPlansStubbed: ["GET /marketplace_listing/stubbed/plans"],
    listReposAccessibleToInstallation: ["GET /installation/repositories"],
    listSubscriptionsForAuthenticatedUser: ["GET /user/marketplace_purchases"],
    listSubscriptionsForAuthenticatedUserStubbed: [
      "GET /user/marketplace_purchases/stubbed"
    ],
    listWebhookDeliveries: ["GET /app/hook/deliveries"],
    redeliverWebhookDelivery: [
      "POST /app/hook/deliveries/{delivery_id}/attempts"
    ],
    removeRepoFromInstallation: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "removeRepoFromInstallationForAuthenticatedUser"] }
    ],
    removeRepoFromInstallationForAuthenticatedUser: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    resetToken: ["PATCH /applications/{client_id}/token"],
    revokeInstallationAccessToken: ["DELETE /installation/token"],
    scopeToken: ["POST /applications/{client_id}/token/scoped"],
    suspendInstallation: ["PUT /app/installations/{installation_id}/suspended"],
    unsuspendInstallation: [
      "DELETE /app/installations/{installation_id}/suspended"
    ],
    updateWebhookConfigForApp: ["PATCH /app/hook/config"]
  },
  billing: {
    getGithubActionsBillingOrg: ["GET /orgs/{org}/settings/billing/actions"],
    getGithubActionsBillingUser: [
      "GET /users/{username}/settings/billing/actions"
    ],
    getGithubBillingUsageReportOrg: [
      "GET /organizations/{org}/settings/billing/usage"
    ],
    getGithubPackagesBillingOrg: ["GET /orgs/{org}/settings/billing/packages"],
    getGithubPackagesBillingUser: [
      "GET /users/{username}/settings/billing/packages"
    ],
    getSharedStorageBillingOrg: [
      "GET /orgs/{org}/settings/billing/shared-storage"
    ],
    getSharedStorageBillingUser: [
      "GET /users/{username}/settings/billing/shared-storage"
    ]
  },
  checks: {
    create: ["POST /repos/{owner}/{repo}/check-runs"],
    createSuite: ["POST /repos/{owner}/{repo}/check-suites"],
    get: ["GET /repos/{owner}/{repo}/check-runs/{check_run_id}"],
    getSuite: ["GET /repos/{owner}/{repo}/check-suites/{check_suite_id}"],
    listAnnotations: [
      "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations"
    ],
    listForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-runs"],
    listForSuite: [
      "GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs"
    ],
    listSuitesForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-suites"],
    rerequestRun: [
      "POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest"
    ],
    rerequestSuite: [
      "POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest"
    ],
    setSuitesPreferences: [
      "PATCH /repos/{owner}/{repo}/check-suites/preferences"
    ],
    update: ["PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}"]
  },
  codeScanning: {
    commitAutofix: [
      "POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits"
    ],
    createAutofix: [
      "POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix"
    ],
    createVariantAnalysis: [
      "POST /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses"
    ],
    deleteAnalysis: [
      "DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}{?confirm_delete}"
    ],
    deleteCodeqlDatabase: [
      "DELETE /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}",
      {},
      { renamedParameters: { alert_id: "alert_number" } }
    ],
    getAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}"
    ],
    getAutofix: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix"
    ],
    getCodeqlDatabase: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getDefaultSetup: ["GET /repos/{owner}/{repo}/code-scanning/default-setup"],
    getSarif: ["GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}"],
    getVariantAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}"
    ],
    getVariantAnalysisRepoTask: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}"
    ],
    listAlertInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/code-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/code-scanning/alerts"],
    listAlertsInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances",
      {},
      { renamed: ["codeScanning", "listAlertInstances"] }
    ],
    listCodeqlDatabases: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases"
    ],
    listRecentAnalyses: ["GET /repos/{owner}/{repo}/code-scanning/analyses"],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}"
    ],
    updateDefaultSetup: [
      "PATCH /repos/{owner}/{repo}/code-scanning/default-setup"
    ],
    uploadSarif: ["POST /repos/{owner}/{repo}/code-scanning/sarifs"]
  },
  codeSecurity: {
    attachConfiguration: [
      "POST /orgs/{org}/code-security/configurations/{configuration_id}/attach"
    ],
    attachEnterpriseConfiguration: [
      "POST /enterprises/{enterprise}/code-security/configurations/{configuration_id}/attach"
    ],
    createConfiguration: ["POST /orgs/{org}/code-security/configurations"],
    createConfigurationForEnterprise: [
      "POST /enterprises/{enterprise}/code-security/configurations"
    ],
    deleteConfiguration: [
      "DELETE /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    deleteConfigurationForEnterprise: [
      "DELETE /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ],
    detachConfiguration: [
      "DELETE /orgs/{org}/code-security/configurations/detach"
    ],
    getConfiguration: [
      "GET /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    getConfigurationForRepository: [
      "GET /repos/{owner}/{repo}/code-security-configuration"
    ],
    getConfigurationsForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations"
    ],
    getConfigurationsForOrg: ["GET /orgs/{org}/code-security/configurations"],
    getDefaultConfigurations: [
      "GET /orgs/{org}/code-security/configurations/defaults"
    ],
    getDefaultConfigurationsForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations/defaults"
    ],
    getRepositoriesForConfiguration: [
      "GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories"
    ],
    getRepositoriesForEnterpriseConfiguration: [
      "GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}/repositories"
    ],
    getSingleConfigurationForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ],
    setConfigurationAsDefault: [
      "PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults"
    ],
    setConfigurationAsDefaultForEnterprise: [
      "PUT /enterprises/{enterprise}/code-security/configurations/{configuration_id}/defaults"
    ],
    updateConfiguration: [
      "PATCH /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    updateEnterpriseConfiguration: [
      "PATCH /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ]
  },
  codesOfConduct: {
    getAllCodesOfConduct: ["GET /codes_of_conduct"],
    getConductCode: ["GET /codes_of_conduct/{key}"]
  },
  codespaces: {
    addRepositoryForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    checkPermissionsForDevcontainer: [
      "GET /repos/{owner}/{repo}/codespaces/permissions_check"
    ],
    codespaceMachinesForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/machines"
    ],
    createForAuthenticatedUser: ["POST /user/codespaces"],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}"
    ],
    createWithPrForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces"
    ],
    createWithRepoForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/codespaces"
    ],
    deleteForAuthenticatedUser: ["DELETE /user/codespaces/{codespace_name}"],
    deleteFromOrganization: [
      "DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/codespaces/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    deleteSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}"
    ],
    exportForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/exports"
    ],
    getCodespacesForUserInOrg: [
      "GET /orgs/{org}/members/{username}/codespaces"
    ],
    getExportDetailsForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/exports/{export_id}"
    ],
    getForAuthenticatedUser: ["GET /user/codespaces/{codespace_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/codespaces/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/codespaces/secrets/{secret_name}"],
    getPublicKeyForAuthenticatedUser: [
      "GET /user/codespaces/secrets/public-key"
    ],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    getSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}"
    ],
    listDevcontainersInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/devcontainers"
    ],
    listForAuthenticatedUser: ["GET /user/codespaces"],
    listInOrganization: [
      "GET /orgs/{org}/codespaces",
      {},
      { renamedParameters: { org_id: "org" } }
    ],
    listInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces"
    ],
    listOrgSecrets: ["GET /orgs/{org}/codespaces/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/codespaces/secrets"],
    listRepositoriesForSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}/repositories"
    ],
    listSecretsForAuthenticatedUser: ["GET /user/codespaces/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    preFlightWithRepoForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/new"
    ],
    publishForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/publish"
    ],
    removeRepositoryForSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    repoMachinesForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/machines"
    ],
    setRepositoriesForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    startForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/start"],
    stopForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/stop"],
    stopInOrganization: [
      "POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop"
    ],
    updateForAuthenticatedUser: ["PATCH /user/codespaces/{codespace_name}"]
  },
  copilot: {
    addCopilotSeatsForTeams: [
      "POST /orgs/{org}/copilot/billing/selected_teams"
    ],
    addCopilotSeatsForUsers: [
      "POST /orgs/{org}/copilot/billing/selected_users"
    ],
    cancelCopilotSeatAssignmentForTeams: [
      "DELETE /orgs/{org}/copilot/billing/selected_teams"
    ],
    cancelCopilotSeatAssignmentForUsers: [
      "DELETE /orgs/{org}/copilot/billing/selected_users"
    ],
    copilotMetricsForOrganization: ["GET /orgs/{org}/copilot/metrics"],
    copilotMetricsForTeam: ["GET /orgs/{org}/team/{team_slug}/copilot/metrics"],
    getCopilotOrganizationDetails: ["GET /orgs/{org}/copilot/billing"],
    getCopilotSeatDetailsForUser: [
      "GET /orgs/{org}/members/{username}/copilot"
    ],
    listCopilotSeats: ["GET /orgs/{org}/copilot/billing/seats"],
    usageMetricsForOrg: ["GET /orgs/{org}/copilot/usage"],
    usageMetricsForTeam: ["GET /orgs/{org}/team/{team_slug}/copilot/usage"]
  },
  dependabot: {
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/dependabot/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    getAlert: ["GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"],
    getOrgPublicKey: ["GET /orgs/{org}/dependabot/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/dependabot/secrets/{secret_name}"],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/dependabot/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/dependabot/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/dependabot/alerts"],
    listOrgSecrets: ["GET /orgs/{org}/dependabot/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/dependabot/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"
    ]
  },
  dependencyGraph: {
    createRepositorySnapshot: [
      "POST /repos/{owner}/{repo}/dependency-graph/snapshots"
    ],
    diffRange: [
      "GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}"
    ],
    exportSbom: ["GET /repos/{owner}/{repo}/dependency-graph/sbom"]
  },
  emojis: { get: ["GET /emojis"] },
  gists: {
    checkIsStarred: ["GET /gists/{gist_id}/star"],
    create: ["POST /gists"],
    createComment: ["POST /gists/{gist_id}/comments"],
    delete: ["DELETE /gists/{gist_id}"],
    deleteComment: ["DELETE /gists/{gist_id}/comments/{comment_id}"],
    fork: ["POST /gists/{gist_id}/forks"],
    get: ["GET /gists/{gist_id}"],
    getComment: ["GET /gists/{gist_id}/comments/{comment_id}"],
    getRevision: ["GET /gists/{gist_id}/{sha}"],
    list: ["GET /gists"],
    listComments: ["GET /gists/{gist_id}/comments"],
    listCommits: ["GET /gists/{gist_id}/commits"],
    listForUser: ["GET /users/{username}/gists"],
    listForks: ["GET /gists/{gist_id}/forks"],
    listPublic: ["GET /gists/public"],
    listStarred: ["GET /gists/starred"],
    star: ["PUT /gists/{gist_id}/star"],
    unstar: ["DELETE /gists/{gist_id}/star"],
    update: ["PATCH /gists/{gist_id}"],
    updateComment: ["PATCH /gists/{gist_id}/comments/{comment_id}"]
  },
  git: {
    createBlob: ["POST /repos/{owner}/{repo}/git/blobs"],
    createCommit: ["POST /repos/{owner}/{repo}/git/commits"],
    createRef: ["POST /repos/{owner}/{repo}/git/refs"],
    createTag: ["POST /repos/{owner}/{repo}/git/tags"],
    createTree: ["POST /repos/{owner}/{repo}/git/trees"],
    deleteRef: ["DELETE /repos/{owner}/{repo}/git/refs/{ref}"],
    getBlob: ["GET /repos/{owner}/{repo}/git/blobs/{file_sha}"],
    getCommit: ["GET /repos/{owner}/{repo}/git/commits/{commit_sha}"],
    getRef: ["GET /repos/{owner}/{repo}/git/ref/{ref}"],
    getTag: ["GET /repos/{owner}/{repo}/git/tags/{tag_sha}"],
    getTree: ["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"],
    listMatchingRefs: ["GET /repos/{owner}/{repo}/git/matching-refs/{ref}"],
    updateRef: ["PATCH /repos/{owner}/{repo}/git/refs/{ref}"]
  },
  gitignore: {
    getAllTemplates: ["GET /gitignore/templates"],
    getTemplate: ["GET /gitignore/templates/{name}"]
  },
  hostedCompute: {
    createNetworkConfigurationForOrg: [
      "POST /orgs/{org}/settings/network-configurations"
    ],
    deleteNetworkConfigurationFromOrg: [
      "DELETE /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ],
    getNetworkConfigurationForOrg: [
      "GET /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ],
    getNetworkSettingsForOrg: [
      "GET /orgs/{org}/settings/network-settings/{network_settings_id}"
    ],
    listNetworkConfigurationsForOrg: [
      "GET /orgs/{org}/settings/network-configurations"
    ],
    updateNetworkConfigurationForOrg: [
      "PATCH /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ]
  },
  interactions: {
    getRestrictionsForAuthenticatedUser: ["GET /user/interaction-limits"],
    getRestrictionsForOrg: ["GET /orgs/{org}/interaction-limits"],
    getRestrictionsForRepo: ["GET /repos/{owner}/{repo}/interaction-limits"],
    getRestrictionsForYourPublicRepos: [
      "GET /user/interaction-limits",
      {},
      { renamed: ["interactions", "getRestrictionsForAuthenticatedUser"] }
    ],
    removeRestrictionsForAuthenticatedUser: ["DELETE /user/interaction-limits"],
    removeRestrictionsForOrg: ["DELETE /orgs/{org}/interaction-limits"],
    removeRestrictionsForRepo: [
      "DELETE /repos/{owner}/{repo}/interaction-limits"
    ],
    removeRestrictionsForYourPublicRepos: [
      "DELETE /user/interaction-limits",
      {},
      { renamed: ["interactions", "removeRestrictionsForAuthenticatedUser"] }
    ],
    setRestrictionsForAuthenticatedUser: ["PUT /user/interaction-limits"],
    setRestrictionsForOrg: ["PUT /orgs/{org}/interaction-limits"],
    setRestrictionsForRepo: ["PUT /repos/{owner}/{repo}/interaction-limits"],
    setRestrictionsForYourPublicRepos: [
      "PUT /user/interaction-limits",
      {},
      { renamed: ["interactions", "setRestrictionsForAuthenticatedUser"] }
    ]
  },
  issues: {
    addAssignees: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    addLabels: ["POST /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    addSubIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues"
    ],
    checkUserCanBeAssigned: ["GET /repos/{owner}/{repo}/assignees/{assignee}"],
    checkUserCanBeAssignedToIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}"
    ],
    create: ["POST /repos/{owner}/{repo}/issues"],
    createComment: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments"
    ],
    createLabel: ["POST /repos/{owner}/{repo}/labels"],
    createMilestone: ["POST /repos/{owner}/{repo}/milestones"],
    deleteComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}"
    ],
    deleteLabel: ["DELETE /repos/{owner}/{repo}/labels/{name}"],
    deleteMilestone: [
      "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}"
    ],
    get: ["GET /repos/{owner}/{repo}/issues/{issue_number}"],
    getComment: ["GET /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    getEvent: ["GET /repos/{owner}/{repo}/issues/events/{event_id}"],
    getLabel: ["GET /repos/{owner}/{repo}/labels/{name}"],
    getMilestone: ["GET /repos/{owner}/{repo}/milestones/{milestone_number}"],
    list: ["GET /issues"],
    listAssignees: ["GET /repos/{owner}/{repo}/assignees"],
    listComments: ["GET /repos/{owner}/{repo}/issues/{issue_number}/comments"],
    listCommentsForRepo: ["GET /repos/{owner}/{repo}/issues/comments"],
    listEvents: ["GET /repos/{owner}/{repo}/issues/{issue_number}/events"],
    listEventsForRepo: ["GET /repos/{owner}/{repo}/issues/events"],
    listEventsForTimeline: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline"
    ],
    listForAuthenticatedUser: ["GET /user/issues"],
    listForOrg: ["GET /orgs/{org}/issues"],
    listForRepo: ["GET /repos/{owner}/{repo}/issues"],
    listLabelsForMilestone: [
      "GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels"
    ],
    listLabelsForRepo: ["GET /repos/{owner}/{repo}/labels"],
    listLabelsOnIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    listMilestones: ["GET /repos/{owner}/{repo}/milestones"],
    listSubIssues: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues"
    ],
    lock: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    removeAllLabels: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    removeAssignees: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    removeLabel: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}"
    ],
    removeSubIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue"
    ],
    reprioritizeSubIssue: [
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority"
    ],
    setLabels: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    unlock: ["DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    update: ["PATCH /repos/{owner}/{repo}/issues/{issue_number}"],
    updateComment: ["PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    updateLabel: ["PATCH /repos/{owner}/{repo}/labels/{name}"],
    updateMilestone: [
      "PATCH /repos/{owner}/{repo}/milestones/{milestone_number}"
    ]
  },
  licenses: {
    get: ["GET /licenses/{license}"],
    getAllCommonlyUsed: ["GET /licenses"],
    getForRepo: ["GET /repos/{owner}/{repo}/license"]
  },
  markdown: {
    render: ["POST /markdown"],
    renderRaw: [
      "POST /markdown/raw",
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    ]
  },
  meta: {
    get: ["GET /meta"],
    getAllVersions: ["GET /versions"],
    getOctocat: ["GET /octocat"],
    getZen: ["GET /zen"],
    root: ["GET /"]
  },
  migrations: {
    deleteArchiveForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/archive"
    ],
    deleteArchiveForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/archive"
    ],
    downloadArchiveForOrg: [
      "GET /orgs/{org}/migrations/{migration_id}/archive"
    ],
    getArchiveForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/archive"
    ],
    getStatusForAuthenticatedUser: ["GET /user/migrations/{migration_id}"],
    getStatusForOrg: ["GET /orgs/{org}/migrations/{migration_id}"],
    listForAuthenticatedUser: ["GET /user/migrations"],
    listForOrg: ["GET /orgs/{org}/migrations"],
    listReposForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/repositories"
    ],
    listReposForOrg: ["GET /orgs/{org}/migrations/{migration_id}/repositories"],
    listReposForUser: [
      "GET /user/migrations/{migration_id}/repositories",
      {},
      { renamed: ["migrations", "listReposForAuthenticatedUser"] }
    ],
    startForAuthenticatedUser: ["POST /user/migrations"],
    startForOrg: ["POST /orgs/{org}/migrations"],
    unlockRepoForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/repos/{repo_name}/lock"
    ],
    unlockRepoForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock"
    ]
  },
  oidc: {
    getOidcCustomSubTemplateForOrg: [
      "GET /orgs/{org}/actions/oidc/customization/sub"
    ],
    updateOidcCustomSubTemplateForOrg: [
      "PUT /orgs/{org}/actions/oidc/customization/sub"
    ]
  },
  orgs: {
    addSecurityManagerTeam: [
      "PUT /orgs/{org}/security-managers/teams/{team_slug}",
      {},
      {
        deprecated: "octokit.rest.orgs.addSecurityManagerTeam() is deprecated, see https://docs.github.com/rest/orgs/security-managers#add-a-security-manager-team"
      }
    ],
    assignTeamToOrgRole: [
      "PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    assignUserToOrgRole: [
      "PUT /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    blockUser: ["PUT /orgs/{org}/blocks/{username}"],
    cancelInvitation: ["DELETE /orgs/{org}/invitations/{invitation_id}"],
    checkBlockedUser: ["GET /orgs/{org}/blocks/{username}"],
    checkMembershipForUser: ["GET /orgs/{org}/members/{username}"],
    checkPublicMembershipForUser: ["GET /orgs/{org}/public_members/{username}"],
    convertMemberToOutsideCollaborator: [
      "PUT /orgs/{org}/outside_collaborators/{username}"
    ],
    createInvitation: ["POST /orgs/{org}/invitations"],
    createIssueType: ["POST /orgs/{org}/issue-types"],
    createOrUpdateCustomProperties: ["PATCH /orgs/{org}/properties/schema"],
    createOrUpdateCustomPropertiesValuesForRepos: [
      "PATCH /orgs/{org}/properties/values"
    ],
    createOrUpdateCustomProperty: [
      "PUT /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    createWebhook: ["POST /orgs/{org}/hooks"],
    delete: ["DELETE /orgs/{org}"],
    deleteIssueType: ["DELETE /orgs/{org}/issue-types/{issue_type_id}"],
    deleteWebhook: ["DELETE /orgs/{org}/hooks/{hook_id}"],
    enableOrDisableSecurityProductOnAllOrgRepos: [
      "POST /orgs/{org}/{security_product}/{enablement}",
      {},
      {
        deprecated: "octokit.rest.orgs.enableOrDisableSecurityProductOnAllOrgRepos() is deprecated, see https://docs.github.com/rest/orgs/orgs#enable-or-disable-a-security-feature-for-an-organization"
      }
    ],
    get: ["GET /orgs/{org}"],
    getAllCustomProperties: ["GET /orgs/{org}/properties/schema"],
    getCustomProperty: [
      "GET /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    getMembershipForAuthenticatedUser: ["GET /user/memberships/orgs/{org}"],
    getMembershipForUser: ["GET /orgs/{org}/memberships/{username}"],
    getOrgRole: ["GET /orgs/{org}/organization-roles/{role_id}"],
    getOrgRulesetHistory: ["GET /orgs/{org}/rulesets/{ruleset_id}/history"],
    getOrgRulesetVersion: [
      "GET /orgs/{org}/rulesets/{ruleset_id}/history/{version_id}"
    ],
    getWebhook: ["GET /orgs/{org}/hooks/{hook_id}"],
    getWebhookConfigForOrg: ["GET /orgs/{org}/hooks/{hook_id}/config"],
    getWebhookDelivery: [
      "GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    list: ["GET /organizations"],
    listAppInstallations: ["GET /orgs/{org}/installations"],
    listAttestations: ["GET /orgs/{org}/attestations/{subject_digest}"],
    listBlockedUsers: ["GET /orgs/{org}/blocks"],
    listCustomPropertiesValuesForRepos: ["GET /orgs/{org}/properties/values"],
    listFailedInvitations: ["GET /orgs/{org}/failed_invitations"],
    listForAuthenticatedUser: ["GET /user/orgs"],
    listForUser: ["GET /users/{username}/orgs"],
    listInvitationTeams: ["GET /orgs/{org}/invitations/{invitation_id}/teams"],
    listIssueTypes: ["GET /orgs/{org}/issue-types"],
    listMembers: ["GET /orgs/{org}/members"],
    listMembershipsForAuthenticatedUser: ["GET /user/memberships/orgs"],
    listOrgRoleTeams: ["GET /orgs/{org}/organization-roles/{role_id}/teams"],
    listOrgRoleUsers: ["GET /orgs/{org}/organization-roles/{role_id}/users"],
    listOrgRoles: ["GET /orgs/{org}/organization-roles"],
    listOrganizationFineGrainedPermissions: [
      "GET /orgs/{org}/organization-fine-grained-permissions"
    ],
    listOutsideCollaborators: ["GET /orgs/{org}/outside_collaborators"],
    listPatGrantRepositories: [
      "GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories"
    ],
    listPatGrantRequestRepositories: [
      "GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories"
    ],
    listPatGrantRequests: ["GET /orgs/{org}/personal-access-token-requests"],
    listPatGrants: ["GET /orgs/{org}/personal-access-tokens"],
    listPendingInvitations: ["GET /orgs/{org}/invitations"],
    listPublicMembers: ["GET /orgs/{org}/public_members"],
    listSecurityManagerTeams: [
      "GET /orgs/{org}/security-managers",
      {},
      {
        deprecated: "octokit.rest.orgs.listSecurityManagerTeams() is deprecated, see https://docs.github.com/rest/orgs/security-managers#list-security-manager-teams"
      }
    ],
    listWebhookDeliveries: ["GET /orgs/{org}/hooks/{hook_id}/deliveries"],
    listWebhooks: ["GET /orgs/{org}/hooks"],
    pingWebhook: ["POST /orgs/{org}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeCustomProperty: [
      "DELETE /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    removeMember: ["DELETE /orgs/{org}/members/{username}"],
    removeMembershipForUser: ["DELETE /orgs/{org}/memberships/{username}"],
    removeOutsideCollaborator: [
      "DELETE /orgs/{org}/outside_collaborators/{username}"
    ],
    removePublicMembershipForAuthenticatedUser: [
      "DELETE /orgs/{org}/public_members/{username}"
    ],
    removeSecurityManagerTeam: [
      "DELETE /orgs/{org}/security-managers/teams/{team_slug}",
      {},
      {
        deprecated: "octokit.rest.orgs.removeSecurityManagerTeam() is deprecated, see https://docs.github.com/rest/orgs/security-managers#remove-a-security-manager-team"
      }
    ],
    reviewPatGrantRequest: [
      "POST /orgs/{org}/personal-access-token-requests/{pat_request_id}"
    ],
    reviewPatGrantRequestsInBulk: [
      "POST /orgs/{org}/personal-access-token-requests"
    ],
    revokeAllOrgRolesTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}"
    ],
    revokeAllOrgRolesUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}"
    ],
    revokeOrgRoleTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    revokeOrgRoleUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    setMembershipForUser: ["PUT /orgs/{org}/memberships/{username}"],
    setPublicMembershipForAuthenticatedUser: [
      "PUT /orgs/{org}/public_members/{username}"
    ],
    unblockUser: ["DELETE /orgs/{org}/blocks/{username}"],
    update: ["PATCH /orgs/{org}"],
    updateIssueType: ["PUT /orgs/{org}/issue-types/{issue_type_id}"],
    updateMembershipForAuthenticatedUser: [
      "PATCH /user/memberships/orgs/{org}"
    ],
    updatePatAccess: ["POST /orgs/{org}/personal-access-tokens/{pat_id}"],
    updatePatAccesses: ["POST /orgs/{org}/personal-access-tokens"],
    updateWebhook: ["PATCH /orgs/{org}/hooks/{hook_id}"],
    updateWebhookConfigForOrg: ["PATCH /orgs/{org}/hooks/{hook_id}/config"]
  },
  packages: {
    deletePackageForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}"
    ],
    deletePackageForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    deletePackageForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}"
    ],
    deletePackageVersionForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getAllPackageVersionsForAPackageOwnedByAnOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions",
      {},
      { renamed: ["packages", "getAllPackageVersionsForPackageOwnedByOrg"] }
    ],
    getAllPackageVersionsForAPackageOwnedByTheAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions",
      {},
      {
        renamed: [
          "packages",
          "getAllPackageVersionsForPackageOwnedByAuthenticatedUser"
        ]
      }
    ],
    getAllPackageVersionsForPackageOwnedByAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions"
    ],
    getPackageForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}"
    ],
    getPackageForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    getPackageForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}"
    ],
    getPackageVersionForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    listDockerMigrationConflictingPackagesForAuthenticatedUser: [
      "GET /user/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForOrganization: [
      "GET /orgs/{org}/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForUser: [
      "GET /users/{username}/docker/conflicts"
    ],
    listPackagesForAuthenticatedUser: ["GET /user/packages"],
    listPackagesForOrganization: ["GET /orgs/{org}/packages"],
    listPackagesForUser: ["GET /users/{username}/packages"],
    restorePackageForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageVersionForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ]
  },
  privateRegistries: {
    createOrgPrivateRegistry: ["POST /orgs/{org}/private-registries"],
    deleteOrgPrivateRegistry: [
      "DELETE /orgs/{org}/private-registries/{secret_name}"
    ],
    getOrgPrivateRegistry: ["GET /orgs/{org}/private-registries/{secret_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/private-registries/public-key"],
    listOrgPrivateRegistries: ["GET /orgs/{org}/private-registries"],
    updateOrgPrivateRegistry: [
      "PATCH /orgs/{org}/private-registries/{secret_name}"
    ]
  },
  projects: {
    addCollaborator: [
      "PUT /projects/{project_id}/collaborators/{username}",
      {},
      {
        deprecated: "octokit.rest.projects.addCollaborator() is deprecated, see https://docs.github.com/rest/projects/collaborators#add-project-collaborator"
      }
    ],
    createCard: [
      "POST /projects/columns/{column_id}/cards",
      {},
      {
        deprecated: "octokit.rest.projects.createCard() is deprecated, see https://docs.github.com/rest/projects/cards#create-a-project-card"
      }
    ],
    createColumn: [
      "POST /projects/{project_id}/columns",
      {},
      {
        deprecated: "octokit.rest.projects.createColumn() is deprecated, see https://docs.github.com/rest/projects/columns#create-a-project-column"
      }
    ],
    createForAuthenticatedUser: [
      "POST /user/projects",
      {},
      {
        deprecated: "octokit.rest.projects.createForAuthenticatedUser() is deprecated, see https://docs.github.com/rest/projects/projects#create-a-user-project"
      }
    ],
    createForOrg: [
      "POST /orgs/{org}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.createForOrg() is deprecated, see https://docs.github.com/rest/projects/projects#create-an-organization-project"
      }
    ],
    createForRepo: [
      "POST /repos/{owner}/{repo}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.createForRepo() is deprecated, see https://docs.github.com/rest/projects/projects#create-a-repository-project"
      }
    ],
    delete: [
      "DELETE /projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.projects.delete() is deprecated, see https://docs.github.com/rest/projects/projects#delete-a-project"
      }
    ],
    deleteCard: [
      "DELETE /projects/columns/cards/{card_id}",
      {},
      {
        deprecated: "octokit.rest.projects.deleteCard() is deprecated, see https://docs.github.com/rest/projects/cards#delete-a-project-card"
      }
    ],
    deleteColumn: [
      "DELETE /projects/columns/{column_id}",
      {},
      {
        deprecated: "octokit.rest.projects.deleteColumn() is deprecated, see https://docs.github.com/rest/projects/columns#delete-a-project-column"
      }
    ],
    get: [
      "GET /projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.projects.get() is deprecated, see https://docs.github.com/rest/projects/projects#get-a-project"
      }
    ],
    getCard: [
      "GET /projects/columns/cards/{card_id}",
      {},
      {
        deprecated: "octokit.rest.projects.getCard() is deprecated, see https://docs.github.com/rest/projects/cards#get-a-project-card"
      }
    ],
    getColumn: [
      "GET /projects/columns/{column_id}",
      {},
      {
        deprecated: "octokit.rest.projects.getColumn() is deprecated, see https://docs.github.com/rest/projects/columns#get-a-project-column"
      }
    ],
    getPermissionForUser: [
      "GET /projects/{project_id}/collaborators/{username}/permission",
      {},
      {
        deprecated: "octokit.rest.projects.getPermissionForUser() is deprecated, see https://docs.github.com/rest/projects/collaborators#get-project-permission-for-a-user"
      }
    ],
    listCards: [
      "GET /projects/columns/{column_id}/cards",
      {},
      {
        deprecated: "octokit.rest.projects.listCards() is deprecated, see https://docs.github.com/rest/projects/cards#list-project-cards"
      }
    ],
    listCollaborators: [
      "GET /projects/{project_id}/collaborators",
      {},
      {
        deprecated: "octokit.rest.projects.listCollaborators() is deprecated, see https://docs.github.com/rest/projects/collaborators#list-project-collaborators"
      }
    ],
    listColumns: [
      "GET /projects/{project_id}/columns",
      {},
      {
        deprecated: "octokit.rest.projects.listColumns() is deprecated, see https://docs.github.com/rest/projects/columns#list-project-columns"
      }
    ],
    listForOrg: [
      "GET /orgs/{org}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.listForOrg() is deprecated, see https://docs.github.com/rest/projects/projects#list-organization-projects"
      }
    ],
    listForRepo: [
      "GET /repos/{owner}/{repo}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.listForRepo() is deprecated, see https://docs.github.com/rest/projects/projects#list-repository-projects"
      }
    ],
    listForUser: [
      "GET /users/{username}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.listForUser() is deprecated, see https://docs.github.com/rest/projects/projects#list-user-projects"
      }
    ],
    moveCard: [
      "POST /projects/columns/cards/{card_id}/moves",
      {},
      {
        deprecated: "octokit.rest.projects.moveCard() is deprecated, see https://docs.github.com/rest/projects/cards#move-a-project-card"
      }
    ],
    moveColumn: [
      "POST /projects/columns/{column_id}/moves",
      {},
      {
        deprecated: "octokit.rest.projects.moveColumn() is deprecated, see https://docs.github.com/rest/projects/columns#move-a-project-column"
      }
    ],
    removeCollaborator: [
      "DELETE /projects/{project_id}/collaborators/{username}",
      {},
      {
        deprecated: "octokit.rest.projects.removeCollaborator() is deprecated, see https://docs.github.com/rest/projects/collaborators#remove-user-as-a-collaborator"
      }
    ],
    update: [
      "PATCH /projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.projects.update() is deprecated, see https://docs.github.com/rest/projects/projects#update-a-project"
      }
    ],
    updateCard: [
      "PATCH /projects/columns/cards/{card_id}",
      {},
      {
        deprecated: "octokit.rest.projects.updateCard() is deprecated, see https://docs.github.com/rest/projects/cards#update-an-existing-project-card"
      }
    ],
    updateColumn: [
      "PATCH /projects/columns/{column_id}",
      {},
      {
        deprecated: "octokit.rest.projects.updateColumn() is deprecated, see https://docs.github.com/rest/projects/columns#update-an-existing-project-column"
      }
    ]
  },
  pulls: {
    checkIfMerged: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    create: ["POST /repos/{owner}/{repo}/pulls"],
    createReplyForReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies"
    ],
    createReview: ["POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    createReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    deletePendingReview: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    deleteReviewComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ],
    dismissReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals"
    ],
    get: ["GET /repos/{owner}/{repo}/pulls/{pull_number}"],
    getReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    getReviewComment: ["GET /repos/{owner}/{repo}/pulls/comments/{comment_id}"],
    list: ["GET /repos/{owner}/{repo}/pulls"],
    listCommentsForReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/commits"],
    listFiles: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/files"],
    listRequestedReviewers: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    listReviewComments: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    listReviewCommentsForRepo: ["GET /repos/{owner}/{repo}/pulls/comments"],
    listReviews: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    merge: ["PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    removeRequestedReviewers: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    requestReviewers: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    submitReview: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events"
    ],
    update: ["PATCH /repos/{owner}/{repo}/pulls/{pull_number}"],
    updateBranch: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch"
    ],
    updateReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    updateReviewComment: [
      "PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ]
  },
  rateLimit: { get: ["GET /rate_limit"] },
  reactions: {
    createForCommitComment: [
      "POST /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    createForIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions"
    ],
    createForIssueComment: [
      "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    createForPullRequestReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    createForRelease: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    createForTeamDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    createForTeamDiscussionInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ],
    deleteForCommitComment: [
      "DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}"
    ],
    deleteForIssueComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForPullRequestComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForRelease: [
      "DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussion: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussionComment: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions/{reaction_id}"
    ],
    listForCommitComment: [
      "GET /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    listForIssue: ["GET /repos/{owner}/{repo}/issues/{issue_number}/reactions"],
    listForIssueComment: [
      "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    listForPullRequestReviewComment: [
      "GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    listForRelease: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    listForTeamDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    listForTeamDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ]
  },
  repos: {
    acceptInvitation: [
      "PATCH /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "acceptInvitationForAuthenticatedUser"] }
    ],
    acceptInvitationForAuthenticatedUser: [
      "PATCH /user/repository_invitations/{invitation_id}"
    ],
    addAppAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    addCollaborator: ["PUT /repos/{owner}/{repo}/collaborators/{username}"],
    addStatusCheckContexts: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    addTeamAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    addUserAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    cancelPagesDeployment: [
      "POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel"
    ],
    checkAutomatedSecurityFixes: [
      "GET /repos/{owner}/{repo}/automated-security-fixes"
    ],
    checkCollaborator: ["GET /repos/{owner}/{repo}/collaborators/{username}"],
    checkPrivateVulnerabilityReporting: [
      "GET /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    checkVulnerabilityAlerts: [
      "GET /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    codeownersErrors: ["GET /repos/{owner}/{repo}/codeowners/errors"],
    compareCommits: ["GET /repos/{owner}/{repo}/compare/{base}...{head}"],
    compareCommitsWithBasehead: [
      "GET /repos/{owner}/{repo}/compare/{basehead}"
    ],
    createAttestation: ["POST /repos/{owner}/{repo}/attestations"],
    createAutolink: ["POST /repos/{owner}/{repo}/autolinks"],
    createCommitComment: [
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    createCommitSignatureProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    createCommitStatus: ["POST /repos/{owner}/{repo}/statuses/{sha}"],
    createDeployKey: ["POST /repos/{owner}/{repo}/keys"],
    createDeployment: ["POST /repos/{owner}/{repo}/deployments"],
    createDeploymentBranchPolicy: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    createDeploymentProtectionRule: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    createDeploymentStatus: [
      "POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    createDispatchEvent: ["POST /repos/{owner}/{repo}/dispatches"],
    createForAuthenticatedUser: ["POST /user/repos"],
    createFork: ["POST /repos/{owner}/{repo}/forks"],
    createInOrg: ["POST /orgs/{org}/repos"],
    createOrUpdateCustomPropertiesValues: [
      "PATCH /repos/{owner}/{repo}/properties/values"
    ],
    createOrUpdateEnvironment: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    createOrUpdateFileContents: ["PUT /repos/{owner}/{repo}/contents/{path}"],
    createOrgRuleset: ["POST /orgs/{org}/rulesets"],
    createPagesDeployment: ["POST /repos/{owner}/{repo}/pages/deployments"],
    createPagesSite: ["POST /repos/{owner}/{repo}/pages"],
    createRelease: ["POST /repos/{owner}/{repo}/releases"],
    createRepoRuleset: ["POST /repos/{owner}/{repo}/rulesets"],
    createUsingTemplate: [
      "POST /repos/{template_owner}/{template_repo}/generate"
    ],
    createWebhook: ["POST /repos/{owner}/{repo}/hooks"],
    declineInvitation: [
      "DELETE /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "declineInvitationForAuthenticatedUser"] }
    ],
    declineInvitationForAuthenticatedUser: [
      "DELETE /user/repository_invitations/{invitation_id}"
    ],
    delete: ["DELETE /repos/{owner}/{repo}"],
    deleteAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    deleteAdminBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    deleteAnEnvironment: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    deleteAutolink: ["DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    deleteBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    deleteCommitComment: ["DELETE /repos/{owner}/{repo}/comments/{comment_id}"],
    deleteCommitSignatureProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    deleteDeployKey: ["DELETE /repos/{owner}/{repo}/keys/{key_id}"],
    deleteDeployment: [
      "DELETE /repos/{owner}/{repo}/deployments/{deployment_id}"
    ],
    deleteDeploymentBranchPolicy: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    deleteFile: ["DELETE /repos/{owner}/{repo}/contents/{path}"],
    deleteInvitation: [
      "DELETE /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    deleteOrgRuleset: ["DELETE /orgs/{org}/rulesets/{ruleset_id}"],
    deletePagesSite: ["DELETE /repos/{owner}/{repo}/pages"],
    deletePullRequestReviewProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    deleteRelease: ["DELETE /repos/{owner}/{repo}/releases/{release_id}"],
    deleteReleaseAsset: [
      "DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    deleteRepoRuleset: ["DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    deleteWebhook: ["DELETE /repos/{owner}/{repo}/hooks/{hook_id}"],
    disableAutomatedSecurityFixes: [
      "DELETE /repos/{owner}/{repo}/automated-security-fixes"
    ],
    disableDeploymentProtectionRule: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    disablePrivateVulnerabilityReporting: [
      "DELETE /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    disableVulnerabilityAlerts: [
      "DELETE /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    downloadArchive: [
      "GET /repos/{owner}/{repo}/zipball/{ref}",
      {},
      { renamed: ["repos", "downloadZipballArchive"] }
    ],
    downloadTarballArchive: ["GET /repos/{owner}/{repo}/tarball/{ref}"],
    downloadZipballArchive: ["GET /repos/{owner}/{repo}/zipball/{ref}"],
    enableAutomatedSecurityFixes: [
      "PUT /repos/{owner}/{repo}/automated-security-fixes"
    ],
    enablePrivateVulnerabilityReporting: [
      "PUT /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    enableVulnerabilityAlerts: [
      "PUT /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    generateReleaseNotes: [
      "POST /repos/{owner}/{repo}/releases/generate-notes"
    ],
    get: ["GET /repos/{owner}/{repo}"],
    getAccessRestrictions: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    getAdminBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    getAllDeploymentProtectionRules: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    getAllEnvironments: ["GET /repos/{owner}/{repo}/environments"],
    getAllStatusCheckContexts: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts"
    ],
    getAllTopics: ["GET /repos/{owner}/{repo}/topics"],
    getAppsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps"
    ],
    getAutolink: ["GET /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    getBranch: ["GET /repos/{owner}/{repo}/branches/{branch}"],
    getBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    getBranchRules: ["GET /repos/{owner}/{repo}/rules/branches/{branch}"],
    getClones: ["GET /repos/{owner}/{repo}/traffic/clones"],
    getCodeFrequencyStats: ["GET /repos/{owner}/{repo}/stats/code_frequency"],
    getCollaboratorPermissionLevel: [
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission"
    ],
    getCombinedStatusForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/status"],
    getCommit: ["GET /repos/{owner}/{repo}/commits/{ref}"],
    getCommitActivityStats: ["GET /repos/{owner}/{repo}/stats/commit_activity"],
    getCommitComment: ["GET /repos/{owner}/{repo}/comments/{comment_id}"],
    getCommitSignatureProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    getCommunityProfileMetrics: ["GET /repos/{owner}/{repo}/community/profile"],
    getContent: ["GET /repos/{owner}/{repo}/contents/{path}"],
    getContributorsStats: ["GET /repos/{owner}/{repo}/stats/contributors"],
    getCustomDeploymentProtectionRule: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    getCustomPropertiesValues: ["GET /repos/{owner}/{repo}/properties/values"],
    getDeployKey: ["GET /repos/{owner}/{repo}/keys/{key_id}"],
    getDeployment: ["GET /repos/{owner}/{repo}/deployments/{deployment_id}"],
    getDeploymentBranchPolicy: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    getDeploymentStatus: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}"
    ],
    getEnvironment: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    getLatestPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/latest"],
    getLatestRelease: ["GET /repos/{owner}/{repo}/releases/latest"],
    getOrgRuleSuite: ["GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}"],
    getOrgRuleSuites: ["GET /orgs/{org}/rulesets/rule-suites"],
    getOrgRuleset: ["GET /orgs/{org}/rulesets/{ruleset_id}"],
    getOrgRulesets: ["GET /orgs/{org}/rulesets"],
    getPages: ["GET /repos/{owner}/{repo}/pages"],
    getPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/{build_id}"],
    getPagesDeployment: [
      "GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}"
    ],
    getPagesHealthCheck: ["GET /repos/{owner}/{repo}/pages/health"],
    getParticipationStats: ["GET /repos/{owner}/{repo}/stats/participation"],
    getPullRequestReviewProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    getPunchCardStats: ["GET /repos/{owner}/{repo}/stats/punch_card"],
    getReadme: ["GET /repos/{owner}/{repo}/readme"],
    getReadmeInDirectory: ["GET /repos/{owner}/{repo}/readme/{dir}"],
    getRelease: ["GET /repos/{owner}/{repo}/releases/{release_id}"],
    getReleaseAsset: ["GET /repos/{owner}/{repo}/releases/assets/{asset_id}"],
    getReleaseByTag: ["GET /repos/{owner}/{repo}/releases/tags/{tag}"],
    getRepoRuleSuite: [
      "GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}"
    ],
    getRepoRuleSuites: ["GET /repos/{owner}/{repo}/rulesets/rule-suites"],
    getRepoRuleset: ["GET /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    getRepoRulesetHistory: [
      "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history"
    ],
    getRepoRulesetVersion: [
      "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}"
    ],
    getRepoRulesets: ["GET /repos/{owner}/{repo}/rulesets"],
    getStatusChecksProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    getTeamsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams"
    ],
    getTopPaths: ["GET /repos/{owner}/{repo}/traffic/popular/paths"],
    getTopReferrers: ["GET /repos/{owner}/{repo}/traffic/popular/referrers"],
    getUsersWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users"
    ],
    getViews: ["GET /repos/{owner}/{repo}/traffic/views"],
    getWebhook: ["GET /repos/{owner}/{repo}/hooks/{hook_id}"],
    getWebhookConfigForRepo: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    getWebhookDelivery: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    listActivities: ["GET /repos/{owner}/{repo}/activity"],
    listAttestations: [
      "GET /repos/{owner}/{repo}/attestations/{subject_digest}"
    ],
    listAutolinks: ["GET /repos/{owner}/{repo}/autolinks"],
    listBranches: ["GET /repos/{owner}/{repo}/branches"],
    listBranchesForHeadCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head"
    ],
    listCollaborators: ["GET /repos/{owner}/{repo}/collaborators"],
    listCommentsForCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    listCommitCommentsForRepo: ["GET /repos/{owner}/{repo}/comments"],
    listCommitStatusesForRef: [
      "GET /repos/{owner}/{repo}/commits/{ref}/statuses"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/commits"],
    listContributors: ["GET /repos/{owner}/{repo}/contributors"],
    listCustomDeploymentRuleIntegrations: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps"
    ],
    listDeployKeys: ["GET /repos/{owner}/{repo}/keys"],
    listDeploymentBranchPolicies: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    listDeploymentStatuses: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    listDeployments: ["GET /repos/{owner}/{repo}/deployments"],
    listForAuthenticatedUser: ["GET /user/repos"],
    listForOrg: ["GET /orgs/{org}/repos"],
    listForUser: ["GET /users/{username}/repos"],
    listForks: ["GET /repos/{owner}/{repo}/forks"],
    listInvitations: ["GET /repos/{owner}/{repo}/invitations"],
    listInvitationsForAuthenticatedUser: ["GET /user/repository_invitations"],
    listLanguages: ["GET /repos/{owner}/{repo}/languages"],
    listPagesBuilds: ["GET /repos/{owner}/{repo}/pages/builds"],
    listPublic: ["GET /repositories"],
    listPullRequestsAssociatedWithCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls"
    ],
    listReleaseAssets: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/assets"
    ],
    listReleases: ["GET /repos/{owner}/{repo}/releases"],
    listTags: ["GET /repos/{owner}/{repo}/tags"],
    listTeams: ["GET /repos/{owner}/{repo}/teams"],
    listWebhookDeliveries: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries"
    ],
    listWebhooks: ["GET /repos/{owner}/{repo}/hooks"],
    merge: ["POST /repos/{owner}/{repo}/merges"],
    mergeUpstream: ["POST /repos/{owner}/{repo}/merge-upstream"],
    pingWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeAppAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    removeCollaborator: [
      "DELETE /repos/{owner}/{repo}/collaborators/{username}"
    ],
    removeStatusCheckContexts: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    removeStatusCheckProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    removeTeamAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    removeUserAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    renameBranch: ["POST /repos/{owner}/{repo}/branches/{branch}/rename"],
    replaceAllTopics: ["PUT /repos/{owner}/{repo}/topics"],
    requestPagesBuild: ["POST /repos/{owner}/{repo}/pages/builds"],
    setAdminBranchProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    setAppAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    setStatusCheckContexts: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    setTeamAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    setUserAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    testPushWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/tests"],
    transfer: ["POST /repos/{owner}/{repo}/transfer"],
    update: ["PATCH /repos/{owner}/{repo}"],
    updateBranchProtection: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    updateCommitComment: ["PATCH /repos/{owner}/{repo}/comments/{comment_id}"],
    updateDeploymentBranchPolicy: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    updateInformationAboutPagesSite: ["PUT /repos/{owner}/{repo}/pages"],
    updateInvitation: [
      "PATCH /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    updateOrgRuleset: ["PUT /orgs/{org}/rulesets/{ruleset_id}"],
    updatePullRequestReviewProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    updateRelease: ["PATCH /repos/{owner}/{repo}/releases/{release_id}"],
    updateReleaseAsset: [
      "PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    updateRepoRuleset: ["PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    updateStatusCheckPotection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
      {},
      { renamed: ["repos", "updateStatusCheckProtection"] }
    ],
    updateStatusCheckProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    updateWebhook: ["PATCH /repos/{owner}/{repo}/hooks/{hook_id}"],
    updateWebhookConfigForRepo: [
      "PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    uploadReleaseAsset: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
      { baseUrl: "https://uploads.github.com" }
    ]
  },
  search: {
    code: ["GET /search/code"],
    commits: ["GET /search/commits"],
    issuesAndPullRequests: [
      "GET /search/issues",
      {},
      {
        deprecated: "octokit.rest.search.issuesAndPullRequests() is deprecated, see https://docs.github.com/rest/search/search#search-issues-and-pull-requests"
      }
    ],
    labels: ["GET /search/labels"],
    repos: ["GET /search/repositories"],
    topics: ["GET /search/topics"],
    users: ["GET /search/users"]
  },
  secretScanning: {
    createPushProtectionBypass: [
      "POST /repos/{owner}/{repo}/secret-scanning/push-protection-bypasses"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ],
    getScanHistory: ["GET /repos/{owner}/{repo}/secret-scanning/scan-history"],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/secret-scanning/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/secret-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/secret-scanning/alerts"],
    listLocationsForAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ]
  },
  securityAdvisories: {
    createFork: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks"
    ],
    createPrivateVulnerabilityReport: [
      "POST /repos/{owner}/{repo}/security-advisories/reports"
    ],
    createRepositoryAdvisory: [
      "POST /repos/{owner}/{repo}/security-advisories"
    ],
    createRepositoryAdvisoryCveRequest: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve"
    ],
    getGlobalAdvisory: ["GET /advisories/{ghsa_id}"],
    getRepositoryAdvisory: [
      "GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ],
    listGlobalAdvisories: ["GET /advisories"],
    listOrgRepositoryAdvisories: ["GET /orgs/{org}/security-advisories"],
    listRepositoryAdvisories: ["GET /repos/{owner}/{repo}/security-advisories"],
    updateRepositoryAdvisory: [
      "PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ]
  },
  teams: {
    addOrUpdateMembershipForUserInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    addOrUpdateProjectPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.addOrUpdateProjectPermissionsInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#add-or-update-team-project-permissions"
      }
    ],
    addOrUpdateProjectPermissionsLegacy: [
      "PUT /teams/{team_id}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.addOrUpdateProjectPermissionsLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#add-or-update-team-project-permissions-legacy"
      }
    ],
    addOrUpdateRepoPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    checkPermissionsForProjectInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.checkPermissionsForProjectInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-project"
      }
    ],
    checkPermissionsForProjectLegacy: [
      "GET /teams/{team_id}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.checkPermissionsForProjectLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-project-legacy"
      }
    ],
    checkPermissionsForRepoInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    create: ["POST /orgs/{org}/teams"],
    createDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    createDiscussionInOrg: ["POST /orgs/{org}/teams/{team_slug}/discussions"],
    deleteDiscussionCommentInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    deleteDiscussionInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    deleteInOrg: ["DELETE /orgs/{org}/teams/{team_slug}"],
    getByName: ["GET /orgs/{org}/teams/{team_slug}"],
    getDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    getDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    getMembershipForUserInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    list: ["GET /orgs/{org}/teams"],
    listChildInOrg: ["GET /orgs/{org}/teams/{team_slug}/teams"],
    listDiscussionCommentsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    listDiscussionsInOrg: ["GET /orgs/{org}/teams/{team_slug}/discussions"],
    listForAuthenticatedUser: ["GET /user/teams"],
    listMembersInOrg: ["GET /orgs/{org}/teams/{team_slug}/members"],
    listPendingInvitationsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/invitations"
    ],
    listProjectsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/projects",
      {},
      {
        deprecated: "octokit.rest.teams.listProjectsInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#list-team-projects"
      }
    ],
    listProjectsLegacy: [
      "GET /teams/{team_id}/projects",
      {},
      {
        deprecated: "octokit.rest.teams.listProjectsLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#list-team-projects-legacy"
      }
    ],
    listReposInOrg: ["GET /orgs/{org}/teams/{team_slug}/repos"],
    removeMembershipForUserInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    removeProjectInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.removeProjectInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#remove-a-project-from-a-team"
      }
    ],
    removeProjectLegacy: [
      "DELETE /teams/{team_id}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.removeProjectLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#remove-a-project-from-a-team-legacy"
      }
    ],
    removeRepoInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    updateDiscussionCommentInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    updateDiscussionInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    updateInOrg: ["PATCH /orgs/{org}/teams/{team_slug}"]
  },
  users: {
    addEmailForAuthenticated: [
      "POST /user/emails",
      {},
      { renamed: ["users", "addEmailForAuthenticatedUser"] }
    ],
    addEmailForAuthenticatedUser: ["POST /user/emails"],
    addSocialAccountForAuthenticatedUser: ["POST /user/social_accounts"],
    block: ["PUT /user/blocks/{username}"],
    checkBlocked: ["GET /user/blocks/{username}"],
    checkFollowingForUser: ["GET /users/{username}/following/{target_user}"],
    checkPersonIsFollowedByAuthenticated: ["GET /user/following/{username}"],
    createGpgKeyForAuthenticated: [
      "POST /user/gpg_keys",
      {},
      { renamed: ["users", "createGpgKeyForAuthenticatedUser"] }
    ],
    createGpgKeyForAuthenticatedUser: ["POST /user/gpg_keys"],
    createPublicSshKeyForAuthenticated: [
      "POST /user/keys",
      {},
      { renamed: ["users", "createPublicSshKeyForAuthenticatedUser"] }
    ],
    createPublicSshKeyForAuthenticatedUser: ["POST /user/keys"],
    createSshSigningKeyForAuthenticatedUser: ["POST /user/ssh_signing_keys"],
    deleteEmailForAuthenticated: [
      "DELETE /user/emails",
      {},
      { renamed: ["users", "deleteEmailForAuthenticatedUser"] }
    ],
    deleteEmailForAuthenticatedUser: ["DELETE /user/emails"],
    deleteGpgKeyForAuthenticated: [
      "DELETE /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "deleteGpgKeyForAuthenticatedUser"] }
    ],
    deleteGpgKeyForAuthenticatedUser: ["DELETE /user/gpg_keys/{gpg_key_id}"],
    deletePublicSshKeyForAuthenticated: [
      "DELETE /user/keys/{key_id}",
      {},
      { renamed: ["users", "deletePublicSshKeyForAuthenticatedUser"] }
    ],
    deletePublicSshKeyForAuthenticatedUser: ["DELETE /user/keys/{key_id}"],
    deleteSocialAccountForAuthenticatedUser: ["DELETE /user/social_accounts"],
    deleteSshSigningKeyForAuthenticatedUser: [
      "DELETE /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    follow: ["PUT /user/following/{username}"],
    getAuthenticated: ["GET /user"],
    getById: ["GET /user/{account_id}"],
    getByUsername: ["GET /users/{username}"],
    getContextForUser: ["GET /users/{username}/hovercard"],
    getGpgKeyForAuthenticated: [
      "GET /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "getGpgKeyForAuthenticatedUser"] }
    ],
    getGpgKeyForAuthenticatedUser: ["GET /user/gpg_keys/{gpg_key_id}"],
    getPublicSshKeyForAuthenticated: [
      "GET /user/keys/{key_id}",
      {},
      { renamed: ["users", "getPublicSshKeyForAuthenticatedUser"] }
    ],
    getPublicSshKeyForAuthenticatedUser: ["GET /user/keys/{key_id}"],
    getSshSigningKeyForAuthenticatedUser: [
      "GET /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    list: ["GET /users"],
    listAttestations: ["GET /users/{username}/attestations/{subject_digest}"],
    listBlockedByAuthenticated: [
      "GET /user/blocks",
      {},
      { renamed: ["users", "listBlockedByAuthenticatedUser"] }
    ],
    listBlockedByAuthenticatedUser: ["GET /user/blocks"],
    listEmailsForAuthenticated: [
      "GET /user/emails",
      {},
      { renamed: ["users", "listEmailsForAuthenticatedUser"] }
    ],
    listEmailsForAuthenticatedUser: ["GET /user/emails"],
    listFollowedByAuthenticated: [
      "GET /user/following",
      {},
      { renamed: ["users", "listFollowedByAuthenticatedUser"] }
    ],
    listFollowedByAuthenticatedUser: ["GET /user/following"],
    listFollowersForAuthenticatedUser: ["GET /user/followers"],
    listFollowersForUser: ["GET /users/{username}/followers"],
    listFollowingForUser: ["GET /users/{username}/following"],
    listGpgKeysForAuthenticated: [
      "GET /user/gpg_keys",
      {},
      { renamed: ["users", "listGpgKeysForAuthenticatedUser"] }
    ],
    listGpgKeysForAuthenticatedUser: ["GET /user/gpg_keys"],
    listGpgKeysForUser: ["GET /users/{username}/gpg_keys"],
    listPublicEmailsForAuthenticated: [
      "GET /user/public_emails",
      {},
      { renamed: ["users", "listPublicEmailsForAuthenticatedUser"] }
    ],
    listPublicEmailsForAuthenticatedUser: ["GET /user/public_emails"],
    listPublicKeysForUser: ["GET /users/{username}/keys"],
    listPublicSshKeysForAuthenticated: [
      "GET /user/keys",
      {},
      { renamed: ["users", "listPublicSshKeysForAuthenticatedUser"] }
    ],
    listPublicSshKeysForAuthenticatedUser: ["GET /user/keys"],
    listSocialAccountsForAuthenticatedUser: ["GET /user/social_accounts"],
    listSocialAccountsForUser: ["GET /users/{username}/social_accounts"],
    listSshSigningKeysForAuthenticatedUser: ["GET /user/ssh_signing_keys"],
    listSshSigningKeysForUser: ["GET /users/{username}/ssh_signing_keys"],
    setPrimaryEmailVisibilityForAuthenticated: [
      "PATCH /user/email/visibility",
      {},
      { renamed: ["users", "setPrimaryEmailVisibilityForAuthenticatedUser"] }
    ],
    setPrimaryEmailVisibilityForAuthenticatedUser: [
      "PATCH /user/email/visibility"
    ],
    unblock: ["DELETE /user/blocks/{username}"],
    unfollow: ["DELETE /user/following/{username}"],
    updateAuthenticated: ["PATCH /user"]
  }
};
var endpoints_default = Endpoints;

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/endpoints-to-methods.js
var endpointMethodsMap = /* @__PURE__ */ new Map;
for (const [scope, endpoints] of Object.entries(endpoints_default)) {
  for (const [methodName, endpoint2] of Object.entries(endpoints)) {
    const [route, defaults, decorations] = endpoint2;
    const [method, url] = route.split(/ /);
    const endpointDefaults = Object.assign({
      method,
      url
    }, defaults);
    if (!endpointMethodsMap.has(scope)) {
      endpointMethodsMap.set(scope, /* @__PURE__ */ new Map);
    }
    endpointMethodsMap.get(scope).set(methodName, {
      scope,
      methodName,
      endpointDefaults,
      decorations
    });
  }
}
var handler = {
  has({ scope }, methodName) {
    return endpointMethodsMap.get(scope).has(methodName);
  },
  getOwnPropertyDescriptor(target, methodName) {
    return {
      value: this.get(target, methodName),
      configurable: true,
      writable: true,
      enumerable: true
    };
  },
  defineProperty(target, methodName, descriptor) {
    Object.defineProperty(target.cache, methodName, descriptor);
    return true;
  },
  deleteProperty(target, methodName) {
    delete target.cache[methodName];
    return true;
  },
  ownKeys({ scope }) {
    return [...endpointMethodsMap.get(scope).keys()];
  },
  set(target, methodName, value) {
    return target.cache[methodName] = value;
  },
  get({ octokit, scope, cache }, methodName) {
    if (cache[methodName]) {
      return cache[methodName];
    }
    const method = endpointMethodsMap.get(scope).get(methodName);
    if (!method) {
      return;
    }
    const { endpointDefaults, decorations } = method;
    if (decorations) {
      cache[methodName] = decorate(octokit, scope, methodName, endpointDefaults, decorations);
    } else {
      cache[methodName] = octokit.request.defaults(endpointDefaults);
    }
    return cache[methodName];
  }
};
function endpointsToMethods(octokit) {
  const newMethods = {};
  for (const scope of endpointMethodsMap.keys()) {
    newMethods[scope] = new Proxy({ octokit, scope, cache: {} }, handler);
  }
  return newMethods;
}
function decorate(octokit, scope, methodName, defaults, decorations) {
  const requestWithDefaults = octokit.request.defaults(defaults);
  function withDecorations(...args) {
    let options = requestWithDefaults.endpoint.merge(...args);
    if (decorations.mapToData) {
      options = Object.assign({}, options, {
        data: options[decorations.mapToData],
        [decorations.mapToData]: undefined
      });
      return requestWithDefaults(options);
    }
    if (decorations.renamed) {
      const [newScope, newMethodName] = decorations.renamed;
      octokit.log.warn(`octokit.${scope}.${methodName}() has been renamed to octokit.${newScope}.${newMethodName}()`);
    }
    if (decorations.deprecated) {
      octokit.log.warn(decorations.deprecated);
    }
    if (decorations.renamedParameters) {
      const options2 = requestWithDefaults.endpoint.merge(...args);
      for (const [name, alias] of Object.entries(decorations.renamedParameters)) {
        if (name in options2) {
          octokit.log.warn(`"${name}" parameter is deprecated for "octokit.${scope}.${methodName}()". Use "${alias}" instead`);
          if (!(alias in options2)) {
            options2[alias] = options2[name];
          }
          delete options2[name];
        }
      }
      return requestWithDefaults(options2);
    }
    return requestWithDefaults(...args);
  }
  return Object.assign(withDecorations, requestWithDefaults);
}

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/index.js
function restEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    rest: api
  };
}
restEndpointMethods.VERSION = VERSION7;
function legacyRestEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    ...api,
    rest: api
  };
}
legacyRestEndpointMethods.VERSION = VERSION7;

// node_modules/@octokit/rest/dist-src/version.js
var VERSION8 = "21.1.1";

// node_modules/@octokit/rest/dist-src/index.js
var Octokit2 = Octokit.plugin(requestLog, legacyRestEndpointMethods, paginateRest).defaults({
  userAgent: `octokit-rest.js/${VERSION8}`
});

// src/github-service.ts
class GitHubService {
  octokit;
  settings;
  constructor(settings) {
    this.settings = settings;
    this.octokit = new Octokit2({
      auth: settings.githubToken
    });
  }
  async validateConnection() {
    try {
      await this.octokit.repos.get({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to access repository: ${error.message}. Check your token and repository settings.`);
      }
      throw error;
    }
  }
  async getFileSha(path, branch) {
    try {
      const params = {
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        path
      };
      if (branch) {
        params.ref = branch;
      }
      const response = await this.octokit.repos.getContent(params);
      if (Array.isArray(response.data)) {
        return null;
      }
      return "sha" in response.data ? response.data.sha : null;
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
  async createOrUpdateFile(path, content, message, branch) {
    const existingSha = await this.getFileSha(path, branch);
    try {
      const params = {
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        path,
        message,
        content: this.stringToBase64(content),
        sha: existingSha || undefined
      };
      if (branch) {
        params.branch = branch;
      }
      const response = await this.octokit.repos.createOrUpdateFileContents(params);
      return response.data.content?.html_url || "";
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload file ${path}: ${error.message}`);
      }
      throw error;
    }
  }
  async uploadImage(filename, content, branch) {
    const path = `${this.settings.imageDir}/${filename}`;
    const base64Content = this.arrayBufferToBase64(content);
    const existingSha = await this.getFileSha(path, branch);
    try {
      const params = {
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        path,
        message: `Upload image: ${filename}`,
        content: base64Content,
        sha: existingSha || undefined
      };
      if (branch) {
        params.branch = branch;
      }
      const response = await this.octokit.repos.createOrUpdateFileContents(params);
      return response.data.content?.html_url || "";
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload image ${filename}: ${error.message}`);
      }
      throw error;
    }
  }
  stringToBase64(str) {
    const encoder = new TextEncoder;
    const bytes = encoder.encode(str);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  getRepoUrl() {
    return `https://github.com/${this.settings.repoOwner}/${this.settings.repoName}`;
  }
  async getBranchSha(branch) {
    try {
      const response = await this.octokit.rest.git.getRef({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        ref: `heads/${branch}`
      });
      return response.data.object.sha;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get SHA for branch ${branch}: ${error.message}`);
      }
      throw error;
    }
  }
  async createBranch(branchName, baseBranch = "main") {
    try {
      const baseSha = await this.getBranchSha(baseBranch);
      await this.octokit.rest.git.createRef({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      });
      return branchName;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create branch ${branchName}: ${error.message}`);
      }
      throw error;
    }
  }
  async createPullRequest(head, base, title, body, labels) {
    try {
      const response = await this.octokit.rest.pulls.create({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        title,
        head,
        base,
        body
      });
      if (labels && labels.length > 0) {
        await this.octokit.rest.issues.addLabels({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          issue_number: response.data.number,
          labels
        });
      }
      return {
        url: response.data.html_url,
        number: response.data.number
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create pull request: ${error.message}`);
      }
      throw error;
    }
  }
  generateBranchName(prefix = "publish") {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    return `${prefix}/${timestamp}`;
  }
  async createBranchWithRetry(basePrefix, baseBranch = "main", maxRetries = 3) {
    for (let i = 0;i < maxRetries; i++) {
      const suffix = i > 0 ? `-${i}` : "";
      const branchName = this.generateBranchName(basePrefix) + suffix;
      try {
        await this.createBranch(branchName, baseBranch);
        return branchName;
      } catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 422) {
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed to create branch after ${maxRetries} attempts`);
  }
}

// src/publisher.ts
class Publisher {
  vault;
  settings;
  contentProcessor;
  githubService;
  constructor(vault, settings) {
    this.vault = vault;
    this.settings = settings;
    this.contentProcessor = new ContentProcessor(settings);
    this.githubService = new GitHubService(settings);
  }
  async publishNote(file) {
    try {
      const content = await this.vault.read(file);
      if (!this.hasPublishFlag(content)) {
        return {
          filePath: file.path,
          success: false,
          error: "File does not have 'publish: true' in frontmatter"
        };
      }
      const processed = this.contentProcessor.process(content, file.name);
      await this.uploadImages(processed.images);
      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const commitMessage = `Publish: ${file.basename}`;
      const url = await this.githubService.createOrUpdateFile(targetPath, processed.content, commitMessage);
      return {
        filePath: file.path,
        success: true,
        url
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        filePath: file.path,
        success: false,
        error: message
      };
    }
  }
  async publishAll() {
    const markdownFiles = this.vault.getMarkdownFiles();
    const results = [];
    new import_obsidian2.Notice("Scanning vault for publishable notes...");
    const publishableFiles = [];
    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        if (this.hasPublishFlag(content)) {
          publishableFiles.push(file);
        }
      } catch (error) {
        console.error(`Failed to read file ${file.path}:`, error);
      }
    }
    if (publishableFiles.length === 0) {
      new import_obsidian2.Notice("No files with 'publish: true' found");
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }
    new import_obsidian2.Notice(`Publishing ${publishableFiles.length} notes...`);
    for (const file of publishableFiles) {
      const result = await this.publishNote(file);
      results.push(result);
      const successCount = results.filter((r) => r.success).length;
      new import_obsidian2.Notice(`Progress: ${results.length}/${publishableFiles.length} (${successCount} successful)`);
    }
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return {
      total: results.length,
      successful,
      failed,
      results
    };
  }
  async publishNoteWithPR(file) {
    let branchName = null;
    try {
      const content = await this.vault.read(file);
      if (!this.hasPublishFlag(content)) {
        return {
          filePath: file.path,
          success: false,
          error: "File does not have 'publish: true' in frontmatter"
        };
      }
      branchName = await this.githubService.createBranchWithRetry("publish", this.settings.baseBranch || "main");
      const processed = this.contentProcessor.process(content, file.name);
      await this.uploadImages(processed.images, branchName);
      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const commitMessage = `Publish: ${file.basename}`;
      await this.githubService.createOrUpdateFile(targetPath, processed.content, commitMessage, branchName);
      const prTitle = `Publish: ${file.basename}`;
      const prBody = `Published from Obsidian

**File:** ${file.path}
**Images:** ${processed.images.length}`;
      const pr = await this.githubService.createPullRequest(branchName, this.settings.baseBranch || "main", prTitle, prBody, this.settings.prLabels || ["published-from-obsidian"]);
      return {
        filePath: file.path,
        success: true,
        prUrl: pr.url
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        filePath: file.path,
        success: false,
        error: message
      };
    }
  }
  async publishAllWithPR() {
    const markdownFiles = this.vault.getMarkdownFiles();
    const results = [];
    let branchName = null;
    new import_obsidian2.Notice("Scanning vault for publishable notes...");
    const publishableFiles = [];
    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        if (this.hasPublishFlag(content)) {
          publishableFiles.push(file);
        }
      } catch (error) {
        console.error(`Failed to read file ${file.path}:`, error);
      }
    }
    if (publishableFiles.length === 0) {
      new import_obsidian2.Notice("No files with 'publish: true' found");
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }
    new import_obsidian2.Notice(`Publishing ${publishableFiles.length} notes to branch...`);
    try {
      branchName = await this.githubService.createBranchWithRetry("publish-batch", this.settings.baseBranch || "main");
      for (const file of publishableFiles) {
        try {
          const content = await this.vault.read(file);
          const processed = this.contentProcessor.process(content, file.name);
          await this.uploadImages(processed.images, branchName);
          const targetPath = `${this.settings.contentDir}/${processed.filename}`;
          const commitMessage = `Publish: ${file.basename}`;
          await this.githubService.createOrUpdateFile(targetPath, processed.content, commitMessage, branchName);
          results.push({
            filePath: file.path,
            success: true
          });
          new import_obsidian2.Notice(`Progress: ${results.length}/${publishableFiles.length}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          results.push({
            filePath: file.path,
            success: false,
            error: message
          });
        }
      }
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const prTitle = `Batch Publish: ${successful} notes`;
      const fileList = results.filter((r) => r.success).map((r) => `- ${r.filePath}`).join(`
`);
      const prBody = `Published ${successful} notes from Obsidian

${fileList}`;
      const pr = await this.githubService.createPullRequest(branchName, this.settings.baseBranch || "main", prTitle, prBody, this.settings.prLabels || ["published-from-obsidian"]);
      return {
        total: results.length,
        successful,
        failed,
        results,
        prUrl: pr.url
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new import_obsidian2.Notice(`Failed to publish: ${message}`);
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      return {
        total: results.length,
        successful,
        failed,
        results
      };
    }
  }
  async uploadImages(imageNames, branch) {
    for (const imageName of imageNames) {
      try {
        const imageFile = this.vault.getFiles().find((f) => f.name === imageName);
        if (!imageFile) {
          console.warn(`Image not found in vault: ${imageName}`);
          continue;
        }
        const imageContent = await this.vault.readBinary(imageFile);
        const sanitizedName = this.contentProcessor.sanitizeImageName(imageName);
        await this.githubService.uploadImage(sanitizedName, imageContent, branch);
      } catch (error) {
        console.error(`Failed to upload image ${imageName}:`, error);
      }
    }
  }
  hasPublishFlag(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) {
      return false;
    }
    const frontmatter = match[1];
    return /^publish:\s*true\s*$/m.test(frontmatter);
  }
  validateSettings() {
    if (!this.settings.githubToken) {
      return "GitHub token is not configured";
    }
    if (!this.settings.repoOwner || !this.settings.repoName) {
      return "Repository owner and name must be configured";
    }
    if (!this.settings.contentDir) {
      return "Content directory must be configured";
    }
    if (!this.settings.imageDir) {
      return "Image directory must be configured";
    }
    return null;
  }
}

// src/settings.ts
var import_obsidian3 = require("obsidian");
class PublisherSettingTab extends import_obsidian3.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Obsidian Publisher Settings" });
    new import_obsidian3.Setting(containerEl).setName("GitHub Personal Access Token").setDesc("Create a token at github.com/settings/tokens with 'repo' scope. Token is stored securely.").addText((text) => text.setPlaceholder("ghp_xxxxxxxxxxxx").setValue(this.plugin.settings.githubToken).onChange(async (value) => {
      this.plugin.settings.githubToken = value;
      await this.plugin.saveSettings();
    }).inputEl.setAttribute("type", "password"));
    new import_obsidian3.Setting(containerEl).setName("Repository Owner").setDesc("GitHub username or organization name").addText((text) => text.setPlaceholder("username").setValue(this.plugin.settings.repoOwner).onChange(async (value) => {
      this.plugin.settings.repoOwner = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Repository Name").setDesc("Name of the Hugo repository").addText((text) => text.setPlaceholder("my-blog").setValue(this.plugin.settings.repoName).onChange(async (value) => {
      this.plugin.settings.repoName = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Content Directory").setDesc("Path to Hugo content directory (e.g., 'content/posts')").addText((text) => text.setPlaceholder("content/posts").setValue(this.plugin.settings.contentDir).onChange(async (value) => {
      this.plugin.settings.contentDir = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Image Directory").setDesc("Path to Hugo static images directory (e.g., 'static/images')").addText((text) => text.setPlaceholder("static/images").setValue(this.plugin.settings.imageDir).onChange(async (value) => {
      this.plugin.settings.imageDir = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Use Pull Requests").setDesc("Create pull requests instead of committing directly to the base branch").addToggle((toggle) => toggle.setValue(this.plugin.settings.usePullRequests).onChange(async (value) => {
      this.plugin.settings.usePullRequests = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Base Branch").setDesc("Branch to create pull requests against (e.g., 'main', 'master')").addText((text) => text.setPlaceholder("main").setValue(this.plugin.settings.baseBranch).onChange(async (value) => {
      this.plugin.settings.baseBranch = value.trim() || "main";
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Pull Request Labels").setDesc("Comma-separated labels to add to pull requests").addText((text) => text.setPlaceholder("published-from-obsidian").setValue(this.plugin.settings.prLabels.join(", ")).onChange(async (value) => {
      this.plugin.settings.prLabels = value.split(",").map((l) => l.trim()).filter((l) => l.length > 0);
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Remove 'publish' field").setDesc("Remove 'publish: true' from frontmatter when publishing").addToggle((toggle) => toggle.setValue(this.plugin.settings.removePublishFlag).onChange(async (value) => {
      this.plugin.settings.removePublishFlag = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Additional Frontmatter" });
    containerEl.createEl("p", {
      text: "Add custom frontmatter fields (one per line, format: key: value)",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).addTextArea((text) => {
      text.setPlaceholder(`author: Your Name
categories: [blog]
tags: [obsidian]`).setValue(this.serializeFrontmatter(this.plugin.settings.frontmatterTemplate)).onChange(async (value) => {
        this.plugin.settings.frontmatterTemplate = this.parseFrontmatter(value);
        await this.plugin.saveSettings();
      });
      text.inputEl.rows = 6;
      text.inputEl.cols = 50;
    });
    new import_obsidian3.Setting(containerEl).setName("Test GitHub Connection").setDesc("Verify that your GitHub credentials and repository are valid").addButton((button) => button.setButtonText("Test Connection").onClick(async () => {
      await this.testConnection();
    }));
  }
  serializeFrontmatter(template) {
    return Object.entries(template).map(([key, value]) => `${key}: ${value}`).join(`
`);
  }
  parseFrontmatter(text) {
    const result = {};
    const lines = text.split(`
`);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1)
        continue;
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      if (key && value) {
        result[key] = value;
      }
    }
    return result;
  }
  async testConnection() {
    const settings = this.plugin.settings;
    if (!settings.githubToken) {
      new import_obsidian3.Notice("GitHub token is required");
      return;
    }
    if (!settings.repoOwner || !settings.repoName) {
      new import_obsidian3.Notice("Repository owner and name are required");
      return;
    }
    try {
      new import_obsidian3.Notice("Testing GitHub connection...");
      const github = new GitHubService(settings);
      await github.validateConnection();
      new import_obsidian3.Notice("✓ Connection successful! Repository is accessible.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new import_obsidian3.Notice(`✗ Connection failed: ${message}`);
      console.error("GitHub connection test failed:", error);
    }
  }
}

// src/types.ts
var DEFAULT_SETTINGS = {
  githubToken: "",
  repoOwner: "",
  repoName: "",
  contentDir: "content/posts",
  imageDir: "static/images",
  frontmatterTemplate: {},
  removePublishFlag: false,
  baseBranch: "main",
  prLabels: ["published-from-obsidian"],
  usePullRequests: true
};

// src/main.ts
class ObsidianPublisher extends import_obsidian4.Plugin {
  settings;
  publisher;
  async onload() {
    await this.loadSettings();
    this.publisher = new Publisher(this.app.vault, this.settings);
    this.addSettingTab(new PublisherSettingTab(this.app, this));
    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note to GitHub",
      editorCallback: async (_editor, view) => {
        const file = view.file;
        if (!file) {
          new import_obsidian4.Notice("No active file");
          return;
        }
        await this.publishCurrentNote(file);
      }
    });
    this.addCommand({
      id: "publish-all-notes",
      name: "Publish all notes to GitHub",
      callback: async () => {
        await this.publishAllNotes();
      }
    });
    console.log("Obsidian Publisher plugin loaded");
  }
  onunload() {
    console.log("Obsidian Publisher plugin unloaded");
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    if (data && data.usePullRequests === undefined) {
      this.settings.usePullRequests = false;
      await this.saveSettings();
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.publisher = new Publisher(this.app.vault, this.settings);
  }
  async publishCurrentNote(file) {
    const validationError = this.publisher.validateSettings();
    if (validationError) {
      new import_obsidian4.Notice(`Cannot publish: ${validationError}`);
      return;
    }
    new import_obsidian4.Notice(`Publishing ${file.basename}...`);
    try {
      let result;
      if (this.settings.usePullRequests) {
        result = await this.publisher.publishNoteWithPR(file);
        if (result.success && result.prUrl) {
          new import_obsidian4.Notice(`✓ Pull request created for ${file.basename}`);
          console.log(`Pull Request: ${result.prUrl}`);
        } else {
          new import_obsidian4.Notice(`✗ Failed to publish: ${result.error}`);
        }
      } else {
        result = await this.publisher.publishNote(file);
        if (result.success) {
          new import_obsidian4.Notice(`✓ Successfully published ${file.basename}`);
          if (result.url) {
            console.log(`Published to: ${result.url}`);
          }
        } else {
          new import_obsidian4.Notice(`✗ Failed to publish: ${result.error}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new import_obsidian4.Notice(`✗ Error: ${message}`);
      console.error("Publish error:", error);
    }
  }
  async publishAllNotes() {
    const validationError = this.publisher.validateSettings();
    if (validationError) {
      new import_obsidian4.Notice(`Cannot publish: ${validationError}`);
      return;
    }
    try {
      let result;
      if (this.settings.usePullRequests) {
        result = await this.publisher.publishAllWithPR();
        if (result.total === 0) {
          new import_obsidian4.Notice("No publishable notes found");
          return;
        }
        const summary = `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed`;
        new import_obsidian4.Notice(summary);
        if (result.prUrl) {
          new import_obsidian4.Notice(`✓ Pull request created: ${result.prUrl}`);
          console.log(`Pull Request: ${result.prUrl}`);
        }
      } else {
        result = await this.publisher.publishAll();
        if (result.total === 0) {
          new import_obsidian4.Notice("No publishable notes found");
          return;
        }
        const summary = `Publishing complete: ${result.successful} succeeded, ${result.failed} failed out of ${result.total} total`;
        new import_obsidian4.Notice(summary);
      }
      if (result.failed > 0) {
        console.log("Failed publishes:");
        for (const r of result.results) {
          if (!r.success) {
            console.log(`  ${r.filePath}: ${r.error}`);
          }
        }
      }
      if (result.successful > 0) {
        console.log("Successful publishes:");
        for (const r of result.results) {
          if (r.success) {
            console.log(`  ${r.filePath}: ${r.url || "no url"}`);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new import_obsidian4.Notice(`✗ Error: ${message}`);
      console.error("Batch publish error:", error);
    }
  }
}

//# debugId=A6994C87D8E6CD4964756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzL2Zhc3QtY29udGVudC10eXBlLXBhcnNlL2luZGV4LmpzIiwgInNyYy9tYWluLnRzIiwgInNyYy9wdWJsaXNoZXIudHMiLCAic3JjL2NvbnRlbnQtcHJvY2Vzc29yLnRzIiwgIm5vZGVfbW9kdWxlcy91bml2ZXJzYWwtdXNlci1hZ2VudC9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvYmVmb3JlLWFmdGVyLWhvb2svbGliL3JlZ2lzdGVyLmpzIiwgIm5vZGVfbW9kdWxlcy9iZWZvcmUtYWZ0ZXItaG9vay9saWIvYWRkLmpzIiwgIm5vZGVfbW9kdWxlcy9iZWZvcmUtYWZ0ZXItaG9vay9saWIvcmVtb3ZlLmpzIiwgIm5vZGVfbW9kdWxlcy9iZWZvcmUtYWZ0ZXItaG9vay9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQG9jdG9raXQvZW5kcG9pbnQvZGlzdC1idW5kbGUvaW5kZXguanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L3JlcXVlc3QvZGlzdC1idW5kbGUvaW5kZXguanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L3JlcXVlc3QtZXJyb3IvZGlzdC1zcmMvaW5kZXguanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L2dyYXBocWwvZGlzdC1idW5kbGUvaW5kZXguanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L2F1dGgtdG9rZW4vZGlzdC1idW5kbGUvaW5kZXguanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L2NvcmUvZGlzdC1zcmMvdmVyc2lvbi5qcyIsICJub2RlX21vZHVsZXMvQG9jdG9raXQvY29yZS9kaXN0LXNyYy9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQG9jdG9raXQvcGx1Z2luLXJlcXVlc3QtbG9nL2Rpc3Qtc3JjL3ZlcnNpb24uanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L3BsdWdpbi1yZXF1ZXN0LWxvZy9kaXN0LXNyYy9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQG9jdG9raXQvcGx1Z2luLXBhZ2luYXRlLXJlc3QvZGlzdC1idW5kbGUvaW5kZXguanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L3BsdWdpbi1yZXN0LWVuZHBvaW50LW1ldGhvZHMvZGlzdC1zcmMvdmVyc2lvbi5qcyIsICJub2RlX21vZHVsZXMvQG9jdG9raXQvcGx1Z2luLXJlc3QtZW5kcG9pbnQtbWV0aG9kcy9kaXN0LXNyYy9nZW5lcmF0ZWQvZW5kcG9pbnRzLmpzIiwgIm5vZGVfbW9kdWxlcy9Ab2N0b2tpdC9wbHVnaW4tcmVzdC1lbmRwb2ludC1tZXRob2RzL2Rpc3Qtc3JjL2VuZHBvaW50cy10by1tZXRob2RzLmpzIiwgIm5vZGVfbW9kdWxlcy9Ab2N0b2tpdC9wbHVnaW4tcmVzdC1lbmRwb2ludC1tZXRob2RzL2Rpc3Qtc3JjL2luZGV4LmpzIiwgIm5vZGVfbW9kdWxlcy9Ab2N0b2tpdC9yZXN0L2Rpc3Qtc3JjL3ZlcnNpb24uanMiLCAibm9kZV9tb2R1bGVzL0BvY3Rva2l0L3Jlc3QvZGlzdC1zcmMvaW5kZXguanMiLCAic3JjL2dpdGh1Yi1zZXJ2aWNlLnRzIiwgInNyYy9zZXR0aW5ncy50cyIsICJzcmMvdHlwZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IE51bGxPYmplY3QgPSBmdW5jdGlvbiBOdWxsT2JqZWN0ICgpIHsgfVxuTnVsbE9iamVjdC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKG51bGwpXG5cbi8qKlxuICogUmVnRXhwIHRvIG1hdGNoICooIFwiO1wiIHBhcmFtZXRlciApIGluIFJGQyA3MjMxIHNlYyAzLjEuMS4xXG4gKlxuICogcGFyYW1ldGVyICAgICA9IHRva2VuIFwiPVwiICggdG9rZW4gLyBxdW90ZWQtc3RyaW5nIClcbiAqIHRva2VuICAgICAgICAgPSAxKnRjaGFyXG4gKiB0Y2hhciAgICAgICAgID0gXCIhXCIgLyBcIiNcIiAvIFwiJFwiIC8gXCIlXCIgLyBcIiZcIiAvIFwiJ1wiIC8gXCIqXCJcbiAqICAgICAgICAgICAgICAgLyBcIitcIiAvIFwiLVwiIC8gXCIuXCIgLyBcIl5cIiAvIFwiX1wiIC8gXCJgXCIgLyBcInxcIiAvIFwiflwiXG4gKiAgICAgICAgICAgICAgIC8gRElHSVQgLyBBTFBIQVxuICogICAgICAgICAgICAgICA7IGFueSBWQ0hBUiwgZXhjZXB0IGRlbGltaXRlcnNcbiAqIHF1b3RlZC1zdHJpbmcgPSBEUVVPVEUgKiggcWR0ZXh0IC8gcXVvdGVkLXBhaXIgKSBEUVVPVEVcbiAqIHFkdGV4dCAgICAgICAgPSBIVEFCIC8gU1AgLyAleDIxIC8gJXgyMy01QiAvICV4NUQtN0UgLyBvYnMtdGV4dFxuICogb2JzLXRleHQgICAgICA9ICV4ODAtRkZcbiAqIHF1b3RlZC1wYWlyICAgPSBcIlxcXCIgKCBIVEFCIC8gU1AgLyBWQ0hBUiAvIG9icy10ZXh0IClcbiAqL1xuY29uc3QgcGFyYW1SRSA9IC87ICooWyEjJCUmJyorLl5cXHdgfH4tXSspPShcIig/OltcXHZcXHUwMDIwXFx1MDAyMVxcdTAwMjMtXFx1MDA1YlxcdTAwNWQtXFx1MDA3ZVxcdTAwODAtXFx1MDBmZl18XFxcXFtcXHZcXHUwMDIwLVxcdTAwZmZdKSpcInxbISMkJSYnKisuXlxcd2B8fi1dKykgKi9ndVxuXG4vKipcbiAqIFJlZ0V4cCB0byBtYXRjaCBxdW90ZWQtcGFpciBpbiBSRkMgNzIzMCBzZWMgMy4yLjZcbiAqXG4gKiBxdW90ZWQtcGFpciA9IFwiXFxcIiAoIEhUQUIgLyBTUCAvIFZDSEFSIC8gb2JzLXRleHQgKVxuICogb2JzLXRleHQgICAgPSAleDgwLUZGXG4gKi9cbmNvbnN0IHF1b3RlZFBhaXJSRSA9IC9cXFxcKFtcXHZcXHUwMDIwLVxcdTAwZmZdKS9ndVxuXG4vKipcbiAqIFJlZ0V4cCB0byBtYXRjaCB0eXBlIGluIFJGQyA3MjMxIHNlYyAzLjEuMS4xXG4gKlxuICogbWVkaWEtdHlwZSA9IHR5cGUgXCIvXCIgc3VidHlwZVxuICogdHlwZSAgICAgICA9IHRva2VuXG4gKiBzdWJ0eXBlICAgID0gdG9rZW5cbiAqL1xuY29uc3QgbWVkaWFUeXBlUkUgPSAvXlshIyQlJicqKy5eXFx3fH4tXStcXC9bISMkJSYnKisuXlxcd3x+LV0rJC91XG5cbi8vIGRlZmF1bHQgQ29udGVudFR5cGUgdG8gcHJldmVudCByZXBlYXRlZCBvYmplY3QgY3JlYXRpb25cbmNvbnN0IGRlZmF1bHRDb250ZW50VHlwZSA9IHsgdHlwZTogJycsIHBhcmFtZXRlcnM6IG5ldyBOdWxsT2JqZWN0KCkgfVxuT2JqZWN0LmZyZWV6ZShkZWZhdWx0Q29udGVudFR5cGUucGFyYW1ldGVycylcbk9iamVjdC5mcmVlemUoZGVmYXVsdENvbnRlbnRUeXBlKVxuXG4vKipcbiAqIFBhcnNlIG1lZGlhIHR5cGUgdG8gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gaGVhZGVyXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKiBAcHVibGljXG4gKi9cblxuZnVuY3Rpb24gcGFyc2UgKGhlYWRlcikge1xuICBpZiAodHlwZW9mIGhlYWRlciAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdhcmd1bWVudCBoZWFkZXIgaXMgcmVxdWlyZWQgYW5kIG11c3QgYmUgYSBzdHJpbmcnKVxuICB9XG5cbiAgbGV0IGluZGV4ID0gaGVhZGVyLmluZGV4T2YoJzsnKVxuICBjb25zdCB0eXBlID0gaW5kZXggIT09IC0xXG4gICAgPyBoZWFkZXIuc2xpY2UoMCwgaW5kZXgpLnRyaW0oKVxuICAgIDogaGVhZGVyLnRyaW0oKVxuXG4gIGlmIChtZWRpYVR5cGVSRS50ZXN0KHR5cGUpID09PSBmYWxzZSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludmFsaWQgbWVkaWEgdHlwZScpXG4gIH1cblxuICBjb25zdCByZXN1bHQgPSB7XG4gICAgdHlwZTogdHlwZS50b0xvd2VyQ2FzZSgpLFxuICAgIHBhcmFtZXRlcnM6IG5ldyBOdWxsT2JqZWN0KClcbiAgfVxuXG4gIC8vIHBhcnNlIHBhcmFtZXRlcnNcbiAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgIHJldHVybiByZXN1bHRcbiAgfVxuXG4gIGxldCBrZXlcbiAgbGV0IG1hdGNoXG4gIGxldCB2YWx1ZVxuXG4gIHBhcmFtUkUubGFzdEluZGV4ID0gaW5kZXhcblxuICB3aGlsZSAoKG1hdGNoID0gcGFyYW1SRS5leGVjKGhlYWRlcikpKSB7XG4gICAgaWYgKG1hdGNoLmluZGV4ICE9PSBpbmRleCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignaW52YWxpZCBwYXJhbWV0ZXIgZm9ybWF0JylcbiAgICB9XG5cbiAgICBpbmRleCArPSBtYXRjaFswXS5sZW5ndGhcbiAgICBrZXkgPSBtYXRjaFsxXS50b0xvd2VyQ2FzZSgpXG4gICAgdmFsdWUgPSBtYXRjaFsyXVxuXG4gICAgaWYgKHZhbHVlWzBdID09PSAnXCInKSB7XG4gICAgICAvLyByZW1vdmUgcXVvdGVzIGFuZCBlc2NhcGVzXG4gICAgICB2YWx1ZSA9IHZhbHVlXG4gICAgICAgIC5zbGljZSgxLCB2YWx1ZS5sZW5ndGggLSAxKVxuXG4gICAgICBxdW90ZWRQYWlyUkUudGVzdCh2YWx1ZSkgJiYgKHZhbHVlID0gdmFsdWUucmVwbGFjZShxdW90ZWRQYWlyUkUsICckMScpKVxuICAgIH1cblxuICAgIHJlc3VsdC5wYXJhbWV0ZXJzW2tleV0gPSB2YWx1ZVxuICB9XG5cbiAgaWYgKGluZGV4ICE9PSBoZWFkZXIubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignaW52YWxpZCBwYXJhbWV0ZXIgZm9ybWF0JylcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gc2FmZVBhcnNlIChoZWFkZXIpIHtcbiAgaWYgKHR5cGVvZiBoZWFkZXIgIT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRDb250ZW50VHlwZVxuICB9XG5cbiAgbGV0IGluZGV4ID0gaGVhZGVyLmluZGV4T2YoJzsnKVxuICBjb25zdCB0eXBlID0gaW5kZXggIT09IC0xXG4gICAgPyBoZWFkZXIuc2xpY2UoMCwgaW5kZXgpLnRyaW0oKVxuICAgIDogaGVhZGVyLnRyaW0oKVxuXG4gIGlmIChtZWRpYVR5cGVSRS50ZXN0KHR5cGUpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBkZWZhdWx0Q29udGVudFR5cGVcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IHtcbiAgICB0eXBlOiB0eXBlLnRvTG93ZXJDYXNlKCksXG4gICAgcGFyYW1ldGVyczogbmV3IE51bGxPYmplY3QoKVxuICB9XG5cbiAgLy8gcGFyc2UgcGFyYW1ldGVyc1xuICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgbGV0IGtleVxuICBsZXQgbWF0Y2hcbiAgbGV0IHZhbHVlXG5cbiAgcGFyYW1SRS5sYXN0SW5kZXggPSBpbmRleFxuXG4gIHdoaWxlICgobWF0Y2ggPSBwYXJhbVJFLmV4ZWMoaGVhZGVyKSkpIHtcbiAgICBpZiAobWF0Y2guaW5kZXggIT09IGluZGV4KSB7XG4gICAgICByZXR1cm4gZGVmYXVsdENvbnRlbnRUeXBlXG4gICAgfVxuXG4gICAgaW5kZXggKz0gbWF0Y2hbMF0ubGVuZ3RoXG4gICAga2V5ID0gbWF0Y2hbMV0udG9Mb3dlckNhc2UoKVxuICAgIHZhbHVlID0gbWF0Y2hbMl1cblxuICAgIGlmICh2YWx1ZVswXSA9PT0gJ1wiJykge1xuICAgICAgLy8gcmVtb3ZlIHF1b3RlcyBhbmQgZXNjYXBlc1xuICAgICAgdmFsdWUgPSB2YWx1ZVxuICAgICAgICAuc2xpY2UoMSwgdmFsdWUubGVuZ3RoIC0gMSlcblxuICAgICAgcXVvdGVkUGFpclJFLnRlc3QodmFsdWUpICYmICh2YWx1ZSA9IHZhbHVlLnJlcGxhY2UocXVvdGVkUGFpclJFLCAnJDEnKSlcbiAgICB9XG5cbiAgICByZXN1bHQucGFyYW1ldGVyc1trZXldID0gdmFsdWVcbiAgfVxuXG4gIGlmIChpbmRleCAhPT0gaGVhZGVyLmxlbmd0aCkge1xuICAgIHJldHVybiBkZWZhdWx0Q29udGVudFR5cGVcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IHsgcGFyc2UsIHNhZmVQYXJzZSB9XG5tb2R1bGUuZXhwb3J0cy5wYXJzZSA9IHBhcnNlXG5tb2R1bGUuZXhwb3J0cy5zYWZlUGFyc2UgPSBzYWZlUGFyc2Vcbm1vZHVsZS5leHBvcnRzLmRlZmF1bHRDb250ZW50VHlwZSA9IGRlZmF1bHRDb250ZW50VHlwZVxuIiwKICAgICJpbXBvcnQgeyBOb3RpY2UsIFBsdWdpbiwgdHlwZSBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgUHVibGlzaGVyIH0gZnJvbSBcIi4vcHVibGlzaGVyXCI7XG5pbXBvcnQgeyBQdWJsaXNoZXJTZXR0aW5nVGFiIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcbmltcG9ydCB7XG4gIHR5cGUgQmF0Y2hQdWJsaXNoUmVzdWx0LFxuICBERUZBVUxUX1NFVFRJTkdTLFxuICB0eXBlIFB1Ymxpc2hSZXN1bHQsXG4gIHR5cGUgUHVibGlzaGVyU2V0dGluZ3MsXG59IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9ic2lkaWFuUHVibGlzaGVyIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3MhOiBQdWJsaXNoZXJTZXR0aW5ncztcbiAgcHJpdmF0ZSBwdWJsaXNoZXIhOiBQdWJsaXNoZXI7XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cbiAgICAvLyBJbml0aWFsaXplIHB1Ymxpc2hlclxuICAgIHRoaXMucHVibGlzaGVyID0gbmV3IFB1Ymxpc2hlcih0aGlzLmFwcC52YXVsdCwgdGhpcy5zZXR0aW5ncyk7XG5cbiAgICAvLyBSZWdpc3RlciBzZXR0aW5ncyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFB1Ymxpc2hlclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFJlZ2lzdGVyIGNvbW1hbmRzXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInB1Ymxpc2gtY3VycmVudC1ub3RlXCIsXG4gICAgICBuYW1lOiBcIlB1Ymxpc2ggY3VycmVudCBub3RlIHRvIEdpdEh1YlwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChfZWRpdG9yLCB2aWV3KSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB2aWV3LmZpbGU7XG4gICAgICAgIGlmICghZmlsZSkge1xuICAgICAgICAgIG5ldyBOb3RpY2UoXCJObyBhY3RpdmUgZmlsZVwiKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnB1Ymxpc2hDdXJyZW50Tm90ZShmaWxlKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwicHVibGlzaC1hbGwtbm90ZXNcIixcbiAgICAgIG5hbWU6IFwiUHVibGlzaCBhbGwgbm90ZXMgdG8gR2l0SHViXCIsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLnB1Ymxpc2hBbGxOb3RlcygpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKFwiT2JzaWRpYW4gUHVibGlzaGVyIHBsdWdpbiBsb2FkZWRcIik7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZyhcIk9ic2lkaWFuIFB1Ymxpc2hlciBwbHVnaW4gdW5sb2FkZWRcIik7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgZGF0YSk7XG5cbiAgICAvLyBNaWdyYXRpb246IGZvciBleGlzdGluZyB1c2VycywgZGVmYXVsdCB0byBmYWxzZSB0byBwcmVzZXJ2ZSBjdXJyZW50IGJlaGF2aW9yXG4gICAgaWYgKGRhdGEgJiYgZGF0YS51c2VQdWxsUmVxdWVzdHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXR0aW5ncy51c2VQdWxsUmVxdWVzdHMgPSBmYWxzZTtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gICAgLy8gUmVpbml0aWFsaXplIHB1Ymxpc2hlciB3aXRoIG5ldyBzZXR0aW5nc1xuICAgIHRoaXMucHVibGlzaGVyID0gbmV3IFB1Ymxpc2hlcih0aGlzLmFwcC52YXVsdCwgdGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICAvKipcbiAgICogUHVibGlzaCB0aGUgY3VycmVudCBub3RlXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHB1Ymxpc2hDdXJyZW50Tm90ZShmaWxlOiBURmlsZSkge1xuICAgIC8vIFZhbGlkYXRlIHNldHRpbmdzXG4gICAgY29uc3QgdmFsaWRhdGlvbkVycm9yID0gdGhpcy5wdWJsaXNoZXIudmFsaWRhdGVTZXR0aW5ncygpO1xuICAgIGlmICh2YWxpZGF0aW9uRXJyb3IpIHtcbiAgICAgIG5ldyBOb3RpY2UoYENhbm5vdCBwdWJsaXNoOiAke3ZhbGlkYXRpb25FcnJvcn1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBuZXcgTm90aWNlKGBQdWJsaXNoaW5nICR7ZmlsZS5iYXNlbmFtZX0uLi5gKTtcblxuICAgIHRyeSB7XG4gICAgICBsZXQgcmVzdWx0OiBQdWJsaXNoUmVzdWx0ICYgeyBwclVybD86IHN0cmluZyB9O1xuXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy51c2VQdWxsUmVxdWVzdHMpIHtcbiAgICAgICAgLy8gVXNlIFBSIHdvcmtmbG93XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMucHVibGlzaGVyLnB1Ymxpc2hOb3RlV2l0aFBSKGZpbGUpO1xuXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQucHJVcmwpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGDinJMgUHVsbCByZXF1ZXN0IGNyZWF0ZWQgZm9yICR7ZmlsZS5iYXNlbmFtZX1gKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgUHVsbCBSZXF1ZXN0OiAke3Jlc3VsdC5wclVybH1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGDinJcgRmFpbGVkIHRvIHB1Ymxpc2g6ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGYWxsYmFjayB0byBkaXJlY3QgY29tbWl0IHdvcmtmbG93XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMucHVibGlzaGVyLnB1Ymxpc2hOb3RlKGZpbGUpO1xuXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgIG5ldyBOb3RpY2UoYOKckyBTdWNjZXNzZnVsbHkgcHVibGlzaGVkICR7ZmlsZS5iYXNlbmFtZX1gKTtcbiAgICAgICAgICBpZiAocmVzdWx0LnVybCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFB1Ymxpc2hlZCB0bzogJHtyZXN1bHQudXJsfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGDinJcgRmFpbGVkIHRvIHB1Ymxpc2g6ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiVW5rbm93biBlcnJvclwiO1xuICAgICAgbmV3IE5vdGljZShg4pyXIEVycm9yOiAke21lc3NhZ2V9YCk7XG4gICAgICBjb25zb2xlLmVycm9yKFwiUHVibGlzaCBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQdWJsaXNoIGFsbCBub3RlcyB3aXRoIHB1Ymxpc2g6IHRydWVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcHVibGlzaEFsbE5vdGVzKCkge1xuICAgIC8vIFZhbGlkYXRlIHNldHRpbmdzXG4gICAgY29uc3QgdmFsaWRhdGlvbkVycm9yID0gdGhpcy5wdWJsaXNoZXIudmFsaWRhdGVTZXR0aW5ncygpO1xuICAgIGlmICh2YWxpZGF0aW9uRXJyb3IpIHtcbiAgICAgIG5ldyBOb3RpY2UoYENhbm5vdCBwdWJsaXNoOiAke3ZhbGlkYXRpb25FcnJvcn1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgbGV0IHJlc3VsdDogQmF0Y2hQdWJsaXNoUmVzdWx0ICYgeyBwclVybD86IHN0cmluZyB9O1xuXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy51c2VQdWxsUmVxdWVzdHMpIHtcbiAgICAgICAgLy8gVXNlIFBSIHdvcmtmbG93XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMucHVibGlzaGVyLnB1Ymxpc2hBbGxXaXRoUFIoKTtcblxuICAgICAgICBpZiAocmVzdWx0LnRvdGFsID09PSAwKSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk5vIHB1Ymxpc2hhYmxlIG5vdGVzIGZvdW5kXCIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1bW1hcnkgPSBgQmF0Y2ggcHVibGlzaCBjb21wbGV0ZTogJHtyZXN1bHQuc3VjY2Vzc2Z1bH0gc3VjY2VlZGVkLCAke3Jlc3VsdC5mYWlsZWR9IGZhaWxlZGA7XG4gICAgICAgIG5ldyBOb3RpY2Uoc3VtbWFyeSk7XG5cbiAgICAgICAgaWYgKHJlc3VsdC5wclVybCkge1xuICAgICAgICAgIG5ldyBOb3RpY2UoYOKckyBQdWxsIHJlcXVlc3QgY3JlYXRlZDogJHtyZXN1bHQucHJVcmx9YCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFB1bGwgUmVxdWVzdDogJHtyZXN1bHQucHJVcmx9YCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZhbGxiYWNrIHRvIGRpcmVjdCBjb21taXQgd29ya2Zsb3dcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy5wdWJsaXNoZXIucHVibGlzaEFsbCgpO1xuXG4gICAgICAgIGlmIChyZXN1bHQudG90YWwgPT09IDApIHtcbiAgICAgICAgICBuZXcgTm90aWNlKFwiTm8gcHVibGlzaGFibGUgbm90ZXMgZm91bmRcIik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VtbWFyeSA9IGBQdWJsaXNoaW5nIGNvbXBsZXRlOiAke3Jlc3VsdC5zdWNjZXNzZnVsfSBzdWNjZWVkZWQsICR7cmVzdWx0LmZhaWxlZH0gZmFpbGVkIG91dCBvZiAke3Jlc3VsdC50b3RhbH0gdG90YWxgO1xuICAgICAgICBuZXcgTm90aWNlKHN1bW1hcnkpO1xuICAgICAgfVxuXG4gICAgICAvLyBMb2cgZmFpbHVyZXNcbiAgICAgIGlmIChyZXN1bHQuZmFpbGVkID4gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkZhaWxlZCBwdWJsaXNoZXM6XCIpO1xuICAgICAgICBmb3IgKGNvbnN0IHIgb2YgcmVzdWx0LnJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoIXIuc3VjY2Vzcykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCAgJHtyLmZpbGVQYXRofTogJHtyLmVycm9yfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBMb2cgc3VjY2Vzc2VzXG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3NmdWwgPiAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiU3VjY2Vzc2Z1bCBwdWJsaXNoZXM6XCIpO1xuICAgICAgICBmb3IgKGNvbnN0IHIgb2YgcmVzdWx0LnJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoci5zdWNjZXNzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgICAke3IuZmlsZVBhdGh9OiAke3IudXJsIHx8IFwibm8gdXJsXCJ9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiVW5rbm93biBlcnJvclwiO1xuICAgICAgbmV3IE5vdGljZShg4pyXIEVycm9yOiAke21lc3NhZ2V9YCk7XG4gICAgICBjb25zb2xlLmVycm9yKFwiQmF0Y2ggcHVibGlzaCBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBOb3RpY2UsIHR5cGUgVEZpbGUsIHR5cGUgVmF1bHQgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IENvbnRlbnRQcm9jZXNzb3IgfSBmcm9tIFwiLi9jb250ZW50LXByb2Nlc3NvclwiO1xuaW1wb3J0IHsgR2l0SHViU2VydmljZSB9IGZyb20gXCIuL2dpdGh1Yi1zZXJ2aWNlXCI7XG5pbXBvcnQgdHlwZSB7IEJhdGNoUHVibGlzaFJlc3VsdCwgUHVibGlzaFJlc3VsdCwgUHVibGlzaGVyU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgY2xhc3MgUHVibGlzaGVyIHtcbiAgcHJpdmF0ZSB2YXVsdDogVmF1bHQ7XG4gIHByaXZhdGUgc2V0dGluZ3M6IFB1Ymxpc2hlclNldHRpbmdzO1xuICBwcml2YXRlIGNvbnRlbnRQcm9jZXNzb3I6IENvbnRlbnRQcm9jZXNzb3I7XG4gIHByaXZhdGUgZ2l0aHViU2VydmljZTogR2l0SHViU2VydmljZTtcblxuICBjb25zdHJ1Y3Rvcih2YXVsdDogVmF1bHQsIHNldHRpbmdzOiBQdWJsaXNoZXJTZXR0aW5ncykge1xuICAgIHRoaXMudmF1bHQgPSB2YXVsdDtcbiAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgdGhpcy5jb250ZW50UHJvY2Vzc29yID0gbmV3IENvbnRlbnRQcm9jZXNzb3Ioc2V0dGluZ3MpO1xuICAgIHRoaXMuZ2l0aHViU2VydmljZSA9IG5ldyBHaXRIdWJTZXJ2aWNlKHNldHRpbmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdWJsaXNoIGEgc2luZ2xlIG5vdGUgdG8gR2l0SHViXG4gICAqL1xuICBhc3luYyBwdWJsaXNoTm90ZShmaWxlOiBURmlsZSk6IFByb21pc2U8UHVibGlzaFJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIGZpbGUgY29udGVudFxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMudmF1bHQucmVhZChmaWxlKTtcblxuICAgICAgLy8gQ2hlY2sgaWYgZmlsZSBoYXMgcHVibGlzaDogdHJ1ZSBpbiBmcm9udG1hdHRlclxuICAgICAgaWYgKCF0aGlzLmhhc1B1Ymxpc2hGbGFnKGNvbnRlbnQpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZmlsZVBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogXCJGaWxlIGRvZXMgbm90IGhhdmUgJ3B1Ymxpc2g6IHRydWUnIGluIGZyb250bWF0dGVyXCIsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIC8vIFByb2Nlc3MgY29udGVudFxuICAgICAgY29uc3QgcHJvY2Vzc2VkID0gdGhpcy5jb250ZW50UHJvY2Vzc29yLnByb2Nlc3MoY29udGVudCwgZmlsZS5uYW1lKTtcblxuICAgICAgLy8gVXBsb2FkIGltYWdlc1xuICAgICAgYXdhaXQgdGhpcy51cGxvYWRJbWFnZXMocHJvY2Vzc2VkLmltYWdlcyk7XG5cbiAgICAgIC8vIFVwbG9hZCBtYXJrZG93biBmaWxlXG4gICAgICBjb25zdCB0YXJnZXRQYXRoID0gYCR7dGhpcy5zZXR0aW5ncy5jb250ZW50RGlyfS8ke3Byb2Nlc3NlZC5maWxlbmFtZX1gO1xuICAgICAgY29uc3QgY29tbWl0TWVzc2FnZSA9IGBQdWJsaXNoOiAke2ZpbGUuYmFzZW5hbWV9YDtcbiAgICAgIGNvbnN0IHVybCA9IGF3YWl0IHRoaXMuZ2l0aHViU2VydmljZS5jcmVhdGVPclVwZGF0ZUZpbGUoXG4gICAgICAgIHRhcmdldFBhdGgsXG4gICAgICAgIHByb2Nlc3NlZC5jb250ZW50LFxuICAgICAgICBjb21taXRNZXNzYWdlLFxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsZVBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgdXJsLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJVbmtub3duIGVycm9yXCI7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IG1lc3NhZ2UsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQdWJsaXNoIGFsbCBub3RlcyB3aXRoIHB1Ymxpc2g6IHRydWVcbiAgICovXG4gIGFzeW5jIHB1Ymxpc2hBbGwoKTogUHJvbWlzZTxCYXRjaFB1Ymxpc2hSZXN1bHQ+IHtcbiAgICBjb25zdCBtYXJrZG93bkZpbGVzID0gdGhpcy52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG4gICAgY29uc3QgcmVzdWx0czogUHVibGlzaFJlc3VsdFtdID0gW107XG5cbiAgICBuZXcgTm90aWNlKFwiU2Nhbm5pbmcgdmF1bHQgZm9yIHB1Ymxpc2hhYmxlIG5vdGVzLi4uXCIpO1xuXG4gICAgLy8gRmlsdGVyIGZpbGVzIHdpdGggcHVibGlzaDogdHJ1ZVxuICAgIGNvbnN0IHB1Ymxpc2hhYmxlRmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgbWFya2Rvd25GaWxlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgaWYgKHRoaXMuaGFzUHVibGlzaEZsYWcoY29udGVudCkpIHtcbiAgICAgICAgICBwdWJsaXNoYWJsZUZpbGVzLnB1c2goZmlsZSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byByZWFkIGZpbGUgJHtmaWxlLnBhdGh9OmAsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocHVibGlzaGFibGVGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJObyBmaWxlcyB3aXRoICdwdWJsaXNoOiB0cnVlJyBmb3VuZFwiKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvdGFsOiAwLFxuICAgICAgICBzdWNjZXNzZnVsOiAwLFxuICAgICAgICBmYWlsZWQ6IDAsXG4gICAgICAgIHJlc3VsdHM6IFtdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBuZXcgTm90aWNlKGBQdWJsaXNoaW5nICR7cHVibGlzaGFibGVGaWxlcy5sZW5ndGh9IG5vdGVzLi4uYCk7XG5cbiAgICAvLyBQdWJsaXNoIGVhY2ggZmlsZVxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBwdWJsaXNoYWJsZUZpbGVzKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnB1Ymxpc2hOb3RlKGZpbGUpO1xuICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG5cbiAgICAgIC8vIFNob3cgcHJvZ3Jlc3NcbiAgICAgIGNvbnN0IHN1Y2Nlc3NDb3VudCA9IHJlc3VsdHMuZmlsdGVyKChyKSA9PiByLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgIGBQcm9ncmVzczogJHtyZXN1bHRzLmxlbmd0aH0vJHtwdWJsaXNoYWJsZUZpbGVzLmxlbmd0aH0gKCR7c3VjY2Vzc0NvdW50fSBzdWNjZXNzZnVsKWAsXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IHN1Y2Nlc3NmdWwgPSByZXN1bHRzLmZpbHRlcigocikgPT4gci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgY29uc3QgZmFpbGVkID0gcmVzdWx0cy5maWx0ZXIoKHIpID0+ICFyLnN1Y2Nlc3MpLmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICB0b3RhbDogcmVzdWx0cy5sZW5ndGgsXG4gICAgICBzdWNjZXNzZnVsLFxuICAgICAgZmFpbGVkLFxuICAgICAgcmVzdWx0cyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFB1Ymxpc2ggYSBzaW5nbGUgbm90ZSB0byBHaXRIdWIgd2l0aCBicmFuY2ggYW5kIFBSIGNyZWF0aW9uXG4gICAqL1xuICBhc3luYyBwdWJsaXNoTm90ZVdpdGhQUihmaWxlOiBURmlsZSk6IFByb21pc2U8UHVibGlzaFJlc3VsdCAmIHsgcHJVcmw/OiBzdHJpbmcgfT4ge1xuICAgIGxldCBicmFuY2hOYW1lOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIGZpbGUgY29udGVudFxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMudmF1bHQucmVhZChmaWxlKTtcblxuICAgICAgLy8gQ2hlY2sgaWYgZmlsZSBoYXMgcHVibGlzaDogdHJ1ZSBpbiBmcm9udG1hdHRlclxuICAgICAgaWYgKCF0aGlzLmhhc1B1Ymxpc2hGbGFnKGNvbnRlbnQpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZmlsZVBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogXCJGaWxlIGRvZXMgbm90IGhhdmUgJ3B1Ymxpc2g6IHRydWUnIGluIGZyb250bWF0dGVyXCIsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIGFuZCBjcmVhdGUgYnJhbmNoXG4gICAgICBicmFuY2hOYW1lID0gYXdhaXQgdGhpcy5naXRodWJTZXJ2aWNlLmNyZWF0ZUJyYW5jaFdpdGhSZXRyeShcbiAgICAgICAgXCJwdWJsaXNoXCIsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MuYmFzZUJyYW5jaCB8fCBcIm1haW5cIixcbiAgICAgICk7XG5cbiAgICAgIC8vIFByb2Nlc3MgY29udGVudFxuICAgICAgY29uc3QgcHJvY2Vzc2VkID0gdGhpcy5jb250ZW50UHJvY2Vzc29yLnByb2Nlc3MoY29udGVudCwgZmlsZS5uYW1lKTtcblxuICAgICAgLy8gVXBsb2FkIGltYWdlcyB0byBicmFuY2hcbiAgICAgIGF3YWl0IHRoaXMudXBsb2FkSW1hZ2VzKHByb2Nlc3NlZC5pbWFnZXMsIGJyYW5jaE5hbWUpO1xuXG4gICAgICAvLyBVcGxvYWQgbWFya2Rvd24gZmlsZSB0byBicmFuY2hcbiAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBgJHt0aGlzLnNldHRpbmdzLmNvbnRlbnREaXJ9LyR7cHJvY2Vzc2VkLmZpbGVuYW1lfWA7XG4gICAgICBjb25zdCBjb21taXRNZXNzYWdlID0gYFB1Ymxpc2g6ICR7ZmlsZS5iYXNlbmFtZX1gO1xuICAgICAgYXdhaXQgdGhpcy5naXRodWJTZXJ2aWNlLmNyZWF0ZU9yVXBkYXRlRmlsZShcbiAgICAgICAgdGFyZ2V0UGF0aCxcbiAgICAgICAgcHJvY2Vzc2VkLmNvbnRlbnQsXG4gICAgICAgIGNvbW1pdE1lc3NhZ2UsXG4gICAgICAgIGJyYW5jaE5hbWUsXG4gICAgICApO1xuXG4gICAgICAvLyBDcmVhdGUgcHVsbCByZXF1ZXN0XG4gICAgICBjb25zdCBwclRpdGxlID0gYFB1Ymxpc2g6ICR7ZmlsZS5iYXNlbmFtZX1gO1xuICAgICAgY29uc3QgcHJCb2R5ID0gYFB1Ymxpc2hlZCBmcm9tIE9ic2lkaWFuXFxuXFxuKipGaWxlOioqICR7ZmlsZS5wYXRofVxcbioqSW1hZ2VzOioqICR7cHJvY2Vzc2VkLmltYWdlcy5sZW5ndGh9YDtcbiAgICAgIGNvbnN0IHByID0gYXdhaXQgdGhpcy5naXRodWJTZXJ2aWNlLmNyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgICBicmFuY2hOYW1lLFxuICAgICAgICB0aGlzLnNldHRpbmdzLmJhc2VCcmFuY2ggfHwgXCJtYWluXCIsXG4gICAgICAgIHByVGl0bGUsXG4gICAgICAgIHByQm9keSxcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5wckxhYmVscyB8fCBbXCJwdWJsaXNoZWQtZnJvbS1vYnNpZGlhblwiXSxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHByVXJsOiBwci51cmwsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlVua25vd24gZXJyb3JcIjtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogbWVzc2FnZSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFB1Ymxpc2ggYWxsIG5vdGVzIHdpdGggcHVibGlzaDogdHJ1ZSB0byBhIHNpbmdsZSBicmFuY2ggYW5kIFBSXG4gICAqL1xuICBhc3luYyBwdWJsaXNoQWxsV2l0aFBSKCk6IFByb21pc2U8QmF0Y2hQdWJsaXNoUmVzdWx0ICYgeyBwclVybD86IHN0cmluZyB9PiB7XG4gICAgY29uc3QgbWFya2Rvd25GaWxlcyA9IHRoaXMudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICAgIGNvbnN0IHJlc3VsdHM6IFB1Ymxpc2hSZXN1bHRbXSA9IFtdO1xuICAgIGxldCBicmFuY2hOYW1lOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgIG5ldyBOb3RpY2UoXCJTY2FubmluZyB2YXVsdCBmb3IgcHVibGlzaGFibGUgbm90ZXMuLi5cIik7XG5cbiAgICAvLyBGaWx0ZXIgZmlsZXMgd2l0aCBwdWJsaXNoOiB0cnVlXG4gICAgY29uc3QgcHVibGlzaGFibGVGaWxlczogVEZpbGVbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBtYXJrZG93bkZpbGVzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgICBpZiAodGhpcy5oYXNQdWJsaXNoRmxhZyhjb250ZW50KSkge1xuICAgICAgICAgIHB1Ymxpc2hhYmxlRmlsZXMucHVzaChmaWxlKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHJlYWQgZmlsZSAke2ZpbGUucGF0aH06YCwgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwdWJsaXNoYWJsZUZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZShcIk5vIGZpbGVzIHdpdGggJ3B1Ymxpc2g6IHRydWUnIGZvdW5kXCIpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG90YWw6IDAsXG4gICAgICAgIHN1Y2Nlc3NmdWw6IDAsXG4gICAgICAgIGZhaWxlZDogMCxcbiAgICAgICAgcmVzdWx0czogW10sXG4gICAgICB9O1xuICAgIH1cblxuICAgIG5ldyBOb3RpY2UoYFB1Ymxpc2hpbmcgJHtwdWJsaXNoYWJsZUZpbGVzLmxlbmd0aH0gbm90ZXMgdG8gYnJhbmNoLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gR2VuZXJhdGUgYW5kIGNyZWF0ZSBicmFuY2hcbiAgICAgIGJyYW5jaE5hbWUgPSBhd2FpdCB0aGlzLmdpdGh1YlNlcnZpY2UuY3JlYXRlQnJhbmNoV2l0aFJldHJ5KFxuICAgICAgICBcInB1Ymxpc2gtYmF0Y2hcIixcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5iYXNlQnJhbmNoIHx8IFwibWFpblwiLFxuICAgICAgKTtcblxuICAgICAgLy8gUHVibGlzaCBlYWNoIGZpbGUgdG8gdGhlIGJyYW5jaFxuICAgICAgZm9yIChjb25zdCBmaWxlIG9mIHB1Ymxpc2hhYmxlRmlsZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZCA9IHRoaXMuY29udGVudFByb2Nlc3Nvci5wcm9jZXNzKGNvbnRlbnQsIGZpbGUubmFtZSk7XG5cbiAgICAgICAgICAvLyBVcGxvYWQgaW1hZ2VzIHRvIGJyYW5jaFxuICAgICAgICAgIGF3YWl0IHRoaXMudXBsb2FkSW1hZ2VzKHByb2Nlc3NlZC5pbWFnZXMsIGJyYW5jaE5hbWUpO1xuXG4gICAgICAgICAgLy8gVXBsb2FkIG1hcmtkb3duIGZpbGUgdG8gYnJhbmNoXG4gICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGAke3RoaXMuc2V0dGluZ3MuY29udGVudERpcn0vJHtwcm9jZXNzZWQuZmlsZW5hbWV9YDtcbiAgICAgICAgICBjb25zdCBjb21taXRNZXNzYWdlID0gYFB1Ymxpc2g6ICR7ZmlsZS5iYXNlbmFtZX1gO1xuICAgICAgICAgIGF3YWl0IHRoaXMuZ2l0aHViU2VydmljZS5jcmVhdGVPclVwZGF0ZUZpbGUoXG4gICAgICAgICAgICB0YXJnZXRQYXRoLFxuICAgICAgICAgICAgcHJvY2Vzc2VkLmNvbnRlbnQsXG4gICAgICAgICAgICBjb21taXRNZXNzYWdlLFxuICAgICAgICAgICAgYnJhbmNoTmFtZSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gU2hvdyBwcm9ncmVzc1xuICAgICAgICAgIG5ldyBOb3RpY2UoYFByb2dyZXNzOiAke3Jlc3VsdHMubGVuZ3RofS8ke3B1Ymxpc2hhYmxlRmlsZXMubGVuZ3RofWApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiVW5rbm93biBlcnJvclwiO1xuICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogbWVzc2FnZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgcHVsbCByZXF1ZXN0XG4gICAgICBjb25zdCBzdWNjZXNzZnVsID0gcmVzdWx0cy5maWx0ZXIoKHIpID0+IHIuc3VjY2VzcykubGVuZ3RoO1xuICAgICAgY29uc3QgZmFpbGVkID0gcmVzdWx0cy5maWx0ZXIoKHIpID0+ICFyLnN1Y2Nlc3MpLmxlbmd0aDtcblxuICAgICAgY29uc3QgcHJUaXRsZSA9IGBCYXRjaCBQdWJsaXNoOiAke3N1Y2Nlc3NmdWx9IG5vdGVzYDtcbiAgICAgIGNvbnN0IGZpbGVMaXN0ID0gcmVzdWx0c1xuICAgICAgICAuZmlsdGVyKChyKSA9PiByLnN1Y2Nlc3MpXG4gICAgICAgIC5tYXAoKHIpID0+IGAtICR7ci5maWxlUGF0aH1gKVxuICAgICAgICAuam9pbihcIlxcblwiKTtcbiAgICAgIGNvbnN0IHByQm9keSA9IGBQdWJsaXNoZWQgJHtzdWNjZXNzZnVsfSBub3RlcyBmcm9tIE9ic2lkaWFuXFxuXFxuJHtmaWxlTGlzdH1gO1xuXG4gICAgICBjb25zdCBwciA9IGF3YWl0IHRoaXMuZ2l0aHViU2VydmljZS5jcmVhdGVQdWxsUmVxdWVzdChcbiAgICAgICAgYnJhbmNoTmFtZSxcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5iYXNlQnJhbmNoIHx8IFwibWFpblwiLFxuICAgICAgICBwclRpdGxlLFxuICAgICAgICBwckJvZHksXG4gICAgICAgIHRoaXMuc2V0dGluZ3MucHJMYWJlbHMgfHwgW1wicHVibGlzaGVkLWZyb20tb2JzaWRpYW5cIl0sXG4gICAgICApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3RhbDogcmVzdWx0cy5sZW5ndGgsXG4gICAgICAgIHN1Y2Nlc3NmdWwsXG4gICAgICAgIGZhaWxlZCxcbiAgICAgICAgcmVzdWx0cyxcbiAgICAgICAgcHJVcmw6IHByLnVybCxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiVW5rbm93biBlcnJvclwiO1xuICAgICAgbmV3IE5vdGljZShgRmFpbGVkIHRvIHB1Ymxpc2g6ICR7bWVzc2FnZX1gKTtcblxuICAgICAgY29uc3Qgc3VjY2Vzc2Z1bCA9IHJlc3VsdHMuZmlsdGVyKChyKSA9PiByLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICAgIGNvbnN0IGZhaWxlZCA9IHJlc3VsdHMuZmlsdGVyKChyKSA9PiAhci5zdWNjZXNzKS5sZW5ndGg7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvdGFsOiByZXN1bHRzLmxlbmd0aCxcbiAgICAgICAgc3VjY2Vzc2Z1bCxcbiAgICAgICAgZmFpbGVkLFxuICAgICAgICByZXN1bHRzLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBsb2FkIGltYWdlcyByZWZlcmVuY2VkIGluIGEgbm90ZVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB1cGxvYWRJbWFnZXMoaW1hZ2VOYW1lczogc3RyaW5nW10sIGJyYW5jaD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGZvciAoY29uc3QgaW1hZ2VOYW1lIG9mIGltYWdlTmFtZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIEZpbmQgdGhlIGltYWdlIGZpbGUgaW4gdGhlIHZhdWx0XG4gICAgICAgIGNvbnN0IGltYWdlRmlsZSA9IHRoaXMudmF1bHQuZ2V0RmlsZXMoKS5maW5kKChmKSA9PiBmLm5hbWUgPT09IGltYWdlTmFtZSk7XG5cbiAgICAgICAgaWYgKCFpbWFnZUZpbGUpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYEltYWdlIG5vdCBmb3VuZCBpbiB2YXVsdDogJHtpbWFnZU5hbWV9YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWFkIGltYWdlIGNvbnRlbnRcbiAgICAgICAgY29uc3QgaW1hZ2VDb250ZW50ID0gYXdhaXQgdGhpcy52YXVsdC5yZWFkQmluYXJ5KGltYWdlRmlsZSk7XG5cbiAgICAgICAgLy8gU2FuaXRpemUgZmlsZW5hbWVcbiAgICAgICAgY29uc3Qgc2FuaXRpemVkTmFtZSA9IHRoaXMuY29udGVudFByb2Nlc3Nvci5zYW5pdGl6ZUltYWdlTmFtZShpbWFnZU5hbWUpO1xuXG4gICAgICAgIC8vIFVwbG9hZCB0byBHaXRIdWJcbiAgICAgICAgYXdhaXQgdGhpcy5naXRodWJTZXJ2aWNlLnVwbG9hZEltYWdlKHNhbml0aXplZE5hbWUsIGltYWdlQ29udGVudCwgYnJhbmNoKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGxvYWQgaW1hZ2UgJHtpbWFnZU5hbWV9OmAsIGVycm9yKTtcbiAgICAgICAgLy8gRG9uJ3QgdGhyb3cgLSBjb250aW51ZSB3aXRoIG90aGVyIGltYWdlc1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBjb250ZW50IGhhcyBwdWJsaXNoOiB0cnVlIGluIGZyb250bWF0dGVyXG4gICAqL1xuICBwcml2YXRlIGhhc1B1Ymxpc2hGbGFnKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGZyb250bWF0dGVyUmVnZXggPSAvXi0tLVxcbihbXFxzXFxTXSo/KVxcbi0tLS87XG4gICAgY29uc3QgbWF0Y2ggPSBjb250ZW50Lm1hdGNoKGZyb250bWF0dGVyUmVnZXgpO1xuXG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGZyb250bWF0dGVyID0gbWF0Y2hbMV07XG4gICAgLy8gU2ltcGxlIGNoZWNrIGZvciBwdWJsaXNoOiB0cnVlIChjb3VsZCBiZSBtb3JlIHJvYnVzdClcbiAgICByZXR1cm4gL15wdWJsaXNoOlxccyp0cnVlXFxzKiQvbS50ZXN0KGZyb250bWF0dGVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSBzZXR0aW5ncyBiZWZvcmUgcHVibGlzaGluZ1xuICAgKi9cbiAgdmFsaWRhdGVTZXR0aW5ncygpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3MuZ2l0aHViVG9rZW4pIHtcbiAgICAgIHJldHVybiBcIkdpdEh1YiB0b2tlbiBpcyBub3QgY29uZmlndXJlZFwiO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5zZXR0aW5ncy5yZXBvT3duZXIgfHwgIXRoaXMuc2V0dGluZ3MucmVwb05hbWUpIHtcbiAgICAgIHJldHVybiBcIlJlcG9zaXRvcnkgb3duZXIgYW5kIG5hbWUgbXVzdCBiZSBjb25maWd1cmVkXCI7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmNvbnRlbnREaXIpIHtcbiAgICAgIHJldHVybiBcIkNvbnRlbnQgZGlyZWN0b3J5IG11c3QgYmUgY29uZmlndXJlZFwiO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5zZXR0aW5ncy5pbWFnZURpcikge1xuICAgICAgcmV0dXJuIFwiSW1hZ2UgZGlyZWN0b3J5IG11c3QgYmUgY29uZmlndXJlZFwiO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLAogICAgImltcG9ydCB7IHBhcnNlWWFtbCwgc3RyaW5naWZ5WWFtbCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBQcm9jZXNzZWRDb250ZW50LCBQdWJsaXNoZXJTZXR0aW5ncyB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBjbGFzcyBDb250ZW50UHJvY2Vzc29yIHtcbiAgcHJpdmF0ZSBzZXR0aW5nczogUHVibGlzaGVyU2V0dGluZ3M7XG5cbiAgY29uc3RydWN0b3Ioc2V0dGluZ3M6IFB1Ymxpc2hlclNldHRpbmdzKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSBtYXJrZG93biBmaWxlIGZvciBIdWdvIHB1Ymxpc2hpbmdcbiAgICovXG4gIHByb2Nlc3MoY29udGVudDogc3RyaW5nLCBvcmlnaW5hbEZpbGVuYW1lOiBzdHJpbmcpOiBQcm9jZXNzZWRDb250ZW50IHtcbiAgICBjb25zdCB7IGZyb250bWF0dGVyLCBib2R5IH0gPSB0aGlzLmV4dHJhY3RGcm9udG1hdHRlcihjb250ZW50KTtcblxuICAgIC8vIFByb2Nlc3MgZnJvbnRtYXR0ZXJcbiAgICBjb25zdCBwcm9jZXNzZWRGcm9udG1hdHRlciA9IHRoaXMucHJvY2Vzc0Zyb250bWF0dGVyKGZyb250bWF0dGVyKTtcblxuICAgIC8vIEZpbmQgYWxsIGltYWdlcyBpbiB0aGUgY29udGVudFxuICAgIGNvbnN0IGltYWdlcyA9IHRoaXMuZXh0cmFjdEltYWdlcyhib2R5KTtcblxuICAgIC8vIENvbnZlcnQgY29udGVudFxuICAgIGxldCBwcm9jZXNzZWRCb2R5ID0gYm9keTtcbiAgICBwcm9jZXNzZWRCb2R5ID0gdGhpcy5jb252ZXJ0V2lraWxpbmtzKHByb2Nlc3NlZEJvZHkpO1xuICAgIHByb2Nlc3NlZEJvZHkgPSB0aGlzLmNvbnZlcnRJbWFnZVJlZmVyZW5jZXMocHJvY2Vzc2VkQm9keSk7XG5cbiAgICAvLyBSZWFzc2VtYmxlIGNvbnRlbnQgd2l0aCBmcm9udG1hdHRlclxuICAgIGNvbnN0IHByb2Nlc3NlZENvbnRlbnQgPSB0aGlzLmFzc2VtYmxlRnJvbnRtYXR0ZXIocHJvY2Vzc2VkRnJvbnRtYXR0ZXIsIHByb2Nlc3NlZEJvZHkpO1xuXG4gICAgLy8gU2FuaXRpemUgZmlsZW5hbWVcbiAgICBjb25zdCBzYW5pdGl6ZWRGaWxlbmFtZSA9IHRoaXMuc2FuaXRpemVGaWxlbmFtZShvcmlnaW5hbEZpbGVuYW1lKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50OiBwcm9jZXNzZWRDb250ZW50LFxuICAgICAgZmlsZW5hbWU6IHNhbml0aXplZEZpbGVuYW1lLFxuICAgICAgaW1hZ2VzLFxuICAgICAgZnJvbnRtYXR0ZXI6IHByb2Nlc3NlZEZyb250bWF0dGVyLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCBmcm9udG1hdHRlciBhbmQgYm9keSBmcm9tIG1hcmtkb3duIGNvbnRlbnRcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdEZyb250bWF0dGVyKGNvbnRlbnQ6IHN0cmluZyk6IHtcbiAgICBmcm9udG1hdHRlcjogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgYm9keTogc3RyaW5nO1xuICB9IHtcbiAgICBjb25zdCBmcm9udG1hdHRlclJlZ2V4ID0gL14tLS1cXG4oW1xcc1xcU10qPylcXG4tLS1cXG4oW1xcc1xcU10qKSQvO1xuICAgIGNvbnN0IG1hdGNoID0gY29udGVudC5tYXRjaChmcm9udG1hdHRlclJlZ2V4KTtcblxuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybiB7IGZyb250bWF0dGVyOiB7fSwgYm9keTogY29udGVudCB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlWWFtbChtYXRjaFsxXSkgfHwge307XG4gICAgICBjb25zdCBib2R5ID0gbWF0Y2hbMl07XG4gICAgICByZXR1cm4ge1xuICAgICAgICBmcm9udG1hdHRlcjogdHlwZW9mIGZyb250bWF0dGVyID09PSBcIm9iamVjdFwiID8gZnJvbnRtYXR0ZXIgOiB7fSxcbiAgICAgICAgYm9keSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcGFyc2UgZnJvbnRtYXR0ZXI6XCIsIGVycm9yKTtcbiAgICAgIHJldHVybiB7IGZyb250bWF0dGVyOiB7fSwgYm9keTogY29udGVudCB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGZyb250bWF0dGVyIGZvciBIdWdvXG4gICAqL1xuICBwcml2YXRlIHByb2Nlc3NGcm9udG1hdHRlcihmcm9udG1hdHRlcjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgY29uc3QgcHJvY2Vzc2VkID0geyAuLi5mcm9udG1hdHRlciB9O1xuXG4gICAgLy8gUmVtb3ZlIHB1Ymxpc2ggZmllbGQgaWYgY29uZmlndXJlZFxuICAgIGlmICh0aGlzLnNldHRpbmdzLnJlbW92ZVB1Ymxpc2hGbGFnKSB7XG4gICAgICBwcm9jZXNzZWQucHVibGlzaCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGVtcGxhdGUgZmllbGRzXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5zZXR0aW5ncy5mcm9udG1hdHRlclRlbXBsYXRlKSkge1xuICAgICAgLy8gRG9uJ3Qgb3ZlcnJpZGUgZXhpc3RpbmcgZmllbGRzXG4gICAgICBpZiAoIShrZXkgaW4gcHJvY2Vzc2VkKSkge1xuICAgICAgICBwcm9jZXNzZWRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEVuc3VyZSBkYXRlIGZpZWxkIGV4aXN0cyAoSHVnbyByZXF1aXJlbWVudClcbiAgICBpZiAoIXByb2Nlc3NlZC5kYXRlKSB7XG4gICAgICBwcm9jZXNzZWQuZGF0ZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvY2Vzc2VkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlYXNzZW1ibGUgZnJvbnRtYXR0ZXIgYW5kIGJvZHlcbiAgICovXG4gIHByaXZhdGUgYXNzZW1ibGVGcm9udG1hdHRlcihmcm9udG1hdHRlcjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIGJvZHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKE9iamVjdC5rZXlzKGZyb250bWF0dGVyKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBib2R5O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB5YW1sID0gc3RyaW5naWZ5WWFtbChmcm9udG1hdHRlcik7XG4gICAgICByZXR1cm4gYC0tLVxcbiR7eWFtbH0tLS1cXG4ke2JvZHl9YDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBzdHJpbmdpZnkgZnJvbnRtYXR0ZXI6XCIsIGVycm9yKTtcbiAgICAgIHJldHVybiBib2R5O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGFsbCBpbWFnZSByZWZlcmVuY2VzIGZyb20gY29udGVudFxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0SW1hZ2VzKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBpbWFnZVJlZ2V4ID0gLyFcXFtcXFsoW15cXF1dKylcXF1cXF0vZztcbiAgICBjb25zdCBpbWFnZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICBsZXQgbWF0Y2ggPSBpbWFnZVJlZ2V4LmV4ZWMoY29udGVudCk7XG4gICAgd2hpbGUgKG1hdGNoICE9PSBudWxsKSB7XG4gICAgICBpbWFnZXMucHVzaChtYXRjaFsxXSk7XG4gICAgICBtYXRjaCA9IGltYWdlUmVnZXguZXhlYyhjb250ZW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2VzO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgT2JzaWRpYW4gd2lraWxpbmtzIHRvIG1hcmtkb3duIGxpbmtzXG4gICAqIEhhbmRsZXM6IFtbUGFnZV1dIGFuZCBbW1BhZ2V8RGlzcGxheSBUZXh0XV1cbiAgICovXG4gIHByaXZhdGUgY29udmVydFdpa2lsaW5rcyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UoL1xcW1xcWyhbXlxcXXxdKykoXFx8KFteXFxdXSspKT9cXF1cXF0vZywgKF9tYXRjaCwgcGFnZSwgXywgZGlzcGxheVRleHQpID0+IHtcbiAgICAgIGNvbnN0IGRpc3BsYXkgPSBkaXNwbGF5VGV4dCB8fCBwYWdlO1xuICAgICAgY29uc3Qgc2x1ZyA9IHRoaXMuc2FuaXRpemVGaWxlbmFtZShwYWdlKTtcbiAgICAgIHJldHVybiBgWyR7ZGlzcGxheX1dKCR7c2x1Z30pYDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IE9ic2lkaWFuIGltYWdlIHJlZmVyZW5jZXMgdG8gSHVnby1jb21wYXRpYmxlIG1hcmtkb3duXG4gICAqIEhhbmRsZXM6ICFbW2ltYWdlLnBuZ11dXG4gICAqL1xuICBwcml2YXRlIGNvbnZlcnRJbWFnZVJlZmVyZW5jZXMoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY29udGVudC5yZXBsYWNlKC8hXFxbXFxbKFteXFxdXSspXFxdXFxdL2csIChfbWF0Y2gsIGltYWdlTmFtZSkgPT4ge1xuICAgICAgY29uc3Qgc2FuaXRpemVkTmFtZSA9IHRoaXMuc2FuaXRpemVGaWxlbmFtZShpbWFnZU5hbWUpO1xuICAgICAgLy8gSHVnbyBwYXRocyBhcmUgcmVsYXRpdmUgdG8gY29udGVudCBkaXJlY3RvcnlcbiAgICAgIC8vIEltYWdlcyBpbiBzdGF0aWMvaW1hZ2VzIGFyZSByZWZlcmVuY2VkIGFzIC9pbWFnZXMvXG4gICAgICByZXR1cm4gYCFbJHtpbWFnZU5hbWV9XSgvaW1hZ2VzLyR7c2FuaXRpemVkTmFtZX0pYDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTYW5pdGl6ZSBmaWxlbmFtZSBmb3IgSHVnbyBVUkxzXG4gICAqIC0gQ29udmVydCB0byBsb3dlcmNhc2VcbiAgICogLSBSZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnNcbiAgICogLSBSZW1vdmUgc3BlY2lhbCBjaGFyYWN0ZXJzXG4gICAqIC0gS2VlcCBhbHBoYW51bWVyaWMsIGh5cGhlbnMsIHVuZGVyc2NvcmVzLCBhbmQgZG90c1xuICAgKi9cbiAgc2FuaXRpemVGaWxlbmFtZShmaWxlbmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBFeHRyYWN0IGV4dGVuc2lvbiBpZiBwcmVzZW50XG4gICAgY29uc3QgbGFzdERvdEluZGV4ID0gZmlsZW5hbWUubGFzdEluZGV4T2YoXCIuXCIpO1xuICAgIGNvbnN0IGhhc0V4dGVuc2lvbiA9IGxhc3REb3RJbmRleCA+IDAgJiYgbGFzdERvdEluZGV4IDwgZmlsZW5hbWUubGVuZ3RoIC0gMTtcblxuICAgIGxldCBuYW1lID0gZmlsZW5hbWU7XG4gICAgbGV0IGV4dGVuc2lvbiA9IFwiXCI7XG5cbiAgICBpZiAoaGFzRXh0ZW5zaW9uKSB7XG4gICAgICBuYW1lID0gZmlsZW5hbWUuc2xpY2UoMCwgbGFzdERvdEluZGV4KTtcbiAgICAgIGV4dGVuc2lvbiA9IGZpbGVuYW1lLnNsaWNlKGxhc3REb3RJbmRleCk7IC8vIGluY2x1ZGVzIHRoZSBkb3RcbiAgICB9XG5cbiAgICAvLyBDb252ZXJ0IHRvIGxvd2VyY2FzZSBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zXG4gICAgbmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXHMrL2csIFwiLVwiKTtcblxuICAgIC8vIFJlbW92ZSBzcGVjaWFsIGNoYXJhY3RlcnMsIGtlZXAgb25seSBhbHBoYW51bWVyaWMsIGh5cGhlbnMsIGFuZCB1bmRlcnNjb3Jlc1xuICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoL1teYS16MC05XFwtX10vZywgXCJcIik7XG5cbiAgICAvLyBSZW1vdmUgY29uc2VjdXRpdmUgaHlwaGVuc1xuICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLy0rL2csIFwiLVwiKTtcblxuICAgIC8vIFJlbW92ZSBsZWFkaW5nL3RyYWlsaW5nIGh5cGhlbnNcbiAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC9eLSt8LSskL2csIFwiXCIpO1xuXG4gICAgLy8gSWYgbmFtZSBpcyBlbXB0eSBhZnRlciBzYW5pdGl6YXRpb24sIHVzZSBhIGRlZmF1bHRcbiAgICBpZiAoIW5hbWUpIHtcbiAgICAgIG5hbWUgPSBcInVudGl0bGVkXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWUgKyBleHRlbnNpb247XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBzYW5pdGl6ZWQgaW1hZ2UgZmlsZW5hbWVcbiAgICovXG4gIHNhbml0aXplSW1hZ2VOYW1lKGltYWdlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5zYW5pdGl6ZUZpbGVuYW1lKGltYWdlTmFtZSk7XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudCgpIHtcbiAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgPT09IFwib2JqZWN0XCIgJiYgXCJ1c2VyQWdlbnRcIiBpbiBuYXZpZ2F0b3IpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLnVzZXJBZ2VudDtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiBwcm9jZXNzLnZlcnNpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBgTm9kZS5qcy8ke3Byb2Nlc3MudmVyc2lvbi5zdWJzdHIoMSl9ICgke3Byb2Nlc3MucGxhdGZvcm19OyAke1xuICAgICAgcHJvY2Vzcy5hcmNoXG4gICAgfSlgO1xuICB9XG5cbiAgcmV0dXJuIFwiPGVudmlyb25tZW50IHVuZGV0ZWN0YWJsZT5cIjtcbn1cbiIsCiAgICAiLy8gQHRzLWNoZWNrXG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlcihzdGF0ZSwgbmFtZSwgbWV0aG9kLCBvcHRpb25zKSB7XG4gIGlmICh0eXBlb2YgbWV0aG9kICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJtZXRob2QgZm9yIGJlZm9yZSBob29rIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSB7fTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KG5hbWUpKSB7XG4gICAgcmV0dXJuIG5hbWUucmV2ZXJzZSgpLnJlZHVjZSgoY2FsbGJhY2ssIG5hbWUpID0+IHtcbiAgICAgIHJldHVybiByZWdpc3Rlci5iaW5kKG51bGwsIHN0YXRlLCBuYW1lLCBjYWxsYmFjaywgb3B0aW9ucyk7XG4gICAgfSwgbWV0aG9kKSgpO1xuICB9XG5cbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgIGlmICghc3RhdGUucmVnaXN0cnlbbmFtZV0pIHtcbiAgICAgIHJldHVybiBtZXRob2Qob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRlLnJlZ2lzdHJ5W25hbWVdLnJlZHVjZSgobWV0aG9kLCByZWdpc3RlcmVkKSA9PiB7XG4gICAgICByZXR1cm4gcmVnaXN0ZXJlZC5ob29rLmJpbmQobnVsbCwgbWV0aG9kLCBvcHRpb25zKTtcbiAgICB9LCBtZXRob2QpKCk7XG4gIH0pO1xufVxuIiwKICAgICIvLyBAdHMtY2hlY2tcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEhvb2soc3RhdGUsIGtpbmQsIG5hbWUsIGhvb2spIHtcbiAgY29uc3Qgb3JpZyA9IGhvb2s7XG4gIGlmICghc3RhdGUucmVnaXN0cnlbbmFtZV0pIHtcbiAgICBzdGF0ZS5yZWdpc3RyeVtuYW1lXSA9IFtdO1xuICB9XG5cbiAgaWYgKGtpbmQgPT09IFwiYmVmb3JlXCIpIHtcbiAgICBob29rID0gKG1ldGhvZCwgb3B0aW9ucykgPT4ge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKG9yaWcuYmluZChudWxsLCBvcHRpb25zKSlcbiAgICAgICAgLnRoZW4obWV0aG9kLmJpbmQobnVsbCwgb3B0aW9ucykpO1xuICAgIH07XG4gIH1cblxuICBpZiAoa2luZCA9PT0gXCJhZnRlclwiKSB7XG4gICAgaG9vayA9IChtZXRob2QsIG9wdGlvbnMpID0+IHtcbiAgICAgIGxldCByZXN1bHQ7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgLnRoZW4obWV0aG9kLmJpbmQobnVsbCwgb3B0aW9ucykpXG4gICAgICAgIC50aGVuKChyZXN1bHRfKSA9PiB7XG4gICAgICAgICAgcmVzdWx0ID0gcmVzdWx0XztcbiAgICAgICAgICByZXR1cm4gb3JpZyhyZXN1bHQsIG9wdGlvbnMpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChraW5kID09PSBcImVycm9yXCIpIHtcbiAgICBob29rID0gKG1ldGhvZCwgb3B0aW9ucykgPT4ge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKG1ldGhvZC5iaW5kKG51bGwsIG9wdGlvbnMpKVxuICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9yaWcoZXJyb3IsIG9wdGlvbnMpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICB9XG5cbiAgc3RhdGUucmVnaXN0cnlbbmFtZV0ucHVzaCh7XG4gICAgaG9vazogaG9vayxcbiAgICBvcmlnOiBvcmlnLFxuICB9KTtcbn1cbiIsCiAgICAiLy8gQHRzLWNoZWNrXG5cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVIb29rKHN0YXRlLCBuYW1lLCBtZXRob2QpIHtcbiAgaWYgKCFzdGF0ZS5yZWdpc3RyeVtuYW1lXSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGluZGV4ID0gc3RhdGUucmVnaXN0cnlbbmFtZV1cbiAgICAubWFwKChyZWdpc3RlcmVkKSA9PiB7XG4gICAgICByZXR1cm4gcmVnaXN0ZXJlZC5vcmlnO1xuICAgIH0pXG4gICAgLmluZGV4T2YobWV0aG9kKTtcblxuICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGUucmVnaXN0cnlbbmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbn1cbiIsCiAgICAiLy8gQHRzLWNoZWNrXG5cbmltcG9ydCB7IHJlZ2lzdGVyIH0gZnJvbSBcIi4vbGliL3JlZ2lzdGVyLmpzXCI7XG5pbXBvcnQgeyBhZGRIb29rIH0gZnJvbSBcIi4vbGliL2FkZC5qc1wiO1xuaW1wb3J0IHsgcmVtb3ZlSG9vayB9IGZyb20gXCIuL2xpYi9yZW1vdmUuanNcIjtcblxuLy8gYmluZCB3aXRoIGFycmF5IG9mIGFyZ3VtZW50czogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIxNzkyOTEzXG5jb25zdCBiaW5kID0gRnVuY3Rpb24uYmluZDtcbmNvbnN0IGJpbmRhYmxlID0gYmluZC5iaW5kKGJpbmQpO1xuXG5mdW5jdGlvbiBiaW5kQXBpKGhvb2ssIHN0YXRlLCBuYW1lKSB7XG4gIGNvbnN0IHJlbW92ZUhvb2tSZWYgPSBiaW5kYWJsZShyZW1vdmVIb29rLCBudWxsKS5hcHBseShcbiAgICBudWxsLFxuICAgIG5hbWUgPyBbc3RhdGUsIG5hbWVdIDogW3N0YXRlXVxuICApO1xuICBob29rLmFwaSA9IHsgcmVtb3ZlOiByZW1vdmVIb29rUmVmIH07XG4gIGhvb2sucmVtb3ZlID0gcmVtb3ZlSG9va1JlZjtcbiAgW1wiYmVmb3JlXCIsIFwiZXJyb3JcIiwgXCJhZnRlclwiLCBcIndyYXBcIl0uZm9yRWFjaCgoa2luZCkgPT4ge1xuICAgIGNvbnN0IGFyZ3MgPSBuYW1lID8gW3N0YXRlLCBraW5kLCBuYW1lXSA6IFtzdGF0ZSwga2luZF07XG4gICAgaG9va1traW5kXSA9IGhvb2suYXBpW2tpbmRdID0gYmluZGFibGUoYWRkSG9vaywgbnVsbCkuYXBwbHkobnVsbCwgYXJncyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBTaW5ndWxhcigpIHtcbiAgY29uc3Qgc2luZ3VsYXJIb29rTmFtZSA9IFN5bWJvbChcIlNpbmd1bGFyXCIpO1xuICBjb25zdCBzaW5ndWxhckhvb2tTdGF0ZSA9IHtcbiAgICByZWdpc3RyeToge30sXG4gIH07XG4gIGNvbnN0IHNpbmd1bGFySG9vayA9IHJlZ2lzdGVyLmJpbmQobnVsbCwgc2luZ3VsYXJIb29rU3RhdGUsIHNpbmd1bGFySG9va05hbWUpO1xuICBiaW5kQXBpKHNpbmd1bGFySG9vaywgc2luZ3VsYXJIb29rU3RhdGUsIHNpbmd1bGFySG9va05hbWUpO1xuICByZXR1cm4gc2luZ3VsYXJIb29rO1xufVxuXG5mdW5jdGlvbiBDb2xsZWN0aW9uKCkge1xuICBjb25zdCBzdGF0ZSA9IHtcbiAgICByZWdpc3RyeToge30sXG4gIH07XG5cbiAgY29uc3QgaG9vayA9IHJlZ2lzdGVyLmJpbmQobnVsbCwgc3RhdGUpO1xuICBiaW5kQXBpKGhvb2ssIHN0YXRlKTtcblxuICByZXR1cm4gaG9vaztcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBTaW5ndWxhciwgQ29sbGVjdGlvbiB9O1xuIiwKICAgICIvLyBwa2cvZGlzdC1zcmMvZGVmYXVsdHMuanNcbmltcG9ydCB7IGdldFVzZXJBZ2VudCB9IGZyb20gXCJ1bml2ZXJzYWwtdXNlci1hZ2VudFwiO1xuXG4vLyBwa2cvZGlzdC1zcmMvdmVyc2lvbi5qc1xudmFyIFZFUlNJT04gPSBcIjAuMC4wLWRldmVsb3BtZW50XCI7XG5cbi8vIHBrZy9kaXN0LXNyYy9kZWZhdWx0cy5qc1xudmFyIHVzZXJBZ2VudCA9IGBvY3Rva2l0LWVuZHBvaW50LmpzLyR7VkVSU0lPTn0gJHtnZXRVc2VyQWdlbnQoKX1gO1xudmFyIERFRkFVTFRTID0ge1xuICBtZXRob2Q6IFwiR0VUXCIsXG4gIGJhc2VVcmw6IFwiaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbVwiLFxuICBoZWFkZXJzOiB7XG4gICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMranNvblwiLFxuICAgIFwidXNlci1hZ2VudFwiOiB1c2VyQWdlbnRcbiAgfSxcbiAgbWVkaWFUeXBlOiB7XG4gICAgZm9ybWF0OiBcIlwiXG4gIH1cbn07XG5cbi8vIHBrZy9kaXN0LXNyYy91dGlsL2xvd2VyY2FzZS1rZXlzLmpzXG5mdW5jdGlvbiBsb3dlcmNhc2VLZXlzKG9iamVjdCkge1xuICBpZiAoIW9iamVjdCkge1xuICAgIHJldHVybiB7fTtcbiAgfVxuICByZXR1cm4gT2JqZWN0LmtleXMob2JqZWN0KS5yZWR1Y2UoKG5ld09iaiwga2V5KSA9PiB7XG4gICAgbmV3T2JqW2tleS50b0xvd2VyQ2FzZSgpXSA9IG9iamVjdFtrZXldO1xuICAgIHJldHVybiBuZXdPYmo7XG4gIH0sIHt9KTtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL3V0aWwvaXMtcGxhaW4tb2JqZWN0LmpzXG5mdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgfHwgdmFsdWUgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgIT09IFwiW29iamVjdCBPYmplY3RdXCIpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpO1xuICBpZiAocHJvdG8gPT09IG51bGwpIHJldHVybiB0cnVlO1xuICBjb25zdCBDdG9yID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHByb3RvLCBcImNvbnN0cnVjdG9yXCIpICYmIHByb3RvLmNvbnN0cnVjdG9yO1xuICByZXR1cm4gdHlwZW9mIEN0b3IgPT09IFwiZnVuY3Rpb25cIiAmJiBDdG9yIGluc3RhbmNlb2YgQ3RvciAmJiBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbChDdG9yKSA9PT0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwodmFsdWUpO1xufVxuXG4vLyBwa2cvZGlzdC1zcmMvdXRpbC9tZXJnZS1kZWVwLmpzXG5mdW5jdGlvbiBtZXJnZURlZXAoZGVmYXVsdHMsIG9wdGlvbnMpIHtcbiAgY29uc3QgcmVzdWx0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMpO1xuICBPYmplY3Qua2V5cyhvcHRpb25zKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBpZiAoaXNQbGFpbk9iamVjdChvcHRpb25zW2tleV0pKSB7XG4gICAgICBpZiAoIShrZXkgaW4gZGVmYXVsdHMpKSBPYmplY3QuYXNzaWduKHJlc3VsdCwgeyBba2V5XTogb3B0aW9uc1trZXldIH0pO1xuICAgICAgZWxzZSByZXN1bHRba2V5XSA9IG1lcmdlRGVlcChkZWZhdWx0c1trZXldLCBvcHRpb25zW2tleV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgeyBba2V5XTogb3B0aW9uc1trZXldIH0pO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIHBrZy9kaXN0LXNyYy91dGlsL3JlbW92ZS11bmRlZmluZWQtcHJvcGVydGllcy5qc1xuZnVuY3Rpb24gcmVtb3ZlVW5kZWZpbmVkUHJvcGVydGllcyhvYmopIHtcbiAgZm9yIChjb25zdCBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKG9ialtrZXldID09PSB2b2lkIDApIHtcbiAgICAgIGRlbGV0ZSBvYmpba2V5XTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iajtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL21lcmdlLmpzXG5mdW5jdGlvbiBtZXJnZShkZWZhdWx0cywgcm91dGUsIG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiByb3V0ZSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGxldCBbbWV0aG9kLCB1cmxdID0gcm91dGUuc3BsaXQoXCIgXCIpO1xuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHVybCA/IHsgbWV0aG9kLCB1cmwgfSA6IHsgdXJsOiBtZXRob2QgfSwgb3B0aW9ucyk7XG4gIH0gZWxzZSB7XG4gICAgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHJvdXRlKTtcbiAgfVxuICBvcHRpb25zLmhlYWRlcnMgPSBsb3dlcmNhc2VLZXlzKG9wdGlvbnMuaGVhZGVycyk7XG4gIHJlbW92ZVVuZGVmaW5lZFByb3BlcnRpZXMob3B0aW9ucyk7XG4gIHJlbW92ZVVuZGVmaW5lZFByb3BlcnRpZXMob3B0aW9ucy5oZWFkZXJzKTtcbiAgY29uc3QgbWVyZ2VkT3B0aW9ucyA9IG1lcmdlRGVlcChkZWZhdWx0cyB8fCB7fSwgb3B0aW9ucyk7XG4gIGlmIChvcHRpb25zLnVybCA9PT0gXCIvZ3JhcGhxbFwiKSB7XG4gICAgaWYgKGRlZmF1bHRzICYmIGRlZmF1bHRzLm1lZGlhVHlwZS5wcmV2aWV3cz8ubGVuZ3RoKSB7XG4gICAgICBtZXJnZWRPcHRpb25zLm1lZGlhVHlwZS5wcmV2aWV3cyA9IGRlZmF1bHRzLm1lZGlhVHlwZS5wcmV2aWV3cy5maWx0ZXIoXG4gICAgICAgIChwcmV2aWV3KSA9PiAhbWVyZ2VkT3B0aW9ucy5tZWRpYVR5cGUucHJldmlld3MuaW5jbHVkZXMocHJldmlldylcbiAgICAgICkuY29uY2F0KG1lcmdlZE9wdGlvbnMubWVkaWFUeXBlLnByZXZpZXdzKTtcbiAgICB9XG4gICAgbWVyZ2VkT3B0aW9ucy5tZWRpYVR5cGUucHJldmlld3MgPSAobWVyZ2VkT3B0aW9ucy5tZWRpYVR5cGUucHJldmlld3MgfHwgW10pLm1hcCgocHJldmlldykgPT4gcHJldmlldy5yZXBsYWNlKC8tcHJldmlldy8sIFwiXCIpKTtcbiAgfVxuICByZXR1cm4gbWVyZ2VkT3B0aW9ucztcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL3V0aWwvYWRkLXF1ZXJ5LXBhcmFtZXRlcnMuanNcbmZ1bmN0aW9uIGFkZFF1ZXJ5UGFyYW1ldGVycyh1cmwsIHBhcmFtZXRlcnMpIHtcbiAgY29uc3Qgc2VwYXJhdG9yID0gL1xcPy8udGVzdCh1cmwpID8gXCImXCIgOiBcIj9cIjtcbiAgY29uc3QgbmFtZXMgPSBPYmplY3Qua2V5cyhwYXJhbWV0ZXJzKTtcbiAgaWYgKG5hbWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB1cmw7XG4gIH1cbiAgcmV0dXJuIHVybCArIHNlcGFyYXRvciArIG5hbWVzLm1hcCgobmFtZSkgPT4ge1xuICAgIGlmIChuYW1lID09PSBcInFcIikge1xuICAgICAgcmV0dXJuIFwicT1cIiArIHBhcmFtZXRlcnMucS5zcGxpdChcIitcIikubWFwKGVuY29kZVVSSUNvbXBvbmVudCkuam9pbihcIitcIik7XG4gICAgfVxuICAgIHJldHVybiBgJHtuYW1lfT0ke2VuY29kZVVSSUNvbXBvbmVudChwYXJhbWV0ZXJzW25hbWVdKX1gO1xuICB9KS5qb2luKFwiJlwiKTtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL3V0aWwvZXh0cmFjdC11cmwtdmFyaWFibGUtbmFtZXMuanNcbnZhciB1cmxWYXJpYWJsZVJlZ2V4ID0gL1xce1tee319XStcXH0vZztcbmZ1bmN0aW9uIHJlbW92ZU5vbkNoYXJzKHZhcmlhYmxlTmFtZSkge1xuICByZXR1cm4gdmFyaWFibGVOYW1lLnJlcGxhY2UoLyg/Ol5cXFcrKXwoPzooPzwhXFxXKVxcVyskKS9nLCBcIlwiKS5zcGxpdCgvLC8pO1xufVxuZnVuY3Rpb24gZXh0cmFjdFVybFZhcmlhYmxlTmFtZXModXJsKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSB1cmwubWF0Y2godXJsVmFyaWFibGVSZWdleCk7XG4gIGlmICghbWF0Y2hlcykge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICByZXR1cm4gbWF0Y2hlcy5tYXAocmVtb3ZlTm9uQ2hhcnMpLnJlZHVjZSgoYSwgYikgPT4gYS5jb25jYXQoYiksIFtdKTtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL3V0aWwvb21pdC5qc1xuZnVuY3Rpb24gb21pdChvYmplY3QsIGtleXNUb09taXQpIHtcbiAgY29uc3QgcmVzdWx0ID0geyBfX3Byb3RvX186IG51bGwgfTtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqZWN0KSkge1xuICAgIGlmIChrZXlzVG9PbWl0LmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gb2JqZWN0W2tleV07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIHBrZy9kaXN0LXNyYy91dGlsL3VybC10ZW1wbGF0ZS5qc1xuZnVuY3Rpb24gZW5jb2RlUmVzZXJ2ZWQoc3RyKSB7XG4gIHJldHVybiBzdHIuc3BsaXQoLyglWzAtOUEtRmEtZl17Mn0pL2cpLm1hcChmdW5jdGlvbihwYXJ0KSB7XG4gICAgaWYgKCEvJVswLTlBLUZhLWZdLy50ZXN0KHBhcnQpKSB7XG4gICAgICBwYXJ0ID0gZW5jb2RlVVJJKHBhcnQpLnJlcGxhY2UoLyU1Qi9nLCBcIltcIikucmVwbGFjZSgvJTVEL2csIFwiXVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnQ7XG4gIH0pLmpvaW4oXCJcIik7XG59XG5mdW5jdGlvbiBlbmNvZGVVbnJlc2VydmVkKHN0cikge1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHN0cikucmVwbGFjZSgvWyEnKCkqXS9nLCBmdW5jdGlvbihjKSB7XG4gICAgcmV0dXJuIFwiJVwiICsgYy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpO1xuICB9KTtcbn1cbmZ1bmN0aW9uIGVuY29kZVZhbHVlKG9wZXJhdG9yLCB2YWx1ZSwga2V5KSB7XG4gIHZhbHVlID0gb3BlcmF0b3IgPT09IFwiK1wiIHx8IG9wZXJhdG9yID09PSBcIiNcIiA/IGVuY29kZVJlc2VydmVkKHZhbHVlKSA6IGVuY29kZVVucmVzZXJ2ZWQodmFsdWUpO1xuICBpZiAoa2V5KSB7XG4gICAgcmV0dXJuIGVuY29kZVVucmVzZXJ2ZWQoa2V5KSArIFwiPVwiICsgdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5mdW5jdGlvbiBpc0RlZmluZWQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9PSB2b2lkIDAgJiYgdmFsdWUgIT09IG51bGw7XG59XG5mdW5jdGlvbiBpc0tleU9wZXJhdG9yKG9wZXJhdG9yKSB7XG4gIHJldHVybiBvcGVyYXRvciA9PT0gXCI7XCIgfHwgb3BlcmF0b3IgPT09IFwiJlwiIHx8IG9wZXJhdG9yID09PSBcIj9cIjtcbn1cbmZ1bmN0aW9uIGdldFZhbHVlcyhjb250ZXh0LCBvcGVyYXRvciwga2V5LCBtb2RpZmllcikge1xuICB2YXIgdmFsdWUgPSBjb250ZXh0W2tleV0sIHJlc3VsdCA9IFtdO1xuICBpZiAoaXNEZWZpbmVkKHZhbHVlKSAmJiB2YWx1ZSAhPT0gXCJcIikge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIGlmIChtb2RpZmllciAmJiBtb2RpZmllciAhPT0gXCIqXCIpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMCwgcGFyc2VJbnQobW9kaWZpZXIsIDEwKSk7XG4gICAgICB9XG4gICAgICByZXN1bHQucHVzaChcbiAgICAgICAgZW5jb2RlVmFsdWUob3BlcmF0b3IsIHZhbHVlLCBpc0tleU9wZXJhdG9yKG9wZXJhdG9yKSA/IGtleSA6IFwiXCIpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobW9kaWZpZXIgPT09IFwiKlwiKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIHZhbHVlLmZpbHRlcihpc0RlZmluZWQpLmZvckVhY2goZnVuY3Rpb24odmFsdWUyKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChcbiAgICAgICAgICAgICAgZW5jb2RlVmFsdWUob3BlcmF0b3IsIHZhbHVlMiwgaXNLZXlPcGVyYXRvcihvcGVyYXRvcikgPyBrZXkgOiBcIlwiKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICBpZiAoaXNEZWZpbmVkKHZhbHVlW2tdKSkge1xuICAgICAgICAgICAgICByZXN1bHQucHVzaChlbmNvZGVWYWx1ZShvcGVyYXRvciwgdmFsdWVba10sIGspKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdG1wID0gW107XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIHZhbHVlLmZpbHRlcihpc0RlZmluZWQpLmZvckVhY2goZnVuY3Rpb24odmFsdWUyKSB7XG4gICAgICAgICAgICB0bXAucHVzaChlbmNvZGVWYWx1ZShvcGVyYXRvciwgdmFsdWUyKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgT2JqZWN0LmtleXModmFsdWUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgaWYgKGlzRGVmaW5lZCh2YWx1ZVtrXSkpIHtcbiAgICAgICAgICAgICAgdG1wLnB1c2goZW5jb2RlVW5yZXNlcnZlZChrKSk7XG4gICAgICAgICAgICAgIHRtcC5wdXNoKGVuY29kZVZhbHVlKG9wZXJhdG9yLCB2YWx1ZVtrXS50b1N0cmluZygpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzS2V5T3BlcmF0b3Iob3BlcmF0b3IpKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goZW5jb2RlVW5yZXNlcnZlZChrZXkpICsgXCI9XCIgKyB0bXAuam9pbihcIixcIikpO1xuICAgICAgICB9IGVsc2UgaWYgKHRtcC5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICByZXN1bHQucHVzaCh0bXAuam9pbihcIixcIikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChvcGVyYXRvciA9PT0gXCI7XCIpIHtcbiAgICAgIGlmIChpc0RlZmluZWQodmFsdWUpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuY29kZVVucmVzZXJ2ZWQoa2V5KSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gXCJcIiAmJiAob3BlcmF0b3IgPT09IFwiJlwiIHx8IG9wZXJhdG9yID09PSBcIj9cIikpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGVuY29kZVVucmVzZXJ2ZWQoa2V5KSArIFwiPVwiKTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBcIlwiKSB7XG4gICAgICByZXN1bHQucHVzaChcIlwiKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbmZ1bmN0aW9uIHBhcnNlVXJsKHRlbXBsYXRlKSB7XG4gIHJldHVybiB7XG4gICAgZXhwYW5kOiBleHBhbmQuYmluZChudWxsLCB0ZW1wbGF0ZSlcbiAgfTtcbn1cbmZ1bmN0aW9uIGV4cGFuZCh0ZW1wbGF0ZSwgY29udGV4dCkge1xuICB2YXIgb3BlcmF0b3JzID0gW1wiK1wiLCBcIiNcIiwgXCIuXCIsIFwiL1wiLCBcIjtcIiwgXCI/XCIsIFwiJlwiXTtcbiAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgIC9cXHsoW15cXHtcXH1dKylcXH18KFteXFx7XFx9XSspL2csXG4gICAgZnVuY3Rpb24oXywgZXhwcmVzc2lvbiwgbGl0ZXJhbCkge1xuICAgICAgaWYgKGV4cHJlc3Npb24pIHtcbiAgICAgICAgbGV0IG9wZXJhdG9yID0gXCJcIjtcbiAgICAgICAgY29uc3QgdmFsdWVzID0gW107XG4gICAgICAgIGlmIChvcGVyYXRvcnMuaW5kZXhPZihleHByZXNzaW9uLmNoYXJBdCgwKSkgIT09IC0xKSB7XG4gICAgICAgICAgb3BlcmF0b3IgPSBleHByZXNzaW9uLmNoYXJBdCgwKTtcbiAgICAgICAgICBleHByZXNzaW9uID0gZXhwcmVzc2lvbi5zdWJzdHIoMSk7XG4gICAgICAgIH1cbiAgICAgICAgZXhwcmVzc2lvbi5zcGxpdCgvLC9nKS5mb3JFYWNoKGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgICAgICAgdmFyIHRtcCA9IC8oW146XFwqXSopKD86OihcXGQrKXwoXFwqKSk/Ly5leGVjKHZhcmlhYmxlKTtcbiAgICAgICAgICB2YWx1ZXMucHVzaChnZXRWYWx1ZXMoY29udGV4dCwgb3BlcmF0b3IsIHRtcFsxXSwgdG1wWzJdIHx8IHRtcFszXSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKG9wZXJhdG9yICYmIG9wZXJhdG9yICE9PSBcIitcIikge1xuICAgICAgICAgIHZhciBzZXBhcmF0b3IgPSBcIixcIjtcbiAgICAgICAgICBpZiAob3BlcmF0b3IgPT09IFwiP1wiKSB7XG4gICAgICAgICAgICBzZXBhcmF0b3IgPSBcIiZcIjtcbiAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yICE9PSBcIiNcIikge1xuICAgICAgICAgICAgc2VwYXJhdG9yID0gb3BlcmF0b3I7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiAodmFsdWVzLmxlbmd0aCAhPT0gMCA/IG9wZXJhdG9yIDogXCJcIikgKyB2YWx1ZXMuam9pbihzZXBhcmF0b3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB2YWx1ZXMuam9pbihcIixcIik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBlbmNvZGVSZXNlcnZlZChsaXRlcmFsKTtcbiAgICAgIH1cbiAgICB9XG4gICk7XG4gIGlmICh0ZW1wbGF0ZSA9PT0gXCIvXCIpIHtcbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgfVxufVxuXG4vLyBwa2cvZGlzdC1zcmMvcGFyc2UuanNcbmZ1bmN0aW9uIHBhcnNlKG9wdGlvbnMpIHtcbiAgbGV0IG1ldGhvZCA9IG9wdGlvbnMubWV0aG9kLnRvVXBwZXJDYXNlKCk7XG4gIGxldCB1cmwgPSAob3B0aW9ucy51cmwgfHwgXCIvXCIpLnJlcGxhY2UoLzooW2Etel1cXHcrKS9nLCBcInskMX1cIik7XG4gIGxldCBoZWFkZXJzID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucy5oZWFkZXJzKTtcbiAgbGV0IGJvZHk7XG4gIGxldCBwYXJhbWV0ZXJzID0gb21pdChvcHRpb25zLCBbXG4gICAgXCJtZXRob2RcIixcbiAgICBcImJhc2VVcmxcIixcbiAgICBcInVybFwiLFxuICAgIFwiaGVhZGVyc1wiLFxuICAgIFwicmVxdWVzdFwiLFxuICAgIFwibWVkaWFUeXBlXCJcbiAgXSk7XG4gIGNvbnN0IHVybFZhcmlhYmxlTmFtZXMgPSBleHRyYWN0VXJsVmFyaWFibGVOYW1lcyh1cmwpO1xuICB1cmwgPSBwYXJzZVVybCh1cmwpLmV4cGFuZChwYXJhbWV0ZXJzKTtcbiAgaWYgKCEvXmh0dHAvLnRlc3QodXJsKSkge1xuICAgIHVybCA9IG9wdGlvbnMuYmFzZVVybCArIHVybDtcbiAgfVxuICBjb25zdCBvbWl0dGVkUGFyYW1ldGVycyA9IE9iamVjdC5rZXlzKG9wdGlvbnMpLmZpbHRlcigob3B0aW9uKSA9PiB1cmxWYXJpYWJsZU5hbWVzLmluY2x1ZGVzKG9wdGlvbikpLmNvbmNhdChcImJhc2VVcmxcIik7XG4gIGNvbnN0IHJlbWFpbmluZ1BhcmFtZXRlcnMgPSBvbWl0KHBhcmFtZXRlcnMsIG9taXR0ZWRQYXJhbWV0ZXJzKTtcbiAgY29uc3QgaXNCaW5hcnlSZXF1ZXN0ID0gL2FwcGxpY2F0aW9uXFwvb2N0ZXQtc3RyZWFtL2kudGVzdChoZWFkZXJzLmFjY2VwdCk7XG4gIGlmICghaXNCaW5hcnlSZXF1ZXN0KSB7XG4gICAgaWYgKG9wdGlvbnMubWVkaWFUeXBlLmZvcm1hdCkge1xuICAgICAgaGVhZGVycy5hY2NlcHQgPSBoZWFkZXJzLmFjY2VwdC5zcGxpdCgvLC8pLm1hcChcbiAgICAgICAgKGZvcm1hdCkgPT4gZm9ybWF0LnJlcGxhY2UoXG4gICAgICAgICAgL2FwcGxpY2F0aW9uXFwvdm5kKFxcLlxcdyspKFxcLnYzKT8oXFwuXFx3Kyk/KFxcK2pzb24pPyQvLFxuICAgICAgICAgIGBhcHBsaWNhdGlvbi92bmQkMSQyLiR7b3B0aW9ucy5tZWRpYVR5cGUuZm9ybWF0fWBcbiAgICAgICAgKVxuICAgICAgKS5qb2luKFwiLFwiKTtcbiAgICB9XG4gICAgaWYgKHVybC5lbmRzV2l0aChcIi9ncmFwaHFsXCIpKSB7XG4gICAgICBpZiAob3B0aW9ucy5tZWRpYVR5cGUucHJldmlld3M/Lmxlbmd0aCkge1xuICAgICAgICBjb25zdCBwcmV2aWV3c0Zyb21BY2NlcHRIZWFkZXIgPSBoZWFkZXJzLmFjY2VwdC5tYXRjaCgvKD88IVtcXHctXSlbXFx3LV0rKD89LXByZXZpZXcpL2cpIHx8IFtdO1xuICAgICAgICBoZWFkZXJzLmFjY2VwdCA9IHByZXZpZXdzRnJvbUFjY2VwdEhlYWRlci5jb25jYXQob3B0aW9ucy5tZWRpYVR5cGUucHJldmlld3MpLm1hcCgocHJldmlldykgPT4ge1xuICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IG9wdGlvbnMubWVkaWFUeXBlLmZvcm1hdCA/IGAuJHtvcHRpb25zLm1lZGlhVHlwZS5mb3JtYXR9YCA6IFwiK2pzb25cIjtcbiAgICAgICAgICByZXR1cm4gYGFwcGxpY2F0aW9uL3ZuZC5naXRodWIuJHtwcmV2aWV3fS1wcmV2aWV3JHtmb3JtYXR9YDtcbiAgICAgICAgfSkuam9pbihcIixcIik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChbXCJHRVRcIiwgXCJIRUFEXCJdLmluY2x1ZGVzKG1ldGhvZCkpIHtcbiAgICB1cmwgPSBhZGRRdWVyeVBhcmFtZXRlcnModXJsLCByZW1haW5pbmdQYXJhbWV0ZXJzKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoXCJkYXRhXCIgaW4gcmVtYWluaW5nUGFyYW1ldGVycykge1xuICAgICAgYm9keSA9IHJlbWFpbmluZ1BhcmFtZXRlcnMuZGF0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHJlbWFpbmluZ1BhcmFtZXRlcnMpLmxlbmd0aCkge1xuICAgICAgICBib2R5ID0gcmVtYWluaW5nUGFyYW1ldGVycztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKCFoZWFkZXJzW1wiY29udGVudC10eXBlXCJdICYmIHR5cGVvZiBib2R5ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSA9IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiO1xuICB9XG4gIGlmIChbXCJQQVRDSFwiLCBcIlBVVFwiXS5pbmNsdWRlcyhtZXRob2QpICYmIHR5cGVvZiBib2R5ID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgYm9keSA9IFwiXCI7XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oXG4gICAgeyBtZXRob2QsIHVybCwgaGVhZGVycyB9LFxuICAgIHR5cGVvZiBib2R5ICE9PSBcInVuZGVmaW5lZFwiID8geyBib2R5IH0gOiBudWxsLFxuICAgIG9wdGlvbnMucmVxdWVzdCA/IHsgcmVxdWVzdDogb3B0aW9ucy5yZXF1ZXN0IH0gOiBudWxsXG4gICk7XG59XG5cbi8vIHBrZy9kaXN0LXNyYy9lbmRwb2ludC13aXRoLWRlZmF1bHRzLmpzXG5mdW5jdGlvbiBlbmRwb2ludFdpdGhEZWZhdWx0cyhkZWZhdWx0cywgcm91dGUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIHBhcnNlKG1lcmdlKGRlZmF1bHRzLCByb3V0ZSwgb3B0aW9ucykpO1xufVxuXG4vLyBwa2cvZGlzdC1zcmMvd2l0aC1kZWZhdWx0cy5qc1xuZnVuY3Rpb24gd2l0aERlZmF1bHRzKG9sZERlZmF1bHRzLCBuZXdEZWZhdWx0cykge1xuICBjb25zdCBERUZBVUxUUzIgPSBtZXJnZShvbGREZWZhdWx0cywgbmV3RGVmYXVsdHMpO1xuICBjb25zdCBlbmRwb2ludDIgPSBlbmRwb2ludFdpdGhEZWZhdWx0cy5iaW5kKG51bGwsIERFRkFVTFRTMik7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKGVuZHBvaW50Miwge1xuICAgIERFRkFVTFRTOiBERUZBVUxUUzIsXG4gICAgZGVmYXVsdHM6IHdpdGhEZWZhdWx0cy5iaW5kKG51bGwsIERFRkFVTFRTMiksXG4gICAgbWVyZ2U6IG1lcmdlLmJpbmQobnVsbCwgREVGQVVMVFMyKSxcbiAgICBwYXJzZVxuICB9KTtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL2luZGV4LmpzXG52YXIgZW5kcG9pbnQgPSB3aXRoRGVmYXVsdHMobnVsbCwgREVGQVVMVFMpO1xuZXhwb3J0IHtcbiAgZW5kcG9pbnRcbn07XG4iLAogICAgIi8vIHBrZy9kaXN0LXNyYy9pbmRleC5qc1xuaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiQG9jdG9raXQvZW5kcG9pbnRcIjtcblxuLy8gcGtnL2Rpc3Qtc3JjL2RlZmF1bHRzLmpzXG5pbXBvcnQgeyBnZXRVc2VyQWdlbnQgfSBmcm9tIFwidW5pdmVyc2FsLXVzZXItYWdlbnRcIjtcblxuLy8gcGtnL2Rpc3Qtc3JjL3ZlcnNpb24uanNcbnZhciBWRVJTSU9OID0gXCI5LjIuNFwiO1xuXG4vLyBwa2cvZGlzdC1zcmMvZGVmYXVsdHMuanNcbnZhciBkZWZhdWx0c19kZWZhdWx0ID0ge1xuICBoZWFkZXJzOiB7XG4gICAgXCJ1c2VyLWFnZW50XCI6IGBvY3Rva2l0LXJlcXVlc3QuanMvJHtWRVJTSU9OfSAke2dldFVzZXJBZ2VudCgpfWBcbiAgfVxufTtcblxuLy8gcGtnL2Rpc3Qtc3JjL2ZldGNoLXdyYXBwZXIuanNcbmltcG9ydCB7IHNhZmVQYXJzZSB9IGZyb20gXCJmYXN0LWNvbnRlbnQtdHlwZS1wYXJzZVwiO1xuXG4vLyBwa2cvZGlzdC1zcmMvaXMtcGxhaW4tb2JqZWN0LmpzXG5mdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgfHwgdmFsdWUgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgIT09IFwiW29iamVjdCBPYmplY3RdXCIpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpO1xuICBpZiAocHJvdG8gPT09IG51bGwpIHJldHVybiB0cnVlO1xuICBjb25zdCBDdG9yID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHByb3RvLCBcImNvbnN0cnVjdG9yXCIpICYmIHByb3RvLmNvbnN0cnVjdG9yO1xuICByZXR1cm4gdHlwZW9mIEN0b3IgPT09IFwiZnVuY3Rpb25cIiAmJiBDdG9yIGluc3RhbmNlb2YgQ3RvciAmJiBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbChDdG9yKSA9PT0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwodmFsdWUpO1xufVxuXG4vLyBwa2cvZGlzdC1zcmMvZmV0Y2gtd3JhcHBlci5qc1xuaW1wb3J0IHsgUmVxdWVzdEVycm9yIH0gZnJvbSBcIkBvY3Rva2l0L3JlcXVlc3QtZXJyb3JcIjtcbmFzeW5jIGZ1bmN0aW9uIGZldGNoV3JhcHBlcihyZXF1ZXN0T3B0aW9ucykge1xuICBjb25zdCBmZXRjaCA9IHJlcXVlc3RPcHRpb25zLnJlcXVlc3Q/LmZldGNoIHx8IGdsb2JhbFRoaXMuZmV0Y2g7XG4gIGlmICghZmV0Y2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcImZldGNoIGlzIG5vdCBzZXQuIFBsZWFzZSBwYXNzIGEgZmV0Y2ggaW1wbGVtZW50YXRpb24gYXMgbmV3IE9jdG9raXQoeyByZXF1ZXN0OiB7IGZldGNoIH19KS4gTGVhcm4gbW9yZSBhdCBodHRwczovL2dpdGh1Yi5jb20vb2N0b2tpdC9vY3Rva2l0LmpzLyNmZXRjaC1taXNzaW5nXCJcbiAgICApO1xuICB9XG4gIGNvbnN0IGxvZyA9IHJlcXVlc3RPcHRpb25zLnJlcXVlc3Q/LmxvZyB8fCBjb25zb2xlO1xuICBjb25zdCBwYXJzZVN1Y2Nlc3NSZXNwb25zZUJvZHkgPSByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0Py5wYXJzZVN1Y2Nlc3NSZXNwb25zZUJvZHkgIT09IGZhbHNlO1xuICBjb25zdCBib2R5ID0gaXNQbGFpbk9iamVjdChyZXF1ZXN0T3B0aW9ucy5ib2R5KSB8fCBBcnJheS5pc0FycmF5KHJlcXVlc3RPcHRpb25zLmJvZHkpID8gSlNPTi5zdHJpbmdpZnkocmVxdWVzdE9wdGlvbnMuYm9keSkgOiByZXF1ZXN0T3B0aW9ucy5ib2R5O1xuICBjb25zdCByZXF1ZXN0SGVhZGVycyA9IE9iamVjdC5mcm9tRW50cmllcyhcbiAgICBPYmplY3QuZW50cmllcyhyZXF1ZXN0T3B0aW9ucy5oZWFkZXJzKS5tYXAoKFtuYW1lLCB2YWx1ZV0pID0+IFtcbiAgICAgIG5hbWUsXG4gICAgICBTdHJpbmcodmFsdWUpXG4gICAgXSlcbiAgKTtcbiAgbGV0IGZldGNoUmVzcG9uc2U7XG4gIHRyeSB7XG4gICAgZmV0Y2hSZXNwb25zZSA9IGF3YWl0IGZldGNoKHJlcXVlc3RPcHRpb25zLnVybCwge1xuICAgICAgbWV0aG9kOiByZXF1ZXN0T3B0aW9ucy5tZXRob2QsXG4gICAgICBib2R5LFxuICAgICAgcmVkaXJlY3Q6IHJlcXVlc3RPcHRpb25zLnJlcXVlc3Q/LnJlZGlyZWN0LFxuICAgICAgaGVhZGVyczogcmVxdWVzdEhlYWRlcnMsXG4gICAgICBzaWduYWw6IHJlcXVlc3RPcHRpb25zLnJlcXVlc3Q/LnNpZ25hbCxcbiAgICAgIC8vIGR1cGxleCBtdXN0IGJlIHNldCBpZiByZXF1ZXN0LmJvZHkgaXMgUmVhZGFibGVTdHJlYW0gb3IgQXN5bmMgSXRlcmFibGVzLlxuICAgICAgLy8gU2VlIGh0dHBzOi8vZmV0Y2guc3BlYy53aGF0d2cub3JnLyNkb20tcmVxdWVzdGluaXQtZHVwbGV4LlxuICAgICAgLi4ucmVxdWVzdE9wdGlvbnMuYm9keSAmJiB7IGR1cGxleDogXCJoYWxmXCIgfVxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxldCBtZXNzYWdlID0gXCJVbmtub3duIEVycm9yXCI7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGlmIChlcnJvci5uYW1lID09PSBcIkFib3J0RXJyb3JcIikge1xuICAgICAgICBlcnJvci5zdGF0dXMgPSA1MDA7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgICAgbWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG4gICAgICBpZiAoZXJyb3IubmFtZSA9PT0gXCJUeXBlRXJyb3JcIiAmJiBcImNhdXNlXCIgaW4gZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yLmNhdXNlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICBtZXNzYWdlID0gZXJyb3IuY2F1c2UubWVzc2FnZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZXJyb3IuY2F1c2UgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBtZXNzYWdlID0gZXJyb3IuY2F1c2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgcmVxdWVzdEVycm9yID0gbmV3IFJlcXVlc3RFcnJvcihtZXNzYWdlLCA1MDAsIHtcbiAgICAgIHJlcXVlc3Q6IHJlcXVlc3RPcHRpb25zXG4gICAgfSk7XG4gICAgcmVxdWVzdEVycm9yLmNhdXNlID0gZXJyb3I7XG4gICAgdGhyb3cgcmVxdWVzdEVycm9yO1xuICB9XG4gIGNvbnN0IHN0YXR1cyA9IGZldGNoUmVzcG9uc2Uuc3RhdHVzO1xuICBjb25zdCB1cmwgPSBmZXRjaFJlc3BvbnNlLnVybDtcbiAgY29uc3QgcmVzcG9uc2VIZWFkZXJzID0ge307XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGZldGNoUmVzcG9uc2UuaGVhZGVycykge1xuICAgIHJlc3BvbnNlSGVhZGVyc1trZXldID0gdmFsdWU7XG4gIH1cbiAgY29uc3Qgb2N0b2tpdFJlc3BvbnNlID0ge1xuICAgIHVybCxcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczogcmVzcG9uc2VIZWFkZXJzLFxuICAgIGRhdGE6IFwiXCJcbiAgfTtcbiAgaWYgKFwiZGVwcmVjYXRpb25cIiBpbiByZXNwb25zZUhlYWRlcnMpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gcmVzcG9uc2VIZWFkZXJzLmxpbmsgJiYgcmVzcG9uc2VIZWFkZXJzLmxpbmsubWF0Y2goLzwoW148Pl0rKT47IHJlbD1cImRlcHJlY2F0aW9uXCIvKTtcbiAgICBjb25zdCBkZXByZWNhdGlvbkxpbmsgPSBtYXRjaGVzICYmIG1hdGNoZXMucG9wKCk7XG4gICAgbG9nLndhcm4oXG4gICAgICBgW0BvY3Rva2l0L3JlcXVlc3RdIFwiJHtyZXF1ZXN0T3B0aW9ucy5tZXRob2R9ICR7cmVxdWVzdE9wdGlvbnMudXJsfVwiIGlzIGRlcHJlY2F0ZWQuIEl0IGlzIHNjaGVkdWxlZCB0byBiZSByZW1vdmVkIG9uICR7cmVzcG9uc2VIZWFkZXJzLnN1bnNldH0ke2RlcHJlY2F0aW9uTGluayA/IGAuIFNlZSAke2RlcHJlY2F0aW9uTGlua31gIDogXCJcIn1gXG4gICAgKTtcbiAgfVxuICBpZiAoc3RhdHVzID09PSAyMDQgfHwgc3RhdHVzID09PSAyMDUpIHtcbiAgICByZXR1cm4gb2N0b2tpdFJlc3BvbnNlO1xuICB9XG4gIGlmIChyZXF1ZXN0T3B0aW9ucy5tZXRob2QgPT09IFwiSEVBRFwiKSB7XG4gICAgaWYgKHN0YXR1cyA8IDQwMCkge1xuICAgICAgcmV0dXJuIG9jdG9raXRSZXNwb25zZTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IFJlcXVlc3RFcnJvcihmZXRjaFJlc3BvbnNlLnN0YXR1c1RleHQsIHN0YXR1cywge1xuICAgICAgcmVzcG9uc2U6IG9jdG9raXRSZXNwb25zZSxcbiAgICAgIHJlcXVlc3Q6IHJlcXVlc3RPcHRpb25zXG4gICAgfSk7XG4gIH1cbiAgaWYgKHN0YXR1cyA9PT0gMzA0KSB7XG4gICAgb2N0b2tpdFJlc3BvbnNlLmRhdGEgPSBhd2FpdCBnZXRSZXNwb25zZURhdGEoZmV0Y2hSZXNwb25zZSk7XG4gICAgdGhyb3cgbmV3IFJlcXVlc3RFcnJvcihcIk5vdCBtb2RpZmllZFwiLCBzdGF0dXMsIHtcbiAgICAgIHJlc3BvbnNlOiBvY3Rva2l0UmVzcG9uc2UsXG4gICAgICByZXF1ZXN0OiByZXF1ZXN0T3B0aW9uc1xuICAgIH0pO1xuICB9XG4gIGlmIChzdGF0dXMgPj0gNDAwKSB7XG4gICAgb2N0b2tpdFJlc3BvbnNlLmRhdGEgPSBhd2FpdCBnZXRSZXNwb25zZURhdGEoZmV0Y2hSZXNwb25zZSk7XG4gICAgdGhyb3cgbmV3IFJlcXVlc3RFcnJvcih0b0Vycm9yTWVzc2FnZShvY3Rva2l0UmVzcG9uc2UuZGF0YSksIHN0YXR1cywge1xuICAgICAgcmVzcG9uc2U6IG9jdG9raXRSZXNwb25zZSxcbiAgICAgIHJlcXVlc3Q6IHJlcXVlc3RPcHRpb25zXG4gICAgfSk7XG4gIH1cbiAgb2N0b2tpdFJlc3BvbnNlLmRhdGEgPSBwYXJzZVN1Y2Nlc3NSZXNwb25zZUJvZHkgPyBhd2FpdCBnZXRSZXNwb25zZURhdGEoZmV0Y2hSZXNwb25zZSkgOiBmZXRjaFJlc3BvbnNlLmJvZHk7XG4gIHJldHVybiBvY3Rva2l0UmVzcG9uc2U7XG59XG5hc3luYyBmdW5jdGlvbiBnZXRSZXNwb25zZURhdGEocmVzcG9uc2UpIHtcbiAgY29uc3QgY29udGVudFR5cGUgPSByZXNwb25zZS5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKTtcbiAgaWYgKCFjb250ZW50VHlwZSkge1xuICAgIHJldHVybiByZXNwb25zZS50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIik7XG4gIH1cbiAgY29uc3QgbWltZXR5cGUgPSBzYWZlUGFyc2UoY29udGVudFR5cGUpO1xuICBpZiAoaXNKU09OUmVzcG9uc2UobWltZXR5cGUpKSB7XG4gICAgbGV0IHRleHQgPSBcIlwiO1xuICAgIHRyeSB7XG4gICAgICB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gdGV4dDtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWltZXR5cGUudHlwZS5zdGFydHNXaXRoKFwidGV4dC9cIikgfHwgbWltZXR5cGUucGFyYW1ldGVycy5jaGFyc2V0Py50b0xvd2VyQ2FzZSgpID09PSBcInV0Zi04XCIpIHtcbiAgICByZXR1cm4gcmVzcG9uc2UudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZXNwb25zZS5hcnJheUJ1ZmZlcigpLmNhdGNoKCgpID0+IG5ldyBBcnJheUJ1ZmZlcigwKSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzSlNPTlJlc3BvbnNlKG1pbWV0eXBlKSB7XG4gIHJldHVybiBtaW1ldHlwZS50eXBlID09PSBcImFwcGxpY2F0aW9uL2pzb25cIiB8fCBtaW1ldHlwZS50eXBlID09PSBcImFwcGxpY2F0aW9uL3NjaW0ranNvblwiO1xufVxuZnVuY3Rpb24gdG9FcnJvck1lc3NhZ2UoZGF0YSkge1xuICBpZiAodHlwZW9mIGRhdGEgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gZGF0YTtcbiAgfVxuICBpZiAoZGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgcmV0dXJuIFwiVW5rbm93biBlcnJvclwiO1xuICB9XG4gIGlmIChcIm1lc3NhZ2VcIiBpbiBkYXRhKSB7XG4gICAgY29uc3Qgc3VmZml4ID0gXCJkb2N1bWVudGF0aW9uX3VybFwiIGluIGRhdGEgPyBgIC0gJHtkYXRhLmRvY3VtZW50YXRpb25fdXJsfWAgOiBcIlwiO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGRhdGEuZXJyb3JzKSA/IGAke2RhdGEubWVzc2FnZX06ICR7ZGF0YS5lcnJvcnMubWFwKCh2KSA9PiBKU09OLnN0cmluZ2lmeSh2KSkuam9pbihcIiwgXCIpfSR7c3VmZml4fWAgOiBgJHtkYXRhLm1lc3NhZ2V9JHtzdWZmaXh9YDtcbiAgfVxuICByZXR1cm4gYFVua25vd24gZXJyb3I6ICR7SlNPTi5zdHJpbmdpZnkoZGF0YSl9YDtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL3dpdGgtZGVmYXVsdHMuanNcbmZ1bmN0aW9uIHdpdGhEZWZhdWx0cyhvbGRFbmRwb2ludCwgbmV3RGVmYXVsdHMpIHtcbiAgY29uc3QgZW5kcG9pbnQyID0gb2xkRW5kcG9pbnQuZGVmYXVsdHMobmV3RGVmYXVsdHMpO1xuICBjb25zdCBuZXdBcGkgPSBmdW5jdGlvbihyb3V0ZSwgcGFyYW1ldGVycykge1xuICAgIGNvbnN0IGVuZHBvaW50T3B0aW9ucyA9IGVuZHBvaW50Mi5tZXJnZShyb3V0ZSwgcGFyYW1ldGVycyk7XG4gICAgaWYgKCFlbmRwb2ludE9wdGlvbnMucmVxdWVzdCB8fCAhZW5kcG9pbnRPcHRpb25zLnJlcXVlc3QuaG9vaykge1xuICAgICAgcmV0dXJuIGZldGNoV3JhcHBlcihlbmRwb2ludDIucGFyc2UoZW5kcG9pbnRPcHRpb25zKSk7XG4gICAgfVxuICAgIGNvbnN0IHJlcXVlc3QyID0gKHJvdXRlMiwgcGFyYW1ldGVyczIpID0+IHtcbiAgICAgIHJldHVybiBmZXRjaFdyYXBwZXIoXG4gICAgICAgIGVuZHBvaW50Mi5wYXJzZShlbmRwb2ludDIubWVyZ2Uocm91dGUyLCBwYXJhbWV0ZXJzMikpXG4gICAgICApO1xuICAgIH07XG4gICAgT2JqZWN0LmFzc2lnbihyZXF1ZXN0Miwge1xuICAgICAgZW5kcG9pbnQ6IGVuZHBvaW50MixcbiAgICAgIGRlZmF1bHRzOiB3aXRoRGVmYXVsdHMuYmluZChudWxsLCBlbmRwb2ludDIpXG4gICAgfSk7XG4gICAgcmV0dXJuIGVuZHBvaW50T3B0aW9ucy5yZXF1ZXN0Lmhvb2socmVxdWVzdDIsIGVuZHBvaW50T3B0aW9ucyk7XG4gIH07XG4gIHJldHVybiBPYmplY3QuYXNzaWduKG5ld0FwaSwge1xuICAgIGVuZHBvaW50OiBlbmRwb2ludDIsXG4gICAgZGVmYXVsdHM6IHdpdGhEZWZhdWx0cy5iaW5kKG51bGwsIGVuZHBvaW50MilcbiAgfSk7XG59XG5cbi8vIHBrZy9kaXN0LXNyYy9pbmRleC5qc1xudmFyIHJlcXVlc3QgPSB3aXRoRGVmYXVsdHMoZW5kcG9pbnQsIGRlZmF1bHRzX2RlZmF1bHQpO1xuZXhwb3J0IHtcbiAgcmVxdWVzdFxufTtcbiIsCiAgICAiY2xhc3MgUmVxdWVzdEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBuYW1lO1xuICAvKipcbiAgICogaHR0cCBzdGF0dXMgY29kZVxuICAgKi9cbiAgc3RhdHVzO1xuICAvKipcbiAgICogUmVxdWVzdCBvcHRpb25zIHRoYXQgbGVhZCB0byB0aGUgZXJyb3IuXG4gICAqL1xuICByZXF1ZXN0O1xuICAvKipcbiAgICogUmVzcG9uc2Ugb2JqZWN0IGlmIGEgcmVzcG9uc2Ugd2FzIHJlY2VpdmVkXG4gICAqL1xuICByZXNwb25zZTtcbiAgY29uc3RydWN0b3IobWVzc2FnZSwgc3RhdHVzQ29kZSwgb3B0aW9ucykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiSHR0cEVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXMgPSBOdW1iZXIucGFyc2VJbnQoc3RhdHVzQ29kZSk7XG4gICAgaWYgKE51bWJlci5pc05hTih0aGlzLnN0YXR1cykpIHtcbiAgICAgIHRoaXMuc3RhdHVzID0gMDtcbiAgICB9XG4gICAgaWYgKFwicmVzcG9uc2VcIiBpbiBvcHRpb25zKSB7XG4gICAgICB0aGlzLnJlc3BvbnNlID0gb3B0aW9ucy5yZXNwb25zZTtcbiAgICB9XG4gICAgY29uc3QgcmVxdWVzdENvcHkgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLnJlcXVlc3QpO1xuICAgIGlmIChvcHRpb25zLnJlcXVlc3QuaGVhZGVycy5hdXRob3JpemF0aW9uKSB7XG4gICAgICByZXF1ZXN0Q29weS5oZWFkZXJzID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucy5yZXF1ZXN0LmhlYWRlcnMsIHtcbiAgICAgICAgYXV0aG9yaXphdGlvbjogb3B0aW9ucy5yZXF1ZXN0LmhlYWRlcnMuYXV0aG9yaXphdGlvbi5yZXBsYWNlKFxuICAgICAgICAgIC8oPzwhICkgLiokLyxcbiAgICAgICAgICBcIiBbUkVEQUNURURdXCJcbiAgICAgICAgKVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJlcXVlc3RDb3B5LnVybCA9IHJlcXVlc3RDb3B5LnVybC5yZXBsYWNlKC9cXGJjbGllbnRfc2VjcmV0PVxcdysvZywgXCJjbGllbnRfc2VjcmV0PVtSRURBQ1RFRF1cIikucmVwbGFjZSgvXFxiYWNjZXNzX3Rva2VuPVxcdysvZywgXCJhY2Nlc3NfdG9rZW49W1JFREFDVEVEXVwiKTtcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0Q29weTtcbiAgfVxufVxuZXhwb3J0IHtcbiAgUmVxdWVzdEVycm9yXG59O1xuIiwKICAgICIvLyBwa2cvZGlzdC1zcmMvaW5kZXguanNcbmltcG9ydCB7IHJlcXVlc3QgfSBmcm9tIFwiQG9jdG9raXQvcmVxdWVzdFwiO1xuaW1wb3J0IHsgZ2V0VXNlckFnZW50IH0gZnJvbSBcInVuaXZlcnNhbC11c2VyLWFnZW50XCI7XG5cbi8vIHBrZy9kaXN0LXNyYy92ZXJzaW9uLmpzXG52YXIgVkVSU0lPTiA9IFwiMC4wLjAtZGV2ZWxvcG1lbnRcIjtcblxuLy8gcGtnL2Rpc3Qtc3JjL3dpdGgtZGVmYXVsdHMuanNcbmltcG9ydCB7IHJlcXVlc3QgYXMgUmVxdWVzdDIgfSBmcm9tIFwiQG9jdG9raXQvcmVxdWVzdFwiO1xuXG4vLyBwa2cvZGlzdC1zcmMvZ3JhcGhxbC5qc1xuaW1wb3J0IHsgcmVxdWVzdCBhcyBSZXF1ZXN0IH0gZnJvbSBcIkBvY3Rva2l0L3JlcXVlc3RcIjtcblxuLy8gcGtnL2Rpc3Qtc3JjL2Vycm9yLmpzXG5mdW5jdGlvbiBfYnVpbGRNZXNzYWdlRm9yUmVzcG9uc2VFcnJvcnMoZGF0YSkge1xuICByZXR1cm4gYFJlcXVlc3QgZmFpbGVkIGR1ZSB0byBmb2xsb3dpbmcgcmVzcG9uc2UgZXJyb3JzOlxuYCArIGRhdGEuZXJyb3JzLm1hcCgoZSkgPT4gYCAtICR7ZS5tZXNzYWdlfWApLmpvaW4oXCJcXG5cIik7XG59XG52YXIgR3JhcGhxbFJlc3BvbnNlRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IocmVxdWVzdDIsIGhlYWRlcnMsIHJlc3BvbnNlKSB7XG4gICAgc3VwZXIoX2J1aWxkTWVzc2FnZUZvclJlc3BvbnNlRXJyb3JzKHJlc3BvbnNlKSk7XG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdDI7XG4gICAgdGhpcy5oZWFkZXJzID0gaGVhZGVycztcbiAgICB0aGlzLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgdGhpcy5lcnJvcnMgPSByZXNwb25zZS5lcnJvcnM7XG4gICAgdGhpcy5kYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICBpZiAoRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpO1xuICAgIH1cbiAgfVxuICBuYW1lID0gXCJHcmFwaHFsUmVzcG9uc2VFcnJvclwiO1xuICBlcnJvcnM7XG4gIGRhdGE7XG59O1xuXG4vLyBwa2cvZGlzdC1zcmMvZ3JhcGhxbC5qc1xudmFyIE5PTl9WQVJJQUJMRV9PUFRJT05TID0gW1xuICBcIm1ldGhvZFwiLFxuICBcImJhc2VVcmxcIixcbiAgXCJ1cmxcIixcbiAgXCJoZWFkZXJzXCIsXG4gIFwicmVxdWVzdFwiLFxuICBcInF1ZXJ5XCIsXG4gIFwibWVkaWFUeXBlXCIsXG4gIFwib3BlcmF0aW9uTmFtZVwiXG5dO1xudmFyIEZPUkJJRERFTl9WQVJJQUJMRV9PUFRJT05TID0gW1wicXVlcnlcIiwgXCJtZXRob2RcIiwgXCJ1cmxcIl07XG52YXIgR0hFU19WM19TVUZGSVhfUkVHRVggPSAvXFwvYXBpXFwvdjNcXC8/JC87XG5mdW5jdGlvbiBncmFwaHFsKHJlcXVlc3QyLCBxdWVyeSwgb3B0aW9ucykge1xuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2YgcXVlcnkgPT09IFwic3RyaW5nXCIgJiYgXCJxdWVyeVwiIGluIG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcbiAgICAgICAgbmV3IEVycm9yKGBbQG9jdG9raXQvZ3JhcGhxbF0gXCJxdWVyeVwiIGNhbm5vdCBiZSB1c2VkIGFzIHZhcmlhYmxlIG5hbWVgKVxuICAgICAgKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBrZXkgaW4gb3B0aW9ucykge1xuICAgICAgaWYgKCFGT1JCSURERU5fVkFSSUFCTEVfT1BUSU9OUy5pbmNsdWRlcyhrZXkpKSBjb250aW51ZTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcbiAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgIGBbQG9jdG9raXQvZ3JhcGhxbF0gXCIke2tleX1cIiBjYW5ub3QgYmUgdXNlZCBhcyB2YXJpYWJsZSBuYW1lYFxuICAgICAgICApXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBjb25zdCBwYXJzZWRPcHRpb25zID0gdHlwZW9mIHF1ZXJ5ID09PSBcInN0cmluZ1wiID8gT2JqZWN0LmFzc2lnbih7IHF1ZXJ5IH0sIG9wdGlvbnMpIDogcXVlcnk7XG4gIGNvbnN0IHJlcXVlc3RPcHRpb25zID0gT2JqZWN0LmtleXMoXG4gICAgcGFyc2VkT3B0aW9uc1xuICApLnJlZHVjZSgocmVzdWx0LCBrZXkpID0+IHtcbiAgICBpZiAoTk9OX1ZBUklBQkxFX09QVElPTlMuaW5jbHVkZXMoa2V5KSkge1xuICAgICAgcmVzdWx0W2tleV0gPSBwYXJzZWRPcHRpb25zW2tleV07XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBpZiAoIXJlc3VsdC52YXJpYWJsZXMpIHtcbiAgICAgIHJlc3VsdC52YXJpYWJsZXMgPSB7fTtcbiAgICB9XG4gICAgcmVzdWx0LnZhcmlhYmxlc1trZXldID0gcGFyc2VkT3B0aW9uc1trZXldO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sIHt9KTtcbiAgY29uc3QgYmFzZVVybCA9IHBhcnNlZE9wdGlvbnMuYmFzZVVybCB8fCByZXF1ZXN0Mi5lbmRwb2ludC5ERUZBVUxUUy5iYXNlVXJsO1xuICBpZiAoR0hFU19WM19TVUZGSVhfUkVHRVgudGVzdChiYXNlVXJsKSkge1xuICAgIHJlcXVlc3RPcHRpb25zLnVybCA9IGJhc2VVcmwucmVwbGFjZShHSEVTX1YzX1NVRkZJWF9SRUdFWCwgXCIvYXBpL2dyYXBocWxcIik7XG4gIH1cbiAgcmV0dXJuIHJlcXVlc3QyKHJlcXVlc3RPcHRpb25zKS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgIGlmIChyZXNwb25zZS5kYXRhLmVycm9ycykge1xuICAgICAgY29uc3QgaGVhZGVycyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMocmVzcG9uc2UuaGVhZGVycykpIHtcbiAgICAgICAgaGVhZGVyc1trZXldID0gcmVzcG9uc2UuaGVhZGVyc1trZXldO1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IEdyYXBocWxSZXNwb25zZUVycm9yKFxuICAgICAgICByZXF1ZXN0T3B0aW9ucyxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgcmVzcG9uc2UuZGF0YVxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGEuZGF0YTtcbiAgfSk7XG59XG5cbi8vIHBrZy9kaXN0LXNyYy93aXRoLWRlZmF1bHRzLmpzXG5mdW5jdGlvbiB3aXRoRGVmYXVsdHMocmVxdWVzdDIsIG5ld0RlZmF1bHRzKSB7XG4gIGNvbnN0IG5ld1JlcXVlc3QgPSByZXF1ZXN0Mi5kZWZhdWx0cyhuZXdEZWZhdWx0cyk7XG4gIGNvbnN0IG5ld0FwaSA9IChxdWVyeSwgb3B0aW9ucykgPT4ge1xuICAgIHJldHVybiBncmFwaHFsKG5ld1JlcXVlc3QsIHF1ZXJ5LCBvcHRpb25zKTtcbiAgfTtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24obmV3QXBpLCB7XG4gICAgZGVmYXVsdHM6IHdpdGhEZWZhdWx0cy5iaW5kKG51bGwsIG5ld1JlcXVlc3QpLFxuICAgIGVuZHBvaW50OiBuZXdSZXF1ZXN0LmVuZHBvaW50XG4gIH0pO1xufVxuXG4vLyBwa2cvZGlzdC1zcmMvaW5kZXguanNcbnZhciBncmFwaHFsMiA9IHdpdGhEZWZhdWx0cyhyZXF1ZXN0LCB7XG4gIGhlYWRlcnM6IHtcbiAgICBcInVzZXItYWdlbnRcIjogYG9jdG9raXQtZ3JhcGhxbC5qcy8ke1ZFUlNJT059ICR7Z2V0VXNlckFnZW50KCl9YFxuICB9LFxuICBtZXRob2Q6IFwiUE9TVFwiLFxuICB1cmw6IFwiL2dyYXBocWxcIlxufSk7XG5mdW5jdGlvbiB3aXRoQ3VzdG9tUmVxdWVzdChjdXN0b21SZXF1ZXN0KSB7XG4gIHJldHVybiB3aXRoRGVmYXVsdHMoY3VzdG9tUmVxdWVzdCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgdXJsOiBcIi9ncmFwaHFsXCJcbiAgfSk7XG59XG5leHBvcnQge1xuICBHcmFwaHFsUmVzcG9uc2VFcnJvcixcbiAgZ3JhcGhxbDIgYXMgZ3JhcGhxbCxcbiAgd2l0aEN1c3RvbVJlcXVlc3Rcbn07XG4iLAogICAgIi8vIHBrZy9kaXN0LXNyYy9pcy1qd3QuanNcbnZhciBiNjR1cmwgPSBcIig/OlthLXpBLVowLTlfLV0rKVwiO1xudmFyIHNlcCA9IFwiXFxcXC5cIjtcbnZhciBqd3RSRSA9IG5ldyBSZWdFeHAoYF4ke2I2NHVybH0ke3NlcH0ke2I2NHVybH0ke3NlcH0ke2I2NHVybH0kYCk7XG52YXIgaXNKV1QgPSBqd3RSRS50ZXN0LmJpbmQoand0UkUpO1xuXG4vLyBwa2cvZGlzdC1zcmMvYXV0aC5qc1xuYXN5bmMgZnVuY3Rpb24gYXV0aCh0b2tlbikge1xuICBjb25zdCBpc0FwcCA9IGlzSldUKHRva2VuKTtcbiAgY29uc3QgaXNJbnN0YWxsYXRpb24gPSB0b2tlbi5zdGFydHNXaXRoKFwidjEuXCIpIHx8IHRva2VuLnN0YXJ0c1dpdGgoXCJnaHNfXCIpO1xuICBjb25zdCBpc1VzZXJUb1NlcnZlciA9IHRva2VuLnN0YXJ0c1dpdGgoXCJnaHVfXCIpO1xuICBjb25zdCB0b2tlblR5cGUgPSBpc0FwcCA/IFwiYXBwXCIgOiBpc0luc3RhbGxhdGlvbiA/IFwiaW5zdGFsbGF0aW9uXCIgOiBpc1VzZXJUb1NlcnZlciA/IFwidXNlci10by1zZXJ2ZXJcIiA6IFwib2F1dGhcIjtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBcInRva2VuXCIsXG4gICAgdG9rZW4sXG4gICAgdG9rZW5UeXBlXG4gIH07XG59XG5cbi8vIHBrZy9kaXN0LXNyYy93aXRoLWF1dGhvcml6YXRpb24tcHJlZml4LmpzXG5mdW5jdGlvbiB3aXRoQXV0aG9yaXphdGlvblByZWZpeCh0b2tlbikge1xuICBpZiAodG9rZW4uc3BsaXQoL1xcLi8pLmxlbmd0aCA9PT0gMykge1xuICAgIHJldHVybiBgYmVhcmVyICR7dG9rZW59YDtcbiAgfVxuICByZXR1cm4gYHRva2VuICR7dG9rZW59YDtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL2hvb2suanNcbmFzeW5jIGZ1bmN0aW9uIGhvb2sodG9rZW4sIHJlcXVlc3QsIHJvdXRlLCBwYXJhbWV0ZXJzKSB7XG4gIGNvbnN0IGVuZHBvaW50ID0gcmVxdWVzdC5lbmRwb2ludC5tZXJnZShcbiAgICByb3V0ZSxcbiAgICBwYXJhbWV0ZXJzXG4gICk7XG4gIGVuZHBvaW50LmhlYWRlcnMuYXV0aG9yaXphdGlvbiA9IHdpdGhBdXRob3JpemF0aW9uUHJlZml4KHRva2VuKTtcbiAgcmV0dXJuIHJlcXVlc3QoZW5kcG9pbnQpO1xufVxuXG4vLyBwa2cvZGlzdC1zcmMvaW5kZXguanNcbnZhciBjcmVhdGVUb2tlbkF1dGggPSBmdW5jdGlvbiBjcmVhdGVUb2tlbkF1dGgyKHRva2VuKSB7XG4gIGlmICghdG9rZW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJbQG9jdG9raXQvYXV0aC10b2tlbl0gTm8gdG9rZW4gcGFzc2VkIHRvIGNyZWF0ZVRva2VuQXV0aFwiKTtcbiAgfVxuICBpZiAodHlwZW9mIHRva2VuICE9PSBcInN0cmluZ1wiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJbQG9jdG9raXQvYXV0aC10b2tlbl0gVG9rZW4gcGFzc2VkIHRvIGNyZWF0ZVRva2VuQXV0aCBpcyBub3QgYSBzdHJpbmdcIlxuICAgICk7XG4gIH1cbiAgdG9rZW4gPSB0b2tlbi5yZXBsYWNlKC9eKHRva2VufGJlYXJlcikgKy9pLCBcIlwiKTtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYXV0aC5iaW5kKG51bGwsIHRva2VuKSwge1xuICAgIGhvb2s6IGhvb2suYmluZChudWxsLCB0b2tlbilcbiAgfSk7XG59O1xuZXhwb3J0IHtcbiAgY3JlYXRlVG9rZW5BdXRoXG59O1xuIiwKICAgICJjb25zdCBWRVJTSU9OID0gXCI2LjEuNlwiO1xuZXhwb3J0IHtcbiAgVkVSU0lPTlxufTtcbiIsCiAgICAiaW1wb3J0IHsgZ2V0VXNlckFnZW50IH0gZnJvbSBcInVuaXZlcnNhbC11c2VyLWFnZW50XCI7XG5pbXBvcnQgSG9vayBmcm9tIFwiYmVmb3JlLWFmdGVyLWhvb2tcIjtcbmltcG9ydCB7IHJlcXVlc3QgfSBmcm9tIFwiQG9jdG9raXQvcmVxdWVzdFwiO1xuaW1wb3J0IHsgd2l0aEN1c3RvbVJlcXVlc3QgfSBmcm9tIFwiQG9jdG9raXQvZ3JhcGhxbFwiO1xuaW1wb3J0IHsgY3JlYXRlVG9rZW5BdXRoIH0gZnJvbSBcIkBvY3Rva2l0L2F1dGgtdG9rZW5cIjtcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XG5jb25zdCBub29wID0gKCkgPT4ge1xufTtcbmNvbnN0IGNvbnNvbGVXYXJuID0gY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5jb25zdCBjb25zb2xlRXJyb3IgPSBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSk7XG5mdW5jdGlvbiBjcmVhdGVMb2dnZXIobG9nZ2VyID0ge30pIHtcbiAgaWYgKHR5cGVvZiBsb2dnZXIuZGVidWcgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIGxvZ2dlci5kZWJ1ZyA9IG5vb3A7XG4gIH1cbiAgaWYgKHR5cGVvZiBsb2dnZXIuaW5mbyAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgbG9nZ2VyLmluZm8gPSBub29wO1xuICB9XG4gIGlmICh0eXBlb2YgbG9nZ2VyLndhcm4gIT09IFwiZnVuY3Rpb25cIikge1xuICAgIGxvZ2dlci53YXJuID0gY29uc29sZVdhcm47XG4gIH1cbiAgaWYgKHR5cGVvZiBsb2dnZXIuZXJyb3IgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIGxvZ2dlci5lcnJvciA9IGNvbnNvbGVFcnJvcjtcbiAgfVxuICByZXR1cm4gbG9nZ2VyO1xufVxuY29uc3QgdXNlckFnZW50VHJhaWwgPSBgb2N0b2tpdC1jb3JlLmpzLyR7VkVSU0lPTn0gJHtnZXRVc2VyQWdlbnQoKX1gO1xuY2xhc3MgT2N0b2tpdCB7XG4gIHN0YXRpYyBWRVJTSU9OID0gVkVSU0lPTjtcbiAgc3RhdGljIGRlZmF1bHRzKGRlZmF1bHRzKSB7XG4gICAgY29uc3QgT2N0b2tpdFdpdGhEZWZhdWx0cyA9IGNsYXNzIGV4dGVuZHMgdGhpcyB7XG4gICAgICBjb25zdHJ1Y3RvciguLi5hcmdzKSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdIHx8IHt9O1xuICAgICAgICBpZiAodHlwZW9mIGRlZmF1bHRzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBzdXBlcihkZWZhdWx0cyhvcHRpb25zKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN1cGVyKFxuICAgICAgICAgIE9iamVjdC5hc3NpZ24oXG4gICAgICAgICAgICB7fSxcbiAgICAgICAgICAgIGRlZmF1bHRzLFxuICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgIG9wdGlvbnMudXNlckFnZW50ICYmIGRlZmF1bHRzLnVzZXJBZ2VudCA/IHtcbiAgICAgICAgICAgICAgdXNlckFnZW50OiBgJHtvcHRpb25zLnVzZXJBZ2VudH0gJHtkZWZhdWx0cy51c2VyQWdlbnR9YFxuICAgICAgICAgICAgfSA6IG51bGxcbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gT2N0b2tpdFdpdGhEZWZhdWx0cztcbiAgfVxuICBzdGF0aWMgcGx1Z2lucyA9IFtdO1xuICAvKipcbiAgICogQXR0YWNoIGEgcGx1Z2luIChvciBtYW55KSB0byB5b3VyIE9jdG9raXQgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IEFQSSA9IE9jdG9raXQucGx1Z2luKHBsdWdpbjEsIHBsdWdpbjIsIHBsdWdpbjMsIC4uLilcbiAgICovXG4gIHN0YXRpYyBwbHVnaW4oLi4ubmV3UGx1Z2lucykge1xuICAgIGNvbnN0IGN1cnJlbnRQbHVnaW5zID0gdGhpcy5wbHVnaW5zO1xuICAgIGNvbnN0IE5ld09jdG9raXQgPSBjbGFzcyBleHRlbmRzIHRoaXMge1xuICAgICAgc3RhdGljIHBsdWdpbnMgPSBjdXJyZW50UGx1Z2lucy5jb25jYXQoXG4gICAgICAgIG5ld1BsdWdpbnMuZmlsdGVyKChwbHVnaW4pID0+ICFjdXJyZW50UGx1Z2lucy5pbmNsdWRlcyhwbHVnaW4pKVxuICAgICAgKTtcbiAgICB9O1xuICAgIHJldHVybiBOZXdPY3Rva2l0O1xuICB9XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IGhvb2sgPSBuZXcgSG9vay5Db2xsZWN0aW9uKCk7XG4gICAgY29uc3QgcmVxdWVzdERlZmF1bHRzID0ge1xuICAgICAgYmFzZVVybDogcmVxdWVzdC5lbmRwb2ludC5ERUZBVUxUUy5iYXNlVXJsLFxuICAgICAgaGVhZGVyczoge30sXG4gICAgICByZXF1ZXN0OiBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLnJlcXVlc3QsIHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZSBpbnRlcm5hbCB1c2FnZSBvbmx5LCBubyBuZWVkIHRvIHR5cGVcbiAgICAgICAgaG9vazogaG9vay5iaW5kKG51bGwsIFwicmVxdWVzdFwiKVxuICAgICAgfSksXG4gICAgICBtZWRpYVR5cGU6IHtcbiAgICAgICAgcHJldmlld3M6IFtdLFxuICAgICAgICBmb3JtYXQ6IFwiXCJcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlcXVlc3REZWZhdWx0cy5oZWFkZXJzW1widXNlci1hZ2VudFwiXSA9IG9wdGlvbnMudXNlckFnZW50ID8gYCR7b3B0aW9ucy51c2VyQWdlbnR9ICR7dXNlckFnZW50VHJhaWx9YCA6IHVzZXJBZ2VudFRyYWlsO1xuICAgIGlmIChvcHRpb25zLmJhc2VVcmwpIHtcbiAgICAgIHJlcXVlc3REZWZhdWx0cy5iYXNlVXJsID0gb3B0aW9ucy5iYXNlVXJsO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy5wcmV2aWV3cykge1xuICAgICAgcmVxdWVzdERlZmF1bHRzLm1lZGlhVHlwZS5wcmV2aWV3cyA9IG9wdGlvbnMucHJldmlld3M7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnRpbWVab25lKSB7XG4gICAgICByZXF1ZXN0RGVmYXVsdHMuaGVhZGVyc1tcInRpbWUtem9uZVwiXSA9IG9wdGlvbnMudGltZVpvbmU7XG4gICAgfVxuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3QuZGVmYXVsdHMocmVxdWVzdERlZmF1bHRzKTtcbiAgICB0aGlzLmdyYXBocWwgPSB3aXRoQ3VzdG9tUmVxdWVzdCh0aGlzLnJlcXVlc3QpLmRlZmF1bHRzKHJlcXVlc3REZWZhdWx0cyk7XG4gICAgdGhpcy5sb2cgPSBjcmVhdGVMb2dnZXIob3B0aW9ucy5sb2cpO1xuICAgIHRoaXMuaG9vayA9IGhvb2s7XG4gICAgaWYgKCFvcHRpb25zLmF1dGhTdHJhdGVneSkge1xuICAgICAgaWYgKCFvcHRpb25zLmF1dGgpIHtcbiAgICAgICAgdGhpcy5hdXRoID0gYXN5bmMgKCkgPT4gKHtcbiAgICAgICAgICB0eXBlOiBcInVuYXV0aGVudGljYXRlZFwiXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYXV0aCA9IGNyZWF0ZVRva2VuQXV0aChvcHRpb25zLmF1dGgpO1xuICAgICAgICBob29rLndyYXAoXCJyZXF1ZXN0XCIsIGF1dGguaG9vayk7XG4gICAgICAgIHRoaXMuYXV0aCA9IGF1dGg7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgYXV0aFN0cmF0ZWd5LCAuLi5vdGhlck9wdGlvbnMgfSA9IG9wdGlvbnM7XG4gICAgICBjb25zdCBhdXRoID0gYXV0aFN0cmF0ZWd5KFxuICAgICAgICBPYmplY3QuYXNzaWduKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJlcXVlc3Q6IHRoaXMucmVxdWVzdCxcbiAgICAgICAgICAgIGxvZzogdGhpcy5sb2csXG4gICAgICAgICAgICAvLyB3ZSBwYXNzIHRoZSBjdXJyZW50IG9jdG9raXQgaW5zdGFuY2UgYXMgd2VsbCBhcyBpdHMgY29uc3RydWN0b3Igb3B0aW9uc1xuICAgICAgICAgICAgLy8gdG8gYWxsb3cgZm9yIGF1dGhlbnRpY2F0aW9uIHN0cmF0ZWdpZXMgdGhhdCByZXR1cm4gYSBuZXcgb2N0b2tpdCBpbnN0YW5jZVxuICAgICAgICAgICAgLy8gdGhhdCBzaGFyZXMgdGhlIHNhbWUgaW50ZXJuYWwgc3RhdGUgYXMgdGhlIGN1cnJlbnQgb25lLiBUaGUgb3JpZ2luYWxcbiAgICAgICAgICAgIC8vIHJlcXVpcmVtZW50IGZvciB0aGlzIHdhcyB0aGUgXCJldmVudC1vY3Rva2l0XCIgYXV0aGVudGljYXRpb24gc3RyYXRlZ3lcbiAgICAgICAgICAgIC8vIG9mIGh0dHBzOi8vZ2l0aHViLmNvbS9wcm9ib3Qvb2N0b2tpdC1hdXRoLXByb2JvdC5cbiAgICAgICAgICAgIG9jdG9raXQ6IHRoaXMsXG4gICAgICAgICAgICBvY3Rva2l0T3B0aW9uczogb3RoZXJPcHRpb25zXG4gICAgICAgICAgfSxcbiAgICAgICAgICBvcHRpb25zLmF1dGhcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICAgIGhvb2sud3JhcChcInJlcXVlc3RcIiwgYXV0aC5ob29rKTtcbiAgICAgIHRoaXMuYXV0aCA9IGF1dGg7XG4gICAgfVxuICAgIGNvbnN0IGNsYXNzQ29uc3RydWN0b3IgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xhc3NDb25zdHJ1Y3Rvci5wbHVnaW5zLmxlbmd0aDsgKytpKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMsIGNsYXNzQ29uc3RydWN0b3IucGx1Z2luc1tpXSh0aGlzLCBvcHRpb25zKSk7XG4gICAgfVxuICB9XG4gIC8vIGFzc2lnbmVkIGR1cmluZyBjb25zdHJ1Y3RvclxuICByZXF1ZXN0O1xuICBncmFwaHFsO1xuICBsb2c7XG4gIGhvb2s7XG4gIC8vIFRPRE86IHR5cGUgYG9jdG9raXQuYXV0aGAgYmFzZWQgb24gcGFzc2VkIG9wdGlvbnMuYXV0aFN0cmF0ZWd5XG4gIGF1dGg7XG59XG5leHBvcnQge1xuICBPY3Rva2l0XG59O1xuIiwKICAgICJjb25zdCBWRVJTSU9OID0gXCI1LjMuMVwiO1xuZXhwb3J0IHtcbiAgVkVSU0lPTlxufTtcbiIsCiAgICAiaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb24uanNcIjtcbmZ1bmN0aW9uIHJlcXVlc3RMb2cob2N0b2tpdCkge1xuICBvY3Rva2l0Lmhvb2sud3JhcChcInJlcXVlc3RcIiwgKHJlcXVlc3QsIG9wdGlvbnMpID0+IHtcbiAgICBvY3Rva2l0LmxvZy5kZWJ1ZyhcInJlcXVlc3RcIiwgb3B0aW9ucyk7XG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IHJlcXVlc3RPcHRpb25zID0gb2N0b2tpdC5yZXF1ZXN0LmVuZHBvaW50LnBhcnNlKG9wdGlvbnMpO1xuICAgIGNvbnN0IHBhdGggPSByZXF1ZXN0T3B0aW9ucy51cmwucmVwbGFjZShvcHRpb25zLmJhc2VVcmwsIFwiXCIpO1xuICAgIHJldHVybiByZXF1ZXN0KG9wdGlvbnMpLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICBjb25zdCByZXF1ZXN0SWQgPSByZXNwb25zZS5oZWFkZXJzW1wieC1naXRodWItcmVxdWVzdC1pZFwiXTtcbiAgICAgIG9jdG9raXQubG9nLmluZm8oXG4gICAgICAgIGAke3JlcXVlc3RPcHRpb25zLm1ldGhvZH0gJHtwYXRofSAtICR7cmVzcG9uc2Uuc3RhdHVzfSB3aXRoIGlkICR7cmVxdWVzdElkfSBpbiAke0RhdGUubm93KCkgLSBzdGFydH1tc2BcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICBjb25zdCByZXF1ZXN0SWQgPSBlcnJvci5yZXNwb25zZT8uaGVhZGVyc1tcIngtZ2l0aHViLXJlcXVlc3QtaWRcIl0gfHwgXCJVTktOT1dOXCI7XG4gICAgICBvY3Rva2l0LmxvZy5lcnJvcihcbiAgICAgICAgYCR7cmVxdWVzdE9wdGlvbnMubWV0aG9kfSAke3BhdGh9IC0gJHtlcnJvci5zdGF0dXN9IHdpdGggaWQgJHtyZXF1ZXN0SWR9IGluICR7RGF0ZS5ub3coKSAtIHN0YXJ0fW1zYFxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH0pO1xuICB9KTtcbn1cbnJlcXVlc3RMb2cuVkVSU0lPTiA9IFZFUlNJT047XG5leHBvcnQge1xuICByZXF1ZXN0TG9nXG59O1xuIiwKICAgICIvLyBwa2cvZGlzdC1zcmMvdmVyc2lvbi5qc1xudmFyIFZFUlNJT04gPSBcIjAuMC4wLWRldmVsb3BtZW50XCI7XG5cbi8vIHBrZy9kaXN0LXNyYy9ub3JtYWxpemUtcGFnaW5hdGVkLWxpc3QtcmVzcG9uc2UuanNcbmZ1bmN0aW9uIG5vcm1hbGl6ZVBhZ2luYXRlZExpc3RSZXNwb25zZShyZXNwb25zZSkge1xuICBpZiAoIXJlc3BvbnNlLmRhdGEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4ucmVzcG9uc2UsXG4gICAgICBkYXRhOiBbXVxuICAgIH07XG4gIH1cbiAgY29uc3QgcmVzcG9uc2VOZWVkc05vcm1hbGl6YXRpb24gPSBcInRvdGFsX2NvdW50XCIgaW4gcmVzcG9uc2UuZGF0YSAmJiAhKFwidXJsXCIgaW4gcmVzcG9uc2UuZGF0YSk7XG4gIGlmICghcmVzcG9uc2VOZWVkc05vcm1hbGl6YXRpb24pIHJldHVybiByZXNwb25zZTtcbiAgY29uc3QgaW5jb21wbGV0ZVJlc3VsdHMgPSByZXNwb25zZS5kYXRhLmluY29tcGxldGVfcmVzdWx0cztcbiAgY29uc3QgcmVwb3NpdG9yeVNlbGVjdGlvbiA9IHJlc3BvbnNlLmRhdGEucmVwb3NpdG9yeV9zZWxlY3Rpb247XG4gIGNvbnN0IHRvdGFsQ291bnQgPSByZXNwb25zZS5kYXRhLnRvdGFsX2NvdW50O1xuICBkZWxldGUgcmVzcG9uc2UuZGF0YS5pbmNvbXBsZXRlX3Jlc3VsdHM7XG4gIGRlbGV0ZSByZXNwb25zZS5kYXRhLnJlcG9zaXRvcnlfc2VsZWN0aW9uO1xuICBkZWxldGUgcmVzcG9uc2UuZGF0YS50b3RhbF9jb3VudDtcbiAgY29uc3QgbmFtZXNwYWNlS2V5ID0gT2JqZWN0LmtleXMocmVzcG9uc2UuZGF0YSlbMF07XG4gIGNvbnN0IGRhdGEgPSByZXNwb25zZS5kYXRhW25hbWVzcGFjZUtleV07XG4gIHJlc3BvbnNlLmRhdGEgPSBkYXRhO1xuICBpZiAodHlwZW9mIGluY29tcGxldGVSZXN1bHRzICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgcmVzcG9uc2UuZGF0YS5pbmNvbXBsZXRlX3Jlc3VsdHMgPSBpbmNvbXBsZXRlUmVzdWx0cztcbiAgfVxuICBpZiAodHlwZW9mIHJlcG9zaXRvcnlTZWxlY3Rpb24gIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXNwb25zZS5kYXRhLnJlcG9zaXRvcnlfc2VsZWN0aW9uID0gcmVwb3NpdG9yeVNlbGVjdGlvbjtcbiAgfVxuICByZXNwb25zZS5kYXRhLnRvdGFsX2NvdW50ID0gdG90YWxDb3VudDtcbiAgcmV0dXJuIHJlc3BvbnNlO1xufVxuXG4vLyBwa2cvZGlzdC1zcmMvaXRlcmF0b3IuanNcbmZ1bmN0aW9uIGl0ZXJhdG9yKG9jdG9raXQsIHJvdXRlLCBwYXJhbWV0ZXJzKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSB0eXBlb2Ygcm91dGUgPT09IFwiZnVuY3Rpb25cIiA/IHJvdXRlLmVuZHBvaW50KHBhcmFtZXRlcnMpIDogb2N0b2tpdC5yZXF1ZXN0LmVuZHBvaW50KHJvdXRlLCBwYXJhbWV0ZXJzKTtcbiAgY29uc3QgcmVxdWVzdE1ldGhvZCA9IHR5cGVvZiByb3V0ZSA9PT0gXCJmdW5jdGlvblwiID8gcm91dGUgOiBvY3Rva2l0LnJlcXVlc3Q7XG4gIGNvbnN0IG1ldGhvZCA9IG9wdGlvbnMubWV0aG9kO1xuICBjb25zdCBoZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzO1xuICBsZXQgdXJsID0gb3B0aW9ucy51cmw7XG4gIHJldHVybiB7XG4gICAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTogKCkgPT4gKHtcbiAgICAgIGFzeW5jIG5leHQoKSB7XG4gICAgICAgIGlmICghdXJsKSByZXR1cm4geyBkb25lOiB0cnVlIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0TWV0aG9kKHsgbWV0aG9kLCB1cmwsIGhlYWRlcnMgfSk7XG4gICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFJlc3BvbnNlID0gbm9ybWFsaXplUGFnaW5hdGVkTGlzdFJlc3BvbnNlKHJlc3BvbnNlKTtcbiAgICAgICAgICB1cmwgPSAoKG5vcm1hbGl6ZWRSZXNwb25zZS5oZWFkZXJzLmxpbmsgfHwgXCJcIikubWF0Y2goXG4gICAgICAgICAgICAvPChbXjw+XSspPjtcXHMqcmVsPVwibmV4dFwiL1xuICAgICAgICAgICkgfHwgW10pWzFdO1xuICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBub3JtYWxpemVkUmVzcG9uc2UgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoZXJyb3Iuc3RhdHVzICE9PSA0MDkpIHRocm93IGVycm9yO1xuICAgICAgICAgIHVybCA9IFwiXCI7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7fSxcbiAgICAgICAgICAgICAgZGF0YTogW11cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSlcbiAgfTtcbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL3BhZ2luYXRlLmpzXG5mdW5jdGlvbiBwYWdpbmF0ZShvY3Rva2l0LCByb3V0ZSwgcGFyYW1ldGVycywgbWFwRm4pIHtcbiAgaWYgKHR5cGVvZiBwYXJhbWV0ZXJzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBtYXBGbiA9IHBhcmFtZXRlcnM7XG4gICAgcGFyYW1ldGVycyA9IHZvaWQgMDtcbiAgfVxuICByZXR1cm4gZ2F0aGVyKFxuICAgIG9jdG9raXQsXG4gICAgW10sXG4gICAgaXRlcmF0b3Iob2N0b2tpdCwgcm91dGUsIHBhcmFtZXRlcnMpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpLFxuICAgIG1hcEZuXG4gICk7XG59XG5mdW5jdGlvbiBnYXRoZXIob2N0b2tpdCwgcmVzdWx0cywgaXRlcmF0b3IyLCBtYXBGbikge1xuICByZXR1cm4gaXRlcmF0b3IyLm5leHQoKS50aGVuKChyZXN1bHQpID0+IHtcbiAgICBpZiAocmVzdWx0LmRvbmUpIHtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbiAgICBsZXQgZWFybHlFeGl0ID0gZmFsc2U7XG4gICAgZnVuY3Rpb24gZG9uZSgpIHtcbiAgICAgIGVhcmx5RXhpdCA9IHRydWU7XG4gICAgfVxuICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChcbiAgICAgIG1hcEZuID8gbWFwRm4ocmVzdWx0LnZhbHVlLCBkb25lKSA6IHJlc3VsdC52YWx1ZS5kYXRhXG4gICAgKTtcbiAgICBpZiAoZWFybHlFeGl0KSB7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG4gICAgcmV0dXJuIGdhdGhlcihvY3Rva2l0LCByZXN1bHRzLCBpdGVyYXRvcjIsIG1hcEZuKTtcbiAgfSk7XG59XG5cbi8vIHBrZy9kaXN0LXNyYy9jb21wb3NlLXBhZ2luYXRlLmpzXG52YXIgY29tcG9zZVBhZ2luYXRlUmVzdCA9IE9iamVjdC5hc3NpZ24ocGFnaW5hdGUsIHtcbiAgaXRlcmF0b3Jcbn0pO1xuXG4vLyBwa2cvZGlzdC1zcmMvZ2VuZXJhdGVkL3BhZ2luYXRpbmctZW5kcG9pbnRzLmpzXG52YXIgcGFnaW5hdGluZ0VuZHBvaW50cyA9IFtcbiAgXCJHRVQgL2Fkdmlzb3JpZXNcIixcbiAgXCJHRVQgL2FwcC9ob29rL2RlbGl2ZXJpZXNcIixcbiAgXCJHRVQgL2FwcC9pbnN0YWxsYXRpb24tcmVxdWVzdHNcIixcbiAgXCJHRVQgL2FwcC9pbnN0YWxsYXRpb25zXCIsXG4gIFwiR0VUIC9hc3NpZ25tZW50cy97YXNzaWdubWVudF9pZH0vYWNjZXB0ZWRfYXNzaWdubWVudHNcIixcbiAgXCJHRVQgL2NsYXNzcm9vbXNcIixcbiAgXCJHRVQgL2NsYXNzcm9vbXMve2NsYXNzcm9vbV9pZH0vYXNzaWdubWVudHNcIixcbiAgXCJHRVQgL2VudGVycHJpc2VzL3tlbnRlcnByaXNlfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zXCIsXG4gIFwiR0VUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9ucy97Y29uZmlndXJhdGlvbl9pZH0vcmVwb3NpdG9yaWVzXCIsXG4gIFwiR0VUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vZGVwZW5kYWJvdC9hbGVydHNcIixcbiAgXCJHRVQgL2VudGVycHJpc2VzL3tlbnRlcnByaXNlfS9zZWNyZXQtc2Nhbm5pbmcvYWxlcnRzXCIsXG4gIFwiR0VUIC9ldmVudHNcIixcbiAgXCJHRVQgL2dpc3RzXCIsXG4gIFwiR0VUIC9naXN0cy9wdWJsaWNcIixcbiAgXCJHRVQgL2dpc3RzL3N0YXJyZWRcIixcbiAgXCJHRVQgL2dpc3RzL3tnaXN0X2lkfS9jb21tZW50c1wiLFxuICBcIkdFVCAvZ2lzdHMve2dpc3RfaWR9L2NvbW1pdHNcIixcbiAgXCJHRVQgL2dpc3RzL3tnaXN0X2lkfS9mb3Jrc1wiLFxuICBcIkdFVCAvaW5zdGFsbGF0aW9uL3JlcG9zaXRvcmllc1wiLFxuICBcIkdFVCAvaXNzdWVzXCIsXG4gIFwiR0VUIC9saWNlbnNlc1wiLFxuICBcIkdFVCAvbWFya2V0cGxhY2VfbGlzdGluZy9wbGFuc1wiLFxuICBcIkdFVCAvbWFya2V0cGxhY2VfbGlzdGluZy9wbGFucy97cGxhbl9pZH0vYWNjb3VudHNcIixcbiAgXCJHRVQgL21hcmtldHBsYWNlX2xpc3Rpbmcvc3R1YmJlZC9wbGFuc1wiLFxuICBcIkdFVCAvbWFya2V0cGxhY2VfbGlzdGluZy9zdHViYmVkL3BsYW5zL3twbGFuX2lkfS9hY2NvdW50c1wiLFxuICBcIkdFVCAvbmV0d29ya3Mve293bmVyfS97cmVwb30vZXZlbnRzXCIsXG4gIFwiR0VUIC9ub3RpZmljYXRpb25zXCIsXG4gIFwiR0VUIC9vcmdhbml6YXRpb25zXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvY2FjaGUvdXNhZ2UtYnktcmVwb3NpdG9yeVwiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcGVybWlzc2lvbnMvcmVwb3NpdG9yaWVzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVyLWdyb3Vwc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lci1ncm91cHMve3J1bm5lcl9ncm91cF9pZH0vaG9zdGVkLXJ1bm5lcnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy9ydW5uZXItZ3JvdXBzL3tydW5uZXJfZ3JvdXBfaWR9L3JlcG9zaXRvcmllc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lci1ncm91cHMve3J1bm5lcl9ncm91cF9pZH0vcnVubmVyc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lcnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy9zZWNyZXRzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0cy97c2VjcmV0X25hbWV9L3JlcG9zaXRvcmllc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3ZhcmlhYmxlc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3ZhcmlhYmxlcy97bmFtZX0vcmVwb3NpdG9yaWVzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2F0dGVzdGF0aW9ucy97c3ViamVjdF9kaWdlc3R9XCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2Jsb2Nrc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9jb2RlLXNjYW5uaW5nL2FsZXJ0c1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2NvZGUtc2VjdXJpdHkvY29uZmlndXJhdGlvbnMve2NvbmZpZ3VyYXRpb25faWR9L3JlcG9zaXRvcmllc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9jb2Rlc3BhY2VzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2NvZGVzcGFjZXMvc2VjcmV0c1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vY29waWxvdC9iaWxsaW5nL3NlYXRzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2NvcGlsb3QvbWV0cmljc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9jb3BpbG90L3VzYWdlXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2RlcGVuZGFib3QvYWxlcnRzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2RlcGVuZGFib3Qvc2VjcmV0c1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9kZXBlbmRhYm90L3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vZXZlbnRzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2ZhaWxlZF9pbnZpdGF0aW9uc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9ob29rc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9ob29rcy97aG9va19pZH0vZGVsaXZlcmllc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9pbnNpZ2h0cy9hcGkvcm91dGUtc3RhdHMve2FjdG9yX3R5cGV9L3thY3Rvcl9pZH1cIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vaW5zaWdodHMvYXBpL3N1YmplY3Qtc3RhdHNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vaW5zaWdodHMvYXBpL3VzZXItc3RhdHMve3VzZXJfaWR9XCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2luc3RhbGxhdGlvbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vaW52aXRhdGlvbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vaW52aXRhdGlvbnMve2ludml0YXRpb25faWR9L3RlYW1zXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L2lzc3Vlc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9tZW1iZXJzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L21lbWJlcnMve3VzZXJuYW1lfS9jb2Rlc3BhY2VzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L21pZ3JhdGlvbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vbWlncmF0aW9ucy97bWlncmF0aW9uX2lkfS9yZXBvc2l0b3JpZXNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vb3JnYW5pemF0aW9uLXJvbGVzL3tyb2xlX2lkfS90ZWFtc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9vcmdhbml6YXRpb24tcm9sZXMve3JvbGVfaWR9L3VzZXJzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L291dHNpZGVfY29sbGFib3JhdG9yc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9wYWNrYWdlc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9uc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9wZXJzb25hbC1hY2Nlc3MtdG9rZW4tcmVxdWVzdHNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vcGVyc29uYWwtYWNjZXNzLXRva2VuLXJlcXVlc3RzL3twYXRfcmVxdWVzdF9pZH0vcmVwb3NpdG9yaWVzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3BlcnNvbmFsLWFjY2Vzcy10b2tlbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vcGVyc29uYWwtYWNjZXNzLXRva2Vucy97cGF0X2lkfS9yZXBvc2l0b3JpZXNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vcHJpdmF0ZS1yZWdpc3RyaWVzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3Byb2plY3RzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3Byb3BlcnRpZXMvdmFsdWVzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3B1YmxpY19tZW1iZXJzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3JlcG9zXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3J1bGVzZXRzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3J1bGVzZXRzL3J1bGUtc3VpdGVzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3J1bGVzZXRzL3tydWxlc2V0X2lkfS9oaXN0b3J5XCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3NlY3JldC1zY2FubmluZy9hbGVydHNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vc2VjdXJpdHktYWR2aXNvcmllc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS9zZXR0aW5ncy9uZXR3b3JrLWNvbmZpZ3VyYXRpb25zXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3RlYW0ve3RlYW1fc2x1Z30vY29waWxvdC9tZXRyaWNzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3RlYW0ve3RlYW1fc2x1Z30vY29waWxvdC91c2FnZVwiLFxuICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9uc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L2NvbW1lbnRzXCIsXG4gIFwiR0VUIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn0vY29tbWVudHMve2NvbW1lbnRfbnVtYmVyfS9yZWFjdGlvbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vZGlzY3Vzc2lvbnMve2Rpc2N1c3Npb25fbnVtYmVyfS9yZWFjdGlvbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vaW52aXRhdGlvbnNcIixcbiAgXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vbWVtYmVyc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9wcm9qZWN0c1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9yZXBvc1wiLFxuICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS90ZWFtc1wiLFxuICBcIkdFVCAvcHJvamVjdHMvY29sdW1ucy97Y29sdW1uX2lkfS9jYXJkc1wiLFxuICBcIkdFVCAvcHJvamVjdHMve3Byb2plY3RfaWR9L2NvbGxhYm9yYXRvcnNcIixcbiAgXCJHRVQgL3Byb2plY3RzL3twcm9qZWN0X2lkfS9jb2x1bW5zXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL2FydGlmYWN0c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9jYWNoZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvb3JnYW5pemF0aW9uLXNlY3JldHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvb3JnYW5pemF0aW9uLXZhcmlhYmxlc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9hcnRpZmFjdHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9hdHRlbXB0cy97YXR0ZW1wdF9udW1iZXJ9L2pvYnNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9qb2JzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3NlY3JldHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvdmFyaWFibGVzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3dvcmtmbG93c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy93b3JrZmxvd3Mve3dvcmtmbG93X2lkfS9ydW5zXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpdml0eVwiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYXNzaWduZWVzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hdHRlc3RhdGlvbnMve3N1YmplY3RfZGlnZXN0fVwiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NoZWNrLXJ1bnMve2NoZWNrX3J1bl9pZH0vYW5ub3RhdGlvbnNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NoZWNrLXN1aXRlcy97Y2hlY2tfc3VpdGVfaWR9L2NoZWNrLXJ1bnNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvYWxlcnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2FsZXJ0cy97YWxlcnRfbnVtYmVyfS9pbnN0YW5jZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvYW5hbHlzZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGVzcGFjZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGVzcGFjZXMvZGV2Y29udGFpbmVyc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZXNwYWNlcy9zZWNyZXRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2xsYWJvcmF0b3JzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21tZW50c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWl0c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWl0cy97Y29tbWl0X3NoYX0vY29tbWVudHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1pdHMve2NvbW1pdF9zaGF9L3B1bGxzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21taXRzL3tyZWZ9L2NoZWNrLXJ1bnNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1pdHMve3JlZn0vY2hlY2stc3VpdGVzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21taXRzL3tyZWZ9L3N0YXR1c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWl0cy97cmVmfS9zdGF0dXNlc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29udHJpYnV0b3JzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBlbmRhYm90L2FsZXJ0c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwZW5kYWJvdC9zZWNyZXRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBsb3ltZW50c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwbG95bWVudHMve2RlcGxveW1lbnRfaWR9L3N0YXR1c2VzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudC1icmFuY2gtcG9saWNpZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudF9wcm90ZWN0aW9uX3J1bGVzL2FwcHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vc2VjcmV0c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS92YXJpYWJsZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2V2ZW50c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZm9ya3NcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9ob29rcy97aG9va19pZH0vZGVsaXZlcmllc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaW52aXRhdGlvbnNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL2NvbW1lbnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMvY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL2V2ZW50c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L2NvbW1lbnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vZXZlbnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vbGFiZWxzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vcmVhY3Rpb25zXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vc3ViX2lzc3Vlc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L3RpbWVsaW5lXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9rZXlzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9sYWJlbHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L21pbGVzdG9uZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L21pbGVzdG9uZXMve21pbGVzdG9uZV9udW1iZXJ9L2xhYmVsc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vbm90aWZpY2F0aW9uc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcGFnZXMvYnVpbGRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wcm9qZWN0c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL2NvbW1lbnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy9jb21tZW50cy97Y29tbWVudF9pZH0vcmVhY3Rpb25zXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L2NvbW1lbnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L2NvbW1pdHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vZmlsZXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vcmV2aWV3c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9yZXZpZXdzL3tyZXZpZXdfaWR9L2NvbW1lbnRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9yZWxlYXNlc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXMve3JlbGVhc2VfaWR9L2Fzc2V0c1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXMve3JlbGVhc2VfaWR9L3JlYWN0aW9uc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcnVsZXMvYnJhbmNoZXMve2JyYW5jaH1cIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3J1bGVzZXRzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9ydWxlc2V0cy9ydWxlLXN1aXRlc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcnVsZXNldHMve3J1bGVzZXRfaWR9L2hpc3RvcnlcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3JldC1zY2FubmluZy9hbGVydHNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3JldC1zY2FubmluZy9hbGVydHMve2FsZXJ0X251bWJlcn0vbG9jYXRpb25zXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zZWN1cml0eS1hZHZpc29yaWVzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zdGFyZ2F6ZXJzXCIsXG4gIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zdWJzY3JpYmVyc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdGFnc1wiLFxuICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdGVhbXNcIixcbiAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3RvcGljc1wiLFxuICBcIkdFVCAvcmVwb3NpdG9yaWVzXCIsXG4gIFwiR0VUIC9zZWFyY2gvY29kZVwiLFxuICBcIkdFVCAvc2VhcmNoL2NvbW1pdHNcIixcbiAgXCJHRVQgL3NlYXJjaC9pc3N1ZXNcIixcbiAgXCJHRVQgL3NlYXJjaC9sYWJlbHNcIixcbiAgXCJHRVQgL3NlYXJjaC9yZXBvc2l0b3JpZXNcIixcbiAgXCJHRVQgL3NlYXJjaC90b3BpY3NcIixcbiAgXCJHRVQgL3NlYXJjaC91c2Vyc1wiLFxuICBcIkdFVCAvdGVhbXMve3RlYW1faWR9L2Rpc2N1c3Npb25zXCIsXG4gIFwiR0VUIC90ZWFtcy97dGVhbV9pZH0vZGlzY3Vzc2lvbnMve2Rpc2N1c3Npb25fbnVtYmVyfS9jb21tZW50c1wiLFxuICBcIkdFVCAvdGVhbXMve3RlYW1faWR9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn0vY29tbWVudHMve2NvbW1lbnRfbnVtYmVyfS9yZWFjdGlvbnNcIixcbiAgXCJHRVQgL3RlYW1zL3t0ZWFtX2lkfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L3JlYWN0aW9uc1wiLFxuICBcIkdFVCAvdGVhbXMve3RlYW1faWR9L2ludml0YXRpb25zXCIsXG4gIFwiR0VUIC90ZWFtcy97dGVhbV9pZH0vbWVtYmVyc1wiLFxuICBcIkdFVCAvdGVhbXMve3RlYW1faWR9L3Byb2plY3RzXCIsXG4gIFwiR0VUIC90ZWFtcy97dGVhbV9pZH0vcmVwb3NcIixcbiAgXCJHRVQgL3RlYW1zL3t0ZWFtX2lkfS90ZWFtc1wiLFxuICBcIkdFVCAvdXNlci9ibG9ja3NcIixcbiAgXCJHRVQgL3VzZXIvY29kZXNwYWNlc1wiLFxuICBcIkdFVCAvdXNlci9jb2Rlc3BhY2VzL3NlY3JldHNcIixcbiAgXCJHRVQgL3VzZXIvZW1haWxzXCIsXG4gIFwiR0VUIC91c2VyL2ZvbGxvd2Vyc1wiLFxuICBcIkdFVCAvdXNlci9mb2xsb3dpbmdcIixcbiAgXCJHRVQgL3VzZXIvZ3BnX2tleXNcIixcbiAgXCJHRVQgL3VzZXIvaW5zdGFsbGF0aW9uc1wiLFxuICBcIkdFVCAvdXNlci9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9L3JlcG9zaXRvcmllc1wiLFxuICBcIkdFVCAvdXNlci9pc3N1ZXNcIixcbiAgXCJHRVQgL3VzZXIva2V5c1wiLFxuICBcIkdFVCAvdXNlci9tYXJrZXRwbGFjZV9wdXJjaGFzZXNcIixcbiAgXCJHRVQgL3VzZXIvbWFya2V0cGxhY2VfcHVyY2hhc2VzL3N0dWJiZWRcIixcbiAgXCJHRVQgL3VzZXIvbWVtYmVyc2hpcHMvb3Jnc1wiLFxuICBcIkdFVCAvdXNlci9taWdyYXRpb25zXCIsXG4gIFwiR0VUIC91c2VyL21pZ3JhdGlvbnMve21pZ3JhdGlvbl9pZH0vcmVwb3NpdG9yaWVzXCIsXG4gIFwiR0VUIC91c2VyL29yZ3NcIixcbiAgXCJHRVQgL3VzZXIvcGFja2FnZXNcIixcbiAgXCJHRVQgL3VzZXIvcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vdmVyc2lvbnNcIixcbiAgXCJHRVQgL3VzZXIvcHVibGljX2VtYWlsc1wiLFxuICBcIkdFVCAvdXNlci9yZXBvc1wiLFxuICBcIkdFVCAvdXNlci9yZXBvc2l0b3J5X2ludml0YXRpb25zXCIsXG4gIFwiR0VUIC91c2VyL3NvY2lhbF9hY2NvdW50c1wiLFxuICBcIkdFVCAvdXNlci9zc2hfc2lnbmluZ19rZXlzXCIsXG4gIFwiR0VUIC91c2VyL3N0YXJyZWRcIixcbiAgXCJHRVQgL3VzZXIvc3Vic2NyaXB0aW9uc1wiLFxuICBcIkdFVCAvdXNlci90ZWFtc1wiLFxuICBcIkdFVCAvdXNlcnNcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vYXR0ZXN0YXRpb25zL3tzdWJqZWN0X2RpZ2VzdH1cIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vZXZlbnRzXCIsXG4gIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L2V2ZW50cy9vcmdzL3tvcmd9XCIsXG4gIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L2V2ZW50cy9wdWJsaWNcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vZm9sbG93ZXJzXCIsXG4gIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L2ZvbGxvd2luZ1wiLFxuICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9naXN0c1wiLFxuICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9ncGdfa2V5c1wiLFxuICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9rZXlzXCIsXG4gIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L29yZ3NcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vcGFja2FnZXNcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vcHJvamVjdHNcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vcmVjZWl2ZWRfZXZlbnRzXCIsXG4gIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L3JlY2VpdmVkX2V2ZW50cy9wdWJsaWNcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vcmVwb3NcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vc29jaWFsX2FjY291bnRzXCIsXG4gIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L3NzaF9zaWduaW5nX2tleXNcIixcbiAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vc3RhcnJlZFwiLFxuICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9zdWJzY3JpcHRpb25zXCJcbl07XG5cbi8vIHBrZy9kaXN0LXNyYy9wYWdpbmF0aW5nLWVuZHBvaW50cy5qc1xuZnVuY3Rpb24gaXNQYWdpbmF0aW5nRW5kcG9pbnQoYXJnKSB7XG4gIGlmICh0eXBlb2YgYXJnID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIHBhZ2luYXRpbmdFbmRwb2ludHMuaW5jbHVkZXMoYXJnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLy8gcGtnL2Rpc3Qtc3JjL2luZGV4LmpzXG5mdW5jdGlvbiBwYWdpbmF0ZVJlc3Qob2N0b2tpdCkge1xuICByZXR1cm4ge1xuICAgIHBhZ2luYXRlOiBPYmplY3QuYXNzaWduKHBhZ2luYXRlLmJpbmQobnVsbCwgb2N0b2tpdCksIHtcbiAgICAgIGl0ZXJhdG9yOiBpdGVyYXRvci5iaW5kKG51bGwsIG9jdG9raXQpXG4gICAgfSlcbiAgfTtcbn1cbnBhZ2luYXRlUmVzdC5WRVJTSU9OID0gVkVSU0lPTjtcbmV4cG9ydCB7XG4gIGNvbXBvc2VQYWdpbmF0ZVJlc3QsXG4gIGlzUGFnaW5hdGluZ0VuZHBvaW50LFxuICBwYWdpbmF0ZVJlc3QsXG4gIHBhZ2luYXRpbmdFbmRwb2ludHNcbn07XG4iLAogICAgImNvbnN0IFZFUlNJT04gPSBcIjEzLjUuMFwiO1xuZXhwb3J0IHtcbiAgVkVSU0lPTlxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXZlcnNpb24uanMubWFwXG4iLAogICAgImNvbnN0IEVuZHBvaW50cyA9IHtcbiAgYWN0aW9uczoge1xuICAgIGFkZEN1c3RvbUxhYmVsc1RvU2VsZkhvc3RlZFJ1bm5lckZvck9yZzogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVycy97cnVubmVyX2lkfS9sYWJlbHNcIlxuICAgIF0sXG4gICAgYWRkQ3VzdG9tTGFiZWxzVG9TZWxmSG9zdGVkUnVubmVyRm9yUmVwbzogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bm5lcnMve3J1bm5lcl9pZH0vbGFiZWxzXCJcbiAgICBdLFxuICAgIGFkZFJlcG9BY2Nlc3NUb1NlbGZIb3N0ZWRSdW5uZXJHcm91cEluT3JnOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lci1ncm91cHMve3J1bm5lcl9ncm91cF9pZH0vcmVwb3NpdG9yaWVzL3tyZXBvc2l0b3J5X2lkfVwiXG4gICAgXSxcbiAgICBhZGRTZWxlY3RlZFJlcG9Ub09yZ1NlY3JldDogW1xuICAgICAgXCJQVVQgL29yZ3Mve29yZ30vYWN0aW9ucy9zZWNyZXRzL3tzZWNyZXRfbmFtZX0vcmVwb3NpdG9yaWVzL3tyZXBvc2l0b3J5X2lkfVwiXG4gICAgXSxcbiAgICBhZGRTZWxlY3RlZFJlcG9Ub09yZ1ZhcmlhYmxlOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9hY3Rpb25zL3ZhcmlhYmxlcy97bmFtZX0vcmVwb3NpdG9yaWVzL3tyZXBvc2l0b3J5X2lkfVwiXG4gICAgXSxcbiAgICBhcHByb3ZlV29ya2Zsb3dSdW46IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zL3tydW5faWR9L2FwcHJvdmVcIlxuICAgIF0sXG4gICAgY2FuY2VsV29ya2Zsb3dSdW46IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zL3tydW5faWR9L2NhbmNlbFwiXG4gICAgXSxcbiAgICBjcmVhdGVFbnZpcm9ubWVudFZhcmlhYmxlOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vdmFyaWFibGVzXCJcbiAgICBdLFxuICAgIGNyZWF0ZUhvc3RlZFJ1bm5lckZvck9yZzogW1wiUE9TVCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzXCJdLFxuICAgIGNyZWF0ZU9yVXBkYXRlRW52aXJvbm1lbnRTZWNyZXQ6IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHMve2Vudmlyb25tZW50X25hbWV9L3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVPclVwZGF0ZU9yZ1NlY3JldDogW1wiUFVUIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0cy97c2VjcmV0X25hbWV9XCJdLFxuICAgIGNyZWF0ZU9yVXBkYXRlUmVwb1NlY3JldDogW1xuICAgICAgXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvc2VjcmV0cy97c2VjcmV0X25hbWV9XCJcbiAgICBdLFxuICAgIGNyZWF0ZU9yZ1ZhcmlhYmxlOiBbXCJQT1NUIC9vcmdzL3tvcmd9L2FjdGlvbnMvdmFyaWFibGVzXCJdLFxuICAgIGNyZWF0ZVJlZ2lzdHJhdGlvblRva2VuRm9yT3JnOiBbXG4gICAgICBcIlBPU1QgL29yZ3Mve29yZ30vYWN0aW9ucy9ydW5uZXJzL3JlZ2lzdHJhdGlvbi10b2tlblwiXG4gICAgXSxcbiAgICBjcmVhdGVSZWdpc3RyYXRpb25Ub2tlbkZvclJlcG86IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzL3JlZ2lzdHJhdGlvbi10b2tlblwiXG4gICAgXSxcbiAgICBjcmVhdGVSZW1vdmVUb2tlbkZvck9yZzogW1wiUE9TVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lcnMvcmVtb3ZlLXRva2VuXCJdLFxuICAgIGNyZWF0ZVJlbW92ZVRva2VuRm9yUmVwbzogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bm5lcnMvcmVtb3ZlLXRva2VuXCJcbiAgICBdLFxuICAgIGNyZWF0ZVJlcG9WYXJpYWJsZTogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy92YXJpYWJsZXNcIl0sXG4gICAgY3JlYXRlV29ya2Zsb3dEaXNwYXRjaDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3dvcmtmbG93cy97d29ya2Zsb3dfaWR9L2Rpc3BhdGNoZXNcIlxuICAgIF0sXG4gICAgZGVsZXRlQWN0aW9uc0NhY2hlQnlJZDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvY2FjaGVzL3tjYWNoZV9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlQWN0aW9uc0NhY2hlQnlLZXk6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL2NhY2hlc3s/a2V5LHJlZn1cIlxuICAgIF0sXG4gICAgZGVsZXRlQXJ0aWZhY3Q6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL2FydGlmYWN0cy97YXJ0aWZhY3RfaWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZUVudmlyb25tZW50U2VjcmV0OiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIlxuICAgIF0sXG4gICAgZGVsZXRlRW52aXJvbm1lbnRWYXJpYWJsZTogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vdmFyaWFibGVzL3tuYW1lfVwiXG4gICAgXSxcbiAgICBkZWxldGVIb3N0ZWRSdW5uZXJGb3JPcmc6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L2FjdGlvbnMvaG9zdGVkLXJ1bm5lcnMve2hvc3RlZF9ydW5uZXJfaWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZU9yZ1NlY3JldDogW1wiREVMRVRFIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0cy97c2VjcmV0X25hbWV9XCJdLFxuICAgIGRlbGV0ZU9yZ1ZhcmlhYmxlOiBbXCJERUxFVEUgL29yZ3Mve29yZ30vYWN0aW9ucy92YXJpYWJsZXMve25hbWV9XCJdLFxuICAgIGRlbGV0ZVJlcG9TZWNyZXQ6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBkZWxldGVSZXBvVmFyaWFibGU6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3ZhcmlhYmxlcy97bmFtZX1cIlxuICAgIF0sXG4gICAgZGVsZXRlU2VsZkhvc3RlZFJ1bm5lckZyb21Pcmc6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVycy97cnVubmVyX2lkfVwiXG4gICAgXSxcbiAgICBkZWxldGVTZWxmSG9zdGVkUnVubmVyRnJvbVJlcG86IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bm5lcnMve3J1bm5lcl9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlV29ya2Zsb3dSdW46IFtcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zL3tydW5faWR9XCJdLFxuICAgIGRlbGV0ZVdvcmtmbG93UnVuTG9nczogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9sb2dzXCJcbiAgICBdLFxuICAgIGRpc2FibGVTZWxlY3RlZFJlcG9zaXRvcnlHaXRodWJBY3Rpb25zT3JnYW5pemF0aW9uOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9hY3Rpb25zL3Blcm1pc3Npb25zL3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIlxuICAgIF0sXG4gICAgZGlzYWJsZVdvcmtmbG93OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy93b3JrZmxvd3Mve3dvcmtmbG93X2lkfS9kaXNhYmxlXCJcbiAgICBdLFxuICAgIGRvd25sb2FkQXJ0aWZhY3Q6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL2FydGlmYWN0cy97YXJ0aWZhY3RfaWR9L3thcmNoaXZlX2Zvcm1hdH1cIlxuICAgIF0sXG4gICAgZG93bmxvYWRKb2JMb2dzRm9yV29ya2Zsb3dSdW46IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL2pvYnMve2pvYl9pZH0vbG9nc1wiXG4gICAgXSxcbiAgICBkb3dubG9hZFdvcmtmbG93UnVuQXR0ZW1wdExvZ3M6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH0vYXR0ZW1wdHMve2F0dGVtcHRfbnVtYmVyfS9sb2dzXCJcbiAgICBdLFxuICAgIGRvd25sb2FkV29ya2Zsb3dSdW5Mb2dzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zL3tydW5faWR9L2xvZ3NcIlxuICAgIF0sXG4gICAgZW5hYmxlU2VsZWN0ZWRSZXBvc2l0b3J5R2l0aHViQWN0aW9uc09yZ2FuaXphdGlvbjogW1xuICAgICAgXCJQVVQgL29yZ3Mve29yZ30vYWN0aW9ucy9wZXJtaXNzaW9ucy9yZXBvc2l0b3JpZXMve3JlcG9zaXRvcnlfaWR9XCJcbiAgICBdLFxuICAgIGVuYWJsZVdvcmtmbG93OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy93b3JrZmxvd3Mve3dvcmtmbG93X2lkfS9lbmFibGVcIlxuICAgIF0sXG4gICAgZm9yY2VDYW5jZWxXb3JrZmxvd1J1bjogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH0vZm9yY2UtY2FuY2VsXCJcbiAgICBdLFxuICAgIGdlbmVyYXRlUnVubmVySml0Y29uZmlnRm9yT3JnOiBbXG4gICAgICBcIlBPU1QgL29yZ3Mve29yZ30vYWN0aW9ucy9ydW5uZXJzL2dlbmVyYXRlLWppdGNvbmZpZ1wiXG4gICAgXSxcbiAgICBnZW5lcmF0ZVJ1bm5lckppdGNvbmZpZ0ZvclJlcG86IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzL2dlbmVyYXRlLWppdGNvbmZpZ1wiXG4gICAgXSxcbiAgICBnZXRBY3Rpb25zQ2FjaGVMaXN0OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvY2FjaGVzXCJdLFxuICAgIGdldEFjdGlvbnNDYWNoZVVzYWdlOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvY2FjaGUvdXNhZ2VcIl0sXG4gICAgZ2V0QWN0aW9uc0NhY2hlVXNhZ2VCeVJlcG9Gb3JPcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvY2FjaGUvdXNhZ2UtYnktcmVwb3NpdG9yeVwiXG4gICAgXSxcbiAgICBnZXRBY3Rpb25zQ2FjaGVVc2FnZUZvck9yZzogW1wiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvY2FjaGUvdXNhZ2VcIl0sXG4gICAgZ2V0QWxsb3dlZEFjdGlvbnNPcmdhbml6YXRpb246IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcGVybWlzc2lvbnMvc2VsZWN0ZWQtYWN0aW9uc1wiXG4gICAgXSxcbiAgICBnZXRBbGxvd2VkQWN0aW9uc1JlcG9zaXRvcnk6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3Blcm1pc3Npb25zL3NlbGVjdGVkLWFjdGlvbnNcIlxuICAgIF0sXG4gICAgZ2V0QXJ0aWZhY3Q6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9hcnRpZmFjdHMve2FydGlmYWN0X2lkfVwiXSxcbiAgICBnZXRDdXN0b21PaWRjU3ViQ2xhaW1Gb3JSZXBvOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9vaWRjL2N1c3RvbWl6YXRpb24vc3ViXCJcbiAgICBdLFxuICAgIGdldEVudmlyb25tZW50UHVibGljS2V5OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS9zZWNyZXRzL3B1YmxpYy1rZXlcIlxuICAgIF0sXG4gICAgZ2V0RW52aXJvbm1lbnRTZWNyZXQ6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHMve2Vudmlyb25tZW50X25hbWV9L3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBnZXRFbnZpcm9ubWVudFZhcmlhYmxlOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS92YXJpYWJsZXMve25hbWV9XCJcbiAgICBdLFxuICAgIGdldEdpdGh1YkFjdGlvbnNEZWZhdWx0V29ya2Zsb3dQZXJtaXNzaW9uc09yZ2FuaXphdGlvbjogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy9wZXJtaXNzaW9ucy93b3JrZmxvd1wiXG4gICAgXSxcbiAgICBnZXRHaXRodWJBY3Rpb25zRGVmYXVsdFdvcmtmbG93UGVybWlzc2lvbnNSZXBvc2l0b3J5OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9wZXJtaXNzaW9ucy93b3JrZmxvd1wiXG4gICAgXSxcbiAgICBnZXRHaXRodWJBY3Rpb25zUGVybWlzc2lvbnNPcmdhbml6YXRpb246IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcGVybWlzc2lvbnNcIlxuICAgIF0sXG4gICAgZ2V0R2l0aHViQWN0aW9uc1Blcm1pc3Npb25zUmVwb3NpdG9yeTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcGVybWlzc2lvbnNcIlxuICAgIF0sXG4gICAgZ2V0SG9zdGVkUnVubmVyRm9yT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzL3tob3N0ZWRfcnVubmVyX2lkfVwiXG4gICAgXSxcbiAgICBnZXRIb3N0ZWRSdW5uZXJzR2l0aHViT3duZWRJbWFnZXNGb3JPcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvaG9zdGVkLXJ1bm5lcnMvaW1hZ2VzL2dpdGh1Yi1vd25lZFwiXG4gICAgXSxcbiAgICBnZXRIb3N0ZWRSdW5uZXJzTGltaXRzRm9yT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzL2xpbWl0c1wiXG4gICAgXSxcbiAgICBnZXRIb3N0ZWRSdW5uZXJzTWFjaGluZVNwZWNzRm9yT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzL21hY2hpbmUtc2l6ZXNcIlxuICAgIF0sXG4gICAgZ2V0SG9zdGVkUnVubmVyc1BhcnRuZXJJbWFnZXNGb3JPcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvaG9zdGVkLXJ1bm5lcnMvaW1hZ2VzL3BhcnRuZXJcIlxuICAgIF0sXG4gICAgZ2V0SG9zdGVkUnVubmVyc1BsYXRmb3Jtc0Zvck9yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy9ob3N0ZWQtcnVubmVycy9wbGF0Zm9ybXNcIlxuICAgIF0sXG4gICAgZ2V0Sm9iRm9yV29ya2Zsb3dSdW46IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9qb2JzL3tqb2JfaWR9XCJdLFxuICAgIGdldE9yZ1B1YmxpY0tleTogW1wiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0cy9wdWJsaWMta2V5XCJdLFxuICAgIGdldE9yZ1NlY3JldDogW1wiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0cy97c2VjcmV0X25hbWV9XCJdLFxuICAgIGdldE9yZ1ZhcmlhYmxlOiBbXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy92YXJpYWJsZXMve25hbWV9XCJdLFxuICAgIGdldFBlbmRpbmdEZXBsb3ltZW50c0ZvclJ1bjogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9wZW5kaW5nX2RlcGxveW1lbnRzXCJcbiAgICBdLFxuICAgIGdldFJlcG9QZXJtaXNzaW9uczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcGVybWlzc2lvbnNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJhY3Rpb25zXCIsIFwiZ2V0R2l0aHViQWN0aW9uc1Blcm1pc3Npb25zUmVwb3NpdG9yeVwiXSB9XG4gICAgXSxcbiAgICBnZXRSZXBvUHVibGljS2V5OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvc2VjcmV0cy9wdWJsaWMta2V5XCJdLFxuICAgIGdldFJlcG9TZWNyZXQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIl0sXG4gICAgZ2V0UmVwb1ZhcmlhYmxlOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvdmFyaWFibGVzL3tuYW1lfVwiXSxcbiAgICBnZXRSZXZpZXdzRm9yUnVuOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zL3tydW5faWR9L2FwcHJvdmFsc1wiXG4gICAgXSxcbiAgICBnZXRTZWxmSG9zdGVkUnVubmVyRm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy9ydW5uZXJzL3tydW5uZXJfaWR9XCJdLFxuICAgIGdldFNlbGZIb3N0ZWRSdW5uZXJGb3JSZXBvOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzL3tydW5uZXJfaWR9XCJcbiAgICBdLFxuICAgIGdldFdvcmtmbG93OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvd29ya2Zsb3dzL3t3b3JrZmxvd19pZH1cIl0sXG4gICAgZ2V0V29ya2Zsb3dBY2Nlc3NUb1JlcG9zaXRvcnk6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3Blcm1pc3Npb25zL2FjY2Vzc1wiXG4gICAgXSxcbiAgICBnZXRXb3JrZmxvd1J1bjogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH1cIl0sXG4gICAgZ2V0V29ya2Zsb3dSdW5BdHRlbXB0OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zL3tydW5faWR9L2F0dGVtcHRzL3thdHRlbXB0X251bWJlcn1cIlxuICAgIF0sXG4gICAgZ2V0V29ya2Zsb3dSdW5Vc2FnZTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS90aW1pbmdcIlxuICAgIF0sXG4gICAgZ2V0V29ya2Zsb3dVc2FnZTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvd29ya2Zsb3dzL3t3b3JrZmxvd19pZH0vdGltaW5nXCJcbiAgICBdLFxuICAgIGxpc3RBcnRpZmFjdHNGb3JSZXBvOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvYXJ0aWZhY3RzXCJdLFxuICAgIGxpc3RFbnZpcm9ubWVudFNlY3JldHM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHMve2Vudmlyb25tZW50X25hbWV9L3NlY3JldHNcIlxuICAgIF0sXG4gICAgbGlzdEVudmlyb25tZW50VmFyaWFibGVzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS92YXJpYWJsZXNcIlxuICAgIF0sXG4gICAgbGlzdEdpdGh1Ykhvc3RlZFJ1bm5lcnNJbkdyb3VwRm9yT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lci1ncm91cHMve3J1bm5lcl9ncm91cF9pZH0vaG9zdGVkLXJ1bm5lcnNcIlxuICAgIF0sXG4gICAgbGlzdEhvc3RlZFJ1bm5lcnNGb3JPcmc6IFtcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzXCJdLFxuICAgIGxpc3RKb2JzRm9yV29ya2Zsb3dSdW46IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH0vam9ic1wiXG4gICAgXSxcbiAgICBsaXN0Sm9ic0ZvcldvcmtmbG93UnVuQXR0ZW1wdDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9hdHRlbXB0cy97YXR0ZW1wdF9udW1iZXJ9L2pvYnNcIlxuICAgIF0sXG4gICAgbGlzdExhYmVsc0ZvclNlbGZIb3N0ZWRSdW5uZXJGb3JPcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVycy97cnVubmVyX2lkfS9sYWJlbHNcIlxuICAgIF0sXG4gICAgbGlzdExhYmVsc0ZvclNlbGZIb3N0ZWRSdW5uZXJGb3JSZXBvOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzL3tydW5uZXJfaWR9L2xhYmVsc1wiXG4gICAgXSxcbiAgICBsaXN0T3JnU2VjcmV0czogW1wiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0c1wiXSxcbiAgICBsaXN0T3JnVmFyaWFibGVzOiBbXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy92YXJpYWJsZXNcIl0sXG4gICAgbGlzdFJlcG9Pcmdhbml6YXRpb25TZWNyZXRzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9vcmdhbml6YXRpb24tc2VjcmV0c1wiXG4gICAgXSxcbiAgICBsaXN0UmVwb09yZ2FuaXphdGlvblZhcmlhYmxlczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvb3JnYW5pemF0aW9uLXZhcmlhYmxlc1wiXG4gICAgXSxcbiAgICBsaXN0UmVwb1NlY3JldHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9zZWNyZXRzXCJdLFxuICAgIGxpc3RSZXBvVmFyaWFibGVzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvdmFyaWFibGVzXCJdLFxuICAgIGxpc3RSZXBvV29ya2Zsb3dzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvd29ya2Zsb3dzXCJdLFxuICAgIGxpc3RSdW5uZXJBcHBsaWNhdGlvbnNGb3JPcmc6IFtcIkdFVCAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lcnMvZG93bmxvYWRzXCJdLFxuICAgIGxpc3RSdW5uZXJBcHBsaWNhdGlvbnNGb3JSZXBvOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzL2Rvd25sb2Fkc1wiXG4gICAgXSxcbiAgICBsaXN0U2VsZWN0ZWRSZXBvc0Zvck9yZ1NlY3JldDogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vYWN0aW9ucy9zZWNyZXRzL3tzZWNyZXRfbmFtZX0vcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIGxpc3RTZWxlY3RlZFJlcG9zRm9yT3JnVmFyaWFibGU6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvdmFyaWFibGVzL3tuYW1lfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgbGlzdFNlbGVjdGVkUmVwb3NpdG9yaWVzRW5hYmxlZEdpdGh1YkFjdGlvbnNPcmdhbml6YXRpb246IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcGVybWlzc2lvbnMvcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIGxpc3RTZWxmSG9zdGVkUnVubmVyc0Zvck9yZzogW1wiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVyc1wiXSxcbiAgICBsaXN0U2VsZkhvc3RlZFJ1bm5lcnNGb3JSZXBvOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVubmVyc1wiXSxcbiAgICBsaXN0V29ya2Zsb3dSdW5BcnRpZmFjdHM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH0vYXJ0aWZhY3RzXCJcbiAgICBdLFxuICAgIGxpc3RXb3JrZmxvd1J1bnM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3dvcmtmbG93cy97d29ya2Zsb3dfaWR9L3J1bnNcIlxuICAgIF0sXG4gICAgbGlzdFdvcmtmbG93UnVuc0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5zXCJdLFxuICAgIHJlUnVuSm9iRm9yV29ya2Zsb3dSdW46IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9qb2JzL3tqb2JfaWR9L3JlcnVuXCJcbiAgICBdLFxuICAgIHJlUnVuV29ya2Zsb3c6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9yZXJ1blwiXSxcbiAgICByZVJ1bldvcmtmbG93RmFpbGVkSm9iczogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH0vcmVydW4tZmFpbGVkLWpvYnNcIlxuICAgIF0sXG4gICAgcmVtb3ZlQWxsQ3VzdG9tTGFiZWxzRnJvbVNlbGZIb3N0ZWRSdW5uZXJGb3JPcmc6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVycy97cnVubmVyX2lkfS9sYWJlbHNcIlxuICAgIF0sXG4gICAgcmVtb3ZlQWxsQ3VzdG9tTGFiZWxzRnJvbVNlbGZIb3N0ZWRSdW5uZXJGb3JSZXBvOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9ydW5uZXJzL3tydW5uZXJfaWR9L2xhYmVsc1wiXG4gICAgXSxcbiAgICByZW1vdmVDdXN0b21MYWJlbEZyb21TZWxmSG9zdGVkUnVubmVyRm9yT3JnOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9hY3Rpb25zL3J1bm5lcnMve3J1bm5lcl9pZH0vbGFiZWxzL3tuYW1lfVwiXG4gICAgXSxcbiAgICByZW1vdmVDdXN0b21MYWJlbEZyb21TZWxmSG9zdGVkUnVubmVyRm9yUmVwbzogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVubmVycy97cnVubmVyX2lkfS9sYWJlbHMve25hbWV9XCJcbiAgICBdLFxuICAgIHJlbW92ZVNlbGVjdGVkUmVwb0Zyb21PcmdTZWNyZXQ6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L2FjdGlvbnMvc2VjcmV0cy97c2VjcmV0X25hbWV9L3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIlxuICAgIF0sXG4gICAgcmVtb3ZlU2VsZWN0ZWRSZXBvRnJvbU9yZ1ZhcmlhYmxlOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9hY3Rpb25zL3ZhcmlhYmxlcy97bmFtZX0vcmVwb3NpdG9yaWVzL3tyZXBvc2l0b3J5X2lkfVwiXG4gICAgXSxcbiAgICByZXZpZXdDdXN0b21HYXRlc0ZvclJ1bjogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bnMve3J1bl9pZH0vZGVwbG95bWVudF9wcm90ZWN0aW9uX3J1bGVcIlxuICAgIF0sXG4gICAgcmV2aWV3UGVuZGluZ0RlcGxveW1lbnRzRm9yUnVuOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2FjdGlvbnMvcnVucy97cnVuX2lkfS9wZW5kaW5nX2RlcGxveW1lbnRzXCJcbiAgICBdLFxuICAgIHNldEFsbG93ZWRBY3Rpb25zT3JnYW5pemF0aW9uOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9hY3Rpb25zL3Blcm1pc3Npb25zL3NlbGVjdGVkLWFjdGlvbnNcIlxuICAgIF0sXG4gICAgc2V0QWxsb3dlZEFjdGlvbnNSZXBvc2l0b3J5OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9wZXJtaXNzaW9ucy9zZWxlY3RlZC1hY3Rpb25zXCJcbiAgICBdLFxuICAgIHNldEN1c3RvbUxhYmVsc0ZvclNlbGZIb3N0ZWRSdW5uZXJGb3JPcmc6IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcnVubmVycy97cnVubmVyX2lkfS9sYWJlbHNcIlxuICAgIF0sXG4gICAgc2V0Q3VzdG9tTGFiZWxzRm9yU2VsZkhvc3RlZFJ1bm5lckZvclJlcG86IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3J1bm5lcnMve3J1bm5lcl9pZH0vbGFiZWxzXCJcbiAgICBdLFxuICAgIHNldEN1c3RvbU9pZGNTdWJDbGFpbUZvclJlcG86IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL29pZGMvY3VzdG9taXphdGlvbi9zdWJcIlxuICAgIF0sXG4gICAgc2V0R2l0aHViQWN0aW9uc0RlZmF1bHRXb3JrZmxvd1Blcm1pc3Npb25zT3JnYW5pemF0aW9uOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9hY3Rpb25zL3Blcm1pc3Npb25zL3dvcmtmbG93XCJcbiAgICBdLFxuICAgIHNldEdpdGh1YkFjdGlvbnNEZWZhdWx0V29ya2Zsb3dQZXJtaXNzaW9uc1JlcG9zaXRvcnk6IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hY3Rpb25zL3Blcm1pc3Npb25zL3dvcmtmbG93XCJcbiAgICBdLFxuICAgIHNldEdpdGh1YkFjdGlvbnNQZXJtaXNzaW9uc09yZ2FuaXphdGlvbjogW1xuICAgICAgXCJQVVQgL29yZ3Mve29yZ30vYWN0aW9ucy9wZXJtaXNzaW9uc1wiXG4gICAgXSxcbiAgICBzZXRHaXRodWJBY3Rpb25zUGVybWlzc2lvbnNSZXBvc2l0b3J5OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9wZXJtaXNzaW9uc1wiXG4gICAgXSxcbiAgICBzZXRTZWxlY3RlZFJlcG9zRm9yT3JnU2VjcmV0OiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9hY3Rpb25zL3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgc2V0U2VsZWN0ZWRSZXBvc0Zvck9yZ1ZhcmlhYmxlOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9hY3Rpb25zL3ZhcmlhYmxlcy97bmFtZX0vcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIHNldFNlbGVjdGVkUmVwb3NpdG9yaWVzRW5hYmxlZEdpdGh1YkFjdGlvbnNPcmdhbml6YXRpb246IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L2FjdGlvbnMvcGVybWlzc2lvbnMvcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIHNldFdvcmtmbG93QWNjZXNzVG9SZXBvc2l0b3J5OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy9wZXJtaXNzaW9ucy9hY2Nlc3NcIlxuICAgIF0sXG4gICAgdXBkYXRlRW52aXJvbm1lbnRWYXJpYWJsZTogW1xuICAgICAgXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS92YXJpYWJsZXMve25hbWV9XCJcbiAgICBdLFxuICAgIHVwZGF0ZUhvc3RlZFJ1bm5lckZvck9yZzogW1xuICAgICAgXCJQQVRDSCAvb3Jncy97b3JnfS9hY3Rpb25zL2hvc3RlZC1ydW5uZXJzL3tob3N0ZWRfcnVubmVyX2lkfVwiXG4gICAgXSxcbiAgICB1cGRhdGVPcmdWYXJpYWJsZTogW1wiUEFUQ0ggL29yZ3Mve29yZ30vYWN0aW9ucy92YXJpYWJsZXMve25hbWV9XCJdLFxuICAgIHVwZGF0ZVJlcG9WYXJpYWJsZTogW1xuICAgICAgXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aW9ucy92YXJpYWJsZXMve25hbWV9XCJcbiAgICBdXG4gIH0sXG4gIGFjdGl2aXR5OiB7XG4gICAgY2hlY2tSZXBvSXNTdGFycmVkQnlBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL3N0YXJyZWQve293bmVyfS97cmVwb31cIl0sXG4gICAgZGVsZXRlUmVwb1N1YnNjcmlwdGlvbjogW1wiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zdWJzY3JpcHRpb25cIl0sXG4gICAgZGVsZXRlVGhyZWFkU3Vic2NyaXB0aW9uOiBbXG4gICAgICBcIkRFTEVURSAvbm90aWZpY2F0aW9ucy90aHJlYWRzL3t0aHJlYWRfaWR9L3N1YnNjcmlwdGlvblwiXG4gICAgXSxcbiAgICBnZXRGZWVkczogW1wiR0VUIC9mZWVkc1wiXSxcbiAgICBnZXRSZXBvU3Vic2NyaXB0aW9uOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N1YnNjcmlwdGlvblwiXSxcbiAgICBnZXRUaHJlYWQ6IFtcIkdFVCAvbm90aWZpY2F0aW9ucy90aHJlYWRzL3t0aHJlYWRfaWR9XCJdLFxuICAgIGdldFRocmVhZFN1YnNjcmlwdGlvbkZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvbm90aWZpY2F0aW9ucy90aHJlYWRzL3t0aHJlYWRfaWR9L3N1YnNjcmlwdGlvblwiXG4gICAgXSxcbiAgICBsaXN0RXZlbnRzRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9ldmVudHNcIl0sXG4gICAgbGlzdE5vdGlmaWNhdGlvbnNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC9ub3RpZmljYXRpb25zXCJdLFxuICAgIGxpc3RPcmdFdmVudHNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vZXZlbnRzL29yZ3Mve29yZ31cIlxuICAgIF0sXG4gICAgbGlzdFB1YmxpY0V2ZW50czogW1wiR0VUIC9ldmVudHNcIl0sXG4gICAgbGlzdFB1YmxpY0V2ZW50c0ZvclJlcG9OZXR3b3JrOiBbXCJHRVQgL25ldHdvcmtzL3tvd25lcn0ve3JlcG99L2V2ZW50c1wiXSxcbiAgICBsaXN0UHVibGljRXZlbnRzRm9yVXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L2V2ZW50cy9wdWJsaWNcIl0sXG4gICAgbGlzdFB1YmxpY09yZ0V2ZW50czogW1wiR0VUIC9vcmdzL3tvcmd9L2V2ZW50c1wiXSxcbiAgICBsaXN0UmVjZWl2ZWRFdmVudHNGb3JVc2VyOiBbXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vcmVjZWl2ZWRfZXZlbnRzXCJdLFxuICAgIGxpc3RSZWNlaXZlZFB1YmxpY0V2ZW50c0ZvclVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L3JlY2VpdmVkX2V2ZW50cy9wdWJsaWNcIlxuICAgIF0sXG4gICAgbGlzdFJlcG9FdmVudHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZXZlbnRzXCJdLFxuICAgIGxpc3RSZXBvTm90aWZpY2F0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vbm90aWZpY2F0aW9uc1wiXG4gICAgXSxcbiAgICBsaXN0UmVwb3NTdGFycmVkQnlBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL3N0YXJyZWRcIl0sXG4gICAgbGlzdFJlcG9zU3RhcnJlZEJ5VXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L3N0YXJyZWRcIl0sXG4gICAgbGlzdFJlcG9zV2F0Y2hlZEJ5VXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L3N1YnNjcmlwdGlvbnNcIl0sXG4gICAgbGlzdFN0YXJnYXplcnNGb3JSZXBvOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N0YXJnYXplcnNcIl0sXG4gICAgbGlzdFdhdGNoZWRSZXBvc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvc3Vic2NyaXB0aW9uc1wiXSxcbiAgICBsaXN0V2F0Y2hlcnNGb3JSZXBvOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N1YnNjcmliZXJzXCJdLFxuICAgIG1hcmtOb3RpZmljYXRpb25zQXNSZWFkOiBbXCJQVVQgL25vdGlmaWNhdGlvbnNcIl0sXG4gICAgbWFya1JlcG9Ob3RpZmljYXRpb25zQXNSZWFkOiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L25vdGlmaWNhdGlvbnNcIl0sXG4gICAgbWFya1RocmVhZEFzRG9uZTogW1wiREVMRVRFIC9ub3RpZmljYXRpb25zL3RocmVhZHMve3RocmVhZF9pZH1cIl0sXG4gICAgbWFya1RocmVhZEFzUmVhZDogW1wiUEFUQ0ggL25vdGlmaWNhdGlvbnMvdGhyZWFkcy97dGhyZWFkX2lkfVwiXSxcbiAgICBzZXRSZXBvU3Vic2NyaXB0aW9uOiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N1YnNjcmlwdGlvblwiXSxcbiAgICBzZXRUaHJlYWRTdWJzY3JpcHRpb246IFtcbiAgICAgIFwiUFVUIC9ub3RpZmljYXRpb25zL3RocmVhZHMve3RocmVhZF9pZH0vc3Vic2NyaXB0aW9uXCJcbiAgICBdLFxuICAgIHN0YXJSZXBvRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIlBVVCAvdXNlci9zdGFycmVkL3tvd25lcn0ve3JlcG99XCJdLFxuICAgIHVuc3RhclJlcG9Gb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiREVMRVRFIC91c2VyL3N0YXJyZWQve293bmVyfS97cmVwb31cIl1cbiAgfSxcbiAgYXBwczoge1xuICAgIGFkZFJlcG9Ub0luc3RhbGxhdGlvbjogW1xuICAgICAgXCJQVVQgL3VzZXIvaW5zdGFsbGF0aW9ucy97aW5zdGFsbGF0aW9uX2lkfS9yZXBvc2l0b3JpZXMve3JlcG9zaXRvcnlfaWR9XCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1wiYXBwc1wiLCBcImFkZFJlcG9Ub0luc3RhbGxhdGlvbkZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGFkZFJlcG9Ub0luc3RhbGxhdGlvbkZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBVVCAvdXNlci9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9L3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIlxuICAgIF0sXG4gICAgY2hlY2tUb2tlbjogW1wiUE9TVCAvYXBwbGljYXRpb25zL3tjbGllbnRfaWR9L3Rva2VuXCJdLFxuICAgIGNyZWF0ZUZyb21NYW5pZmVzdDogW1wiUE9TVCAvYXBwLW1hbmlmZXN0cy97Y29kZX0vY29udmVyc2lvbnNcIl0sXG4gICAgY3JlYXRlSW5zdGFsbGF0aW9uQWNjZXNzVG9rZW46IFtcbiAgICAgIFwiUE9TVCAvYXBwL2luc3RhbGxhdGlvbnMve2luc3RhbGxhdGlvbl9pZH0vYWNjZXNzX3Rva2Vuc1wiXG4gICAgXSxcbiAgICBkZWxldGVBdXRob3JpemF0aW9uOiBbXCJERUxFVEUgL2FwcGxpY2F0aW9ucy97Y2xpZW50X2lkfS9ncmFudFwiXSxcbiAgICBkZWxldGVJbnN0YWxsYXRpb246IFtcIkRFTEVURSAvYXBwL2luc3RhbGxhdGlvbnMve2luc3RhbGxhdGlvbl9pZH1cIl0sXG4gICAgZGVsZXRlVG9rZW46IFtcIkRFTEVURSAvYXBwbGljYXRpb25zL3tjbGllbnRfaWR9L3Rva2VuXCJdLFxuICAgIGdldEF1dGhlbnRpY2F0ZWQ6IFtcIkdFVCAvYXBwXCJdLFxuICAgIGdldEJ5U2x1ZzogW1wiR0VUIC9hcHBzL3thcHBfc2x1Z31cIl0sXG4gICAgZ2V0SW5zdGFsbGF0aW9uOiBbXCJHRVQgL2FwcC9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9XCJdLFxuICAgIGdldE9yZ0luc3RhbGxhdGlvbjogW1wiR0VUIC9vcmdzL3tvcmd9L2luc3RhbGxhdGlvblwiXSxcbiAgICBnZXRSZXBvSW5zdGFsbGF0aW9uOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2luc3RhbGxhdGlvblwiXSxcbiAgICBnZXRTdWJzY3JpcHRpb25QbGFuRm9yQWNjb3VudDogW1xuICAgICAgXCJHRVQgL21hcmtldHBsYWNlX2xpc3RpbmcvYWNjb3VudHMve2FjY291bnRfaWR9XCJcbiAgICBdLFxuICAgIGdldFN1YnNjcmlwdGlvblBsYW5Gb3JBY2NvdW50U3R1YmJlZDogW1xuICAgICAgXCJHRVQgL21hcmtldHBsYWNlX2xpc3Rpbmcvc3R1YmJlZC9hY2NvdW50cy97YWNjb3VudF9pZH1cIlxuICAgIF0sXG4gICAgZ2V0VXNlckluc3RhbGxhdGlvbjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L2luc3RhbGxhdGlvblwiXSxcbiAgICBnZXRXZWJob29rQ29uZmlnRm9yQXBwOiBbXCJHRVQgL2FwcC9ob29rL2NvbmZpZ1wiXSxcbiAgICBnZXRXZWJob29rRGVsaXZlcnk6IFtcIkdFVCAvYXBwL2hvb2svZGVsaXZlcmllcy97ZGVsaXZlcnlfaWR9XCJdLFxuICAgIGxpc3RBY2NvdW50c0ZvclBsYW46IFtcIkdFVCAvbWFya2V0cGxhY2VfbGlzdGluZy9wbGFucy97cGxhbl9pZH0vYWNjb3VudHNcIl0sXG4gICAgbGlzdEFjY291bnRzRm9yUGxhblN0dWJiZWQ6IFtcbiAgICAgIFwiR0VUIC9tYXJrZXRwbGFjZV9saXN0aW5nL3N0dWJiZWQvcGxhbnMve3BsYW5faWR9L2FjY291bnRzXCJcbiAgICBdLFxuICAgIGxpc3RJbnN0YWxsYXRpb25SZXBvc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlci9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9L3JlcG9zaXRvcmllc1wiXG4gICAgXSxcbiAgICBsaXN0SW5zdGFsbGF0aW9uUmVxdWVzdHNGb3JBdXRoZW50aWNhdGVkQXBwOiBbXG4gICAgICBcIkdFVCAvYXBwL2luc3RhbGxhdGlvbi1yZXF1ZXN0c1wiXG4gICAgXSxcbiAgICBsaXN0SW5zdGFsbGF0aW9uczogW1wiR0VUIC9hcHAvaW5zdGFsbGF0aW9uc1wiXSxcbiAgICBsaXN0SW5zdGFsbGF0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvaW5zdGFsbGF0aW9uc1wiXSxcbiAgICBsaXN0UGxhbnM6IFtcIkdFVCAvbWFya2V0cGxhY2VfbGlzdGluZy9wbGFuc1wiXSxcbiAgICBsaXN0UGxhbnNTdHViYmVkOiBbXCJHRVQgL21hcmtldHBsYWNlX2xpc3Rpbmcvc3R1YmJlZC9wbGFuc1wiXSxcbiAgICBsaXN0UmVwb3NBY2Nlc3NpYmxlVG9JbnN0YWxsYXRpb246IFtcIkdFVCAvaW5zdGFsbGF0aW9uL3JlcG9zaXRvcmllc1wiXSxcbiAgICBsaXN0U3Vic2NyaXB0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvbWFya2V0cGxhY2VfcHVyY2hhc2VzXCJdLFxuICAgIGxpc3RTdWJzY3JpcHRpb25zRm9yQXV0aGVudGljYXRlZFVzZXJTdHViYmVkOiBbXG4gICAgICBcIkdFVCAvdXNlci9tYXJrZXRwbGFjZV9wdXJjaGFzZXMvc3R1YmJlZFwiXG4gICAgXSxcbiAgICBsaXN0V2ViaG9va0RlbGl2ZXJpZXM6IFtcIkdFVCAvYXBwL2hvb2svZGVsaXZlcmllc1wiXSxcbiAgICByZWRlbGl2ZXJXZWJob29rRGVsaXZlcnk6IFtcbiAgICAgIFwiUE9TVCAvYXBwL2hvb2svZGVsaXZlcmllcy97ZGVsaXZlcnlfaWR9L2F0dGVtcHRzXCJcbiAgICBdLFxuICAgIHJlbW92ZVJlcG9Gcm9tSW5zdGFsbGF0aW9uOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9L3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJhcHBzXCIsIFwicmVtb3ZlUmVwb0Zyb21JbnN0YWxsYXRpb25Gb3JBdXRoZW50aWNhdGVkVXNlclwiXSB9XG4gICAgXSxcbiAgICByZW1vdmVSZXBvRnJvbUluc3RhbGxhdGlvbkZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9L3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIlxuICAgIF0sXG4gICAgcmVzZXRUb2tlbjogW1wiUEFUQ0ggL2FwcGxpY2F0aW9ucy97Y2xpZW50X2lkfS90b2tlblwiXSxcbiAgICByZXZva2VJbnN0YWxsYXRpb25BY2Nlc3NUb2tlbjogW1wiREVMRVRFIC9pbnN0YWxsYXRpb24vdG9rZW5cIl0sXG4gICAgc2NvcGVUb2tlbjogW1wiUE9TVCAvYXBwbGljYXRpb25zL3tjbGllbnRfaWR9L3Rva2VuL3Njb3BlZFwiXSxcbiAgICBzdXNwZW5kSW5zdGFsbGF0aW9uOiBbXCJQVVQgL2FwcC9pbnN0YWxsYXRpb25zL3tpbnN0YWxsYXRpb25faWR9L3N1c3BlbmRlZFwiXSxcbiAgICB1bnN1c3BlbmRJbnN0YWxsYXRpb246IFtcbiAgICAgIFwiREVMRVRFIC9hcHAvaW5zdGFsbGF0aW9ucy97aW5zdGFsbGF0aW9uX2lkfS9zdXNwZW5kZWRcIlxuICAgIF0sXG4gICAgdXBkYXRlV2ViaG9va0NvbmZpZ0ZvckFwcDogW1wiUEFUQ0ggL2FwcC9ob29rL2NvbmZpZ1wiXVxuICB9LFxuICBiaWxsaW5nOiB7XG4gICAgZ2V0R2l0aHViQWN0aW9uc0JpbGxpbmdPcmc6IFtcIkdFVCAvb3Jncy97b3JnfS9zZXR0aW5ncy9iaWxsaW5nL2FjdGlvbnNcIl0sXG4gICAgZ2V0R2l0aHViQWN0aW9uc0JpbGxpbmdVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9zZXR0aW5ncy9iaWxsaW5nL2FjdGlvbnNcIlxuICAgIF0sXG4gICAgZ2V0R2l0aHViQmlsbGluZ1VzYWdlUmVwb3J0T3JnOiBbXG4gICAgICBcIkdFVCAvb3JnYW5pemF0aW9ucy97b3JnfS9zZXR0aW5ncy9iaWxsaW5nL3VzYWdlXCJcbiAgICBdLFxuICAgIGdldEdpdGh1YlBhY2thZ2VzQmlsbGluZ09yZzogW1wiR0VUIC9vcmdzL3tvcmd9L3NldHRpbmdzL2JpbGxpbmcvcGFja2FnZXNcIl0sXG4gICAgZ2V0R2l0aHViUGFja2FnZXNCaWxsaW5nVXNlcjogW1xuICAgICAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vc2V0dGluZ3MvYmlsbGluZy9wYWNrYWdlc1wiXG4gICAgXSxcbiAgICBnZXRTaGFyZWRTdG9yYWdlQmlsbGluZ09yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vc2V0dGluZ3MvYmlsbGluZy9zaGFyZWQtc3RvcmFnZVwiXG4gICAgXSxcbiAgICBnZXRTaGFyZWRTdG9yYWdlQmlsbGluZ1VzZXI6IFtcbiAgICAgIFwiR0VUIC91c2Vycy97dXNlcm5hbWV9L3NldHRpbmdzL2JpbGxpbmcvc2hhcmVkLXN0b3JhZ2VcIlxuICAgIF1cbiAgfSxcbiAgY2hlY2tzOiB7XG4gICAgY3JlYXRlOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jaGVjay1ydW5zXCJdLFxuICAgIGNyZWF0ZVN1aXRlOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jaGVjay1zdWl0ZXNcIl0sXG4gICAgZ2V0OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NoZWNrLXJ1bnMve2NoZWNrX3J1bl9pZH1cIl0sXG4gICAgZ2V0U3VpdGU6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY2hlY2stc3VpdGVzL3tjaGVja19zdWl0ZV9pZH1cIl0sXG4gICAgbGlzdEFubm90YXRpb25zOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY2hlY2stcnVucy97Y2hlY2tfcnVuX2lkfS9hbm5vdGF0aW9uc1wiXG4gICAgXSxcbiAgICBsaXN0Rm9yUmVmOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1pdHMve3JlZn0vY2hlY2stcnVuc1wiXSxcbiAgICBsaXN0Rm9yU3VpdGU6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jaGVjay1zdWl0ZXMve2NoZWNrX3N1aXRlX2lkfS9jaGVjay1ydW5zXCJcbiAgICBdLFxuICAgIGxpc3RTdWl0ZXNGb3JSZWY6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWl0cy97cmVmfS9jaGVjay1zdWl0ZXNcIl0sXG4gICAgcmVyZXF1ZXN0UnVuOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NoZWNrLXJ1bnMve2NoZWNrX3J1bl9pZH0vcmVyZXF1ZXN0XCJcbiAgICBdLFxuICAgIHJlcmVxdWVzdFN1aXRlOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NoZWNrLXN1aXRlcy97Y2hlY2tfc3VpdGVfaWR9L3JlcmVxdWVzdFwiXG4gICAgXSxcbiAgICBzZXRTdWl0ZXNQcmVmZXJlbmNlczogW1xuICAgICAgXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vY2hlY2stc3VpdGVzL3ByZWZlcmVuY2VzXCJcbiAgICBdLFxuICAgIHVwZGF0ZTogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2NoZWNrLXJ1bnMve2NoZWNrX3J1bl9pZH1cIl1cbiAgfSxcbiAgY29kZVNjYW5uaW5nOiB7XG4gICAgY29tbWl0QXV0b2ZpeDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2FsZXJ0cy97YWxlcnRfbnVtYmVyfS9hdXRvZml4L2NvbW1pdHNcIlxuICAgIF0sXG4gICAgY3JlYXRlQXV0b2ZpeDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2FsZXJ0cy97YWxlcnRfbnVtYmVyfS9hdXRvZml4XCJcbiAgICBdLFxuICAgIGNyZWF0ZVZhcmlhbnRBbmFseXNpczogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2NvZGVxbC92YXJpYW50LWFuYWx5c2VzXCJcbiAgICBdLFxuICAgIGRlbGV0ZUFuYWx5c2lzOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZS1zY2FubmluZy9hbmFseXNlcy97YW5hbHlzaXNfaWR9ez9jb25maXJtX2RlbGV0ZX1cIlxuICAgIF0sXG4gICAgZGVsZXRlQ29kZXFsRGF0YWJhc2U6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2NvZGVxbC9kYXRhYmFzZXMve2xhbmd1YWdlfVwiXG4gICAgXSxcbiAgICBnZXRBbGVydDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvYWxlcnRzL3thbGVydF9udW1iZXJ9XCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZFBhcmFtZXRlcnM6IHsgYWxlcnRfaWQ6IFwiYWxlcnRfbnVtYmVyXCIgfSB9XG4gICAgXSxcbiAgICBnZXRBbmFseXNpczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvYW5hbHlzZXMve2FuYWx5c2lzX2lkfVwiXG4gICAgXSxcbiAgICBnZXRBdXRvZml4OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZS1zY2FubmluZy9hbGVydHMve2FsZXJ0X251bWJlcn0vYXV0b2ZpeFwiXG4gICAgXSxcbiAgICBnZXRDb2RlcWxEYXRhYmFzZTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvY29kZXFsL2RhdGFiYXNlcy97bGFuZ3VhZ2V9XCJcbiAgICBdLFxuICAgIGdldERlZmF1bHRTZXR1cDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2RlZmF1bHQtc2V0dXBcIl0sXG4gICAgZ2V0U2FyaWY6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZS1zY2FubmluZy9zYXJpZnMve3NhcmlmX2lkfVwiXSxcbiAgICBnZXRWYXJpYW50QW5hbHlzaXM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2NvZGVxbC92YXJpYW50LWFuYWx5c2VzL3tjb2RlcWxfdmFyaWFudF9hbmFseXNpc19pZH1cIlxuICAgIF0sXG4gICAgZ2V0VmFyaWFudEFuYWx5c2lzUmVwb1Rhc2s6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2NvZGVxbC92YXJpYW50LWFuYWx5c2VzL3tjb2RlcWxfdmFyaWFudF9hbmFseXNpc19pZH0vcmVwb3Mve3JlcG9fb3duZXJ9L3tyZXBvX25hbWV9XCJcbiAgICBdLFxuICAgIGxpc3RBbGVydEluc3RhbmNlczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvYWxlcnRzL3thbGVydF9udW1iZXJ9L2luc3RhbmNlc1wiXG4gICAgXSxcbiAgICBsaXN0QWxlcnRzRm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vY29kZS1zY2FubmluZy9hbGVydHNcIl0sXG4gICAgbGlzdEFsZXJ0c0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZS1zY2FubmluZy9hbGVydHNcIl0sXG4gICAgbGlzdEFsZXJ0c0luc3RhbmNlczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvYWxlcnRzL3thbGVydF9udW1iZXJ9L2luc3RhbmNlc1wiLFxuICAgICAge30sXG4gICAgICB7IHJlbmFtZWQ6IFtcImNvZGVTY2FubmluZ1wiLCBcImxpc3RBbGVydEluc3RhbmNlc1wiXSB9XG4gICAgXSxcbiAgICBsaXN0Q29kZXFsRGF0YWJhc2VzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZS1zY2FubmluZy9jb2RlcWwvZGF0YWJhc2VzXCJcbiAgICBdLFxuICAgIGxpc3RSZWNlbnRBbmFseXNlczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2FuYWx5c2VzXCJdLFxuICAgIHVwZGF0ZUFsZXJ0OiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2RlLXNjYW5uaW5nL2FsZXJ0cy97YWxlcnRfbnVtYmVyfVwiXG4gICAgXSxcbiAgICB1cGRhdGVEZWZhdWx0U2V0dXA6IFtcbiAgICAgIFwiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2Nhbm5pbmcvZGVmYXVsdC1zZXR1cFwiXG4gICAgXSxcbiAgICB1cGxvYWRTYXJpZjogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZS1zY2FubmluZy9zYXJpZnNcIl1cbiAgfSxcbiAgY29kZVNlY3VyaXR5OiB7XG4gICAgYXR0YWNoQ29uZmlndXJhdGlvbjogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L2NvZGUtc2VjdXJpdHkvY29uZmlndXJhdGlvbnMve2NvbmZpZ3VyYXRpb25faWR9L2F0dGFjaFwiXG4gICAgXSxcbiAgICBhdHRhY2hFbnRlcnByaXNlQ29uZmlndXJhdGlvbjogW1xuICAgICAgXCJQT1NUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9ucy97Y29uZmlndXJhdGlvbl9pZH0vYXR0YWNoXCJcbiAgICBdLFxuICAgIGNyZWF0ZUNvbmZpZ3VyYXRpb246IFtcIlBPU1QgL29yZ3Mve29yZ30vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9uc1wiXSxcbiAgICBjcmVhdGVDb25maWd1cmF0aW9uRm9yRW50ZXJwcmlzZTogW1xuICAgICAgXCJQT1NUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9uc1wiXG4gICAgXSxcbiAgICBkZWxldGVDb25maWd1cmF0aW9uOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL3tjb25maWd1cmF0aW9uX2lkfVwiXG4gICAgXSxcbiAgICBkZWxldGVDb25maWd1cmF0aW9uRm9yRW50ZXJwcmlzZTogW1xuICAgICAgXCJERUxFVEUgL2VudGVycHJpc2VzL3tlbnRlcnByaXNlfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL3tjb25maWd1cmF0aW9uX2lkfVwiXG4gICAgXSxcbiAgICBkZXRhY2hDb25maWd1cmF0aW9uOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL2RldGFjaFwiXG4gICAgXSxcbiAgICBnZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL3tjb25maWd1cmF0aW9uX2lkfVwiXG4gICAgXSxcbiAgICBnZXRDb25maWd1cmF0aW9uRm9yUmVwb3NpdG9yeTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGUtc2VjdXJpdHktY29uZmlndXJhdGlvblwiXG4gICAgXSxcbiAgICBnZXRDb25maWd1cmF0aW9uc0ZvckVudGVycHJpc2U6IFtcbiAgICAgIFwiR0VUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9uc1wiXG4gICAgXSxcbiAgICBnZXRDb25maWd1cmF0aW9uc0Zvck9yZzogW1wiR0VUIC9vcmdzL3tvcmd9L2NvZGUtc2VjdXJpdHkvY29uZmlndXJhdGlvbnNcIl0sXG4gICAgZ2V0RGVmYXVsdENvbmZpZ3VyYXRpb25zOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL2RlZmF1bHRzXCJcbiAgICBdLFxuICAgIGdldERlZmF1bHRDb25maWd1cmF0aW9uc0ZvckVudGVycHJpc2U6IFtcbiAgICAgIFwiR0VUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9ucy9kZWZhdWx0c1wiXG4gICAgXSxcbiAgICBnZXRSZXBvc2l0b3JpZXNGb3JDb25maWd1cmF0aW9uOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL3tjb25maWd1cmF0aW9uX2lkfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgZ2V0UmVwb3NpdG9yaWVzRm9yRW50ZXJwcmlzZUNvbmZpZ3VyYXRpb246IFtcbiAgICAgIFwiR0VUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9ucy97Y29uZmlndXJhdGlvbl9pZH0vcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIGdldFNpbmdsZUNvbmZpZ3VyYXRpb25Gb3JFbnRlcnByaXNlOiBbXG4gICAgICBcIkdFVCAvZW50ZXJwcmlzZXMve2VudGVycHJpc2V9L2NvZGUtc2VjdXJpdHkvY29uZmlndXJhdGlvbnMve2NvbmZpZ3VyYXRpb25faWR9XCJcbiAgICBdLFxuICAgIHNldENvbmZpZ3VyYXRpb25Bc0RlZmF1bHQ6IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L2NvZGUtc2VjdXJpdHkvY29uZmlndXJhdGlvbnMve2NvbmZpZ3VyYXRpb25faWR9L2RlZmF1bHRzXCJcbiAgICBdLFxuICAgIHNldENvbmZpZ3VyYXRpb25Bc0RlZmF1bHRGb3JFbnRlcnByaXNlOiBbXG4gICAgICBcIlBVVCAvZW50ZXJwcmlzZXMve2VudGVycHJpc2V9L2NvZGUtc2VjdXJpdHkvY29uZmlndXJhdGlvbnMve2NvbmZpZ3VyYXRpb25faWR9L2RlZmF1bHRzXCJcbiAgICBdLFxuICAgIHVwZGF0ZUNvbmZpZ3VyYXRpb246IFtcbiAgICAgIFwiUEFUQ0ggL29yZ3Mve29yZ30vY29kZS1zZWN1cml0eS9jb25maWd1cmF0aW9ucy97Y29uZmlndXJhdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgdXBkYXRlRW50ZXJwcmlzZUNvbmZpZ3VyYXRpb246IFtcbiAgICAgIFwiUEFUQ0ggL2VudGVycHJpc2VzL3tlbnRlcnByaXNlfS9jb2RlLXNlY3VyaXR5L2NvbmZpZ3VyYXRpb25zL3tjb25maWd1cmF0aW9uX2lkfVwiXG4gICAgXVxuICB9LFxuICBjb2Rlc09mQ29uZHVjdDoge1xuICAgIGdldEFsbENvZGVzT2ZDb25kdWN0OiBbXCJHRVQgL2NvZGVzX29mX2NvbmR1Y3RcIl0sXG4gICAgZ2V0Q29uZHVjdENvZGU6IFtcIkdFVCAvY29kZXNfb2ZfY29uZHVjdC97a2V5fVwiXVxuICB9LFxuICBjb2Rlc3BhY2VzOiB7XG4gICAgYWRkUmVwb3NpdG9yeUZvclNlY3JldEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBVVCAvdXNlci9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXMve3JlcG9zaXRvcnlfaWR9XCJcbiAgICBdLFxuICAgIGFkZFNlbGVjdGVkUmVwb1RvT3JnU2VjcmV0OiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXMve3JlcG9zaXRvcnlfaWR9XCJcbiAgICBdLFxuICAgIGNoZWNrUGVybWlzc2lvbnNGb3JEZXZjb250YWluZXI6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzL3Blcm1pc3Npb25zX2NoZWNrXCJcbiAgICBdLFxuICAgIGNvZGVzcGFjZU1hY2hpbmVzRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2VyL2NvZGVzcGFjZXMve2NvZGVzcGFjZV9uYW1lfS9tYWNoaW5lc1wiXG4gICAgXSxcbiAgICBjcmVhdGVGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiUE9TVCAvdXNlci9jb2Rlc3BhY2VzXCJdLFxuICAgIGNyZWF0ZU9yVXBkYXRlT3JnU2VjcmV0OiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVPclVwZGF0ZVJlcG9TZWNyZXQ6IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVPclVwZGF0ZVNlY3JldEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBVVCAvdXNlci9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVXaXRoUHJGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L2NvZGVzcGFjZXNcIlxuICAgIF0sXG4gICAgY3JlYXRlV2l0aFJlcG9Gb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzXCJcbiAgICBdLFxuICAgIGRlbGV0ZUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJERUxFVEUgL3VzZXIvY29kZXNwYWNlcy97Y29kZXNwYWNlX25hbWV9XCJdLFxuICAgIGRlbGV0ZUZyb21Pcmdhbml6YXRpb246IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L21lbWJlcnMve3VzZXJuYW1lfS9jb2Rlc3BhY2VzL3tjb2Rlc3BhY2VfbmFtZX1cIlxuICAgIF0sXG4gICAgZGVsZXRlT3JnU2VjcmV0OiBbXCJERUxFVEUgL29yZ3Mve29yZ30vY29kZXNwYWNlcy9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIl0sXG4gICAgZGVsZXRlUmVwb1NlY3JldDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGVzcGFjZXMvc2VjcmV0cy97c2VjcmV0X25hbWV9XCJcbiAgICBdLFxuICAgIGRlbGV0ZVNlY3JldEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBleHBvcnRGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJQT1NUIC91c2VyL2NvZGVzcGFjZXMve2NvZGVzcGFjZV9uYW1lfS9leHBvcnRzXCJcbiAgICBdLFxuICAgIGdldENvZGVzcGFjZXNGb3JVc2VySW5Pcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L21lbWJlcnMve3VzZXJuYW1lfS9jb2Rlc3BhY2VzXCJcbiAgICBdLFxuICAgIGdldEV4cG9ydERldGFpbHNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJHRVQgL3VzZXIvY29kZXNwYWNlcy97Y29kZXNwYWNlX25hbWV9L2V4cG9ydHMve2V4cG9ydF9pZH1cIlxuICAgIF0sXG4gICAgZ2V0Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlci9jb2Rlc3BhY2VzL3tjb2Rlc3BhY2VfbmFtZX1cIl0sXG4gICAgZ2V0T3JnUHVibGljS2V5OiBbXCJHRVQgL29yZ3Mve29yZ30vY29kZXNwYWNlcy9zZWNyZXRzL3B1YmxpYy1rZXlcIl0sXG4gICAgZ2V0T3JnU2VjcmV0OiBbXCJHRVQgL29yZ3Mve29yZ30vY29kZXNwYWNlcy9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIl0sXG4gICAgZ2V0UHVibGljS2V5Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2VyL2NvZGVzcGFjZXMvc2VjcmV0cy9wdWJsaWMta2V5XCJcbiAgICBdLFxuICAgIGdldFJlcG9QdWJsaWNLZXk6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzL3NlY3JldHMvcHVibGljLWtleVwiXG4gICAgXSxcbiAgICBnZXRSZXBvU2VjcmV0OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29kZXNwYWNlcy9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIlxuICAgIF0sXG4gICAgZ2V0U2VjcmV0Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2VyL2NvZGVzcGFjZXMvc2VjcmV0cy97c2VjcmV0X25hbWV9XCJcbiAgICBdLFxuICAgIGxpc3REZXZjb250YWluZXJzSW5SZXBvc2l0b3J5Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzL2RldmNvbnRhaW5lcnNcIlxuICAgIF0sXG4gICAgbGlzdEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvY29kZXNwYWNlc1wiXSxcbiAgICBsaXN0SW5Pcmdhbml6YXRpb246IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2NvZGVzcGFjZXNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkUGFyYW1ldGVyczogeyBvcmdfaWQ6IFwib3JnXCIgfSB9XG4gICAgXSxcbiAgICBsaXN0SW5SZXBvc2l0b3J5Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzXCJcbiAgICBdLFxuICAgIGxpc3RPcmdTZWNyZXRzOiBbXCJHRVQgL29yZ3Mve29yZ30vY29kZXNwYWNlcy9zZWNyZXRzXCJdLFxuICAgIGxpc3RSZXBvU2VjcmV0czogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzL3NlY3JldHNcIl0sXG4gICAgbGlzdFJlcG9zaXRvcmllc0ZvclNlY3JldEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlci9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgbGlzdFNlY3JldHNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL2NvZGVzcGFjZXMvc2VjcmV0c1wiXSxcbiAgICBsaXN0U2VsZWN0ZWRSZXBvc0Zvck9yZ1NlY3JldDogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vY29kZXNwYWNlcy9zZWNyZXRzL3tzZWNyZXRfbmFtZX0vcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIHByZUZsaWdodFdpdGhSZXBvRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlc3BhY2VzL25ld1wiXG4gICAgXSxcbiAgICBwdWJsaXNoRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiUE9TVCAvdXNlci9jb2Rlc3BhY2VzL3tjb2Rlc3BhY2VfbmFtZX0vcHVibGlzaFwiXG4gICAgXSxcbiAgICByZW1vdmVSZXBvc2l0b3J5Rm9yU2VjcmV0Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC91c2VyL2NvZGVzcGFjZXMvc2VjcmV0cy97c2VjcmV0X25hbWV9L3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIlxuICAgIF0sXG4gICAgcmVtb3ZlU2VsZWN0ZWRSZXBvRnJvbU9yZ1NlY3JldDogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vY29kZXNwYWNlcy9zZWNyZXRzL3tzZWNyZXRfbmFtZX0vcmVwb3NpdG9yaWVzL3tyZXBvc2l0b3J5X2lkfVwiXG4gICAgXSxcbiAgICByZXBvTWFjaGluZXNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvZGVzcGFjZXMvbWFjaGluZXNcIlxuICAgIF0sXG4gICAgc2V0UmVwb3NpdG9yaWVzRm9yU2VjcmV0Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiUFVUIC91c2VyL2NvZGVzcGFjZXMvc2VjcmV0cy97c2VjcmV0X25hbWV9L3JlcG9zaXRvcmllc1wiXG4gICAgXSxcbiAgICBzZXRTZWxlY3RlZFJlcG9zRm9yT3JnU2VjcmV0OiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9jb2Rlc3BhY2VzL3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgc3RhcnRGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiUE9TVCAvdXNlci9jb2Rlc3BhY2VzL3tjb2Rlc3BhY2VfbmFtZX0vc3RhcnRcIl0sXG4gICAgc3RvcEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJQT1NUIC91c2VyL2NvZGVzcGFjZXMve2NvZGVzcGFjZV9uYW1lfS9zdG9wXCJdLFxuICAgIHN0b3BJbk9yZ2FuaXphdGlvbjogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L21lbWJlcnMve3VzZXJuYW1lfS9jb2Rlc3BhY2VzL3tjb2Rlc3BhY2VfbmFtZX0vc3RvcFwiXG4gICAgXSxcbiAgICB1cGRhdGVGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiUEFUQ0ggL3VzZXIvY29kZXNwYWNlcy97Y29kZXNwYWNlX25hbWV9XCJdXG4gIH0sXG4gIGNvcGlsb3Q6IHtcbiAgICBhZGRDb3BpbG90U2VhdHNGb3JUZWFtczogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L2NvcGlsb3QvYmlsbGluZy9zZWxlY3RlZF90ZWFtc1wiXG4gICAgXSxcbiAgICBhZGRDb3BpbG90U2VhdHNGb3JVc2VyczogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L2NvcGlsb3QvYmlsbGluZy9zZWxlY3RlZF91c2Vyc1wiXG4gICAgXSxcbiAgICBjYW5jZWxDb3BpbG90U2VhdEFzc2lnbm1lbnRGb3JUZWFtczogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vY29waWxvdC9iaWxsaW5nL3NlbGVjdGVkX3RlYW1zXCJcbiAgICBdLFxuICAgIGNhbmNlbENvcGlsb3RTZWF0QXNzaWdubWVudEZvclVzZXJzOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9jb3BpbG90L2JpbGxpbmcvc2VsZWN0ZWRfdXNlcnNcIlxuICAgIF0sXG4gICAgY29waWxvdE1ldHJpY3NGb3JPcmdhbml6YXRpb246IFtcIkdFVCAvb3Jncy97b3JnfS9jb3BpbG90L21ldHJpY3NcIl0sXG4gICAgY29waWxvdE1ldHJpY3NGb3JUZWFtOiBbXCJHRVQgL29yZ3Mve29yZ30vdGVhbS97dGVhbV9zbHVnfS9jb3BpbG90L21ldHJpY3NcIl0sXG4gICAgZ2V0Q29waWxvdE9yZ2FuaXphdGlvbkRldGFpbHM6IFtcIkdFVCAvb3Jncy97b3JnfS9jb3BpbG90L2JpbGxpbmdcIl0sXG4gICAgZ2V0Q29waWxvdFNlYXREZXRhaWxzRm9yVXNlcjogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vbWVtYmVycy97dXNlcm5hbWV9L2NvcGlsb3RcIlxuICAgIF0sXG4gICAgbGlzdENvcGlsb3RTZWF0czogW1wiR0VUIC9vcmdzL3tvcmd9L2NvcGlsb3QvYmlsbGluZy9zZWF0c1wiXSxcbiAgICB1c2FnZU1ldHJpY3NGb3JPcmc6IFtcIkdFVCAvb3Jncy97b3JnfS9jb3BpbG90L3VzYWdlXCJdLFxuICAgIHVzYWdlTWV0cmljc0ZvclRlYW06IFtcIkdFVCAvb3Jncy97b3JnfS90ZWFtL3t0ZWFtX3NsdWd9L2NvcGlsb3QvdXNhZ2VcIl1cbiAgfSxcbiAgZGVwZW5kYWJvdDoge1xuICAgIGFkZFNlbGVjdGVkUmVwb1RvT3JnU2VjcmV0OiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9kZXBlbmRhYm90L3NlY3JldHMve3NlY3JldF9uYW1lfS9yZXBvc2l0b3JpZXMve3JlcG9zaXRvcnlfaWR9XCJcbiAgICBdLFxuICAgIGNyZWF0ZU9yVXBkYXRlT3JnU2VjcmV0OiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9kZXBlbmRhYm90L3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVPclVwZGF0ZVJlcG9TZWNyZXQ6IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBlbmRhYm90L3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBkZWxldGVPcmdTZWNyZXQ6IFtcIkRFTEVURSAvb3Jncy97b3JnfS9kZXBlbmRhYm90L3NlY3JldHMve3NlY3JldF9uYW1lfVwiXSxcbiAgICBkZWxldGVSZXBvU2VjcmV0OiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwZW5kYWJvdC9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIlxuICAgIF0sXG4gICAgZ2V0QWxlcnQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwZW5kYWJvdC9hbGVydHMve2FsZXJ0X251bWJlcn1cIl0sXG4gICAgZ2V0T3JnUHVibGljS2V5OiBbXCJHRVQgL29yZ3Mve29yZ30vZGVwZW5kYWJvdC9zZWNyZXRzL3B1YmxpYy1rZXlcIl0sXG4gICAgZ2V0T3JnU2VjcmV0OiBbXCJHRVQgL29yZ3Mve29yZ30vZGVwZW5kYWJvdC9zZWNyZXRzL3tzZWNyZXRfbmFtZX1cIl0sXG4gICAgZ2V0UmVwb1B1YmxpY0tleTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2RlcGVuZGFib3Qvc2VjcmV0cy9wdWJsaWMta2V5XCJcbiAgICBdLFxuICAgIGdldFJlcG9TZWNyZXQ6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBlbmRhYm90L3NlY3JldHMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBsaXN0QWxlcnRzRm9yRW50ZXJwcmlzZTogW1xuICAgICAgXCJHRVQgL2VudGVycHJpc2VzL3tlbnRlcnByaXNlfS9kZXBlbmRhYm90L2FsZXJ0c1wiXG4gICAgXSxcbiAgICBsaXN0QWxlcnRzRm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vZGVwZW5kYWJvdC9hbGVydHNcIl0sXG4gICAgbGlzdEFsZXJ0c0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwZW5kYWJvdC9hbGVydHNcIl0sXG4gICAgbGlzdE9yZ1NlY3JldHM6IFtcIkdFVCAvb3Jncy97b3JnfS9kZXBlbmRhYm90L3NlY3JldHNcIl0sXG4gICAgbGlzdFJlcG9TZWNyZXRzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2RlcGVuZGFib3Qvc2VjcmV0c1wiXSxcbiAgICBsaXN0U2VsZWN0ZWRSZXBvc0Zvck9yZ1NlY3JldDogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vZGVwZW5kYWJvdC9zZWNyZXRzL3tzZWNyZXRfbmFtZX0vcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIHJlbW92ZVNlbGVjdGVkUmVwb0Zyb21PcmdTZWNyZXQ6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L2RlcGVuZGFib3Qvc2VjcmV0cy97c2VjcmV0X25hbWV9L3JlcG9zaXRvcmllcy97cmVwb3NpdG9yeV9pZH1cIlxuICAgIF0sXG4gICAgc2V0U2VsZWN0ZWRSZXBvc0Zvck9yZ1NlY3JldDogW1xuICAgICAgXCJQVVQgL29yZ3Mve29yZ30vZGVwZW5kYWJvdC9zZWNyZXRzL3tzZWNyZXRfbmFtZX0vcmVwb3NpdG9yaWVzXCJcbiAgICBdLFxuICAgIHVwZGF0ZUFsZXJ0OiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBlbmRhYm90L2FsZXJ0cy97YWxlcnRfbnVtYmVyfVwiXG4gICAgXVxuICB9LFxuICBkZXBlbmRlbmN5R3JhcGg6IHtcbiAgICBjcmVhdGVSZXBvc2l0b3J5U25hcHNob3Q6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwZW5kZW5jeS1ncmFwaC9zbmFwc2hvdHNcIlxuICAgIF0sXG4gICAgZGlmZlJhbmdlOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwZW5kZW5jeS1ncmFwaC9jb21wYXJlL3tiYXNlaGVhZH1cIlxuICAgIF0sXG4gICAgZXhwb3J0U2JvbTogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBlbmRlbmN5LWdyYXBoL3Nib21cIl1cbiAgfSxcbiAgZW1vamlzOiB7IGdldDogW1wiR0VUIC9lbW9qaXNcIl0gfSxcbiAgZ2lzdHM6IHtcbiAgICBjaGVja0lzU3RhcnJlZDogW1wiR0VUIC9naXN0cy97Z2lzdF9pZH0vc3RhclwiXSxcbiAgICBjcmVhdGU6IFtcIlBPU1QgL2dpc3RzXCJdLFxuICAgIGNyZWF0ZUNvbW1lbnQ6IFtcIlBPU1QgL2dpc3RzL3tnaXN0X2lkfS9jb21tZW50c1wiXSxcbiAgICBkZWxldGU6IFtcIkRFTEVURSAvZ2lzdHMve2dpc3RfaWR9XCJdLFxuICAgIGRlbGV0ZUNvbW1lbnQ6IFtcIkRFTEVURSAvZ2lzdHMve2dpc3RfaWR9L2NvbW1lbnRzL3tjb21tZW50X2lkfVwiXSxcbiAgICBmb3JrOiBbXCJQT1NUIC9naXN0cy97Z2lzdF9pZH0vZm9ya3NcIl0sXG4gICAgZ2V0OiBbXCJHRVQgL2dpc3RzL3tnaXN0X2lkfVwiXSxcbiAgICBnZXRDb21tZW50OiBbXCJHRVQgL2dpc3RzL3tnaXN0X2lkfS9jb21tZW50cy97Y29tbWVudF9pZH1cIl0sXG4gICAgZ2V0UmV2aXNpb246IFtcIkdFVCAvZ2lzdHMve2dpc3RfaWR9L3tzaGF9XCJdLFxuICAgIGxpc3Q6IFtcIkdFVCAvZ2lzdHNcIl0sXG4gICAgbGlzdENvbW1lbnRzOiBbXCJHRVQgL2dpc3RzL3tnaXN0X2lkfS9jb21tZW50c1wiXSxcbiAgICBsaXN0Q29tbWl0czogW1wiR0VUIC9naXN0cy97Z2lzdF9pZH0vY29tbWl0c1wiXSxcbiAgICBsaXN0Rm9yVXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L2dpc3RzXCJdLFxuICAgIGxpc3RGb3JrczogW1wiR0VUIC9naXN0cy97Z2lzdF9pZH0vZm9ya3NcIl0sXG4gICAgbGlzdFB1YmxpYzogW1wiR0VUIC9naXN0cy9wdWJsaWNcIl0sXG4gICAgbGlzdFN0YXJyZWQ6IFtcIkdFVCAvZ2lzdHMvc3RhcnJlZFwiXSxcbiAgICBzdGFyOiBbXCJQVVQgL2dpc3RzL3tnaXN0X2lkfS9zdGFyXCJdLFxuICAgIHVuc3RhcjogW1wiREVMRVRFIC9naXN0cy97Z2lzdF9pZH0vc3RhclwiXSxcbiAgICB1cGRhdGU6IFtcIlBBVENIIC9naXN0cy97Z2lzdF9pZH1cIl0sXG4gICAgdXBkYXRlQ29tbWVudDogW1wiUEFUQ0ggL2dpc3RzL3tnaXN0X2lkfS9jb21tZW50cy97Y29tbWVudF9pZH1cIl1cbiAgfSxcbiAgZ2l0OiB7XG4gICAgY3JlYXRlQmxvYjogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vZ2l0L2Jsb2JzXCJdLFxuICAgIGNyZWF0ZUNvbW1pdDogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vZ2l0L2NvbW1pdHNcIl0sXG4gICAgY3JlYXRlUmVmOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9naXQvcmVmc1wiXSxcbiAgICBjcmVhdGVUYWc6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2dpdC90YWdzXCJdLFxuICAgIGNyZWF0ZVRyZWU6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2dpdC90cmVlc1wiXSxcbiAgICBkZWxldGVSZWY6IFtcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vZ2l0L3JlZnMve3JlZn1cIl0sXG4gICAgZ2V0QmxvYjogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9naXQvYmxvYnMve2ZpbGVfc2hhfVwiXSxcbiAgICBnZXRDb21taXQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZ2l0L2NvbW1pdHMve2NvbW1pdF9zaGF9XCJdLFxuICAgIGdldFJlZjogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9naXQvcmVmL3tyZWZ9XCJdLFxuICAgIGdldFRhZzogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9naXQvdGFncy97dGFnX3NoYX1cIl0sXG4gICAgZ2V0VHJlZTogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9naXQvdHJlZXMve3RyZWVfc2hhfVwiXSxcbiAgICBsaXN0TWF0Y2hpbmdSZWZzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2dpdC9tYXRjaGluZy1yZWZzL3tyZWZ9XCJdLFxuICAgIHVwZGF0ZVJlZjogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2dpdC9yZWZzL3tyZWZ9XCJdXG4gIH0sXG4gIGdpdGlnbm9yZToge1xuICAgIGdldEFsbFRlbXBsYXRlczogW1wiR0VUIC9naXRpZ25vcmUvdGVtcGxhdGVzXCJdLFxuICAgIGdldFRlbXBsYXRlOiBbXCJHRVQgL2dpdGlnbm9yZS90ZW1wbGF0ZXMve25hbWV9XCJdXG4gIH0sXG4gIGhvc3RlZENvbXB1dGU6IHtcbiAgICBjcmVhdGVOZXR3b3JrQ29uZmlndXJhdGlvbkZvck9yZzogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L3NldHRpbmdzL25ldHdvcmstY29uZmlndXJhdGlvbnNcIlxuICAgIF0sXG4gICAgZGVsZXRlTmV0d29ya0NvbmZpZ3VyYXRpb25Gcm9tT3JnOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9zZXR0aW5ncy9uZXR3b3JrLWNvbmZpZ3VyYXRpb25zL3tuZXR3b3JrX2NvbmZpZ3VyYXRpb25faWR9XCJcbiAgICBdLFxuICAgIGdldE5ldHdvcmtDb25maWd1cmF0aW9uRm9yT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9zZXR0aW5ncy9uZXR3b3JrLWNvbmZpZ3VyYXRpb25zL3tuZXR3b3JrX2NvbmZpZ3VyYXRpb25faWR9XCJcbiAgICBdLFxuICAgIGdldE5ldHdvcmtTZXR0aW5nc0Zvck9yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vc2V0dGluZ3MvbmV0d29yay1zZXR0aW5ncy97bmV0d29ya19zZXR0aW5nc19pZH1cIlxuICAgIF0sXG4gICAgbGlzdE5ldHdvcmtDb25maWd1cmF0aW9uc0Zvck9yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vc2V0dGluZ3MvbmV0d29yay1jb25maWd1cmF0aW9uc1wiXG4gICAgXSxcbiAgICB1cGRhdGVOZXR3b3JrQ29uZmlndXJhdGlvbkZvck9yZzogW1xuICAgICAgXCJQQVRDSCAvb3Jncy97b3JnfS9zZXR0aW5ncy9uZXR3b3JrLWNvbmZpZ3VyYXRpb25zL3tuZXR3b3JrX2NvbmZpZ3VyYXRpb25faWR9XCJcbiAgICBdXG4gIH0sXG4gIGludGVyYWN0aW9uczoge1xuICAgIGdldFJlc3RyaWN0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvaW50ZXJhY3Rpb24tbGltaXRzXCJdLFxuICAgIGdldFJlc3RyaWN0aW9uc0Zvck9yZzogW1wiR0VUIC9vcmdzL3tvcmd9L2ludGVyYWN0aW9uLWxpbWl0c1wiXSxcbiAgICBnZXRSZXN0cmljdGlvbnNGb3JSZXBvOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2ludGVyYWN0aW9uLWxpbWl0c1wiXSxcbiAgICBnZXRSZXN0cmljdGlvbnNGb3JZb3VyUHVibGljUmVwb3M6IFtcbiAgICAgIFwiR0VUIC91c2VyL2ludGVyYWN0aW9uLWxpbWl0c1wiLFxuICAgICAge30sXG4gICAgICB7IHJlbmFtZWQ6IFtcImludGVyYWN0aW9uc1wiLCBcImdldFJlc3RyaWN0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIHJlbW92ZVJlc3RyaWN0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJERUxFVEUgL3VzZXIvaW50ZXJhY3Rpb24tbGltaXRzXCJdLFxuICAgIHJlbW92ZVJlc3RyaWN0aW9uc0Zvck9yZzogW1wiREVMRVRFIC9vcmdzL3tvcmd9L2ludGVyYWN0aW9uLWxpbWl0c1wiXSxcbiAgICByZW1vdmVSZXN0cmljdGlvbnNGb3JSZXBvOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vaW50ZXJhY3Rpb24tbGltaXRzXCJcbiAgICBdLFxuICAgIHJlbW92ZVJlc3RyaWN0aW9uc0ZvcllvdXJQdWJsaWNSZXBvczogW1xuICAgICAgXCJERUxFVEUgL3VzZXIvaW50ZXJhY3Rpb24tbGltaXRzXCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1wiaW50ZXJhY3Rpb25zXCIsIFwicmVtb3ZlUmVzdHJpY3Rpb25zRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgc2V0UmVzdHJpY3Rpb25zRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIlBVVCAvdXNlci9pbnRlcmFjdGlvbi1saW1pdHNcIl0sXG4gICAgc2V0UmVzdHJpY3Rpb25zRm9yT3JnOiBbXCJQVVQgL29yZ3Mve29yZ30vaW50ZXJhY3Rpb24tbGltaXRzXCJdLFxuICAgIHNldFJlc3RyaWN0aW9uc0ZvclJlcG86IFtcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vaW50ZXJhY3Rpb24tbGltaXRzXCJdLFxuICAgIHNldFJlc3RyaWN0aW9uc0ZvcllvdXJQdWJsaWNSZXBvczogW1xuICAgICAgXCJQVVQgL3VzZXIvaW50ZXJhY3Rpb24tbGltaXRzXCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1wiaW50ZXJhY3Rpb25zXCIsIFwic2V0UmVzdHJpY3Rpb25zRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF1cbiAgfSxcbiAgaXNzdWVzOiB7XG4gICAgYWRkQXNzaWduZWVzOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9hc3NpZ25lZXNcIlxuICAgIF0sXG4gICAgYWRkTGFiZWxzOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vbGFiZWxzXCJdLFxuICAgIGFkZFN1Yklzc3VlOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9zdWJfaXNzdWVzXCJcbiAgICBdLFxuICAgIGNoZWNrVXNlckNhbkJlQXNzaWduZWQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYXNzaWduZWVzL3thc3NpZ25lZX1cIl0sXG4gICAgY2hlY2tVc2VyQ2FuQmVBc3NpZ25lZFRvSXNzdWU6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vYXNzaWduZWVzL3thc3NpZ25lZX1cIlxuICAgIF0sXG4gICAgY3JlYXRlOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXNcIl0sXG4gICAgY3JlYXRlQ29tbWVudDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vY29tbWVudHNcIlxuICAgIF0sXG4gICAgY3JlYXRlTGFiZWw6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2xhYmVsc1wiXSxcbiAgICBjcmVhdGVNaWxlc3RvbmU6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L21pbGVzdG9uZXNcIl0sXG4gICAgZGVsZXRlQ29tbWVudDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy9jb21tZW50cy97Y29tbWVudF9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlTGFiZWw6IFtcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vbGFiZWxzL3tuYW1lfVwiXSxcbiAgICBkZWxldGVNaWxlc3RvbmU6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9taWxlc3RvbmVzL3ttaWxlc3RvbmVfbnVtYmVyfVwiXG4gICAgXSxcbiAgICBnZXQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9XCJdLFxuICAgIGdldENvbW1lbnQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL2NvbW1lbnRzL3tjb21tZW50X2lkfVwiXSxcbiAgICBnZXRFdmVudDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMvZXZlbnRzL3tldmVudF9pZH1cIl0sXG4gICAgZ2V0TGFiZWw6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vbGFiZWxzL3tuYW1lfVwiXSxcbiAgICBnZXRNaWxlc3RvbmU6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vbWlsZXN0b25lcy97bWlsZXN0b25lX251bWJlcn1cIl0sXG4gICAgbGlzdDogW1wiR0VUIC9pc3N1ZXNcIl0sXG4gICAgbGlzdEFzc2lnbmVlczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hc3NpZ25lZXNcIl0sXG4gICAgbGlzdENvbW1lbnRzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9jb21tZW50c1wiXSxcbiAgICBsaXN0Q29tbWVudHNGb3JSZXBvOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy9jb21tZW50c1wiXSxcbiAgICBsaXN0RXZlbnRzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9ldmVudHNcIl0sXG4gICAgbGlzdEV2ZW50c0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL2V2ZW50c1wiXSxcbiAgICBsaXN0RXZlbnRzRm9yVGltZWxpbmU6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vdGltZWxpbmVcIlxuICAgIF0sXG4gICAgbGlzdEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvaXNzdWVzXCJdLFxuICAgIGxpc3RGb3JPcmc6IFtcIkdFVCAvb3Jncy97b3JnfS9pc3N1ZXNcIl0sXG4gICAgbGlzdEZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzXCJdLFxuICAgIGxpc3RMYWJlbHNGb3JNaWxlc3RvbmU6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9taWxlc3RvbmVzL3ttaWxlc3RvbmVfbnVtYmVyfS9sYWJlbHNcIlxuICAgIF0sXG4gICAgbGlzdExhYmVsc0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vbGFiZWxzXCJdLFxuICAgIGxpc3RMYWJlbHNPbklzc3VlOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L2xhYmVsc1wiXG4gICAgXSxcbiAgICBsaXN0TWlsZXN0b25lczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9taWxlc3RvbmVzXCJdLFxuICAgIGxpc3RTdWJJc3N1ZXM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vc3ViX2lzc3Vlc1wiXG4gICAgXSxcbiAgICBsb2NrOiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9sb2NrXCJdLFxuICAgIHJlbW92ZUFsbExhYmVsczogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9sYWJlbHNcIlxuICAgIF0sXG4gICAgcmVtb3ZlQXNzaWduZWVzOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L2Fzc2lnbmVlc1wiXG4gICAgXSxcbiAgICByZW1vdmVMYWJlbDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9sYWJlbHMve25hbWV9XCJcbiAgICBdLFxuICAgIHJlbW92ZVN1Yklzc3VlOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L3N1Yl9pc3N1ZVwiXG4gICAgXSxcbiAgICByZXByaW9yaXRpemVTdWJJc3N1ZTogW1xuICAgICAgXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L3N1Yl9pc3N1ZXMvcHJpb3JpdHlcIlxuICAgIF0sXG4gICAgc2V0TGFiZWxzOiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9sYWJlbHNcIl0sXG4gICAgdW5sb2NrOiBbXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfS9sb2NrXCJdLFxuICAgIHVwZGF0ZTogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy97aXNzdWVfbnVtYmVyfVwiXSxcbiAgICB1cGRhdGVDb21tZW50OiBbXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL2NvbW1lbnRzL3tjb21tZW50X2lkfVwiXSxcbiAgICB1cGRhdGVMYWJlbDogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2xhYmVscy97bmFtZX1cIl0sXG4gICAgdXBkYXRlTWlsZXN0b25lOiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9taWxlc3RvbmVzL3ttaWxlc3RvbmVfbnVtYmVyfVwiXG4gICAgXVxuICB9LFxuICBsaWNlbnNlczoge1xuICAgIGdldDogW1wiR0VUIC9saWNlbnNlcy97bGljZW5zZX1cIl0sXG4gICAgZ2V0QWxsQ29tbW9ubHlVc2VkOiBbXCJHRVQgL2xpY2Vuc2VzXCJdLFxuICAgIGdldEZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vbGljZW5zZVwiXVxuICB9LFxuICBtYXJrZG93bjoge1xuICAgIHJlbmRlcjogW1wiUE9TVCAvbWFya2Rvd25cIl0sXG4gICAgcmVuZGVyUmF3OiBbXG4gICAgICBcIlBPU1QgL21hcmtkb3duL3Jhd1wiLFxuICAgICAgeyBoZWFkZXJzOiB7IFwiY29udGVudC10eXBlXCI6IFwidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOFwiIH0gfVxuICAgIF1cbiAgfSxcbiAgbWV0YToge1xuICAgIGdldDogW1wiR0VUIC9tZXRhXCJdLFxuICAgIGdldEFsbFZlcnNpb25zOiBbXCJHRVQgL3ZlcnNpb25zXCJdLFxuICAgIGdldE9jdG9jYXQ6IFtcIkdFVCAvb2N0b2NhdFwiXSxcbiAgICBnZXRaZW46IFtcIkdFVCAvemVuXCJdLFxuICAgIHJvb3Q6IFtcIkdFVCAvXCJdXG4gIH0sXG4gIG1pZ3JhdGlvbnM6IHtcbiAgICBkZWxldGVBcmNoaXZlRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC91c2VyL21pZ3JhdGlvbnMve21pZ3JhdGlvbl9pZH0vYXJjaGl2ZVwiXG4gICAgXSxcbiAgICBkZWxldGVBcmNoaXZlRm9yT3JnOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9taWdyYXRpb25zL3ttaWdyYXRpb25faWR9L2FyY2hpdmVcIlxuICAgIF0sXG4gICAgZG93bmxvYWRBcmNoaXZlRm9yT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9taWdyYXRpb25zL3ttaWdyYXRpb25faWR9L2FyY2hpdmVcIlxuICAgIF0sXG4gICAgZ2V0QXJjaGl2ZUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlci9taWdyYXRpb25zL3ttaWdyYXRpb25faWR9L2FyY2hpdmVcIlxuICAgIF0sXG4gICAgZ2V0U3RhdHVzRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlci9taWdyYXRpb25zL3ttaWdyYXRpb25faWR9XCJdLFxuICAgIGdldFN0YXR1c0Zvck9yZzogW1wiR0VUIC9vcmdzL3tvcmd9L21pZ3JhdGlvbnMve21pZ3JhdGlvbl9pZH1cIl0sXG4gICAgbGlzdEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvbWlncmF0aW9uc1wiXSxcbiAgICBsaXN0Rm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vbWlncmF0aW9uc1wiXSxcbiAgICBsaXN0UmVwb3NGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJHRVQgL3VzZXIvbWlncmF0aW9ucy97bWlncmF0aW9uX2lkfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgbGlzdFJlcG9zRm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vbWlncmF0aW9ucy97bWlncmF0aW9uX2lkfS9yZXBvc2l0b3JpZXNcIl0sXG4gICAgbGlzdFJlcG9zRm9yVXNlcjogW1xuICAgICAgXCJHRVQgL3VzZXIvbWlncmF0aW9ucy97bWlncmF0aW9uX2lkfS9yZXBvc2l0b3JpZXNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJtaWdyYXRpb25zXCIsIFwibGlzdFJlcG9zRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgc3RhcnRGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiUE9TVCAvdXNlci9taWdyYXRpb25zXCJdLFxuICAgIHN0YXJ0Rm9yT3JnOiBbXCJQT1NUIC9vcmdzL3tvcmd9L21pZ3JhdGlvbnNcIl0sXG4gICAgdW5sb2NrUmVwb0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9taWdyYXRpb25zL3ttaWdyYXRpb25faWR9L3JlcG9zL3tyZXBvX25hbWV9L2xvY2tcIlxuICAgIF0sXG4gICAgdW5sb2NrUmVwb0Zvck9yZzogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vbWlncmF0aW9ucy97bWlncmF0aW9uX2lkfS9yZXBvcy97cmVwb19uYW1lfS9sb2NrXCJcbiAgICBdXG4gIH0sXG4gIG9pZGM6IHtcbiAgICBnZXRPaWRjQ3VzdG9tU3ViVGVtcGxhdGVGb3JPcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2FjdGlvbnMvb2lkYy9jdXN0b21pemF0aW9uL3N1YlwiXG4gICAgXSxcbiAgICB1cGRhdGVPaWRjQ3VzdG9tU3ViVGVtcGxhdGVGb3JPcmc6IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L2FjdGlvbnMvb2lkYy9jdXN0b21pemF0aW9uL3N1YlwiXG4gICAgXVxuICB9LFxuICBvcmdzOiB7XG4gICAgYWRkU2VjdXJpdHlNYW5hZ2VyVGVhbTogW1xuICAgICAgXCJQVVQgL29yZ3Mve29yZ30vc2VjdXJpdHktbWFuYWdlcnMvdGVhbXMve3RlYW1fc2x1Z31cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5vcmdzLmFkZFNlY3VyaXR5TWFuYWdlclRlYW0oKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9vcmdzL3NlY3VyaXR5LW1hbmFnZXJzI2FkZC1hLXNlY3VyaXR5LW1hbmFnZXItdGVhbVwiXG4gICAgICB9XG4gICAgXSxcbiAgICBhc3NpZ25UZWFtVG9PcmdSb2xlOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9vcmdhbml6YXRpb24tcm9sZXMvdGVhbXMve3RlYW1fc2x1Z30ve3JvbGVfaWR9XCJcbiAgICBdLFxuICAgIGFzc2lnblVzZXJUb09yZ1JvbGU6IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L29yZ2FuaXphdGlvbi1yb2xlcy91c2Vycy97dXNlcm5hbWV9L3tyb2xlX2lkfVwiXG4gICAgXSxcbiAgICBibG9ja1VzZXI6IFtcIlBVVCAvb3Jncy97b3JnfS9ibG9ja3Mve3VzZXJuYW1lfVwiXSxcbiAgICBjYW5jZWxJbnZpdGF0aW9uOiBbXCJERUxFVEUgL29yZ3Mve29yZ30vaW52aXRhdGlvbnMve2ludml0YXRpb25faWR9XCJdLFxuICAgIGNoZWNrQmxvY2tlZFVzZXI6IFtcIkdFVCAvb3Jncy97b3JnfS9ibG9ja3Mve3VzZXJuYW1lfVwiXSxcbiAgICBjaGVja01lbWJlcnNoaXBGb3JVc2VyOiBbXCJHRVQgL29yZ3Mve29yZ30vbWVtYmVycy97dXNlcm5hbWV9XCJdLFxuICAgIGNoZWNrUHVibGljTWVtYmVyc2hpcEZvclVzZXI6IFtcIkdFVCAvb3Jncy97b3JnfS9wdWJsaWNfbWVtYmVycy97dXNlcm5hbWV9XCJdLFxuICAgIGNvbnZlcnRNZW1iZXJUb091dHNpZGVDb2xsYWJvcmF0b3I6IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L291dHNpZGVfY29sbGFib3JhdG9ycy97dXNlcm5hbWV9XCJcbiAgICBdLFxuICAgIGNyZWF0ZUludml0YXRpb246IFtcIlBPU1QgL29yZ3Mve29yZ30vaW52aXRhdGlvbnNcIl0sXG4gICAgY3JlYXRlSXNzdWVUeXBlOiBbXCJQT1NUIC9vcmdzL3tvcmd9L2lzc3VlLXR5cGVzXCJdLFxuICAgIGNyZWF0ZU9yVXBkYXRlQ3VzdG9tUHJvcGVydGllczogW1wiUEFUQ0ggL29yZ3Mve29yZ30vcHJvcGVydGllcy9zY2hlbWFcIl0sXG4gICAgY3JlYXRlT3JVcGRhdGVDdXN0b21Qcm9wZXJ0aWVzVmFsdWVzRm9yUmVwb3M6IFtcbiAgICAgIFwiUEFUQ0ggL29yZ3Mve29yZ30vcHJvcGVydGllcy92YWx1ZXNcIlxuICAgIF0sXG4gICAgY3JlYXRlT3JVcGRhdGVDdXN0b21Qcm9wZXJ0eTogW1xuICAgICAgXCJQVVQgL29yZ3Mve29yZ30vcHJvcGVydGllcy9zY2hlbWEve2N1c3RvbV9wcm9wZXJ0eV9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVXZWJob29rOiBbXCJQT1NUIC9vcmdzL3tvcmd9L2hvb2tzXCJdLFxuICAgIGRlbGV0ZTogW1wiREVMRVRFIC9vcmdzL3tvcmd9XCJdLFxuICAgIGRlbGV0ZUlzc3VlVHlwZTogW1wiREVMRVRFIC9vcmdzL3tvcmd9L2lzc3VlLXR5cGVzL3tpc3N1ZV90eXBlX2lkfVwiXSxcbiAgICBkZWxldGVXZWJob29rOiBbXCJERUxFVEUgL29yZ3Mve29yZ30vaG9va3Mve2hvb2tfaWR9XCJdLFxuICAgIGVuYWJsZU9yRGlzYWJsZVNlY3VyaXR5UHJvZHVjdE9uQWxsT3JnUmVwb3M6IFtcbiAgICAgIFwiUE9TVCAvb3Jncy97b3JnfS97c2VjdXJpdHlfcHJvZHVjdH0ve2VuYWJsZW1lbnR9XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3Qub3Jncy5lbmFibGVPckRpc2FibGVTZWN1cml0eVByb2R1Y3RPbkFsbE9yZ1JlcG9zKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3Qvb3Jncy9vcmdzI2VuYWJsZS1vci1kaXNhYmxlLWEtc2VjdXJpdHktZmVhdHVyZS1mb3ItYW4tb3JnYW5pemF0aW9uXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGdldDogW1wiR0VUIC9vcmdzL3tvcmd9XCJdLFxuICAgIGdldEFsbEN1c3RvbVByb3BlcnRpZXM6IFtcIkdFVCAvb3Jncy97b3JnfS9wcm9wZXJ0aWVzL3NjaGVtYVwiXSxcbiAgICBnZXRDdXN0b21Qcm9wZXJ0eTogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vcHJvcGVydGllcy9zY2hlbWEve2N1c3RvbV9wcm9wZXJ0eV9uYW1lfVwiXG4gICAgXSxcbiAgICBnZXRNZW1iZXJzaGlwRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlci9tZW1iZXJzaGlwcy9vcmdzL3tvcmd9XCJdLFxuICAgIGdldE1lbWJlcnNoaXBGb3JVc2VyOiBbXCJHRVQgL29yZ3Mve29yZ30vbWVtYmVyc2hpcHMve3VzZXJuYW1lfVwiXSxcbiAgICBnZXRPcmdSb2xlOiBbXCJHRVQgL29yZ3Mve29yZ30vb3JnYW5pemF0aW9uLXJvbGVzL3tyb2xlX2lkfVwiXSxcbiAgICBnZXRPcmdSdWxlc2V0SGlzdG9yeTogW1wiR0VUIC9vcmdzL3tvcmd9L3J1bGVzZXRzL3tydWxlc2V0X2lkfS9oaXN0b3J5XCJdLFxuICAgIGdldE9yZ1J1bGVzZXRWZXJzaW9uOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9ydWxlc2V0cy97cnVsZXNldF9pZH0vaGlzdG9yeS97dmVyc2lvbl9pZH1cIlxuICAgIF0sXG4gICAgZ2V0V2ViaG9vazogW1wiR0VUIC9vcmdzL3tvcmd9L2hvb2tzL3tob29rX2lkfVwiXSxcbiAgICBnZXRXZWJob29rQ29uZmlnRm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vaG9va3Mve2hvb2tfaWR9L2NvbmZpZ1wiXSxcbiAgICBnZXRXZWJob29rRGVsaXZlcnk6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L2hvb2tzL3tob29rX2lkfS9kZWxpdmVyaWVzL3tkZWxpdmVyeV9pZH1cIlxuICAgIF0sXG4gICAgbGlzdDogW1wiR0VUIC9vcmdhbml6YXRpb25zXCJdLFxuICAgIGxpc3RBcHBJbnN0YWxsYXRpb25zOiBbXCJHRVQgL29yZ3Mve29yZ30vaW5zdGFsbGF0aW9uc1wiXSxcbiAgICBsaXN0QXR0ZXN0YXRpb25zOiBbXCJHRVQgL29yZ3Mve29yZ30vYXR0ZXN0YXRpb25zL3tzdWJqZWN0X2RpZ2VzdH1cIl0sXG4gICAgbGlzdEJsb2NrZWRVc2VyczogW1wiR0VUIC9vcmdzL3tvcmd9L2Jsb2Nrc1wiXSxcbiAgICBsaXN0Q3VzdG9tUHJvcGVydGllc1ZhbHVlc0ZvclJlcG9zOiBbXCJHRVQgL29yZ3Mve29yZ30vcHJvcGVydGllcy92YWx1ZXNcIl0sXG4gICAgbGlzdEZhaWxlZEludml0YXRpb25zOiBbXCJHRVQgL29yZ3Mve29yZ30vZmFpbGVkX2ludml0YXRpb25zXCJdLFxuICAgIGxpc3RGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL29yZ3NcIl0sXG4gICAgbGlzdEZvclVzZXI6IFtcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9vcmdzXCJdLFxuICAgIGxpc3RJbnZpdGF0aW9uVGVhbXM6IFtcIkdFVCAvb3Jncy97b3JnfS9pbnZpdGF0aW9ucy97aW52aXRhdGlvbl9pZH0vdGVhbXNcIl0sXG4gICAgbGlzdElzc3VlVHlwZXM6IFtcIkdFVCAvb3Jncy97b3JnfS9pc3N1ZS10eXBlc1wiXSxcbiAgICBsaXN0TWVtYmVyczogW1wiR0VUIC9vcmdzL3tvcmd9L21lbWJlcnNcIl0sXG4gICAgbGlzdE1lbWJlcnNoaXBzRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlci9tZW1iZXJzaGlwcy9vcmdzXCJdLFxuICAgIGxpc3RPcmdSb2xlVGVhbXM6IFtcIkdFVCAvb3Jncy97b3JnfS9vcmdhbml6YXRpb24tcm9sZXMve3JvbGVfaWR9L3RlYW1zXCJdLFxuICAgIGxpc3RPcmdSb2xlVXNlcnM6IFtcIkdFVCAvb3Jncy97b3JnfS9vcmdhbml6YXRpb24tcm9sZXMve3JvbGVfaWR9L3VzZXJzXCJdLFxuICAgIGxpc3RPcmdSb2xlczogW1wiR0VUIC9vcmdzL3tvcmd9L29yZ2FuaXphdGlvbi1yb2xlc1wiXSxcbiAgICBsaXN0T3JnYW5pemF0aW9uRmluZUdyYWluZWRQZXJtaXNzaW9uczogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vb3JnYW5pemF0aW9uLWZpbmUtZ3JhaW5lZC1wZXJtaXNzaW9uc1wiXG4gICAgXSxcbiAgICBsaXN0T3V0c2lkZUNvbGxhYm9yYXRvcnM6IFtcIkdFVCAvb3Jncy97b3JnfS9vdXRzaWRlX2NvbGxhYm9yYXRvcnNcIl0sXG4gICAgbGlzdFBhdEdyYW50UmVwb3NpdG9yaWVzOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9wZXJzb25hbC1hY2Nlc3MtdG9rZW5zL3twYXRfaWR9L3JlcG9zaXRvcmllc1wiXG4gICAgXSxcbiAgICBsaXN0UGF0R3JhbnRSZXF1ZXN0UmVwb3NpdG9yaWVzOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9wZXJzb25hbC1hY2Nlc3MtdG9rZW4tcmVxdWVzdHMve3BhdF9yZXF1ZXN0X2lkfS9yZXBvc2l0b3JpZXNcIlxuICAgIF0sXG4gICAgbGlzdFBhdEdyYW50UmVxdWVzdHM6IFtcIkdFVCAvb3Jncy97b3JnfS9wZXJzb25hbC1hY2Nlc3MtdG9rZW4tcmVxdWVzdHNcIl0sXG4gICAgbGlzdFBhdEdyYW50czogW1wiR0VUIC9vcmdzL3tvcmd9L3BlcnNvbmFsLWFjY2Vzcy10b2tlbnNcIl0sXG4gICAgbGlzdFBlbmRpbmdJbnZpdGF0aW9uczogW1wiR0VUIC9vcmdzL3tvcmd9L2ludml0YXRpb25zXCJdLFxuICAgIGxpc3RQdWJsaWNNZW1iZXJzOiBbXCJHRVQgL29yZ3Mve29yZ30vcHVibGljX21lbWJlcnNcIl0sXG4gICAgbGlzdFNlY3VyaXR5TWFuYWdlclRlYW1zOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9zZWN1cml0eS1tYW5hZ2Vyc1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0Lm9yZ3MubGlzdFNlY3VyaXR5TWFuYWdlclRlYW1zKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3Qvb3Jncy9zZWN1cml0eS1tYW5hZ2VycyNsaXN0LXNlY3VyaXR5LW1hbmFnZXItdGVhbXNcIlxuICAgICAgfVxuICAgIF0sXG4gICAgbGlzdFdlYmhvb2tEZWxpdmVyaWVzOiBbXCJHRVQgL29yZ3Mve29yZ30vaG9va3Mve2hvb2tfaWR9L2RlbGl2ZXJpZXNcIl0sXG4gICAgbGlzdFdlYmhvb2tzOiBbXCJHRVQgL29yZ3Mve29yZ30vaG9va3NcIl0sXG4gICAgcGluZ1dlYmhvb2s6IFtcIlBPU1QgL29yZ3Mve29yZ30vaG9va3Mve2hvb2tfaWR9L3BpbmdzXCJdLFxuICAgIHJlZGVsaXZlcldlYmhvb2tEZWxpdmVyeTogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L2hvb2tzL3tob29rX2lkfS9kZWxpdmVyaWVzL3tkZWxpdmVyeV9pZH0vYXR0ZW1wdHNcIlxuICAgIF0sXG4gICAgcmVtb3ZlQ3VzdG9tUHJvcGVydHk6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L3Byb3BlcnRpZXMvc2NoZW1hL3tjdXN0b21fcHJvcGVydHlfbmFtZX1cIlxuICAgIF0sXG4gICAgcmVtb3ZlTWVtYmVyOiBbXCJERUxFVEUgL29yZ3Mve29yZ30vbWVtYmVycy97dXNlcm5hbWV9XCJdLFxuICAgIHJlbW92ZU1lbWJlcnNoaXBGb3JVc2VyOiBbXCJERUxFVEUgL29yZ3Mve29yZ30vbWVtYmVyc2hpcHMve3VzZXJuYW1lfVwiXSxcbiAgICByZW1vdmVPdXRzaWRlQ29sbGFib3JhdG9yOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9vdXRzaWRlX2NvbGxhYm9yYXRvcnMve3VzZXJuYW1lfVwiXG4gICAgXSxcbiAgICByZW1vdmVQdWJsaWNNZW1iZXJzaGlwRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L3B1YmxpY19tZW1iZXJzL3t1c2VybmFtZX1cIlxuICAgIF0sXG4gICAgcmVtb3ZlU2VjdXJpdHlNYW5hZ2VyVGVhbTogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vc2VjdXJpdHktbWFuYWdlcnMvdGVhbXMve3RlYW1fc2x1Z31cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5vcmdzLnJlbW92ZVNlY3VyaXR5TWFuYWdlclRlYW0oKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9vcmdzL3NlY3VyaXR5LW1hbmFnZXJzI3JlbW92ZS1hLXNlY3VyaXR5LW1hbmFnZXItdGVhbVwiXG4gICAgICB9XG4gICAgXSxcbiAgICByZXZpZXdQYXRHcmFudFJlcXVlc3Q6IFtcbiAgICAgIFwiUE9TVCAvb3Jncy97b3JnfS9wZXJzb25hbC1hY2Nlc3MtdG9rZW4tcmVxdWVzdHMve3BhdF9yZXF1ZXN0X2lkfVwiXG4gICAgXSxcbiAgICByZXZpZXdQYXRHcmFudFJlcXVlc3RzSW5CdWxrOiBbXG4gICAgICBcIlBPU1QgL29yZ3Mve29yZ30vcGVyc29uYWwtYWNjZXNzLXRva2VuLXJlcXVlc3RzXCJcbiAgICBdLFxuICAgIHJldm9rZUFsbE9yZ1JvbGVzVGVhbTogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vb3JnYW5pemF0aW9uLXJvbGVzL3RlYW1zL3t0ZWFtX3NsdWd9XCJcbiAgICBdLFxuICAgIHJldm9rZUFsbE9yZ1JvbGVzVXNlcjogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vb3JnYW5pemF0aW9uLXJvbGVzL3VzZXJzL3t1c2VybmFtZX1cIlxuICAgIF0sXG4gICAgcmV2b2tlT3JnUm9sZVRlYW06IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L29yZ2FuaXphdGlvbi1yb2xlcy90ZWFtcy97dGVhbV9zbHVnfS97cm9sZV9pZH1cIlxuICAgIF0sXG4gICAgcmV2b2tlT3JnUm9sZVVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L29yZ2FuaXphdGlvbi1yb2xlcy91c2Vycy97dXNlcm5hbWV9L3tyb2xlX2lkfVwiXG4gICAgXSxcbiAgICBzZXRNZW1iZXJzaGlwRm9yVXNlcjogW1wiUFVUIC9vcmdzL3tvcmd9L21lbWJlcnNoaXBzL3t1c2VybmFtZX1cIl0sXG4gICAgc2V0UHVibGljTWVtYmVyc2hpcEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS9wdWJsaWNfbWVtYmVycy97dXNlcm5hbWV9XCJcbiAgICBdLFxuICAgIHVuYmxvY2tVc2VyOiBbXCJERUxFVEUgL29yZ3Mve29yZ30vYmxvY2tzL3t1c2VybmFtZX1cIl0sXG4gICAgdXBkYXRlOiBbXCJQQVRDSCAvb3Jncy97b3JnfVwiXSxcbiAgICB1cGRhdGVJc3N1ZVR5cGU6IFtcIlBVVCAvb3Jncy97b3JnfS9pc3N1ZS10eXBlcy97aXNzdWVfdHlwZV9pZH1cIl0sXG4gICAgdXBkYXRlTWVtYmVyc2hpcEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBBVENIIC91c2VyL21lbWJlcnNoaXBzL29yZ3Mve29yZ31cIlxuICAgIF0sXG4gICAgdXBkYXRlUGF0QWNjZXNzOiBbXCJQT1NUIC9vcmdzL3tvcmd9L3BlcnNvbmFsLWFjY2Vzcy10b2tlbnMve3BhdF9pZH1cIl0sXG4gICAgdXBkYXRlUGF0QWNjZXNzZXM6IFtcIlBPU1QgL29yZ3Mve29yZ30vcGVyc29uYWwtYWNjZXNzLXRva2Vuc1wiXSxcbiAgICB1cGRhdGVXZWJob29rOiBbXCJQQVRDSCAvb3Jncy97b3JnfS9ob29rcy97aG9va19pZH1cIl0sXG4gICAgdXBkYXRlV2ViaG9va0NvbmZpZ0Zvck9yZzogW1wiUEFUQ0ggL29yZ3Mve29yZ30vaG9va3Mve2hvb2tfaWR9L2NvbmZpZ1wiXVxuICB9LFxuICBwYWNrYWdlczoge1xuICAgIGRlbGV0ZVBhY2thZ2VGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJERUxFVEUgL3VzZXIvcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX1cIlxuICAgIF0sXG4gICAgZGVsZXRlUGFja2FnZUZvck9yZzogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX1cIlxuICAgIF0sXG4gICAgZGVsZXRlUGFja2FnZUZvclVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC91c2Vycy97dXNlcm5hbWV9L3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9XCJcbiAgICBdLFxuICAgIGRlbGV0ZVBhY2thZ2VWZXJzaW9uRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC91c2VyL3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9L3ZlcnNpb25zL3twYWNrYWdlX3ZlcnNpb25faWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZVBhY2thZ2VWZXJzaW9uRm9yT3JnOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9ucy97cGFja2FnZV92ZXJzaW9uX2lkfVwiXG4gICAgXSxcbiAgICBkZWxldGVQYWNrYWdlVmVyc2lvbkZvclVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC91c2Vycy97dXNlcm5hbWV9L3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9L3ZlcnNpb25zL3twYWNrYWdlX3ZlcnNpb25faWR9XCJcbiAgICBdLFxuICAgIGdldEFsbFBhY2thZ2VWZXJzaW9uc0ZvckFQYWNrYWdlT3duZWRCeUFuT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9uc1wiLFxuICAgICAge30sXG4gICAgICB7IHJlbmFtZWQ6IFtcInBhY2thZ2VzXCIsIFwiZ2V0QWxsUGFja2FnZVZlcnNpb25zRm9yUGFja2FnZU93bmVkQnlPcmdcIl0gfVxuICAgIF0sXG4gICAgZ2V0QWxsUGFja2FnZVZlcnNpb25zRm9yQVBhY2thZ2VPd25lZEJ5VGhlQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2VyL3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9L3ZlcnNpb25zXCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgcmVuYW1lZDogW1xuICAgICAgICAgIFwicGFja2FnZXNcIixcbiAgICAgICAgICBcImdldEFsbFBhY2thZ2VWZXJzaW9uc0ZvclBhY2thZ2VPd25lZEJ5QXV0aGVudGljYXRlZFVzZXJcIlxuICAgICAgICBdXG4gICAgICB9XG4gICAgXSxcbiAgICBnZXRBbGxQYWNrYWdlVmVyc2lvbnNGb3JQYWNrYWdlT3duZWRCeUF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlci9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9uc1wiXG4gICAgXSxcbiAgICBnZXRBbGxQYWNrYWdlVmVyc2lvbnNGb3JQYWNrYWdlT3duZWRCeU9yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vdmVyc2lvbnNcIlxuICAgIF0sXG4gICAgZ2V0QWxsUGFja2FnZVZlcnNpb25zRm9yUGFja2FnZU93bmVkQnlVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9uc1wiXG4gICAgXSxcbiAgICBnZXRQYWNrYWdlRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2VyL3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9XCJcbiAgICBdLFxuICAgIGdldFBhY2thZ2VGb3JPcmdhbml6YXRpb246IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9XCJcbiAgICBdLFxuICAgIGdldFBhY2thZ2VGb3JVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfVwiXG4gICAgXSxcbiAgICBnZXRQYWNrYWdlVmVyc2lvbkZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlci9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9ucy97cGFja2FnZV92ZXJzaW9uX2lkfVwiXG4gICAgXSxcbiAgICBnZXRQYWNrYWdlVmVyc2lvbkZvck9yZ2FuaXphdGlvbjogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vdmVyc2lvbnMve3BhY2thZ2VfdmVyc2lvbl9pZH1cIlxuICAgIF0sXG4gICAgZ2V0UGFja2FnZVZlcnNpb25Gb3JVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9wYWNrYWdlcy97cGFja2FnZV90eXBlfS97cGFja2FnZV9uYW1lfS92ZXJzaW9ucy97cGFja2FnZV92ZXJzaW9uX2lkfVwiXG4gICAgXSxcbiAgICBsaXN0RG9ja2VyTWlncmF0aW9uQ29uZmxpY3RpbmdQYWNrYWdlc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlci9kb2NrZXIvY29uZmxpY3RzXCJcbiAgICBdLFxuICAgIGxpc3REb2NrZXJNaWdyYXRpb25Db25mbGljdGluZ1BhY2thZ2VzRm9yT3JnYW5pemF0aW9uOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS9kb2NrZXIvY29uZmxpY3RzXCJcbiAgICBdLFxuICAgIGxpc3REb2NrZXJNaWdyYXRpb25Db25mbGljdGluZ1BhY2thZ2VzRm9yVXNlcjogW1xuICAgICAgXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vZG9ja2VyL2NvbmZsaWN0c1wiXG4gICAgXSxcbiAgICBsaXN0UGFja2FnZXNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL3BhY2thZ2VzXCJdLFxuICAgIGxpc3RQYWNrYWdlc0Zvck9yZ2FuaXphdGlvbjogW1wiR0VUIC9vcmdzL3tvcmd9L3BhY2thZ2VzXCJdLFxuICAgIGxpc3RQYWNrYWdlc0ZvclVzZXI6IFtcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9wYWNrYWdlc1wiXSxcbiAgICByZXN0b3JlUGFja2FnZUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBPU1QgL3VzZXIvcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vcmVzdG9yZXs/dG9rZW59XCJcbiAgICBdLFxuICAgIHJlc3RvcmVQYWNrYWdlRm9yT3JnOiBbXG4gICAgICBcIlBPU1QgL29yZ3Mve29yZ30vcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vcmVzdG9yZXs/dG9rZW59XCJcbiAgICBdLFxuICAgIHJlc3RvcmVQYWNrYWdlRm9yVXNlcjogW1xuICAgICAgXCJQT1NUIC91c2Vycy97dXNlcm5hbWV9L3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9L3Jlc3RvcmV7P3Rva2VufVwiXG4gICAgXSxcbiAgICByZXN0b3JlUGFja2FnZVZlcnNpb25Gb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJQT1NUIC91c2VyL3BhY2thZ2VzL3twYWNrYWdlX3R5cGV9L3twYWNrYWdlX25hbWV9L3ZlcnNpb25zL3twYWNrYWdlX3ZlcnNpb25faWR9L3Jlc3RvcmVcIlxuICAgIF0sXG4gICAgcmVzdG9yZVBhY2thZ2VWZXJzaW9uRm9yT3JnOiBbXG4gICAgICBcIlBPU1QgL29yZ3Mve29yZ30vcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vdmVyc2lvbnMve3BhY2thZ2VfdmVyc2lvbl9pZH0vcmVzdG9yZVwiXG4gICAgXSxcbiAgICByZXN0b3JlUGFja2FnZVZlcnNpb25Gb3JVc2VyOiBbXG4gICAgICBcIlBPU1QgL3VzZXJzL3t1c2VybmFtZX0vcGFja2FnZXMve3BhY2thZ2VfdHlwZX0ve3BhY2thZ2VfbmFtZX0vdmVyc2lvbnMve3BhY2thZ2VfdmVyc2lvbl9pZH0vcmVzdG9yZVwiXG4gICAgXVxuICB9LFxuICBwcml2YXRlUmVnaXN0cmllczoge1xuICAgIGNyZWF0ZU9yZ1ByaXZhdGVSZWdpc3RyeTogW1wiUE9TVCAvb3Jncy97b3JnfS9wcml2YXRlLXJlZ2lzdHJpZXNcIl0sXG4gICAgZGVsZXRlT3JnUHJpdmF0ZVJlZ2lzdHJ5OiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS9wcml2YXRlLXJlZ2lzdHJpZXMve3NlY3JldF9uYW1lfVwiXG4gICAgXSxcbiAgICBnZXRPcmdQcml2YXRlUmVnaXN0cnk6IFtcIkdFVCAvb3Jncy97b3JnfS9wcml2YXRlLXJlZ2lzdHJpZXMve3NlY3JldF9uYW1lfVwiXSxcbiAgICBnZXRPcmdQdWJsaWNLZXk6IFtcIkdFVCAvb3Jncy97b3JnfS9wcml2YXRlLXJlZ2lzdHJpZXMvcHVibGljLWtleVwiXSxcbiAgICBsaXN0T3JnUHJpdmF0ZVJlZ2lzdHJpZXM6IFtcIkdFVCAvb3Jncy97b3JnfS9wcml2YXRlLXJlZ2lzdHJpZXNcIl0sXG4gICAgdXBkYXRlT3JnUHJpdmF0ZVJlZ2lzdHJ5OiBbXG4gICAgICBcIlBBVENIIC9vcmdzL3tvcmd9L3ByaXZhdGUtcmVnaXN0cmllcy97c2VjcmV0X25hbWV9XCJcbiAgICBdXG4gIH0sXG4gIHByb2plY3RzOiB7XG4gICAgYWRkQ29sbGFib3JhdG9yOiBbXG4gICAgICBcIlBVVCAvcHJvamVjdHMve3Byb2plY3RfaWR9L2NvbGxhYm9yYXRvcnMve3VzZXJuYW1lfVwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmFkZENvbGxhYm9yYXRvcigpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3Byb2plY3RzL2NvbGxhYm9yYXRvcnMjYWRkLXByb2plY3QtY29sbGFib3JhdG9yXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGNyZWF0ZUNhcmQ6IFtcbiAgICAgIFwiUE9TVCAvcHJvamVjdHMvY29sdW1ucy97Y29sdW1uX2lkfS9jYXJkc1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmNyZWF0ZUNhcmQoKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9jYXJkcyNjcmVhdGUtYS1wcm9qZWN0LWNhcmRcIlxuICAgICAgfVxuICAgIF0sXG4gICAgY3JlYXRlQ29sdW1uOiBbXG4gICAgICBcIlBPU1QgL3Byb2plY3RzL3twcm9qZWN0X2lkfS9jb2x1bW5zXCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMuY3JlYXRlQ29sdW1uKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvY29sdW1ucyNjcmVhdGUtYS1wcm9qZWN0LWNvbHVtblwiXG4gICAgICB9XG4gICAgXSxcbiAgICBjcmVhdGVGb3JBdXRoZW50aWNhdGVkVXNlcjogW1xuICAgICAgXCJQT1NUIC91c2VyL3Byb2plY3RzXCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMuY3JlYXRlRm9yQXV0aGVudGljYXRlZFVzZXIoKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9wcm9qZWN0cyNjcmVhdGUtYS11c2VyLXByb2plY3RcIlxuICAgICAgfVxuICAgIF0sXG4gICAgY3JlYXRlRm9yT3JnOiBbXG4gICAgICBcIlBPU1QgL29yZ3Mve29yZ30vcHJvamVjdHNcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy5jcmVhdGVGb3JPcmcoKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9wcm9qZWN0cyNjcmVhdGUtYW4tb3JnYW5pemF0aW9uLXByb2plY3RcIlxuICAgICAgfVxuICAgIF0sXG4gICAgY3JlYXRlRm9yUmVwbzogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wcm9qZWN0c1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmNyZWF0ZUZvclJlcG8oKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9wcm9qZWN0cyNjcmVhdGUtYS1yZXBvc2l0b3J5LXByb2plY3RcIlxuICAgICAgfVxuICAgIF0sXG4gICAgZGVsZXRlOiBbXG4gICAgICBcIkRFTEVURSAvcHJvamVjdHMve3Byb2plY3RfaWR9XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMuZGVsZXRlKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvcHJvamVjdHMjZGVsZXRlLWEtcHJvamVjdFwiXG4gICAgICB9XG4gICAgXSxcbiAgICBkZWxldGVDYXJkOiBbXG4gICAgICBcIkRFTEVURSAvcHJvamVjdHMvY29sdW1ucy9jYXJkcy97Y2FyZF9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy5kZWxldGVDYXJkKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvY2FyZHMjZGVsZXRlLWEtcHJvamVjdC1jYXJkXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGRlbGV0ZUNvbHVtbjogW1xuICAgICAgXCJERUxFVEUgL3Byb2plY3RzL2NvbHVtbnMve2NvbHVtbl9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy5kZWxldGVDb2x1bW4oKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9jb2x1bW5zI2RlbGV0ZS1hLXByb2plY3QtY29sdW1uXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGdldDogW1xuICAgICAgXCJHRVQgL3Byb2plY3RzL3twcm9qZWN0X2lkfVwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmdldCgpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3Byb2plY3RzL3Byb2plY3RzI2dldC1hLXByb2plY3RcIlxuICAgICAgfVxuICAgIF0sXG4gICAgZ2V0Q2FyZDogW1xuICAgICAgXCJHRVQgL3Byb2plY3RzL2NvbHVtbnMvY2FyZHMve2NhcmRfaWR9XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMuZ2V0Q2FyZCgpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3Byb2plY3RzL2NhcmRzI2dldC1hLXByb2plY3QtY2FyZFwiXG4gICAgICB9XG4gICAgXSxcbiAgICBnZXRDb2x1bW46IFtcbiAgICAgIFwiR0VUIC9wcm9qZWN0cy9jb2x1bW5zL3tjb2x1bW5faWR9XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMuZ2V0Q29sdW1uKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvY29sdW1ucyNnZXQtYS1wcm9qZWN0LWNvbHVtblwiXG4gICAgICB9XG4gICAgXSxcbiAgICBnZXRQZXJtaXNzaW9uRm9yVXNlcjogW1xuICAgICAgXCJHRVQgL3Byb2plY3RzL3twcm9qZWN0X2lkfS9jb2xsYWJvcmF0b3JzL3t1c2VybmFtZX0vcGVybWlzc2lvblwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmdldFBlcm1pc3Npb25Gb3JVc2VyKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvY29sbGFib3JhdG9ycyNnZXQtcHJvamVjdC1wZXJtaXNzaW9uLWZvci1hLXVzZXJcIlxuICAgICAgfVxuICAgIF0sXG4gICAgbGlzdENhcmRzOiBbXG4gICAgICBcIkdFVCAvcHJvamVjdHMvY29sdW1ucy97Y29sdW1uX2lkfS9jYXJkc1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmxpc3RDYXJkcygpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3Byb2plY3RzL2NhcmRzI2xpc3QtcHJvamVjdC1jYXJkc1wiXG4gICAgICB9XG4gICAgXSxcbiAgICBsaXN0Q29sbGFib3JhdG9yczogW1xuICAgICAgXCJHRVQgL3Byb2plY3RzL3twcm9qZWN0X2lkfS9jb2xsYWJvcmF0b3JzXCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMubGlzdENvbGxhYm9yYXRvcnMoKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9jb2xsYWJvcmF0b3JzI2xpc3QtcHJvamVjdC1jb2xsYWJvcmF0b3JzXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGxpc3RDb2x1bW5zOiBbXG4gICAgICBcIkdFVCAvcHJvamVjdHMve3Byb2plY3RfaWR9L2NvbHVtbnNcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy5saXN0Q29sdW1ucygpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3Byb2plY3RzL2NvbHVtbnMjbGlzdC1wcm9qZWN0LWNvbHVtbnNcIlxuICAgICAgfVxuICAgIF0sXG4gICAgbGlzdEZvck9yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vcHJvamVjdHNcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy5saXN0Rm9yT3JnKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvcHJvamVjdHMjbGlzdC1vcmdhbml6YXRpb24tcHJvamVjdHNcIlxuICAgICAgfVxuICAgIF0sXG4gICAgbGlzdEZvclJlcG86IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wcm9qZWN0c1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmxpc3RGb3JSZXBvKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvcHJvamVjdHMjbGlzdC1yZXBvc2l0b3J5LXByb2plY3RzXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGxpc3RGb3JVc2VyOiBbXG4gICAgICBcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9wcm9qZWN0c1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLmxpc3RGb3JVc2VyKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvcHJvamVjdHMjbGlzdC11c2VyLXByb2plY3RzXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIG1vdmVDYXJkOiBbXG4gICAgICBcIlBPU1QgL3Byb2plY3RzL2NvbHVtbnMvY2FyZHMve2NhcmRfaWR9L21vdmVzXCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMubW92ZUNhcmQoKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9jYXJkcyNtb3ZlLWEtcHJvamVjdC1jYXJkXCJcbiAgICAgIH1cbiAgICBdLFxuICAgIG1vdmVDb2x1bW46IFtcbiAgICAgIFwiUE9TVCAvcHJvamVjdHMvY29sdW1ucy97Y29sdW1uX2lkfS9tb3Zlc1wiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLm1vdmVDb2x1bW4oKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9jb2x1bW5zI21vdmUtYS1wcm9qZWN0LWNvbHVtblwiXG4gICAgICB9XG4gICAgXSxcbiAgICByZW1vdmVDb2xsYWJvcmF0b3I6IFtcbiAgICAgIFwiREVMRVRFIC9wcm9qZWN0cy97cHJvamVjdF9pZH0vY29sbGFib3JhdG9ycy97dXNlcm5hbWV9XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3QucHJvamVjdHMucmVtb3ZlQ29sbGFib3JhdG9yKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvY29sbGFib3JhdG9ycyNyZW1vdmUtdXNlci1hcy1hLWNvbGxhYm9yYXRvclwiXG4gICAgICB9XG4gICAgXSxcbiAgICB1cGRhdGU6IFtcbiAgICAgIFwiUEFUQ0ggL3Byb2plY3RzL3twcm9qZWN0X2lkfVwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnByb2plY3RzLnVwZGF0ZSgpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3Byb2plY3RzL3Byb2plY3RzI3VwZGF0ZS1hLXByb2plY3RcIlxuICAgICAgfVxuICAgIF0sXG4gICAgdXBkYXRlQ2FyZDogW1xuICAgICAgXCJQQVRDSCAvcHJvamVjdHMvY29sdW1ucy9jYXJkcy97Y2FyZF9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy51cGRhdGVDYXJkKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvcHJvamVjdHMvY2FyZHMjdXBkYXRlLWFuLWV4aXN0aW5nLXByb2plY3QtY2FyZFwiXG4gICAgICB9XG4gICAgXSxcbiAgICB1cGRhdGVDb2x1bW46IFtcbiAgICAgIFwiUEFUQ0ggL3Byb2plY3RzL2NvbHVtbnMve2NvbHVtbl9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC5wcm9qZWN0cy51cGRhdGVDb2x1bW4oKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC9wcm9qZWN0cy9jb2x1bW5zI3VwZGF0ZS1hbi1leGlzdGluZy1wcm9qZWN0LWNvbHVtblwiXG4gICAgICB9XG4gICAgXVxuICB9LFxuICBwdWxsczoge1xuICAgIGNoZWNrSWZNZXJnZWQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9tZXJnZVwiXSxcbiAgICBjcmVhdGU6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzXCJdLFxuICAgIGNyZWF0ZVJlcGx5Rm9yUmV2aWV3Q29tbWVudDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L2NvbW1lbnRzL3tjb21tZW50X2lkfS9yZXBsaWVzXCJcbiAgICBdLFxuICAgIGNyZWF0ZVJldmlldzogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9yZXZpZXdzXCJdLFxuICAgIGNyZWF0ZVJldmlld0NvbW1lbnQ6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9jb21tZW50c1wiXG4gICAgXSxcbiAgICBkZWxldGVQZW5kaW5nUmV2aWV3OiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9yZXZpZXdzL3tyZXZpZXdfaWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZVJldmlld0NvbW1lbnQ6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy9jb21tZW50cy97Y29tbWVudF9pZH1cIlxuICAgIF0sXG4gICAgZGlzbWlzc1JldmlldzogW1xuICAgICAgXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vcmV2aWV3cy97cmV2aWV3X2lkfS9kaXNtaXNzYWxzXCJcbiAgICBdLFxuICAgIGdldDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9XCJdLFxuICAgIGdldFJldmlldzogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vcmV2aWV3cy97cmV2aWV3X2lkfVwiXG4gICAgXSxcbiAgICBnZXRSZXZpZXdDb21tZW50OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL2NvbW1lbnRzL3tjb21tZW50X2lkfVwiXSxcbiAgICBsaXN0OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzXCJdLFxuICAgIGxpc3RDb21tZW50c0ZvclJldmlldzogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vcmV2aWV3cy97cmV2aWV3X2lkfS9jb21tZW50c1wiXG4gICAgXSxcbiAgICBsaXN0Q29tbWl0czogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L2NvbW1pdHNcIl0sXG4gICAgbGlzdEZpbGVzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vZmlsZXNcIl0sXG4gICAgbGlzdFJlcXVlc3RlZFJldmlld2VyczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vcmVxdWVzdGVkX3Jldmlld2Vyc1wiXG4gICAgXSxcbiAgICBsaXN0UmV2aWV3Q29tbWVudHM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L2NvbW1lbnRzXCJcbiAgICBdLFxuICAgIGxpc3RSZXZpZXdDb21tZW50c0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMvY29tbWVudHNcIl0sXG4gICAgbGlzdFJldmlld3M6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9yZXZpZXdzXCJdLFxuICAgIG1lcmdlOiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vbWVyZ2VcIl0sXG4gICAgcmVtb3ZlUmVxdWVzdGVkUmV2aWV3ZXJzOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9yZXF1ZXN0ZWRfcmV2aWV3ZXJzXCJcbiAgICBdLFxuICAgIHJlcXVlc3RSZXZpZXdlcnM6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS9yZXF1ZXN0ZWRfcmV2aWV3ZXJzXCJcbiAgICBdLFxuICAgIHN1Ym1pdFJldmlldzogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy97cHVsbF9udW1iZXJ9L3Jldmlld3Mve3Jldmlld19pZH0vZXZlbnRzXCJcbiAgICBdLFxuICAgIHVwZGF0ZTogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn1cIl0sXG4gICAgdXBkYXRlQnJhbmNoOiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMve3B1bGxfbnVtYmVyfS91cGRhdGUtYnJhbmNoXCJcbiAgICBdLFxuICAgIHVwZGF0ZVJldmlldzogW1xuICAgICAgXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3B1bGxzL3twdWxsX251bWJlcn0vcmV2aWV3cy97cmV2aWV3X2lkfVwiXG4gICAgXSxcbiAgICB1cGRhdGVSZXZpZXdDb21tZW50OiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wdWxscy9jb21tZW50cy97Y29tbWVudF9pZH1cIlxuICAgIF1cbiAgfSxcbiAgcmF0ZUxpbWl0OiB7IGdldDogW1wiR0VUIC9yYXRlX2xpbWl0XCJdIH0sXG4gIHJlYWN0aW9uczoge1xuICAgIGNyZWF0ZUZvckNvbW1pdENvbW1lbnQ6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiXG4gICAgXSxcbiAgICBjcmVhdGVGb3JJc3N1ZTogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vcmVhY3Rpb25zXCJcbiAgICBdLFxuICAgIGNyZWF0ZUZvcklzc3VlQ29tbWVudDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMvY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiXG4gICAgXSxcbiAgICBjcmVhdGVGb3JQdWxsUmVxdWVzdFJldmlld0NvbW1lbnQ6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMvY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiXG4gICAgXSxcbiAgICBjcmVhdGVGb3JSZWxlYXNlOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL3tyZWxlYXNlX2lkfS9yZWFjdGlvbnNcIlxuICAgIF0sXG4gICAgY3JlYXRlRm9yVGVhbURpc2N1c3Npb25Db21tZW50SW5Pcmc6IFtcbiAgICAgIFwiUE9TVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L2NvbW1lbnRzL3tjb21tZW50X251bWJlcn0vcmVhY3Rpb25zXCJcbiAgICBdLFxuICAgIGNyZWF0ZUZvclRlYW1EaXNjdXNzaW9uSW5Pcmc6IFtcbiAgICAgIFwiUE9TVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L3JlYWN0aW9uc1wiXG4gICAgXSxcbiAgICBkZWxldGVGb3JDb21taXRDb21tZW50OiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9ucy97cmVhY3Rpb25faWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZUZvcklzc3VlOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vaXNzdWVzL3tpc3N1ZV9udW1iZXJ9L3JlYWN0aW9ucy97cmVhY3Rpb25faWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZUZvcklzc3VlQ29tbWVudDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2lzc3Vlcy9jb21tZW50cy97Y29tbWVudF9pZH0vcmVhY3Rpb25zL3tyZWFjdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlRm9yUHVsbFJlcXVlc3RDb21tZW50OiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMvY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9ucy97cmVhY3Rpb25faWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZUZvclJlbGVhc2U6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9yZWxlYXNlcy97cmVsZWFzZV9pZH0vcmVhY3Rpb25zL3tyZWFjdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlRm9yVGVhbURpc2N1c3Npb246IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn0vcmVhY3Rpb25zL3tyZWFjdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlRm9yVGVhbURpc2N1c3Npb25Db21tZW50OiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L2NvbW1lbnRzL3tjb21tZW50X251bWJlcn0vcmVhY3Rpb25zL3tyZWFjdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgbGlzdEZvckNvbW1pdENvbW1lbnQ6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21tZW50cy97Y29tbWVudF9pZH0vcmVhY3Rpb25zXCJcbiAgICBdLFxuICAgIGxpc3RGb3JJc3N1ZTogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMve2lzc3VlX251bWJlcn0vcmVhY3Rpb25zXCJdLFxuICAgIGxpc3RGb3JJc3N1ZUNvbW1lbnQ6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pc3N1ZXMvY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiXG4gICAgXSxcbiAgICBsaXN0Rm9yUHVsbFJlcXVlc3RSZXZpZXdDb21tZW50OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHVsbHMvY29tbWVudHMve2NvbW1lbnRfaWR9L3JlYWN0aW9uc1wiXG4gICAgXSxcbiAgICBsaXN0Rm9yUmVsZWFzZTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL3tyZWxlYXNlX2lkfS9yZWFjdGlvbnNcIlxuICAgIF0sXG4gICAgbGlzdEZvclRlYW1EaXNjdXNzaW9uQ29tbWVudEluT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L2NvbW1lbnRzL3tjb21tZW50X251bWJlcn0vcmVhY3Rpb25zXCJcbiAgICBdLFxuICAgIGxpc3RGb3JUZWFtRGlzY3Vzc2lvbkluT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L3JlYWN0aW9uc1wiXG4gICAgXVxuICB9LFxuICByZXBvczoge1xuICAgIGFjY2VwdEludml0YXRpb246IFtcbiAgICAgIFwiUEFUQ0ggL3VzZXIvcmVwb3NpdG9yeV9pbnZpdGF0aW9ucy97aW52aXRhdGlvbl9pZH1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJyZXBvc1wiLCBcImFjY2VwdEludml0YXRpb25Gb3JBdXRoZW50aWNhdGVkVXNlclwiXSB9XG4gICAgXSxcbiAgICBhY2NlcHRJbnZpdGF0aW9uRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiUEFUQ0ggL3VzZXIvcmVwb3NpdG9yeV9pbnZpdGF0aW9ucy97aW52aXRhdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgYWRkQXBwQWNjZXNzUmVzdHJpY3Rpb25zOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVzdHJpY3Rpb25zL2FwcHNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwiYXBwc1wiIH1cbiAgICBdLFxuICAgIGFkZENvbGxhYm9yYXRvcjogW1wiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2xsYWJvcmF0b3JzL3t1c2VybmFtZX1cIl0sXG4gICAgYWRkU3RhdHVzQ2hlY2tDb250ZXh0czogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3N0YXR1c19jaGVja3MvY29udGV4dHNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwiY29udGV4dHNcIiB9XG4gICAgXSxcbiAgICBhZGRUZWFtQWNjZXNzUmVzdHJpY3Rpb25zOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVzdHJpY3Rpb25zL3RlYW1zXCIsXG4gICAgICB7fSxcbiAgICAgIHsgbWFwVG9EYXRhOiBcInRlYW1zXCIgfVxuICAgIF0sXG4gICAgYWRkVXNlckFjY2Vzc1Jlc3RyaWN0aW9uczogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3Jlc3RyaWN0aW9ucy91c2Vyc1wiLFxuICAgICAge30sXG4gICAgICB7IG1hcFRvRGF0YTogXCJ1c2Vyc1wiIH1cbiAgICBdLFxuICAgIGNhbmNlbFBhZ2VzRGVwbG95bWVudDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wYWdlcy9kZXBsb3ltZW50cy97cGFnZXNfZGVwbG95bWVudF9pZH0vY2FuY2VsXCJcbiAgICBdLFxuICAgIGNoZWNrQXV0b21hdGVkU2VjdXJpdHlGaXhlczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2F1dG9tYXRlZC1zZWN1cml0eS1maXhlc1wiXG4gICAgXSxcbiAgICBjaGVja0NvbGxhYm9yYXRvcjogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2xsYWJvcmF0b3JzL3t1c2VybmFtZX1cIl0sXG4gICAgY2hlY2tQcml2YXRlVnVsbmVyYWJpbGl0eVJlcG9ydGluZzogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3ByaXZhdGUtdnVsbmVyYWJpbGl0eS1yZXBvcnRpbmdcIlxuICAgIF0sXG4gICAgY2hlY2tWdWxuZXJhYmlsaXR5QWxlcnRzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdnVsbmVyYWJpbGl0eS1hbGVydHNcIlxuICAgIF0sXG4gICAgY29kZW93bmVyc0Vycm9yczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2Rlb3duZXJzL2Vycm9yc1wiXSxcbiAgICBjb21wYXJlQ29tbWl0czogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21wYXJlL3tiYXNlfS4uLntoZWFkfVwiXSxcbiAgICBjb21wYXJlQ29tbWl0c1dpdGhCYXNlaGVhZDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbXBhcmUve2Jhc2VoZWFkfVwiXG4gICAgXSxcbiAgICBjcmVhdGVBdHRlc3RhdGlvbjogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vYXR0ZXN0YXRpb25zXCJdLFxuICAgIGNyZWF0ZUF1dG9saW5rOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9hdXRvbGlua3NcIl0sXG4gICAgY3JlYXRlQ29tbWl0Q29tbWVudDogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21taXRzL3tjb21taXRfc2hhfS9jb21tZW50c1wiXG4gICAgXSxcbiAgICBjcmVhdGVDb21taXRTaWduYXR1cmVQcm90ZWN0aW9uOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVxdWlyZWRfc2lnbmF0dXJlc1wiXG4gICAgXSxcbiAgICBjcmVhdGVDb21taXRTdGF0dXM6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N0YXR1c2VzL3tzaGF9XCJdLFxuICAgIGNyZWF0ZURlcGxveUtleTogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30va2V5c1wiXSxcbiAgICBjcmVhdGVEZXBsb3ltZW50OiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBsb3ltZW50c1wiXSxcbiAgICBjcmVhdGVEZXBsb3ltZW50QnJhbmNoUG9saWN5OiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudC1icmFuY2gtcG9saWNpZXNcIlxuICAgIF0sXG4gICAgY3JlYXRlRGVwbG95bWVudFByb3RlY3Rpb25SdWxlOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudF9wcm90ZWN0aW9uX3J1bGVzXCJcbiAgICBdLFxuICAgIGNyZWF0ZURlcGxveW1lbnRTdGF0dXM6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwbG95bWVudHMve2RlcGxveW1lbnRfaWR9L3N0YXR1c2VzXCJcbiAgICBdLFxuICAgIGNyZWF0ZURpc3BhdGNoRXZlbnQ6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Rpc3BhdGNoZXNcIl0sXG4gICAgY3JlYXRlRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIlBPU1QgL3VzZXIvcmVwb3NcIl0sXG4gICAgY3JlYXRlRm9yazogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vZm9ya3NcIl0sXG4gICAgY3JlYXRlSW5Pcmc6IFtcIlBPU1QgL29yZ3Mve29yZ30vcmVwb3NcIl0sXG4gICAgY3JlYXRlT3JVcGRhdGVDdXN0b21Qcm9wZXJ0aWVzVmFsdWVzOiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wcm9wZXJ0aWVzL3ZhbHVlc1wiXG4gICAgXSxcbiAgICBjcmVhdGVPclVwZGF0ZUVudmlyb25tZW50OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfVwiXG4gICAgXSxcbiAgICBjcmVhdGVPclVwZGF0ZUZpbGVDb250ZW50czogW1wiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb250ZW50cy97cGF0aH1cIl0sXG4gICAgY3JlYXRlT3JnUnVsZXNldDogW1wiUE9TVCAvb3Jncy97b3JnfS9ydWxlc2V0c1wiXSxcbiAgICBjcmVhdGVQYWdlc0RlcGxveW1lbnQ6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L3BhZ2VzL2RlcGxveW1lbnRzXCJdLFxuICAgIGNyZWF0ZVBhZ2VzU2l0ZTogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcGFnZXNcIl0sXG4gICAgY3JlYXRlUmVsZWFzZTogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXNcIl0sXG4gICAgY3JlYXRlUmVwb1J1bGVzZXQ6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L3J1bGVzZXRzXCJdLFxuICAgIGNyZWF0ZVVzaW5nVGVtcGxhdGU6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve3RlbXBsYXRlX293bmVyfS97dGVtcGxhdGVfcmVwb30vZ2VuZXJhdGVcIlxuICAgIF0sXG4gICAgY3JlYXRlV2ViaG9vazogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vaG9va3NcIl0sXG4gICAgZGVjbGluZUludml0YXRpb246IFtcbiAgICAgIFwiREVMRVRFIC91c2VyL3JlcG9zaXRvcnlfaW52aXRhdGlvbnMve2ludml0YXRpb25faWR9XCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1wicmVwb3NcIiwgXCJkZWNsaW5lSW52aXRhdGlvbkZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGRlY2xpbmVJbnZpdGF0aW9uRm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiREVMRVRFIC91c2VyL3JlcG9zaXRvcnlfaW52aXRhdGlvbnMve2ludml0YXRpb25faWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZTogW1wiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfVwiXSxcbiAgICBkZWxldGVBY2Nlc3NSZXN0cmljdGlvbnM6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3Jlc3RyaWN0aW9uc1wiXG4gICAgXSxcbiAgICBkZWxldGVBZG1pbkJyYW5jaFByb3RlY3Rpb246IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL2VuZm9yY2VfYWRtaW5zXCJcbiAgICBdLFxuICAgIGRlbGV0ZUFuRW52aXJvbm1lbnQ6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHMve2Vudmlyb25tZW50X25hbWV9XCJcbiAgICBdLFxuICAgIGRlbGV0ZUF1dG9saW5rOiBbXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2F1dG9saW5rcy97YXV0b2xpbmtfaWR9XCJdLFxuICAgIGRlbGV0ZUJyYW5jaFByb3RlY3Rpb246IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uXCJcbiAgICBdLFxuICAgIGRlbGV0ZUNvbW1pdENvbW1lbnQ6IFtcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWVudHMve2NvbW1lbnRfaWR9XCJdLFxuICAgIGRlbGV0ZUNvbW1pdFNpZ25hdHVyZVByb3RlY3Rpb246IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3NpZ25hdHVyZXNcIlxuICAgIF0sXG4gICAgZGVsZXRlRGVwbG95S2V5OiBbXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2tleXMve2tleV9pZH1cIl0sXG4gICAgZGVsZXRlRGVwbG95bWVudDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2RlcGxveW1lbnRzL3tkZXBsb3ltZW50X2lkfVwiXG4gICAgXSxcbiAgICBkZWxldGVEZXBsb3ltZW50QnJhbmNoUG9saWN5OiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS9kZXBsb3ltZW50LWJyYW5jaC1wb2xpY2llcy97YnJhbmNoX3BvbGljeV9pZH1cIlxuICAgIF0sXG4gICAgZGVsZXRlRmlsZTogW1wiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb250ZW50cy97cGF0aH1cIl0sXG4gICAgZGVsZXRlSW52aXRhdGlvbjogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2ludml0YXRpb25zL3tpbnZpdGF0aW9uX2lkfVwiXG4gICAgXSxcbiAgICBkZWxldGVPcmdSdWxlc2V0OiBbXCJERUxFVEUgL29yZ3Mve29yZ30vcnVsZXNldHMve3J1bGVzZXRfaWR9XCJdLFxuICAgIGRlbGV0ZVBhZ2VzU2l0ZTogW1wiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wYWdlc1wiXSxcbiAgICBkZWxldGVQdWxsUmVxdWVzdFJldmlld1Byb3RlY3Rpb246IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3B1bGxfcmVxdWVzdF9yZXZpZXdzXCJcbiAgICBdLFxuICAgIGRlbGV0ZVJlbGVhc2U6IFtcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXMve3JlbGVhc2VfaWR9XCJdLFxuICAgIGRlbGV0ZVJlbGVhc2VBc3NldDogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL2Fzc2V0cy97YXNzZXRfaWR9XCJcbiAgICBdLFxuICAgIGRlbGV0ZVJlcG9SdWxlc2V0OiBbXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L3J1bGVzZXRzL3tydWxlc2V0X2lkfVwiXSxcbiAgICBkZWxldGVXZWJob29rOiBbXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzL3tob29rX2lkfVwiXSxcbiAgICBkaXNhYmxlQXV0b21hdGVkU2VjdXJpdHlGaXhlczogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2F1dG9tYXRlZC1zZWN1cml0eS1maXhlc1wiXG4gICAgXSxcbiAgICBkaXNhYmxlRGVwbG95bWVudFByb3RlY3Rpb25SdWxlOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS9kZXBsb3ltZW50X3Byb3RlY3Rpb25fcnVsZXMve3Byb3RlY3Rpb25fcnVsZV9pZH1cIlxuICAgIF0sXG4gICAgZGlzYWJsZVByaXZhdGVWdWxuZXJhYmlsaXR5UmVwb3J0aW5nOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vcHJpdmF0ZS12dWxuZXJhYmlsaXR5LXJlcG9ydGluZ1wiXG4gICAgXSxcbiAgICBkaXNhYmxlVnVsbmVyYWJpbGl0eUFsZXJ0czogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L3Z1bG5lcmFiaWxpdHktYWxlcnRzXCJcbiAgICBdLFxuICAgIGRvd25sb2FkQXJjaGl2ZTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3ppcGJhbGwve3JlZn1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJyZXBvc1wiLCBcImRvd25sb2FkWmlwYmFsbEFyY2hpdmVcIl0gfVxuICAgIF0sXG4gICAgZG93bmxvYWRUYXJiYWxsQXJjaGl2ZTogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS90YXJiYWxsL3tyZWZ9XCJdLFxuICAgIGRvd25sb2FkWmlwYmFsbEFyY2hpdmU6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vemlwYmFsbC97cmVmfVwiXSxcbiAgICBlbmFibGVBdXRvbWF0ZWRTZWN1cml0eUZpeGVzOiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYXV0b21hdGVkLXNlY3VyaXR5LWZpeGVzXCJcbiAgICBdLFxuICAgIGVuYWJsZVByaXZhdGVWdWxuZXJhYmlsaXR5UmVwb3J0aW5nOiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHJpdmF0ZS12dWxuZXJhYmlsaXR5LXJlcG9ydGluZ1wiXG4gICAgXSxcbiAgICBlbmFibGVWdWxuZXJhYmlsaXR5QWxlcnRzOiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vdnVsbmVyYWJpbGl0eS1hbGVydHNcIlxuICAgIF0sXG4gICAgZ2VuZXJhdGVSZWxlYXNlTm90ZXM6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXMvZ2VuZXJhdGUtbm90ZXNcIlxuICAgIF0sXG4gICAgZ2V0OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99XCJdLFxuICAgIGdldEFjY2Vzc1Jlc3RyaWN0aW9uczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVzdHJpY3Rpb25zXCJcbiAgICBdLFxuICAgIGdldEFkbWluQnJhbmNoUHJvdGVjdGlvbjogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vZW5mb3JjZV9hZG1pbnNcIlxuICAgIF0sXG4gICAgZ2V0QWxsRGVwbG95bWVudFByb3RlY3Rpb25SdWxlczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudF9wcm90ZWN0aW9uX3J1bGVzXCJcbiAgICBdLFxuICAgIGdldEFsbEVudmlyb25tZW50czogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHNcIl0sXG4gICAgZ2V0QWxsU3RhdHVzQ2hlY2tDb250ZXh0czogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVxdWlyZWRfc3RhdHVzX2NoZWNrcy9jb250ZXh0c1wiXG4gICAgXSxcbiAgICBnZXRBbGxUb3BpY3M6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdG9waWNzXCJdLFxuICAgIGdldEFwcHNXaXRoQWNjZXNzVG9Qcm90ZWN0ZWRCcmFuY2g6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3Jlc3RyaWN0aW9ucy9hcHBzXCJcbiAgICBdLFxuICAgIGdldEF1dG9saW5rOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2F1dG9saW5rcy97YXV0b2xpbmtfaWR9XCJdLFxuICAgIGdldEJyYW5jaDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofVwiXSxcbiAgICBnZXRCcmFuY2hQcm90ZWN0aW9uOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXMve2JyYW5jaH0vcHJvdGVjdGlvblwiXG4gICAgXSxcbiAgICBnZXRCcmFuY2hSdWxlczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9ydWxlcy9icmFuY2hlcy97YnJhbmNofVwiXSxcbiAgICBnZXRDbG9uZXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdHJhZmZpYy9jbG9uZXNcIl0sXG4gICAgZ2V0Q29kZUZyZXF1ZW5jeVN0YXRzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N0YXRzL2NvZGVfZnJlcXVlbmN5XCJdLFxuICAgIGdldENvbGxhYm9yYXRvclBlcm1pc3Npb25MZXZlbDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbGxhYm9yYXRvcnMve3VzZXJuYW1lfS9wZXJtaXNzaW9uXCJcbiAgICBdLFxuICAgIGdldENvbWJpbmVkU3RhdHVzRm9yUmVmOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1pdHMve3JlZn0vc3RhdHVzXCJdLFxuICAgIGdldENvbW1pdDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21taXRzL3tyZWZ9XCJdLFxuICAgIGdldENvbW1pdEFjdGl2aXR5U3RhdHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vc3RhdHMvY29tbWl0X2FjdGl2aXR5XCJdLFxuICAgIGdldENvbW1pdENvbW1lbnQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWVudHMve2NvbW1lbnRfaWR9XCJdLFxuICAgIGdldENvbW1pdFNpZ25hdHVyZVByb3RlY3Rpb246IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3NpZ25hdHVyZXNcIlxuICAgIF0sXG4gICAgZ2V0Q29tbXVuaXR5UHJvZmlsZU1ldHJpY3M6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbXVuaXR5L3Byb2ZpbGVcIl0sXG4gICAgZ2V0Q29udGVudDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb250ZW50cy97cGF0aH1cIl0sXG4gICAgZ2V0Q29udHJpYnV0b3JzU3RhdHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vc3RhdHMvY29udHJpYnV0b3JzXCJdLFxuICAgIGdldEN1c3RvbURlcGxveW1lbnRQcm90ZWN0aW9uUnVsZTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudF9wcm90ZWN0aW9uX3J1bGVzL3twcm90ZWN0aW9uX3J1bGVfaWR9XCJcbiAgICBdLFxuICAgIGdldEN1c3RvbVByb3BlcnRpZXNWYWx1ZXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcHJvcGVydGllcy92YWx1ZXNcIl0sXG4gICAgZ2V0RGVwbG95S2V5OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2tleXMve2tleV9pZH1cIl0sXG4gICAgZ2V0RGVwbG95bWVudDogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBsb3ltZW50cy97ZGVwbG95bWVudF9pZH1cIl0sXG4gICAgZ2V0RGVwbG95bWVudEJyYW5jaFBvbGljeTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudC1icmFuY2gtcG9saWNpZXMve2JyYW5jaF9wb2xpY3lfaWR9XCJcbiAgICBdLFxuICAgIGdldERlcGxveW1lbnRTdGF0dXM6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBsb3ltZW50cy97ZGVwbG95bWVudF9pZH0vc3RhdHVzZXMve3N0YXR1c19pZH1cIlxuICAgIF0sXG4gICAgZ2V0RW52aXJvbm1lbnQ6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9lbnZpcm9ubWVudHMve2Vudmlyb25tZW50X25hbWV9XCJcbiAgICBdLFxuICAgIGdldExhdGVzdFBhZ2VzQnVpbGQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcGFnZXMvYnVpbGRzL2xhdGVzdFwiXSxcbiAgICBnZXRMYXRlc3RSZWxlYXNlOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL2xhdGVzdFwiXSxcbiAgICBnZXRPcmdSdWxlU3VpdGU6IFtcIkdFVCAvb3Jncy97b3JnfS9ydWxlc2V0cy9ydWxlLXN1aXRlcy97cnVsZV9zdWl0ZV9pZH1cIl0sXG4gICAgZ2V0T3JnUnVsZVN1aXRlczogW1wiR0VUIC9vcmdzL3tvcmd9L3J1bGVzZXRzL3J1bGUtc3VpdGVzXCJdLFxuICAgIGdldE9yZ1J1bGVzZXQ6IFtcIkdFVCAvb3Jncy97b3JnfS9ydWxlc2V0cy97cnVsZXNldF9pZH1cIl0sXG4gICAgZ2V0T3JnUnVsZXNldHM6IFtcIkdFVCAvb3Jncy97b3JnfS9ydWxlc2V0c1wiXSxcbiAgICBnZXRQYWdlczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wYWdlc1wiXSxcbiAgICBnZXRQYWdlc0J1aWxkOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3BhZ2VzL2J1aWxkcy97YnVpbGRfaWR9XCJdLFxuICAgIGdldFBhZ2VzRGVwbG95bWVudDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3BhZ2VzL2RlcGxveW1lbnRzL3twYWdlc19kZXBsb3ltZW50X2lkfVwiXG4gICAgXSxcbiAgICBnZXRQYWdlc0hlYWx0aENoZWNrOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3BhZ2VzL2hlYWx0aFwiXSxcbiAgICBnZXRQYXJ0aWNpcGF0aW9uU3RhdHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vc3RhdHMvcGFydGljaXBhdGlvblwiXSxcbiAgICBnZXRQdWxsUmVxdWVzdFJldmlld1Byb3RlY3Rpb246IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3B1bGxfcmVxdWVzdF9yZXZpZXdzXCJcbiAgICBdLFxuICAgIGdldFB1bmNoQ2FyZFN0YXRzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3N0YXRzL3B1bmNoX2NhcmRcIl0sXG4gICAgZ2V0UmVhZG1lOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlYWRtZVwiXSxcbiAgICBnZXRSZWFkbWVJbkRpcmVjdG9yeTogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9yZWFkbWUve2Rpcn1cIl0sXG4gICAgZ2V0UmVsZWFzZTogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9yZWxlYXNlcy97cmVsZWFzZV9pZH1cIl0sXG4gICAgZ2V0UmVsZWFzZUFzc2V0OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL2Fzc2V0cy97YXNzZXRfaWR9XCJdLFxuICAgIGdldFJlbGVhc2VCeVRhZzogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9yZWxlYXNlcy90YWdzL3t0YWd9XCJdLFxuICAgIGdldFJlcG9SdWxlU3VpdGU6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9ydWxlc2V0cy9ydWxlLXN1aXRlcy97cnVsZV9zdWl0ZV9pZH1cIlxuICAgIF0sXG4gICAgZ2V0UmVwb1J1bGVTdWl0ZXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcnVsZXNldHMvcnVsZS1zdWl0ZXNcIl0sXG4gICAgZ2V0UmVwb1J1bGVzZXQ6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcnVsZXNldHMve3J1bGVzZXRfaWR9XCJdLFxuICAgIGdldFJlcG9SdWxlc2V0SGlzdG9yeTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3J1bGVzZXRzL3tydWxlc2V0X2lkfS9oaXN0b3J5XCJcbiAgICBdLFxuICAgIGdldFJlcG9SdWxlc2V0VmVyc2lvbjogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3J1bGVzZXRzL3tydWxlc2V0X2lkfS9oaXN0b3J5L3t2ZXJzaW9uX2lkfVwiXG4gICAgXSxcbiAgICBnZXRSZXBvUnVsZXNldHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcnVsZXNldHNcIl0sXG4gICAgZ2V0U3RhdHVzQ2hlY2tzUHJvdGVjdGlvbjogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVxdWlyZWRfc3RhdHVzX2NoZWNrc1wiXG4gICAgXSxcbiAgICBnZXRUZWFtc1dpdGhBY2Nlc3NUb1Byb3RlY3RlZEJyYW5jaDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVzdHJpY3Rpb25zL3RlYW1zXCJcbiAgICBdLFxuICAgIGdldFRvcFBhdGhzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3RyYWZmaWMvcG9wdWxhci9wYXRoc1wiXSxcbiAgICBnZXRUb3BSZWZlcnJlcnM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdHJhZmZpYy9wb3B1bGFyL3JlZmVycmVyc1wiXSxcbiAgICBnZXRVc2Vyc1dpdGhBY2Nlc3NUb1Byb3RlY3RlZEJyYW5jaDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVzdHJpY3Rpb25zL3VzZXJzXCJcbiAgICBdLFxuICAgIGdldFZpZXdzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3RyYWZmaWMvdmlld3NcIl0sXG4gICAgZ2V0V2ViaG9vazogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9ob29rcy97aG9va19pZH1cIl0sXG4gICAgZ2V0V2ViaG9va0NvbmZpZ0ZvclJlcG86IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9ob29rcy97aG9va19pZH0vY29uZmlnXCJcbiAgICBdLFxuICAgIGdldFdlYmhvb2tEZWxpdmVyeTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzL3tob29rX2lkfS9kZWxpdmVyaWVzL3tkZWxpdmVyeV9pZH1cIlxuICAgIF0sXG4gICAgbGlzdEFjdGl2aXRpZXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYWN0aXZpdHlcIl0sXG4gICAgbGlzdEF0dGVzdGF0aW9uczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2F0dGVzdGF0aW9ucy97c3ViamVjdF9kaWdlc3R9XCJcbiAgICBdLFxuICAgIGxpc3RBdXRvbGlua3M6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vYXV0b2xpbmtzXCJdLFxuICAgIGxpc3RCcmFuY2hlczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlc1wiXSxcbiAgICBsaXN0QnJhbmNoZXNGb3JIZWFkQ29tbWl0OiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWl0cy97Y29tbWl0X3NoYX0vYnJhbmNoZXMtd2hlcmUtaGVhZFwiXG4gICAgXSxcbiAgICBsaXN0Q29sbGFib3JhdG9yczogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2xsYWJvcmF0b3JzXCJdLFxuICAgIGxpc3RDb21tZW50c0ZvckNvbW1pdDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1pdHMve2NvbW1pdF9zaGF9L2NvbW1lbnRzXCJcbiAgICBdLFxuICAgIGxpc3RDb21taXRDb21tZW50c0ZvclJlcG86IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWVudHNcIl0sXG4gICAgbGlzdENvbW1pdFN0YXR1c2VzRm9yUmVmOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29tbWl0cy97cmVmfS9zdGF0dXNlc1wiXG4gICAgXSxcbiAgICBsaXN0Q29tbWl0czogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb21taXRzXCJdLFxuICAgIGxpc3RDb250cmlidXRvcnM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vY29udHJpYnV0b3JzXCJdLFxuICAgIGxpc3RDdXN0b21EZXBsb3ltZW50UnVsZUludGVncmF0aW9uczogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2Vudmlyb25tZW50cy97ZW52aXJvbm1lbnRfbmFtZX0vZGVwbG95bWVudF9wcm90ZWN0aW9uX3J1bGVzL2FwcHNcIlxuICAgIF0sXG4gICAgbGlzdERlcGxveUtleXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30va2V5c1wiXSxcbiAgICBsaXN0RGVwbG95bWVudEJyYW5jaFBvbGljaWVzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS9kZXBsb3ltZW50LWJyYW5jaC1wb2xpY2llc1wiXG4gICAgXSxcbiAgICBsaXN0RGVwbG95bWVudFN0YXR1c2VzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZGVwbG95bWVudHMve2RlcGxveW1lbnRfaWR9L3N0YXR1c2VzXCJcbiAgICBdLFxuICAgIGxpc3REZXBsb3ltZW50czogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9kZXBsb3ltZW50c1wiXSxcbiAgICBsaXN0Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlci9yZXBvc1wiXSxcbiAgICBsaXN0Rm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vcmVwb3NcIl0sXG4gICAgbGlzdEZvclVzZXI6IFtcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9yZXBvc1wiXSxcbiAgICBsaXN0Rm9ya3M6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vZm9ya3NcIl0sXG4gICAgbGlzdEludml0YXRpb25zOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2ludml0YXRpb25zXCJdLFxuICAgIGxpc3RJbnZpdGF0aW9uc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvcmVwb3NpdG9yeV9pbnZpdGF0aW9uc1wiXSxcbiAgICBsaXN0TGFuZ3VhZ2VzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2xhbmd1YWdlc1wiXSxcbiAgICBsaXN0UGFnZXNCdWlsZHM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcGFnZXMvYnVpbGRzXCJdLFxuICAgIGxpc3RQdWJsaWM6IFtcIkdFVCAvcmVwb3NpdG9yaWVzXCJdLFxuICAgIGxpc3RQdWxsUmVxdWVzdHNBc3NvY2lhdGVkV2l0aENvbW1pdDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1pdHMve2NvbW1pdF9zaGF9L3B1bGxzXCJcbiAgICBdLFxuICAgIGxpc3RSZWxlYXNlQXNzZXRzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXMve3JlbGVhc2VfaWR9L2Fzc2V0c1wiXG4gICAgXSxcbiAgICBsaXN0UmVsZWFzZXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXNcIl0sXG4gICAgbGlzdFRhZ3M6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdGFnc1wiXSxcbiAgICBsaXN0VGVhbXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vdGVhbXNcIl0sXG4gICAgbGlzdFdlYmhvb2tEZWxpdmVyaWVzOiBbXG4gICAgICBcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vaG9va3Mve2hvb2tfaWR9L2RlbGl2ZXJpZXNcIlxuICAgIF0sXG4gICAgbGlzdFdlYmhvb2tzOiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzXCJdLFxuICAgIG1lcmdlOiBbXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9tZXJnZXNcIl0sXG4gICAgbWVyZ2VVcHN0cmVhbTogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vbWVyZ2UtdXBzdHJlYW1cIl0sXG4gICAgcGluZ1dlYmhvb2s6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzL3tob29rX2lkfS9waW5nc1wiXSxcbiAgICByZWRlbGl2ZXJXZWJob29rRGVsaXZlcnk6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vaG9va3Mve2hvb2tfaWR9L2RlbGl2ZXJpZXMve2RlbGl2ZXJ5X2lkfS9hdHRlbXB0c1wiXG4gICAgXSxcbiAgICByZW1vdmVBcHBBY2Nlc3NSZXN0cmljdGlvbnM6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3Jlc3RyaWN0aW9ucy9hcHBzXCIsXG4gICAgICB7fSxcbiAgICAgIHsgbWFwVG9EYXRhOiBcImFwcHNcIiB9XG4gICAgXSxcbiAgICByZW1vdmVDb2xsYWJvcmF0b3I6IFtcbiAgICAgIFwiREVMRVRFIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9jb2xsYWJvcmF0b3JzL3t1c2VybmFtZX1cIlxuICAgIF0sXG4gICAgcmVtb3ZlU3RhdHVzQ2hlY2tDb250ZXh0czogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVxdWlyZWRfc3RhdHVzX2NoZWNrcy9jb250ZXh0c1wiLFxuICAgICAge30sXG4gICAgICB7IG1hcFRvRGF0YTogXCJjb250ZXh0c1wiIH1cbiAgICBdLFxuICAgIHJlbW92ZVN0YXR1c0NoZWNrUHJvdGVjdGlvbjogW1xuICAgICAgXCJERUxFVEUgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVxdWlyZWRfc3RhdHVzX2NoZWNrc1wiXG4gICAgXSxcbiAgICByZW1vdmVUZWFtQWNjZXNzUmVzdHJpY3Rpb25zOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXMve2JyYW5jaH0vcHJvdGVjdGlvbi9yZXN0cmljdGlvbnMvdGVhbXNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwidGVhbXNcIiB9XG4gICAgXSxcbiAgICByZW1vdmVVc2VyQWNjZXNzUmVzdHJpY3Rpb25zOiBbXG4gICAgICBcIkRFTEVURSAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXMve2JyYW5jaH0vcHJvdGVjdGlvbi9yZXN0cmljdGlvbnMvdXNlcnNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwidXNlcnNcIiB9XG4gICAgXSxcbiAgICByZW5hbWVCcmFuY2g6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3JlbmFtZVwiXSxcbiAgICByZXBsYWNlQWxsVG9waWNzOiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3RvcGljc1wiXSxcbiAgICByZXF1ZXN0UGFnZXNCdWlsZDogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcGFnZXMvYnVpbGRzXCJdLFxuICAgIHNldEFkbWluQnJhbmNoUHJvdGVjdGlvbjogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL2VuZm9yY2VfYWRtaW5zXCJcbiAgICBdLFxuICAgIHNldEFwcEFjY2Vzc1Jlc3RyaWN0aW9uczogW1xuICAgICAgXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVzdHJpY3Rpb25zL2FwcHNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwiYXBwc1wiIH1cbiAgICBdLFxuICAgIHNldFN0YXR1c0NoZWNrQ29udGV4dHM6IFtcbiAgICAgIFwiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3N0YXR1c19jaGVja3MvY29udGV4dHNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwiY29udGV4dHNcIiB9XG4gICAgXSxcbiAgICBzZXRUZWFtQWNjZXNzUmVzdHJpY3Rpb25zOiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXMve2JyYW5jaH0vcHJvdGVjdGlvbi9yZXN0cmljdGlvbnMvdGVhbXNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwidGVhbXNcIiB9XG4gICAgXSxcbiAgICBzZXRVc2VyQWNjZXNzUmVzdHJpY3Rpb25zOiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXMve2JyYW5jaH0vcHJvdGVjdGlvbi9yZXN0cmljdGlvbnMvdXNlcnNcIixcbiAgICAgIHt9LFxuICAgICAgeyBtYXBUb0RhdGE6IFwidXNlcnNcIiB9XG4gICAgXSxcbiAgICB0ZXN0UHVzaFdlYmhvb2s6IFtcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzL3tob29rX2lkfS90ZXN0c1wiXSxcbiAgICB0cmFuc2ZlcjogW1wiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vdHJhbnNmZXJcIl0sXG4gICAgdXBkYXRlOiBbXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb31cIl0sXG4gICAgdXBkYXRlQnJhbmNoUHJvdGVjdGlvbjogW1xuICAgICAgXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb25cIlxuICAgIF0sXG4gICAgdXBkYXRlQ29tbWl0Q29tbWVudDogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2NvbW1lbnRzL3tjb21tZW50X2lkfVwiXSxcbiAgICB1cGRhdGVEZXBsb3ltZW50QnJhbmNoUG9saWN5OiBbXG4gICAgICBcIlBVVCAvcmVwb3Mve293bmVyfS97cmVwb30vZW52aXJvbm1lbnRzL3tlbnZpcm9ubWVudF9uYW1lfS9kZXBsb3ltZW50LWJyYW5jaC1wb2xpY2llcy97YnJhbmNoX3BvbGljeV9pZH1cIlxuICAgIF0sXG4gICAgdXBkYXRlSW5mb3JtYXRpb25BYm91dFBhZ2VzU2l0ZTogW1wiUFVUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9wYWdlc1wiXSxcbiAgICB1cGRhdGVJbnZpdGF0aW9uOiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9pbnZpdGF0aW9ucy97aW52aXRhdGlvbl9pZH1cIlxuICAgIF0sXG4gICAgdXBkYXRlT3JnUnVsZXNldDogW1wiUFVUIC9vcmdzL3tvcmd9L3J1bGVzZXRzL3tydWxlc2V0X2lkfVwiXSxcbiAgICB1cGRhdGVQdWxsUmVxdWVzdFJldmlld1Byb3RlY3Rpb246IFtcbiAgICAgIFwiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2JyYW5jaGVzL3ticmFuY2h9L3Byb3RlY3Rpb24vcmVxdWlyZWRfcHVsbF9yZXF1ZXN0X3Jldmlld3NcIlxuICAgIF0sXG4gICAgdXBkYXRlUmVsZWFzZTogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL3tyZWxlYXNlX2lkfVwiXSxcbiAgICB1cGRhdGVSZWxlYXNlQXNzZXQ6IFtcbiAgICAgIFwiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L3JlbGVhc2VzL2Fzc2V0cy97YXNzZXRfaWR9XCJcbiAgICBdLFxuICAgIHVwZGF0ZVJlcG9SdWxlc2V0OiBbXCJQVVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3J1bGVzZXRzL3tydWxlc2V0X2lkfVwiXSxcbiAgICB1cGRhdGVTdGF0dXNDaGVja1BvdGVjdGlvbjogW1xuICAgICAgXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vYnJhbmNoZXMve2JyYW5jaH0vcHJvdGVjdGlvbi9yZXF1aXJlZF9zdGF0dXNfY2hlY2tzXCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1wicmVwb3NcIiwgXCJ1cGRhdGVTdGF0dXNDaGVja1Byb3RlY3Rpb25cIl0gfVxuICAgIF0sXG4gICAgdXBkYXRlU3RhdHVzQ2hlY2tQcm90ZWN0aW9uOiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9icmFuY2hlcy97YnJhbmNofS9wcm90ZWN0aW9uL3JlcXVpcmVkX3N0YXR1c19jaGVja3NcIlxuICAgIF0sXG4gICAgdXBkYXRlV2ViaG9vazogW1wiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L2hvb2tzL3tob29rX2lkfVwiXSxcbiAgICB1cGRhdGVXZWJob29rQ29uZmlnRm9yUmVwbzogW1xuICAgICAgXCJQQVRDSCAvcmVwb3Mve293bmVyfS97cmVwb30vaG9va3Mve2hvb2tfaWR9L2NvbmZpZ1wiXG4gICAgXSxcbiAgICB1cGxvYWRSZWxlYXNlQXNzZXQ6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vcmVsZWFzZXMve3JlbGVhc2VfaWR9L2Fzc2V0c3s/bmFtZSxsYWJlbH1cIixcbiAgICAgIHsgYmFzZVVybDogXCJodHRwczovL3VwbG9hZHMuZ2l0aHViLmNvbVwiIH1cbiAgICBdXG4gIH0sXG4gIHNlYXJjaDoge1xuICAgIGNvZGU6IFtcIkdFVCAvc2VhcmNoL2NvZGVcIl0sXG4gICAgY29tbWl0czogW1wiR0VUIC9zZWFyY2gvY29tbWl0c1wiXSxcbiAgICBpc3N1ZXNBbmRQdWxsUmVxdWVzdHM6IFtcbiAgICAgIFwiR0VUIC9zZWFyY2gvaXNzdWVzXCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgZGVwcmVjYXRlZDogXCJvY3Rva2l0LnJlc3Quc2VhcmNoLmlzc3Vlc0FuZFB1bGxSZXF1ZXN0cygpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3NlYXJjaC9zZWFyY2gjc2VhcmNoLWlzc3Vlcy1hbmQtcHVsbC1yZXF1ZXN0c1wiXG4gICAgICB9XG4gICAgXSxcbiAgICBsYWJlbHM6IFtcIkdFVCAvc2VhcmNoL2xhYmVsc1wiXSxcbiAgICByZXBvczogW1wiR0VUIC9zZWFyY2gvcmVwb3NpdG9yaWVzXCJdLFxuICAgIHRvcGljczogW1wiR0VUIC9zZWFyY2gvdG9waWNzXCJdLFxuICAgIHVzZXJzOiBbXCJHRVQgL3NlYXJjaC91c2Vyc1wiXVxuICB9LFxuICBzZWNyZXRTY2FubmluZzoge1xuICAgIGNyZWF0ZVB1c2hQcm90ZWN0aW9uQnlwYXNzOiBbXG4gICAgICBcIlBPU1QgL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3JldC1zY2FubmluZy9wdXNoLXByb3RlY3Rpb24tYnlwYXNzZXNcIlxuICAgIF0sXG4gICAgZ2V0QWxlcnQ6IFtcbiAgICAgIFwiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zZWNyZXQtc2Nhbm5pbmcvYWxlcnRzL3thbGVydF9udW1iZXJ9XCJcbiAgICBdLFxuICAgIGdldFNjYW5IaXN0b3J5OiBbXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3JldC1zY2FubmluZy9zY2FuLWhpc3RvcnlcIl0sXG4gICAgbGlzdEFsZXJ0c0ZvckVudGVycHJpc2U6IFtcbiAgICAgIFwiR0VUIC9lbnRlcnByaXNlcy97ZW50ZXJwcmlzZX0vc2VjcmV0LXNjYW5uaW5nL2FsZXJ0c1wiXG4gICAgXSxcbiAgICBsaXN0QWxlcnRzRm9yT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vc2VjcmV0LXNjYW5uaW5nL2FsZXJ0c1wiXSxcbiAgICBsaXN0QWxlcnRzRm9yUmVwbzogW1wiR0VUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zZWNyZXQtc2Nhbm5pbmcvYWxlcnRzXCJdLFxuICAgIGxpc3RMb2NhdGlvbnNGb3JBbGVydDogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3JldC1zY2FubmluZy9hbGVydHMve2FsZXJ0X251bWJlcn0vbG9jYXRpb25zXCJcbiAgICBdLFxuICAgIHVwZGF0ZUFsZXJ0OiBbXG4gICAgICBcIlBBVENIIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zZWNyZXQtc2Nhbm5pbmcvYWxlcnRzL3thbGVydF9udW1iZXJ9XCJcbiAgICBdXG4gIH0sXG4gIHNlY3VyaXR5QWR2aXNvcmllczoge1xuICAgIGNyZWF0ZUZvcms6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vc2VjdXJpdHktYWR2aXNvcmllcy97Z2hzYV9pZH0vZm9ya3NcIlxuICAgIF0sXG4gICAgY3JlYXRlUHJpdmF0ZVZ1bG5lcmFiaWxpdHlSZXBvcnQ6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vc2VjdXJpdHktYWR2aXNvcmllcy9yZXBvcnRzXCJcbiAgICBdLFxuICAgIGNyZWF0ZVJlcG9zaXRvcnlBZHZpc29yeTogW1xuICAgICAgXCJQT1NUIC9yZXBvcy97b3duZXJ9L3tyZXBvfS9zZWN1cml0eS1hZHZpc29yaWVzXCJcbiAgICBdLFxuICAgIGNyZWF0ZVJlcG9zaXRvcnlBZHZpc29yeUN2ZVJlcXVlc3Q6IFtcbiAgICAgIFwiUE9TVCAvcmVwb3Mve293bmVyfS97cmVwb30vc2VjdXJpdHktYWR2aXNvcmllcy97Z2hzYV9pZH0vY3ZlXCJcbiAgICBdLFxuICAgIGdldEdsb2JhbEFkdmlzb3J5OiBbXCJHRVQgL2Fkdmlzb3JpZXMve2doc2FfaWR9XCJdLFxuICAgIGdldFJlcG9zaXRvcnlBZHZpc29yeTogW1xuICAgICAgXCJHRVQgL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3VyaXR5LWFkdmlzb3JpZXMve2doc2FfaWR9XCJcbiAgICBdLFxuICAgIGxpc3RHbG9iYWxBZHZpc29yaWVzOiBbXCJHRVQgL2Fkdmlzb3JpZXNcIl0sXG4gICAgbGlzdE9yZ1JlcG9zaXRvcnlBZHZpc29yaWVzOiBbXCJHRVQgL29yZ3Mve29yZ30vc2VjdXJpdHktYWR2aXNvcmllc1wiXSxcbiAgICBsaXN0UmVwb3NpdG9yeUFkdmlzb3JpZXM6IFtcIkdFVCAvcmVwb3Mve293bmVyfS97cmVwb30vc2VjdXJpdHktYWR2aXNvcmllc1wiXSxcbiAgICB1cGRhdGVSZXBvc2l0b3J5QWR2aXNvcnk6IFtcbiAgICAgIFwiUEFUQ0ggL3JlcG9zL3tvd25lcn0ve3JlcG99L3NlY3VyaXR5LWFkdmlzb3JpZXMve2doc2FfaWR9XCJcbiAgICBdXG4gIH0sXG4gIHRlYW1zOiB7XG4gICAgYWRkT3JVcGRhdGVNZW1iZXJzaGlwRm9yVXNlckluT3JnOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9tZW1iZXJzaGlwcy97dXNlcm5hbWV9XCJcbiAgICBdLFxuICAgIGFkZE9yVXBkYXRlUHJvamVjdFBlcm1pc3Npb25zSW5Pcmc6IFtcbiAgICAgIFwiUFVUIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L3Byb2plY3RzL3twcm9qZWN0X2lkfVwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnRlYW1zLmFkZE9yVXBkYXRlUHJvamVjdFBlcm1pc3Npb25zSW5PcmcoKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC90ZWFtcy90ZWFtcyNhZGQtb3ItdXBkYXRlLXRlYW0tcHJvamVjdC1wZXJtaXNzaW9uc1wiXG4gICAgICB9XG4gICAgXSxcbiAgICBhZGRPclVwZGF0ZVByb2plY3RQZXJtaXNzaW9uc0xlZ2FjeTogW1xuICAgICAgXCJQVVQgL3RlYW1zL3t0ZWFtX2lkfS9wcm9qZWN0cy97cHJvamVjdF9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC50ZWFtcy5hZGRPclVwZGF0ZVByb2plY3RQZXJtaXNzaW9uc0xlZ2FjeSgpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3RlYW1zL3RlYW1zI2FkZC1vci11cGRhdGUtdGVhbS1wcm9qZWN0LXBlcm1pc3Npb25zLWxlZ2FjeVwiXG4gICAgICB9XG4gICAgXSxcbiAgICBhZGRPclVwZGF0ZVJlcG9QZXJtaXNzaW9uc0luT3JnOiBbXG4gICAgICBcIlBVVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9yZXBvcy97b3duZXJ9L3tyZXBvfVwiXG4gICAgXSxcbiAgICBjaGVja1Blcm1pc3Npb25zRm9yUHJvamVjdEluT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9wcm9qZWN0cy97cHJvamVjdF9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC50ZWFtcy5jaGVja1Blcm1pc3Npb25zRm9yUHJvamVjdEluT3JnKCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvdGVhbXMvdGVhbXMjY2hlY2stdGVhbS1wZXJtaXNzaW9ucy1mb3ItYS1wcm9qZWN0XCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGNoZWNrUGVybWlzc2lvbnNGb3JQcm9qZWN0TGVnYWN5OiBbXG4gICAgICBcIkdFVCAvdGVhbXMve3RlYW1faWR9L3Byb2plY3RzL3twcm9qZWN0X2lkfVwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnRlYW1zLmNoZWNrUGVybWlzc2lvbnNGb3JQcm9qZWN0TGVnYWN5KCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvdGVhbXMvdGVhbXMjY2hlY2stdGVhbS1wZXJtaXNzaW9ucy1mb3ItYS1wcm9qZWN0LWxlZ2FjeVwiXG4gICAgICB9XG4gICAgXSxcbiAgICBjaGVja1Blcm1pc3Npb25zRm9yUmVwb0luT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9yZXBvcy97b3duZXJ9L3tyZXBvfVwiXG4gICAgXSxcbiAgICBjcmVhdGU6IFtcIlBPU1QgL29yZ3Mve29yZ30vdGVhbXNcIl0sXG4gICAgY3JlYXRlRGlzY3Vzc2lvbkNvbW1lbnRJbk9yZzogW1xuICAgICAgXCJQT1NUIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn0vY29tbWVudHNcIlxuICAgIF0sXG4gICAgY3JlYXRlRGlzY3Vzc2lvbkluT3JnOiBbXCJQT1NUIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zXCJdLFxuICAgIGRlbGV0ZURpc2N1c3Npb25Db21tZW50SW5Pcmc6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn0vY29tbWVudHMve2NvbW1lbnRfbnVtYmVyfVwiXG4gICAgXSxcbiAgICBkZWxldGVEaXNjdXNzaW9uSW5Pcmc6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn1cIlxuICAgIF0sXG4gICAgZGVsZXRlSW5Pcmc6IFtcIkRFTEVURSAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfVwiXSxcbiAgICBnZXRCeU5hbWU6IFtcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfVwiXSxcbiAgICBnZXREaXNjdXNzaW9uQ29tbWVudEluT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L2NvbW1lbnRzL3tjb21tZW50X251bWJlcn1cIlxuICAgIF0sXG4gICAgZ2V0RGlzY3Vzc2lvbkluT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9XCJcbiAgICBdLFxuICAgIGdldE1lbWJlcnNoaXBGb3JVc2VySW5Pcmc6IFtcbiAgICAgIFwiR0VUIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L21lbWJlcnNoaXBzL3t1c2VybmFtZX1cIlxuICAgIF0sXG4gICAgbGlzdDogW1wiR0VUIC9vcmdzL3tvcmd9L3RlYW1zXCJdLFxuICAgIGxpc3RDaGlsZEluT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vdGVhbXNcIl0sXG4gICAgbGlzdERpc2N1c3Npb25Db21tZW50c0luT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9kaXNjdXNzaW9ucy97ZGlzY3Vzc2lvbl9udW1iZXJ9L2NvbW1lbnRzXCJcbiAgICBdLFxuICAgIGxpc3REaXNjdXNzaW9uc0luT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vZGlzY3Vzc2lvbnNcIl0sXG4gICAgbGlzdEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvdGVhbXNcIl0sXG4gICAgbGlzdE1lbWJlcnNJbk9yZzogW1wiR0VUIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L21lbWJlcnNcIl0sXG4gICAgbGlzdFBlbmRpbmdJbnZpdGF0aW9uc0luT3JnOiBbXG4gICAgICBcIkdFVCAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9pbnZpdGF0aW9uc1wiXG4gICAgXSxcbiAgICBsaXN0UHJvamVjdHNJbk9yZzogW1xuICAgICAgXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vcHJvamVjdHNcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC50ZWFtcy5saXN0UHJvamVjdHNJbk9yZygpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3RlYW1zL3RlYW1zI2xpc3QtdGVhbS1wcm9qZWN0c1wiXG4gICAgICB9XG4gICAgXSxcbiAgICBsaXN0UHJvamVjdHNMZWdhY3k6IFtcbiAgICAgIFwiR0VUIC90ZWFtcy97dGVhbV9pZH0vcHJvamVjdHNcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC50ZWFtcy5saXN0UHJvamVjdHNMZWdhY3koKSBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vcmVzdC90ZWFtcy90ZWFtcyNsaXN0LXRlYW0tcHJvamVjdHMtbGVnYWN5XCJcbiAgICAgIH1cbiAgICBdLFxuICAgIGxpc3RSZXBvc0luT3JnOiBbXCJHRVQgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vcmVwb3NcIl0sXG4gICAgcmVtb3ZlTWVtYmVyc2hpcEZvclVzZXJJbk9yZzogW1xuICAgICAgXCJERUxFVEUgL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vbWVtYmVyc2hpcHMve3VzZXJuYW1lfVwiXG4gICAgXSxcbiAgICByZW1vdmVQcm9qZWN0SW5Pcmc6IFtcbiAgICAgIFwiREVMRVRFIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L3Byb2plY3RzL3twcm9qZWN0X2lkfVwiLFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGRlcHJlY2F0ZWQ6IFwib2N0b2tpdC5yZXN0LnRlYW1zLnJlbW92ZVByb2plY3RJbk9yZygpIGlzIGRlcHJlY2F0ZWQsIHNlZSBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9yZXN0L3RlYW1zL3RlYW1zI3JlbW92ZS1hLXByb2plY3QtZnJvbS1hLXRlYW1cIlxuICAgICAgfVxuICAgIF0sXG4gICAgcmVtb3ZlUHJvamVjdExlZ2FjeTogW1xuICAgICAgXCJERUxFVEUgL3RlYW1zL3t0ZWFtX2lkfS9wcm9qZWN0cy97cHJvamVjdF9pZH1cIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBkZXByZWNhdGVkOiBcIm9jdG9raXQucmVzdC50ZWFtcy5yZW1vdmVQcm9qZWN0TGVnYWN5KCkgaXMgZGVwcmVjYXRlZCwgc2VlIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL3Jlc3QvdGVhbXMvdGVhbXMjcmVtb3ZlLWEtcHJvamVjdC1mcm9tLWEtdGVhbS1sZWdhY3lcIlxuICAgICAgfVxuICAgIF0sXG4gICAgcmVtb3ZlUmVwb0luT3JnOiBbXG4gICAgICBcIkRFTEVURSAvb3Jncy97b3JnfS90ZWFtcy97dGVhbV9zbHVnfS9yZXBvcy97b3duZXJ9L3tyZXBvfVwiXG4gICAgXSxcbiAgICB1cGRhdGVEaXNjdXNzaW9uQ29tbWVudEluT3JnOiBbXG4gICAgICBcIlBBVENIIC9vcmdzL3tvcmd9L3RlYW1zL3t0ZWFtX3NsdWd9L2Rpc2N1c3Npb25zL3tkaXNjdXNzaW9uX251bWJlcn0vY29tbWVudHMve2NvbW1lbnRfbnVtYmVyfVwiXG4gICAgXSxcbiAgICB1cGRhdGVEaXNjdXNzaW9uSW5Pcmc6IFtcbiAgICAgIFwiUEFUQ0ggL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z30vZGlzY3Vzc2lvbnMve2Rpc2N1c3Npb25fbnVtYmVyfVwiXG4gICAgXSxcbiAgICB1cGRhdGVJbk9yZzogW1wiUEFUQ0ggL29yZ3Mve29yZ30vdGVhbXMve3RlYW1fc2x1Z31cIl1cbiAgfSxcbiAgdXNlcnM6IHtcbiAgICBhZGRFbWFpbEZvckF1dGhlbnRpY2F0ZWQ6IFtcbiAgICAgIFwiUE9TVCAvdXNlci9lbWFpbHNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImFkZEVtYWlsRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgYWRkRW1haWxGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiUE9TVCAvdXNlci9lbWFpbHNcIl0sXG4gICAgYWRkU29jaWFsQWNjb3VudEZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJQT1NUIC91c2VyL3NvY2lhbF9hY2NvdW50c1wiXSxcbiAgICBibG9jazogW1wiUFVUIC91c2VyL2Jsb2Nrcy97dXNlcm5hbWV9XCJdLFxuICAgIGNoZWNrQmxvY2tlZDogW1wiR0VUIC91c2VyL2Jsb2Nrcy97dXNlcm5hbWV9XCJdLFxuICAgIGNoZWNrRm9sbG93aW5nRm9yVXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L2ZvbGxvd2luZy97dGFyZ2V0X3VzZXJ9XCJdLFxuICAgIGNoZWNrUGVyc29uSXNGb2xsb3dlZEJ5QXV0aGVudGljYXRlZDogW1wiR0VUIC91c2VyL2ZvbGxvd2luZy97dXNlcm5hbWV9XCJdLFxuICAgIGNyZWF0ZUdwZ0tleUZvckF1dGhlbnRpY2F0ZWQ6IFtcbiAgICAgIFwiUE9TVCAvdXNlci9ncGdfa2V5c1wiLFxuICAgICAge30sXG4gICAgICB7IHJlbmFtZWQ6IFtcInVzZXJzXCIsIFwiY3JlYXRlR3BnS2V5Rm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgY3JlYXRlR3BnS2V5Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIlBPU1QgL3VzZXIvZ3BnX2tleXNcIl0sXG4gICAgY3JlYXRlUHVibGljU3NoS2V5Rm9yQXV0aGVudGljYXRlZDogW1xuICAgICAgXCJQT1NUIC91c2VyL2tleXNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImNyZWF0ZVB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGNyZWF0ZVB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJQT1NUIC91c2VyL2tleXNcIl0sXG4gICAgY3JlYXRlU3NoU2lnbmluZ0tleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJQT1NUIC91c2VyL3NzaF9zaWduaW5nX2tleXNcIl0sXG4gICAgZGVsZXRlRW1haWxGb3JBdXRoZW50aWNhdGVkOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9lbWFpbHNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImRlbGV0ZUVtYWlsRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgZGVsZXRlRW1haWxGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiREVMRVRFIC91c2VyL2VtYWlsc1wiXSxcbiAgICBkZWxldGVHcGdLZXlGb3JBdXRoZW50aWNhdGVkOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9ncGdfa2V5cy97Z3BnX2tleV9pZH1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImRlbGV0ZUdwZ0tleUZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGRlbGV0ZUdwZ0tleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJERUxFVEUgL3VzZXIvZ3BnX2tleXMve2dwZ19rZXlfaWR9XCJdLFxuICAgIGRlbGV0ZVB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWQ6IFtcbiAgICAgIFwiREVMRVRFIC91c2VyL2tleXMve2tleV9pZH1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImRlbGV0ZVB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGRlbGV0ZVB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJERUxFVEUgL3VzZXIva2V5cy97a2V5X2lkfVwiXSxcbiAgICBkZWxldGVTb2NpYWxBY2NvdW50Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcIkRFTEVURSAvdXNlci9zb2NpYWxfYWNjb3VudHNcIl0sXG4gICAgZGVsZXRlU3NoU2lnbmluZ0tleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIkRFTEVURSAvdXNlci9zc2hfc2lnbmluZ19rZXlzL3tzc2hfc2lnbmluZ19rZXlfaWR9XCJcbiAgICBdLFxuICAgIGZvbGxvdzogW1wiUFVUIC91c2VyL2ZvbGxvd2luZy97dXNlcm5hbWV9XCJdLFxuICAgIGdldEF1dGhlbnRpY2F0ZWQ6IFtcIkdFVCAvdXNlclwiXSxcbiAgICBnZXRCeUlkOiBbXCJHRVQgL3VzZXIve2FjY291bnRfaWR9XCJdLFxuICAgIGdldEJ5VXNlcm5hbWU6IFtcIkdFVCAvdXNlcnMve3VzZXJuYW1lfVwiXSxcbiAgICBnZXRDb250ZXh0Rm9yVXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L2hvdmVyY2FyZFwiXSxcbiAgICBnZXRHcGdLZXlGb3JBdXRoZW50aWNhdGVkOiBbXG4gICAgICBcIkdFVCAvdXNlci9ncGdfa2V5cy97Z3BnX2tleV9pZH1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImdldEdwZ0tleUZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGdldEdwZ0tleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvZ3BnX2tleXMve2dwZ19rZXlfaWR9XCJdLFxuICAgIGdldFB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWQ6IFtcbiAgICAgIFwiR0VUIC91c2VyL2tleXMve2tleV9pZH1cIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImdldFB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGdldFB1YmxpY1NzaEtleUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIva2V5cy97a2V5X2lkfVwiXSxcbiAgICBnZXRTc2hTaWduaW5nS2V5Rm9yQXV0aGVudGljYXRlZFVzZXI6IFtcbiAgICAgIFwiR0VUIC91c2VyL3NzaF9zaWduaW5nX2tleXMve3NzaF9zaWduaW5nX2tleV9pZH1cIlxuICAgIF0sXG4gICAgbGlzdDogW1wiR0VUIC91c2Vyc1wiXSxcbiAgICBsaXN0QXR0ZXN0YXRpb25zOiBbXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vYXR0ZXN0YXRpb25zL3tzdWJqZWN0X2RpZ2VzdH1cIl0sXG4gICAgbGlzdEJsb2NrZWRCeUF1dGhlbnRpY2F0ZWQ6IFtcbiAgICAgIFwiR0VUIC91c2VyL2Jsb2Nrc1wiLFxuICAgICAge30sXG4gICAgICB7IHJlbmFtZWQ6IFtcInVzZXJzXCIsIFwibGlzdEJsb2NrZWRCeUF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGxpc3RCbG9ja2VkQnlBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL2Jsb2Nrc1wiXSxcbiAgICBsaXN0RW1haWxzRm9yQXV0aGVudGljYXRlZDogW1xuICAgICAgXCJHRVQgL3VzZXIvZW1haWxzXCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1widXNlcnNcIiwgXCJsaXN0RW1haWxzRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgbGlzdEVtYWlsc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvZW1haWxzXCJdLFxuICAgIGxpc3RGb2xsb3dlZEJ5QXV0aGVudGljYXRlZDogW1xuICAgICAgXCJHRVQgL3VzZXIvZm9sbG93aW5nXCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1widXNlcnNcIiwgXCJsaXN0Rm9sbG93ZWRCeUF1dGhlbnRpY2F0ZWRVc2VyXCJdIH1cbiAgICBdLFxuICAgIGxpc3RGb2xsb3dlZEJ5QXV0aGVudGljYXRlZFVzZXI6IFtcIkdFVCAvdXNlci9mb2xsb3dpbmdcIl0sXG4gICAgbGlzdEZvbGxvd2Vyc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvZm9sbG93ZXJzXCJdLFxuICAgIGxpc3RGb2xsb3dlcnNGb3JVc2VyOiBbXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vZm9sbG93ZXJzXCJdLFxuICAgIGxpc3RGb2xsb3dpbmdGb3JVc2VyOiBbXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vZm9sbG93aW5nXCJdLFxuICAgIGxpc3RHcGdLZXlzRm9yQXV0aGVudGljYXRlZDogW1xuICAgICAgXCJHRVQgL3VzZXIvZ3BnX2tleXNcIixcbiAgICAgIHt9LFxuICAgICAgeyByZW5hbWVkOiBbXCJ1c2Vyc1wiLCBcImxpc3RHcGdLZXlzRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgbGlzdEdwZ0tleXNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL2dwZ19rZXlzXCJdLFxuICAgIGxpc3RHcGdLZXlzRm9yVXNlcjogW1wiR0VUIC91c2Vycy97dXNlcm5hbWV9L2dwZ19rZXlzXCJdLFxuICAgIGxpc3RQdWJsaWNFbWFpbHNGb3JBdXRoZW50aWNhdGVkOiBbXG4gICAgICBcIkdFVCAvdXNlci9wdWJsaWNfZW1haWxzXCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1widXNlcnNcIiwgXCJsaXN0UHVibGljRW1haWxzRm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgbGlzdFB1YmxpY0VtYWlsc0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvcHVibGljX2VtYWlsc1wiXSxcbiAgICBsaXN0UHVibGljS2V5c0ZvclVzZXI6IFtcIkdFVCAvdXNlcnMve3VzZXJuYW1lfS9rZXlzXCJdLFxuICAgIGxpc3RQdWJsaWNTc2hLZXlzRm9yQXV0aGVudGljYXRlZDogW1xuICAgICAgXCJHRVQgL3VzZXIva2V5c1wiLFxuICAgICAge30sXG4gICAgICB7IHJlbmFtZWQ6IFtcInVzZXJzXCIsIFwibGlzdFB1YmxpY1NzaEtleXNGb3JBdXRoZW50aWNhdGVkVXNlclwiXSB9XG4gICAgXSxcbiAgICBsaXN0UHVibGljU3NoS2V5c0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIva2V5c1wiXSxcbiAgICBsaXN0U29jaWFsQWNjb3VudHNGb3JBdXRoZW50aWNhdGVkVXNlcjogW1wiR0VUIC91c2VyL3NvY2lhbF9hY2NvdW50c1wiXSxcbiAgICBsaXN0U29jaWFsQWNjb3VudHNGb3JVc2VyOiBbXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vc29jaWFsX2FjY291bnRzXCJdLFxuICAgIGxpc3RTc2hTaWduaW5nS2V5c0ZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXCJHRVQgL3VzZXIvc3NoX3NpZ25pbmdfa2V5c1wiXSxcbiAgICBsaXN0U3NoU2lnbmluZ0tleXNGb3JVc2VyOiBbXCJHRVQgL3VzZXJzL3t1c2VybmFtZX0vc3NoX3NpZ25pbmdfa2V5c1wiXSxcbiAgICBzZXRQcmltYXJ5RW1haWxWaXNpYmlsaXR5Rm9yQXV0aGVudGljYXRlZDogW1xuICAgICAgXCJQQVRDSCAvdXNlci9lbWFpbC92aXNpYmlsaXR5XCIsXG4gICAgICB7fSxcbiAgICAgIHsgcmVuYW1lZDogW1widXNlcnNcIiwgXCJzZXRQcmltYXJ5RW1haWxWaXNpYmlsaXR5Rm9yQXV0aGVudGljYXRlZFVzZXJcIl0gfVxuICAgIF0sXG4gICAgc2V0UHJpbWFyeUVtYWlsVmlzaWJpbGl0eUZvckF1dGhlbnRpY2F0ZWRVc2VyOiBbXG4gICAgICBcIlBBVENIIC91c2VyL2VtYWlsL3Zpc2liaWxpdHlcIlxuICAgIF0sXG4gICAgdW5ibG9jazogW1wiREVMRVRFIC91c2VyL2Jsb2Nrcy97dXNlcm5hbWV9XCJdLFxuICAgIHVuZm9sbG93OiBbXCJERUxFVEUgL3VzZXIvZm9sbG93aW5nL3t1c2VybmFtZX1cIl0sXG4gICAgdXBkYXRlQXV0aGVudGljYXRlZDogW1wiUEFUQ0ggL3VzZXJcIl1cbiAgfVxufTtcbnZhciBlbmRwb2ludHNfZGVmYXVsdCA9IEVuZHBvaW50cztcbmV4cG9ydCB7XG4gIGVuZHBvaW50c19kZWZhdWx0IGFzIGRlZmF1bHRcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lbmRwb2ludHMuanMubWFwXG4iLAogICAgImltcG9ydCBFTkRQT0lOVFMgZnJvbSBcIi4vZ2VuZXJhdGVkL2VuZHBvaW50cy5qc1wiO1xuY29uc3QgZW5kcG9pbnRNZXRob2RzTWFwID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbmZvciAoY29uc3QgW3Njb3BlLCBlbmRwb2ludHNdIG9mIE9iamVjdC5lbnRyaWVzKEVORFBPSU5UUykpIHtcbiAgZm9yIChjb25zdCBbbWV0aG9kTmFtZSwgZW5kcG9pbnRdIG9mIE9iamVjdC5lbnRyaWVzKGVuZHBvaW50cykpIHtcbiAgICBjb25zdCBbcm91dGUsIGRlZmF1bHRzLCBkZWNvcmF0aW9uc10gPSBlbmRwb2ludDtcbiAgICBjb25zdCBbbWV0aG9kLCB1cmxdID0gcm91dGUuc3BsaXQoLyAvKTtcbiAgICBjb25zdCBlbmRwb2ludERlZmF1bHRzID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kLFxuICAgICAgICB1cmxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0c1xuICAgICk7XG4gICAgaWYgKCFlbmRwb2ludE1ldGhvZHNNYXAuaGFzKHNjb3BlKSkge1xuICAgICAgZW5kcG9pbnRNZXRob2RzTWFwLnNldChzY29wZSwgLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKSk7XG4gICAgfVxuICAgIGVuZHBvaW50TWV0aG9kc01hcC5nZXQoc2NvcGUpLnNldChtZXRob2ROYW1lLCB7XG4gICAgICBzY29wZSxcbiAgICAgIG1ldGhvZE5hbWUsXG4gICAgICBlbmRwb2ludERlZmF1bHRzLFxuICAgICAgZGVjb3JhdGlvbnNcbiAgICB9KTtcbiAgfVxufVxuY29uc3QgaGFuZGxlciA9IHtcbiAgaGFzKHsgc2NvcGUgfSwgbWV0aG9kTmFtZSkge1xuICAgIHJldHVybiBlbmRwb2ludE1ldGhvZHNNYXAuZ2V0KHNjb3BlKS5oYXMobWV0aG9kTmFtZSk7XG4gIH0sXG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG1ldGhvZE5hbWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6IHRoaXMuZ2V0KHRhcmdldCwgbWV0aG9kTmFtZSksXG4gICAgICAvLyBlbnN1cmVzIG1ldGhvZCBpcyBpbiB0aGUgY2FjaGVcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH07XG4gIH0sXG4gIGRlZmluZVByb3BlcnR5KHRhcmdldCwgbWV0aG9kTmFtZSwgZGVzY3JpcHRvcikge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQuY2FjaGUsIG1ldGhvZE5hbWUsIGRlc2NyaXB0b3IpO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBkZWxldGVQcm9wZXJ0eSh0YXJnZXQsIG1ldGhvZE5hbWUpIHtcbiAgICBkZWxldGUgdGFyZ2V0LmNhY2hlW21ldGhvZE5hbWVdO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBvd25LZXlzKHsgc2NvcGUgfSkge1xuICAgIHJldHVybiBbLi4uZW5kcG9pbnRNZXRob2RzTWFwLmdldChzY29wZSkua2V5cygpXTtcbiAgfSxcbiAgc2V0KHRhcmdldCwgbWV0aG9kTmFtZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gdGFyZ2V0LmNhY2hlW21ldGhvZE5hbWVdID0gdmFsdWU7XG4gIH0sXG4gIGdldCh7IG9jdG9raXQsIHNjb3BlLCBjYWNoZSB9LCBtZXRob2ROYW1lKSB7XG4gICAgaWYgKGNhY2hlW21ldGhvZE5hbWVdKSB7XG4gICAgICByZXR1cm4gY2FjaGVbbWV0aG9kTmFtZV07XG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9IGVuZHBvaW50TWV0aG9kc01hcC5nZXQoc2NvcGUpLmdldChtZXRob2ROYW1lKTtcbiAgICBpZiAoIW1ldGhvZCkge1xuICAgICAgcmV0dXJuIHZvaWQgMDtcbiAgICB9XG4gICAgY29uc3QgeyBlbmRwb2ludERlZmF1bHRzLCBkZWNvcmF0aW9ucyB9ID0gbWV0aG9kO1xuICAgIGlmIChkZWNvcmF0aW9ucykge1xuICAgICAgY2FjaGVbbWV0aG9kTmFtZV0gPSBkZWNvcmF0ZShcbiAgICAgICAgb2N0b2tpdCxcbiAgICAgICAgc2NvcGUsXG4gICAgICAgIG1ldGhvZE5hbWUsXG4gICAgICAgIGVuZHBvaW50RGVmYXVsdHMsXG4gICAgICAgIGRlY29yYXRpb25zXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWNoZVttZXRob2ROYW1lXSA9IG9jdG9raXQucmVxdWVzdC5kZWZhdWx0cyhlbmRwb2ludERlZmF1bHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIGNhY2hlW21ldGhvZE5hbWVdO1xuICB9XG59O1xuZnVuY3Rpb24gZW5kcG9pbnRzVG9NZXRob2RzKG9jdG9raXQpIHtcbiAgY29uc3QgbmV3TWV0aG9kcyA9IHt9O1xuICBmb3IgKGNvbnN0IHNjb3BlIG9mIGVuZHBvaW50TWV0aG9kc01hcC5rZXlzKCkpIHtcbiAgICBuZXdNZXRob2RzW3Njb3BlXSA9IG5ldyBQcm94eSh7IG9jdG9raXQsIHNjb3BlLCBjYWNoZToge30gfSwgaGFuZGxlcik7XG4gIH1cbiAgcmV0dXJuIG5ld01ldGhvZHM7XG59XG5mdW5jdGlvbiBkZWNvcmF0ZShvY3Rva2l0LCBzY29wZSwgbWV0aG9kTmFtZSwgZGVmYXVsdHMsIGRlY29yYXRpb25zKSB7XG4gIGNvbnN0IHJlcXVlc3RXaXRoRGVmYXVsdHMgPSBvY3Rva2l0LnJlcXVlc3QuZGVmYXVsdHMoZGVmYXVsdHMpO1xuICBmdW5jdGlvbiB3aXRoRGVjb3JhdGlvbnMoLi4uYXJncykge1xuICAgIGxldCBvcHRpb25zID0gcmVxdWVzdFdpdGhEZWZhdWx0cy5lbmRwb2ludC5tZXJnZSguLi5hcmdzKTtcbiAgICBpZiAoZGVjb3JhdGlvbnMubWFwVG9EYXRhKSB7XG4gICAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge1xuICAgICAgICBkYXRhOiBvcHRpb25zW2RlY29yYXRpb25zLm1hcFRvRGF0YV0sXG4gICAgICAgIFtkZWNvcmF0aW9ucy5tYXBUb0RhdGFdOiB2b2lkIDBcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlcXVlc3RXaXRoRGVmYXVsdHMob3B0aW9ucyk7XG4gICAgfVxuICAgIGlmIChkZWNvcmF0aW9ucy5yZW5hbWVkKSB7XG4gICAgICBjb25zdCBbbmV3U2NvcGUsIG5ld01ldGhvZE5hbWVdID0gZGVjb3JhdGlvbnMucmVuYW1lZDtcbiAgICAgIG9jdG9raXQubG9nLndhcm4oXG4gICAgICAgIGBvY3Rva2l0LiR7c2NvcGV9LiR7bWV0aG9kTmFtZX0oKSBoYXMgYmVlbiByZW5hbWVkIHRvIG9jdG9raXQuJHtuZXdTY29wZX0uJHtuZXdNZXRob2ROYW1lfSgpYFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKGRlY29yYXRpb25zLmRlcHJlY2F0ZWQpIHtcbiAgICAgIG9jdG9raXQubG9nLndhcm4oZGVjb3JhdGlvbnMuZGVwcmVjYXRlZCk7XG4gICAgfVxuICAgIGlmIChkZWNvcmF0aW9ucy5yZW5hbWVkUGFyYW1ldGVycykge1xuICAgICAgY29uc3Qgb3B0aW9uczIgPSByZXF1ZXN0V2l0aERlZmF1bHRzLmVuZHBvaW50Lm1lcmdlKC4uLmFyZ3MpO1xuICAgICAgZm9yIChjb25zdCBbbmFtZSwgYWxpYXNdIG9mIE9iamVjdC5lbnRyaWVzKFxuICAgICAgICBkZWNvcmF0aW9ucy5yZW5hbWVkUGFyYW1ldGVyc1xuICAgICAgKSkge1xuICAgICAgICBpZiAobmFtZSBpbiBvcHRpb25zMikge1xuICAgICAgICAgIG9jdG9raXQubG9nLndhcm4oXG4gICAgICAgICAgICBgXCIke25hbWV9XCIgcGFyYW1ldGVyIGlzIGRlcHJlY2F0ZWQgZm9yIFwib2N0b2tpdC4ke3Njb3BlfS4ke21ldGhvZE5hbWV9KClcIi4gVXNlIFwiJHthbGlhc31cIiBpbnN0ZWFkYFxuICAgICAgICAgICk7XG4gICAgICAgICAgaWYgKCEoYWxpYXMgaW4gb3B0aW9uczIpKSB7XG4gICAgICAgICAgICBvcHRpb25zMlthbGlhc10gPSBvcHRpb25zMltuYW1lXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIG9wdGlvbnMyW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVxdWVzdFdpdGhEZWZhdWx0cyhvcHRpb25zMik7XG4gICAgfVxuICAgIHJldHVybiByZXF1ZXN0V2l0aERlZmF1bHRzKC4uLmFyZ3MpO1xuICB9XG4gIHJldHVybiBPYmplY3QuYXNzaWduKHdpdGhEZWNvcmF0aW9ucywgcmVxdWVzdFdpdGhEZWZhdWx0cyk7XG59XG5leHBvcnQge1xuICBlbmRwb2ludHNUb01ldGhvZHNcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lbmRwb2ludHMtdG8tbWV0aG9kcy5qcy5tYXBcbiIsCiAgICAiaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb24uanNcIjtcbmltcG9ydCB7IGVuZHBvaW50c1RvTWV0aG9kcyB9IGZyb20gXCIuL2VuZHBvaW50cy10by1tZXRob2RzLmpzXCI7XG5mdW5jdGlvbiByZXN0RW5kcG9pbnRNZXRob2RzKG9jdG9raXQpIHtcbiAgY29uc3QgYXBpID0gZW5kcG9pbnRzVG9NZXRob2RzKG9jdG9raXQpO1xuICByZXR1cm4ge1xuICAgIHJlc3Q6IGFwaVxuICB9O1xufVxucmVzdEVuZHBvaW50TWV0aG9kcy5WRVJTSU9OID0gVkVSU0lPTjtcbmZ1bmN0aW9uIGxlZ2FjeVJlc3RFbmRwb2ludE1ldGhvZHMob2N0b2tpdCkge1xuICBjb25zdCBhcGkgPSBlbmRwb2ludHNUb01ldGhvZHMob2N0b2tpdCk7XG4gIHJldHVybiB7XG4gICAgLi4uYXBpLFxuICAgIHJlc3Q6IGFwaVxuICB9O1xufVxubGVnYWN5UmVzdEVuZHBvaW50TWV0aG9kcy5WRVJTSU9OID0gVkVSU0lPTjtcbmV4cG9ydCB7XG4gIGxlZ2FjeVJlc3RFbmRwb2ludE1ldGhvZHMsXG4gIHJlc3RFbmRwb2ludE1ldGhvZHNcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXBcbiIsCiAgICAiY29uc3QgVkVSU0lPTiA9IFwiMjEuMS4xXCI7XG5leHBvcnQge1xuICBWRVJTSU9OXG59O1xuIiwKICAgICJpbXBvcnQgeyBPY3Rva2l0IGFzIENvcmUgfSBmcm9tIFwiQG9jdG9raXQvY29yZVwiO1xuaW1wb3J0IHsgcmVxdWVzdExvZyB9IGZyb20gXCJAb2N0b2tpdC9wbHVnaW4tcmVxdWVzdC1sb2dcIjtcbmltcG9ydCB7XG4gIHBhZ2luYXRlUmVzdFxufSBmcm9tIFwiQG9jdG9raXQvcGx1Z2luLXBhZ2luYXRlLXJlc3RcIjtcbmltcG9ydCB7IGxlZ2FjeVJlc3RFbmRwb2ludE1ldGhvZHMgfSBmcm9tIFwiQG9jdG9raXQvcGx1Z2luLXJlc3QtZW5kcG9pbnQtbWV0aG9kc1wiO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb24uanNcIjtcbmNvbnN0IE9jdG9raXQgPSBDb3JlLnBsdWdpbihyZXF1ZXN0TG9nLCBsZWdhY3lSZXN0RW5kcG9pbnRNZXRob2RzLCBwYWdpbmF0ZVJlc3QpLmRlZmF1bHRzKFxuICB7XG4gICAgdXNlckFnZW50OiBgb2N0b2tpdC1yZXN0LmpzLyR7VkVSU0lPTn1gXG4gIH1cbik7XG5leHBvcnQge1xuICBPY3Rva2l0XG59O1xuIiwKICAgICJpbXBvcnQgeyBPY3Rva2l0IH0gZnJvbSBcIkBvY3Rva2l0L3Jlc3RcIjtcbmltcG9ydCB0eXBlIHsgUHVibGlzaGVyU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgY2xhc3MgR2l0SHViU2VydmljZSB7XG4gIHByaXZhdGUgb2N0b2tpdDogT2N0b2tpdDtcbiAgcHJpdmF0ZSBzZXR0aW5nczogUHVibGlzaGVyU2V0dGluZ3M7XG5cbiAgY29uc3RydWN0b3Ioc2V0dGluZ3M6IFB1Ymxpc2hlclNldHRpbmdzKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgIHRoaXMub2N0b2tpdCA9IG5ldyBPY3Rva2l0KHtcbiAgICAgIGF1dGg6IHNldHRpbmdzLmdpdGh1YlRva2VuLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHRoYXQgdGhlIEdpdEh1YiBjb25uZWN0aW9uIGFuZCByZXBvc2l0b3J5IGFjY2VzcyB3b3Jrc1xuICAgKi9cbiAgYXN5bmMgdmFsaWRhdGVDb25uZWN0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLm9jdG9raXQucmVwb3MuZ2V0KHtcbiAgICAgICAgb3duZXI6IHRoaXMuc2V0dGluZ3MucmVwb093bmVyLFxuICAgICAgICByZXBvOiB0aGlzLnNldHRpbmdzLnJlcG9OYW1lLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgRmFpbGVkIHRvIGFjY2VzcyByZXBvc2l0b3J5OiAke2Vycm9yLm1lc3NhZ2V9LiBDaGVjayB5b3VyIHRva2VuIGFuZCByZXBvc2l0b3J5IHNldHRpbmdzLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBTSEEgb2YgYW4gZXhpc3RpbmcgZmlsZSAobmVlZGVkIGZvciB1cGRhdGVzKVxuICAgKiBSZXR1cm5zIG51bGwgaWYgZmlsZSBkb2Vzbid0IGV4aXN0XG4gICAqL1xuICBhc3luYyBnZXRGaWxlU2hhKHBhdGg6IHN0cmluZywgYnJhbmNoPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhcmFtczoge1xuICAgICAgICBvd25lcjogc3RyaW5nO1xuICAgICAgICByZXBvOiBzdHJpbmc7XG4gICAgICAgIHBhdGg6IHN0cmluZztcbiAgICAgICAgcmVmPzogc3RyaW5nO1xuICAgICAgfSA9IHtcbiAgICAgICAgb3duZXI6IHRoaXMuc2V0dGluZ3MucmVwb093bmVyLFxuICAgICAgICByZXBvOiB0aGlzLnNldHRpbmdzLnJlcG9OYW1lLFxuICAgICAgICBwYXRoLFxuICAgICAgfTtcblxuICAgICAgaWYgKGJyYW5jaCkge1xuICAgICAgICBwYXJhbXMucmVmID0gYnJhbmNoO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMub2N0b2tpdC5yZXBvcy5nZXRDb250ZW50KHBhcmFtcyk7XG5cbiAgICAgIC8vIEdpdEh1YiBBUEkgcmV0dXJucyBhbiBhcnJheSBmb3IgZGlyZWN0b3JpZXMsIG9iamVjdCBmb3IgZmlsZXNcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlc3BvbnNlLmRhdGEpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gXCJzaGFcIiBpbiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5zaGEgOiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyA0MDQgbWVhbnMgZmlsZSBkb2Vzbid0IGV4aXN0LCB3aGljaCBpcyBmaW5lXG4gICAgICBpZiAoZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiICYmIFwic3RhdHVzXCIgaW4gZXJyb3IgJiYgZXJyb3Iuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIG9yIHVwZGF0ZSBhIGZpbGUgaW4gdGhlIHJlcG9zaXRvcnlcbiAgICovXG4gIGFzeW5jIGNyZWF0ZU9yVXBkYXRlRmlsZShcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgY29udGVudDogc3RyaW5nLFxuICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBicmFuY2g/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgZXhpc3RpbmdTaGEgPSBhd2FpdCB0aGlzLmdldEZpbGVTaGEocGF0aCwgYnJhbmNoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJhbXM6IHtcbiAgICAgICAgb3duZXI6IHN0cmluZztcbiAgICAgICAgcmVwbzogc3RyaW5nO1xuICAgICAgICBwYXRoOiBzdHJpbmc7XG4gICAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgY29udGVudDogc3RyaW5nO1xuICAgICAgICBzaGE/OiBzdHJpbmc7XG4gICAgICAgIGJyYW5jaD86IHN0cmluZztcbiAgICAgIH0gPSB7XG4gICAgICAgIG93bmVyOiB0aGlzLnNldHRpbmdzLnJlcG9Pd25lcixcbiAgICAgICAgcmVwbzogdGhpcy5zZXR0aW5ncy5yZXBvTmFtZSxcbiAgICAgICAgcGF0aCxcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgY29udGVudDogdGhpcy5zdHJpbmdUb0Jhc2U2NChjb250ZW50KSxcbiAgICAgICAgc2hhOiBleGlzdGluZ1NoYSB8fCB1bmRlZmluZWQsXG4gICAgICB9O1xuXG4gICAgICBpZiAoYnJhbmNoKSB7XG4gICAgICAgIHBhcmFtcy5icmFuY2ggPSBicmFuY2g7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5vY3Rva2l0LnJlcG9zLmNyZWF0ZU9yVXBkYXRlRmlsZUNvbnRlbnRzKHBhcmFtcyk7XG5cbiAgICAgIC8vIFJldHVybiB0aGUgSFRNTCBVUkwgdG8gdGhlIGZpbGVcbiAgICAgIHJldHVybiByZXNwb25zZS5kYXRhLmNvbnRlbnQ/Lmh0bWxfdXJsIHx8IFwiXCI7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHVwbG9hZCBmaWxlICR7cGF0aH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGxvYWQgYW4gaW1hZ2UgZmlsZSB0byB0aGUgcmVwb3NpdG9yeVxuICAgKi9cbiAgYXN5bmMgdXBsb2FkSW1hZ2UoZmlsZW5hbWU6IHN0cmluZywgY29udGVudDogQXJyYXlCdWZmZXIsIGJyYW5jaD86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcGF0aCA9IGAke3RoaXMuc2V0dGluZ3MuaW1hZ2VEaXJ9LyR7ZmlsZW5hbWV9YDtcbiAgICBjb25zdCBiYXNlNjRDb250ZW50ID0gdGhpcy5hcnJheUJ1ZmZlclRvQmFzZTY0KGNvbnRlbnQpO1xuICAgIGNvbnN0IGV4aXN0aW5nU2hhID0gYXdhaXQgdGhpcy5nZXRGaWxlU2hhKHBhdGgsIGJyYW5jaCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyYW1zOiB7XG4gICAgICAgIG93bmVyOiBzdHJpbmc7XG4gICAgICAgIHJlcG86IHN0cmluZztcbiAgICAgICAgcGF0aDogc3RyaW5nO1xuICAgICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICAgICAgc2hhPzogc3RyaW5nO1xuICAgICAgICBicmFuY2g/OiBzdHJpbmc7XG4gICAgICB9ID0ge1xuICAgICAgICBvd25lcjogdGhpcy5zZXR0aW5ncy5yZXBvT3duZXIsXG4gICAgICAgIHJlcG86IHRoaXMuc2V0dGluZ3MucmVwb05hbWUsXG4gICAgICAgIHBhdGgsXG4gICAgICAgIG1lc3NhZ2U6IGBVcGxvYWQgaW1hZ2U6ICR7ZmlsZW5hbWV9YCxcbiAgICAgICAgY29udGVudDogYmFzZTY0Q29udGVudCxcbiAgICAgICAgc2hhOiBleGlzdGluZ1NoYSB8fCB1bmRlZmluZWQsXG4gICAgICB9O1xuXG4gICAgICBpZiAoYnJhbmNoKSB7XG4gICAgICAgIHBhcmFtcy5icmFuY2ggPSBicmFuY2g7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5vY3Rva2l0LnJlcG9zLmNyZWF0ZU9yVXBkYXRlRmlsZUNvbnRlbnRzKHBhcmFtcyk7XG5cbiAgICAgIHJldHVybiByZXNwb25zZS5kYXRhLmNvbnRlbnQ/Lmh0bWxfdXJsIHx8IFwiXCI7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHVwbG9hZCBpbWFnZSAke2ZpbGVuYW1lfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgc3RyaW5nIHRvIGJhc2U2NCAoY3Jvc3MtcGxhdGZvcm0pXG4gICAqL1xuICBwcml2YXRlIHN0cmluZ1RvQmFzZTY0KHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICAgY29uc3QgYnl0ZXMgPSBlbmNvZGVyLmVuY29kZShzdHIpO1xuICAgIGxldCBiaW5hcnkgPSBcIlwiO1xuICAgIGZvciAoY29uc3QgYnl0ZSBvZiBieXRlcykge1xuICAgICAgYmluYXJ5ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZSk7XG4gICAgfVxuICAgIHJldHVybiBidG9hKGJpbmFyeSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBBcnJheUJ1ZmZlciB0byBiYXNlNjQgc3RyaW5nXG4gICAqL1xuICBwcml2YXRlIGFycmF5QnVmZmVyVG9CYXNlNjQoYnVmZmVyOiBBcnJheUJ1ZmZlcik6IHN0cmluZyB7XG4gICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgIGxldCBiaW5hcnkgPSBcIlwiO1xuICAgIGZvciAoY29uc3QgYnl0ZSBvZiBieXRlcykge1xuICAgICAgYmluYXJ5ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZSk7XG4gICAgfVxuICAgIHJldHVybiBidG9hKGJpbmFyeSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBmdWxsIHJlcG9zaXRvcnkgVVJMXG4gICAqL1xuICBnZXRSZXBvVXJsKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBodHRwczovL2dpdGh1Yi5jb20vJHt0aGlzLnNldHRpbmdzLnJlcG9Pd25lcn0vJHt0aGlzLnNldHRpbmdzLnJlcG9OYW1lfWA7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXRlc3QgY29tbWl0IFNIQSBmb3IgYSBicmFuY2hcbiAgICovXG4gIGFzeW5jIGdldEJyYW5jaFNoYShicmFuY2g6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5vY3Rva2l0LnJlc3QuZ2l0LmdldFJlZih7XG4gICAgICAgIG93bmVyOiB0aGlzLnNldHRpbmdzLnJlcG9Pd25lcixcbiAgICAgICAgcmVwbzogdGhpcy5zZXR0aW5ncy5yZXBvTmFtZSxcbiAgICAgICAgcmVmOiBgaGVhZHMvJHticmFuY2h9YCxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGEub2JqZWN0LnNoYTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZ2V0IFNIQSBmb3IgYnJhbmNoICR7YnJhbmNofTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBicmFuY2ggZnJvbSBhIGJhc2UgYnJhbmNoXG4gICAqIFJldHVybnMgdGhlIGJyYW5jaCBuYW1lXG4gICAqL1xuICBhc3luYyBjcmVhdGVCcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nLCBiYXNlQnJhbmNoID0gXCJtYWluXCIpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBHZXQgdGhlIFNIQSBvZiB0aGUgYmFzZSBicmFuY2hcbiAgICAgIGNvbnN0IGJhc2VTaGEgPSBhd2FpdCB0aGlzLmdldEJyYW5jaFNoYShiYXNlQnJhbmNoKTtcblxuICAgICAgLy8gQ3JlYXRlIG5ldyByZWZlcmVuY2VcbiAgICAgIGF3YWl0IHRoaXMub2N0b2tpdC5yZXN0LmdpdC5jcmVhdGVSZWYoe1xuICAgICAgICBvd25lcjogdGhpcy5zZXR0aW5ncy5yZXBvT3duZXIsXG4gICAgICAgIHJlcG86IHRoaXMuc2V0dGluZ3MucmVwb05hbWUsXG4gICAgICAgIHJlZjogYHJlZnMvaGVhZHMvJHticmFuY2hOYW1lfWAsXG4gICAgICAgIHNoYTogYmFzZVNoYSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gYnJhbmNoTmFtZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIGJyYW5jaCAke2JyYW5jaE5hbWV9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgcHVsbCByZXF1ZXN0XG4gICAqIFJldHVybnMgdGhlIFBSIFVSTCBhbmQgUFIgbnVtYmVyXG4gICAqL1xuICBhc3luYyBjcmVhdGVQdWxsUmVxdWVzdChcbiAgICBoZWFkOiBzdHJpbmcsXG4gICAgYmFzZTogc3RyaW5nLFxuICAgIHRpdGxlOiBzdHJpbmcsXG4gICAgYm9keTogc3RyaW5nLFxuICAgIGxhYmVscz86IHN0cmluZ1tdLFxuICApOiBQcm9taXNlPHsgdXJsOiBzdHJpbmc7IG51bWJlcjogbnVtYmVyIH0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm9jdG9raXQucmVzdC5wdWxscy5jcmVhdGUoe1xuICAgICAgICBvd25lcjogdGhpcy5zZXR0aW5ncy5yZXBvT3duZXIsXG4gICAgICAgIHJlcG86IHRoaXMuc2V0dGluZ3MucmVwb05hbWUsXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBoZWFkLFxuICAgICAgICBiYXNlLFxuICAgICAgICBib2R5LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBsYWJlbHMgaWYgcHJvdmlkZWRcbiAgICAgIGlmIChsYWJlbHMgJiYgbGFiZWxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYXdhaXQgdGhpcy5vY3Rva2l0LnJlc3QuaXNzdWVzLmFkZExhYmVscyh7XG4gICAgICAgICAgb3duZXI6IHRoaXMuc2V0dGluZ3MucmVwb093bmVyLFxuICAgICAgICAgIHJlcG86IHRoaXMuc2V0dGluZ3MucmVwb05hbWUsXG4gICAgICAgICAgaXNzdWVfbnVtYmVyOiByZXNwb25zZS5kYXRhLm51bWJlcixcbiAgICAgICAgICBsYWJlbHMsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB1cmw6IHJlc3BvbnNlLmRhdGEuaHRtbF91cmwsXG4gICAgICAgIG51bWJlcjogcmVzcG9uc2UuZGF0YS5udW1iZXIsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgcHVsbCByZXF1ZXN0OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB1bmlxdWUgYnJhbmNoIG5hbWUgZm9yIHB1Ymxpc2hpbmdcbiAgICovXG4gIGdlbmVyYXRlQnJhbmNoTmFtZShwcmVmaXggPSBcInB1Ymxpc2hcIik6IHN0cmluZyB7XG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnJlcGxhY2UoL1s6Ll0vZywgXCItXCIpLnNsaWNlKDAsIC01KTtcbiAgICByZXR1cm4gYCR7cHJlZml4fS8ke3RpbWVzdGFtcH1gO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGJyYW5jaCB3aXRoIHJldHJ5IGxvZ2ljIGZvciBuYW1lIGNvbGxpc2lvbnNcbiAgICovXG4gIGFzeW5jIGNyZWF0ZUJyYW5jaFdpdGhSZXRyeShcbiAgICBiYXNlUHJlZml4OiBzdHJpbmcsXG4gICAgYmFzZUJyYW5jaCA9IFwibWFpblwiLFxuICAgIG1heFJldHJpZXMgPSAzLFxuICApOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4UmV0cmllczsgaSsrKSB7XG4gICAgICBjb25zdCBzdWZmaXggPSBpID4gMCA/IGAtJHtpfWAgOiBcIlwiO1xuICAgICAgY29uc3QgYnJhbmNoTmFtZSA9IHRoaXMuZ2VuZXJhdGVCcmFuY2hOYW1lKGJhc2VQcmVmaXgpICsgc3VmZml4O1xuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUJyYW5jaChicmFuY2hOYW1lLCBiYXNlQnJhbmNoKTtcbiAgICAgICAgcmV0dXJuIGJyYW5jaE5hbWU7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBDaGVjayBpZiBlcnJvciBpcyA0MjIgKGJyYW5jaCBhbHJlYWR5IGV4aXN0cylcbiAgICAgICAgaWYgKGVycm9yICYmIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJiBcInN0YXR1c1wiIGluIGVycm9yICYmIGVycm9yLnN0YXR1cyA9PT0gNDIyKSB7XG4gICAgICAgICAgLy8gQnJhbmNoIGFscmVhZHkgZXhpc3RzLCB0cnkgYWdhaW4gd2l0aCBzdWZmaXhcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZS10aHJvdyBpZiBpdCdzIGEgZGlmZmVyZW50IGVycm9yXG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBicmFuY2ggYWZ0ZXIgJHttYXhSZXRyaWVzfSBhdHRlbXB0c2ApO1xuICB9XG59XG4iLAogICAgImltcG9ydCB7IHR5cGUgQXBwLCBOb3RpY2UsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IEdpdEh1YlNlcnZpY2UgfSBmcm9tIFwiLi9naXRodWItc2VydmljZVwiO1xuaW1wb3J0IHR5cGUgT2JzaWRpYW5QdWJsaXNoZXIgZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgY2xhc3MgUHVibGlzaGVyU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE9ic2lkaWFuUHVibGlzaGVyO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE9ic2lkaWFuUHVibGlzaGVyKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJPYnNpZGlhbiBQdWJsaXNoZXIgU2V0dGluZ3NcIiB9KTtcblxuICAgIC8vIEdpdEh1YiBUb2tlblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJHaXRIdWIgUGVyc29uYWwgQWNjZXNzIFRva2VuXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgXCJDcmVhdGUgYSB0b2tlbiBhdCBnaXRodWIuY29tL3NldHRpbmdzL3Rva2VucyB3aXRoICdyZXBvJyBzY29wZS4gVG9rZW4gaXMgc3RvcmVkIHNlY3VyZWx5LlwiLFxuICAgICAgKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJnaHBfeHh4eHh4eHh4eHh4XCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmdpdGh1YlRva2VuKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdpdGh1YlRva2VuID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5pbnB1dEVsLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJwYXNzd29yZFwiKSxcbiAgICAgICk7XG5cbiAgICAvLyBSZXBvc2l0b3J5IE93bmVyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlcG9zaXRvcnkgT3duZXJcIilcbiAgICAgIC5zZXREZXNjKFwiR2l0SHViIHVzZXJuYW1lIG9yIG9yZ2FuaXphdGlvbiBuYW1lXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcInVzZXJuYW1lXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlcG9Pd25lcilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZXBvT3duZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBSZXBvc2l0b3J5IE5hbWVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUmVwb3NpdG9yeSBOYW1lXCIpXG4gICAgICAuc2V0RGVzYyhcIk5hbWUgb2YgdGhlIEh1Z28gcmVwb3NpdG9yeVwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJteS1ibG9nXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlcG9OYW1lKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnJlcG9OYW1lID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgLy8gQ29udGVudCBEaXJlY3RvcnlcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQ29udGVudCBEaXJlY3RvcnlcIilcbiAgICAgIC5zZXREZXNjKFwiUGF0aCB0byBIdWdvIGNvbnRlbnQgZGlyZWN0b3J5IChlLmcuLCAnY29udGVudC9wb3N0cycpXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImNvbnRlbnQvcG9zdHNcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGVudERpcilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250ZW50RGlyID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgLy8gSW1hZ2UgRGlyZWN0b3J5XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkltYWdlIERpcmVjdG9yeVwiKVxuICAgICAgLnNldERlc2MoXCJQYXRoIHRvIEh1Z28gc3RhdGljIGltYWdlcyBkaXJlY3RvcnkgKGUuZy4sICdzdGF0aWMvaW1hZ2VzJylcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwic3RhdGljL2ltYWdlc1wiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbWFnZURpcilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbWFnZURpciA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIFVzZSBQdWxsIFJlcXVlc3RzXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlVzZSBQdWxsIFJlcXVlc3RzXCIpXG4gICAgICAuc2V0RGVzYyhcIkNyZWF0ZSBwdWxsIHJlcXVlc3RzIGluc3RlYWQgb2YgY29tbWl0dGluZyBkaXJlY3RseSB0byB0aGUgYmFzZSBicmFuY2hcIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVzZVB1bGxSZXF1ZXN0cykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudXNlUHVsbFJlcXVlc3RzID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIEJhc2UgQnJhbmNoXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkJhc2UgQnJhbmNoXCIpXG4gICAgICAuc2V0RGVzYyhcIkJyYW5jaCB0byBjcmVhdGUgcHVsbCByZXF1ZXN0cyBhZ2FpbnN0IChlLmcuLCAnbWFpbicsICdtYXN0ZXInKVwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJtYWluXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmJhc2VCcmFuY2gpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYmFzZUJyYW5jaCA9IHZhbHVlLnRyaW0oKSB8fCBcIm1haW5cIjtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIFB1bGwgUmVxdWVzdCBMYWJlbHNcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUHVsbCBSZXF1ZXN0IExhYmVsc1wiKVxuICAgICAgLnNldERlc2MoXCJDb21tYS1zZXBhcmF0ZWQgbGFiZWxzIHRvIGFkZCB0byBwdWxsIHJlcXVlc3RzXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcInB1Ymxpc2hlZC1mcm9tLW9ic2lkaWFuXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnByTGFiZWxzLmpvaW4oXCIsIFwiKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wckxhYmVscyA9IHZhbHVlXG4gICAgICAgICAgICAgIC5zcGxpdChcIixcIilcbiAgICAgICAgICAgICAgLm1hcCgobCkgPT4gbC50cmltKCkpXG4gICAgICAgICAgICAgIC5maWx0ZXIoKGwpID0+IGwubGVuZ3RoID4gMCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBSZW1vdmUgUHVibGlzaCBGbGFnXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlbW92ZSAncHVibGlzaCcgZmllbGRcIilcbiAgICAgIC5zZXREZXNjKFwiUmVtb3ZlICdwdWJsaXNoOiB0cnVlJyBmcm9tIGZyb250bWF0dGVyIHdoZW4gcHVibGlzaGluZ1wiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVtb3ZlUHVibGlzaEZsYWcpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbW92ZVB1Ymxpc2hGbGFnID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIEZyb250bWF0dGVyIFRlbXBsYXRlXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiQWRkaXRpb25hbCBGcm9udG1hdHRlclwiIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICB0ZXh0OiBcIkFkZCBjdXN0b20gZnJvbnRtYXR0ZXIgZmllbGRzIChvbmUgcGVyIGxpbmUsIGZvcm1hdDoga2V5OiB2YWx1ZSlcIixcbiAgICAgIGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIixcbiAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5hZGRUZXh0QXJlYSgodGV4dCkgPT4ge1xuICAgICAgdGV4dFxuICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJhdXRob3I6IFlvdXIgTmFtZVxcbmNhdGVnb3JpZXM6IFtibG9nXVxcbnRhZ3M6IFtvYnNpZGlhbl1cIilcbiAgICAgICAgLnNldFZhbHVlKHRoaXMuc2VyaWFsaXplRnJvbnRtYXR0ZXIodGhpcy5wbHVnaW4uc2V0dGluZ3MuZnJvbnRtYXR0ZXJUZW1wbGF0ZSkpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mcm9udG1hdHRlclRlbXBsYXRlID0gdGhpcy5wYXJzZUZyb250bWF0dGVyKHZhbHVlKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSk7XG4gICAgICB0ZXh0LmlucHV0RWwucm93cyA9IDY7XG4gICAgICB0ZXh0LmlucHV0RWwuY29scyA9IDUwO1xuICAgIH0pO1xuXG4gICAgLy8gVGVzdCBDb25uZWN0aW9uIEJ1dHRvblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJUZXN0IEdpdEh1YiBDb25uZWN0aW9uXCIpXG4gICAgICAuc2V0RGVzYyhcIlZlcmlmeSB0aGF0IHlvdXIgR2l0SHViIGNyZWRlbnRpYWxzIGFuZCByZXBvc2l0b3J5IGFyZSB2YWxpZFwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxuICAgICAgICBidXR0b24uc2V0QnV0dG9uVGV4dChcIlRlc3QgQ29ubmVjdGlvblwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnRlc3RDb25uZWN0aW9uKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgc2VyaWFsaXplRnJvbnRtYXR0ZXIodGVtcGxhdGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBzdHJpbmcge1xuICAgIHJldHVybiBPYmplY3QuZW50cmllcyh0ZW1wbGF0ZSlcbiAgICAgIC5tYXAoKFtrZXksIHZhbHVlXSkgPT4gYCR7a2V5fTogJHt2YWx1ZX1gKVxuICAgICAgLmpvaW4oXCJcXG5cIik7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlRnJvbnRtYXR0ZXIodGV4dDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgY29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpO1xuXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XG4gICAgICBpZiAoIXRyaW1tZWQpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjb2xvbkluZGV4ID0gdHJpbW1lZC5pbmRleE9mKFwiOlwiKTtcbiAgICAgIGlmIChjb2xvbkluZGV4ID09PSAtMSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGtleSA9IHRyaW1tZWQuc2xpY2UoMCwgY29sb25JbmRleCkudHJpbSgpO1xuICAgICAgY29uc3QgdmFsdWUgPSB0cmltbWVkLnNsaWNlKGNvbG9uSW5kZXggKyAxKS50cmltKCk7XG5cbiAgICAgIGlmIChrZXkgJiYgdmFsdWUpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBzZXR0aW5ncyA9IHRoaXMucGx1Z2luLnNldHRpbmdzO1xuXG4gICAgLy8gVmFsaWRhdGUgc2V0dGluZ3NcbiAgICBpZiAoIXNldHRpbmdzLmdpdGh1YlRva2VuKSB7XG4gICAgICBuZXcgTm90aWNlKFwiR2l0SHViIHRva2VuIGlzIHJlcXVpcmVkXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghc2V0dGluZ3MucmVwb093bmVyIHx8ICFzZXR0aW5ncy5yZXBvTmFtZSkge1xuICAgICAgbmV3IE5vdGljZShcIlJlcG9zaXRvcnkgb3duZXIgYW5kIG5hbWUgYXJlIHJlcXVpcmVkXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBuZXcgTm90aWNlKFwiVGVzdGluZyBHaXRIdWIgY29ubmVjdGlvbi4uLlwiKTtcbiAgICAgIGNvbnN0IGdpdGh1YiA9IG5ldyBHaXRIdWJTZXJ2aWNlKHNldHRpbmdzKTtcbiAgICAgIGF3YWl0IGdpdGh1Yi52YWxpZGF0ZUNvbm5lY3Rpb24oKTtcbiAgICAgIG5ldyBOb3RpY2UoXCLinJMgQ29ubmVjdGlvbiBzdWNjZXNzZnVsISBSZXBvc2l0b3J5IGlzIGFjY2Vzc2libGUuXCIpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlVua25vd24gZXJyb3JcIjtcbiAgICAgIG5ldyBOb3RpY2UoYOKclyBDb25uZWN0aW9uIGZhaWxlZDogJHttZXNzYWdlfWApO1xuICAgICAgY29uc29sZS5lcnJvcihcIkdpdEh1YiBjb25uZWN0aW9uIHRlc3QgZmFpbGVkOlwiLCBlcnJvcik7XG4gICAgfVxuICB9XG59XG4iLAogICAgIi8qKlxuICogUGx1Z2luIHNldHRpbmdzIGludGVyZmFjZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFB1Ymxpc2hlclNldHRpbmdzIHtcbiAgLyoqIEdpdEh1YiBwZXJzb25hbCBhY2Nlc3MgdG9rZW4gKi9cbiAgZ2l0aHViVG9rZW46IHN0cmluZztcbiAgLyoqIFJlcG9zaXRvcnkgb3duZXIgKHVzZXJuYW1lIG9yIG9yZ2FuaXphdGlvbikgKi9cbiAgcmVwb093bmVyOiBzdHJpbmc7XG4gIC8qKiBSZXBvc2l0b3J5IG5hbWUgKi9cbiAgcmVwb05hbWU6IHN0cmluZztcbiAgLyoqIENvbnRlbnQgZGlyZWN0b3J5IHBhdGggaW4gdGhlIEh1Z28gcmVwb3NpdG9yeSAoZS5nLiwgXCJjb250ZW50L3Bvc3RzXCIpICovXG4gIGNvbnRlbnREaXI6IHN0cmluZztcbiAgLyoqIEltYWdlIGRpcmVjdG9yeSBwYXRoIGluIHRoZSBIdWdvIHJlcG9zaXRvcnkgKGUuZy4sIFwic3RhdGljL2ltYWdlc1wiKSAqL1xuICBpbWFnZURpcjogc3RyaW5nO1xuICAvKiogQWRkaXRpb25hbCBmcm9udG1hdHRlciBmaWVsZHMgdG8gaW5qZWN0IGR1cmluZyBwdWJsaXNoaW5nICovXG4gIGZyb250bWF0dGVyVGVtcGxhdGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKiBXaGV0aGVyIHRvIHJlbW92ZSB0aGUgcHVibGlzaDogdHJ1ZSBmaWVsZCBmcm9tIGZyb250bWF0dGVyICovXG4gIHJlbW92ZVB1Ymxpc2hGbGFnOiBib29sZWFuO1xuICAvKiogQmFzZSBicmFuY2ggdG8gY3JlYXRlIFBScyBhZ2FpbnN0IChkZWZhdWx0OiBcIm1haW5cIikgKi9cbiAgYmFzZUJyYW5jaDogc3RyaW5nO1xuICAvKiogTGFiZWxzIHRvIGFwcGx5IHRvIHB1bGwgcmVxdWVzdHMgKi9cbiAgcHJMYWJlbHM6IHN0cmluZ1tdO1xuICAvKiogV2hldGhlciB0byB1c2UgYnJhbmNoL1BSIHdvcmtmbG93ICh2cyBkaXJlY3QgY29tbWl0KSAqL1xuICB1c2VQdWxsUmVxdWVzdHM6IGJvb2xlYW47XG59XG5cbi8qKlxuICogRGVmYXVsdCBzZXR0aW5ncyB2YWx1ZXNcbiAqL1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFB1Ymxpc2hlclNldHRpbmdzID0ge1xuICBnaXRodWJUb2tlbjogXCJcIixcbiAgcmVwb093bmVyOiBcIlwiLFxuICByZXBvTmFtZTogXCJcIixcbiAgY29udGVudERpcjogXCJjb250ZW50L3Bvc3RzXCIsXG4gIGltYWdlRGlyOiBcInN0YXRpYy9pbWFnZXNcIixcbiAgZnJvbnRtYXR0ZXJUZW1wbGF0ZToge30sXG4gIHJlbW92ZVB1Ymxpc2hGbGFnOiBmYWxzZSxcbiAgYmFzZUJyYW5jaDogXCJtYWluXCIsXG4gIHByTGFiZWxzOiBbXCJwdWJsaXNoZWQtZnJvbS1vYnNpZGlhblwiXSxcbiAgdXNlUHVsbFJlcXVlc3RzOiB0cnVlLFxufTtcblxuLyoqXG4gKiBQcm9jZXNzZWQgY29udGVudCByZXN1bHRcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9jZXNzZWRDb250ZW50IHtcbiAgLyoqIFByb2Nlc3NlZCBtYXJrZG93biBjb250ZW50ICovXG4gIGNvbnRlbnQ6IHN0cmluZztcbiAgLyoqIFNhbml0aXplZCBmaWxlbmFtZSAqL1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICAvKiogTGlzdCBvZiBpbWFnZSByZWZlcmVuY2VzIGZvdW5kIGluIHRoZSBjb250ZW50ICovXG4gIGltYWdlczogc3RyaW5nW107XG4gIC8qKiBQcm9jZXNzZWQgZnJvbnRtYXR0ZXIgKi9cbiAgZnJvbnRtYXR0ZXI6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG4vKipcbiAqIFB1Ymxpc2hpbmcgcmVzdWx0IGZvciBhIHNpbmdsZSBub3RlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHVibGlzaFJlc3VsdCB7XG4gIC8qKiBPcmlnaW5hbCBmaWxlIHBhdGggKi9cbiAgZmlsZVBhdGg6IHN0cmluZztcbiAgLyoqIFdoZXRoZXIgdGhlIHB1Ymxpc2ggd2FzIHN1Y2Nlc3NmdWwgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIEVycm9yIG1lc3NhZ2UgaWYgZmFpbGVkICovXG4gIGVycm9yPzogc3RyaW5nO1xuICAvKiogVVJMIHRvIHRoZSBwdWJsaXNoZWQgZmlsZSBvbiBHaXRIdWIgKi9cbiAgdXJsPzogc3RyaW5nO1xuICAvKiogVVJMIHRvIHRoZSBwdWxsIHJlcXVlc3QgaWYgY3JlYXRlZCAqL1xuICBwclVybD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBCYXRjaCBwdWJsaXNoaW5nIHN1bW1hcnlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYXRjaFB1Ymxpc2hSZXN1bHQge1xuICAvKiogVG90YWwgbnVtYmVyIG9mIG5vdGVzIGF0dGVtcHRlZCAqL1xuICB0b3RhbDogbnVtYmVyO1xuICAvKiogTnVtYmVyIG9mIHN1Y2Nlc3NmdWwgcHVibGlzaGVzICovXG4gIHN1Y2Nlc3NmdWw6IG51bWJlcjtcbiAgLyoqIE51bWJlciBvZiBmYWlsZWQgcHVibGlzaGVzICovXG4gIGZhaWxlZDogbnVtYmVyO1xuICAvKiogSW5kaXZpZHVhbCByZXN1bHRzICovXG4gIHJlc3VsdHM6IFB1Ymxpc2hSZXN1bHRbXTtcbiAgLyoqIFVSTCB0byB0aGUgcHVsbCByZXF1ZXN0IGlmIGNyZWF0ZWQgKi9cbiAgcHJVcmw/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogR2l0SHViIGZpbGUgcmVzcG9uc2VcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBHaXRIdWJGaWxlIHtcbiAgLyoqIEZpbGUgU0hBIGZvciB1cGRhdGVzICovXG4gIHNoYTogc3RyaW5nO1xuICAvKiogRmlsZSBjb250ZW50IChiYXNlNjQgZW5jb2RlZCkgKi9cbiAgY29udGVudDogc3RyaW5nO1xuICAvKiogRG93bmxvYWQgVVJMICovXG4gIGRvd25sb2FkX3VybDogc3RyaW5nO1xufVxuIgogIF0sCiAgIm1hcHBpbmdzIjog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LENBQUMsb0NBQW9DO0FBQUEsSUFDL0QsMEJBQTBCO0FBQUEsTUFDeEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsVUFBVTtBQUFBLElBQ1IsaUJBQWlCO0FBQUEsTUFDZjtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsWUFBWTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSw0QkFBNEI7QUFBQSxNQUMxQjtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTjtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsWUFBWTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSDtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLFdBQVc7QUFBQSxNQUNUO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxzQkFBc0I7QUFBQSxNQUNwQjtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsV0FBVztBQUFBLE1BQ1Q7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLG1CQUFtQjtBQUFBLE1BQ2pCO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxhQUFhO0FBQUEsTUFDWDtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsWUFBWTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWE7QUFBQSxNQUNYO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxhQUFhO0FBQUEsTUFDWDtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxRQUNFLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsVUFBVTtBQUFBLE1BQ1I7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDRSxZQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxJQUNBLFlB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QixJQUFJLHdCQUFPLDRCQUE0QjtBQUFBLFVBQ3ZDO0FBQUEsUUFDRjtBQUFBLFFBRUEsTUFBTSxVQUFVLHdCQUF3QixPQUFPLHlCQUF5QixPQUFPLHdCQUF3QixPQUFPO0FBQUEsUUFDOUcsSUFBSSx3QkFBTyxPQUFPO0FBQUE7QUFBQSxNQUlwQixJQUFJLE9BQU8sU0FBUyxHQUFHO0FBQUEsUUFDckIsUUFBUSxJQUFJLG1CQUFtQjtBQUFBLFFBQy9CLFdBQVcsS0FBSyxPQUFPLFNBQVM7QUFBQSxVQUM5QixJQUFJLENBQUMsRUFBRSxTQUFTO0FBQUEsWUFDZCxRQUFRLElBQUksS0FBSyxFQUFFLGFBQWEsRUFBRSxPQUFPO0FBQUEsVUFDM0M7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BR0EsSUFBSSxPQUFPLGFBQWEsR0FBRztBQUFBLFFBQ3pCLFFBQVEsSUFBSSx1QkFBdUI7QUFBQSxRQUNuQyxXQUFXLEtBQUssT0FBTyxTQUFTO0FBQUEsVUFDOUIsSUFBSSxFQUFFLFNBQVM7QUFBQSxZQUNiLFFBQVEsSUFBSSxLQUFLLEVBQUUsYUFBYSxFQUFFLE9BQU8sVUFBVTtBQUFBLFVBQ3JEO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLE9BQU8sT0FBTztBQUFBLE1BQ2QsTUFBTSxVQUFVLGlCQUFpQixRQUFRLE1BQU0sVUFBVTtBQUFBLE1BQ3pELElBQUksd0JBQU8sWUFBVyxTQUFTO0FBQUEsTUFDL0IsUUFBUSxNQUFNLHdCQUF3QixLQUFLO0FBQUE7QUFBQTtBQUdqRDsiLAogICJkZWJ1Z0lkIjogIkE2OTk0Qzg3RDhFNkNENDk2NDc1NkUyMTY0NzU2RTIxIiwKICAibmFtZXMiOiBbXQp9
