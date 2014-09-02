(function (root, factory) {
   alert("ASd");
    if (typeof define === 'function' && define.amd) {
        // AMD.
        //define(['jquery', 'lodash'], factory);
        define(factory);
    } else {
        // Browser globals
        //root.MP = factory(root.$, root._);
        root.MP = factory();
    }
    //}(this, function ($, _) {
}(this, function () {

    /**
     * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
     * Available via the MIT or new BSD license.
     * see: http://github.com/jrburke/almond for details
     */
    //Going sloppy to avoid 'use strict' string cost, but strict practices should
    //be followed.
    /*jslint sloppy: true */
    /*global setTimeout: false */

    var requirejs, require, define;
    (function (undef) {
        var main, req, makeMap, handlers,
            defined = {},
            waiting = {},
            config = {},
            defining = {},
            hasOwn = Object.prototype.hasOwnProperty,
            aps = [].slice;

        function hasProp(obj, prop) {
            return hasOwn.call(obj, prop);
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @returns {String} normalized name
         */
        function normalize(name, baseName) {
            var nameParts, nameSegment, mapValue, foundMap,
                foundI, foundStarMap, starI, i, j, part,
                baseParts = baseName && baseName.split("/"),
                map = config.map,
                starMap = (map && map['*']) || {};

            //Adjust any relative paths.
            if (name && name.charAt(0) === ".") {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that "directory" and not name of the baseName's
                    //module. For instance, baseName of "one/two/three", maps to
                    //"one/two/three.js", but we want the directory, "one/two" for
                    //this normalization.
                    baseParts = baseParts.slice(0, baseParts.length - 1);

                    name = baseParts.concat(name.split("/"));

                    //start trimDots
                    for (i = 0; i < name.length; i += 1) {
                        part = name[i];
                        if (part === ".") {
                            name.splice(i, 1);
                            i -= 1;
                        } else if (part === "..") {
                            if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                                //End of the line. Keep at least one non-dot
                                //path segment at the front so it can be mapped
                                //correctly to disk. Otherwise, there is likely
                                //no path mapping for a path starting with '..'.
                                //This can still fail, but catches the most reasonable
                                //uses of ..
                                break;
                            } else if (i > 0) {
                                name.splice(i - 1, 2);
                                i -= 2;
                            }
                        }
                    }
                    //end trimDots

                    name = name.join("/");
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if ((baseParts || starMap) && map) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join("/");

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = map[baseParts.slice(0, j).join('/')];

                            //baseName segment has  config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = mapValue[nameSegment];
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && starMap[nameSegment]) {
                        foundStarMap = starMap[nameSegment];
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function makeRequire(relName, forceSync) {
            return function () {
                //A version of a require function that passes a moduleName
                //value for items that may need to
                //look up paths relative to the moduleName
                return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
            };
        }

        function makeNormalize(relName) {
            return function (name) {
                return normalize(name, relName);
            };
        }

        function makeLoad(depName) {
            return function (value) {
                defined[depName] = value;
            };
        }

        function callDep(name) {
            if (hasProp(waiting, name)) {
                var args = waiting[name];
                delete waiting[name];
                defining[name] = true;
                main.apply(undef, args);
            }

            if (!hasProp(defined, name) && !hasProp(defining, name)) {
                throw new Error('No ' + name);
            }
            return defined[name];
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Makes a name map, normalizing the name, and using a plugin
         * for normalization if necessary. Grabs a ref to plugin
         * too, as an optimization.
         */
        makeMap = function (name, relName) {
            var plugin,
                parts = splitPrefix(name),
                prefix = parts[0];

            name = parts[1];

            if (prefix) {
                prefix = normalize(prefix, relName);
                plugin = callDep(prefix);
            }

            //Normalize according
            if (prefix) {
                if (plugin && plugin.normalize) {
                    name = plugin.normalize(name, makeNormalize(relName));
                } else {
                    name = normalize(name, relName);
                }
            } else {
                name = normalize(name, relName);
                parts = splitPrefix(name);
                prefix = parts[0];
                name = parts[1];
                if (prefix) {
                    plugin = callDep(prefix);
                }
            }

            //Using ridiculous property names for space reasons
            return {
                f: prefix ? prefix + '!' + name : name, //fullName
                n: name,
                pr: prefix,
                p: plugin
            };
        };

        function makeConfig(name) {
            return function () {
                return (config && config.config && config.config[name]) || {};
            };
        }

        handlers = {
            require: function (name) {
                return makeRequire(name);
            },
            exports: function (name) {
                var e = defined[name];
                if (typeof e !== 'undefined') {
                    return e;
                } else {
                    return (defined[name] = {});
                }
            },
            module: function (name) {
                return {
                    id: name,
                    uri: '',
                    exports: defined[name],
                    config: makeConfig(name)
                };
            }
        };

        main = function (name, deps, callback, relName) {
            var cjsModule, depName, ret, map, i,
                args = [],
                usingExports;

            //Use name if no relName
            relName = relName || name;

            //Call the callback to define the module, if necessary.
            if (typeof callback === 'function') {

                //Pull out the defined dependencies and pass the ordered
                //values to the callback.
                //Default to [require, exports, module] if no deps
                deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
                for (i = 0; i < deps.length; i += 1) {
                    map = makeMap(deps[i], relName);
                    depName = map.f;

                    //Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        args[i] = handlers.require(name);
                    } else if (depName === "exports") {
                        //CommonJS module spec 1.1
                        args[i] = handlers.exports(name);
                        usingExports = true;
                    } else if (depName === "module") {
                        //CommonJS module spec 1.1
                        cjsModule = args[i] = handlers.module(name);
                    } else if (hasProp(defined, depName) ||
                        hasProp(waiting, depName) ||
                        hasProp(defining, depName)) {
                        args[i] = callDep(depName);
                    } else if (map.p) {
                        map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                        args[i] = defined[depName];
                    } else {
                        throw new Error(name + ' missing ' + depName);
                    }
                }

                ret = callback.apply(defined[name], args);

                if (name) {
                    //If setting exports via "module" is in play,
                    //favor that over return value and exports. After that,
                    //favor a non-undefined return value over exports use.
                    if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                        defined[name] = cjsModule.exports;
                    } else if (ret !== undef || !usingExports) {
                        //Use the return value from the function.
                        defined[name] = ret;
                    }
                }
            } else if (name) {
                //May just be an object definition for the module. Only
                //worry about defining if have a module name.
                defined[name] = callback;
            }
        };

        requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
            if (typeof deps === "string") {
                if (handlers[deps]) {
                    //callback in this case is really relName
                    return handlers[deps](callback);
                }
                //Just return the module wanted. In this scenario, the
                //deps arg is the module name, and second arg (if passed)
                //is just the relName.
                //Normalize module name, if it contains . or ..
                return callDep(makeMap(deps, callback).f);
            } else if (!deps.splice) {
                //deps is a config object, not an array.
                config = deps;
                if (callback.splice) {
                    //callback is an array, which means it is a dependency list.
                    //Adjust args if there are dependencies
                    deps = callback;
                    callback = relName;
                    relName = null;
                } else {
                    deps = undef;
                }
            }

            //Support require(['a'])
            callback = callback || function () {};

            //If relName is a function, it is an errback handler,
            //so remove it.
            if (typeof relName === 'function') {
                relName = forceSync;
                forceSync = alt;
            }

            //Simulate async callback;
            if (forceSync) {
                main(undef, deps, callback, relName);
            } else {
                //Using a non-zero value because of concern for what old browsers
                //do, and latest browsers "upgrade" to 4 if lower value is used:
                //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
                //If want a value immediately, use require('id') instead -- something
                //that works in almond on the global level, but not guaranteed and
                //unlikely to work in other AMD implementations.
                setTimeout(function () {
                    main(undef, deps, callback, relName);
                }, 4);
            }

            return req;
        };

        /**
         * Just drops the config on the floor, but returns req in case
         * the config return value is used.
         */
        req.config = function (cfg) {
            config = cfg;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            return req;
        };

        define = function (name, deps, callback) {

            //This module may not have dependencies
            if (!deps.splice) {
                //deps is not an array, so probably means
                //an object literal or factory function for
                //the value. Adjust args.
                callback = deps;
                deps = [];
            }

            if (!hasProp(defined, name) && !hasProp(waiting, name)) {
                waiting[name] = [name, deps, callback];
            }
        };

        define.amd = {
            jQuery: true
        };
    }());

    define("../vendor/almond", function () {});

    requirejs.config({
        config: {
            mp: {
                features: [
                    'intmp',
                    'comscore',
                    'agegate',
                    'ads',
                    'vast',
                    'playpause',
                    'progress',
                    'current',
                    'duration',
                    'volume',
                    'googleanalytics',
                    'qualityselector',
                    'sharing',
                    'playlist',
                    'playwire',
                    'fullscreen',
                    'cuepoints',
                    'related',
                    'customization'
                ]
            },
            player: {
                profile: 'full'
            }
        }
    });

    define("mp-full", function () {});

    /*! jQuery v2.0.2 | (c) 2005, 2013 jQuery Foundation, Inc. | jquery.org/license
//@ sourceMappingURL=jquery-2.0.2.min.map
*/
    (function (e, undefined) {
        var t, n, r = typeof undefined,
            i = e.location,
            o = e.document,
            s = o.documentElement,
            a = e.jQuery,
            u = e.$,
            l = {},
            c = [],
            p = "2.0.2",
            f = c.concat,
            h = c.push,
            d = c.slice,
            g = c.indexOf,
            m = l.toString,
            y = l.hasOwnProperty,
            v = p.trim,
            x = function (e, n) {
                return new x.fn.init(e, n, t)
            },
            b = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,
            w = /\S+/g,
            T = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,
            C = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
            k = /^-ms-/,
            N = /-([\da-z])/gi,
            E = function (e, t) {
                return t.toUpperCase()
            },
            S = function () {
                o.removeEventListener("DOMContentLoaded", S, !1), e.removeEventListener("load", S, !1), x.ready()
            };
        x.fn = x.prototype = {
            jquery: p,
            constructor: x,
            init: function (e, t, n) {
                var r, i;
                if (!e) return this;
                if ("string" == typeof e) {
                    if (r = "<" === e.charAt(0) && ">" === e.charAt(e.length - 1) && e.length >= 3 ? [null, e, null] : T.exec(e), !r || !r[1] && t) return !t || t.jquery ? (t || n).find(e) : this.constructor(t).find(e);
                    if (r[1]) {
                        if (t = t instanceof x ? t[0] : t, x.merge(this, x.parseHTML(r[1], t && t.nodeType ? t.ownerDocument || t : o, !0)), C.test(r[1]) && x.isPlainObject(t))
                            for (r in t) x.isFunction(this[r]) ? this[r](t[r]) : this.attr(r, t[r]);
                        return this
                    }
                    return i = o.getElementById(r[2]), i && i.parentNode && (this.length = 1, this[0] = i), this.context = o, this.selector = e, this
                }
                return e.nodeType ? (this.context = this[0] = e, this.length = 1, this) : x.isFunction(e) ? n.ready(e) : (e.selector !== undefined && (this.selector = e.selector, this.context = e.context), x.makeArray(e, this))
            },
            selector: "",
            length: 0,
            toArray: function () {
                return d.call(this)
            },
            get: function (e) {
                return null == e ? this.toArray() : 0 > e ? this[this.length + e] : this[e]
            },
            pushStack: function (e) {
                var t = x.merge(this.constructor(), e);
                return t.prevObject = this, t.context = this.context, t
            },
            each: function (e, t) {
                return x.each(this, e, t)
            },
            ready: function (e) {
                return x.ready.promise().done(e), this
            },
            slice: function () {
                return this.pushStack(d.apply(this, arguments))
            },
            first: function () {
                return this.eq(0)
            },
            last: function () {
                return this.eq(-1)
            },
            eq: function (e) {
                var t = this.length,
                    n = +e + (0 > e ? t : 0);
                return this.pushStack(n >= 0 && t > n ? [this[n]] : [])
            },
            map: function (e) {
                return this.pushStack(x.map(this, function (t, n) {
                    return e.call(t, n, t)
                }))
            },
            end: function () {
                return this.prevObject || this.constructor(null)
            },
            push: h,
            sort: [].sort,
            splice: [].splice
        }, x.fn.init.prototype = x.fn, x.extend = x.fn.extend = function () {
            var e, t, n, r, i, o, s = arguments[0] || {},
                a = 1,
                u = arguments.length,
                l = !1;
            for ("boolean" == typeof s && (l = s, s = arguments[1] || {}, a = 2), "object" == typeof s || x.isFunction(s) || (s = {}), u === a && (s = this, --a); u > a; a++)
                if (null != (e = arguments[a]))
                    for (t in e) n = s[t], r = e[t], s !== r && (l && r && (x.isPlainObject(r) || (i = x.isArray(r))) ? (i ? (i = !1, o = n && x.isArray(n) ? n : []) : o = n && x.isPlainObject(n) ? n : {}, s[t] = x.extend(l, o, r)) : r !== undefined && (s[t] = r));
            return s
        }, x.extend({
            expando: "jQuery" + (p + Math.random()).replace(/\D/g, ""),
            noConflict: function (t) {
                return e.$ === x && (e.$ = u), t && e.jQuery === x && (e.jQuery = a), x
            },
            isReady: !1,
            readyWait: 1,
            holdReady: function (e) {
                e ? x.readyWait++ : x.ready(!0)
            },
            ready: function (e) {
                (e === !0 ? --x.readyWait : x.isReady) || (x.isReady = !0, e !== !0 && --x.readyWait > 0 || (n.resolveWith(o, [x]), x.fn.trigger && x(o).trigger("ready").off("ready")))
            },
            isFunction: function (e) {
                return "function" === x.type(e)
            },
            isArray: Array.isArray,
            isWindow: function (e) {
                return null != e && e === e.window
            },
            isNumeric: function (e) {
                return !isNaN(parseFloat(e)) && isFinite(e)
            },
            type: function (e) {
                return null == e ? e + "" : "object" == typeof e || "function" == typeof e ? l[m.call(e)] || "object" : typeof e
            },
            isPlainObject: function (e) {
                if ("object" !== x.type(e) || e.nodeType || x.isWindow(e)) return !1;
                try {
                    if (e.constructor && !y.call(e.constructor.prototype, "isPrototypeOf")) return !1
                } catch (t) {
                    return !1
                }
                return !0
            },
            isEmptyObject: function (e) {
                var t;
                for (t in e) return !1;
                return !0
            },
            error: function (e) {
                throw Error(e)
            },
            parseHTML: function (e, t, n) {
                if (!e || "string" != typeof e) return null;
                "boolean" == typeof t && (n = t, t = !1), t = t || o;
                var r = C.exec(e),
                    i = !n && [];
                return r ? [t.createElement(r[1])] : (r = x.buildFragment([e], t, i), i && x(i).remove(), x.merge([], r.childNodes))
            },
            parseJSON: JSON.parse,
            parseXML: function (e) {
                var t, n;
                if (!e || "string" != typeof e) return null;
                try {
                    n = new DOMParser, t = n.parseFromString(e, "text/xml")
                } catch (r) {
                    t = undefined
                }
                return (!t || t.getElementsByTagName("parsererror").length) && x.error("Invalid XML: " + e), t
            },
            noop: function () {},
            globalEval: function (e) {
                var t, n = eval;
                e = x.trim(e), e && (1 === e.indexOf("use strict") ? (t = o.createElement("script"), t.text = e, o.head.appendChild(t).parentNode.removeChild(t)) : n(e))
            },
            camelCase: function (e) {
                return e.replace(k, "ms-").replace(N, E)
            },
            nodeName: function (e, t) {
                return e.nodeName && e.nodeName.toLowerCase() === t.toLowerCase()
            },
            each: function (e, t, n) {
                var r, i = 0,
                    o = e.length,
                    s = j(e);
                if (n) {
                    if (s) {
                        for (; o > i; i++)
                            if (r = t.apply(e[i], n), r === !1) break
                    } else
                        for (i in e)
                            if (r = t.apply(e[i], n), r === !1) break
                } else if (s) {
                    for (; o > i; i++)
                        if (r = t.call(e[i], i, e[i]), r === !1) break
                } else
                    for (i in e)
                        if (r = t.call(e[i], i, e[i]), r === !1) break; return e
            },
            trim: function (e) {
                return null == e ? "" : v.call(e)
            },
            makeArray: function (e, t) {
                var n = t || [];
                return null != e && (j(Object(e)) ? x.merge(n, "string" == typeof e ? [e] : e) : h.call(n, e)), n
            },
            inArray: function (e, t, n) {
                return null == t ? -1 : g.call(t, e, n)
            },
            merge: function (e, t) {
                var n = t.length,
                    r = e.length,
                    i = 0;
                if ("number" == typeof n)
                    for (; n > i; i++) e[r++] = t[i];
                else
                    while (t[i] !== undefined) e[r++] = t[i++];
                return e.length = r, e
            },
            grep: function (e, t, n) {
                var r, i = [],
                    o = 0,
                    s = e.length;
                for (n = !!n; s > o; o++) r = !!t(e[o], o), n !== r && i.push(e[o]);
                return i
            },
            map: function (e, t, n) {
                var r, i = 0,
                    o = e.length,
                    s = j(e),
                    a = [];
                if (s)
                    for (; o > i; i++) r = t(e[i], i, n), null != r && (a[a.length] = r);
                else
                    for (i in e) r = t(e[i], i, n), null != r && (a[a.length] = r);
                return f.apply([], a)
            },
            guid: 1,
            proxy: function (e, t) {
                var n, r, i;
                return "string" == typeof t && (n = e[t], t = e, e = n), x.isFunction(e) ? (r = d.call(arguments, 2), i = function () {
                    return e.apply(t || this, r.concat(d.call(arguments)))
                }, i.guid = e.guid = e.guid || x.guid++, i) : undefined
            },
            access: function (e, t, n, r, i, o, s) {
                var a = 0,
                    u = e.length,
                    l = null == n;
                if ("object" === x.type(n)) {
                    i = !0;
                    for (a in n) x.access(e, t, a, n[a], !0, o, s)
                } else if (r !== undefined && (i = !0, x.isFunction(r) || (s = !0), l && (s ? (t.call(e, r), t = null) : (l = t, t = function (e, t, n) {
                    return l.call(x(e), n)
                })), t))
                    for (; u > a; a++) t(e[a], n, s ? r : r.call(e[a], a, t(e[a], n)));
                return i ? e : l ? t.call(e) : u ? t(e[0], n) : o
            },
            now: Date.now,
            swap: function (e, t, n, r) {
                var i, o, s = {};
                for (o in t) s[o] = e.style[o], e.style[o] = t[o];
                i = n.apply(e, r || []);
                for (o in t) e.style[o] = s[o];
                return i
            }
        }), x.ready.promise = function (t) {
            return n || (n = x.Deferred(), "complete" === o.readyState ? setTimeout(x.ready) : (o.addEventListener("DOMContentLoaded", S, !1), e.addEventListener("load", S, !1))), n.promise(t)
        }, x.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function (e, t) {
            l["[object " + t + "]"] = t.toLowerCase()
        });

        function j(e) {
            var t = e.length,
                n = x.type(e);
            return x.isWindow(e) ? !1 : 1 === e.nodeType && t ? !0 : "array" === n || "function" !== n && (0 === t || "number" == typeof t && t > 0 && t - 1 in e)
        }
        t = x(o),
            function (e, undefined) {
                var t, n, r, i, o, s, a, u, l, c, p, f, h, d, g, m, y, v = "sizzle" + -new Date,
                    b = e.document,
                    w = 0,
                    T = 0,
                    C = at(),
                    k = at(),
                    N = at(),
                    E = !1,
                    S = function () {
                        return 0
                    },
                    j = typeof undefined,
                    D = 1 << 31,
                    A = {}.hasOwnProperty,
                    L = [],
                    H = L.pop,
                    q = L.push,
                    O = L.push,
                    F = L.slice,
                    P = L.indexOf || function (e) {
                        var t = 0,
                            n = this.length;
                        for (; n > t; t++)
                            if (this[t] === e) return t;
                        return -1
                    },
                    R = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
                    M = "[\\x20\\t\\r\\n\\f]",
                    W = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",
                    $ = W.replace("w", "w#"),
                    B = "\\[" + M + "*(" + W + ")" + M + "*(?:([*^$|!~]?=)" + M + "*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|(" + $ + ")|)|)" + M + "*\\]",
                    I = ":(" + W + ")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|" + B.replace(3, 8) + ")*)|.*)\\)|)",
                    z = RegExp("^" + M + "+|((?:^|[^\\\\])(?:\\\\.)*)" + M + "+$", "g"),
                    _ = RegExp("^" + M + "*," + M + "*"),
                    X = RegExp("^" + M + "*([>+~]|" + M + ")" + M + "*"),
                    U = RegExp(M + "*[+~]"),
                    Y = RegExp("=" + M + "*([^\\]'\"]*)" + M + "*\\]", "g"),
                    V = RegExp(I),
                    G = RegExp("^" + $ + "$"),
                    J = {
                        ID: RegExp("^#(" + W + ")"),
                        CLASS: RegExp("^\\.(" + W + ")"),
                        TAG: RegExp("^(" + W.replace("w", "w*") + ")"),
                        ATTR: RegExp("^" + B),
                        PSEUDO: RegExp("^" + I),
                        CHILD: RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + M + "*(even|odd|(([+-]|)(\\d*)n|)" + M + "*(?:([+-]|)" + M + "*(\\d+)|))" + M + "*\\)|)", "i"),
                        bool: RegExp("^(?:" + R + ")$", "i"),
                        needsContext: RegExp("^" + M + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + M + "*((?:-\\d)?\\d*)" + M + "*\\)|)(?=[^-]|$)", "i")
                    },
                    Q = /^[^{]+\{\s*\[native \w/,
                    K = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
                    Z = /^(?:input|select|textarea|button)$/i,
                    et = /^h\d$/i,
                    tt = /'|\\/g,
                    nt = RegExp("\\\\([\\da-f]{1,6}" + M + "?|(" + M + ")|.)", "ig"),
                    rt = function (e, t, n) {
                        var r = "0x" + t - 65536;
                        return r !== r || n ? t : 0 > r ? String.fromCharCode(r + 65536) : String.fromCharCode(55296 | r >> 10, 56320 | 1023 & r)
                    };
                try {
                    O.apply(L = F.call(b.childNodes), b.childNodes), L[b.childNodes.length].nodeType
                } catch (it) {
                    O = {
                        apply: L.length ? function (e, t) {
                            q.apply(e, F.call(t))
                        } : function (e, t) {
                            var n = e.length,
                                r = 0;
                            while (e[n++] = t[r++]);
                            e.length = n - 1
                        }
                    }
                }

                function ot(e, t, r, i) {
                    var o, s, a, u, l, f, g, m, x, w;
                    if ((t ? t.ownerDocument || t : b) !== p && c(t), t = t || p, r = r || [], !e || "string" != typeof e) return r;
                    if (1 !== (u = t.nodeType) && 9 !== u) return [];
                    if (h && !i) {
                        if (o = K.exec(e))
                            if (a = o[1]) {
                                if (9 === u) {
                                    if (s = t.getElementById(a), !s || !s.parentNode) return r;
                                    if (s.id === a) return r.push(s), r
                                } else if (t.ownerDocument && (s = t.ownerDocument.getElementById(a)) && y(t, s) && s.id === a) return r.push(s), r
                            } else {
                                if (o[2]) return O.apply(r, t.getElementsByTagName(e)), r;
                                if ((a = o[3]) && n.getElementsByClassName && t.getElementsByClassName) return O.apply(r, t.getElementsByClassName(a)), r
                            }
                        if (n.qsa && (!d || !d.test(e))) {
                            if (m = g = v, x = t, w = 9 === u && e, 1 === u && "object" !== t.nodeName.toLowerCase()) {
                                f = vt(e), (g = t.getAttribute("id")) ? m = g.replace(tt, "\\$&") : t.setAttribute("id", m), m = "[id='" + m + "'] ", l = f.length;
                                while (l--) f[l] = m + xt(f[l]);
                                x = U.test(e) && t.parentNode || t, w = f.join(",")
                            }
                            if (w) try {
                                return O.apply(r, x.querySelectorAll(w)), r
                            } catch (T) {} finally {
                                g || t.removeAttribute("id")
                            }
                        }
                    }
                    return St(e.replace(z, "$1"), t, r, i)
                }

                function st(e) {
                    return Q.test(e + "")
                }

                function at() {
                    var e = [];

                    function t(n, r) {
                        return e.push(n += " ") > i.cacheLength && delete t[e.shift()], t[n] = r
                    }
                    return t
                }

                function ut(e) {
                    return e[v] = !0, e
                }

                function lt(e) {
                    var t = p.createElement("div");
                    try {
                        return !!e(t)
                    } catch (n) {
                        return !1
                    } finally {
                        t.parentNode && t.parentNode.removeChild(t), t = null
                    }
                }

                function ct(e, t, n) {
                    e = e.split("|");
                    var r, o = e.length,
                        s = n ? null : t;
                    while (o--)(r = i.attrHandle[e[o]]) && r !== t || (i.attrHandle[e[o]] = s)
                }

                function pt(e, t) {
                    var n = e.getAttributeNode(t);
                    return n && n.specified ? n.value : e[t] === !0 ? t.toLowerCase() : null
                }

                function ft(e, t) {
                    return e.getAttribute(t, "type" === t.toLowerCase() ? 1 : 2)
                }

                function ht(e) {
                    return "input" === e.nodeName.toLowerCase() ? e.defaultValue : undefined
                }

                function dt(e, t) {
                    var n = t && e,
                        r = n && 1 === e.nodeType && 1 === t.nodeType && (~t.sourceIndex || D) - (~e.sourceIndex || D);
                    if (r) return r;
                    if (n)
                        while (n = n.nextSibling)
                            if (n === t) return -1;
                    return e ? 1 : -1
                }

                function gt(e) {
                    return function (t) {
                        var n = t.nodeName.toLowerCase();
                        return "input" === n && t.type === e
                    }
                }

                function mt(e) {
                    return function (t) {
                        var n = t.nodeName.toLowerCase();
                        return ("input" === n || "button" === n) && t.type === e
                    }
                }

                function yt(e) {
                    return ut(function (t) {
                        return t = +t, ut(function (n, r) {
                            var i, o = e([], n.length, t),
                                s = o.length;
                            while (s--) n[i = o[s]] && (n[i] = !(r[i] = n[i]))
                        })
                    })
                }
                s = ot.isXML = function (e) {
                    var t = e && (e.ownerDocument || e).documentElement;
                    return t ? "HTML" !== t.nodeName : !1
                }, n = ot.support = {}, c = ot.setDocument = function (e) {
                    var t = e ? e.ownerDocument || e : b,
                        r = t.parentWindow;
                    return t !== p && 9 === t.nodeType && t.documentElement ? (p = t, f = t.documentElement, h = !s(t), r && r.frameElement && r.attachEvent("onbeforeunload", function () {
                        c()
                    }), n.attributes = lt(function (e) {
                        return e.innerHTML = "<a href='#'></a>", ct("type|href|height|width", ft, "#" === e.firstChild.getAttribute("href")), ct(R, pt, null == e.getAttribute("disabled")), e.className = "i", !e.getAttribute("className")
                    }), n.input = lt(function (e) {
                        return e.innerHTML = "<input>", e.firstChild.setAttribute("value", ""), "" === e.firstChild.getAttribute("value")
                    }), ct("value", ht, n.attributes && n.input), n.getElementsByTagName = lt(function (e) {
                        return e.appendChild(t.createComment("")), !e.getElementsByTagName("*").length
                    }), n.getElementsByClassName = lt(function (e) {
                        return e.innerHTML = "<div class='a'></div><div class='a i'></div>", e.firstChild.className = "i", 2 === e.getElementsByClassName("i").length
                    }), n.getById = lt(function (e) {
                        return f.appendChild(e).id = v, !t.getElementsByName || !t.getElementsByName(v).length
                    }), n.getById ? (i.find.ID = function (e, t) {
                        if (typeof t.getElementById !== j && h) {
                            var n = t.getElementById(e);
                            return n && n.parentNode ? [n] : []
                        }
                    }, i.filter.ID = function (e) {
                        var t = e.replace(nt, rt);
                        return function (e) {
                            return e.getAttribute("id") === t
                        }
                    }) : (delete i.find.ID, i.filter.ID = function (e) {
                        var t = e.replace(nt, rt);
                        return function (e) {
                            var n = typeof e.getAttributeNode !== j && e.getAttributeNode("id");
                            return n && n.value === t
                        }
                    }), i.find.TAG = n.getElementsByTagName ? function (e, t) {
                        return typeof t.getElementsByTagName !== j ? t.getElementsByTagName(e) : undefined
                    } : function (e, t) {
                        var n, r = [],
                            i = 0,
                            o = t.getElementsByTagName(e);
                        if ("*" === e) {
                            while (n = o[i++]) 1 === n.nodeType && r.push(n);
                            return r
                        }
                        return o
                    }, i.find.CLASS = n.getElementsByClassName && function (e, t) {
                        return typeof t.getElementsByClassName !== j && h ? t.getElementsByClassName(e) : undefined
                    }, g = [], d = [], (n.qsa = st(t.querySelectorAll)) && (lt(function (e) {
                        e.innerHTML = "<select><option selected=''></option></select>", e.querySelectorAll("[selected]").length || d.push("\\[" + M + "*(?:value|" + R + ")"), e.querySelectorAll(":checked").length || d.push(":checked")
                    }), lt(function (e) {
                        var n = t.createElement("input");
                        n.setAttribute("type", "hidden"), e.appendChild(n).setAttribute("t", ""), e.querySelectorAll("[t^='']").length && d.push("[*^$]=" + M + "*(?:''|\"\")"), e.querySelectorAll(":enabled").length || d.push(":enabled", ":disabled"), e.querySelectorAll("*,:x"), d.push(",.*:")
                    })), (n.matchesSelector = st(m = f.webkitMatchesSelector || f.mozMatchesSelector || f.oMatchesSelector || f.msMatchesSelector)) && lt(function (e) {
                        n.disconnectedMatch = m.call(e, "div"), m.call(e, "[s!='']:x"), g.push("!=", I)
                    }), d = d.length && RegExp(d.join("|")), g = g.length && RegExp(g.join("|")), y = st(f.contains) || f.compareDocumentPosition ? function (e, t) {
                        var n = 9 === e.nodeType ? e.documentElement : e,
                            r = t && t.parentNode;
                        return e === r || !(!r || 1 !== r.nodeType || !(n.contains ? n.contains(r) : e.compareDocumentPosition && 16 & e.compareDocumentPosition(r)))
                    } : function (e, t) {
                        if (t)
                            while (t = t.parentNode)
                                if (t === e) return !0;
                        return !1
                    }, n.sortDetached = lt(function (e) {
                        return 1 & e.compareDocumentPosition(t.createElement("div"))
                    }), S = f.compareDocumentPosition ? function (e, r) {
                        if (e === r) return E = !0, 0;
                        var i = r.compareDocumentPosition && e.compareDocumentPosition && e.compareDocumentPosition(r);
                        return i ? 1 & i || !n.sortDetached && r.compareDocumentPosition(e) === i ? e === t || y(b, e) ? -1 : r === t || y(b, r) ? 1 : l ? P.call(l, e) - P.call(l, r) : 0 : 4 & i ? -1 : 1 : e.compareDocumentPosition ? -1 : 1
                    } : function (e, n) {
                        var r, i = 0,
                            o = e.parentNode,
                            s = n.parentNode,
                            a = [e],
                            u = [n];
                        if (e === n) return E = !0, 0;
                        if (!o || !s) return e === t ? -1 : n === t ? 1 : o ? -1 : s ? 1 : l ? P.call(l, e) - P.call(l, n) : 0;
                        if (o === s) return dt(e, n);
                        r = e;
                        while (r = r.parentNode) a.unshift(r);
                        r = n;
                        while (r = r.parentNode) u.unshift(r);
                        while (a[i] === u[i]) i++;
                        return i ? dt(a[i], u[i]) : a[i] === b ? -1 : u[i] === b ? 1 : 0
                    }, t) : p
                }, ot.matches = function (e, t) {
                    return ot(e, null, null, t)
                }, ot.matchesSelector = function (e, t) {
                    if ((e.ownerDocument || e) !== p && c(e), t = t.replace(Y, "='$1']"), !(!n.matchesSelector || !h || g && g.test(t) || d && d.test(t))) try {
                        var r = m.call(e, t);
                        if (r || n.disconnectedMatch || e.document && 11 !== e.document.nodeType) return r
                    } catch (i) {}
                    return ot(t, p, null, [e]).length > 0
                }, ot.contains = function (e, t) {
                    return (e.ownerDocument || e) !== p && c(e), y(e, t)
                }, ot.attr = function (e, t) {
                    (e.ownerDocument || e) !== p && c(e);
                    var r = i.attrHandle[t.toLowerCase()],
                        o = r && A.call(i.attrHandle, t.toLowerCase()) ? r(e, t, !h) : undefined;
                    return o === undefined ? n.attributes || !h ? e.getAttribute(t) : (o = e.getAttributeNode(t)) && o.specified ? o.value : null : o
                }, ot.error = function (e) {
                    throw Error("Syntax error, unrecognized expression: " + e)
                }, ot.uniqueSort = function (e) {
                    var t, r = [],
                        i = 0,
                        o = 0;
                    if (E = !n.detectDuplicates, l = !n.sortStable && e.slice(0), e.sort(S), E) {
                        while (t = e[o++]) t === e[o] && (i = r.push(o));
                        while (i--) e.splice(r[i], 1)
                    }
                    return e
                }, o = ot.getText = function (e) {
                    var t, n = "",
                        r = 0,
                        i = e.nodeType;
                    if (i) {
                        if (1 === i || 9 === i || 11 === i) {
                            if ("string" == typeof e.textContent) return e.textContent;
                            for (e = e.firstChild; e; e = e.nextSibling) n += o(e)
                        } else if (3 === i || 4 === i) return e.nodeValue
                    } else
                        for (; t = e[r]; r++) n += o(t);
                    return n
                }, i = ot.selectors = {
                    cacheLength: 50,
                    createPseudo: ut,
                    match: J,
                    attrHandle: {},
                    find: {},
                    relative: {
                        ">": {
                            dir: "parentNode",
                            first: !0
                        },
                        " ": {
                            dir: "parentNode"
                        },
                        "+": {
                            dir: "previousSibling",
                            first: !0
                        },
                        "~": {
                            dir: "previousSibling"
                        }
                    },
                    preFilter: {
                        ATTR: function (e) {
                            return e[1] = e[1].replace(nt, rt), e[3] = (e[4] || e[5] || "").replace(nt, rt), "~=" === e[2] && (e[3] = " " + e[3] + " "), e.slice(0, 4)
                        },
                        CHILD: function (e) {
                            return e[1] = e[1].toLowerCase(), "nth" === e[1].slice(0, 3) ? (e[3] || ot.error(e[0]), e[4] = +(e[4] ? e[5] + (e[6] || 1) : 2 * ("even" === e[3] || "odd" === e[3])), e[5] = +(e[7] + e[8] || "odd" === e[3])) : e[3] && ot.error(e[0]), e
                        },
                        PSEUDO: function (e) {
                            var t, n = !e[5] && e[2];
                            return J.CHILD.test(e[0]) ? null : (e[3] && e[4] !== undefined ? e[2] = e[4] : n && V.test(n) && (t = vt(n, !0)) && (t = n.indexOf(")", n.length - t) - n.length) && (e[0] = e[0].slice(0, t), e[2] = n.slice(0, t)), e.slice(0, 3))
                        }
                    },
                    filter: {
                        TAG: function (e) {
                            var t = e.replace(nt, rt).toLowerCase();
                            return "*" === e ? function () {
                                return !0
                            } : function (e) {
                                return e.nodeName && e.nodeName.toLowerCase() === t
                            }
                        },
                        CLASS: function (e) {
                            var t = C[e + " "];
                            return t || (t = RegExp("(^|" + M + ")" + e + "(" + M + "|$)")) && C(e, function (e) {
                                return t.test("string" == typeof e.className && e.className || typeof e.getAttribute !== j && e.getAttribute("class") || "")
                            })
                        },
                        ATTR: function (e, t, n) {
                            return function (r) {
                                var i = ot.attr(r, e);
                                return null == i ? "!=" === t : t ? (i += "", "=" === t ? i === n : "!=" === t ? i !== n : "^=" === t ? n && 0 === i.indexOf(n) : "*=" === t ? n && i.indexOf(n) > -1 : "$=" === t ? n && i.slice(-n.length) === n : "~=" === t ? (" " + i + " ").indexOf(n) > -1 : "|=" === t ? i === n || i.slice(0, n.length + 1) === n + "-" : !1) : !0
                            }
                        },
                        CHILD: function (e, t, n, r, i) {
                            var o = "nth" !== e.slice(0, 3),
                                s = "last" !== e.slice(-4),
                                a = "of-type" === t;
                            return 1 === r && 0 === i ? function (e) {
                                return !!e.parentNode
                            } : function (t, n, u) {
                                var l, c, p, f, h, d, g = o !== s ? "nextSibling" : "previousSibling",
                                    m = t.parentNode,
                                    y = a && t.nodeName.toLowerCase(),
                                    x = !u && !a;
                                if (m) {
                                    if (o) {
                                        while (g) {
                                            p = t;
                                            while (p = p[g])
                                                if (a ? p.nodeName.toLowerCase() === y : 1 === p.nodeType) return !1;
                                            d = g = "only" === e && !d && "nextSibling"
                                        }
                                        return !0
                                    }
                                    if (d = [s ? m.firstChild : m.lastChild], s && x) {
                                        c = m[v] || (m[v] = {}), l = c[e] || [], h = l[0] === w && l[1], f = l[0] === w && l[2], p = h && m.childNodes[h];
                                        while (p = ++h && p && p[g] || (f = h = 0) || d.pop())
                                            if (1 === p.nodeType && ++f && p === t) {
                                                c[e] = [w, h, f];
                                                break
                                            }
                                    } else if (x && (l = (t[v] || (t[v] = {}))[e]) && l[0] === w) f = l[1];
                                    else
                                        while (p = ++h && p && p[g] || (f = h = 0) || d.pop())
                                            if ((a ? p.nodeName.toLowerCase() === y : 1 === p.nodeType) && ++f && (x && ((p[v] || (p[v] = {}))[e] = [w, f]), p === t)) break; return f -= i, f === r || 0 === f % r && f / r >= 0
                                }
                            }
                        },
                        PSEUDO: function (e, t) {
                            var n, r = i.pseudos[e] || i.setFilters[e.toLowerCase()] || ot.error("unsupported pseudo: " + e);
                            return r[v] ? r(t) : r.length > 1 ? (n = [e, e, "", t], i.setFilters.hasOwnProperty(e.toLowerCase()) ? ut(function (e, n) {
                                var i, o = r(e, t),
                                    s = o.length;
                                while (s--) i = P.call(e, o[s]), e[i] = !(n[i] = o[s])
                            }) : function (e) {
                                return r(e, 0, n)
                            }) : r
                        }
                    },
                    pseudos: {
                        not: ut(function (e) {
                            var t = [],
                                n = [],
                                r = a(e.replace(z, "$1"));
                            return r[v] ? ut(function (e, t, n, i) {
                                var o, s = r(e, null, i, []),
                                    a = e.length;
                                while (a--)(o = s[a]) && (e[a] = !(t[a] = o))
                            }) : function (e, i, o) {
                                return t[0] = e, r(t, null, o, n), !n.pop()
                            }
                        }),
                        has: ut(function (e) {
                            return function (t) {
                                return ot(e, t).length > 0
                            }
                        }),
                        contains: ut(function (e) {
                            return function (t) {
                                return (t.textContent || t.innerText || o(t)).indexOf(e) > -1
                            }
                        }),
                        lang: ut(function (e) {
                            return G.test(e || "") || ot.error("unsupported lang: " + e), e = e.replace(nt, rt).toLowerCase(),
                                function (t) {
                                    var n;
                                    do
                                        if (n = h ? t.lang : t.getAttribute("xml:lang") || t.getAttribute("lang")) return n = n.toLowerCase(), n === e || 0 === n.indexOf(e + "-");
                                    while ((t = t.parentNode) && 1 === t.nodeType);
                                    return !1
                                }
                        }),
                        target: function (t) {
                            var n = e.location && e.location.hash;
                            return n && n.slice(1) === t.id
                        },
                        root: function (e) {
                            return e === f
                        },
                        focus: function (e) {
                            return e === p.activeElement && (!p.hasFocus || p.hasFocus()) && !!(e.type || e.href || ~e.tabIndex)
                        },
                        enabled: function (e) {
                            return e.disabled === !1
                        },
                        disabled: function (e) {
                            return e.disabled === !0
                        },
                        checked: function (e) {
                            var t = e.nodeName.toLowerCase();
                            return "input" === t && !!e.checked || "option" === t && !!e.selected
                        },
                        selected: function (e) {
                            return e.parentNode && e.parentNode.selectedIndex, e.selected === !0
                        },
                        empty: function (e) {
                            for (e = e.firstChild; e; e = e.nextSibling)
                                if (e.nodeName > "@" || 3 === e.nodeType || 4 === e.nodeType) return !1;
                            return !0
                        },
                        parent: function (e) {
                            return !i.pseudos.empty(e)
                        },
                        header: function (e) {
                            return et.test(e.nodeName)
                        },
                        input: function (e) {
                            return Z.test(e.nodeName)
                        },
                        button: function (e) {
                            var t = e.nodeName.toLowerCase();
                            return "input" === t && "button" === e.type || "button" === t
                        },
                        text: function (e) {
                            var t;
                            return "input" === e.nodeName.toLowerCase() && "text" === e.type && (null == (t = e.getAttribute("type")) || t.toLowerCase() === e.type)
                        },
                        first: yt(function () {
                            return [0]
                        }),
                        last: yt(function (e, t) {
                            return [t - 1]
                        }),
                        eq: yt(function (e, t, n) {
                            return [0 > n ? n + t : n]
                        }),
                        even: yt(function (e, t) {
                            var n = 0;
                            for (; t > n; n += 2) e.push(n);
                            return e
                        }),
                        odd: yt(function (e, t) {
                            var n = 1;
                            for (; t > n; n += 2) e.push(n);
                            return e
                        }),
                        lt: yt(function (e, t, n) {
                            var r = 0 > n ? n + t : n;
                            for (; --r >= 0;) e.push(r);
                            return e
                        }),
                        gt: yt(function (e, t, n) {
                            var r = 0 > n ? n + t : n;
                            for (; t > ++r;) e.push(r);
                            return e
                        })
                    }
                };
                for (t in {
                    radio: !0,
                    checkbox: !0,
                    file: !0,
                    password: !0,
                    image: !0
                }) i.pseudos[t] = gt(t);
                for (t in {
                    submit: !0,
                    reset: !0
                }) i.pseudos[t] = mt(t);

                function vt(e, t) {
                    var n, r, o, s, a, u, l, c = k[e + " "];
                    if (c) return t ? 0 : c.slice(0);
                    a = e, u = [], l = i.preFilter;
                    while (a) {
                        (!n || (r = _.exec(a))) && (r && (a = a.slice(r[0].length) || a), u.push(o = [])), n = !1, (r = X.exec(a)) && (n = r.shift(), o.push({
                            value: n,
                            type: r[0].replace(z, " ")
                        }), a = a.slice(n.length));
                        for (s in i.filter)!(r = J[s].exec(a)) || l[s] && !(r = l[s](r)) || (n = r.shift(), o.push({
                            value: n,
                            type: s,
                            matches: r
                        }), a = a.slice(n.length));
                        if (!n) break
                    }
                    return t ? a.length : a ? ot.error(e) : k(e, u).slice(0)
                }

                function xt(e) {
                    var t = 0,
                        n = e.length,
                        r = "";
                    for (; n > t; t++) r += e[t].value;
                    return r
                }

                function bt(e, t, n) {
                    var i = t.dir,
                        o = n && "parentNode" === i,
                        s = T++;
                    return t.first ? function (t, n, r) {
                        while (t = t[i])
                            if (1 === t.nodeType || o) return e(t, n, r)
                    } : function (t, n, a) {
                        var u, l, c, p = w + " " + s;
                        if (a) {
                            while (t = t[i])
                                if ((1 === t.nodeType || o) && e(t, n, a)) return !0
                        } else
                            while (t = t[i])
                                if (1 === t.nodeType || o)
                                    if (c = t[v] || (t[v] = {}), (l = c[i]) && l[0] === p) {
                                        if ((u = l[1]) === !0 || u === r) return u === !0
                                    } else if (l = c[i] = [p], l[1] = e(t, n, a) || r, l[1] === !0) return !0
                    }
                }

                function wt(e) {
                    return e.length > 1 ? function (t, n, r) {
                        var i = e.length;
                        while (i--)
                            if (!e[i](t, n, r)) return !1;
                        return !0
                    } : e[0]
                }

                function Tt(e, t, n, r, i) {
                    var o, s = [],
                        a = 0,
                        u = e.length,
                        l = null != t;
                    for (; u > a; a++)(o = e[a]) && (!n || n(o, r, i)) && (s.push(o), l && t.push(a));
                    return s
                }

                function Ct(e, t, n, r, i, o) {
                    return r && !r[v] && (r = Ct(r)), i && !i[v] && (i = Ct(i, o)), ut(function (o, s, a, u) {
                        var l, c, p, f = [],
                            h = [],
                            d = s.length,
                            g = o || Et(t || "*", a.nodeType ? [a] : a, []),
                            m = !e || !o && t ? g : Tt(g, f, e, a, u),
                            y = n ? i || (o ? e : d || r) ? [] : s : m;
                        if (n && n(m, y, a, u), r) {
                            l = Tt(y, h), r(l, [], a, u), c = l.length;
                            while (c--)(p = l[c]) && (y[h[c]] = !(m[h[c]] = p))
                        }
                        if (o) {
                            if (i || e) {
                                if (i) {
                                    l = [], c = y.length;
                                    while (c--)(p = y[c]) && l.push(m[c] = p);
                                    i(null, y = [], l, u)
                                }
                                c = y.length;
                                while (c--)(p = y[c]) && (l = i ? P.call(o, p) : f[c]) > -1 && (o[l] = !(s[l] = p))
                            }
                        } else y = Tt(y === s ? y.splice(d, y.length) : y), i ? i(null, s, y, u) : O.apply(s, y)
                    })
                }

                function kt(e) {
                    var t, n, r, o = e.length,
                        s = i.relative[e[0].type],
                        a = s || i.relative[" "],
                        l = s ? 1 : 0,
                        c = bt(function (e) {
                            return e === t
                        }, a, !0),
                        p = bt(function (e) {
                            return P.call(t, e) > -1
                        }, a, !0),
                        f = [

                            function (e, n, r) {
                                return !s && (r || n !== u) || ((t = n).nodeType ? c(e, n, r) : p(e, n, r))
                            }
                        ];
                    for (; o > l; l++)
                        if (n = i.relative[e[l].type]) f = [bt(wt(f), n)];
                        else {
                            if (n = i.filter[e[l].type].apply(null, e[l].matches), n[v]) {
                                for (r = ++l; o > r; r++)
                                    if (i.relative[e[r].type]) break;
                                return Ct(l > 1 && wt(f), l > 1 && xt(e.slice(0, l - 1).concat({
                                    value: " " === e[l - 2].type ? "*" : ""
                                })).replace(z, "$1"), n, r > l && kt(e.slice(l, r)), o > r && kt(e = e.slice(r)), o > r && xt(e))
                            }
                            f.push(n)
                        }
                    return wt(f)
                }

                function Nt(e, t) {
                    var n = 0,
                        o = t.length > 0,
                        s = e.length > 0,
                        a = function (a, l, c, f, h) {
                            var d, g, m, y = [],
                                v = 0,
                                x = "0",
                                b = a && [],
                                T = null != h,
                                C = u,
                                k = a || s && i.find.TAG("*", h && l.parentNode || l),
                                N = w += null == C ? 1 : Math.random() || .1;
                            for (T && (u = l !== p && l, r = n); null != (d = k[x]); x++) {
                                if (s && d) {
                                    g = 0;
                                    while (m = e[g++])
                                        if (m(d, l, c)) {
                                            f.push(d);
                                            break
                                        }
                                    T && (w = N, r = ++n)
                                }
                                o && ((d = !m && d) && v--, a && b.push(d))
                            }
                            if (v += x, o && x !== v) {
                                g = 0;
                                while (m = t[g++]) m(b, y, l, c);
                                if (a) {
                                    if (v > 0)
                                        while (x--) b[x] || y[x] || (y[x] = H.call(f));
                                    y = Tt(y)
                                }
                                O.apply(f, y), T && !a && y.length > 0 && v + t.length > 1 && ot.uniqueSort(f)
                            }
                            return T && (w = N, u = C), b
                        };
                    return o ? ut(a) : a
                }
                a = ot.compile = function (e, t) {
                    var n, r = [],
                        i = [],
                        o = N[e + " "];
                    if (!o) {
                        t || (t = vt(e)), n = t.length;
                        while (n--) o = kt(t[n]), o[v] ? r.push(o) : i.push(o);
                        o = N(e, Nt(i, r))
                    }
                    return o
                };

                function Et(e, t, n) {
                    var r = 0,
                        i = t.length;
                    for (; i > r; r++) ot(e, t[r], n);
                    return n
                }

                function St(e, t, r, o) {
                    var s, u, l, c, p, f = vt(e);
                    if (!o && 1 === f.length) {
                        if (u = f[0] = f[0].slice(0), u.length > 2 && "ID" === (l = u[0]).type && n.getById && 9 === t.nodeType && h && i.relative[u[1].type]) {
                            if (t = (i.find.ID(l.matches[0].replace(nt, rt), t) || [])[0], !t) return r;
                            e = e.slice(u.shift().value.length)
                        }
                        s = J.needsContext.test(e) ? 0 : u.length;
                        while (s--) {
                            if (l = u[s], i.relative[c = l.type]) break;
                            if ((p = i.find[c]) && (o = p(l.matches[0].replace(nt, rt), U.test(u[0].type) && t.parentNode || t))) {
                                if (u.splice(s, 1), e = o.length && xt(u), !e) return O.apply(r, o), r;
                                break
                            }
                        }
                    }
                    return a(e, f)(o, t, !h, r, U.test(e)), r
                }
                i.pseudos.nth = i.pseudos.eq;

                function jt() {}
                jt.prototype = i.filters = i.pseudos, i.setFilters = new jt, n.sortStable = v.split("").sort(S).join("") === v, c(), [0, 0].sort(S), n.detectDuplicates = E, x.find = ot, x.expr = ot.selectors, x.expr[":"] = x.expr.pseudos, x.unique = ot.uniqueSort, x.text = ot.getText, x.isXMLDoc = ot.isXML, x.contains = ot.contains
            }(e);
        var D = {};

        function A(e) {
            var t = D[e] = {};
            return x.each(e.match(w) || [], function (e, n) {
                t[n] = !0
            }), t
        }
        x.Callbacks = function (e) {
            e = "string" == typeof e ? D[e] || A(e) : x.extend({}, e);
            var t, n, r, i, o, s, a = [],
                u = !e.once && [],
                l = function (p) {
                    for (t = e.memory && p, n = !0, s = i || 0, i = 0, o = a.length, r = !0; a && o > s; s++)
                        if (a[s].apply(p[0], p[1]) === !1 && e.stopOnFalse) {
                            t = !1;
                            break
                        }
                    r = !1, a && (u ? u.length && l(u.shift()) : t ? a = [] : c.disable())
                },
                c = {
                    add: function () {
                        if (a) {
                            var n = a.length;
                            (function s(t) {
                                x.each(t, function (t, n) {
                                    var r = x.type(n);
                                    "function" === r ? e.unique && c.has(n) || a.push(n) : n && n.length && "string" !== r && s(n)
                                })
                            })(arguments), r ? o = a.length : t && (i = n, l(t))
                        }
                        return this
                    },
                    remove: function () {
                        return a && x.each(arguments, function (e, t) {
                            var n;
                            while ((n = x.inArray(t, a, n)) > -1) a.splice(n, 1), r && (o >= n && o--, s >= n && s--)
                        }), this
                    },
                    has: function (e) {
                        return e ? x.inArray(e, a) > -1 : !(!a || !a.length)
                    },
                    empty: function () {
                        return a = [], o = 0, this
                    },
                    disable: function () {
                        return a = u = t = undefined, this
                    },
                    disabled: function () {
                        return !a
                    },
                    lock: function () {
                        return u = undefined, t || c.disable(), this
                    },
                    locked: function () {
                        return !u
                    },
                    fireWith: function (e, t) {
                        return t = t || [], t = [e, t.slice ? t.slice() : t], !a || n && !u || (r ? u.push(t) : l(t)), this
                    },
                    fire: function () {
                        return c.fireWith(this, arguments), this
                    },
                    fired: function () {
                        return !!n
                    }
                };
            return c
        }, x.extend({
            Deferred: function (e) {
                var t = [
                        ["resolve", "done", x.Callbacks("once memory"), "resolved"],
                        ["reject", "fail", x.Callbacks("once memory"), "rejected"],
                        ["notify", "progress", x.Callbacks("memory")]
                    ],
                    n = "pending",
                    r = {
                        state: function () {
                            return n
                        },
                        always: function () {
                            return i.done(arguments).fail(arguments), this
                        },
                        then: function () {
                            var e = arguments;
                            return x.Deferred(function (n) {
                                x.each(t, function (t, o) {
                                    var s = o[0],
                                        a = x.isFunction(e[t]) && e[t];
                                    i[o[1]](function () {
                                        var e = a && a.apply(this, arguments);
                                        e && x.isFunction(e.promise) ? e.promise().done(n.resolve).fail(n.reject).progress(n.notify) : n[s + "With"](this === r ? n.promise() : this, a ? [e] : arguments)
                                    })
                                }), e = null
                            }).promise()
                        },
                        promise: function (e) {
                            return null != e ? x.extend(e, r) : r
                        }
                    },
                    i = {};
                return r.pipe = r.then, x.each(t, function (e, o) {
                    var s = o[2],
                        a = o[3];
                    r[o[1]] = s.add, a && s.add(function () {
                        n = a
                    }, t[1 ^ e][2].disable, t[2][2].lock), i[o[0]] = function () {
                        return i[o[0] + "With"](this === i ? r : this, arguments), this
                    }, i[o[0] + "With"] = s.fireWith
                }), r.promise(i), e && e.call(i, i), i
            },
            when: function (e) {
                var t = 0,
                    n = d.call(arguments),
                    r = n.length,
                    i = 1 !== r || e && x.isFunction(e.promise) ? r : 0,
                    o = 1 === i ? e : x.Deferred(),
                    s = function (e, t, n) {
                        return function (r) {
                            t[e] = this, n[e] = arguments.length > 1 ? d.call(arguments) : r, n === a ? o.notifyWith(t, n) : --i || o.resolveWith(t, n)
                        }
                    },
                    a, u, l;
                if (r > 1)
                    for (a = Array(r), u = Array(r), l = Array(r); r > t; t++) n[t] && x.isFunction(n[t].promise) ? n[t].promise().done(s(t, l, n)).fail(o.reject).progress(s(t, u, a)) : --i;
                return i || o.resolveWith(l, n), o.promise()
            }
        }), x.support = function (t) {
            var n = o.createElement("input"),
                r = o.createDocumentFragment(),
                i = o.createElement("div"),
                s = o.createElement("select"),
                a = s.appendChild(o.createElement("option"));
            return n.type ? (n.type = "checkbox", t.checkOn = "" !== n.value, t.optSelected = a.selected, t.reliableMarginRight = !0, t.boxSizingReliable = !0, t.pixelPosition = !1, n.checked = !0, t.noCloneChecked = n.cloneNode(!0).checked, s.disabled = !0, t.optDisabled = !a.disabled, n = o.createElement("input"), n.value = "t", n.type = "radio", t.radioValue = "t" === n.value, n.setAttribute("checked", "t"), n.setAttribute("name", "t"), r.appendChild(n), t.checkClone = r.cloneNode(!0).cloneNode(!0).lastChild.checked, t.focusinBubbles = "onfocusin" in e, i.style.backgroundClip = "content-box", i.cloneNode(!0).style.backgroundClip = "", t.clearCloneStyle = "content-box" === i.style.backgroundClip, x(function () {
                var n, r, s = "padding:0;margin:0;border:0;display:block;-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box",
                    a = o.getElementsByTagName("body")[0];
                a && (n = o.createElement("div"), n.style.cssText = "border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px", a.appendChild(n).appendChild(i), i.innerHTML = "", i.style.cssText = "-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%", x.swap(a, null != a.style.zoom ? {
                    zoom: 1
                } : {}, function () {
                    t.boxSizing = 4 === i.offsetWidth
                }), e.getComputedStyle && (t.pixelPosition = "1%" !== (e.getComputedStyle(i, null) || {}).top, t.boxSizingReliable = "4px" === (e.getComputedStyle(i, null) || {
                    width: "4px"
                }).width, r = i.appendChild(o.createElement("div")), r.style.cssText = i.style.cssText = s, r.style.marginRight = r.style.width = "0", i.style.width = "1px", t.reliableMarginRight = !parseFloat((e.getComputedStyle(r, null) || {}).marginRight)), a.removeChild(n))
            }), t) : t
        }({});
        var L, H, q = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/,
            O = /([A-Z])/g;

        function F() {
            Object.defineProperty(this.cache = {}, 0, {
                get: function () {
                    return {}
                }
            }), this.expando = x.expando + Math.random()
        }
        F.uid = 1, F.accepts = function (e) {
            return e.nodeType ? 1 === e.nodeType || 9 === e.nodeType : !0
        }, F.prototype = {
            key: function (e) {
                if (!F.accepts(e)) return 0;
                var t = {},
                    n = e[this.expando];
                if (!n) {
                    n = F.uid++;
                    try {
                        t[this.expando] = {
                            value: n
                        }, Object.defineProperties(e, t)
                    } catch (r) {
                        t[this.expando] = n, x.extend(e, t)
                    }
                }
                return this.cache[n] || (this.cache[n] = {}), n
            },
            set: function (e, t, n) {
                var r, i = this.key(e),
                    o = this.cache[i];
                if ("string" == typeof t) o[t] = n;
                else if (x.isEmptyObject(o)) x.extend(this.cache[i], t);
                else
                    for (r in t) o[r] = t[r];
                return o
            },
            get: function (e, t) {
                var n = this.cache[this.key(e)];
                return t === undefined ? n : n[t]
            },
            access: function (e, t, n) {
                return t === undefined || t && "string" == typeof t && n === undefined ? this.get(e, t) : (this.set(e, t, n), n !== undefined ? n : t)
            },
            remove: function (e, t) {
                var n, r, i, o = this.key(e),
                    s = this.cache[o];
                if (t === undefined) this.cache[o] = {};
                else {
                    x.isArray(t) ? r = t.concat(t.map(x.camelCase)) : (i = x.camelCase(t), t in s ? r = [t, i] : (r = i, r = r in s ? [r] : r.match(w) || [])), n = r.length;
                    while (n--) delete s[r[n]]
                }
            },
            hasData: function (e) {
                return !x.isEmptyObject(this.cache[e[this.expando]] || {})
            },
            discard: function (e) {
                e[this.expando] && delete this.cache[e[this.expando]]
            }
        }, L = new F, H = new F, x.extend({
            acceptData: F.accepts,
            hasData: function (e) {
                return L.hasData(e) || H.hasData(e)
            },
            data: function (e, t, n) {
                return L.access(e, t, n)
            },
            removeData: function (e, t) {
                L.remove(e, t)
            },
            _data: function (e, t, n) {
                return H.access(e, t, n)
            },
            _removeData: function (e, t) {
                H.remove(e, t)
            }
        }), x.fn.extend({
            data: function (e, t) {
                var n, r, i = this[0],
                    o = 0,
                    s = null;
                if (e === undefined) {
                    if (this.length && (s = L.get(i), 1 === i.nodeType && !H.get(i, "hasDataAttrs"))) {
                        for (n = i.attributes; n.length > o; o++) r = n[o].name, 0 === r.indexOf("data-") && (r = x.camelCase(r.slice(5)), P(i, r, s[r]));
                        H.set(i, "hasDataAttrs", !0)
                    }
                    return s
                }
                return "object" == typeof e ? this.each(function () {
                    L.set(this, e)
                }) : x.access(this, function (t) {
                    var n, r = x.camelCase(e);
                    if (i && t === undefined) {
                        if (n = L.get(i, e), n !== undefined) return n;
                        if (n = L.get(i, r), n !== undefined) return n;
                        if (n = P(i, r, undefined), n !== undefined) return n
                    } else this.each(function () {
                        var n = L.get(this, r);
                        L.set(this, r, t), -1 !== e.indexOf("-") && n !== undefined && L.set(this, e, t)
                    })
                }, null, t, arguments.length > 1, null, !0)
            },
            removeData: function (e) {
                return this.each(function () {
                    L.remove(this, e)
                })
            }
        });

        function P(e, t, n) {
            var r;
            if (n === undefined && 1 === e.nodeType)
                if (r = "data-" + t.replace(O, "-$1").toLowerCase(), n = e.getAttribute(r), "string" == typeof n) {
                    try {
                        n = "true" === n ? !0 : "false" === n ? !1 : "null" === n ? null : +n + "" === n ? +n : q.test(n) ? JSON.parse(n) : n
                    } catch (i) {}
                    L.set(e, t, n)
                } else n = undefined;
            return n
        }
        x.extend({
            queue: function (e, t, n) {
                var r;
                return e ? (t = (t || "fx") + "queue", r = H.get(e, t), n && (!r || x.isArray(n) ? r = H.access(e, t, x.makeArray(n)) : r.push(n)), r || []) : undefined
            },
            dequeue: function (e, t) {
                t = t || "fx";
                var n = x.queue(e, t),
                    r = n.length,
                    i = n.shift(),
                    o = x._queueHooks(e, t),
                    s = function () {
                        x.dequeue(e, t)
                    };
                "inprogress" === i && (i = n.shift(), r--), i && ("fx" === t && n.unshift("inprogress"), delete o.stop, i.call(e, s, o)), !r && o && o.empty.fire()
            },
            _queueHooks: function (e, t) {
                var n = t + "queueHooks";
                return H.get(e, n) || H.access(e, n, {
                    empty: x.Callbacks("once memory").add(function () {
                        H.remove(e, [t + "queue", n])
                    })
                })
            }
        }), x.fn.extend({
            queue: function (e, t) {
                var n = 2;
                return "string" != typeof e && (t = e, e = "fx", n--), n > arguments.length ? x.queue(this[0], e) : t === undefined ? this : this.each(function () {
                    var n = x.queue(this, e, t);
                    x._queueHooks(this, e), "fx" === e && "inprogress" !== n[0] && x.dequeue(this, e)
                })
            },
            dequeue: function (e) {
                return this.each(function () {
                    x.dequeue(this, e)
                })
            },
            delay: function (e, t) {
                return e = x.fx ? x.fx.speeds[e] || e : e, t = t || "fx", this.queue(t, function (t, n) {
                    var r = setTimeout(t, e);
                    n.stop = function () {
                        clearTimeout(r)
                    }
                })
            },
            clearQueue: function (e) {
                return this.queue(e || "fx", [])
            },
            promise: function (e, t) {
                var n, r = 1,
                    i = x.Deferred(),
                    o = this,
                    s = this.length,
                    a = function () {
                        --r || i.resolveWith(o, [o])
                    };
                "string" != typeof e && (t = e, e = undefined), e = e || "fx";
                while (s--) n = H.get(o[s], e + "queueHooks"), n && n.empty && (r++, n.empty.add(a));
                return a(), i.promise(t)
            }
        });
        var R, M, W = /[\t\r\n\f]/g,
            $ = /\r/g,
            B = /^(?:input|select|textarea|button)$/i;
        x.fn.extend({
            attr: function (e, t) {
                return x.access(this, x.attr, e, t, arguments.length > 1)
            },
            removeAttr: function (e) {
                return this.each(function () {
                    x.removeAttr(this, e)
                })
            },
            prop: function (e, t) {
                return x.access(this, x.prop, e, t, arguments.length > 1)
            },
            removeProp: function (e) {
                return this.each(function () {
                    delete this[x.propFix[e] || e]
                })
            },
            addClass: function (e) {
                var t, n, r, i, o, s = 0,
                    a = this.length,
                    u = "string" == typeof e && e;
                if (x.isFunction(e)) return this.each(function (t) {
                    x(this).addClass(e.call(this, t, this.className))
                });
                if (u)
                    for (t = (e || "").match(w) || []; a > s; s++)
                        if (n = this[s], r = 1 === n.nodeType && (n.className ? (" " + n.className + " ").replace(W, " ") : " ")) {
                            o = 0;
                            while (i = t[o++]) 0 > r.indexOf(" " + i + " ") && (r += i + " ");
                            n.className = x.trim(r)
                        }
                return this
            },
            removeClass: function (e) {
                var t, n, r, i, o, s = 0,
                    a = this.length,
                    u = 0 === arguments.length || "string" == typeof e && e;
                if (x.isFunction(e)) return this.each(function (t) {
                    x(this).removeClass(e.call(this, t, this.className))
                });
                if (u)
                    for (t = (e || "").match(w) || []; a > s; s++)
                        if (n = this[s], r = 1 === n.nodeType && (n.className ? (" " + n.className + " ").replace(W, " ") : "")) {
                            o = 0;
                            while (i = t[o++])
                                while (r.indexOf(" " + i + " ") >= 0) r = r.replace(" " + i + " ", " ");
                            n.className = e ? x.trim(r) : ""
                        }
                return this
            },
            toggleClass: function (e, t) {
                var n = typeof e,
                    i = "boolean" == typeof t;
                return x.isFunction(e) ? this.each(function (n) {
                    x(this).toggleClass(e.call(this, n, this.className, t), t)
                }) : this.each(function () {
                    if ("string" === n) {
                        var o, s = 0,
                            a = x(this),
                            u = t,
                            l = e.match(w) || [];
                        while (o = l[s++]) u = i ? u : !a.hasClass(o), a[u ? "addClass" : "removeClass"](o)
                    } else(n === r || "boolean" === n) && (this.className && H.set(this, "__className__", this.className), this.className = this.className || e === !1 ? "" : H.get(this, "__className__") || "")
                })
            },
            hasClass: function (e) {
                var t = " " + e + " ",
                    n = 0,
                    r = this.length;
                for (; r > n; n++)
                    if (1 === this[n].nodeType && (" " + this[n].className + " ").replace(W, " ").indexOf(t) >= 0) return !0;
                return !1
            },
            val: function (e) {
                var t, n, r, i = this[0]; {
                    if (arguments.length) return r = x.isFunction(e), this.each(function (n) {
                        var i;
                        1 === this.nodeType && (i = r ? e.call(this, n, x(this).val()) : e, null == i ? i = "" : "number" == typeof i ? i += "" : x.isArray(i) && (i = x.map(i, function (e) {
                            return null == e ? "" : e + ""
                        })), t = x.valHooks[this.type] || x.valHooks[this.nodeName.toLowerCase()], t && "set" in t && t.set(this, i, "value") !== undefined || (this.value = i))
                    });
                    if (i) return t = x.valHooks[i.type] || x.valHooks[i.nodeName.toLowerCase()], t && "get" in t && (n = t.get(i, "value")) !== undefined ? n : (n = i.value, "string" == typeof n ? n.replace($, "") : null == n ? "" : n)
                }
            }
        }), x.extend({
            valHooks: {
                option: {
                    get: function (e) {
                        var t = e.attributes.value;
                        return !t || t.specified ? e.value : e.text
                    }
                },
                select: {
                    get: function (e) {
                        var t, n, r = e.options,
                            i = e.selectedIndex,
                            o = "select-one" === e.type || 0 > i,
                            s = o ? null : [],
                            a = o ? i + 1 : r.length,
                            u = 0 > i ? a : o ? i : 0;
                        for (; a > u; u++)
                            if (n = r[u], !(!n.selected && u !== i || (x.support.optDisabled ? n.disabled : null !== n.getAttribute("disabled")) || n.parentNode.disabled && x.nodeName(n.parentNode, "optgroup"))) {
                                if (t = x(n).val(), o) return t;
                                s.push(t)
                            }
                        return s
                    },
                    set: function (e, t) {
                        var n, r, i = e.options,
                            o = x.makeArray(t),
                            s = i.length;
                        while (s--) r = i[s], (r.selected = x.inArray(x(r).val(), o) >= 0) && (n = !0);
                        return n || (e.selectedIndex = -1), o
                    }
                }
            },
            attr: function (e, t, n) {
                var i, o, s = e.nodeType;
                if (e && 3 !== s && 8 !== s && 2 !== s) return typeof e.getAttribute === r ? x.prop(e, t, n) : (1 === s && x.isXMLDoc(e) || (t = t.toLowerCase(), i = x.attrHooks[t] || (x.expr.match.bool.test(t) ? M : R)), n === undefined ? i && "get" in i && null !== (o = i.get(e, t)) ? o : (o = x.find.attr(e, t), null == o ? undefined : o) : null !== n ? i && "set" in i && (o = i.set(e, n, t)) !== undefined ? o : (e.setAttribute(t, n + ""), n) : (x.removeAttr(e, t), undefined))
            },
            removeAttr: function (e, t) {
                var n, r, i = 0,
                    o = t && t.match(w);
                if (o && 1 === e.nodeType)
                    while (n = o[i++]) r = x.propFix[n] || n, x.expr.match.bool.test(n) && (e[r] = !1), e.removeAttribute(n)
            },
            attrHooks: {
                type: {
                    set: function (e, t) {
                        if (!x.support.radioValue && "radio" === t && x.nodeName(e, "input")) {
                            var n = e.value;
                            return e.setAttribute("type", t), n && (e.value = n), t
                        }
                    }
                }
            },
            propFix: {
                "for": "htmlFor",
                "class": "className"
            },
            prop: function (e, t, n) {
                var r, i, o, s = e.nodeType;
                if (e && 3 !== s && 8 !== s && 2 !== s) return o = 1 !== s || !x.isXMLDoc(e), o && (t = x.propFix[t] || t, i = x.propHooks[t]), n !== undefined ? i && "set" in i && (r = i.set(e, n, t)) !== undefined ? r : e[t] = n : i && "get" in i && null !== (r = i.get(e, t)) ? r : e[t]
            },
            propHooks: {
                tabIndex: {
                    get: function (e) {
                        return e.hasAttribute("tabindex") || B.test(e.nodeName) || e.href ? e.tabIndex : -1
                    }
                }
            }
        }), M = {
            set: function (e, t, n) {
                return t === !1 ? x.removeAttr(e, n) : e.setAttribute(n, n), n
            }
        }, x.each(x.expr.match.bool.source.match(/\w+/g), function (e, t) {
            var n = x.expr.attrHandle[t] || x.find.attr;
            x.expr.attrHandle[t] = function (e, t, r) {
                var i = x.expr.attrHandle[t],
                    o = r ? undefined : (x.expr.attrHandle[t] = undefined) != n(e, t, r) ? t.toLowerCase() : null;
                return x.expr.attrHandle[t] = i, o
            }
        }), x.support.optSelected || (x.propHooks.selected = {
            get: function (e) {
                var t = e.parentNode;
                return t && t.parentNode && t.parentNode.selectedIndex, null
            }
        }), x.each(["tabIndex", "readOnly", "maxLength", "cellSpacing", "cellPadding", "rowSpan", "colSpan", "useMap", "frameBorder", "contentEditable"], function () {
            x.propFix[this.toLowerCase()] = this
        }), x.each(["radio", "checkbox"], function () {
            x.valHooks[this] = {
                set: function (e, t) {
                    return x.isArray(t) ? e.checked = x.inArray(x(e).val(), t) >= 0 : undefined
                }
            }, x.support.checkOn || (x.valHooks[this].get = function (e) {
                return null === e.getAttribute("value") ? "on" : e.value
            })
        });
        var I = /^key/,
            z = /^(?:mouse|contextmenu)|click/,
            _ = /^(?:focusinfocus|focusoutblur)$/,
            X = /^([^.]*)(?:\.(.+)|)$/;

        function U() {
            return !0
        }

        function Y() {
            return !1
        }

        function V() {
            try {
                return o.activeElement
            } catch (e) {}
        }
        x.event = {
            global: {},
            add: function (e, t, n, i, o) {
                var s, a, u, l, c, p, f, h, d, g, m, y = H.get(e);
                if (y) {
                    n.handler && (s = n, n = s.handler, o = s.selector), n.guid || (n.guid = x.guid++), (l = y.events) || (l = y.events = {}), (a = y.handle) || (a = y.handle = function (e) {
                        return typeof x === r || e && x.event.triggered === e.type ? undefined : x.event.dispatch.apply(a.elem, arguments)
                    }, a.elem = e), t = (t || "").match(w) || [""], c = t.length;
                    while (c--) u = X.exec(t[c]) || [], d = m = u[1], g = (u[2] || "").split(".").sort(), d && (f = x.event.special[d] || {}, d = (o ? f.delegateType : f.bindType) || d, f = x.event.special[d] || {}, p = x.extend({
                        type: d,
                        origType: m,
                        data: i,
                        handler: n,
                        guid: n.guid,
                        selector: o,
                        needsContext: o && x.expr.match.needsContext.test(o),
                        namespace: g.join(".")
                    }, s), (h = l[d]) || (h = l[d] = [], h.delegateCount = 0, f.setup && f.setup.call(e, i, g, a) !== !1 || e.addEventListener && e.addEventListener(d, a, !1)), f.add && (f.add.call(e, p), p.handler.guid || (p.handler.guid = n.guid)), o ? h.splice(h.delegateCount++, 0, p) : h.push(p), x.event.global[d] = !0);
                    e = null
                }
            },
            remove: function (e, t, n, r, i) {
                var o, s, a, u, l, c, p, f, h, d, g, m = H.hasData(e) && H.get(e);
                if (m && (u = m.events)) {
                    t = (t || "").match(w) || [""], l = t.length;
                    while (l--)
                        if (a = X.exec(t[l]) || [], h = g = a[1], d = (a[2] || "").split(".").sort(), h) {
                            p = x.event.special[h] || {}, h = (r ? p.delegateType : p.bindType) || h, f = u[h] || [], a = a[2] && RegExp("(^|\\.)" + d.join("\\.(?:.*\\.|)") + "(\\.|$)"), s = o = f.length;
                            while (o--) c = f[o], !i && g !== c.origType || n && n.guid !== c.guid || a && !a.test(c.namespace) || r && r !== c.selector && ("**" !== r || !c.selector) || (f.splice(o, 1), c.selector && f.delegateCount--, p.remove && p.remove.call(e, c));
                            s && !f.length && (p.teardown && p.teardown.call(e, d, m.handle) !== !1 || x.removeEvent(e, h, m.handle), delete u[h])
                        } else
                            for (h in u) x.event.remove(e, h + t[l], n, r, !0);
                    x.isEmptyObject(u) && (delete m.handle, H.remove(e, "events"))
                }
            },
            trigger: function (t, n, r, i) {
                var s, a, u, l, c, p, f, h = [r || o],
                    d = y.call(t, "type") ? t.type : t,
                    g = y.call(t, "namespace") ? t.namespace.split(".") : [];
                if (a = u = r = r || o, 3 !== r.nodeType && 8 !== r.nodeType && !_.test(d + x.event.triggered) && (d.indexOf(".") >= 0 && (g = d.split("."), d = g.shift(), g.sort()), c = 0 > d.indexOf(":") && "on" + d, t = t[x.expando] ? t : new x.Event(d, "object" == typeof t && t), t.isTrigger = i ? 2 : 3, t.namespace = g.join("."), t.namespace_re = t.namespace ? RegExp("(^|\\.)" + g.join("\\.(?:.*\\.|)") + "(\\.|$)") : null, t.result = undefined, t.target || (t.target = r), n = null == n ? [t] : x.makeArray(n, [t]), f = x.event.special[d] || {}, i || !f.trigger || f.trigger.apply(r, n) !== !1)) {
                    if (!i && !f.noBubble && !x.isWindow(r)) {
                        for (l = f.delegateType || d, _.test(l + d) || (a = a.parentNode); a; a = a.parentNode) h.push(a), u = a;
                        u === (r.ownerDocument || o) && h.push(u.defaultView || u.parentWindow || e)
                    }
                    s = 0;
                    while ((a = h[s++]) && !t.isPropagationStopped()) t.type = s > 1 ? l : f.bindType || d, p = (H.get(a, "events") || {})[t.type] && H.get(a, "handle"), p && p.apply(a, n), p = c && a[c], p && x.acceptData(a) && p.apply && p.apply(a, n) === !1 && t.preventDefault();
                    return t.type = d, i || t.isDefaultPrevented() || f._default && f._default.apply(h.pop(), n) !== !1 || !x.acceptData(r) || c && x.isFunction(r[d]) && !x.isWindow(r) && (u = r[c], u && (r[c] = null), x.event.triggered = d, r[d](), x.event.triggered = undefined, u && (r[c] = u)), t.result
                }
            },
            dispatch: function (e) {
                e = x.event.fix(e);
                var t, n, r, i, o, s = [],
                    a = d.call(arguments),
                    u = (H.get(this, "events") || {})[e.type] || [],
                    l = x.event.special[e.type] || {};
                if (a[0] = e, e.delegateTarget = this, !l.preDispatch || l.preDispatch.call(this, e) !== !1) {
                    s = x.event.handlers.call(this, e, u), t = 0;
                    while ((i = s[t++]) && !e.isPropagationStopped()) {
                        e.currentTarget = i.elem, n = 0;
                        while ((o = i.handlers[n++]) && !e.isImmediatePropagationStopped())(!e.namespace_re || e.namespace_re.test(o.namespace)) && (e.handleObj = o, e.data = o.data, r = ((x.event.special[o.origType] || {}).handle || o.handler).apply(i.elem, a), r !== undefined && (e.result = r) === !1 && (e.preventDefault(), e.stopPropagation()))
                    }
                    return l.postDispatch && l.postDispatch.call(this, e), e.result
                }
            },
            handlers: function (e, t) {
                var n, r, i, o, s = [],
                    a = t.delegateCount,
                    u = e.target;
                if (a && u.nodeType && (!e.button || "click" !== e.type))
                    for (; u !== this; u = u.parentNode || this)
                        if (u.disabled !== !0 || "click" !== e.type) {
                            for (r = [], n = 0; a > n; n++) o = t[n], i = o.selector + " ", r[i] === undefined && (r[i] = o.needsContext ? x(i, this).index(u) >= 0 : x.find(i, this, null, [u]).length), r[i] && r.push(o);
                            r.length && s.push({
                                elem: u,
                                handlers: r
                            })
                        }
                return t.length > a && s.push({
                    elem: this,
                    handlers: t.slice(a)
                }), s
            },
            props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),
            fixHooks: {},
            keyHooks: {
                props: "char charCode key keyCode".split(" "),
                filter: function (e, t) {
                    return null == e.which && (e.which = null != t.charCode ? t.charCode : t.keyCode), e
                }
            },
            mouseHooks: {
                props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
                filter: function (e, t) {
                    var n, r, i, s = t.button;
                    return null == e.pageX && null != t.clientX && (n = e.target.ownerDocument || o, r = n.documentElement, i = n.body, e.pageX = t.clientX + (r && r.scrollLeft || i && i.scrollLeft || 0) - (r && r.clientLeft || i && i.clientLeft || 0), e.pageY = t.clientY + (r && r.scrollTop || i && i.scrollTop || 0) - (r && r.clientTop || i && i.clientTop || 0)), e.which || s === undefined || (e.which = 1 & s ? 1 : 2 & s ? 3 : 4 & s ? 2 : 0), e
                }
            },
            fix: function (e) {
                if (e[x.expando]) return e;
                var t, n, r, i = e.type,
                    s = e,
                    a = this.fixHooks[i];
                a || (this.fixHooks[i] = a = z.test(i) ? this.mouseHooks : I.test(i) ? this.keyHooks : {}), r = a.props ? this.props.concat(a.props) : this.props, e = new x.Event(s), t = r.length;
                while (t--) n = r[t], e[n] = s[n];
                return e.target || (e.target = o), 3 === e.target.nodeType && (e.target = e.target.parentNode), a.filter ? a.filter(e, s) : e
            },
            special: {
                load: {
                    noBubble: !0
                },
                focus: {
                    trigger: function () {
                        return this !== V() && this.focus ? (this.focus(), !1) : undefined
                    },
                    delegateType: "focusin"
                },
                blur: {
                    trigger: function () {
                        return this === V() && this.blur ? (this.blur(), !1) : undefined
                    },
                    delegateType: "focusout"
                },
                click: {
                    trigger: function () {
                        return "checkbox" === this.type && this.click && x.nodeName(this, "input") ? (this.click(), !1) : undefined
                    },
                    _default: function (e) {
                        return x.nodeName(e.target, "a")
                    }
                },
                beforeunload: {
                    postDispatch: function (e) {
                        e.result !== undefined && (e.originalEvent.returnValue = e.result)
                    }
                }
            },
            simulate: function (e, t, n, r) {
                var i = x.extend(new x.Event, n, {
                    type: e,
                    isSimulated: !0,
                    originalEvent: {}
                });
                r ? x.event.trigger(i, null, t) : x.event.dispatch.call(t, i), i.isDefaultPrevented() && n.preventDefault()
            }
        }, x.removeEvent = function (e, t, n) {
            e.removeEventListener && e.removeEventListener(t, n, !1)
        }, x.Event = function (e, t) {
            return this instanceof x.Event ? (e && e.type ? (this.originalEvent = e, this.type = e.type, this.isDefaultPrevented = e.defaultPrevented || e.getPreventDefault && e.getPreventDefault() ? U : Y) : this.type = e, t && x.extend(this, t), this.timeStamp = e && e.timeStamp || x.now(), this[x.expando] = !0, undefined) : new x.Event(e, t)
        }, x.Event.prototype = {
            isDefaultPrevented: Y,
            isPropagationStopped: Y,
            isImmediatePropagationStopped: Y,
            preventDefault: function () {
                var e = this.originalEvent;
                this.isDefaultPrevented = U, e && e.preventDefault && e.preventDefault()
            },
            stopPropagation: function () {
                var e = this.originalEvent;
                this.isPropagationStopped = U, e && e.stopPropagation && e.stopPropagation()
            },
            stopImmediatePropagation: function () {
                this.isImmediatePropagationStopped = U, this.stopPropagation()
            }
        }, x.each({
            mouseenter: "mouseover",
            mouseleave: "mouseout"
        }, function (e, t) {
            x.event.special[e] = {
                delegateType: t,
                bindType: t,
                handle: function (e) {
                    var n, r = this,
                        i = e.relatedTarget,
                        o = e.handleObj;
                    return (!i || i !== r && !x.contains(r, i)) && (e.type = o.origType, n = o.handler.apply(this, arguments), e.type = t), n
                }
            }
        }), x.support.focusinBubbles || x.each({
            focus: "focusin",
            blur: "focusout"
        }, function (e, t) {
            var n = 0,
                r = function (e) {
                    x.event.simulate(t, e.target, x.event.fix(e), !0)
                };
            x.event.special[t] = {
                setup: function () {
                    0 === n++ && o.addEventListener(e, r, !0)
                },
                teardown: function () {
                    0 === --n && o.removeEventListener(e, r, !0)
                }
            }
        }), x.fn.extend({
            on: function (e, t, n, r, i) {
                var o, s;
                if ("object" == typeof e) {
                    "string" != typeof t && (n = n || t, t = undefined);
                    for (s in e) this.on(s, t, n, e[s], i);
                    return this
                }
                if (null == n && null == r ? (r = t, n = t = undefined) : null == r && ("string" == typeof t ? (r = n, n = undefined) : (r = n, n = t, t = undefined)), r === !1) r = Y;
                else if (!r) return this;
                return 1 === i && (o = r, r = function (e) {
                    return x().off(e), o.apply(this, arguments)
                }, r.guid = o.guid || (o.guid = x.guid++)), this.each(function () {
                    x.event.add(this, e, r, n, t)
                })
            },
            one: function (e, t, n, r) {
                return this.on(e, t, n, r, 1)
            },
            off: function (e, t, n) {
                var r, i;
                if (e && e.preventDefault && e.handleObj) return r = e.handleObj, x(e.delegateTarget).off(r.namespace ? r.origType + "." + r.namespace : r.origType, r.selector, r.handler), this;
                if ("object" == typeof e) {
                    for (i in e) this.off(i, t, e[i]);
                    return this
                }
                return (t === !1 || "function" == typeof t) && (n = t, t = undefined), n === !1 && (n = Y), this.each(function () {
                    x.event.remove(this, e, n, t)
                })
            },
            trigger: function (e, t) {
                return this.each(function () {
                    x.event.trigger(e, t, this)
                })
            },
            triggerHandler: function (e, t) {
                var n = this[0];
                return n ? x.event.trigger(e, t, n, !0) : undefined
            }
        });
        var G = /^.[^:#\[\.,]*$/,
            J = /^(?:parents|prev(?:Until|All))/,
            Q = x.expr.match.needsContext,
            K = {
                children: !0,
                contents: !0,
                next: !0,
                prev: !0
            };
        x.fn.extend({
            find: function (e) {
                var t, n = [],
                    r = this,
                    i = r.length;
                if ("string" != typeof e) return this.pushStack(x(e).filter(function () {
                    for (t = 0; i > t; t++)
                        if (x.contains(r[t], this)) return !0
                }));
                for (t = 0; i > t; t++) x.find(e, r[t], n);
                return n = this.pushStack(i > 1 ? x.unique(n) : n), n.selector = this.selector ? this.selector + " " + e : e, n
            },
            has: function (e) {
                var t = x(e, this),
                    n = t.length;
                return this.filter(function () {
                    var e = 0;
                    for (; n > e; e++)
                        if (x.contains(this, t[e])) return !0
                })
            },
            not: function (e) {
                return this.pushStack(et(this, e || [], !0))
            },
            filter: function (e) {
                return this.pushStack(et(this, e || [], !1))
            },
            is: function (e) {
                return !!et(this, "string" == typeof e && Q.test(e) ? x(e) : e || [], !1).length
            },
            closest: function (e, t) {
                var n, r = 0,
                    i = this.length,
                    o = [],
                    s = Q.test(e) || "string" != typeof e ? x(e, t || this.context) : 0;
                for (; i > r; r++)
                    for (n = this[r]; n && n !== t; n = n.parentNode)
                        if (11 > n.nodeType && (s ? s.index(n) > -1 : 1 === n.nodeType && x.find.matchesSelector(n, e))) {
                            n = o.push(n);
                            break
                        }
                return this.pushStack(o.length > 1 ? x.unique(o) : o)
            },
            index: function (e) {
                return e ? "string" == typeof e ? g.call(x(e), this[0]) : g.call(this, e.jquery ? e[0] : e) : this[0] && this[0].parentNode ? this.first().prevAll().length : -1
            },
            add: function (e, t) {
                var n = "string" == typeof e ? x(e, t) : x.makeArray(e && e.nodeType ? [e] : e),
                    r = x.merge(this.get(), n);
                return this.pushStack(x.unique(r))
            },
            addBack: function (e) {
                return this.add(null == e ? this.prevObject : this.prevObject.filter(e))
            }
        });

        function Z(e, t) {
            while ((e = e[t]) && 1 !== e.nodeType);
            return e
        }
        x.each({
            parent: function (e) {
                var t = e.parentNode;
                return t && 11 !== t.nodeType ? t : null
            },
            parents: function (e) {
                return x.dir(e, "parentNode")
            },
            parentsUntil: function (e, t, n) {
                return x.dir(e, "parentNode", n)
            },
            next: function (e) {
                return Z(e, "nextSibling")
            },
            prev: function (e) {
                return Z(e, "previousSibling")
            },
            nextAll: function (e) {
                return x.dir(e, "nextSibling")
            },
            prevAll: function (e) {
                return x.dir(e, "previousSibling")
            },
            nextUntil: function (e, t, n) {
                return x.dir(e, "nextSibling", n)
            },
            prevUntil: function (e, t, n) {
                return x.dir(e, "previousSibling", n)
            },
            siblings: function (e) {
                return x.sibling((e.parentNode || {}).firstChild, e)
            },
            children: function (e) {
                return x.sibling(e.firstChild)
            },
            contents: function (e) {
                return e.contentDocument || x.merge([], e.childNodes)
            }
        }, function (e, t) {
            x.fn[e] = function (n, r) {
                var i = x.map(this, t, n);
                return "Until" !== e.slice(-5) && (r = n), r && "string" == typeof r && (i = x.filter(r, i)), this.length > 1 && (K[e] || x.unique(i), J.test(e) && i.reverse()), this.pushStack(i)
            }
        }), x.extend({
            filter: function (e, t, n) {
                var r = t[0];
                return n && (e = ":not(" + e + ")"), 1 === t.length && 1 === r.nodeType ? x.find.matchesSelector(r, e) ? [r] : [] : x.find.matches(e, x.grep(t, function (e) {
                    return 1 === e.nodeType
                }))
            },
            dir: function (e, t, n) {
                var r = [],
                    i = n !== undefined;
                while ((e = e[t]) && 9 !== e.nodeType)
                    if (1 === e.nodeType) {
                        if (i && x(e).is(n)) break;
                        r.push(e)
                    }
                return r
            },
            sibling: function (e, t) {
                var n = [];
                for (; e; e = e.nextSibling) 1 === e.nodeType && e !== t && n.push(e);
                return n
            }
        });

        function et(e, t, n) {
            if (x.isFunction(t)) return x.grep(e, function (e, r) {
                return !!t.call(e, r, e) !== n
            });
            if (t.nodeType) return x.grep(e, function (e) {
                return e === t !== n
            });
            if ("string" == typeof t) {
                if (G.test(t)) return x.filter(t, e, n);
                t = x.filter(t, e)
            }
            return x.grep(e, function (e) {
                return g.call(t, e) >= 0 !== n
            })
        }
        var tt = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
            nt = /<([\w:]+)/,
            rt = /<|&#?\w+;/,
            it = /<(?:script|style|link)/i,
            ot = /^(?:checkbox|radio)$/i,
            st = /checked\s*(?:[^=]|=\s*.checked.)/i,
            at = /^$|\/(?:java|ecma)script/i,
            ut = /^true\/(.*)/,
            lt = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,
            ct = {
                option: [1, "<select multiple='multiple'>", "</select>"],
                thead: [1, "<table>", "</table>"],
                col: [2, "<table><colgroup>", "</colgroup></table>"],
                tr: [2, "<table><tbody>", "</tbody></table>"],
                td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
                _default: [0, "", ""]
            };
        ct.optgroup = ct.option, ct.tbody = ct.tfoot = ct.colgroup = ct.caption = ct.thead, ct.th = ct.td, x.fn.extend({
            text: function (e) {
                return x.access(this, function (e) {
                    return e === undefined ? x.text(this) : this.empty().append((this[0] && this[0].ownerDocument || o).createTextNode(e))
                }, null, e, arguments.length)
            },
            append: function () {
                return this.domManip(arguments, function (e) {
                    if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                        var t = pt(this, e);
                        t.appendChild(e)
                    }
                })
            },
            prepend: function () {
                return this.domManip(arguments, function (e) {
                    if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                        var t = pt(this, e);
                        t.insertBefore(e, t.firstChild)
                    }
                })
            },
            before: function () {
                return this.domManip(arguments, function (e) {
                    this.parentNode && this.parentNode.insertBefore(e, this)
                })
            },
            after: function () {
                return this.domManip(arguments, function (e) {
                    this.parentNode && this.parentNode.insertBefore(e, this.nextSibling)
                })
            },
            remove: function (e, t) {
                var n, r = e ? x.filter(e, this) : this,
                    i = 0;
                for (; null != (n = r[i]); i++) t || 1 !== n.nodeType || x.cleanData(mt(n)), n.parentNode && (t && x.contains(n.ownerDocument, n) && dt(mt(n, "script")), n.parentNode.removeChild(n));
                return this
            },
            empty: function () {
                var e, t = 0;
                for (; null != (e = this[t]); t++) 1 === e.nodeType && (x.cleanData(mt(e, !1)), e.textContent = "");
                return this
            },
            clone: function (e, t) {
                return e = null == e ? !1 : e, t = null == t ? e : t, this.map(function () {
                    return x.clone(this, e, t)
                })
            },
            html: function (e) {
                return x.access(this, function (e) {
                    var t = this[0] || {},
                        n = 0,
                        r = this.length;
                    if (e === undefined && 1 === t.nodeType) return t.innerHTML;
                    if ("string" == typeof e && !it.test(e) && !ct[(nt.exec(e) || ["", ""])[1].toLowerCase()]) {
                        e = e.replace(tt, "<$1></$2>");
                        try {
                            for (; r > n; n++) t = this[n] || {}, 1 === t.nodeType && (x.cleanData(mt(t, !1)), t.innerHTML = e);
                            t = 0
                        } catch (i) {}
                    }
                    t && this.empty().append(e)
                }, null, e, arguments.length)
            },
            replaceWith: function () {
                var e = x.map(this, function (e) {
                        return [e.nextSibling, e.parentNode]
                    }),
                    t = 0;
                return this.domManip(arguments, function (n) {
                    var r = e[t++],
                        i = e[t++];
                    i && (r && r.parentNode !== i && (r = this.nextSibling), x(this).remove(), i.insertBefore(n, r))
                }, !0), t ? this : this.remove()
            },
            detach: function (e) {
                return this.remove(e, !0)
            },
            domManip: function (e, t, n) {
                e = f.apply([], e);
                var r, i, o, s, a, u, l = 0,
                    c = this.length,
                    p = this,
                    h = c - 1,
                    d = e[0],
                    g = x.isFunction(d);
                if (g || !(1 >= c || "string" != typeof d || x.support.checkClone) && st.test(d)) return this.each(function (r) {
                    var i = p.eq(r);
                    g && (e[0] = d.call(this, r, i.html())), i.domManip(e, t, n)
                });
                if (c && (r = x.buildFragment(e, this[0].ownerDocument, !1, !n && this), i = r.firstChild, 1 === r.childNodes.length && (r = i), i)) {
                    for (o = x.map(mt(r, "script"), ft), s = o.length; c > l; l++) a = r, l !== h && (a = x.clone(a, !0, !0), s && x.merge(o, mt(a, "script"))), t.call(this[l], a, l);
                    if (s)
                        for (u = o[o.length - 1].ownerDocument, x.map(o, ht), l = 0; s > l; l++) a = o[l], at.test(a.type || "") && !H.access(a, "globalEval") && x.contains(u, a) && (a.src ? x._evalUrl(a.src) : x.globalEval(a.textContent.replace(lt, "")))
                }
                return this
            }
        }), x.each({
            appendTo: "append",
            prependTo: "prepend",
            insertBefore: "before",
            insertAfter: "after",
            replaceAll: "replaceWith"
        }, function (e, t) {
            x.fn[e] = function (e) {
                var n, r = [],
                    i = x(e),
                    o = i.length - 1,
                    s = 0;
                for (; o >= s; s++) n = s === o ? this : this.clone(!0), x(i[s])[t](n), h.apply(r, n.get());
                return this.pushStack(r)
            }
        }), x.extend({
            clone: function (e, t, n) {
                var r, i, o, s, a = e.cloneNode(!0),
                    u = x.contains(e.ownerDocument, e);
                if (!(x.support.noCloneChecked || 1 !== e.nodeType && 11 !== e.nodeType || x.isXMLDoc(e)))
                    for (s = mt(a), o = mt(e), r = 0, i = o.length; i > r; r++) yt(o[r], s[r]);
                if (t)
                    if (n)
                        for (o = o || mt(e), s = s || mt(a), r = 0, i = o.length; i > r; r++) gt(o[r], s[r]);
                    else gt(e, a);
                return s = mt(a, "script"), s.length > 0 && dt(s, !u && mt(e, "script")), a
            },
            buildFragment: function (e, t, n, r) {
                var i, o, s, a, u, l, c = 0,
                    p = e.length,
                    f = t.createDocumentFragment(),
                    h = [];
                for (; p > c; c++)
                    if (i = e[c], i || 0 === i)
                        if ("object" === x.type(i)) x.merge(h, i.nodeType ? [i] : i);
                        else if (rt.test(i)) {
                    o = o || f.appendChild(t.createElement("div")), s = (nt.exec(i) || ["", ""])[1].toLowerCase(), a = ct[s] || ct._default, o.innerHTML = a[1] + i.replace(tt, "<$1></$2>") + a[2], l = a[0];
                    while (l--) o = o.firstChild;
                    x.merge(h, o.childNodes), o = f.firstChild, o.textContent = ""
                } else h.push(t.createTextNode(i));
                f.textContent = "", c = 0;
                while (i = h[c++])
                    if ((!r || -1 === x.inArray(i, r)) && (u = x.contains(i.ownerDocument, i), o = mt(f.appendChild(i), "script"), u && dt(o), n)) {
                        l = 0;
                        while (i = o[l++]) at.test(i.type || "") && n.push(i)
                    }
                return f
            },
            cleanData: function (e) {
                var t, n, r, i, o, s, a = x.event.special,
                    u = 0;
                for (;
                    (n = e[u]) !== undefined; u++) {
                    if (F.accepts(n) && (o = n[H.expando], o && (t = H.cache[o]))) {
                        if (r = Object.keys(t.events || {}), r.length)
                            for (s = 0;
                                (i = r[s]) !== undefined; s++) a[i] ? x.event.remove(n, i) : x.removeEvent(n, i, t.handle);
                        H.cache[o] && delete H.cache[o]
                    }
                    delete L.cache[n[L.expando]]
                }
            },
            _evalUrl: function (e) {
                return x.ajax({
                    url: e,
                    type: "GET",
                    dataType: "script",
                    async: !1,
                    global: !1,
                    "throws": !0
                })
            }
        });

        function pt(e, t) {
            return x.nodeName(e, "table") && x.nodeName(1 === t.nodeType ? t : t.firstChild, "tr") ? e.getElementsByTagName("tbody")[0] || e.appendChild(e.ownerDocument.createElement("tbody")) : e
        }

        function ft(e) {
            return e.type = (null !== e.getAttribute("type")) + "/" + e.type, e
        }

        function ht(e) {
            var t = ut.exec(e.type);
            return t ? e.type = t[1] : e.removeAttribute("type"), e
        }

        function dt(e, t) {
            var n = e.length,
                r = 0;
            for (; n > r; r++) H.set(e[r], "globalEval", !t || H.get(t[r], "globalEval"))
        }

        function gt(e, t) {
            var n, r, i, o, s, a, u, l;
            if (1 === t.nodeType) {
                if (H.hasData(e) && (o = H.access(e), s = H.set(t, o), l = o.events)) {
                    delete s.handle, s.events = {};
                    for (i in l)
                        for (n = 0, r = l[i].length; r > n; n++) x.event.add(t, i, l[i][n])
                }
                L.hasData(e) && (a = L.access(e), u = x.extend({}, a), L.set(t, u))
            }
        }

        function mt(e, t) {
            var n = e.getElementsByTagName ? e.getElementsByTagName(t || "*") : e.querySelectorAll ? e.querySelectorAll(t || "*") : [];
            return t === undefined || t && x.nodeName(e, t) ? x.merge([e], n) : n
        }

        function yt(e, t) {
            var n = t.nodeName.toLowerCase();
            "input" === n && ot.test(e.type) ? t.checked = e.checked : ("input" === n || "textarea" === n) && (t.defaultValue = e.defaultValue)
        }
        x.fn.extend({
            wrapAll: function (e) {
                var t;
                return x.isFunction(e) ? this.each(function (t) {
                    x(this).wrapAll(e.call(this, t))
                }) : (this[0] && (t = x(e, this[0].ownerDocument).eq(0).clone(!0), this[0].parentNode && t.insertBefore(this[0]), t.map(function () {
                    var e = this;
                    while (e.firstElementChild) e = e.firstElementChild;
                    return e
                }).append(this)), this)
            },
            wrapInner: function (e) {
                return x.isFunction(e) ? this.each(function (t) {
                    x(this).wrapInner(e.call(this, t))
                }) : this.each(function () {
                    var t = x(this),
                        n = t.contents();
                    n.length ? n.wrapAll(e) : t.append(e)
                })
            },
            wrap: function (e) {
                var t = x.isFunction(e);
                return this.each(function (n) {
                    x(this).wrapAll(t ? e.call(this, n) : e)
                })
            },
            unwrap: function () {
                return this.parent().each(function () {
                    x.nodeName(this, "body") || x(this).replaceWith(this.childNodes)
                }).end()
            }
        });
        var vt, xt, bt = /^(none|table(?!-c[ea]).+)/,
            wt = /^margin/,
            Tt = RegExp("^(" + b + ")(.*)$", "i"),
            Ct = RegExp("^(" + b + ")(?!px)[a-z%]+$", "i"),
            kt = RegExp("^([+-])=(" + b + ")", "i"),
            Nt = {
                BODY: "block"
            },
            Et = {
                position: "absolute",
                visibility: "hidden",
                display: "block"
            },
            St = {
                letterSpacing: 0,
                fontWeight: 400
            },
            jt = ["Top", "Right", "Bottom", "Left"],
            Dt = ["Webkit", "O", "Moz", "ms"];

        function At(e, t) {
            if (t in e) return t;
            var n = t.charAt(0).toUpperCase() + t.slice(1),
                r = t,
                i = Dt.length;
            while (i--)
                if (t = Dt[i] + n, t in e) return t;
            return r
        }

        function Lt(e, t) {
            return e = t || e, "none" === x.css(e, "display") || !x.contains(e.ownerDocument, e)
        }

        function Ht(t) {
            return e.getComputedStyle(t, null)
        }

        function qt(e, t) {
            var n, r, i, o = [],
                s = 0,
                a = e.length;
            for (; a > s; s++) r = e[s], r.style && (o[s] = H.get(r, "olddisplay"), n = r.style.display, t ? (o[s] || "none" !== n || (r.style.display = ""), "" === r.style.display && Lt(r) && (o[s] = H.access(r, "olddisplay", Rt(r.nodeName)))) : o[s] || (i = Lt(r), (n && "none" !== n || !i) && H.set(r, "olddisplay", i ? n : x.css(r, "display"))));
            for (s = 0; a > s; s++) r = e[s], r.style && (t && "none" !== r.style.display && "" !== r.style.display || (r.style.display = t ? o[s] || "" : "none"));
            return e
        }
        x.fn.extend({
            css: function (e, t) {
                return x.access(this, function (e, t, n) {
                    var r, i, o = {},
                        s = 0;
                    if (x.isArray(t)) {
                        for (r = Ht(e), i = t.length; i > s; s++) o[t[s]] = x.css(e, t[s], !1, r);
                        return o
                    }
                    return n !== undefined ? x.style(e, t, n) : x.css(e, t)
                }, e, t, arguments.length > 1)
            },
            show: function () {
                return qt(this, !0)
            },
            hide: function () {
                return qt(this)
            },
            toggle: function (e) {
                var t = "boolean" == typeof e;
                return this.each(function () {
                    (t ? e : Lt(this)) ? x(this).show(): x(this).hide()
                })
            }
        }), x.extend({
            cssHooks: {
                opacity: {
                    get: function (e, t) {
                        if (t) {
                            var n = vt(e, "opacity");
                            return "" === n ? "1" : n
                        }
                    }
                }
            },
            cssNumber: {
                columnCount: !0,
                fillOpacity: !0,
                fontWeight: !0,
                lineHeight: !0,
                opacity: !0,
                orphans: !0,
                widows: !0,
                zIndex: !0,
                zoom: !0
            },
            cssProps: {
                "float": "cssFloat"
            },
            style: function (e, t, n, r) {
                if (e && 3 !== e.nodeType && 8 !== e.nodeType && e.style) {
                    var i, o, s, a = x.camelCase(t),
                        u = e.style;
                    return t = x.cssProps[a] || (x.cssProps[a] = At(u, a)), s = x.cssHooks[t] || x.cssHooks[a], n === undefined ? s && "get" in s && (i = s.get(e, !1, r)) !== undefined ? i : u[t] : (o = typeof n, "string" === o && (i = kt.exec(n)) && (n = (i[1] + 1) * i[2] + parseFloat(x.css(e, t)), o = "number"), null == n || "number" === o && isNaN(n) || ("number" !== o || x.cssNumber[a] || (n += "px"), x.support.clearCloneStyle || "" !== n || 0 !== t.indexOf("background") || (u[t] = "inherit"), s && "set" in s && (n = s.set(e, n, r)) === undefined || (u[t] = n)), undefined)
                }
            },
            css: function (e, t, n, r) {
                var i, o, s, a = x.camelCase(t);
                return t = x.cssProps[a] || (x.cssProps[a] = At(e.style, a)), s = x.cssHooks[t] || x.cssHooks[a], s && "get" in s && (i = s.get(e, !0, n)), i === undefined && (i = vt(e, t, r)), "normal" === i && t in St && (i = St[t]), "" === n || n ? (o = parseFloat(i), n === !0 || x.isNumeric(o) ? o || 0 : i) : i
            }
        }), vt = function (e, t, n) {
            var r, i, o, s = n || Ht(e),
                a = s ? s.getPropertyValue(t) || s[t] : undefined,
                u = e.style;
            return s && ("" !== a || x.contains(e.ownerDocument, e) || (a = x.style(e, t)), Ct.test(a) && wt.test(t) && (r = u.width, i = u.minWidth, o = u.maxWidth, u.minWidth = u.maxWidth = u.width = a, a = s.width, u.width = r, u.minWidth = i, u.maxWidth = o)), a
        };

        function Ot(e, t, n) {
            var r = Tt.exec(t);
            return r ? Math.max(0, r[1] - (n || 0)) + (r[2] || "px") : t
        }

        function Ft(e, t, n, r, i) {
            var o = n === (r ? "border" : "content") ? 4 : "width" === t ? 1 : 0,
                s = 0;
            for (; 4 > o; o += 2) "margin" === n && (s += x.css(e, n + jt[o], !0, i)), r ? ("content" === n && (s -= x.css(e, "padding" + jt[o], !0, i)), "margin" !== n && (s -= x.css(e, "border" + jt[o] + "Width", !0, i))) : (s += x.css(e, "padding" + jt[o], !0, i), "padding" !== n && (s += x.css(e, "border" + jt[o] + "Width", !0, i)));
            return s
        }

        function Pt(e, t, n) {
            var r = !0,
                i = "width" === t ? e.offsetWidth : e.offsetHeight,
                o = Ht(e),
                s = x.support.boxSizing && "border-box" === x.css(e, "boxSizing", !1, o);
            if (0 >= i || null == i) {
                if (i = vt(e, t, o), (0 > i || null == i) && (i = e.style[t]), Ct.test(i)) return i;
                r = s && (x.support.boxSizingReliable || i === e.style[t]), i = parseFloat(i) || 0
            }
            return i + Ft(e, t, n || (s ? "border" : "content"), r, o) + "px"
        }

        function Rt(e) {
            var t = o,
                n = Nt[e];
            return n || (n = Mt(e, t), "none" !== n && n || (xt = (xt || x("<iframe frameborder='0' width='0' height='0'/>").css("cssText", "display:block !important")).appendTo(t.documentElement), t = (xt[0].contentWindow || xt[0].contentDocument).document, t.write("<!doctype html><html><body>"), t.close(), n = Mt(e, t), xt.detach()), Nt[e] = n), n
        }

        function Mt(e, t) {
            var n = x(t.createElement(e)).appendTo(t.body),
                r = x.css(n[0], "display");
            return n.remove(), r
        }
        x.each(["height", "width"], function (e, t) {
            x.cssHooks[t] = {
                get: function (e, n, r) {
                    return n ? 0 === e.offsetWidth && bt.test(x.css(e, "display")) ? x.swap(e, Et, function () {
                        return Pt(e, t, r)
                    }) : Pt(e, t, r) : undefined
                },
                set: function (e, n, r) {
                    var i = r && Ht(e);
                    return Ot(e, n, r ? Ft(e, t, r, x.support.boxSizing && "border-box" === x.css(e, "boxSizing", !1, i), i) : 0)
                }
            }
        }), x(function () {
            x.support.reliableMarginRight || (x.cssHooks.marginRight = {
                get: function (e, t) {
                    return t ? x.swap(e, {
                        display: "inline-block"
                    }, vt, [e, "marginRight"]) : undefined
                }
            }), !x.support.pixelPosition && x.fn.position && x.each(["top", "left"], function (e, t) {
                x.cssHooks[t] = {
                    get: function (e, n) {
                        return n ? (n = vt(e, t), Ct.test(n) ? x(e).position()[t] + "px" : n) : undefined
                    }
                }
            })
        }), x.expr && x.expr.filters && (x.expr.filters.hidden = function (e) {
            return 0 >= e.offsetWidth && 0 >= e.offsetHeight
        }, x.expr.filters.visible = function (e) {
            return !x.expr.filters.hidden(e)
        }), x.each({
            margin: "",
            padding: "",
            border: "Width"
        }, function (e, t) {
            x.cssHooks[e + t] = {
                expand: function (n) {
                    var r = 0,
                        i = {},
                        o = "string" == typeof n ? n.split(" ") : [n];
                    for (; 4 > r; r++) i[e + jt[r] + t] = o[r] || o[r - 2] || o[0];
                    return i
                }
            }, wt.test(e) || (x.cssHooks[e + t].set = Ot)
        });
        var Wt = /%20/g,
            $t = /\[\]$/,
            Bt = /\r?\n/g,
            It = /^(?:submit|button|image|reset|file)$/i,
            zt = /^(?:input|select|textarea|keygen)/i;
        x.fn.extend({
            serialize: function () {
                return x.param(this.serializeArray())
            },
            serializeArray: function () {
                return this.map(function () {
                    var e = x.prop(this, "elements");
                    return e ? x.makeArray(e) : this
                }).filter(function () {
                    var e = this.type;
                    return this.name && !x(this).is(":disabled") && zt.test(this.nodeName) && !It.test(e) && (this.checked || !ot.test(e))
                }).map(function (e, t) {
                    var n = x(this).val();
                    return null == n ? null : x.isArray(n) ? x.map(n, function (e) {
                        return {
                            name: t.name,
                            value: e.replace(Bt, "\r\n")
                        }
                    }) : {
                        name: t.name,
                        value: n.replace(Bt, "\r\n")
                    }
                }).get()
            }
        }), x.param = function (e, t) {
            var n, r = [],
                i = function (e, t) {
                    t = x.isFunction(t) ? t() : null == t ? "" : t, r[r.length] = encodeURIComponent(e) + "=" + encodeURIComponent(t)
                };
            if (t === undefined && (t = x.ajaxSettings && x.ajaxSettings.traditional), x.isArray(e) || e.jquery && !x.isPlainObject(e)) x.each(e, function () {
                i(this.name, this.value)
            });
            else
                for (n in e) _t(n, e[n], t, i);
            return r.join("&").replace(Wt, "+")
        };

        function _t(e, t, n, r) {
            var i;
            if (x.isArray(t)) x.each(t, function (t, i) {
                n || $t.test(e) ? r(e, i) : _t(e + "[" + ("object" == typeof i ? t : "") + "]", i, n, r)
            });
            else if (n || "object" !== x.type(t)) r(e, t);
            else
                for (i in t) _t(e + "[" + i + "]", t[i], n, r)
        }
        x.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "), function (e, t) {
            x.fn[t] = function (e, n) {
                return arguments.length > 0 ? this.on(t, null, e, n) : this.trigger(t)
            }
        }), x.fn.extend({
            hover: function (e, t) {
                return this.mouseenter(e).mouseleave(t || e)
            },
            bind: function (e, t, n) {
                return this.on(e, null, t, n)
            },
            unbind: function (e, t) {
                return this.off(e, null, t)
            },
            delegate: function (e, t, n, r) {
                return this.on(t, e, n, r)
            },
            undelegate: function (e, t, n) {
                return 1 === arguments.length ? this.off(e, "**") : this.off(t, e || "**", n)
            }
        });
        var Xt, Ut, Yt = x.now(),
            Vt = /\?/,
            Gt = /#.*$/,
            Jt = /([?&])_=[^&]*/,
            Qt = /^(.*?):[ \t]*([^\r\n]*)$/gm,
            Kt = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
            Zt = /^(?:GET|HEAD)$/,
            en = /^\/\//,
            tn = /^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,
            nn = x.fn.load,
            rn = {},
            on = {},
            sn = "*/".concat("*");
        try {
            Ut = i.href
        } catch (an) {
            Ut = o.createElement("a"), Ut.href = "", Ut = Ut.href
        }
        Xt = tn.exec(Ut.toLowerCase()) || [];

        function un(e) {
            return function (t, n) {
                "string" != typeof t && (n = t, t = "*");
                var r, i = 0,
                    o = t.toLowerCase().match(w) || [];
                if (x.isFunction(n))
                    while (r = o[i++]) "+" === r[0] ? (r = r.slice(1) || "*", (e[r] = e[r] || []).unshift(n)) : (e[r] = e[r] || []).push(n)
            }
        }

        function ln(e, t, n, r) {
            var i = {},
                o = e === on;

            function s(a) {
                var u;
                return i[a] = !0, x.each(e[a] || [], function (e, a) {
                    var l = a(t, n, r);
                    return "string" != typeof l || o || i[l] ? o ? !(u = l) : undefined : (t.dataTypes.unshift(l), s(l), !1)
                }), u
            }
            return s(t.dataTypes[0]) || !i["*"] && s("*")
        }

        function cn(e, t) {
            var n, r, i = x.ajaxSettings.flatOptions || {};
            for (n in t) t[n] !== undefined && ((i[n] ? e : r || (r = {}))[n] = t[n]);
            return r && x.extend(!0, e, r), e
        }
        x.fn.load = function (e, t, n) {
            if ("string" != typeof e && nn) return nn.apply(this, arguments);
            var r, i, o, s = this,
                a = e.indexOf(" ");
            return a >= 0 && (r = e.slice(a), e = e.slice(0, a)), x.isFunction(t) ? (n = t, t = undefined) : t && "object" == typeof t && (i = "POST"), s.length > 0 && x.ajax({
                url: e,
                type: i,
                dataType: "html",
                data: t
            }).done(function (e) {
                o = arguments, s.html(r ? x("<div>").append(x.parseHTML(e)).find(r) : e)
            }).complete(n && function (e, t) {
                s.each(n, o || [e.responseText, t, e])
            }), this
        }, x.each(["ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend"], function (e, t) {
            x.fn[t] = function (e) {
                return this.on(t, e)
            }
        }), x.extend({
            active: 0,
            lastModified: {},
            etag: {},
            ajaxSettings: {
                url: Ut,
                type: "GET",
                isLocal: Kt.test(Xt[1]),
                global: !0,
                processData: !0,
                async: !0,
                contentType: "application/x-www-form-urlencoded; charset=UTF-8",
                accepts: {
                    "*": sn,
                    text: "text/plain",
                    html: "text/html",
                    xml: "application/xml, text/xml",
                    json: "application/json, text/javascript"
                },
                contents: {
                    xml: /xml/,
                    html: /html/,
                    json: /json/
                },
                responseFields: {
                    xml: "responseXML",
                    text: "responseText",
                    json: "responseJSON"
                },
                converters: {
                    "* text": String,
                    "text html": !0,
                    "text json": x.parseJSON,
                    "text xml": x.parseXML
                },
                flatOptions: {
                    url: !0,
                    context: !0
                }
            },
            ajaxSetup: function (e, t) {
                return t ? cn(cn(e, x.ajaxSettings), t) : cn(x.ajaxSettings, e)
            },
            ajaxPrefilter: un(rn),
            ajaxTransport: un(on),
            ajax: function (e, t) {
                "object" == typeof e && (t = e, e = undefined), t = t || {};
                var n, r, i, o, s, a, u, l, c = x.ajaxSetup({}, t),
                    p = c.context || c,
                    f = c.context && (p.nodeType || p.jquery) ? x(p) : x.event,
                    h = x.Deferred(),
                    d = x.Callbacks("once memory"),
                    g = c.statusCode || {},
                    m = {},
                    y = {},
                    v = 0,
                    b = "canceled",
                    T = {
                        readyState: 0,
                        getResponseHeader: function (e) {
                            var t;
                            if (2 === v) {
                                if (!o) {
                                    o = {};
                                    while (t = Qt.exec(i)) o[t[1].toLowerCase()] = t[2]
                                }
                                t = o[e.toLowerCase()]
                            }
                            return null == t ? null : t
                        },
                        getAllResponseHeaders: function () {
                            return 2 === v ? i : null
                        },
                        setRequestHeader: function (e, t) {
                            var n = e.toLowerCase();
                            return v || (e = y[n] = y[n] || e, m[e] = t), this
                        },
                        overrideMimeType: function (e) {
                            return v || (c.mimeType = e), this
                        },
                        statusCode: function (e) {
                            var t;
                            if (e)
                                if (2 > v)
                                    for (t in e) g[t] = [g[t], e[t]];
                                else T.always(e[T.status]);
                            return this
                        },
                        abort: function (e) {
                            var t = e || b;
                            return n && n.abort(t), k(0, t), this
                        }
                    };
                if (h.promise(T).complete = d.add, T.success = T.done, T.error = T.fail, c.url = ((e || c.url || Ut) + "").replace(Gt, "").replace(en, Xt[1] + "//"), c.type = t.method || t.type || c.method || c.type, c.dataTypes = x.trim(c.dataType || "*").toLowerCase().match(w) || [""], null == c.crossDomain && (a = tn.exec(c.url.toLowerCase()), c.crossDomain = !(!a || a[1] === Xt[1] && a[2] === Xt[2] && (a[3] || ("http:" === a[1] ? "80" : "443")) === (Xt[3] || ("http:" === Xt[1] ? "80" : "443")))), c.data && c.processData && "string" != typeof c.data && (c.data = x.param(c.data, c.traditional)), ln(rn, c, t, T), 2 === v) return T;
                u = c.global, u && 0 === x.active++ && x.event.trigger("ajaxStart"), c.type = c.type.toUpperCase(), c.hasContent = !Zt.test(c.type), r = c.url, c.hasContent || (c.data && (r = c.url += (Vt.test(r) ? "&" : "?") + c.data, delete c.data), c.cache === !1 && (c.url = Jt.test(r) ? r.replace(Jt, "$1_=" + Yt++) : r + (Vt.test(r) ? "&" : "?") + "_=" + Yt++)), c.ifModified && (x.lastModified[r] && T.setRequestHeader("If-Modified-Since", x.lastModified[r]), x.etag[r] && T.setRequestHeader("If-None-Match", x.etag[r])), (c.data && c.hasContent && c.contentType !== !1 || t.contentType) && T.setRequestHeader("Content-Type", c.contentType), T.setRequestHeader("Accept", c.dataTypes[0] && c.accepts[c.dataTypes[0]] ? c.accepts[c.dataTypes[0]] + ("*" !== c.dataTypes[0] ? ", " + sn + "; q=0.01" : "") : c.accepts["*"]);
                for (l in c.headers) T.setRequestHeader(l, c.headers[l]);
                if (c.beforeSend && (c.beforeSend.call(p, T, c) === !1 || 2 === v)) return T.abort();
                b = "abort";
                for (l in {
                    success: 1,
                    error: 1,
                    complete: 1
                }) T[l](c[l]);
                if (n = ln(on, c, t, T)) {
                    T.readyState = 1, u && f.trigger("ajaxSend", [T, c]), c.async && c.timeout > 0 && (s = setTimeout(function () {
                        T.abort("timeout")
                    }, c.timeout));
                    try {
                        v = 1, n.send(m, k)
                    } catch (C) {
                        if (!(2 > v)) throw C;
                        k(-1, C)
                    }
                } else k(-1, "No Transport");

                function k(e, t, o, a) {
                    var l, m, y, b, w, C = t;
                    2 !== v && (v = 2, s && clearTimeout(s), n = undefined, i = a || "", T.readyState = e > 0 ? 4 : 0, l = e >= 200 && 300 > e || 304 === e, o && (b = pn(c, T, o)), b = fn(c, b, T, l), l ? (c.ifModified && (w = T.getResponseHeader("Last-Modified"), w && (x.lastModified[r] = w), w = T.getResponseHeader("etag"), w && (x.etag[r] = w)), 204 === e || "HEAD" === c.type ? C = "nocontent" : 304 === e ? C = "notmodified" : (C = b.state, m = b.data, y = b.error, l = !y)) : (y = C, (e || !C) && (C = "error", 0 > e && (e = 0))), T.status = e, T.statusText = (t || C) + "", l ? h.resolveWith(p, [m, C, T]) : h.rejectWith(p, [T, C, y]), T.statusCode(g), g = undefined, u && f.trigger(l ? "ajaxSuccess" : "ajaxError", [T, c, l ? m : y]), d.fireWith(p, [T, C]), u && (f.trigger("ajaxComplete", [T, c]), --x.active || x.event.trigger("ajaxStop")))
                }
                return T
            },
            getJSON: function (e, t, n) {
                return x.get(e, t, n, "json")
            },
            getScript: function (e, t) {
                return x.get(e, undefined, t, "script")
            }
        }), x.each(["get", "post"], function (e, t) {
            x[t] = function (e, n, r, i) {
                return x.isFunction(n) && (i = i || r, r = n, n = undefined), x.ajax({
                    url: e,
                    type: t,
                    dataType: i,
                    data: n,
                    success: r
                })
            }
        });

        function pn(e, t, n) {
            var r, i, o, s, a = e.contents,
                u = e.dataTypes;
            while ("*" === u[0]) u.shift(), r === undefined && (r = e.mimeType || t.getResponseHeader("Content-Type"));
            if (r)
                for (i in a)
                    if (a[i] && a[i].test(r)) {
                        u.unshift(i);
                        break
                    }
            if (u[0] in n) o = u[0];
            else {
                for (i in n) {
                    if (!u[0] || e.converters[i + " " + u[0]]) {
                        o = i;
                        break
                    }
                    s || (s = i)
                }
                o = o || s
            }
            return o ? (o !== u[0] && u.unshift(o), n[o]) : undefined
        }

        function fn(e, t, n, r) {
            var i, o, s, a, u, l = {},
                c = e.dataTypes.slice();
            if (c[1])
                for (s in e.converters) l[s.toLowerCase()] = e.converters[s];
            o = c.shift();
            while (o)
                if (e.responseFields[o] && (n[e.responseFields[o]] = t), !u && r && e.dataFilter && (t = e.dataFilter(t, e.dataType)), u = o, o = c.shift())
                    if ("*" === o) o = u;
                    else if ("*" !== u && u !== o) {
                if (s = l[u + " " + o] || l["* " + o], !s)
                    for (i in l)
                        if (a = i.split(" "), a[1] === o && (s = l[u + " " + a[0]] || l["* " + a[0]])) {
                            s === !0 ? s = l[i] : l[i] !== !0 && (o = a[0], c.unshift(a[1]));
                            break
                        }
                if (s !== !0)
                    if (s && e["throws"]) t = s(t);
                    else try {
                        t = s(t)
                    } catch (p) {
                        return {
                            state: "parsererror",
                            error: s ? p : "No conversion from " + u + " to " + o
                        }
                    }
            }
            return {
                state: "success",
                data: t
            }
        }
        x.ajaxSetup({
            accepts: {
                script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
            },
            contents: {
                script: /(?:java|ecma)script/
            },
            converters: {
                "text script": function (e) {
                    return x.globalEval(e), e
                }
            }
        }), x.ajaxPrefilter("script", function (e) {
            e.cache === undefined && (e.cache = !1), e.crossDomain && (e.type = "GET")
        }), x.ajaxTransport("script", function (e) {
            if (e.crossDomain) {
                var t, n;
                return {
                    send: function (r, i) {
                        t = x("<script>").prop({
                            async: !0,
                            charset: e.scriptCharset,
                            src: e.url
                        }).on("load error", n = function (e) {
                            t.remove(), n = null, e && i("error" === e.type ? 404 : 200, e.type)
                        }), o.head.appendChild(t[0])
                    },
                    abort: function () {
                        n && n()
                    }
                }
            }
        });
        var hn = [],
            dn = /(=)\?(?=&|$)|\?\?/;
        x.ajaxSetup({
            jsonp: "callback",
            jsonpCallback: function () {
                var e = hn.pop() || x.expando + "_" + Yt++;
                return this[e] = !0, e
            }
        }), x.ajaxPrefilter("json jsonp", function (t, n, r) {
            var i, o, s, a = t.jsonp !== !1 && (dn.test(t.url) ? "url" : "string" == typeof t.data && !(t.contentType || "").indexOf("application/x-www-form-urlencoded") && dn.test(t.data) && "data");
            return a || "jsonp" === t.dataTypes[0] ? (i = t.jsonpCallback = x.isFunction(t.jsonpCallback) ? t.jsonpCallback() : t.jsonpCallback, a ? t[a] = t[a].replace(dn, "$1" + i) : t.jsonp !== !1 && (t.url += (Vt.test(t.url) ? "&" : "?") + t.jsonp + "=" + i), t.converters["script json"] = function () {
                return s || x.error(i + " was not called"), s[0]
            }, t.dataTypes[0] = "json", o = e[i], e[i] = function () {
                s = arguments
            }, r.always(function () {
                e[i] = o, t[i] && (t.jsonpCallback = n.jsonpCallback, hn.push(i)), s && x.isFunction(o) && o(s[0]), s = o = undefined
            }), "script") : undefined
        }), x.ajaxSettings.xhr = function () {
            try {
                return new XMLHttpRequest
            } catch (e) {}
        };
        var gn = x.ajaxSettings.xhr(),
            mn = {
                0: 200,
                1223: 204
            },
            yn = 0,
            vn = {};
        e.ActiveXObject && x(e).on("unload", function () {
            for (var e in vn) vn[e]();
            vn = undefined
        }), x.support.cors = !!gn && "withCredentials" in gn, x.support.ajax = gn = !!gn, x.ajaxTransport(function (e) {
            var t;
            return x.support.cors || gn && !e.crossDomain ? {
                send: function (n, r) {
                    var i, o, s = e.xhr();
                    if (s.open(e.type, e.url, e.async, e.username, e.password), e.xhrFields)
                        for (i in e.xhrFields) s[i] = e.xhrFields[i];
                    e.mimeType && s.overrideMimeType && s.overrideMimeType(e.mimeType), e.crossDomain || n["X-Requested-With"] || (n["X-Requested-With"] = "XMLHttpRequest");
                    for (i in n) s.setRequestHeader(i, n[i]);
                    t = function (e) {
                        return function () {
                            t && (delete vn[o], t = s.onload = s.onerror = null, "abort" === e ? s.abort() : "error" === e ? r(s.status || 404, s.statusText) : r(mn[s.status] || s.status, s.statusText, "string" == typeof s.responseText ? {
                                text: s.responseText
                            } : undefined, s.getAllResponseHeaders()))
                        }
                    }, s.onload = t(), s.onerror = t("error"), t = vn[o = yn++] = t("abort"), s.send(e.hasContent && e.data || null)
                },
                abort: function () {
                    t && t()
                }
            } : undefined
        });
        var xn, bn, wn = /^(?:toggle|show|hide)$/,
            Tn = RegExp("^(?:([+-])=|)(" + b + ")([a-z%]*)$", "i"),
            Cn = /queueHooks$/,
            kn = [An],
            Nn = {
                "*": [

                    function (e, t) {
                        var n = this.createTween(e, t),
                            r = n.cur(),
                            i = Tn.exec(t),
                            o = i && i[3] || (x.cssNumber[e] ? "" : "px"),
                            s = (x.cssNumber[e] || "px" !== o && +r) && Tn.exec(x.css(n.elem, e)),
                            a = 1,
                            u = 20;
                        if (s && s[3] !== o) {
                            o = o || s[3], i = i || [], s = +r || 1;
                            do a = a || ".5", s /= a, x.style(n.elem, e, s + o); while (a !== (a = n.cur() / r) && 1 !== a && --u)
                        }
                        return i && (s = n.start = +s || +r || 0, n.unit = o, n.end = i[1] ? s + (i[1] + 1) * i[2] : +i[2]), n
                    }
                ]
            };

        function En() {
            return setTimeout(function () {
                xn = undefined
            }), xn = x.now()
        }

        function Sn(e, t, n) {
            var r, i = (Nn[t] || []).concat(Nn["*"]),
                o = 0,
                s = i.length;
            for (; s > o; o++)
                if (r = i[o].call(n, t, e)) return r
        }

        function jn(e, t, n) {
            var r, i, o = 0,
                s = kn.length,
                a = x.Deferred().always(function () {
                    delete u.elem
                }),
                u = function () {
                    if (i) return !1;
                    var t = xn || En(),
                        n = Math.max(0, l.startTime + l.duration - t),
                        r = n / l.duration || 0,
                        o = 1 - r,
                        s = 0,
                        u = l.tweens.length;
                    for (; u > s; s++) l.tweens[s].run(o);
                    return a.notifyWith(e, [l, o, n]), 1 > o && u ? n : (a.resolveWith(e, [l]), !1)
                },
                l = a.promise({
                    elem: e,
                    props: x.extend({}, t),
                    opts: x.extend(!0, {
                        specialEasing: {}
                    }, n),
                    originalProperties: t,
                    originalOptions: n,
                    startTime: xn || En(),
                    duration: n.duration,
                    tweens: [],
                    createTween: function (t, n) {
                        var r = x.Tween(e, l.opts, t, n, l.opts.specialEasing[t] || l.opts.easing);
                        return l.tweens.push(r), r
                    },
                    stop: function (t) {
                        var n = 0,
                            r = t ? l.tweens.length : 0;
                        if (i) return this;
                        for (i = !0; r > n; n++) l.tweens[n].run(1);
                        return t ? a.resolveWith(e, [l, t]) : a.rejectWith(e, [l, t]), this
                    }
                }),
                c = l.props;
            for (Dn(c, l.opts.specialEasing); s > o; o++)
                if (r = kn[o].call(l, e, c, l.opts)) return r;
            return x.map(c, Sn, l), x.isFunction(l.opts.start) && l.opts.start.call(e, l), x.fx.timer(x.extend(u, {
                elem: e,
                anim: l,
                queue: l.opts.queue
            })), l.progress(l.opts.progress).done(l.opts.done, l.opts.complete).fail(l.opts.fail).always(l.opts.always)
        }

        function Dn(e, t) {
            var n, r, i, o, s;
            for (n in e)
                if (r = x.camelCase(n), i = t[r], o = e[n], x.isArray(o) && (i = o[1], o = e[n] = o[0]), n !== r && (e[r] = o, delete e[n]), s = x.cssHooks[r], s && "expand" in s) {
                    o = s.expand(o), delete e[r];
                    for (n in o) n in e || (e[n] = o[n], t[n] = i)
                } else t[r] = i
        }
        x.Animation = x.extend(jn, {
            tweener: function (e, t) {
                x.isFunction(e) ? (t = e, e = ["*"]) : e = e.split(" ");
                var n, r = 0,
                    i = e.length;
                for (; i > r; r++) n = e[r], Nn[n] = Nn[n] || [], Nn[n].unshift(t)
            },
            prefilter: function (e, t) {
                t ? kn.unshift(e) : kn.push(e)
            }
        });

        function An(e, t, n) {
            var r, i, o, s, a, u, l = this,
                c = {},
                p = e.style,
                f = e.nodeType && Lt(e),
                h = H.get(e, "fxshow");
            n.queue || (a = x._queueHooks(e, "fx"), null == a.unqueued && (a.unqueued = 0, u = a.empty.fire, a.empty.fire = function () {
                a.unqueued || u()
            }), a.unqueued++, l.always(function () {
                l.always(function () {
                    a.unqueued--, x.queue(e, "fx").length || a.empty.fire()
                })
            })), 1 === e.nodeType && ("height" in t || "width" in t) && (n.overflow = [p.overflow, p.overflowX, p.overflowY], "inline" === x.css(e, "display") && "none" === x.css(e, "float") && (p.display = "inline-block")), n.overflow && (p.overflow = "hidden", l.always(function () {
                p.overflow = n.overflow[0], p.overflowX = n.overflow[1], p.overflowY = n.overflow[2]
            }));
            for (r in t)
                if (i = t[r], wn.exec(i)) {
                    if (delete t[r], o = o || "toggle" === i, i === (f ? "hide" : "show")) {
                        if ("show" !== i || !h || h[r] === undefined) continue;
                        f = !0
                    }
                    c[r] = h && h[r] || x.style(e, r)
                }
            if (!x.isEmptyObject(c)) {
                h ? "hidden" in h && (f = h.hidden) : h = H.access(e, "fxshow", {}), o && (h.hidden = !f), f ? x(e).show() : l.done(function () {
                    x(e).hide()
                }), l.done(function () {
                    var t;
                    H.remove(e, "fxshow");
                    for (t in c) x.style(e, t, c[t])
                });
                for (r in c) s = Sn(f ? h[r] : 0, r, l), r in h || (h[r] = s.start, f && (s.end = s.start, s.start = "width" === r || "height" === r ? 1 : 0))
            }
        }

        function Ln(e, t, n, r, i) {
            return new Ln.prototype.init(e, t, n, r, i)
        }
        x.Tween = Ln, Ln.prototype = {
            constructor: Ln,
            init: function (e, t, n, r, i, o) {
                this.elem = e, this.prop = n, this.easing = i || "swing", this.options = t, this.start = this.now = this.cur(), this.end = r, this.unit = o || (x.cssNumber[n] ? "" : "px")
            },
            cur: function () {
                var e = Ln.propHooks[this.prop];
                return e && e.get ? e.get(this) : Ln.propHooks._default.get(this)
            },
            run: function (e) {
                var t, n = Ln.propHooks[this.prop];
                return this.pos = t = this.options.duration ? x.easing[this.easing](e, this.options.duration * e, 0, 1, this.options.duration) : e, this.now = (this.end - this.start) * t + this.start, this.options.step && this.options.step.call(this.elem, this.now, this), n && n.set ? n.set(this) : Ln.propHooks._default.set(this), this
            }
        }, Ln.prototype.init.prototype = Ln.prototype, Ln.propHooks = {
            _default: {
                get: function (e) {
                    var t;
                    return null == e.elem[e.prop] || e.elem.style && null != e.elem.style[e.prop] ? (t = x.css(e.elem, e.prop, ""), t && "auto" !== t ? t : 0) : e.elem[e.prop]
                },
                set: function (e) {
                    x.fx.step[e.prop] ? x.fx.step[e.prop](e) : e.elem.style && (null != e.elem.style[x.cssProps[e.prop]] || x.cssHooks[e.prop]) ? x.style(e.elem, e.prop, e.now + e.unit) : e.elem[e.prop] = e.now
                }
            }
        }, Ln.propHooks.scrollTop = Ln.propHooks.scrollLeft = {
            set: function (e) {
                e.elem.nodeType && e.elem.parentNode && (e.elem[e.prop] = e.now)
            }
        }, x.each(["toggle", "show", "hide"], function (e, t) {
            var n = x.fn[t];
            x.fn[t] = function (e, r, i) {
                return null == e || "boolean" == typeof e ? n.apply(this, arguments) : this.animate(Hn(t, !0), e, r, i)
            }
        }), x.fn.extend({
            fadeTo: function (e, t, n, r) {
                return this.filter(Lt).css("opacity", 0).show().end().animate({
                    opacity: t
                }, e, n, r)
            },
            animate: function (e, t, n, r) {
                var i = x.isEmptyObject(e),
                    o = x.speed(t, n, r),
                    s = function () {
                        var t = jn(this, x.extend({}, e), o);
                        (i || H.get(this, "finish")) && t.stop(!0)
                    };
                return s.finish = s, i || o.queue === !1 ? this.each(s) : this.queue(o.queue, s)
            },
            stop: function (e, t, n) {
                var r = function (e) {
                    var t = e.stop;
                    delete e.stop, t(n)
                };
                return "string" != typeof e && (n = t, t = e, e = undefined), t && e !== !1 && this.queue(e || "fx", []), this.each(function () {
                    var t = !0,
                        i = null != e && e + "queueHooks",
                        o = x.timers,
                        s = H.get(this);
                    if (i) s[i] && s[i].stop && r(s[i]);
                    else
                        for (i in s) s[i] && s[i].stop && Cn.test(i) && r(s[i]);
                    for (i = o.length; i--;) o[i].elem !== this || null != e && o[i].queue !== e || (o[i].anim.stop(n), t = !1, o.splice(i, 1));
                    (t || !n) && x.dequeue(this, e)
                })
            },
            finish: function (e) {
                return e !== !1 && (e = e || "fx"), this.each(function () {
                    var t, n = H.get(this),
                        r = n[e + "queue"],
                        i = n[e + "queueHooks"],
                        o = x.timers,
                        s = r ? r.length : 0;
                    for (n.finish = !0, x.queue(this, e, []), i && i.stop && i.stop.call(this, !0), t = o.length; t--;) o[t].elem === this && o[t].queue === e && (o[t].anim.stop(!0), o.splice(t, 1));
                    for (t = 0; s > t; t++) r[t] && r[t].finish && r[t].finish.call(this);
                    delete n.finish
                })
            }
        });

        function Hn(e, t) {
            var n, r = {
                    height: e
                },
                i = 0;
            for (t = t ? 1 : 0; 4 > i; i += 2 - t) n = jt[i], r["margin" + n] = r["padding" + n] = e;
            return t && (r.opacity = r.width = e), r
        }
        x.each({
            slideDown: Hn("show"),
            slideUp: Hn("hide"),
            slideToggle: Hn("toggle"),
            fadeIn: {
                opacity: "show"
            },
            fadeOut: {
                opacity: "hide"
            },
            fadeToggle: {
                opacity: "toggle"
            }
        }, function (e, t) {
            x.fn[e] = function (e, n, r) {
                return this.animate(t, e, n, r)
            }
        }), x.speed = function (e, t, n) {
            var r = e && "object" == typeof e ? x.extend({}, e) : {
                complete: n || !n && t || x.isFunction(e) && e,
                duration: e,
                easing: n && t || t && !x.isFunction(t) && t
            };
            return r.duration = x.fx.off ? 0 : "number" == typeof r.duration ? r.duration : r.duration in x.fx.speeds ? x.fx.speeds[r.duration] : x.fx.speeds._default, (null == r.queue || r.queue === !0) && (r.queue = "fx"), r.old = r.complete, r.complete = function () {
                x.isFunction(r.old) && r.old.call(this), r.queue && x.dequeue(this, r.queue)
            }, r
        }, x.easing = {
            linear: function (e) {
                return e
            },
            swing: function (e) {
                return .5 - Math.cos(e * Math.PI) / 2
            }
        }, x.timers = [], x.fx = Ln.prototype.init, x.fx.tick = function () {
            var e, t = x.timers,
                n = 0;
            for (xn = x.now(); t.length > n; n++) e = t[n], e() || t[n] !== e || t.splice(n--, 1);
            t.length || x.fx.stop(), xn = undefined
        }, x.fx.timer = function (e) {
            e() && x.timers.push(e) && x.fx.start()
        }, x.fx.interval = 13, x.fx.start = function () {
            bn || (bn = setInterval(x.fx.tick, x.fx.interval))
        }, x.fx.stop = function () {
            clearInterval(bn), bn = null
        }, x.fx.speeds = {
            slow: 600,
            fast: 200,
            _default: 400
        }, x.fx.step = {}, x.expr && x.expr.filters && (x.expr.filters.animated = function (e) {
            return x.grep(x.timers, function (t) {
                return e === t.elem
            }).length
        }), x.fn.offset = function (e) {
            if (arguments.length) return e === undefined ? this : this.each(function (t) {
                x.offset.setOffset(this, e, t)
            });
            var t, n, i = this[0],
                o = {
                    top: 0,
                    left: 0
                },
                s = i && i.ownerDocument;
            if (s) return t = s.documentElement, x.contains(t, i) ? (typeof i.getBoundingClientRect !== r && (o = i.getBoundingClientRect()), n = qn(s), {
                top: o.top + n.pageYOffset - t.clientTop,
                left: o.left + n.pageXOffset - t.clientLeft
            }) : o
        }, x.offset = {
            setOffset: function (e, t, n) {
                var r, i, o, s, a, u, l, c = x.css(e, "position"),
                    p = x(e),
                    f = {};
                "static" === c && (e.style.position = "relative"), a = p.offset(), o = x.css(e, "top"), u = x.css(e, "left"), l = ("absolute" === c || "fixed" === c) && (o + u).indexOf("auto") > -1, l ? (r = p.position(), s = r.top, i = r.left) : (s = parseFloat(o) || 0, i = parseFloat(u) || 0), x.isFunction(t) && (t = t.call(e, n, a)), null != t.top && (f.top = t.top - a.top + s), null != t.left && (f.left = t.left - a.left + i), "using" in t ? t.using.call(e, f) : p.css(f)
            }
        }, x.fn.extend({
            position: function () {
                if (this[0]) {
                    var e, t, n = this[0],
                        r = {
                            top: 0,
                            left: 0
                        };
                    return "fixed" === x.css(n, "position") ? t = n.getBoundingClientRect() : (e = this.offsetParent(), t = this.offset(), x.nodeName(e[0], "html") || (r = e.offset()), r.top += x.css(e[0], "borderTopWidth", !0), r.left += x.css(e[0], "borderLeftWidth", !0)), {
                        top: t.top - r.top - x.css(n, "marginTop", !0),
                        left: t.left - r.left - x.css(n, "marginLeft", !0)
                    }
                }
            },
            offsetParent: function () {
                return this.map(function () {
                    var e = this.offsetParent || s;
                    while (e && !x.nodeName(e, "html") && "static" === x.css(e, "position")) e = e.offsetParent;
                    return e || s
                })
            }
        }), x.each({
            scrollLeft: "pageXOffset",
            scrollTop: "pageYOffset"
        }, function (t, n) {
            var r = "pageYOffset" === n;
            x.fn[t] = function (i) {
                return x.access(this, function (t, i, o) {
                    var s = qn(t);
                    return o === undefined ? s ? s[n] : t[i] : (s ? s.scrollTo(r ? e.pageXOffset : o, r ? o : e.pageYOffset) : t[i] = o, undefined)
                }, t, i, arguments.length, null)
            }
        });

        function qn(e) {
            return x.isWindow(e) ? e : 9 === e.nodeType && e.defaultView
        }
        x.each({
            Height: "height",
            Width: "width"
        }, function (e, t) {
            x.each({
                padding: "inner" + e,
                content: t,
                "": "outer" + e
            }, function (n, r) {
                x.fn[r] = function (r, i) {
                    var o = arguments.length && (n || "boolean" != typeof r),
                        s = n || (r === !0 || i === !0 ? "margin" : "border");
                    return x.access(this, function (t, n, r) {
                        var i;
                        return x.isWindow(t) ? t.document.documentElement["client" + e] : 9 === t.nodeType ? (i = t.documentElement, Math.max(t.body["scroll" + e], i["scroll" + e], t.body["offset" + e], i["offset" + e], i["client" + e])) : r === undefined ? x.css(t, n, s) : x.style(t, n, r, s)
                    }, t, o ? r : undefined, o, null)
                }
            })
        }), x.fn.size = function () {
            return this.length
        }, x.fn.andSelf = x.fn.addBack, "object" == typeof module && module && "object" == typeof module.exports ? module.exports = x : "function" == typeof define && define.amd && define("jquery", [], function () {
            return x
        }), "object" == typeof e && "object" == typeof e.document && (e.jQuery = e.$ = x)
    })(window);

    /**
     * @license
     * Lo-Dash 1.3.1 (Custom Build) lodash.com/license
     * Build: `lodash modern -o ./dist/lodash.js`
     * Underscore.js 1.4.4 underscorejs.org/LICENSE
     */
    ;
    ! function (n) {
        function t(n, t, e) {
            e = (e || 0) - 1;
            for (var r = n.length; ++e < r;)
                if (n[e] === t) return e;
            return -1
        }

        function e(n, e) {
            var r = typeof e;
            if (n = n.k, "boolean" == r || e == h) return n[e];
            "number" != r && "string" != r && (r = "object");
            var u = "number" == r ? e : j + e;
            return n = n[r] || (n[r] = {}), "object" == r ? n[u] && -1 < t(n[u], e) ? 0 : -1 : n[u] ? 0 : -1
        }

        function r(n) {
            var t = this.k,
                e = typeof n;
            if ("boolean" == e || n == h) t[n] = y;
            else {
                "number" != e && "string" != e && (e = "object");
                var r = "number" == e ? n : j + n,
                    u = t[e] || (t[e] = {});
                "object" == e ? (u[r] || (u[r] = [])).push(n) == this.b.length && (t[e] = b) : u[r] = y
            }
        }

        function u(n) {
            return n.charCodeAt(0)
        }

        function a(n, t) {
            var e = n.m,
                r = t.m;
            if (n = n.l, t = t.l, n !== t) {
                if (n > t || typeof n == "undefined") return 1;
                if (n < t || typeof t == "undefined") return -1
            }
            return e < r ? -1 : 1
        }

        function o(n) {
            var t = -1,
                e = n.length,
                u = l();
            u["false"] = u["null"] = u["true"] = u.undefined = b;
            var a = l();
            for (a.b = n, a.k = u, a.push = r; ++t < e;) a.push(n[t]);
            return u.object === false ? (p(a), h) : a
        }

        function i(n) {
            return "\\" + Q[n]
        }

        function f() {
            return m.pop() || []
        }

        function l() {
            return d.pop() || {
                b: h,
                k: h,
                l: h,
                "false": b,
                m: 0,
                leading: b,
                maxWait: 0,
                "null": b,
                number: h,
                object: h,
                push: h,
                string: h,
                trailing: b,
                "true": b,
                undefined: b,
                n: h
            }
        }

        function c(n) {
            n.length = 0, m.length < C && m.push(n)
        }

        function p(n) {
            var t = n.k;
            t && p(t), n.b = n.k = n.l = n.object = n.number = n.string = n.n = h, d.length < C && d.push(n)
        }

        function s(n, t, e) {
            t || (t = 0), typeof e == "undefined" && (e = n ? n.length : 0);
            var r = -1;
            e = e - t || 0;
            for (var u = Array(0 > e ? 0 : e); ++r < e;) u[r] = n[t + r];
            return u
        }

        function v(r) {
            function m(n) {
                if (!n || ve.call(n) != V) return b;
                var t = n.valueOf,
                    e = typeof t == "function" && (e = fe(t)) && fe(e);
                return e ? n == e || fe(n) == e : it(n)
            }

            function d(n, t, e) {
                if (!n || !L[typeof n]) return n;
                t = t && typeof e == "undefined" ? t : tt.createCallback(t, e);
                for (var r = -1, u = L[typeof n] && Se(n), a = u ? u.length : 0; ++r < a && (e = u[r], !(t(n[e], e, n) === false)););
                return n
            }

            function C(n, t, e) {
                var r;
                if (!n || !L[typeof n]) return n;
                t = t && typeof e == "undefined" ? t : tt.createCallback(t, e);
                for (r in n)
                    if (t(n[r], r, n) === false) break;
                return n
            }

            function Q(n, t, e) {
                var r, u = n,
                    a = u;
                if (!u) return a;
                for (var o = arguments, i = 0, f = typeof e == "number" ? 2 : o.length; ++i < f;)
                    if ((u = o[i]) && L[typeof u])
                        for (var l = -1, c = L[typeof u] && Se(u), p = c ? c.length : 0; ++l < p;) r = c[l], "undefined" == typeof a[r] && (a[r] = u[r]);
                return a
            }

            function X(n, t, e) {
                var r, u = n,
                    a = u;
                if (!u) return a;
                var o = arguments,
                    i = 0,
                    f = typeof e == "number" ? 2 : o.length;
                if (3 < f && "function" == typeof o[f - 2]) var l = tt.createCallback(o[--f - 1], o[f--], 2);
                else 2 < f && "function" == typeof o[f - 1] && (l = o[--f]);
                for (; ++i < f;)
                    if ((u = o[i]) && L[typeof u])
                        for (var c = -1, p = L[typeof u] && Se(u), s = p ? p.length : 0; ++c < s;) r = p[c], a[r] = l ? l(a[r], u[r]) : u[r];
                return a
            }

            function Z(n) {
                var t, e = [];
                if (!n || !L[typeof n]) return e;
                for (t in n) le.call(n, t) && e.push(t);
                return e
            }

            function tt(n) {
                return n && typeof n == "object" && !Ee(n) && le.call(n, "__wrapped__") ? n : new et(n)
            }

            function et(n) {
                this.__wrapped__ = n
            }

            function rt(n, t, e, r) {
                function u() {
                    var r = arguments,
                        l = o ? this : t;
                    return a || (n = t[i]), e.length && (r = r.length ? (r = Ce.call(r), f ? r.concat(e) : e.concat(r)) : e), this instanceof u ? (l = gt(n.prototype) ? ye(n.prototype) : {}, r = n.apply(l, r), gt(r) ? r : l) : n.apply(l, r)
                }
                var a = vt(n),
                    o = !e,
                    i = t;
                if (o) {
                    var f = r;
                    e = t
                } else if (!a) {
                    if (!r) throw new Yt;
                    t = n
                }
                return u
            }

            function ut(n) {
                return Ie[n]
            }

            function at() {
                var n = (n = tt.indexOf) === $t ? t : n;
                return n
            }

            function ot(n) {
                return function (t, e, r, u) {
                    return typeof e != "boolean" && e != h && (u = r, r = u && u[e] === t ? g : e, e = b), r != h && (r = tt.createCallback(r, u)), n(t, e, r, u)
                }
            }

            function it(n) {
                var t, e;
                return n && ve.call(n) == V && (t = n.constructor, !vt(t) || t instanceof t) ? (C(n, function (n, t) {
                    e = t
                }), e === g || le.call(n, e)) : b
            }

            function ft(n) {
                return Ae[n]
            }

            function lt(n, t, e, r, u, a) {
                var o = n;
                if (typeof t != "boolean" && t != h && (r = e, e = t, t = b), typeof e == "function") {
                    if (e = typeof r == "undefined" ? e : tt.createCallback(e, r, 1), o = e(o), typeof o != "undefined") return o;
                    o = n
                }
                if (r = gt(o)) {
                    var i = ve.call(o);
                    if (!J[i]) return o;
                    var l = Ee(o)
                }
                if (!r || !t) return r ? l ? s(o) : X({}, o) : o;
                switch (r = xe[i], i) {
                case P:
                case K:
                    return new r(+o);
                case U:
                case H:
                    return new r(o);
                case G:
                    return r(o.source, A.exec(o))
                }
                i = !u, u || (u = f()), a || (a = f());
                for (var p = u.length; p--;)
                    if (u[p] == n) return a[p];
                return o = l ? r(o.length) : {}, l && (le.call(n, "index") && (o.index = n.index), le.call(n, "input") && (o.input = n.input)), u.push(n), a.push(o), (l ? wt : d)(n, function (n, r) {
                    o[r] = lt(n, t, e, g, u, a)
                }), i && (c(u), c(a)), o
            }

            function ct(n) {
                var t = [];
                return C(n, function (n, e) {
                    vt(n) && t.push(e)
                }), t.sort()
            }

            function pt(n) {
                for (var t = -1, e = Se(n), r = e.length, u = {}; ++t < r;) {
                    var a = e[t];
                    u[n[a]] = a
                }
                return u
            }

            function st(n, t, e, r, u, a) {
                var o = e === k;
                if (typeof e == "function" && !o) {
                    e = tt.createCallback(e, r, 2);
                    var i = e(n, t);
                    if (typeof i != "undefined") return !!i
                }
                if (n === t) return 0 !== n || 1 / n == 1 / t;
                var l = typeof n,
                    p = typeof t;
                if (n === n && (!n || "function" != l && "object" != l) && (!t || "function" != p && "object" != p)) return b;
                if (n == h || t == h) return n === t;
                if (p = ve.call(n), l = ve.call(t), p == z && (p = V), l == z && (l = V), p != l) return b;
                switch (p) {
                case P:
                case K:
                    return +n == +t;
                case U:
                    return n != +n ? t != +t : 0 == n ? 1 / n == 1 / t : n == +t;
                case G:
                case H:
                    return n == Xt(t)
                }
                if (l = p == W, !l) {
                    if (le.call(n, "__wrapped__") || le.call(t, "__wrapped__")) return st(n.__wrapped__ || n, t.__wrapped__ || t, e, r, u, a);
                    if (p != V) return b;
                    var p = n.constructor,
                        s = t.constructor;
                    if (p != s && (!vt(p) || !(p instanceof p && vt(s) && s instanceof s))) return b
                }
                for (s = !u, u || (u = f()), a || (a = f()), p = u.length; p--;)
                    if (u[p] == n) return a[p] == t;
                var v = 0,
                    i = y;
                if (u.push(n), a.push(t), l) {
                    if (p = n.length, v = t.length, i = v == n.length, !i && !o) return i;
                    for (; v--;)
                        if (l = p, s = t[v], o)
                            for (; l-- && !(i = st(n[l], s, e, r, u, a)););
                        else if (!(i = st(n[v], s, e, r, u, a))) break;
                    return i
                }
                return C(t, function (t, o, f) {
                    return le.call(f, o) ? (v++, i = le.call(n, o) && st(n[o], t, e, r, u, a)) : void 0
                }), i && !o && C(n, function (n, t, e) {
                    return le.call(e, t) ? i = -1 < --v : void 0
                }), s && (c(u), c(a)), i
            }

            function vt(n) {
                return typeof n == "function"
            }

            function gt(n) {
                return !(!n || !L[typeof n])
            }

            function yt(n) {
                return typeof n == "number" || ve.call(n) == U
            }

            function ht(n) {
                return typeof n == "string" || ve.call(n) == H
            }

            function bt(n, t, e) {
                var r = arguments,
                    u = 0,
                    a = 2;
                if (!gt(n)) return n;
                if (e === k) var o = r[3],
                    i = r[4],
                    l = r[5];
                else {
                    var p = y,
                        i = f(),
                        l = f();
                    typeof e != "number" && (a = r.length), 3 < a && "function" == typeof r[a - 2] ? o = tt.createCallback(r[--a - 1], r[a--], 2) : 2 < a && "function" == typeof r[a - 1] && (o = r[--a])
                }
                for (; ++u < a;)(Ee(r[u]) ? wt : d)(r[u], function (t, e) {
                    var r, u, a = t,
                        f = n[e];
                    if (t && ((u = Ee(t)) || m(t))) {
                        for (a = i.length; a--;)
                            if (r = i[a] == t) {
                                f = l[a];
                                break
                            }
                        if (!r) {
                            var c;
                            o && (a = o(f, t), c = typeof a != "undefined") && (f = a), c || (f = u ? Ee(f) ? f : [] : m(f) ? f : {}), i.push(t), l.push(f), c || (f = bt(f, t, k, o, i, l))
                        }
                    } else o && (a = o(f, t), typeof a == "undefined" && (a = t)), typeof a != "undefined" && (f = a);
                    n[e] = f
                });
                return p && (c(i), c(l)), n
            }

            function mt(n) {
                for (var t = -1, e = Se(n), r = e.length, u = Mt(r); ++t < r;) u[t] = n[e[t]];
                return u
            }

            function dt(n, t, e) {
                var r = -1,
                    u = at(),
                    a = n ? n.length : 0,
                    o = b;
                return e = (0 > e ? _e(0, a + e) : e) || 0, a && typeof a == "number" ? o = -1 < (ht(n) ? n.indexOf(t, e) : u(n, t, e)) : d(n, function (n) {
                    return ++r < e ? void 0 : !(o = n === t)
                }), o
            }

            function _t(n, t, e) {
                var r = y;
                t = tt.createCallback(t, e), e = -1;
                var u = n ? n.length : 0;
                if (typeof u == "number")
                    for (; ++e < u && (r = !!t(n[e], e, n)););
                else d(n, function (n, e, u) {
                    return r = !!t(n, e, u)
                });
                return r
            }

            function kt(n, t, e) {
                var r = [];
                t = tt.createCallback(t, e), e = -1;
                var u = n ? n.length : 0;
                if (typeof u == "number")
                    for (; ++e < u;) {
                        var a = n[e];
                        t(a, e, n) && r.push(a)
                    } else d(n, function (n, e, u) {
                        t(n, e, u) && r.push(n)
                    });
                return r
            }

            function jt(n, t, e) {
                t = tt.createCallback(t, e), e = -1;
                var r = n ? n.length : 0;
                if (typeof r != "number") {
                    var u;
                    return d(n, function (n, e, r) {
                        return t(n, e, r) ? (u = n, b) : void 0
                    }), u
                }
                for (; ++e < r;) {
                    var a = n[e];
                    if (t(a, e, n)) return a
                }
            }

            function wt(n, t, e) {
                var r = -1,
                    u = n ? n.length : 0;
                if (t = t && typeof e == "undefined" ? t : tt.createCallback(t, e), typeof u == "number")
                    for (; ++r < u && t(n[r], r, n) !== false;);
                else d(n, t);
                return n
            }

            function Ct(n, t, e) {
                var r = -1,
                    u = n ? n.length : 0;
                if (t = tt.createCallback(t, e), typeof u == "number")
                    for (var a = Mt(u); ++r < u;) a[r] = t(n[r], r, n);
                else a = [], d(n, function (n, e, u) {
                    a[++r] = t(n, e, u)
                });
                return a
            }

            function xt(n, t, e) {
                var r = -1 / 0,
                    a = r;
                if (!t && Ee(n)) {
                    e = -1;
                    for (var o = n.length; ++e < o;) {
                        var i = n[e];
                        i > a && (a = i)
                    }
                } else t = !t && ht(n) ? u : tt.createCallback(t, e), wt(n, function (n, e, u) {
                    e = t(n, e, u), e > r && (r = e, a = n)
                });
                return a
            }

            function Ot(n, t) {
                var e = -1,
                    r = n ? n.length : 0;
                if (typeof r == "number")
                    for (var u = Mt(r); ++e < r;) u[e] = n[e][t];
                return u || Ct(n, t)
            }

            function Et(n, t, e, r) {
                if (!n) return e;
                var u = 3 > arguments.length;
                t = tt.createCallback(t, r, 4);
                var a = -1,
                    o = n.length;
                if (typeof o == "number")
                    for (u && (e = n[++a]); ++a < o;) e = t(e, n[a], a, n);
                else d(n, function (n, r, a) {
                    e = u ? (u = b, n) : t(e, n, r, a)
                });
                return e
            }

            function St(n, t, e, r) {
                var u = n ? n.length : 0,
                    a = 3 > arguments.length;
                if (typeof u != "number") var o = Se(n),
                    u = o.length;
                return t = tt.createCallback(t, r, 4), wt(n, function (r, i, f) {
                    i = o ? o[--u] : --u, e = a ? (a = b, n[i]) : t(e, n[i], i, f)
                }), e
            }

            function It(n, t, e) {
                var r;
                t = tt.createCallback(t, e), e = -1;
                var u = n ? n.length : 0;
                if (typeof u == "number")
                    for (; ++e < u && !(r = t(n[e], e, n)););
                else d(n, function (n, e, u) {
                    return !(r = t(n, e, u))
                });
                return !!r
            }

            function At(n) {
                var r = -1,
                    u = at(),
                    a = n ? n.length : 0,
                    i = ae.apply(Zt, Ce.call(arguments, 1)),
                    f = [],
                    l = a >= w && u === t;
                if (l) {
                    var c = o(i);
                    c ? (u = e, i = c) : l = b
                }
                for (; ++r < a;) c = n[r], 0 > u(i, c) && f.push(c);
                return l && p(i), f
            }

            function Nt(n, t, e) {
                if (n) {
                    var r = 0,
                        u = n.length;
                    if (typeof t != "number" && t != h) {
                        var a = -1;
                        for (t = tt.createCallback(t, e); ++a < u && t(n[a], a, n);) r++
                    } else if (r = t, r == h || e) return n[0];
                    return s(n, 0, ke(_e(0, r), u))
                }
            }

            function $t(n, e, r) {
                if (typeof r == "number") {
                    var u = n ? n.length : 0;
                    r = 0 > r ? _e(0, u + r) : r || 0
                } else if (r) return r = Ft(n, e), n[r] === e ? r : -1;
                return n ? t(n, e, r) : -1
            }

            function Bt(n, t, e) {
                if (typeof t != "number" && t != h) {
                    var r = 0,
                        u = -1,
                        a = n ? n.length : 0;
                    for (t = tt.createCallback(t, e); ++u < a && t(n[u], u, n);) r++
                } else r = t == h || e ? 1 : _e(0, t);
                return s(n, r)
            }

            function Ft(n, t, e, r) {
                var u = 0,
                    a = n ? n.length : u;
                for (e = e ? tt.createCallback(e, r, 1) : Wt, t = e(t); u < a;) r = u + a >>> 1, e(n[r]) < t ? u = r + 1 : a = r;
                return u
            }

            function Rt(n) {
                for (var t = -1, e = n ? xt(Ot(n, "length")) : 0, r = Mt(0 > e ? 0 : e); ++t < e;) r[t] = Ot(n, t);
                return r
            }

            function Tt(n, t) {
                for (var e = -1, r = n ? n.length : 0, u = {}; ++e < r;) {
                    var a = n[e];
                    t ? u[a] = t[e] : u[a[0]] = a[1]
                }
                return u
            }

            function qt(n, t) {
                return Oe.fastBind || ge && 2 < arguments.length ? ge.call.apply(ge, arguments) : rt(n, t, Ce.call(arguments, 2))
            }

            function Dt(n, t, e) {
                function r() {
                    ue(s), ue(v), l = 0, s = v = h
                }

                function u() {
                    var t = g && (!m || 1 < l);
                    r(), t && (p !== false && (c = new Vt), i = n.apply(f, o))
                }

                function a() {
                    r(), (g || p !== t) && (c = new Vt, i = n.apply(f, o))
                }
                var o, i, f, l = 0,
                    c = 0,
                    p = b,
                    s = h,
                    v = h,
                    g = y;
                if (t = _e(0, t || 0), e === y) var m = y,
                    g = b;
                else gt(e) && (m = e.leading, p = "maxWait" in e && _e(t, e.maxWait || 0), g = "trailing" in e ? e.trailing : g);
                return function () {
                    if (o = arguments, f = this, l++, ue(v), p === false) m && 2 > l && (i = n.apply(f, o));
                    else {
                        var e = new Vt;
                        !s && !m && (c = e);
                        var r = p - (e - c);
                        0 < r ? s || (s = se(a, r)) : (ue(s), s = h, c = e, i = n.apply(f, o))
                    }
                    return t !== p && (v = se(u, t)), i
                }
            }

            function zt(n) {
                var t = Ce.call(arguments, 1);
                return se(function () {
                    n.apply(g, t)
                }, 1)
            }

            function Wt(n) {
                return n
            }

            function Pt(n) {
                wt(ct(n), function (t) {
                    var e = tt[t] = n[t];
                    tt.prototype[t] = function () {
                        var n = this.__wrapped__,
                            t = [n];
                        return ce.apply(t, arguments), t = e.apply(tt, t), n && typeof n == "object" && n === t ? this : new et(t)
                    }
                })
            }

            function Kt() {
                return this.__wrapped__
            }
            r = r ? nt.defaults(n.Object(), r, nt.pick(n, D)) : n;
            var Mt = r.Array,
                Ut = r.Boolean,
                Vt = r.Date,
                Gt = r.Function,
                Ht = r.Math,
                Jt = r.Number,
                Lt = r.Object,
                Qt = r.RegExp,
                Xt = r.String,
                Yt = r.TypeError,
                Zt = [],
                ne = Lt.prototype,
                te = r._,
                ee = Qt("^" + Xt(ne.valueOf).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/valueOf|for [^\]]+/g, ".+?") + "$"),
                re = Ht.ceil,
                ue = r.clearTimeout,
                ae = Zt.concat,
                oe = Ht.floor,
                ie = Gt.prototype.toString,
                fe = ee.test(fe = Lt.getPrototypeOf) && fe,
                le = ne.hasOwnProperty,
                ce = Zt.push,
                pe = r.setImmediate,
                se = r.setTimeout,
                ve = ne.toString,
                ge = ee.test(ge = ve.bind) && ge,
                ye = ee.test(ye = Lt.create) && ye,
                he = ee.test(he = Mt.isArray) && he,
                be = r.isFinite,
                me = r.isNaN,
                de = ee.test(de = Lt.keys) && de,
                _e = Ht.max,
                ke = Ht.min,
                je = r.parseInt,
                we = Ht.random,
                Ce = Zt.slice,
                Ht = ee.test(r.attachEvent),
                Ht = ge && !/\n|true/.test(ge + Ht),
                xe = {};
            xe[W] = Mt, xe[P] = Ut, xe[K] = Vt, xe[M] = Gt, xe[V] = Lt, xe[U] = Jt, xe[G] = Qt, xe[H] = Xt, et.prototype = tt.prototype;
            var Oe = tt.support = {};
            Oe.fastBind = ge && !Ht, tt.templateSettings = {
                escape: /<%-([\s\S]+?)%>/g,
                evaluate: /<%([\s\S]+?)%>/g,
                interpolate: N,
                variable: "",
                imports: {
                    _: tt
                }
            };
            var Ee = he,
                Se = de ? function (n) {
                    return gt(n) ? de(n) : []
                } : Z,
                Ie = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                },
                Ae = pt(Ie),
                Ut = ot(function $e(n, t, e) {
                    for (var r = -1, u = n ? n.length : 0, a = []; ++r < u;) {
                        var o = n[r];
                        e && (o = e(o, r, n)), Ee(o) ? ce.apply(a, t ? o : $e(o)) : a.push(o)
                    }
                    return a
                }),
                Ne = ot(function (n, r, u) {
                    var a = -1,
                        i = at(),
                        l = n ? n.length : 0,
                        s = [],
                        v = !r && l >= w && i === t,
                        g = u || v ? f() : s;
                    if (v) {
                        var y = o(g);
                        y ? (i = e, g = y) : (v = b, g = u ? g : (c(g), s))
                    }
                    for (; ++a < l;) {
                        var y = n[a],
                            h = u ? u(y, a, n) : y;
                        (r ? !a || g[g.length - 1] !== h : 0 > i(g, h)) && ((u || v) && g.push(h), s.push(y))
                    }
                    return v ? (c(g.b), p(g)) : u && c(g), s
                });
            return Ht && Y && typeof pe == "function" && (zt = qt(pe, r)), pe = 8 == je(B + "08") ? je : function (n, t) {
                return je(ht(n) ? n.replace(F, "") : n, t || 0)
            }, tt.after = function (n, t) {
                return 1 > n ? t() : function () {
                    return 1 > --n ? t.apply(this, arguments) : void 0
                }
            }, tt.assign = X, tt.at = function (n) {
                for (var t = -1, e = ae.apply(Zt, Ce.call(arguments, 1)), r = e.length, u = Mt(r); ++t < r;) u[t] = n[e[t]];
                return u
            }, tt.bind = qt, tt.bindAll = function (n) {
                for (var t = 1 < arguments.length ? ae.apply(Zt, Ce.call(arguments, 1)) : ct(n), e = -1, r = t.length; ++e < r;) {
                    var u = t[e];
                    n[u] = qt(n[u], n)
                }
                return n
            }, tt.bindKey = function (n, t) {
                return rt(n, t, Ce.call(arguments, 2), k)
            }, tt.compact = function (n) {
                for (var t = -1, e = n ? n.length : 0, r = []; ++t < e;) {
                    var u = n[t];
                    u && r.push(u)
                }
                return r
            }, tt.compose = function () {
                var n = arguments;
                return function () {
                    for (var t = arguments, e = n.length; e--;) t = [n[e].apply(this, t)];
                    return t[0]
                }
            }, tt.countBy = function (n, t, e) {
                var r = {};
                return t = tt.createCallback(t, e), wt(n, function (n, e, u) {
                    e = Xt(t(n, e, u)), le.call(r, e) ? r[e]++ : r[e] = 1
                }), r
            }, tt.createCallback = function (n, t, e) {
                if (n == h) return Wt;
                var r = typeof n;
                if ("function" != r) {
                    if ("object" != r) return function (t) {
                        return t[n]
                    };
                    var u = Se(n);
                    return function (t) {
                        for (var e = u.length, r = b; e-- && (r = st(t[u[e]], n[u[e]], k)););
                        return r
                    }
                }
                return typeof t == "undefined" || $ && !$.test(ie.call(n)) ? n : 1 === e ? function (e) {
                    return n.call(t, e)
                } : 2 === e ? function (e, r) {
                    return n.call(t, e, r)
                } : 4 === e ? function (e, r, u, a) {
                    return n.call(t, e, r, u, a)
                } : function (e, r, u) {
                    return n.call(t, e, r, u)
                }
            }, tt.debounce = Dt, tt.defaults = Q, tt.defer = zt, tt.delay = function (n, t) {
                var e = Ce.call(arguments, 2);
                return se(function () {
                    n.apply(g, e)
                }, t)
            }, tt.difference = At, tt.filter = kt, tt.flatten = Ut, tt.forEach = wt, tt.forIn = C, tt.forOwn = d, tt.functions = ct, tt.groupBy = function (n, t, e) {
                var r = {};
                return t = tt.createCallback(t, e), wt(n, function (n, e, u) {
                    e = Xt(t(n, e, u)), (le.call(r, e) ? r[e] : r[e] = []).push(n)
                }), r
            }, tt.initial = function (n, t, e) {
                if (!n) return [];
                var r = 0,
                    u = n.length;
                if (typeof t != "number" && t != h) {
                    var a = u;
                    for (t = tt.createCallback(t, e); a-- && t(n[a], a, n);) r++
                } else r = t == h || e ? 1 : t || r;
                return s(n, 0, ke(_e(0, u - r), u))
            }, tt.intersection = function (n) {
                for (var r = arguments, u = r.length, a = -1, i = f(), l = -1, s = at(), v = n ? n.length : 0, g = [], y = f(); ++a < u;) {
                    var h = r[a];
                    i[a] = s === t && (h ? h.length : 0) >= w && o(a ? r[a] : y)
                }
                n: for (; ++l < v;) {
                    var b = i[0],
                        h = n[l];
                    if (0 > (b ? e(b, h) : s(y, h))) {
                        for (a = u, (b || y).push(h); --a;)
                            if (b = i[a], 0 > (b ? e(b, h) : s(r[a], h))) continue n;
                        g.push(h)
                    }
                }
                for (; u--;)(b = i[u]) && p(b);
                return c(i), c(y), g
            }, tt.invert = pt, tt.invoke = function (n, t) {
                var e = Ce.call(arguments, 2),
                    r = -1,
                    u = typeof t == "function",
                    a = n ? n.length : 0,
                    o = Mt(typeof a == "number" ? a : 0);
                return wt(n, function (n) {
                    o[++r] = (u ? t : n[t]).apply(n, e)
                }), o
            }, tt.keys = Se, tt.map = Ct, tt.max = xt, tt.memoize = function (n, t) {
                function e() {
                    var r = e.cache,
                        u = j + (t ? t.apply(this, arguments) : arguments[0]);
                    return le.call(r, u) ? r[u] : r[u] = n.apply(this, arguments)
                }
                return e.cache = {}, e
            }, tt.merge = bt, tt.min = function (n, t, e) {
                var r = 1 / 0,
                    a = r;
                if (!t && Ee(n)) {
                    e = -1;
                    for (var o = n.length; ++e < o;) {
                        var i = n[e];
                        i < a && (a = i)
                    }
                } else t = !t && ht(n) ? u : tt.createCallback(t, e), wt(n, function (n, e, u) {
                    e = t(n, e, u), e < r && (r = e, a = n)
                });
                return a
            }, tt.omit = function (n, t, e) {
                var r = at(),
                    u = typeof t == "function",
                    a = {};
                if (u) t = tt.createCallback(t, e);
                else var o = ae.apply(Zt, Ce.call(arguments, 1));
                return C(n, function (n, e, i) {
                    (u ? !t(n, e, i) : 0 > r(o, e)) && (a[e] = n)
                }), a
            }, tt.once = function (n) {
                var t, e;
                return function () {
                    return t ? e : (t = y, e = n.apply(this, arguments), n = h, e)
                }
            }, tt.pairs = function (n) {
                for (var t = -1, e = Se(n), r = e.length, u = Mt(r); ++t < r;) {
                    var a = e[t];
                    u[t] = [a, n[a]]
                }
                return u
            }, tt.partial = function (n) {
                return rt(n, Ce.call(arguments, 1))
            }, tt.partialRight = function (n) {
                return rt(n, Ce.call(arguments, 1), h, k)
            }, tt.pick = function (n, t, e) {
                var r = {};
                if (typeof t != "function")
                    for (var u = -1, a = ae.apply(Zt, Ce.call(arguments, 1)), o = gt(n) ? a.length : 0; ++u < o;) {
                        var i = a[u];
                        i in n && (r[i] = n[i])
                    } else t = tt.createCallback(t, e), C(n, function (n, e, u) {
                        t(n, e, u) && (r[e] = n)
                    });
                return r
            }, tt.pluck = Ot, tt.range = function (n, t, e) {
                n = +n || 0, e = +e || 1, t == h && (t = n, n = 0);
                var r = -1;
                t = _e(0, re((t - n) / e));
                for (var u = Mt(t); ++r < t;) u[r] = n, n += e;
                return u
            }, tt.reject = function (n, t, e) {
                return t = tt.createCallback(t, e), kt(n, function (n, e, r) {
                    return !t(n, e, r)
                })
            }, tt.rest = Bt, tt.shuffle = function (n) {
                var t = -1,
                    e = n ? n.length : 0,
                    r = Mt(typeof e == "number" ? e : 0);
                return wt(n, function (n) {
                    var e = oe(we() * (++t + 1));
                    r[t] = r[e], r[e] = n
                }), r
            }, tt.sortBy = function (n, t, e) {
                var r = -1,
                    u = n ? n.length : 0,
                    o = Mt(typeof u == "number" ? u : 0);
                for (t = tt.createCallback(t, e), wt(n, function (n, e, u) {
                    var a = o[++r] = l();
                    a.l = t(n, e, u), a.m = r, a.n = n
                }), u = o.length, o.sort(a); u--;) n = o[u], o[u] = n.n, p(n);
                return o
            }, tt.tap = function (n, t) {
                return t(n), n
            }, tt.throttle = function (n, t, e) {
                var r = y,
                    u = y;
                return e === false ? r = b : gt(e) && (r = "leading" in e ? e.leading : r, u = "trailing" in e ? e.trailing : u), e = l(), e.leading = r, e.maxWait = t, e.trailing = u, n = Dt(n, t, e), p(e), n
            }, tt.times = function (n, t, e) {
                n = -1 < (n = +n) ? n : 0;
                var r = -1,
                    u = Mt(n);
                for (t = tt.createCallback(t, e, 1); ++r < n;) u[r] = t(r);
                return u
            }, tt.toArray = function (n) {
                return n && typeof n.length == "number" ? s(n) : mt(n)
            }, tt.transform = function (n, t, e, r) {
                var u = Ee(n);
                return t = tt.createCallback(t, r, 4), e == h && (u ? e = [] : (r = n && n.constructor, e = gt(r && r.prototype) ? ye(r && r.prototype) : {})), (u ? wt : d)(n, function (n, r, u) {
                    return t(e, n, r, u)
                }), e
            }, tt.union = function (n) {
                return Ee(n) || (arguments[0] = n ? Ce.call(n) : Zt), Ne(ae.apply(Zt, arguments))
            }, tt.uniq = Ne, tt.unzip = Rt, tt.values = mt, tt.where = kt, tt.without = function (n) {
                return At(n, Ce.call(arguments, 1))
            }, tt.wrap = function (n, t) {
                return function () {
                    var e = [n];
                    return ce.apply(e, arguments), t.apply(this, e)
                }
            }, tt.zip = function (n) {
                return n ? Rt(arguments) : []
            }, tt.zipObject = Tt, tt.collect = Ct, tt.drop = Bt, tt.each = wt, tt.extend = X, tt.methods = ct, tt.object = Tt, tt.select = kt, tt.tail = Bt, tt.unique = Ne, Pt(tt), tt.chain = tt, tt.prototype.chain = function () {
                return this
            }, tt.clone = lt, tt.cloneDeep = function (n, t, e) {
                return lt(n, y, t, e)
            }, tt.contains = dt, tt.escape = function (n) {
                return n == h ? "" : Xt(n).replace(T, ut)
            }, tt.every = _t, tt.find = jt, tt.findIndex = function (n, t, e) {
                var r = -1,
                    u = n ? n.length : 0;
                for (t = tt.createCallback(t, e); ++r < u;)
                    if (t(n[r], r, n)) return r;
                return -1
            }, tt.findKey = function (n, t, e) {
                var r;
                return t = tt.createCallback(t, e), d(n, function (n, e, u) {
                    return t(n, e, u) ? (r = e, b) : void 0
                }), r
            }, tt.has = function (n, t) {
                return n ? le.call(n, t) : b
            }, tt.identity = Wt, tt.indexOf = $t, tt.isArguments = function (n) {
                return ve.call(n) == z
            }, tt.isArray = Ee, tt.isBoolean = function (n) {
                return n === y || n === false || ve.call(n) == P
            }, tt.isDate = function (n) {
                return n ? typeof n == "object" && ve.call(n) == K : b
            }, tt.isElement = function (n) {
                return n ? 1 === n.nodeType : b
            }, tt.isEmpty = function (n) {
                var t = y;
                if (!n) return t;
                var e = ve.call(n),
                    r = n.length;
                return e == W || e == H || e == z || e == V && typeof r == "number" && vt(n.splice) ? !r : (d(n, function () {
                    return t = b
                }), t)
            }, tt.isEqual = st, tt.isFinite = function (n) {
                return be(n) && !me(parseFloat(n))
            }, tt.isFunction = vt, tt.isNaN = function (n) {
                return yt(n) && n != +n
            }, tt.isNull = function (n) {
                return n === h
            }, tt.isNumber = yt, tt.isObject = gt, tt.isPlainObject = m, tt.isRegExp = function (n) {
                return n ? typeof n == "object" && ve.call(n) == G : b
            }, tt.isString = ht, tt.isUndefined = function (n) {
                return typeof n == "undefined"
            }, tt.lastIndexOf = function (n, t, e) {
                var r = n ? n.length : 0;
                for (typeof e == "number" && (r = (0 > e ? _e(0, r + e) : ke(e, r - 1)) + 1); r--;)
                    if (n[r] === t) return r;
                return -1
            }, tt.mixin = Pt, tt.noConflict = function () {
                return r._ = te, this
            }, tt.parseInt = pe, tt.random = function (n, t) {
                n == h && t == h && (t = 1), n = +n || 0, t == h ? (t = n, n = 0) : t = +t || 0;
                var e = we();
                return n % 1 || t % 1 ? n + ke(e * (t - n + parseFloat("1e-" + ((e + "").length - 1))), t) : n + oe(e * (t - n + 1))
            }, tt.reduce = Et, tt.reduceRight = St, tt.result = function (n, t) {
                var e = n ? n[t] : g;
                return vt(e) ? n[t]() : e
            }, tt.runInContext = v, tt.size = function (n) {
                var t = n ? n.length : 0;
                return typeof t == "number" ? t : Se(n).length
            }, tt.some = It, tt.sortedIndex = Ft, tt.template = function (n, t, e) {
                var r = tt.templateSettings;
                n || (n = ""), e = Q({}, e, r);
                var u, a = Q({}, e.imports, r.imports),
                    r = Se(a),
                    a = mt(a),
                    o = 0,
                    f = e.interpolate || R,
                    l = "__p+='",
                    f = Qt((e.escape || R).source + "|" + f.source + "|" + (f === N ? I : R).source + "|" + (e.evaluate || R).source + "|$", "g");
                n.replace(f, function (t, e, r, a, f, c) {
                    return r || (r = a), l += n.slice(o, c).replace(q, i), e && (l += "'+__e(" + e + ")+'"), f && (u = y, l += "';" + f + ";__p+='"), r && (l += "'+((__t=(" + r + "))==null?'':__t)+'"), o = c + t.length, t
                }), l += "';\n", f = e = e.variable, f || (e = "obj", l = "with(" + e + "){" + l + "}"), l = (u ? l.replace(x, "") : l).replace(O, "$1").replace(E, "$1;"), l = "function(" + e + "){" + (f ? "" : e + "||(" + e + "={});") + "var __t,__p='',__e=_.escape" + (u ? ",__j=Array.prototype.join;function print(){__p+=__j.call(arguments,'')}" : ";") + l + "return __p}";
                try {
                    var c = Gt(r, "return " + l).apply(g, a)
                } catch (p) {
                    throw p.source = l, p
                }
                return t ? c(t) : (c.source = l, c)
            }, tt.unescape = function (n) {
                return n == h ? "" : Xt(n).replace(S, ft)
            }, tt.uniqueId = function (n) {
                var t = ++_;
                return Xt(n == h ? "" : n) + t
            }, tt.all = _t, tt.any = It, tt.detect = jt, tt.findWhere = jt, tt.foldl = Et, tt.foldr = St, tt.include = dt, tt.inject = Et, d(tt, function (n, t) {
                tt.prototype[t] || (tt.prototype[t] = function () {
                    var t = [this.__wrapped__];
                    return ce.apply(t, arguments), n.apply(tt, t)
                })
            }), tt.first = Nt, tt.last = function (n, t, e) {
                if (n) {
                    var r = 0,
                        u = n.length;
                    if (typeof t != "number" && t != h) {
                        var a = u;
                        for (t = tt.createCallback(t, e); a-- && t(n[a], a, n);) r++
                    } else if (r = t, r == h || e) return n[u - 1];
                    return s(n, _e(0, u - r))
                }
            }, tt.take = Nt, tt.head = Nt, d(tt, function (n, t) {
                tt.prototype[t] || (tt.prototype[t] = function (t, e) {
                    var r = n(this.__wrapped__, t, e);
                    return t == h || e && typeof t != "function" ? r : new et(r)
                })
            }), tt.VERSION = "1.3.1", tt.prototype.toString = function () {
                return Xt(this.__wrapped__)
            }, tt.prototype.value = Kt, tt.prototype.valueOf = Kt, wt(["join", "pop", "shift"], function (n) {
                var t = Zt[n];
                tt.prototype[n] = function () {
                    return t.apply(this.__wrapped__, arguments)
                }
            }), wt(["push", "reverse", "sort", "unshift"], function (n) {
                var t = Zt[n];
                tt.prototype[n] = function () {
                    return t.apply(this.__wrapped__, arguments), this
                }
            }), wt(["concat", "slice", "splice"], function (n) {
                var t = Zt[n];
                tt.prototype[n] = function () {
                    return new et(t.apply(this.__wrapped__, arguments))
                }
            }), tt
        }
        var g, y = !0,
            h = null,
            b = !1,
            m = [],
            d = [],
            _ = 0,
            k = {},
            j = +new Date + "",
            w = 75,
            C = 40,
            x = /\b__p\+='';/g,
            O = /\b(__p\+=)''\+/g,
            E = /(__e\(.*?\)|\b__t\))\+'';/g,
            S = /&(?:amp|lt|gt|quot|#39);/g,
            I = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,
            A = /\w*$/,
            N = /<%=([\s\S]+?)%>/g,
            $ = ($ = /\bthis\b/) && $.test(v) && $,
            B = " \t\x0B\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000",
            F = RegExp("^[" + B + "]*0+(?=.$)"),
            R = /($^)/,
            T = /[&<>"']/g,
            q = /['\n\r\t\u2028\u2029\\]/g,
            D = "Array Boolean Date Function Math Number Object RegExp String _ attachEvent clearTimeout isFinite isNaN parseInt setImmediate setTimeout".split(" "),
            z = "[object Arguments]",
            W = "[object Array]",
            P = "[object Boolean]",
            K = "[object Date]",
            M = "[object Function]",
            U = "[object Number]",
            V = "[object Object]",
            G = "[object RegExp]",
            H = "[object String]",
            J = {};
        J[M] = b, J[z] = J[W] = J[P] = J[K] = J[U] = J[V] = J[G] = J[H] = y;
        var L = {
                "boolean": b,
                "function": y,
                object: y,
                number: b,
                string: b,
                undefined: b
            },
            Q = {
                "\\": "\\",
                "'": "'",
                "\n": "n",
                "\r": "r",
                "\t": "t",
                "\u2028": "u2028",
                "\u2029": "u2029"
            },
            X = L[typeof exports] && exports,
            Y = L[typeof module] && module && module.exports == X && module,
            Z = L[typeof global] && global;
        !Z || Z.global !== Z && Z.window !== Z || (n = Z);
        var nt = v();
        typeof define == "function" && typeof define.amd == "object" && define.amd ? (n._ = nt, define('lodash', [], function () {
            return nt
        })) : X && !X.nodeType ? Y ? (Y.exports = nt)._ = nt : X._ = nt : n._ = nt
    }(this);
    /*
    json2.js
    2013-05-26

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html


    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.


    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.
*/

    /*jslint evil: true, regexp: true */

    /*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


    // Create a JSON object only if one does not already exist. We create the
    // methods in a closure to avoid creating global variables.

    if (typeof JSON !== 'object') {
        JSON = {};
    }

    (function () {


        function f(n) {
            // Format integers to have at least two digits.
            return n < 10 ? '0' + n : n;
        }

        if (typeof Date.prototype.toJSON !== 'function') {

            Date.prototype.toJSON = function () {

                return isFinite(this.valueOf()) ? this.getUTCFullYear() + '-' +
                    f(this.getUTCMonth() + 1) + '-' +
                    f(this.getUTCDate()) + 'T' +
                    f(this.getUTCHours()) + ':' +
                    f(this.getUTCMinutes()) + ':' +
                    f(this.getUTCSeconds()) + 'Z' : null;
            };

            String.prototype.toJSON =
                Number.prototype.toJSON =
                Boolean.prototype.toJSON = function () {
                    return this.valueOf();
                };
        }

        var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
            escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
            gap,
            indent,
            meta = { // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            },
            rep;


        function quote(string) {

            // If the string contains no control characters, no quote characters, and no
            // backslash characters, then we can safely slap some quotes around it.
            // Otherwise we must also replace the offending characters with safe escape
            // sequences.

            escapable.lastIndex = 0;
            return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' : '"' + string + '"';
        }


        function str(key, holder) {

            // Produce a string from holder[key].

            var i, // The loop counter.
                k, // The member key.
                v, // The member value.
                length,
                mind = gap,
                partial,
                value = holder[key];

            // If the value has a toJSON method, call it to obtain a replacement value.

            if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }

            // If we were called with a replacer function, then call the replacer to
            // obtain a replacement value.

            if (typeof rep === 'function') {
                value = rep.call(holder, key, value);
            }

            // What happens next depends on the value's type.

            switch (typeof value) {
            case 'string':
                return quote(value);

            case 'number':

                // JSON numbers must be finite. Encode non-finite numbers as null.

                return isFinite(value) ? String(value) : 'null';

            case 'boolean':
            case 'null':

                // If the value is a boolean or null, convert it to a string. Note:
                // typeof null does not produce 'null'. The case is included here in
                // the remote chance that this gets fixed someday.

                return String(value);

                // If the type is 'object', we might be dealing with an object or an array or
                // null.

            case 'object':

                // Due to a specification blunder in ECMAScript, typeof null is 'object',
                // so watch out for that case.

                if (!value) {
                    return 'null';
                }

                // Make an array to hold the partial results of stringifying this object value.

                gap += indent;
                partial = [];

                // Is the value an array?

                if (Object.prototype.toString.apply(value) === '[object Array]') {

                    // The value is an array. Stringify every element. Use null as a placeholder
                    // for non-JSON values.

                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || 'null';
                    }

                    // Join all of the elements together, separated with commas, and wrap them in
                    // brackets.

                    v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
                    gap = mind;
                    return v;
                }

                // If the replacer is an array, use it to select the members to be stringified.

                if (rep && typeof rep === 'object') {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) {
                        if (typeof rep[i] === 'string') {
                            k = rep[i];
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }
                } else {

                    // Otherwise, iterate through all of the keys in the object.

                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }
                }

                // Join all of the member texts together, separated with commas,
                // and wrap them in braces.

                v = partial.length === 0 ? '{}' : gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' : '{' + partial.join(',') + '}';
                gap = mind;
                return v;
            }
        }

        // If the JSON object does not yet have a stringify method, give it one.

        if (typeof JSON.stringify !== 'function') {
            JSON.stringify = function (value, replacer, space) {

                // The stringify method takes a value and an optional replacer, and an optional
                // space parameter, and returns a JSON text. The replacer can be a function
                // that can replace values, or an array of strings that will select the keys.
                // A default replacer method can be provided. Use of the space parameter can
                // produce text that is more easily readable.

                var i;
                gap = '';
                indent = '';

                // If the space parameter is a number, make an indent string containing that
                // many spaces.

                if (typeof space === 'number') {
                    for (i = 0; i < space; i += 1) {
                        indent += ' ';
                    }

                    // If the space parameter is a string, it will be used as the indent string.

                } else if (typeof space === 'string') {
                    indent = space;
                }

                // If there is a replacer, it must be a function or an array.
                // Otherwise, throw an error.

                rep = replacer;
                if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                        typeof replacer.length !== 'number')) {
                    throw new Error('JSON.stringify');
                }

                // Make a fake root object containing our value under the key of ''.
                // Return the result of stringifying the value.

                return str('', {
                    '': value
                });
            };
        }


        // If the JSON object does not yet have a parse method, give it one.

        if (typeof JSON.parse !== 'function') {
            JSON.parse = function (text, reviver) {

                // The parse method takes a text and an optional reviver function, and returns
                // a JavaScript value if the text is a valid JSON text.

                var j;

                function walk(holder, key) {

                    // The walk method is used to recursively walk the resulting structure so
                    // that modifications can be made.

                    var k, v, value = holder[key];
                    if (value && typeof value === 'object') {
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = walk(value, k);
                                if (v !== undefined) {
                                    value[k] = v;
                                } else {
                                    delete value[k];
                                }
                            }
                        }
                    }
                    return reviver.call(holder, key, value);
                }


                // Parsing happens in four stages. In the first stage, we replace certain
                // Unicode characters with escape sequences. JavaScript handles many characters
                // incorrectly, either silently deleting them, or treating them as line endings.

                text = String(text);
                cx.lastIndex = 0;
                if (cx.test(text)) {
                    text = text.replace(cx, function (a) {
                        return '\\u' +
                            ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                    });
                }

                // In the second stage, we run the text against regular expressions that look
                // for non-JSON patterns. We are especially concerned with '()' and 'new'
                // because they can cause invocation, and '=' because it can cause mutation.
                // But just to be safe, we want to reject all unexpected forms.

                // We split the second stage into 4 regexp operations in order to work around
                // crippling inefficiencies in IE's and Safari's regexp engines. First we
                // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
                // replace all simple value tokens with ']' characters. Third, we delete all
                // open brackets that follow a colon or comma or that begin the text. Finally,
                // we look to see that the remaining characters are only whitespace or ']' or
                // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

                if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                        .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

                    // In the third stage we use the eval function to compile the text into a
                    // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
                    // in JavaScript: it can begin a block or an object literal. We wrap the text
                    // in parens to eliminate the ambiguity.

                    j = eval('(' + text + ')');

                    // In the optional fourth stage, we recursively walk the new structure, passing
                    // each name/value pair to a reviver function for possible transformation.

                    return typeof reviver === 'function' ? walk({
                        '': j
                    }, '') : j;
                }

                // If the text is not JSON parseable, then a SyntaxError is thrown.

                throw new SyntaxError('JSON.parse');
            };
        }
    }());

    define("json2", (function (global) {
        return function () {
            var ret, fn;
            return ret || global.JSON;
        };
    }(this)));

    /**
     *
     *  Base64 encode / decode
     *  http://www.webtoolkit.info/
     *
     **/

    var Base64 = {

        // private property
        _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

        // public method for encoding
        encode: function (input) {
            var output = "";
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
            var i = 0;

            input = Base64._utf8_encode(input);

            while (i < input.length) {

                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output +
                    this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                    this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

            }

            return output;
        },

        // public method for decoding
        decode: function (input) {
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;

            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

            while (i < input.length) {

                enc1 = this._keyStr.indexOf(input.charAt(i++));
                enc2 = this._keyStr.indexOf(input.charAt(i++));
                enc3 = this._keyStr.indexOf(input.charAt(i++));
                enc4 = this._keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output = output + String.fromCharCode(chr1);

                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }

            }

            output = Base64._utf8_decode(output);

            return output;

        },

        // private method for UTF-8 encoding
        _utf8_encode: function (string) {
            string = string.replace(/\r\n/g, "\n");
            var utftext = "";

            for (var n = 0; n < string.length; n++) {

                var c = string.charCodeAt(n);

                if (c < 128) {
                    utftext += String.fromCharCode(c);
                } else if ((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                } else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }

            }

            return utftext;
        },

        // private method for UTF-8 decoding
        _utf8_decode: function (utftext) {
            var string = "";
            var i = 0;
            var c = c1 = c2 = 0;

            while (i < utftext.length) {

                c = utftext.charCodeAt(i);

                if (c < 128) {
                    string += String.fromCharCode(c);
                    i++;
                } else if ((c > 191) && (c < 224)) {
                    c2 = utftext.charCodeAt(i + 1);
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                    i += 2;
                } else {
                    c2 = utftext.charCodeAt(i + 1);
                    c3 = utftext.charCodeAt(i + 2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                    i += 3;
                }

            }

            return string;
        }

    };
    define("base64", (function (global) {
        return function () {
            var ret, fn;
            fn = function () {
                return Base64;
            };
            ret = fn.apply(global, arguments);
            return ret;
        };
    }(this)));

    (function (e) {
        if ("function" == typeof bootstrap) bootstrap("dmvast", e);
        else if ("object" == typeof exports) module.exports = e();
        else if ("function" == typeof define && define.amd) define('vast-client', e);
        else if ("undefined" != typeof ses) {
            if (!ses.ok()) return;
            ses.makeDMVAST = e
        } else "undefined" != typeof window ? window.DMVAST = e() : global.DMVAST = e()
    })(function () {
        var define, ses, bootstrap, module, exports;
        return (function (e, t, n) {
            function i(n, s) {
                if (!t[n]) {
                    if (!e[n]) {
                        var o = typeof require == "function" && require;
                        if (!s && o) return o(n, !0);
                        if (r) return r(n, !0);
                        throw new Error("Cannot find module '" + n + "'")
                    }
                    var u = t[n] = {
                        exports: {}
                    };
                    e[n][0].call(u.exports, function (t) {
                        var r = e[n][1][t];
                        return i(r ? r : t)
                    }, u, u.exports)
                }
                return t[n].exports
            }
            var r = typeof require == "function" && require;
            for (var s = 0; s < n.length; s++) i(n[s]);
            return i
        })({
            1: [

                function (require, module, exports) {
                    module.exports = {
                        client: require('./client.coffee'),
                        tracker: require('./tracker.coffee'),
                        parser: require('./parser.coffee'),
                        util: require('./util.coffee')
                    };

                }, {
                    "./client.coffee": 2,
                    "./tracker.coffee": 3,
                    "./parser.coffee": 4,
                    "./util.coffee": 5
                }
            ],
            2: [

                function (require, module, exports) {
                    var VASTClient, VASTParser, VASTUtil;

                    window.__ad_ids = [];

                    VASTParser = require('./parser.coffee');

                    VASTUtil = require('./util.coffee');

                    VASTClient = (function () {

                        function VASTClient() {}

                        VASTClient.cappingFreeLunch = 0;

                        VASTClient.cappingMinimumTimeInterval = 0;

                        VASTClient.timeout = 0;

                        VASTClient.get = function (url, player, cb) {
                            console.log('VAST client fetching ' + url);
                            var now,
                                _this = this;
                            now = +new Date();
                            if (this.totalCallsTimeout < now) {
                                this.totalCalls = 1;
                                this.totalCallsTimeout = now + (60 * 60 * 1000);
                            } else {
                                this.totalCalls++;
                            }
                            if (this.cappingFreeLunch >= this.totalCalls) {
                                cb(null);
                                return;
                            }
                            if (now - this.lastSuccessfullAd < this.cappingMinimumTimeInterval) {
                                cb(null);
                                return;
                            }
                            return VASTParser.parse(url, player, function (response) {
                                return cb(response);
                            });
                        };

                        (function () {
                            var defineProperty, storage;
                            storage = VASTUtil.storage;
                            defineProperty = Object.defineProperty;
                            ['lastSuccessfullAd', 'totalCalls', 'totalCallsTimeout'].forEach(function (property) {
                                defineProperty(VASTClient, property, {
                                    get: function () {
                                        return storage.getItem(property);
                                    },
                                    set: function (value) {
                                        return storage.setItem(property, value);
                                    },
                                    configurable: false,
                                    enumerable: true
                                });
                            });
                            if (VASTClient.totalCalls == null) VASTClient.totalCalls = 0;
                            if (VASTClient.totalCallsTimeout == null) VASTClient.totalCallsTimeout = 0;
                        })();

                        return VASTClient;

                    })();

                    module.exports = VASTClient;

                }, {
                    "./parser.coffee": 4,
                    "./util.coffee": 5
                }
            ],
            5: [

                function (require, module, exports) {
                    var VASTUtil;

                    VASTUtil = (function () {

                        function VASTUtil() {}

                        VASTUtil.track = function (URLTemplates, variables) {
                            var URL, URLs, i, _i, _len, _results;
                            URLs = this.resolveURLTemplates(URLTemplates, variables);
                            _results = [];
                            for (_i = 0, _len = URLs.length; _i < _len; _i++) {
                                URL = URLs[_i];
                                if (typeof window !== "undefined" && window !== null) {
                                    i = new Image();
                                    _results.push(i.src = URL);
                                } else {

                                }
                            }
                            return _results;
                        };

                        VASTUtil.resolveURLTemplates = function (URLTemplates, variables) {
                            var URLTemplate, URLs, macro, name, resolveURL, value, _i, _j, _len, _len2, _ref;
                            URLs = [];
                            if (variables == null) variables = {};
                            if (!("CACHEBUSTING" in variables)) {
                                variables["CACHEBUSTING"] = Math.round(Math.random() * 1.0e+10);
                            }
                            variables["random"] = variables["CACHEBUSTING"];
                            for (_i = 0, _len = URLTemplates.length; _i < _len; _i++) {
                                URLTemplate = URLTemplates[_i];
                                resolveURL = URLTemplate;
                                _ref = ["CACHEBUSTING", "random", "CONTENTPLAYHEAD", "ASSETURI", "ERRORCODE"];
                                for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
                                    name = _ref[_j];
                                    macro = "[" + name + "]";
                                    value = variables[name];
                                    resolveURL = resolveURL.replace(macro, value);
                                }
                                URLs.push(resolveURL);
                            }
                            return URLs;
                        };

                        VASTUtil.storage = (function () {
                            var data, isDisabled, storage;
                            try {
                                storage = typeof window !== "undefined" && window !== null ? window.localStorage || window.sessionStorage : null;
                            } catch (storageError) {
                                storage = null;
                            }
                            isDisabled = function (store) {
                                var testValue;
                                try {
                                    testValue = '__VASTUtil__';
                                    store.setItem(testValue, testValue);
                                    if (store.getItem(testValue) !== testValue) return true;
                                } catch (e) {
                                    return true;
                                }
                                return false;
                            };
                            if (!(storage != null) || isDisabled(storage)) {
                                data = {};
                                storage = {
                                    length: 0,
                                    getItem: function (key) {
                                        return data[key];
                                    },
                                    setItem: function (key, value) {
                                        data[key] = value;
                                        this.length = Object.keys(data).length;
                                    },
                                    removeItem: function (key) {
                                        delete data[key];
                                        this.length = Object.keys(data).length;
                                    },
                                    clear: function () {
                                        data = {};
                                        this.length = 0;
                                    }
                                };
                            }
                            return storage;
                        })();

                        return VASTUtil;

                    })();

                    module.exports = VASTUtil;

                }, {}
            ],
            3: [

                function (require, module, exports) {
                    var EventEmitter, VASTClient, VASTCreativeLinear, VASTTracker, VASTUtil,
                        __hasProp = Object.prototype.hasOwnProperty,
                        __extends = function (child, parent) {
                            for (var key in parent) {
                                if (__hasProp.call(parent, key)) child[key] = parent[key];
                            }

                            function ctor() {
                                this.constructor = child;
                            }
                            ctor.prototype = parent.prototype;
                            child.prototype = new ctor;
                            child.__super__ = parent.prototype;
                            return child;
                        };

                    VASTClient = require('./client.coffee');

                    VASTUtil = require('./util.coffee');

                    VASTCreativeLinear = require('./creative.coffee').VASTCreativeLinear;

                    EventEmitter = require('events').EventEmitter;

                    VASTTracker = (function (_super) {

                        __extends(VASTTracker, _super);

                        function VASTTracker(ad, creative) {
                            var eventName, events, _ref;
                            this.ad = ad;
                            this.creative = creative;
                            this.muted = false;
                            this.impressed = false;
                            this.skipable = false;
                            this.skipDelayDefault = -1;
                            this.trackingEvents = {};
                            _ref = creative.trackingEvents;
                            for (eventName in _ref) {
                                events = _ref[eventName];
                                this.trackingEvents[eventName] = events.slice(0);
                            }
                            if (creative instanceof VASTCreativeLinear) {
                                this.assetDuration = creative.duration;
                                this.skipDelay = creative.skipDelay;
                                this.linear = true;
                                this.clickThroughURLTemplate = creative.videoClickThroughURLTemplate;
                            } else {
                                this.skipDelay = -1;
                                this.linear = false;
                            }
                            this.on('start', function () {
                                VASTClient.lastSuccessfullAd = +new Date();
                            });
                        }

                        VASTTracker.prototype.setProgress = function (progress) {
                            var eventName, events, percent, skipDelay, _i, _len;
                            skipDelay = this.skipDelay === null ? this.skipDelayDefault : this.skipDelay;
                            if (skipDelay !== -1 && !this.skipable) {
                                if (skipDelay > progress) {
                                    this.emit('skip-countdown', skipDelay - progress);
                                } else {
                                    this.skipable = true;
                                    this.emit('skip-countdown', 0);
                                }
                            }
                            if (this.linear && this.assetDuration > 0) {
                                events = [];
                                if (progress > 0) {
                                    events.push("start");
                                    percent = Math.round(progress / this.assetDuration * 100);
                                    events.push("progress-" + percent + "%");
                                    if (percent >= 25) events.push("firstQuartile");
                                    if (percent >= 50) events.push("midpoint");
                                    if (percent >= 75) events.push("thirdQuartile");
                                    if (percent >= 100) events.push("complete");
                                }
                                for (_i = 0, _len = events.length; _i < _len; _i++) {
                                    eventName = events[_i];
                                    this.track(eventName);
                                    delete this.trackingEvents[eventName];
                                }
                                if (progress < this.progress) this.track("rewind");
                            }
                            return this.progress = progress;
                        };

                        VASTTracker.prototype.setMuted = function (muted) {
                            if (this.muted !== muted) this.track(muted ? "muted" : "unmuted");
                            return this.muted = muted;
                        };

                        VASTTracker.prototype.setPaused = function (paused) {
                            if (this.paused !== paused) this.track(paused ? "pause" : "resume");
                            return this.paused = paused;
                        };

                        VASTTracker.prototype.setFullscreen = function (fullscreen) {
                            if (this.fullscreen !== fullscreen) {
                                this.track(fullscreen ? "fullscreen" : "exitFullscreen");
                            }
                            return this.fullscreen = fullscreen;
                        };

                        VASTTracker.prototype.setSkipDelay = function (duration) {
                            if (typeof duration === 'number') return this.skipDelay = duration;
                        };

                        VASTTracker.prototype.load = function () {
                            if (!this.impressed) {
                                this.impressed = true;
                                this.trackURLs(this.ad.impressionURLTemplates);
                                return this.track("creativeView");
                            }
                        };

                        VASTTracker.prototype.errorWithCode = function (errorCode) {
                            return this.trackURLs(this.ad.errorURLTemplates, {
                                ERRORCODE: errorCode
                            });
                        };

                        VASTTracker.prototype.stop = function () {
                            return this.track(this.linear ? "cloaseLinear" : "close");
                        };

                        VASTTracker.prototype.skip = function () {
                            this.track("skip");
                            return this.trackingEvents = [];
                        };

                        VASTTracker.prototype.click = function () {
                            var clickThroughURL, variables;
                            if ((this.ad.clickTrackingURLTemplates) && (this.ad.clickTrackingURLTemplates.length > 0)) {
                                console.log('tracking ' + this.ad.clickTrackingURLTemplates);
                                this.trackURLs(this.ad.clickTrackingURLTemplates);
                            }
                            /*    if (this.clickThroughURLTemplate != null) {
      if (this.linear) {
        variables = {
          CONTENTPLAYHEAD: this.progressFormated()
        };
      }
      clickThroughURL = VASTUtil.resolveURLTemplates([this.clickThroughURLTemplate], variables)[0];
      return this.emit("clickthrough", clickThroughURL);
    } */
                        };

                        VASTTracker.prototype.track = function (eventName) {
                            var trackingURLTemplates;
                            trackingURLTemplates = this.trackingEvents[eventName];
                            if (trackingURLTemplates != null) {
                                this.emit(eventName, '');
                                return this.trackURLs(trackingURLTemplates);
                            }
                        };

                        VASTTracker.prototype.trackURLs = function (URLTemplates, variables) {
                            if (variables == null) variables = {};
                            if (this.linear) variables["CONTENTPLAYHEAD"] = this.progressFormated();
                            return VASTUtil.track(URLTemplates, variables);
                        };

                        VASTTracker.prototype.progressFormated = function () {
                            var h, m, ms, s, seconds;
                            seconds = parseInt(this.progress);
                            h = seconds / (60 * 60);
                            if (h.length < 2) h = "0" + h;
                            m = seconds / 60 % 60;
                            if (m.length < 2) m = "0" + m;
                            s = seconds % 60;
                            if (s.length < 2) s = "0" + m;
                            ms = parseInt((this.progress - seconds) * 100);
                            return "" + h + ":" + m + ":" + s + "." + ms;
                        };

                        return VASTTracker;

                    })(EventEmitter);

                    module.exports = VASTTracker;

                }, {
                    "events": 6,
                    "./client.coffee": 2,
                    "./util.coffee": 5,
                    "./creative.coffee": 7
                }
            ],
            8: [

                function (require, module, exports) {
                    // shim for using process in browser

                    var process = module.exports = {};

                    process.nextTick = (function () {
                        var canSetImmediate = typeof window !== 'undefined' && window.setImmediate;
                        var canPost = typeof window !== 'undefined' && window.postMessage && window.addEventListener;

                        if (canSetImmediate) {
                            return function (f) {
                                return window.setImmediate(f)
                            };
                        }

                        if (canPost) {
                            var queue = [];
                            window.addEventListener('message', function (ev) {
                                if (ev.source === window && ev.data === 'process-tick') {
                                    ev.stopPropagation();
                                    if (queue.length > 0) {
                                        var fn = queue.shift();
                                        fn();
                                    }
                                }
                            }, true);

                            return function nextTick(fn) {
                                queue.push(fn);
                                window.postMessage('process-tick', '*');
                            };
                        }

                        return function nextTick(fn) {
                            setTimeout(fn, 0);
                        };
                    })();

                    process.title = 'browser';
                    process.browser = true;
                    process.env = {};
                    process.argv = [];

                    process.binding = function (name) {
                        throw new Error('process.binding is not supported');
                    }

                    // TODO(shtylman)
                    process.cwd = function () {
                        return '/'
                    };
                    process.chdir = function (dir) {
                        throw new Error('process.chdir is not supported');
                    };

                }, {}
            ],
            6: [

                function (require, module, exports) {
                    (function (process) {
                        if (!process.EventEmitter) process.EventEmitter = function () {};

                        var EventEmitter = exports.EventEmitter = process.EventEmitter;
                        var isArray = typeof Array.isArray === 'function' ? Array.isArray : function (xs) {
                            return Object.prototype.toString.call(xs) === '[object Array]'
                        };

                        function indexOf(xs, x) {
                            if (xs.indexOf) return xs.indexOf(x);
                            for (var i = 0; i < xs.length; i++) {
                                if (x === xs[i]) return i;
                            }
                            return -1;
                        }

                        // By default EventEmitters will print a warning if more than
                        // 10 listeners are added to it. This is a useful default which
                        // helps finding memory leaks.
                        //
                        // Obviously not all Emitters should be limited to 10. This function allows
                        // that to be increased. Set to zero for unlimited.
                        var defaultMaxListeners = 10;
                        EventEmitter.prototype.setMaxListeners = function (n) {
                            if (!this._events) this._events = {};
                            this._events.maxListeners = n;
                        };


                        EventEmitter.prototype.emit = function (type) {
                            // If there is no 'error' event listener then throw.
                            if (type === 'error') {
                                if (!this._events || !this._events.error ||
                                    (isArray(this._events.error) && !this._events.error.length)) {
                                    if (arguments[1] instanceof Error) {
                                        throw arguments[1]; // Unhandled 'error' event
                                    } else {
                                        throw new Error("Uncaught, unspecified 'error' event.");
                                    }
                                    return false;
                                }
                            }

                            if (!this._events) return false;
                            var handler = this._events[type];
                            if (!handler) return false;

                            if (typeof handler == 'function') {
                                switch (arguments.length) {
                                    // fast cases
                                case 1:
                                    handler.call(this);
                                    break;
                                case 2:
                                    handler.call(this, arguments[1]);
                                    break;
                                case 3:
                                    handler.call(this, arguments[1], arguments[2]);
                                    break;
                                    // slower
                                default:
                                    var args = Array.prototype.slice.call(arguments, 1);
                                    handler.apply(this, args);
                                }
                                return true;

                            } else if (isArray(handler)) {
                                var args = Array.prototype.slice.call(arguments, 1);

                                var listeners = handler.slice();
                                for (var i = 0, l = listeners.length; i < l; i++) {
                                    listeners[i].apply(this, args);
                                }
                                return true;

                            } else {
                                return false;
                            }
                        };

                        // EventEmitter is defined in src/node_events.cc
                        // EventEmitter.prototype.emit() is also defined there.
                        EventEmitter.prototype.addListener = function (type, listener) {
                            if ('function' !== typeof listener) {
                                throw new Error('addListener only takes instances of Function');
                            }

                            if (!this._events) this._events = {};

                            // To avoid recursion in the case that type == "newListeners"! Before
                            // adding it to the listeners, first emit "newListeners".
                            this.emit('newListener', type, listener);

                            if (!this._events[type]) {
                                // Optimize the case of one listener. Don't need the extra array object.
                                this._events[type] = listener;
                            } else if (isArray(this._events[type])) {

                                // Check for listener leak
                                if (!this._events[type].warned) {
                                    var m;
                                    if (this._events.maxListeners !== undefined) {
                                        m = this._events.maxListeners;
                                    } else {
                                        m = defaultMaxListeners;
                                    }

                                    if (m && m > 0 && this._events[type].length > m) {
                                        this._events[type].warned = true;
                                        console.error('(node) warning: possible EventEmitter memory ' +
                                            'leak detected. %d listeners added. ' +
                                            'Use emitter.setMaxListeners() to increase limit.',
                                            this._events[type].length);
                                        console.trace();
                                    }
                                }

                                // If we've already got an array, just append.
                                this._events[type].push(listener);
                            } else {
                                // Adding the second element, need to change to array.
                                this._events[type] = [this._events[type], listener];
                            }

                            return this;
                        };

                        EventEmitter.prototype.on = EventEmitter.prototype.addListener;

                        EventEmitter.prototype.once = function (type, listener) {
                            var self = this;
                            self.on(type, function g() {
                                self.removeListener(type, g);
                                listener.apply(this, arguments);
                            });

                            return this;
                        };

                        EventEmitter.prototype.removeListener = function (type, listener) {
                            if ('function' !== typeof listener) {
                                throw new Error('removeListener only takes instances of Function');
                            }

                            // does not use listeners(), so no side effect of creating _events[type]
                            if (!this._events || !this._events[type]) return this;

                            var list = this._events[type];

                            if (isArray(list)) {
                                var i = indexOf(list, listener);
                                if (i < 0) return this;
                                list.splice(i, 1);
                                if (list.length == 0)
                                    delete this._events[type];
                            } else if (this._events[type] === listener) {
                                delete this._events[type];
                            }

                            return this;
                        };

                        EventEmitter.prototype.removeAllListeners = function (type) {
                            if (arguments.length === 0) {
                                this._events = {};
                                return this;
                            }

                            // does not use listeners(), so no side effect of creating _events[type]
                            if (type && this._events && this._events[type]) this._events[type] = null;
                            return this;
                        };

                        EventEmitter.prototype.listeners = function (type) {
                            if (!this._events) this._events = {};
                            if (!this._events[type]) this._events[type] = [];
                            if (!isArray(this._events[type])) {
                                this._events[type] = [this._events[type]];
                            }
                            return this._events[type];
                        };

                    })(require("__browserify_process"))
                }, {
                    "__browserify_process": 8
                }
            ],
            4: [

                function (require, module, exports) {
                    var URLHandler, VASTAd, VASTCreativeLinear, VASTMediaFile, VASTParser, VASTResponse, VASTUtil,
                        __indexOf = Array.prototype.indexOf || function (item) {
                            for (var i = 0, l = this.length; i < l; i++) {
                                if (i in this && this[i] === item) return i;
                            }
                            return -1;
                        };

                    URLHandler = require('./urlhandler.coffee');

                    VASTResponse = require('./response.coffee');

                    VASTAd = require('./ad.coffee');

                    VASTUtil = require('./util.coffee');

                    VASTCreativeLinear = require('./creative.coffee').VASTCreativeLinear;

                    VASTMediaFile = require('./mediafile.coffee');

                    VASTParser = (function () {
                        var URLTemplateFilters;

                        function VASTParser() {}

                        URLTemplateFilters = [];

                        VASTParser.addURLTemplateFilter = function (func) {
                            if (typeof func === 'function') URLTemplateFilters.push(func);
                        };

                        VASTParser.removeURLTemplateFilter = function () {
                            return URLTemplateFilters.pop();
                        };

                        VASTParser.countURLTemplateFilters = function () {
                            return URLTemplateFilters.length;
                        };

                        VASTParser.clearUrlTemplateFilters = function () {
                            return URLTemplateFilters = [];
                        };

                        VASTParser.parse = function (url, player, cb) {
                            return this._parse(url, null, player, function (err, response) {
                                return cb(response);
                            });
                        };

                        VASTParser._parse = function (url, parentURLs, player, cb) {
                            var filter, _i, _len,
                                _this = this;
                            for (_i = 0, _len = URLTemplateFilters.length; _i < _len; _i++) {
                                filter = URLTemplateFilters[_i];
                                url = filter(url);
                            }

                            var results = player.media.src.match(/(\d+)\.\w+$/);
                            var videoId;
                            if (results !== null) {
                                videoId = results[1];
                            } else {
                                results = player.media.src.match(/videos\/(\d+)\//);
                                videoId = results[1];
                            }
                            //Is this an Adotube URL during a midroll?  If so, bail because
                            //Adotube doesn't want midrolls.
                            var adotubeRegexp = /adotube\.com/i;
                            var isMidroll = ((typeof player.cuepointsState !== 'undefined') &&
                                (player.cuepointsState.visited.length > 1)) ? true : false;
                            if ((isMidroll) && (adotubeRegexp.test(url))) {
                                console.log("Found an Adotube midroll");
                                return cb();
                            }

                            url = url
                                .replace('__WEB_URL__', encodeURIComponent(window.location.href))
                                .replace('__CONTENT_URL__', encodeURIComponent(player.options.src))
                                .replace('__WIDTH__', player.width)
                                .replace('__HEIGHT__', player.height)
                                .replace('__RANDOM__', Math.round(Math.random() * Math.pow(10, 15)))
                                .replace('__TIME__', Math.round((new Date()).getTime() / 1000))
                                .replace('__TITLE__', encodeURIComponent(player.options.title))
                                .replace('__MEDIA_ID__', encodeURIComponent(videoId))
                                .replace('__UA__', encodeURIComponent(navigator.userAgent))
                                .replace('__OS__', encodeURIComponent(navigator.platform))
                                .replace('__UNIQUE_ID__', player.userID)
                                .replace('__UNIQUEID__', player.userID)
                                .replace(/(\d+\/)0(\/\d+)/, "$1" + videoId + "$2");
                            console.log('VAST parse fetching ' + url);

                            if (parentURLs == null) parentURLs = [];
                            parentURLs.push(url);
                            return URLHandler.get(url, function (err, xml) {
                                console.log('URL handler got URL: ' + url);
                                var ad, complete, node, response, _fn, _j, _k, _l, _len2, _len3, _len4, _ref, _ref2, _ref3;
                                if (err != null) return cb(err);
                                response = new VASTResponse();

                                // Is this a custom Google response from Adtech?
                                if ((xml !== null) && (xml.documentElement.attributes[0].value === 'google')) {
                                    console.log('found a Google tag');
                                    window.__is_google = true;
                                    response.xml = xml;
                                    return cb(null, response);
                                }

                                // Is this an invalid response?
                                if (!(((xml != null ? xml.documentElement : void 0) != null) && xml.documentElement.nodeName === "VAST")) {
                                    return cb();
                                }

                                // Okay, we have some VAST, now let's work with it
                                _ref = xml.documentElement.childNodes;
                                for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
                                    node = _ref[_j];
                                    if (node.nodeName === 'Error') {
                                        response.errorURLTemplates.push(node.textContent);
                                    }
                                }
                                _ref2 = xml.documentElement.childNodes;
                                for (_k = 0, _len3 = _ref2.length; _k < _len3; _k++) {
                                    node = _ref2[_k];
                                    if (node.nodeName === 'Ad') {
                                        ad = _this.parseAdElement(node);
                                        if (url.match(/ads\.intergi\.com/)) {
                                            console.log('Ad id located and stored: ' + node.attributes[0].nodeValue);
                                            window.__ad_ids.push(node.attributes[0].nodeValue);
                                        }
                                        if (ad != null) {
                                            response.ads.push(ad);
                                        } else {
                                            VASTUtil.track(response.errorURLTemplates, {
                                                ERRORCODE: 101
                                            });
                                        }
                                    }
                                }
                                complete = function () {
                                    var ad, _l, _len4, _ref3;
                                    if (!response) return;
                                    _ref3 = response.ads;
                                    for (_l = 0, _len4 = _ref3.length; _l < _len4; _l++) {
                                        ad = _ref3[_l];
                                        if (ad.nextWrapperURL != null) return;
                                    }
                                    if (response.ads.length === 0) {
                                        VASTUtil.track(response.errorURLTemplates, {
                                            ERRORCODE: 303
                                        });
                                        response = null;
                                    }
                                    return cb(null, response);
                                };
                                _ref3 = response.ads;
                                _fn = function (ad) {
                                    var baseURL, _ref4;
                                    if (parentURLs.length >= 10 || (_ref4 = ad.nextWrapperURL, __indexOf.call(parentURLs, _ref4) >= 0)) {
                                        VASTUtil.track(ad.errorURLTemplates, {
                                            ERRORCODE: 302
                                        });
                                        response.ads.splice(response.ads.indexOf(ad), 1);
                                        complete();
                                        return;
                                    }
                                    if (ad.nextWrapperURL.indexOf('://') === -1) {
                                        baseURL = url.slice(0, url.lastIndexOf('/'));
                                        ad.nextWrapperURL = "" + baseURL + "/" + ad.nextWrapperURL;
                                    }
                                    return _this._parse(ad.nextWrapperURL, parentURLs, player, function (err, wrappedResponse) {
                                        var creative, eventName, index, wrappedAd, _base, _len5, _len6, _len7, _m, _n, _o, _ref5, _ref6, _ref7;
                                        if (err != null) {
                                            VASTUtil.track(ad.errorURLTemplates, {
                                                ERRORCODE: 301
                                            });
                                            response.ads.splice(response.ads.indexOf(ad), 1);
                                        } else if (!(wrappedResponse != null)) {
                                            VASTUtil.track(ad.errorURLTemplates, {
                                                ERRORCODE: 303
                                            });
                                            response.ads.splice(response.ads.indexOf(ad), 1);
                                        } else {
                                            response.errorURLTemplates = response.errorURLTemplates.concat(wrappedResponse.errorURLTemplates);
                                            index = response.ads.indexOf(ad);
                                            response.ads.splice(index, 1);
                                            _ref5 = wrappedResponse.ads;
                                            for (_m = 0, _len5 = _ref5.length; _m < _len5; _m++) {
                                                wrappedAd = _ref5[_m];
                                                wrappedAd.errorURLTemplates = ad.errorURLTemplates.concat(wrappedAd.errorURLTemplates);
                                                wrappedAd.impressionURLTemplates = ad.impressionURLTemplates.concat(wrappedAd.impressionURLTemplates);
                                                wrappedAd.clickTrackingURLTemplates = ad.clickTrackingURLTemplates.concat(wrappedAd.clickTrackingURLTemplates);
                                                if (ad.trackingEvents != null) {
                                                    _ref6 = wrappedAd.creatives;
                                                    for (_n = 0, _len6 = _ref6.length; _n < _len6; _n++) {
                                                        creative = _ref6[_n];
                                                        _ref7 = Object.keys(ad.trackingEvents);
                                                        for (_o = 0, _len7 = _ref7.length; _o < _len7; _o++) {
                                                            eventName = _ref7[_o];
                                                            (_base = creative.trackingEvents)[eventName] || (_base[eventName] = []);
                                                            creative.trackingEvents[eventName] = creative.trackingEvents[eventName].concat(ad.trackingEvents[eventName]);
                                                        }
                                                    }
                                                }
                                                response.ads.splice(index, 0, wrappedAd);
                                            }
                                        }
                                        delete ad.nextWrapperURL;
                                        return complete();
                                    });
                                };
                                for (_l = 0, _len4 = _ref3.length; _l < _len4; _l++) {
                                    ad = _ref3[_l];
                                    if (ad.nextWrapperURL == null) continue;
                                    _fn(ad);
                                }
                                return complete();
                            });
                        };

                        VASTParser.childByName = function (node, name) {
                            var child, _i, _len, _ref;
                            _ref = node.childNodes;
                            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                                child = _ref[_i];
                                if (child.nodeName === name) return child;
                            }
                        };

                        VASTParser.childsByName = function (node, name) {
                            var child, childs, _i, _len, _ref;
                            childs = [];
                            _ref = node.childNodes;
                            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                                child = _ref[_i];
                                if (child.nodeName === name) childs.push(child);
                            }
                            return childs;
                        };

                        VASTParser.parseAdElement = function (adElement) {
                            var adTypeElement, _i, _len, _ref;
                            _ref = adElement.childNodes;
                            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                                adTypeElement = _ref[_i];
                                if (adTypeElement.nodeName === "Wrapper") {
                                    return this.parseWrapperElement(adTypeElement);
                                } else if (adTypeElement.nodeName === "InLine") {
                                    return this.parseInLineElement(adTypeElement);
                                }
                            }
                        };

                        VASTParser.parseWrapperElement = function (wrapperElement) {
                            var ad, wrapperCreativeElement, wrapperURLElement;
                            ad = this.parseInLineElement(wrapperElement);
                            wrapperURLElement = this.childByName(wrapperElement, "VASTAdTagURI");
                            if (wrapperURLElement != null) {
                                ad.nextWrapperURL = wrapperURLElement.textContent;
                            }
                            wrapperCreativeElement = ad.creatives[0];
                            if ((wrapperCreativeElement != null) && (wrapperCreativeElement.trackingEvents != null)) {
                                ad.trackingEvents = wrapperCreativeElement.trackingEvents;
                            }
                            if (ad.nextWrapperURL != null) return ad;
                        };

                        VASTParser.parseInLineElement = function (inLineElement) {
                            var ad, creative, creativeElement, creativeTypeElement, node, _i, _j, _k, _len, _len2, _len3, _ref, _ref2, _ref3;
                            ad = new VASTAd();
                            _ref = inLineElement.childNodes;
                            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                                node = _ref[_i];
                                switch (node.nodeName) {
                                case "Error":
                                    ad.errorURLTemplates.push(node.textContent);
                                    break;
                                case "Impression":
                                    ad.impressionURLTemplates.push(node.textContent);
                                    break;
                                case "Creatives":
                                    _ref2 = this.childsByName(node, "Creative");
                                    for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
                                        creativeElement = _ref2[_j];
                                        _ref3 = creativeElement.childNodes;
                                        for (_k = 0, _len3 = _ref3.length; _k < _len3; _k++) {
                                            creativeTypeElement = _ref3[_k];
                                            switch (creativeTypeElement.nodeName) {
                                            case "Linear":
                                                creative = this.parseCreativeLinearElement(creativeTypeElement);
                                                if (creative) {
                                                    if (creative.videoClickTrackingURLTemplate !== undefined) {
                                                        ad.clickTrackingURLTemplates.push(creative.videoClickTrackingURLTemplate);
                                                    }
                                                    ad.creatives.push(creative);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            return ad;
                        };

                        VASTParser.parseCreativeLinearElement = function (creativeElement) {
                            var creative, eventName, mediaFile, mediaFileElement, mediaFilesElement, percent, skipOffset, trackingElement, trackingEventsElement, trackingURLTemplate, videoClicksElement, _base, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
                            creative = new VASTCreativeLinear();
                            creative.duration = this.parseDuration((_ref = this.childByName(creativeElement, "Duration")) != null ? _ref.textContent : void 0);
                            if (creative.duration === -1 && creativeElement.parentNode.parentNode.parentNode.nodeName !== 'Wrapper') {
                                return null;
                            }
                            skipOffset = creativeElement.getAttribute("skipoffset");
                            if (!(skipOffset != null)) {
                                creative.skipDelay = null;
                            } else if (skipOffset.charAt(skipOffset.length - 1) === "%") {
                                percent = parseInt(skipOffset, 10);
                                creative.skipDelay = creative.duration * (percent / 100);
                            } else {
                                creative.skipDelay = this.parseDuration(skipOffset);
                            }
                            videoClicksElement = this.childByName(creativeElement, "VideoClicks");
                            if (videoClicksElement != null) {
                                creative.videoClickThroughURLTemplate = (_ref2 = this.childByName(videoClicksElement, "ClickThrough")) != null ? _ref2.textContent : void 0;
                                creative.videoClickTrackingURLTemplate = (_ref3 = this.childByName(videoClicksElement, "ClickTracking")) != null ? _ref3.textContent : void 0;
                            }
                            _ref4 = this.childsByName(creativeElement, "TrackingEvents");
                            for (_i = 0, _len = _ref4.length; _i < _len; _i++) {
                                trackingEventsElement = _ref4[_i];
                                _ref5 = this.childsByName(trackingEventsElement, "Tracking");
                                for (_j = 0, _len2 = _ref5.length; _j < _len2; _j++) {
                                    trackingElement = _ref5[_j];
                                    eventName = trackingElement.getAttribute("event");
                                    trackingURLTemplate = trackingElement.textContent;
                                    if ((eventName != null) && (trackingURLTemplate != null)) {
                                        if ((_base = creative.trackingEvents)[eventName] == null) {
                                            _base[eventName] = [];
                                        }
                                        creative.trackingEvents[eventName].push(trackingURLTemplate);
                                    }
                                }
                            }
                            _ref6 = this.childsByName(creativeElement, "MediaFiles");
                            for (_k = 0, _len3 = _ref6.length; _k < _len3; _k++) {
                                mediaFilesElement = _ref6[_k];
                                _ref7 = this.childsByName(mediaFilesElement, "MediaFile");
                                for (_l = 0, _len4 = _ref7.length; _l < _len4; _l++) {
                                    mediaFileElement = _ref7[_l];
                                    mediaFile = new VASTMediaFile();
                                    mediaFile.fileURL = mediaFileElement.textContent;
                                    mediaFile.deliveryType = mediaFileElement.getAttribute("delivery");
                                    mediaFile.codec = mediaFileElement.getAttribute("codec");
                                    mediaFile.mimeType = mediaFileElement.getAttribute("type");
                                    mediaFile.bitrate = parseInt(mediaFileElement.getAttribute("bitrate") || 0);
                                    mediaFile.minBitrate = parseInt(mediaFileElement.getAttribute("minBitrate") || 0);
                                    mediaFile.maxBitrate = parseInt(mediaFileElement.getAttribute("maxBitrate") || 0);
                                    mediaFile.width = parseInt(mediaFileElement.getAttribute("width") || 0);
                                    mediaFile.height = parseInt(mediaFileElement.getAttribute("height") || 0);
                                    creative.mediaFiles.push(mediaFile);
                                }
                            }
                            return creative;
                        };

                        VASTParser.parseDuration = function (durationString) {
                            var durationComponents, hours, minutes, seconds, secondsAndMS;
                            if (!(durationString != null)) return -1;
                            durationComponents = durationString.split(":");
                            if (durationComponents.length !== 3) return -1;
                            secondsAndMS = durationComponents[2].split(".");
                            seconds = parseInt(secondsAndMS[0]);
                            if (secondsAndMS.length === 2) seconds += parseFloat("0." + secondsAndMS[1]);
                            minutes = parseInt(durationComponents[1] * 60);
                            hours = parseInt(durationComponents[0] * 60 * 60);
                            if (isNaN(hours || isNaN(minutes || isNaN(seconds || minutes > 60 * 60 || seconds > 60)))) {
                                return -1;
                            }
                            return hours + minutes + seconds;
                        };

                        return VASTParser;

                    })();

                    module.exports = VASTParser;

                }, {
                    "./urlhandler.coffee": 9,
                    "./response.coffee": 10,
                    "./ad.coffee": 11,
                    "./util.coffee": 5,
                    "./creative.coffee": 7,
                    "./mediafile.coffee": 12
                }
            ],
            7: [

                function (require, module, exports) {
                    var VASTCreative, VASTCreativeCompanion, VASTCreativeLinear, VASTCreativeNonLinear,
                        __hasProp = Object.prototype.hasOwnProperty,
                        __extends = function (child, parent) {
                            for (var key in parent) {
                                if (__hasProp.call(parent, key)) child[key] = parent[key];
                            }

                            function ctor() {
                                this.constructor = child;
                            }
                            ctor.prototype = parent.prototype;
                            child.prototype = new ctor;
                            child.__super__ = parent.prototype;
                            return child;
                        };

                    VASTCreative = (function () {

                        function VASTCreative() {
                            this.trackingEvents = {};
                        }

                        return VASTCreative;

                    })();

                    VASTCreativeLinear = (function (_super) {

                        __extends(VASTCreativeLinear, _super);

                        function VASTCreativeLinear() {
                            VASTCreativeLinear.__super__.constructor.apply(this, arguments);
                            this.type = "linear";
                            this.duration = 0;
                            this.skipDelay = null;
                            this.mediaFiles = [];
                            this.videoClickThroughURLTemplate = null;
                            this.videoClickTrackingURLTemplate = null;
                        }

                        return VASTCreativeLinear;

                    })(VASTCreative);

                    VASTCreativeNonLinear = (function (_super) {

                        __extends(VASTCreativeNonLinear, _super);

                        function VASTCreativeNonLinear() {
                            VASTCreativeNonLinear.__super__.constructor.apply(this, arguments);
                        }

                        return VASTCreativeNonLinear;

                    })(VASTCreative);

                    VASTCreativeCompanion = (function (_super) {

                        __extends(VASTCreativeCompanion, _super);

                        function VASTCreativeCompanion() {
                            VASTCreativeCompanion.__super__.constructor.apply(this, arguments);
                        }

                        return VASTCreativeCompanion;

                    })(VASTCreative);

                    module.exports = {
                        VASTCreativeLinear: VASTCreativeLinear,
                        VASTCreativeNonLinear: VASTCreativeNonLinear,
                        VASTCreativeCompanion: VASTCreativeCompanion
                    };

                }, {}
            ],
            9: [

                function (require, module, exports) {
                    var URLHandler, flash, xhr;

                    xhr = require('./urlhandlers/xmlhttprequest.coffee');

                    flash = require('./urlhandlers/flash.coffee');

                    URLHandler = (function () {

                        function URLHandler() {}

                        URLHandler.get = function (url, cb) {
                            if (!(typeof window !== "undefined" && window !== null)) {
                                return require('./urlhandlers/' + 'node.coffee').get(url, cb);
                            } else if (xhr.supported()) {
                                return xhr.get(url, cb);
                            } else {
                                return flash.get(url, cb);
                            }
                        };

                        return URLHandler;

                    })();

                    module.exports = URLHandler;

                }, {
                    "./urlhandlers/xmlhttprequest.coffee": 13,
                    "./urlhandlers/flash.coffee": 14
                }
            ],
            10: [

                function (require, module, exports) {
                    var VASTResponse;

                    VASTResponse = (function () {

                        function VASTResponse() {
                            this.ads = [];
                            this.errorURLTemplates = [];
                        }

                        return VASTResponse;

                    })();

                    module.exports = VASTResponse;

                }, {}
            ],
            11: [

                function (require, module, exports) {
                    var VASTAd;

                    VASTAd = (function () {

                        function VASTAd() {
                            this.errorURLTemplates = [];
                            this.impressionURLTemplates = [];
                            this.clickTrackingURLTemplates = [];
                            this.creatives = [];
                        }

                        return VASTAd;

                    })();

                    module.exports = VASTAd;

                }, {}
            ],
            12: [

                function (require, module, exports) {
                    var VASTMediaFile;

                    VASTMediaFile = (function () {

                        function VASTMediaFile() {
                            this.fileURL = null;
                            this.deliveryType = "progressive";
                            this.mimeType = null;
                            this.codec = null;
                            this.bitrate = 0;
                            this.minBitrate = 0;
                            this.maxBitrate = 0;
                            this.width = 0;
                            this.height = 0;
                        }

                        return VASTMediaFile;

                    })();

                    module.exports = VASTMediaFile;

                }, {}
            ],
            13: [

                function (require, module, exports) {
                    var XHRURLHandler;

                    XHRURLHandler = (function () {

                        function XHRURLHandler() {}

                        XHRURLHandler.xhr = function () {
                            var xhr;
                            xhr = new window.XMLHttpRequest();
                            if ('withCredentials' in xhr) return xhr;
                        };

                        XHRURLHandler.supported = function () {
                            return !!this.xhr();
                        };

                        XHRURLHandler.get = function (url, cb) {
                            var xhr;
                            xhr = this.xhr();
                            xhr.open('GET', url);
                            xhr.send();
                            return xhr.onreadystatechange = function () {
                                if (xhr.readyState === 4) return cb(null, xhr.responseXML);
                            };
                        };

                        return XHRURLHandler;

                    })();

                    module.exports = XHRURLHandler;

                }, {}
            ],
            14: [

                function (require, module, exports) {
                    var FlashURLHandler;

                    FlashURLHandler = (function () {

                        function FlashURLHandler() {}

                        FlashURLHandler.get = function (url, cb) {
                            return cb('not supported');
                        };

                        return FlashURLHandler;

                    })();

                    module.exports = FlashURLHandler;

                }, {}
            ]
        }, {}, [1])(1)
    });;
    // Namespace
    var mejs = mejs || {};

    // version number
    mejs.version = '2.12.0';

    // player number (for missing, same id attr)
    mejs.meIndex = 0;

    // media types accepted by plugins
    mejs.plugins = {
        silverlight: [{
            version: [3, 0],
            types: ['video/mp4', 'video/m4v', 'video/mov', 'video/wmv', 'audio/wma', 'audio/m4a', 'audio/mp3', 'audio/wav', 'audio/mpeg']
        }],
        flash: [{
                version: [9, 0, 124],
                types: ['video/mp4', 'video/m4v', 'video/mov', 'video/flv', 'video/rtmp', 'video/x-flv', 'audio/flv', 'audio/x-flv', 'audio/mp3', 'audio/m4a', 'audio/mpeg', 'video/youtube', 'video/x-youtube']
            }
            //,{version: [12,0], types: ['video/webm']} // for future reference (hopefully!)
        ],
        youtube: [{
            version: null,
            types: ['video/youtube', 'video/x-youtube', 'audio/youtube', 'audio/x-youtube']
        }],
        vimeo: [{
            version: null,
            types: ['video/vimeo', 'video/x-vimeo']
        }]
    };

    define("me/me-namespace", function () {});

    /*
Utility methods
*/
    mejs.Utility = {
        encodeUrl: function (url) {
            return encodeURIComponent(url); //.replace(/\?/gi,'%3F').replace(/=/gi,'%3D').replace(/&/gi,'%26');
        },
        escapeHTML: function (s) {
            return s.toString().split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
        },
        absolutizeUrl: function (url) {
            var el = document.createElement('div');
            el.innerHTML = '<a href="' + this.escapeHTML(url) + '">x</a>';
            return el.firstChild.href;
        },
        getScriptPath: function (scriptNames) {
            var
                i = 0,
                j,
                codePath = '',
                testname = '',
                slashPos,
                filenamePos,
                scriptUrl,
                scriptPath,
                scriptFilename,
                scripts = document.getElementsByTagName('script'),
                il = scripts.length,
                jl = scriptNames.length;

            // go through all <script> tags
            for (; i < il; i++) {
                scriptUrl = scripts[i].src;
                slashPos = scriptUrl.lastIndexOf('/');
                if (slashPos > -1) {
                    scriptFilename = scriptUrl.substring(slashPos + 1);
                    scriptPath = scriptUrl.substring(0, slashPos + 1);
                } else {
                    scriptFilename = scriptUrl;
                    scriptPath = '';
                }

                // see if any <script> tags have a file name that matches the
                for (j = 0; j < jl; j++) {
                    testname = scriptNames[j];
                    filenamePos = scriptFilename.indexOf(testname);
                    if (filenamePos > -1) {
                        codePath = scriptPath;
                        break;
                    }
                }

                // if we found a path, then break and return it
                if (codePath !== '') {
                    break;
                }
            }

            // send the best path back
            return codePath;
        },
        secondsToTimeCode: function (time, forceHours, showFrameCount, fps) {
            //add framecount
            if (typeof showFrameCount == 'undefined') {
                showFrameCount = false;
            } else if (typeof fps == 'undefined') {
                fps = 25;
            }

            var hours = Math.floor(time / 3600) % 24,
                minutes = Math.floor(time / 60) % 60,
                seconds = Math.floor(time % 60),
                frames = Math.floor(((time % 1) * fps).toFixed(3)),
                result =
                ((forceHours || hours > 0) ? (hours < 10 ? '0' + hours : hours) + ':' : '') + (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds) + ((showFrameCount) ? ':' + (frames < 10 ? '0' + frames : frames) : '');

            return result;
        },

        timeCodeToSeconds: function (hh_mm_ss_ff, forceHours, showFrameCount, fps) {
            if (typeof showFrameCount == 'undefined') {
                showFrameCount = false;
            } else if (typeof fps == 'undefined') {
                fps = 25;
            }

            var tc_array = hh_mm_ss_ff.split(":"),
                tc_hh = parseInt(tc_array[0], 10),
                tc_mm = parseInt(tc_array[1], 10),
                tc_ss = parseInt(tc_array[2], 10),
                tc_ff = 0,
                tc_in_seconds = 0;

            if (showFrameCount) {
                tc_ff = parseInt(tc_array[3]) / fps;
            }

            tc_in_seconds = (tc_hh * 3600) + (tc_mm * 60) + tc_ss + tc_ff;

            return tc_in_seconds;
        },


        convertSMPTEtoSeconds: function (SMPTE) {
            if (typeof SMPTE != 'string')
                return false;

            SMPTE = SMPTE.replace(',', '.');

            var secs = 0,
                decimalLen = (SMPTE.indexOf('.') != -1) ? SMPTE.split('.')[1].length : 0,
                multiplier = 1;

            SMPTE = SMPTE.split(':').reverse();

            for (var i = 0; i < SMPTE.length; i++) {
                multiplier = 1;
                if (i > 0) {
                    multiplier = Math.pow(60, i);
                }
                secs += Number(SMPTE[i]) * multiplier;
            }
            return Number(secs.toFixed(decimalLen));
        },

        /* borrowed from SWFObject: http://code.google.com/p/swfobject/source/browse/trunk/swfobject/src/swfobject.js#474 */
        removeSwf: function (id) {
            var obj = document.getElementById(id);
            if (obj && /object|embed/i.test(obj.nodeName)) {
                if (mejs.MediaFeatures.isIE) {
                    obj.style.display = "none";
                    (function () {
                        if (obj.readyState == 4) {
                            mejs.Utility.removeObjectInIE(id);
                        } else {
                            setTimeout(arguments.callee, 10);
                        }
                    })();
                } else {
                    obj.parentNode.removeChild(obj);
                }
            }
        },
        removeObjectInIE: function (id) {
            var obj = document.getElementById(id);
            if (obj) {
                for (var i in obj) {
                    if (typeof obj[i] == "function") {
                        obj[i] = null;
                    }
                }
                obj.parentNode.removeChild(obj);
            }
        }
    };

    define("me/me-utility", function () {});


    // Core detector, plugins are added below
    mejs.PluginDetector = {

        // main public function to test a plug version number PluginDetector.hasPluginVersion('flash',[9,0,125]);
        hasPluginVersion: function (plugin, v) {
            var pv = this.plugins[plugin];
            v[1] = v[1] || 0;
            v[2] = v[2] || 0;
            return (pv[0] > v[0] || (pv[0] == v[0] && pv[1] > v[1]) || (pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2])) ? true : false;
        },

        // cached values
        nav: window.navigator,
        ua: window.navigator.userAgent.toLowerCase(),

        // stored version numbers
        plugins: [],

        // runs detectPlugin() and stores the version number
        addPlugin: function (p, pluginName, mimeType, activeX, axDetect) {
            this.plugins[p] = this.detectPlugin(pluginName, mimeType, activeX, axDetect);
        },

        // get the version number from the mimetype (all but IE) or ActiveX (IE)
        detectPlugin: function (pluginName, mimeType, activeX, axDetect) {

            var version = [0, 0, 0],
                description,
                i,
                ax;

            // Firefox, Webkit, Opera
            if (typeof (this.nav.plugins) != 'undefined' && typeof this.nav.plugins[pluginName] == 'object') {
                description = this.nav.plugins[pluginName].description;
                if (description && !(typeof this.nav.mimeTypes != 'undefined' && this.nav.mimeTypes[mimeType] && !this.nav.mimeTypes[mimeType].enabledPlugin)) {
                    version = description.replace(pluginName, '').replace(/^\s+/, '').replace(/\sr/gi, '.').split('.');
                    for (i = 0; i < version.length; i++) {
                        version[i] = parseInt(version[i].match(/\d+/), 10);
                    }
                }
                // Internet Explorer / ActiveX
            } else if (typeof (window.ActiveXObject) != 'undefined') {
                try {
                    ax = new ActiveXObject(activeX);
                    if (ax) {
                        version = axDetect(ax);
                    }
                } catch (e) {}
            }
            return version;
        }
    };

    // Add Flash detection
    mejs.PluginDetector.addPlugin('flash', 'Shockwave Flash', 'application/x-shockwave-flash', 'ShockwaveFlash.ShockwaveFlash', function (ax) {
        // adapted from SWFObject
        var version = [],
            d = ax.GetVariable("$version");
        if (d) {
            d = d.split(" ")[1].split(",");
            version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
        }
        return version;
    });

    // Add Silverlight detection
    mejs.PluginDetector.addPlugin('silverlight', 'Silverlight Plug-In', 'application/x-silverlight-2', 'AgControl.AgControl', function (ax) {
        // Silverlight cannot report its version number to IE
        // but it does have a isVersionSupported function, so we have to loop through it to get a version number.
        // adapted from http://www.silverlightversion.com/
        var v = [0, 0, 0, 0],
            loopMatch = function (ax, v, i, n) {
                while (ax.isVersionSupported(v[0] + "." + v[1] + "." + v[2] + "." + v[3])) {
                    v[i] += n;
                }
                v[i] -= n;
            };
        loopMatch(ax, v, 0, 1);
        loopMatch(ax, v, 1, 1);
        loopMatch(ax, v, 2, 10000); // the third place in the version number is usually 5 digits (4.0.xxxxx)
        loopMatch(ax, v, 2, 1000);
        loopMatch(ax, v, 2, 100);
        loopMatch(ax, v, 2, 10);
        loopMatch(ax, v, 2, 1);
        loopMatch(ax, v, 3, 1);

        return v;
    });
    // add adobe acrobat
    /*
PluginDetector.addPlugin('acrobat','Adobe Acrobat','application/pdf','AcroPDF.PDF', function (ax) {
      var version = [],
              d = ax.GetVersions().split(',')[0].split('=')[1].split('.');

  if (d) {
               version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
        }
      return version;
});
*/
    ;
    define("me/me-plugindetector", function () {});

    // necessary detection (fixes for <IE9)
    mejs.MediaFeatures = {
        init: function () {
            var
                t = this,
                d = document,
                nav = mejs.PluginDetector.nav,
                ua = mejs.PluginDetector.ua.toLowerCase(),
                i,
                v,
                html5Elements = ['source', 'track', 'audio', 'video'];

            // detect browsers (only the ones that have some kind of quirk we need to work around)
            t.isiPad = (ua.match(/ipad/i) !== null);
            t.isiPhone = (ua.match(/iphone/i) !== null);
            t.isiOS = t.isiPhone || t.isiPad;
            t.isAndroid = (ua.match(/android/i) !== null);
            t.isBustedAndroid = (ua.match(/android 2\.[12]/) !== null);
            t.isBustedNativeHTTPS = (location.protocol === 'https:' && (ua.match(/android [12]\./) !== null || ua.match(/macintosh.* version.* safari/) !== null));
            t.isIE = (nav.appName.toLowerCase().indexOf("microsoft") != -1);
            t.isChrome = (ua.match(/chrome/gi) !== null);
            t.isFirefox = (ua.match(/firefox/gi) !== null);
            t.isWebkit = (ua.match(/webkit/gi) !== null);
            t.isGecko = (ua.match(/gecko/gi) !== null) && !t.isWebkit;
            t.isOpera = (ua.match(/opera/gi) !== null);
            t.hasTouch = ('ontouchstart' in window);

            // borrowed from Modernizr
            t.svg = !!document.createElementNS &&
                !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect;

            // create HTML5 media elements for IE before 9, get a <video> element for fullscreen detection
            for (i = 0; i < html5Elements.length; i++) {
                v = document.createElement(html5Elements[i]);
            }

            t.supportsMediaTag = (typeof v.canPlayType !== 'undefined' || t.isBustedAndroid);

            // Fix for IE9 on Windows 7N / Windows 7KN (Media Player not installer)
            try {
                v.canPlayType("video/mp4");
            } catch (e) {
                t.supportsMediaTag = false;
            }

            // detect native JavaScript fullscreen (Safari/Firefox only, Chrome still fails)

            // iOS
            t.hasSemiNativeFullScreen = (typeof v.webkitEnterFullscreen !== 'undefined');

            // Webkit/firefox
            t.hasWebkitNativeFullScreen = (typeof v.webkitRequestFullScreen !== 'undefined');
            t.hasMozNativeFullScreen = (typeof v.mozRequestFullScreen !== 'undefined');

            t.hasTrueNativeFullScreen = (t.hasWebkitNativeFullScreen || t.hasMozNativeFullScreen);
            t.nativeFullScreenEnabled = t.hasTrueNativeFullScreen;
            if (t.hasMozNativeFullScreen) {
                t.nativeFullScreenEnabled = v.mozFullScreenEnabled;
            }


            if (this.isChrome) {
                t.hasSemiNativeFullScreen = false;
            }

            if (t.hasTrueNativeFullScreen) {
                t.fullScreenEventName = (t.hasWebkitNativeFullScreen) ? 'webkitfullscreenchange' : 'mozfullscreenchange';


                t.isFullScreen = function () {
                    if (v.mozRequestFullScreen) {
                        return d.mozFullScreen;
                    } else if (v.webkitRequestFullScreen) {
                        return d.webkitIsFullScreen;
                    }
                }

                t.requestFullScreen = function (el) {

                    if (t.hasWebkitNativeFullScreen) {
                        el.webkitRequestFullScreen();
                    } else if (t.hasMozNativeFullScreen) {
                        el.mozRequestFullScreen();
                    }
                }

                t.cancelFullScreen = function () {
                    if (t.hasWebkitNativeFullScreen) {
                        document.webkitCancelFullScreen();
                    } else if (t.hasMozNativeFullScreen) {
                        document.mozCancelFullScreen();
                    }
                }

            }


            // OS X 10.5 can't do this even if it says it can :(
            if (t.hasSemiNativeFullScreen && ua.match(/mac os x 10_5/i)) {
                t.hasNativeFullScreen = false;
                t.hasSemiNativeFullScreen = false;
            }

        }
    };
    mejs.MediaFeatures.init();

    define("me/me-featuredetection", function () {});

    /*
extension methods to <video> or <audio> object to bring it into parity with PluginMediaElement (see below)
*/
    mejs.HtmlMediaElement = {
        pluginType: 'native',
        isFullScreen: false,

        setCurrentTime: function (time) {
            this.currentTime = time;
        },

        setMuted: function (muted) {
            this.muted = muted;
        },

        setVolume: function (volume) {
            this.volume = volume;
        },

        // for parity with the plugin versions
        stop: function () {
            this.pause();
        },

        // This can be a url string
        // or an array [{src:'file.mp4',type:'video/mp4'},{src:'file.webm',type:'video/webm'}]
        setSrc: function (url) {

            // Fix for IE9 which can't set .src when there are <source> elements. Awesome, right?
            var
                existingSources = this.getElementsByTagName('source');
            while (existingSources.length > 0) {
                this.removeChild(existingSources[0]);
            }

            if (typeof url == 'string') {
                this.src = url;
            } else {
                var i, media;

                for (i = 0; i < url.length; i++) {
                    media = url[i];
                    if (this.canPlayType(media.type)) {
                        this.src = media.src;
                        break;
                    }
                }
            }
        },

        setVideoSize: function (width, height) {
            this.width = width;
            this.height = height;
        }
    };

    /*
Mimics the <video/audio> element by calling Flash's External Interface or Silverlights [ScriptableMember]
*/
    mejs.PluginMediaElement = function (pluginid, pluginType, mediaUrl) {
        this.id = pluginid;
        this.pluginType = pluginType;
        this.src = mediaUrl;
        this.events = {};
        this.attributes = {};
    };

    // JavaScript values and ExternalInterface methods that match HTML5 video properties methods
    // http://www.adobe.com/livedocs/flash/9.0/ActionScriptLangRefV3/fl/video/FLVPlayback.html
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html
    mejs.PluginMediaElement.prototype = {

        // special
        pluginElement: null,
        pluginType: '',
        isFullScreen: false,

        // not implemented :(
        playbackRate: -1,
        defaultPlaybackRate: -1,
        seekable: [],
        played: [],

        // HTML5 read-only properties
        paused: true,
        ended: false,
        seeking: false,
        duration: 0,
        error: null,
        tagName: '',

        // HTML5 get/set properties, but only set (updated by event handlers)
        muted: false,
        volume: 1,
        currentTime: 0,

        // HTML5 methods
        play: function () {
            if (this.pluginApi != null) {
                if (this.pluginType == 'youtube') {
                    this.pluginApi.playVideo();
                } else {
                    this.pluginApi.playMedia();
                }
                this.paused = false;
            }
        },
        load: function () {
            if (this.pluginApi != null) {
                if (this.pluginType == 'youtube') {} else {
                    this.pluginApi.loadMedia();
                }

                this.paused = false;
            }
        },
        pause: function () {
            if (this.pluginApi != null) {
                if (this.pluginType == 'youtube') {
                    this.pluginApi.pauseVideo();
                } else {
                    this.pluginApi.pauseMedia();
                }


                this.paused = true;
            }
        },
        stop: function () {
            if (this.pluginApi != null) {
                if (this.pluginType == 'youtube') {
                    this.pluginApi.stopVideo();
                } else {
                    this.pluginApi.stopMedia();
                }
                this.paused = true;
            }
        },
        canPlayType: function (type) {
            var i,
                j,
                pluginInfo,
                pluginVersions = mejs.plugins[this.pluginType];

            for (i = 0; i < pluginVersions.length; i++) {
                pluginInfo = pluginVersions[i];

                // test if user has the correct plugin version
                if (mejs.PluginDetector.hasPluginVersion(this.pluginType, pluginInfo.version)) {

                    // test for plugin playback types
                    for (j = 0; j < pluginInfo.types.length; j++) {
                        // find plugin that can play the type
                        if (type == pluginInfo.types[j]) {
                            return 'probably';
                        }
                    }
                }
            }

            return '';
        },

        positionFullscreenButton: function (x, y, visibleAndAbove) {
            if (this.pluginApi != null && this.pluginApi.positionFullscreenButton) {
                this.pluginApi.positionFullscreenButton(Math.floor(x), Math.floor(y), visibleAndAbove);
            }
        },

        hideFullscreenButton: function () {
            if (this.pluginApi != null && this.pluginApi.hideFullscreenButton) {
                this.pluginApi.hideFullscreenButton();
            }
        },


        // custom methods since not all JavaScript implementations support get/set

        // This can be a url string
        // or an array [{src:'file.mp4',type:'video/mp4'},{src:'file.webm',type:'video/webm'}]
        setSrc: function (url) {
            if (typeof url == 'string') {
                this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(url));
                this.src = mejs.Utility.absolutizeUrl(url);
            } else {
                var i, media;

                for (i = 0; i < url.length; i++) {
                    media = url[i];
                    if (this.canPlayType(media.type)) {
                        this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(media.src));
                        this.src = mejs.Utility.absolutizeUrl(url);
                        break;
                    }
                }
            }

        },
        setCurrentTime: function (time) {
            if (this.pluginApi != null) {
                if (this.pluginType == 'youtube') {
                    this.pluginApi.seekTo(time);
                } else {
                    this.pluginApi.setCurrentTime(time);
                }



                this.currentTime = time;
            }
        },
        setVolume: function (volume) {
            if (this.pluginApi != null) {
                // same on YouTube and MEjs
                if (this.pluginType == 'youtube') {
                    this.pluginApi.setVolume(volume * 100);
                } else {
                    this.pluginApi.setVolume(volume);
                }
                this.volume = volume;
            }
        },
        setMuted: function (muted) {
            if (this.pluginApi != null) {
                if (this.pluginType == 'youtube') {
                    if (muted) {
                        this.pluginApi.mute();
                    } else {
                        this.pluginApi.unMute();
                    }
                    this.muted = muted;
                    this.dispatchEvent('volumechange');
                } else {
                    this.pluginApi.setMuted(muted);
                }
                this.muted = muted;
            }
        },

        // additional non-HTML5 methods
        setVideoSize: function (width, height) {

            //if (this.pluginType == 'flash' || this.pluginType == 'silverlight') {
            if (this.pluginElement.style) {
                this.pluginElement.style.width = width + 'px';
                this.pluginElement.style.height = height + 'px';
            }
            if (this.pluginApi != null && this.pluginApi.setVideoSize) {
                this.pluginApi.setVideoSize(width, height);
            }
            //}
        },

        setFullscreen: function (fullscreen) {
            if (this.pluginApi != null && this.pluginApi.setFullscreen) {
                this.pluginApi.setFullscreen(fullscreen);
            }
            this.container.trigger('bolttogglefullscreen');
        },

        enterFullScreen: function () {
            if (this.pluginApi != null && this.pluginApi.setFullscreen) {
                this.setFullscreen(true);
            }
        },

        exitFullScreen: function () {
            if (this.pluginApi != null && this.pluginApi.setFullscreen) {
                this.setFullscreen(false);
            }
        },

        // start: fake events
        addEventListener: function (eventName, callback, bubble) {
            this.events[eventName] = this.events[eventName] || [];
            this.events[eventName].push(callback);
        },
        removeEventListener: function (eventName, callback) {
            if (!eventName) {
                this.events = {};
                return true;
            }
            var callbacks = this.events[eventName];
            if (!callbacks) return true;
            if (!callback) {
                this.events[eventName] = [];
                return true;
            }
            for (i = 0; i < callbacks.length; i++) {
                if (callbacks[i] === callback) {
                    this.events[eventName].splice(i, 1);
                    return true;
                }
            }
            return false;
        },
        dispatchEvent: function (eventName) {
            var i,
                args,
                callbacks = this.events[eventName];

            if (callbacks) {
                args = Array.prototype.slice.call(arguments, 1);
                for (i = 0; i < callbacks.length; i++) {
                    callbacks[i].apply(null, args);
                }
            }
        },
        // end: fake events

        // fake DOM attribute methods
        hasAttribute: function (name) {
            return (name in this.attributes);
        },
        removeAttribute: function (name) {
            delete this.attributes[name];
        },
        getAttribute: function (name) {
            if (this.hasAttribute(name)) {
                return this.attributes[name];
            }
            return '';
        },
        setAttribute: function (name, value) {
            this.attributes[name] = value;
        },

        remove: function () {
            mejs.Utility.removeSwf(this.pluginElement.id);
            mejs.MediaPluginBridge.unregisterPluginElement(this.pluginElement.id);
        }
    };

    define("me/me-mediaelements", function () {});

    // Handles calls from Flash/Silverlight and reports them as native <video/audio> events and properties
    mejs.MediaPluginBridge = {

        pluginMediaElements: {},
        htmlMediaElements: {},

        registerPluginElement: function (id, pluginMediaElement, htmlMediaElement) {
            this.pluginMediaElements[id] = pluginMediaElement;
            this.htmlMediaElements[id] = htmlMediaElement;
        },

        unregisterPluginElement: function (id) {
            delete this.pluginMediaElements[id];
            delete this.htmlMediaElements[id];
        },

        // when Flash/Silverlight is ready, it calls out to this method
        initPlugin: function (id) {

            var pluginMediaElement = this.pluginMediaElements[id],
                htmlMediaElement = this.htmlMediaElements[id];

            if (pluginMediaElement) {
                // find the javascript bridge
                switch (pluginMediaElement.pluginType) {
                case "flash":
                    pluginMediaElement.pluginElement = pluginMediaElement.pluginApi = document.getElementById(id);
                    break;
                case "silverlight":
                    pluginMediaElement.pluginElement = document.getElementById(pluginMediaElement.id);
                    pluginMediaElement.pluginApi = pluginMediaElement.pluginElement.Content.MediaElementJS;
                    break;
                }

                if (pluginMediaElement.pluginApi != null && pluginMediaElement.success) {
                    pluginMediaElement.success(pluginMediaElement, htmlMediaElement);
                }
            }
        },

        // receives events from Flash/Silverlight and sends them out as HTML5 media events
        // http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html
        fireEvent: function (id, eventName, values) {

            var
                e,
                i,
                bufferedTime,
                pluginMediaElement = this.pluginMediaElements[id];

            // fake event object to mimic real HTML media event.
            e = {
                type: eventName,
                target: pluginMediaElement
            };

            // attach all values to element and event object
            for (i in values) {
                pluginMediaElement[i] = values[i];
                e[i] = values[i];
            }

            // fake the newer W3C buffered TimeRange (loaded and total have been removed)
            bufferedTime = values.bufferedTime || 0;

            e.target.buffered = e.buffered = {
                start: function (index) {
                    return 0;
                },
                end: function (index) {
                    return bufferedTime;
                },
                length: 1
            };

            pluginMediaElement.dispatchEvent(e.type, e);
        }
    };

    /*
Default options
*/
    mejs.MediaElementDefaults = {
        // allows testing on HTML5, flash, silverlight
        // auto: attempts to detect what the browser can do
        // auto_plugin: prefer plugins and then attempt native HTML5
        // native: forces HTML5 playback
        // shim: disallows HTML5, will attempt either Flash or Silverlight
        // none: forces fallback view
        mode: 'auto',
        // remove or reorder to change plugin priority and availability
        plugins: ['flash', 'silverlight', 'youtube', 'vimeo'],
        // shows debug errors on screen
        enablePluginDebug: false,
        // overrides the type specified, useful for dynamic instantiation
        type: '',
        // path to Flash and Silverlight plugins
        pluginPath: mejs.Utility.getScriptPath(['mediaelement.js', 'mediaelement.min.js', 'mediaelement-and-player.js', 'mediaelement-and-player.min.js']),
        // name of flash file
        flashName: 'flashmediaelement.swf',
        // streamer for RTMP streaming
        flashStreamer: '',
        // turns on the smoothing filter in Flash
        enablePluginSmoothing: false,
        // enabled pseudo-streaming (seek) on .mp4 files
        enablePseudoStreaming: false,
        // start query parameter sent to server for pseudo-streaming
        pseudoStreamingStartQueryParam: 'start',
        // name of silverlight file
        silverlightName: 'silverlightmediaelement.xap',
        // default if the <video width> is not specified
        defaultVideoWidth: 480,
        // default if the <video height> is not specified
        defaultVideoHeight: 270,
        // overrides <video width>
        pluginWidth: -1,
        // overrides <video height>
        pluginHeight: -1,
        // additional plugin variables in 'key=value' form
        pluginVars: [],
        // rate in milliseconds for Flash and Silverlight to fire the timeupdate event
        // larger number is less accurate, but less strain on plugin->JavaScript bridge
        timerRate: 250,
        // initial volume for player
        startVolume: 0.8,
        success: function () {},
        error: function () {}
    };

    /*
Determines if a browser supports the <video> or <audio> element
and returns either the native element or a Flash/Silverlight version that
mimics HTML5 MediaElement
*/
    mejs.MediaElement = function (el, o) {
        return mejs.HtmlMediaElementShim.create(el, o);
    };

    mejs.HtmlMediaElementShim = {

        create: function (el, o) {
            var
                options = mejs.MediaElementDefaults,
                htmlMediaElement = (typeof (el) == 'string') ? document.getElementById(el) : el,
                tagName = htmlMediaElement.tagName.toLowerCase(),
                isMediaTag = (tagName === 'audio' || tagName === 'video'),
                src = (isMediaTag) ? htmlMediaElement.getAttribute('src') : htmlMediaElement.getAttribute('href'),
                poster = htmlMediaElement.getAttribute('poster'),
                autoplay = htmlMediaElement.getAttribute('autoplay'),
                preload = htmlMediaElement.getAttribute('preload'),
                controls = htmlMediaElement.getAttribute('controls'),
                playback,
                prop;

            // extend options
            for (prop in o) {
                options[prop] = o[prop];
            }

            // clean up attributes
            src = (typeof src == 'undefined' || src === null || src == '') ? null : src;
            poster = (typeof poster == 'undefined' || poster === null) ? '' : poster;
            preload = (typeof preload == 'undefined' || preload === null || preload === 'false') ? 'none' : preload;
            autoplay = !(typeof autoplay == 'undefined' || autoplay === null || autoplay === 'false');
            controls = !(typeof controls == 'undefined' || controls === null || controls === 'false');

            // test for HTML5 and plugin capabilities
            playback = this.determinePlayback(htmlMediaElement, options, mejs.MediaFeatures.supportsMediaTag, isMediaTag, src);
            playback.url = (playback.url !== null) ? mejs.Utility.absolutizeUrl(playback.url) : '';

            if (playback.method == 'native') {
                // second fix for android
                if (mejs.MediaFeatures.isBustedAndroid) {
                    htmlMediaElement.src = playback.url;
                    htmlMediaElement.addEventListener('click', function () {
                        htmlMediaElement.play();
                    }, false);
                }

                // add methods to native HTMLMediaElement
                return this.updateNative(playback, options, autoplay, preload);
            } else if (playback.method !== '') {
                // create plugin to mimic HTMLMediaElement

                return this.createPlugin(playback, options, poster, autoplay, preload, controls);
            } else {
                // boo, no HTML5, no Flash, no Silverlight.
                this.createErrorMessage(playback, options, poster);

                return this;
            }
        },

        determinePlayback: function (htmlMediaElement, options, supportsMediaTag, isMediaTag, src) {
            var
                mediaFiles = [],
                i,
                j,
                k,
                l,
                n,
                type,
                result = {
                    method: '',
                    url: '',
                    htmlMediaElement: htmlMediaElement,
                    isVideo: (htmlMediaElement.tagName.toLowerCase() != 'audio')
                },
                pluginName,
                pluginVersions,
                pluginInfo,
                dummy,
                media;

            // STEP 1: Get URL and type from <video src> or <source src>

            // supplied type overrides <video type> and <source type>
            if (typeof options.type != 'undefined' && options.type !== '') {

                // accept either string or array of types
                if (typeof options.type == 'string') {
                    mediaFiles.push({
                        type: options.type,
                        url: src
                    });
                } else {

                    for (i = 0; i < options.type.length; i++) {
                        mediaFiles.push({
                            type: options.type[i],
                            url: src
                        });
                    }
                }

                // test for src attribute first
            } else if (src !== null) {
                type = this.formatType(src, htmlMediaElement.getAttribute('type'));
                mediaFiles.push({
                    type: type,
                    url: src
                });

                // then test for <source> elements
            } else {
                // test <source> types to see if they are usable
                for (i = 0; i < htmlMediaElement.childNodes.length; i++) {
                    n = htmlMediaElement.childNodes[i];
                    if (n.nodeType == 1 && n.tagName.toLowerCase() == 'source') {
                        src = n.getAttribute('src');
                        type = this.formatType(src, n.getAttribute('type'));
                        media = n.getAttribute('media');

                        if (!media || !window.matchMedia || (window.matchMedia && window.matchMedia(media).matches)) {
                            mediaFiles.push({
                                type: type,
                                url: src
                            });
                        }
                    }
                }
            }

            // in the case of dynamicly created players
            // check for audio types
            if (!isMediaTag && mediaFiles.length > 0 && mediaFiles[0].url !== null && this.getTypeFromFile(mediaFiles[0].url).indexOf('audio') > -1) {
                result.isVideo = false;
            }


            // STEP 2: Test for playback method

            // special case for Android which sadly doesn't implement the canPlayType function (always returns '')
            if (mejs.MediaFeatures.isBustedAndroid) {
                htmlMediaElement.canPlayType = function (type) {
                    return (type.match(/video\/(mp4|m4v)/gi) !== null) ? 'maybe' : '';
                };
            }


            // test for native playback first
            if (supportsMediaTag && (options.mode === 'auto' || options.mode === 'auto_plugin' || options.mode === 'native') && !(mejs.MediaFeatures.isBustedNativeHTTPS)) {

                if (!isMediaTag) {

                    // create a real HTML5 Media Element
                    dummy = document.createElement(result.isVideo ? 'video' : 'audio');
                    htmlMediaElement.parentNode.insertBefore(dummy, htmlMediaElement);
                    htmlMediaElement.style.display = 'none';

                    // use this one from now on
                    result.htmlMediaElement = htmlMediaElement = dummy;
                }

                for (i = 0; i < mediaFiles.length; i++) {
                    // normal check
                    if (htmlMediaElement.canPlayType(mediaFiles[i].type).replace(/no/, '') !== ''
                        // special case for Mac/Safari 5.0.3 which answers '' to canPlayType('audio/mp3') but 'maybe' to canPlayType('audio/mpeg')
                        || htmlMediaElement.canPlayType(mediaFiles[i].type.replace(/mp3/, 'mpeg')).replace(/no/, '') !== '') {
                        result.method = 'native';
                        result.url = mediaFiles[i].url;
                        break;
                    }
                }

                if (result.method === 'native') {
                    if (result.url !== null) {
                        htmlMediaElement.src = result.url;
                    }

                    // if `auto_plugin` mode, then cache the native result but try plugins.
                    if (options.mode !== 'auto_plugin') {
                        return result;
                    }
                }
            }

            // if native playback didn't work, then test plugins
            if (options.mode === 'auto' || options.mode === 'auto_plugin' || options.mode === 'shim') {
                for (i = 0; i < mediaFiles.length; i++) {
                    type = mediaFiles[i].type;

                    // test all plugins in order of preference [silverlight, flash]
                    for (j = 0; j < options.plugins.length; j++) {

                        pluginName = options.plugins[j];

                        // test version of plugin (for future features)
                        pluginVersions = mejs.plugins[pluginName];

                        for (k = 0; k < pluginVersions.length; k++) {
                            pluginInfo = pluginVersions[k];

                            // test if user has the correct plugin version

                            // for youtube/vimeo
                            if (pluginInfo.version == null ||

                                mejs.PluginDetector.hasPluginVersion(pluginName, pluginInfo.version)) {

                                // test for plugin playback types
                                for (l = 0; l < pluginInfo.types.length; l++) {
                                    // find plugin that can play the type
                                    if (type == pluginInfo.types[l]) {
                                        result.method = pluginName;
                                        result.url = mediaFiles[i].url;
                                        return result;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // at this point, being in 'auto_plugin' mode implies that we tried plugins but failed.
            // if we have native support then return that.
            if (options.mode === 'auto_plugin' && result.method === 'native') {
                return result;
            }

            // what if there's nothing to play? just grab the first available
            if (result.method === '' && mediaFiles.length > 0) {
                result.url = mediaFiles[0].url;
            }

            return result;
        },

        formatType: function (url, type) {
            var ext;

            // if no type is supplied, fake it with the extension
            if (url && !type) {
                return this.getTypeFromFile(url);
            } else {
                // only return the mime part of the type in case the attribute contains the codec
                // see http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#the-source-element
                // `video/mp4; codecs="avc1.42E01E, mp4a.40.2"` becomes `video/mp4`

                if (type && ~type.indexOf(';')) {
                    return type.substr(0, type.indexOf(';'));
                } else {
                    return type;
                }
            }
        },

        getTypeFromFile: function (url) {
            url = url.split('?')[0];
            var ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
            return (/(mp4|m4v|ogg|ogv|webm|webmv|flv|wmv|mpeg|mov)/gi.test(ext) ? 'video' : 'audio') + '/' + this.getTypeFromExtension(ext);
        },

        getTypeFromExtension: function (ext) {

            switch (ext) {
            case 'mp4':
            case 'm4v':
                return 'mp4';
            case 'webm':
            case 'webma':
            case 'webmv':
                return 'webm';
            case 'ogg':
            case 'oga':
            case 'ogv':
                return 'ogg';
            default:
                return ext;
            }
        },

        createErrorMessage: function (playback, options, poster) {
            var
                htmlMediaElement = playback.htmlMediaElement,
                errorContainer = document.createElement('div');

            errorContainer.className = 'me-cannotplay';

            try {
                errorContainer.style.width = htmlMediaElement.width + 'px';
                errorContainer.style.height = htmlMediaElement.height + 'px';
            } catch (e) {}

            if (options.customError) {
                errorContainer.innerHTML = options.customError;
            } else {
                errorContainer.innerHTML = (poster !== '') ?
                    '<a href="' + playback.url + '"><img src="' + poster + '" width="100%" height="100%" /></a>' :
                    '<a href="' + playback.url + '"><span>' + mejs.i18n.t('Download File') + '</span></a>';
            }

            htmlMediaElement.parentNode.insertBefore(errorContainer, htmlMediaElement);
            htmlMediaElement.style.display = 'none';

            options.error(htmlMediaElement);
        },

        createPlugin: function (playback, options, poster, autoplay, preload, controls) {
            var
                htmlMediaElement = playback.htmlMediaElement,
                width = 1,
                height = 1,
                pluginid = 'me_' + playback.method + '_' + (mejs.meIndex++),
                pluginMediaElement = new mejs.PluginMediaElement(pluginid, playback.method, playback.url),
                container = document.createElement('div'),
                specialIEContainer,
                node,
                initVars;

            // copy tagName from html media element
            pluginMediaElement.tagName = htmlMediaElement.tagName

            // copy attributes from html media element to plugin media element
            for (var i = 0; i < htmlMediaElement.attributes.length; i++) {
                var attribute = htmlMediaElement.attributes[i];
                if (attribute.specified == true) {
                    pluginMediaElement.setAttribute(attribute.name, attribute.value);
                }
            }

            // check for placement inside a <p> tag (sometimes WYSIWYG editors do this)
            node = htmlMediaElement.parentNode;
            while (node !== null && node.tagName.toLowerCase() != 'body') {
                if (node.parentNode.tagName.toLowerCase() == 'p') {
                    node.parentNode.parentNode.insertBefore(node, node.parentNode);
                    break;
                }
                node = node.parentNode;
            }

            if (playback.isVideo) {
                width = (options.pluginWidth > 0) ? options.pluginWidth : (options.videoWidth > 0) ? options.videoWidth : (htmlMediaElement.getAttribute('width') !== null) ? htmlMediaElement.getAttribute('width') : options.defaultVideoWidth;
                height = (options.pluginHeight > 0) ? options.pluginHeight : (options.videoHeight > 0) ? options.videoHeight : (htmlMediaElement.getAttribute('height') !== null) ? htmlMediaElement.getAttribute('height') : options.defaultVideoHeight;

                // in case of '%' make sure it's encoded
                width = mejs.Utility.encodeUrl(width);
                height = mejs.Utility.encodeUrl(height);

            } else {
                if (options.enablePluginDebug) {
                    width = 320;
                    height = 240;
                }
            }

            // register plugin
            pluginMediaElement.success = options.success;
            mejs.MediaPluginBridge.registerPluginElement(pluginid, pluginMediaElement, htmlMediaElement);

            // add container (must be added to DOM before inserting HTML for IE)
            container.className = 'me-plugin';
            container.id = pluginid + '_container';

            if (playback.isVideo) {
                htmlMediaElement.parentNode.insertBefore(container, htmlMediaElement);
            } else {
                document.body.insertBefore(container, document.body.childNodes[0]);
            }

            // flash/silverlight vars
            initVars = [
                'id=' + pluginid,
                'isvideo=' + ((playback.isVideo) ? "true" : "false"),
                'autoplay=' + ((autoplay) ? "true" : "false"),
                'preload=' + preload,
                'width=' + width,
                'startvolume=' + options.startVolume,
                'timerrate=' + options.timerRate,
                'flashstreamer=' + options.flashStreamer,
                'height=' + height,
                'pseudostreamstart=' + options.pseudoStreamingStartQueryParam
            ];

            if (playback.url !== null) {
                if (playback.method == 'flash') {
                    initVars.push('file=' + mejs.Utility.encodeUrl(playback.url));
                } else {
                    initVars.push('file=' + playback.url);
                }
            }
            if (options.enablePluginDebug) {
                initVars.push('debug=true');
            }
            if (options.enablePluginSmoothing) {
                initVars.push('smoothing=true');
            }
            if (options.enablePseudoStreaming) {
                initVars.push('pseudostreaming=true');
            }
            if (controls) {
                initVars.push('controls=true'); // shows controls in the plugin if desired
            }
            if (options.pluginVars) {
                initVars = initVars.concat(options.pluginVars);
            }

            switch (playback.method) {
            case 'silverlight':
                container.innerHTML =
                    //'<object data="data:application/x-silverlight-2," type="application/x-silverlight-2" id="' + pluginid + '" name="' + pluginid + '" width="' + width + '" height="' + height + '" class="mejs-shim">' +
                    '<object data="data:application/x-silverlight-2," type="application/x-silverlight-2" id="' + pluginid + '" name="' + pluginid + '" width="100" height="100px" class="mejs-shim">' +
                    '<param name="initParams" value="' + initVars.join(',') + '" />' +
                    '<param name="windowless" value="true" />' +
                    '<param name="background" value="black" />' +
                    '<param name="minRuntimeVersion" value="3.0.0.0" />' +
                    '<param name="autoUpgrade" value="true" />' +
                    '<param name="source" value="' + options.pluginPath + options.silverlightName + '" />' +
                    '</object>';
                break;

            case 'flash':

                if (mejs.MediaFeatures.isIE) {
                    specialIEContainer = document.createElement('div');
                    container.appendChild(specialIEContainer);
                    specialIEContainer.outerHTML =
                        '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
                        'id="' + pluginid + '" width="200px" height="200px" class="mejs-shim">' +
                        '<param name="movie" value="' + options.pluginPath + options.flashName + '?x=' + (new Date()) + '" />' +
                        '<param name="flashvars" value="' + initVars.join('&amp;') + '" />' +
                        '<param name="quality" value="high" />' +
                        '<param name="bgcolor" value="#000000" />' +
                        '<param name="wmode" value="transparent" />' +
                        '<param name="allowScriptAccess" value="always" />' +
                        '<param name="allowFullScreen" value="true" />' +
                        '</object>';

                } else {

                    container.innerHTML =
                        '<embed id="' + pluginid + '" name="' + pluginid + '" ' +
                        'play="true" ' +
                        'loop="false" ' +
                        'quality="high" ' +
                        'bgcolor="#000000" ' +
                        'wmode="transparent" ' +
                        'allowScriptAccess="always" ' +
                        'allowFullScreen="true" ' +
                        'type="application/x-shockwave-flash" pluginspage="//www.macromedia.com/go/getflashplayer" ' +
                        'src="' + options.pluginPath + options.flashName + '" ' +
                        'flashvars="' + initVars.join('&') + '" ' +
                        'width="' + width + '" ' +
                        'height="' + height + '" ' +
                        'class="mejs-shim"></embed>';
                }
                break;

            case 'youtube':


                var
                    videoId = playback.url.substr(playback.url.lastIndexOf('=') + 1);
                youtubeSettings = {
                    container: container,
                    containerId: container.id,
                    pluginMediaElement: pluginMediaElement,
                    pluginId: pluginid,
                    videoId: videoId,
                    height: height,
                    width: width
                };

                if (mejs.PluginDetector.hasPluginVersion('flash', [10, 0, 0])) {
                    mejs.YouTubeApi.createFlash(youtubeSettings);
                } else {
                    mejs.YouTubeApi.enqueueIframe(youtubeSettings);
                }

                break;

                // DEMO Code. Does NOT work.
            case 'vimeo':
                //console.log('vimeoid');

                pluginMediaElement.vimeoid = playback.url.substr(playback.url.lastIndexOf('/') + 1);

                container.innerHTML = '<iframe src="http://player.vimeo.com/video/' + pluginMediaElement.vimeoid + '?portrait=0&byline=0&title=0" width="' + width + '" height="' + height + '" frameborder="0" class="mejs-shim"></iframe>';

                /*
                             container.innerHTML =
                                  '<object width="' + width + '" height="' + height + '" class="mejs-shim">' +
                                           '<param name="allowfullscreen" value="true" />' +
                                              '<param name="allowscriptaccess" value="always" />' +
                                          '<param name="flashvars" value="api=1" />' +
                                           '<param name="movie" value="http://vimeo.com/moogaloop.swf?clip_id=' + pluginMediaElement.vimeoid  + '&amp;server=vimeo.com&amp;show_title=0&amp;show_byline=0&amp;show_portrait=0&amp;color=00adef&amp;fullscreen=1&amp;autoplay=0&amp;loop=0" />' +
                                          '<embed src="//vimeo.com/moogaloop.swf?api=1&amp;clip_id=' + pluginMediaElement.vimeoid + '&amp;server=vimeo.com&amp;show_title=0&amp;show_byline=0&amp;show_portrait=0&amp;color=00adef&amp;fullscreen=1&amp;autoplay=0&amp;loop=0" type="application/x-shockwave-flash" allowfullscreen="true" allowscriptaccess="always" width="' + width + '" height="' + height + '" class="mejs-shim"></embed>' +
                                        '</object>';
                                   */

                break;
            }
            // hide original element
            htmlMediaElement.style.display = 'none';

            // FYI: options.success will be fired by the MediaPluginBridge

            return pluginMediaElement;
        },

        updateNative: function (playback, options, autoplay, preload) {

            var htmlMediaElement = playback.htmlMediaElement,
                m;


            // add methods to video object to bring it into parity with Flash Object
            for (m in mejs.HtmlMediaElement) {
                htmlMediaElement[m] = mejs.HtmlMediaElement[m];
            }

            /*
             Chrome now supports preload="none"
             if (mejs.MediaFeatures.isChrome) {

                    // special case to enforce preload attribute (Chrome doesn't respect this)
                     if (preload === 'none' && !autoplay) {

                                // forces the browser to stop loading (note: fails in IE9)
                             htmlMediaElement.src = '';
                             htmlMediaElement.load();
                               htmlMediaElement.canceledPreload = true;

                              htmlMediaElement.addEventListener('play',function() {
                                  if (htmlMediaElement.canceledPreload) {
                                                htmlMediaElement.src = playback.url;
                                           htmlMediaElement.load();
                                               htmlMediaElement.play();
                                               htmlMediaElement.canceledPreload = false;
                                      }
                              }, false);
                     // for some reason Chrome forgets how to autoplay sometimes.
                   } else if (autoplay) {
                         htmlMediaElement.load();
                               htmlMediaElement.play();
                       }
              }
              */

            // fire success code
            options.success(htmlMediaElement, htmlMediaElement);

            return htmlMediaElement;
        }
    };

    /*
 - test on IE (object vs. embed)
 - determine when to use iframe (Firefox, Safari, Mobile) vs. Flash (Chrome, IE)
 - fullscreen?
*/

    // YouTube Flash and Iframe API
    mejs.YouTubeApi = {
            isIframeStarted: false,
            isIframeLoaded: false,
            loadIframeApi: function () {
                if (!this.isIframeStarted) {
                    var tag = document.createElement('script');
                    tag.src = "//www.youtube.com/player_api";
                    var firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                    this.isIframeStarted = true;
                }
            },
            iframeQueue: [],
            enqueueIframe: function (yt) {

                if (this.isLoaded) {
                    this.createIframe(yt);
                } else {
                    this.loadIframeApi();
                    this.iframeQueue.push(yt);
                }
            },
            createIframe: function (settings) {

                var
                    pluginMediaElement = settings.pluginMediaElement,
                    player = new YT.Player(settings.containerId, {
                        height: settings.height,
                        width: settings.width,
                        videoId: settings.videoId,
                        playerVars: {
                            controls: 0
                        },
                        events: {
                            'onReady': function () {

                                // hook up iframe object to MEjs
                                settings.pluginMediaElement.pluginApi = player;

                                // init mejs
                                mejs.MediaPluginBridge.initPlugin(settings.pluginId);

                                // create timer
                                setInterval(function () {
                                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'timeupdate');
                                }, 250);
                            },
                            'onStateChange': function (e) {

                                mejs.YouTubeApi.handleStateChange(e.data, player, pluginMediaElement);

                            }
                        }
                    });
            },

            createEvent: function (player, pluginMediaElement, eventName) {
                var obj = {
                    type: eventName,
                    target: pluginMediaElement
                };

                if (player && player.getDuration) {

                    // time
                    pluginMediaElement.currentTime = obj.currentTime = player.getCurrentTime();
                    pluginMediaElement.duration = obj.duration = player.getDuration();

                    // state
                    obj.paused = pluginMediaElement.paused;
                    obj.ended = pluginMediaElement.ended;

                    // sound
                    obj.muted = player.isMuted();
                    obj.volume = player.getVolume() / 100;

                    // progress
                    obj.bytesTotal = player.getVideoBytesTotal();
                    obj.bufferedBytes = player.getVideoBytesLoaded();

                    // fake the W3C buffered TimeRange
                    var bufferedTime = obj.bufferedBytes / obj.bytesTotal * obj.duration;

                    obj.target.buffered = obj.buffered = {
                        start: function (index) {
                            return 0;
                        },
                        end: function (index) {
                            return bufferedTime;
                        },
                        length: 1
                    };

                }

                // send event up the chain
                pluginMediaElement.dispatchEvent(obj.type, obj);
            },

            iFrameReady: function () {

                this.isLoaded = true;
                this.isIframeLoaded = true;

                while (this.iframeQueue.length > 0) {
                    var settings = this.iframeQueue.pop();
                    this.createIframe(settings);
                }
            },

            // FLASH!
            flashPlayers: {},
            createFlash: function (settings) {

                this.flashPlayers[settings.pluginId] = settings;

                /*
             settings.container.innerHTML =
                 '<object type="application/x-shockwave-flash" id="' + settings.pluginId + '" data="//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=' + settings.pluginId  + '&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0" ' +
                           'width="' + settings.width + '" height="' + settings.height + '" style="visibility: visible; " class="mejs-shim">' +
                           '<param name="allowScriptAccess" value="always">' +
                            '<param name="wmode" value="transparent">' +
                   '</object>';
           */

                var specialIEContainer,
                    youtubeUrl = '//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=' + settings.pluginId + '&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0';

                if (mejs.MediaFeatures.isIE) {

                    specialIEContainer = document.createElement('div');
                    settings.container.appendChild(specialIEContainer);
                    specialIEContainer.outerHTML = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
                        'id="' + settings.pluginId + '" width="' + settings.width + '" height="' + settings.height + '" class="mejs-shim">' +
                        '<param name="movie" value="' + youtubeUrl + '" />' +
                        '<param name="wmode" value="transparent" />' +
                        '<param name="allowScriptAccess" value="always" />' +
                        '<param name="allowFullScreen" value="true" />' +
                        '</object>';
                } else {
                    settings.container.innerHTML =
                        '<object type="application/x-shockwave-flash" id="' + settings.pluginId + '" data="' + youtubeUrl + '" ' +
                        'width="' + settings.width + '" height="' + settings.height + '" style="visibility: visible; " class="mejs-shim">' +
                        '<param name="allowScriptAccess" value="always">' +
                        '<param name="wmode" value="transparent">' +
                        '</object>';
                }

            },

            flashReady: function (id) {
                var
                    settings = this.flashPlayers[id],
                    player = document.getElementById(id),
                    pluginMediaElement = settings.pluginMediaElement;

                // hook up and return to MediaELementPlayer.success
                pluginMediaElement.pluginApi =
                    pluginMediaElement.pluginElement = player;
                mejs.MediaPluginBridge.initPlugin(id);

                // load the youtube video
                player.cueVideoById(settings.videoId);

                var callbackName = settings.containerId + '_callback';

                window[callbackName] = function (e) {
                    mejs.YouTubeApi.handleStateChange(e, player, pluginMediaElement);
                }

                player.addEventListener('onStateChange', callbackName);

                setInterval(function () {
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'timeupdate');
                }, 250);
            },

            handleStateChange: function (youTubeState, player, pluginMediaElement) {
                switch (youTubeState) {
                case -1: // not started
                    pluginMediaElement.paused = true;
                    pluginMediaElement.ended = true;
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'loadedmetadata');
                    //createYouTubeEvent(player, pluginMediaElement, 'loadeddata');
                    break;
                case 0:
                    pluginMediaElement.paused = false;
                    pluginMediaElement.ended = true;
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'ended');
                    break;
                case 1:
                    pluginMediaElement.paused = false;
                    pluginMediaElement.ended = false;
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'play');
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'playing');
                    break;
                case 2:
                    pluginMediaElement.paused = true;
                    pluginMediaElement.ended = false;
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'pause');
                    break;
                case 3: // buffering
                    mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'progress');
                    break;
                case 5:
                    // cued?
                    break;

                }

            }
        }
        // IFRAME

    function onYouTubePlayerAPIReady() {
            mejs.YouTubeApi.iFrameReady();
        }
        // FLASH

    function onYouTubePlayerReady(id) {
        mejs.YouTubeApi.flashReady(id);
    }

    window.mejs = mejs;
    window.MediaElement = mejs.MediaElement;

    define("me/me-shim", function () {});

    /*!
     * Adds Internationalization and localization to objects.
     *
     * What is the concept beyond i18n?
     *   http://en.wikipedia.org/wiki/Internationalization_and_localization
     *
     *
     * This file both i18n methods and locale which is used to translate
     * strings into other languages.
     *
     * Default translations are not available, you have to add them
     * through locale objects which are named exactly as the langcode
     * they stand for. The default language is always english (en).
     *
     *
     * Wrapper built to be able to attach the i18n object to
     * other objects without changing more than one line.
     *
     *
     * LICENSE:
     *
     *   The i18n file uses methods from the Drupal project (drupal.js):
     *     - i18n.methods.t() (modified)
     *     - i18n.methods.checkPlain() (full copy)
     *     - i18n.methods.formatString() (full copy)
     *
     *   The Drupal project is (like mediaelementjs) licensed under GPLv2.
     *    - http://drupal.org/licensing/faq/#q1
     *    - https://github.com/johndyer/mediaelement
     *    - http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
     *
     *
     * @author
     *   Tim Latz (latz.tim@gmail.com)
     *
     * @see
     *   me-i18n-locale.js
     *
     * @params
     *  - context - document, iframe ..
     *  - exports - CommonJS, window ..
     *
     */
    ;
    (function (context, exports, undefined) {

        var i18n = {
            "locale": {
                "strings": {}
            },
            "methods": {}
        };
        // start i18n


        /**
         * Get the current browser's language
         *
         * @see: i18n.methods.t()
         */
        i18n.locale.getLanguage = function () {
            return i18n.locale || {
                "language": navigator.language
            };
        };

        /**
         * Store the language the locale object was initialized with
         */
        i18n.locale.INIT_LANGUAGE = i18n.locale.getLanguage();


        /**
         * Encode special characters in a plain-text string for display as HTML.
         */
        i18n.methods.checkPlain = function (str) {
            var character, regex,
                replace = {
                    '&': '&amp;',
                    '"': '&quot;',
                    '<': '&lt;',
                    '>': '&gt;'
                };
            str = String(str);
            for (character in replace) {
                if (replace.hasOwnProperty(character)) {
                    regex = new RegExp(character, 'g');
                    str = str.replace(regex, replace[character]);
                }
            }
            return str;
        };

        /**
         * Replace placeholders with sanitized values in a string.
         *
         * @param str
         *   A string with placeholders.
         * @param args
         *   An object of replacements pairs to make. Incidences of any key in this
         *   array are replaced with the corresponding value. Based on the first
         *   character of the key, the value is escaped and/or themed:
         *    - !variable: inserted as is
         *    - @variable: escape plain text to HTML (i18n.methods.checkPlain)
         *    - %variable: escape text and theme as a placeholder for user-submitted
         *      content (checkPlain + <em class="placeholder" > )
         *
         * @see i18n.methods.t()
         */
        i18n.methods.formatString = function (str, args) {
            // Transform arguments before inserting them.
            for (var key in args) {
                switch (key.charAt(0)) {
                    // Escaped only.
                case '@':
                    args[key] = i18n.methods.checkPlain(args[key]);
                    break;
                    // Pass-through.
                case '!':
                    break;
                    // Escaped and placeholder.
                case '%':
                default:
                    args[key] = '<em class="placeholder">' + i18n.methods.checkPlain(args[key]) + '</em>';
                    break;
                }
                str = str.replace(key, args[key]);
            }
            return str;
        };

        /**
         * Translate strings to the page language or a given language.
         *
         * See the documentation of the server-side t() function for further details.
         *
         * @param str
         *   A string containing the English string to translate.
         * @param args
         *   An object of replacements pairs to make after translation. Incidences
         *   of any key in this array are replaced with the corresponding value.
         *   See i18n.methods.formatString().
         *
         * @param options
         *   - 'context' (defaults to the default context): The context the source string
         *     belongs to.
         *
         * @return
         *   The translated string.
         */
        i18n.methods.t = function (str, args, options) {

            // Fetch the localized version of the string.
            if (i18n.locale.strings && i18n.locale.strings[options.context] && i18n.locale.strings[options.context][str]) {
                str = i18n.locale.strings[options.context][str];
            }

            if (args) {
                str = i18n.methods.formatString(str, args);
            }
            return str;
        };


        /**
         * Wrapper for i18n.methods.t()
         *
         * @see i18n.methods.t()
         * @throws InvalidArgumentException
         */
        i18n.t = function (str, args, options) {

            if (typeof str === 'string' && str.length > 0) {

                // check every time due languge can change for
                // different reasons (translation, lang switcher ..)
                var lang = i18n.locale.getLanguage();

                options = options || {
                    "context": lang.language
                };

                return i18n.methods.t(str, args, options);
            } else {
                throw {
                    "name": 'InvalidArgumentException',
                    "message": 'First argument is either not a string or empty.'
                }
            }
        };

        // end i18n
        exports.i18n = i18n;
    }(document, mejs));

    ;
    (function (exports, undefined) {



        if (mejs.i18n.locale.language && mejs.i18n.locale.strings) {
            exports[mejs.i18n.locale.language] = mejs.i18n.locale.strings;
        }

    }(mejs.i18n.locale.strings));

    define("me/me-i18n", function () {});

    define('mediaelement', [
        //'me/mediaelement/me-header',
        'me/me-namespace',
        'me/me-utility',
        'me/me-plugindetector',
        'me/me-featuredetection',
        'me/me-mediaelements',
        'me/me-shim',
        'me/me-i18n',
    ], function () {
        return mejs;
    });

    if (typeof jQuery != 'undefined') {
        mejs.$ = jQuery;
    } else if (typeof ender != 'undefined') {
        mejs.$ = ender;
    };
    define("mep/mep-library", function () {});

    (function ($) {

        // default player values
        mejs.MepDefaults = {
            // url to poster (to fix iOS 3.x)
            poster: '',
            // default if the <video width> is not specified
            defaultVideoWidth: 480,
            // default if the <video height> is not specified
            defaultVideoHeight: 270,
            // if set, overrides <video width>
            videoWidth: -1,
            // if set, overrides <video height>
            videoHeight: -1,
            // default if the user doesn't specify
            defaultAudioWidth: 400,
            // default if the user doesn't specify
            defaultAudioHeight: 30,

            // default amount to move back when back key is pressed
            defaultSeekBackwardInterval: function (media) {
                return (media.duration * 0.05);
            },
            // default amount to move forward when forward key is pressed
            defaultSeekForwardInterval: function (media) {
                return (media.duration * 0.05);
            },

            // width of audio player
            audioWidth: -1,
            // height of audio player
            audioHeight: -1,
            // initial volume when the player starts (overrided by user cookie)
            startVolume: 0.8,
            // useful for <audio> player loops
            loop: false,
            // rewind to beginning when media ends
            autoRewind: true,
            // resize to media dimensions
            enableAutosize: true,
            // forces the hour marker (##:00:00)
            alwaysShowHours: false,

            // show framecount in timecode (##:00:00:00)
            showTimecodeFrameCount: false,
            // used when showTimecodeFrameCount is set to true
            framesPerSecond: 25,

            // automatically calculate the width of the progress bar based on the sizes of other elements
            autosizeProgress: true,
            // Hide controls when playing and mouse is not over the video
            alwaysShowControls: false,
            // Display the video control
            hideVideoControlsOnLoad: false,
            // Enable click video element to toggle play/pause
            clickToPlayPause: true,
            // force iPad's native controls
            iPadUseNativeControls: false,
            // force iPhone's native controls
            iPhoneUseNativeControls: false,
            // force Android's native controls
            AndroidUseNativeControls: false,
            // features to show
            features: ['playpause', 'current', 'progress', 'duration', 'tracks', 'volume', 'fullscreen'],
            // only for dynamic
            isVideo: true,

            // turns keyboard support on and off for this instance
            enableKeyboard: true,

            // whenthis player starts, it will pause other players
            pauseOtherPlayers: true,

            // array of keyboard actions such as play pause
            keyActions: [{
                keys: [
                    32, // SPACE
                    179 // GOOGLE play/pause button
                ],
                action: function (player, media) {
                    if (media.paused || media.ended) {
                        media.play();
                    } else {
                        media.pause();
                    }
                }
            }, {
                keys: [38], // UP
                action: function (player, media) {
                    var newVolume = Math.min(media.volume + 0.1, 1);
                    media.setVolume(newVolume);
                }
            }, {
                keys: [40], // DOWN
                action: function (player, media) {
                    var newVolume = Math.max(media.volume - 0.1, 0);
                    media.setVolume(newVolume);
                }
            }, {
                keys: [
                    37, // LEFT
                    227 // Google TV rewind
                ],
                action: function (player, media) {
                    if (!isNaN(media.duration) && media.duration > 0) {
                        if (player.isVideo) {
                            player.showControls();
                            player.startControlsTimer();
                        }

                        // 5%
                        var newTime = Math.max(media.currentTime - player.options.defaultSeekBackwardInterval(media), 0);
                        media.setCurrentTime(newTime);
                    }
                }
            }, {
                keys: [
                    39, // RIGHT
                    228 // Google TV forward
                ],
                action: function (player, media) {
                    if (!isNaN(media.duration) && media.duration > 0) {
                        if (player.isVideo) {
                            player.showControls();
                            player.startControlsTimer();
                        }

                        // 5%
                        var newTime = Math.min(media.currentTime + player.options.defaultSeekForwardInterval(media), media.duration);
                        media.setCurrentTime(newTime);
                    }
                }
            }, {
                keys: [70], // f
                action: function (player, media) {
                    if (typeof player.enterFullScreen != 'undefined') {
                        if (player.isFullScreen) {
                            player.exitFullScreen();
                        } else {
                            player.enterFullScreen();
                        }
                    }
                }
            }]
        };

        mejs.mepIndex = 0;

        mejs.players = {};

        // wraps a MediaElement object in player controls
        mejs.MediaElementPlayer = function (node, o) {
            // enforce object, even without "new" (via John Resig)
            if (!(this instanceof mejs.MediaElementPlayer)) {
                return new mejs.MediaElementPlayer(node, o);
            }

            var t = this;

            // these will be reset after the MediaElement.success fires
            t.$media = t.$node = $(node);
            t.node = t.media = t.$media[0];

            // check for existing player
            if (typeof t.node.player != 'undefined') {
                return t.node.player;
            } else {
                // attach player to DOM node for reference
                t.node.player = t;
            }


            // try to get options from data-mejsoptions
            if (typeof o == 'undefined') {
                o = t.$node.data('mejsoptions');
            }

            // extend default options
            t.options = $.extend({}, mejs.MepDefaults, o);

            // unique ID
            t.id = 'mep_' + mejs.mepIndex++;

            // add to player array (for focus events)
            mejs.players[t.id] = t;

            // start up
            t.init();

            return t;
        };

        // actual player
        mejs.MediaElementPlayer.prototype = {

            hasFocus: false,

            controlsAreVisible: true,

            init: function () {

                var
                    t = this,
                    mf = mejs.MediaFeatures,
                    // options for MediaElement (shim)
                    meOptions = $.extend(true, {}, t.options, {
                        success: function (media, domNode) {
                            t.meReady(media, domNode);
                        },
                        error: function (e) {
                            t.handleError(e);
                        }
                    }),
                    tagName = t.media.tagName.toLowerCase();

                t.isDynamic = (tagName !== 'audio' && tagName !== 'video');

                if (t.isDynamic) {
                    // get video from src or href?
                    t.isVideo = t.options.isVideo;
                } else {
                    t.isVideo = (tagName !== 'audio' && t.options.isVideo);
                }

                // use native controls in iPad, iPhone, and Android
                if ((mf.isiPad && t.options.iPadUseNativeControls) || (mf.isiPhone && t.options.iPhoneUseNativeControls)) {

                    // add controls and stop
                    t.$media.attr('controls', 'controls');

                    // attempt to fix iOS 3 bug
                    //t.$media.removeAttr('poster');
                    // no Issue found on iOS3 -ttroxell

                    // override Apple's autoplay override for iPads
                    if (mf.isiPad && t.media.getAttribute('autoplay') !== null) {
                        t.media.load();
                        t.media.play();
                    }

                } else if (mf.isAndroid && t.options.AndroidUseNativeControls) {

                    // leave default player

                } else {

                    // DESKTOP: use MediaElementPlayer controls

                    // remove native controls
                    t.$media.removeAttr('controls');

                    // build container
                    t.container =
                        $('<div id="' + t.id + '" class="mejs-container ' + (mejs.MediaFeatures.svg ? 'svg' : 'no-svg') + '">' +
                            '<div class="mejs-inner">' +
                            '<div class="mejs-mediaelement"></div>' +
                            '<div class="mejs-layers"></div>' +
                            '<div class="mejs-controls"></div>' +
                            '<div class="mejs-clear"></div>' +
                            '</div>' +
                            '</div>')
                        .addClass(t.$media[0].className)
                        .insertBefore(t.$media);

                    // add classes for user and content
                    t.container.addClass(
                        (mf.isAndroid ? 'mejs-android ' : '') +
                        (mf.isiOS ? 'mejs-ios ' : '') +
                        (mf.isiPad ? 'mejs-ipad ' : '') +
                        (mf.isiPhone ? 'mejs-iphone ' : '') +
                        (t.isVideo ? 'mejs-video ' : 'mejs-audio ')
                    );


                    // move the <video/video> tag into the right spot
                    if (mf.isiOS) {

                        // sadly, you can't move nodes in iOS, so we have to destroy and recreate it!
                        var $newMedia = t.$media.clone();

                        t.container.find('.mejs-mediaelement').append($newMedia);

                        t.$media.remove();
                        t.$node = t.$media = $newMedia;
                        t.node = t.media = $newMedia[0]

                    } else {

                        // normal way of moving it into place (doesn't work on iOS)
                        t.container.find('.mejs-mediaelement').append(t.$media);
                    }

                    // find parts
                    t.controls = t.container.find('.mejs-controls');
                    t.layers = t.container.find('.mejs-layers');

                    // determine the size

                    /* size priority:
                                      (1) videoWidth (forced),
                                       (2) style="width;height;"
                                      (3) width attribute,
                                   (4) defaultVideoWidth (for unspecified cases)
                          */

                    var tagType = (t.isVideo ? 'video' : 'audio'),
                        capsTagName = tagType.substring(0, 1).toUpperCase() + tagType.substring(1);


                    if (t.options[tagType + 'Width'] > 0 || t.options[tagType + 'Width'].toString().indexOf('%') > -1) {
                        t.width = t.options[tagType + 'Width'];
                    } else if (t.media.style.width !== '' && t.media.style.width !== null) {
                        t.width = t.media.style.width;
                    } else if (t.media.getAttribute('width') !== null) {
                        t.width = t.$media.attr('width');
                    } else {
                        t.width = t.options['default' + capsTagName + 'Width'];
                    }

                    if (t.options[tagType + 'Height'] > 0 || t.options[tagType + 'Height'].toString().indexOf('%') > -1) {
                        t.height = t.options[tagType + 'Height'];
                    } else if (t.media.style.height !== '' && t.media.style.height !== null) {
                        t.height = t.media.style.height;
                    } else if (t.$media[0].getAttribute('height') !== null) {
                        t.height = t.$media.attr('height');
                    } else {
                        t.height = t.options['default' + capsTagName + 'Height'];
                    }

                    // set the size, while we wait for the plugins to load below
                    t.setPlayerSize(t.width, t.height);

                    // create MediaElementShim
                    meOptions.pluginWidth = t.width;
                    meOptions.pluginHeight = t.height;
                }

                // create MediaElement shim
                mejs.MediaElement(t.$media[0], meOptions);

                if (typeof (t.container) != 'undefined') {
                    // controls are shown when loaded
                    t.container.trigger('controlsshown');
                }
            },

            showControls: function (doAnimation) {
                var t = this;

                doAnimation = typeof doAnimation == 'undefined' || doAnimation;

                if (t.controlsAreVisible)
                    return;

                if (doAnimation) {
                    t.controls
                        .css('visibility', 'visible')
                        .stop(true, true).fadeIn(200, function () {
                            t.controlsAreVisible = true;
                            t.container.trigger('controlsshown');
                        });

                    // any additional controls people might add and want to hide
                    t.container.find('.mejs-control')
                        .css('visibility', 'visible')
                        .stop(true, true).fadeIn(200, function () {
                            t.controlsAreVisible = true;
                        });

                } else {
                    t.controls
                        .css('visibility', 'visible')
                        .css('display', 'block');

                    // any additional controls people might add and want to hide
                    t.container.find('.mejs-control')
                        .css('visibility', 'visible')
                        .css('display', 'block');

                    t.controlsAreVisible = true;
                    t.container.trigger('controlsshown');
                }

                t.setControlsSize();

            },

            hideControls: function (doAnimation) {
                var t = this;

                doAnimation = typeof doAnimation == 'undefined' || doAnimation;

                if (!t.controlsAreVisible)
                    return;

                if (doAnimation) {
                    // fade out main controls
                    t.controls.stop(true, true).fadeOut(200, function () {
                        $(this)
                            .css('visibility', 'hidden')
                            .css('display', 'block');

                        t.controlsAreVisible = false;
                        t.container.trigger('controlshidden');
                    });

                    // any additional controls people might add and want to hide
                    t.container.find('.mejs-control').stop(true, true).fadeOut(200, function () {
                        $(this)
                            .css('visibility', 'hidden')
                            .css('display', 'block');
                    });
                } else {

                    // hide main controls
                    t.controls
                        .css('visibility', 'hidden')
                        .css('display', 'block');

                    // hide others
                    t.container.find('.mejs-control')
                        .css('visibility', 'hidden')
                        .css('display', 'block');

                    t.controlsAreVisible = false;
                    t.container.trigger('controlshidden');
                }
            },

            controlsTimer: null,

            startControlsTimer: function (timeout) {

                var t = this;

                timeout = typeof timeout != 'undefined' ? timeout : 1500;

                t.killControlsTimer('start');

                t.controlsTimer = setTimeout(function () {
                    //console.log('timer fired');
                    t.hideControls();
                    t.killControlsTimer('hide');
                }, timeout);
            },

            killControlsTimer: function (src) {

                var t = this;

                if (t.controlsTimer !== null) {
                    clearTimeout(t.controlsTimer);
                    delete t.controlsTimer;
                    t.controlsTimer = null;
                }
            },

            controlsEnabled: true,

            disableControls: function () {
                var t = this;

                t.killControlsTimer();
                t.hideControls(false);
                this.controlsEnabled = false;
            },

            enableControls: function () {
                var t = this;

                t.showControls(false);

                t.controlsEnabled = true;
            },


            // Sets up all controls and events
            meReady: function (media, domNode) {


                var t = this,
                    mf = mejs.MediaFeatures,
                    autoplayAttr = domNode.getAttribute('autoplay'),
                    autoplay = !(typeof autoplayAttr == 'undefined' || autoplayAttr === null || autoplayAttr === 'false'),
                    featureIndex,
                    feature;

                // make sure it can't create itself again if a plugin reloads
                if (t.created) {
                    return;
                } else {
                    t.created = true;
                }

                t.media = media;
                t.domNode = domNode;

                if (!(mf.isAndroid && t.options.AndroidUseNativeControls) && !(mf.isiPad && t.options.iPadUseNativeControls) && !(mf.isiPhone && t.options.iPhoneUseNativeControls)) {

                    // two built in features
                    t.buildposter(t, t.controls, t.layers, t.media);
                    t.buildkeyboard(t, t.controls, t.layers, t.media);
                    t.buildoverlays(t, t.controls, t.layers, t.media);

                    // grab for use by features
                    t.findTracks();

                    // add user-defined features/controls
                    for (featureIndex in t.options.features) {
                        feature = t.options.features[featureIndex];
                        if (t['build' + feature]) {
                            try {
                                t['build' + feature](t, t.controls, t.layers, t.media);
                            } catch (e) {
                                // TODO: report control error
                                throw e;
                                //console.log('error building ' + feature);
                                //console.log(e);
                            }
                        }
                    }

                    t.container.trigger('controlsready');

                    // reset all layers and controls
                    t.setPlayerSize(t.width, t.height);
                    t.setControlsSize();


                    // controls fade
                    if (t.isVideo) {

                        if (mejs.MediaFeatures.hasTouch) {

                            // for touch devices (iOS, Android)
                            // show/hide without animation on touch

                            t.$media.bind('touchstart', function () {


                                // toggle controls
                                if (t.controlsAreVisible) {
                                    t.hideControls(false);
                                } else {
                                    if (t.controlsEnabled) {
                                        t.showControls(false);
                                    }
                                }
                            });

                        } else {

                            // create callback here since it needs access to current
                            // MediaElement object
                            mejs.MediaElementPlayer.prototype.clickToPlayPauseCallback = function () {
                                console.log('media clicked', t.media, t.media.paused);

                                if (t.options.clickToPlayPause) {
                                    if (t.media.paused) {
                                        t.media.play();
                                    } else {
                                        t.media.pause();
                                    }
                                }
                            };

                            // click to play/pause
                            t.media.addEventListener('click', t.clickToPlayPauseCallback);

                            // show/hide controls
                            t.container
                                .bind('mouseenter mouseover', function () {
                                    if (t.controlsEnabled) {
                                        if (!t.options.alwaysShowControls) {
                                            t.killControlsTimer('enter');
                                            t.showControls();
                                            t.startControlsTimer(2500);
                                        }
                                    }
                                })
                                .bind('mousemove', function () {
                                    if (t.controlsEnabled) {
                                        if (!t.controlsAreVisible) {
                                            t.showControls();
                                        }
                                        //t.killControlsTimer('move');
                                        if (!t.options.alwaysShowControls) {
                                            t.startControlsTimer(2500);
                                        }
                                    }
                                })
                                .bind('mouseleave', function () {
                                    if (t.controlsEnabled) {
                                        if (!t.media.paused && !t.options.alwaysShowControls) {
                                            t.startControlsTimer(1000);
                                        }
                                    }
                                });
                        }

                        if (t.options.hideVideoControlsOnLoad) {
                            t.hideControls(false);
                        }

                        // check for autoplay
                        if (autoplay && !t.options.alwaysShowControls) {
                            t.hideControls();
                        }

                        // resizer
                        if (t.options.enableAutosize) {
                            t.media.addEventListener('loadedmetadata', function (e) {
                                // if the <video height> was not set and the options.videoHeight was not set
                                // then resize to the real dimensions
                                if (t.options.videoHeight <= 0 && t.domNode.getAttribute('height') === null && !isNaN(e.target.videoHeight)) {
                                    t.setPlayerSize(e.target.videoWidth, e.target.videoHeight);
                                    t.setControlsSize();
                                    t.media.setVideoSize(e.target.videoWidth, e.target.videoHeight);
                                }
                            }, false);
                        }
                    }

                    // EVENTS

                    // FOCUS: when a video starts playing, it takes focus from other players (possibily pausing them)
                    media.addEventListener('play', function () {
                        var playerIndex;

                        // go through all other players
                        for (playerIndex in mejs.players) {
                            var p = mejs.players[playerIndex];
                            if (p.id != t.id && t.options.pauseOtherPlayers && !p.paused && !p.ended) {
                                p.pause();
                            }
                            p.hasFocus = false;
                        }

                        t.hasFocus = true;
                    }, false);


                    // ended for all
                    t.media.addEventListener('ended', function (e) {
                        if (t.options.autoRewind) {
                            try {
                                t.media.setCurrentTime(0);
                            } catch (exp) {

                            }
                        }
                        t.media.pause();

                        if (t.setProgressRail) {
                            t.setProgressRail();
                        }
                        if (t.setCurrentRail) {
                            t.setCurrentRail();
                        }

                        if (t.options.loop) {
                            t.media.play();
                        } else if (!t.options.alwaysShowControls && t.controlsEnabled) {
                            t.showControls();
                        }
                    }, false);

                    // resize on the first play
                    t.media.addEventListener('loadedmetadata', function (e) {
                        if (t.updateDuration) {
                            t.updateDuration();
                        }
                        if (t.updateCurrent) {
                            t.updateCurrent();
                        }

                        if (!t.isFullScreen) {
                            t.setPlayerSize(t.width, t.height);
                            t.setControlsSize();
                        }
                    }, false);


                    // webkit has trouble doing this without a delay
                    setTimeout(function () {
                        t.setPlayerSize(t.width, t.height);
                        t.setControlsSize();
                    }, 50);

                    // adjust controls whenever window sizes (used to be in fullscreen only)
                    t.globalBind('resize', function () {

                        // don't resize for fullscreen mode
                        if (!(t.isFullScreen || (mejs.MediaFeatures.hasTrueNativeFullScreen && document.webkitIsFullScreen))) {
                            t.setPlayerSize(t.width, t.height);
                        }

                        // always adjust controls
                        t.setControlsSize();
                    });

                    // TEMP: needs to be moved somewhere else
                    if (t.media.pluginType == 'youtube') {
                        t.container.find('.mejs-overlay-play').hide();
                    }
                }

                // force autoplay for HTML5
                if (autoplay && media.pluginType == 'native') {
                    media.load();
                    media.play();
                }


                if (t.options.success) {

                    if (typeof t.options.success == 'string') {
                        window[t.options.success](t.media, t.domNode, t);
                    } else {
                        t.options.success(t.media, t.domNode, t);
                    }
                }
            },

            handleError: function (e) {
                var t = this;

                t.controls.hide();

                // Tell user that the file cannot be played
                if (t.options.error) {
                    t.options.error(e);
                }
            },

            setPlayerSize: function (width, height) {
                var t = this;

                if (typeof width != 'undefined') {
                    t.width = width;
                }

                if (typeof height != 'undefined') {
                    t.height = height;
                }

                // detect 100% mode - use currentStyle for IE since css() doesn't return percentages
                if (t.height.toString().indexOf('%') > 0 || t.$node.css('max-width') === '100%' || (t.$node[0].currentStyle && t.$node[0].currentStyle.maxWidth === '100%')) {

                    // do we have the native dimensions yet?
                    var
                        nativeWidth = t.isVideo ? ((t.media.videoWidth && t.media.videoWidth > 0) ? t.media.videoWidth : t.options.defaultVideoWidth) : t.options.defaultAudioWidth,
                        nativeHeight = t.isVideo ? ((t.media.videoHeight && t.media.videoHeight > 0) ? t.media.videoHeight : t.options.defaultVideoHeight) : t.options.defaultAudioHeight,
                        parentWidth = t.container.parent().closest(':visible').width(),
                        newHeight = t.isVideo || !t.options.autosizeProgress ? parseInt(parentWidth * nativeHeight / nativeWidth, 10) : nativeHeight;

                    if (t.container.parent()[0].tagName.toLowerCase() === 'body') { // && t.container.siblings().count == 0) {
                        parentWidth = $(window).width();
                        newHeight = $(window).height();
                    }

                    if (newHeight != 0 && parentWidth != 0) {
                        // set outer container size
                        t.container
                            .width(parentWidth)
                            .height(newHeight);

                        // set native <video> or <audio> and shims
                        t.$media.add(t.container.find('.mejs-shim'))
                            .width('100%')
                            .height('100%');

                        // if shim is ready, send the size to the embeded plugin
                        if (t.isVideo) {
                            if (t.media.setVideoSize) {
                                t.media.setVideoSize(parentWidth, newHeight);
                            }
                        }

                        // set the layers
                        t.layers.children('.mejs-layer')
                            .width('100%')
                            .height('100%');
                    }


                } else {

                    t.container
                        .width(t.width)
                        .height(t.height);

                    t.layers.children('.mejs-layer')
                        .width(t.width)
                        .height(t.height);

                }

                // special case for big play button so it doesn't go over the controls area
                var playLayer = t.layers.find('.mejs-overlay-play'),
                    playButton = playLayer.find('.mejs-overlay-button');

                playLayer.height(t.container.height() - t.controls.height());
                playButton.css('margin-top', '-' + (playButton.height() / 2 - t.controls.height() / 2).toString() + 'px');

            },

            setControlsSize: function () {
                var t = this,
                    usedWidth = 0,
                    railWidth = 0,
                    rail = t.controls.find('.mejs-time-rail'),
                    total = t.controls.find('.mejs-time-total'),
                    current = t.controls.find('.mejs-time-current'),
                    loaded = t.controls.find('.mejs-time-loaded'),
                    others = rail.siblings();


                // allow the size to come from custom CSS
                if (t.options && !t.options.autosizeProgress) {
                    // Also, frontends devs can be more flexible
                    // due the opportunity of absolute positioning.
                    railWidth = parseInt(rail.css('width'));
                }

                // attempt to autosize
                if (railWidth === 0 || !railWidth) {

                    // find the size of all the other controls besides the rail
                    others.each(function () {
                        var $this = $(this);
                        if ($this.css('position') != 'absolute' && $this.is(':visible')) {
                            usedWidth += $(this).outerWidth(true);
                        }
                    });

                    // fit the rail into the remaining space
                    railWidth = t.controls.width() - usedWidth - (rail.outerWidth(true) - rail.width());
                }

                // outer area
                rail.width(railWidth);
                // dark space
                total.width(railWidth - (total.outerWidth(true) - total.width()));

                if (t.setProgressRail)
                    t.setProgressRail();
                if (t.setCurrentRail)
                    t.setCurrentRail();
            },


            buildposter: function (player, controls, layers, media) {
                var t = this,
                    poster =
                    $('<div class="mejs-poster mejs-layer">' +
                        '</div>')
                    .appendTo(layers),
                    posterUrl = player.$media.attr('poster');

                // prioriy goes to option (this is useful if you need to support iOS 3.x (iOS completely fails with poster)
                if (player.options.poster !== '') {
                    posterUrl = player.options.poster;
                }

                // second, try the real poster
                if (posterUrl !== '' && posterUrl != null) {
                    t.setPoster(posterUrl);
                } else {
                    poster.hide();
                }

                media.addEventListener('play', function () {
                    poster.hide();
                }, false);
            },

            setPoster: function (url) {
                var t = this,
                    posterDiv = t.container.find('.mejs-poster'),
                    posterImg = posterDiv.find('img');

                if (posterImg.length == 0) {
                    posterImg = $('<img width="100%" height="100%" />').appendTo(posterDiv);
                }

                posterImg.attr('src', url);
                posterDiv.css({
                    'background-image': 'url(' + url + ')'
                });
            },

            buildoverlays: function (player, controls, layers, media) {
                var t = this;
                if (!player.isVideo)
                    return;

                var
                    loading =
                    $('<div class="mejs-overlay mejs-layer">' +
                        '<div class="mejs-overlay-loading"><span></span></div>' +
                        '</div>')
                    .hide() // start out hidden
                    .appendTo(layers),
                    error =
                    $('<div class="mejs-overlay mejs-layer">' +
                        '<div class="mejs-overlay-error"></div>' +
                        '</div>')
                    .hide() // start out hidden
                    .appendTo(layers),
                    // this needs to come last so it's on top
                    bigPlay =
                    $('<div class="mejs-overlay mejs-layer mejs-overlay-play">' +
                        '<div class="mejs-overlay-button"></div>' +
                        '</div>')
                    .appendTo(layers)
                    .click(function () {
                        if (t.options.clickToPlayPause) {
                            if (media.paused) {
                                media.play();
                            } else {
                                media.pause();
                            }
                        }
                    });

                /*
                     if (mejs.MediaFeatures.isiOS || mejs.MediaFeatures.isAndroid) {
                                bigPlay.remove();
                              loading.remove();
                      }
                      */


                // show/hide big play button
                media.addEventListener('play', function () {
                    bigPlay.hide();
                    loading.hide();
                    controls.find('.mejs-time-buffering').hide();
                    error.hide();
                }, false);

                media.addEventListener('playing', function () {
                    bigPlay.hide();
                    loading.hide();
                    controls.find('.mejs-time-buffering').hide();
                    error.hide();
                }, false);

                media.addEventListener('seeking', function () {
                    loading.show();
                    controls.find('.mejs-time-buffering').show();
                }, false);

                media.addEventListener('seeked', function () {
                    loading.hide();
                    controls.find('.mejs-time-buffering').hide();
                }, false);

                media.addEventListener('pause', function () {
                    if (!mejs.MediaFeatures.isiPhone) {
                        bigPlay.show();
                    }
                }, false);

                media.addEventListener('waiting', function () {
                    loading.show();
                    controls.find('.mejs-time-buffering').show();
                }, false);


                // show/hide loading
                media.addEventListener('loadeddata', function () {
                    // for some reason Chrome is firing this event
                    //if (mejs.MediaFeatures.isChrome && media.getAttribute && media.getAttribute('preload') === 'none')
                    //	return;

                    loading.show();
                    controls.find('.mejs-time-buffering').show();
                }, false);
                media.addEventListener('canplay', function () {
                    loading.hide();
                    controls.find('.mejs-time-buffering').hide();
                }, false);

                // error handling
                media.addEventListener('error', function () {
                    loading.hide();
                    controls.find('.mejs-time-buffering').hide();
                    error.show();
                    error.find('mejs-overlay-error').html("Error loading this resource");
                }, false);
            },

            buildkeyboard: function (player, controls, layers, media) {

                var t = this;

                // listen for key presses
                t.globalBind('keydown', function (e) {

                    if (player.hasFocus && player.options.enableKeyboard) {

                        // find a matching key
                        for (var i = 0, il = player.options.keyActions.length; i < il; i++) {
                            var keyAction = player.options.keyActions[i];

                            for (var j = 0, jl = keyAction.keys.length; j < jl; j++) {
                                if (e.keyCode == keyAction.keys[j]) {
                                    e.preventDefault();
                                    keyAction.action(player, media, e.keyCode);
                                    return false;
                                }
                            }
                        }
                    }

                    return true;
                });

                // check if someone clicked outside a player region, then kill its focus
                t.globalBind('click', function (event) {
                    if ($(event.target).closest('.mejs-container').length == 0) {
                        player.hasFocus = false;
                    }
                });

            },

            findTracks: function () {
                var t = this,
                    tracktags = t.$media.find('track');

                // store for use by plugins
                t.tracks = [];
                tracktags.each(function (index, track) {

                    track = $(track);

                    t.tracks.push({
                        srclang: (track.attr('srclang')) ? track.attr('srclang').toLowerCase() : '',
                        src: track.attr('src'),
                        kind: track.attr('kind'),
                        label: track.attr('label') || '',
                        entries: [],
                        isLoaded: false
                    });
                });
            },
            changeSkin: function (className) {
                this.container[0].className = 'mejs-container ' + className;
                this.setPlayerSize(this.width, this.height);
                this.setControlsSize();
            },
            play: function () {
                this.media.play();
            },
            pause: function () {
                this.media.pause();
            },
            load: function () {
                this.media.load();
            },
            setMuted: function (muted) {
                this.media.setMuted(muted);
            },
            setCurrentTime: function (time) {
                this.media.setCurrentTime(time);
            },
            getCurrentTime: function () {
                return this.media.currentTime;
            },
            setVolume: function (volume) {
                this.media.setVolume(volume);
            },
            getVolume: function () {
                return this.media.volume;
            },
            setSrc: function (src) {
                this.media.setSrc(src);
            },
            remove: function () {
                var t = this,
                    featureIndex, feature;

                // invoke features cleanup
                for (featureIndex in t.options.features) {
                    feature = t.options.features[featureIndex];
                    if (t['clean' + feature]) {
                        try {
                            t['clean' + feature](t);
                        } catch (e) {
                            // TODO: report control error
                            //throw e;
                            //console.log('error building ' + feature);
                            //console.log(e);
                        }
                    }
                }

                if (t.media.pluginType === 'native') {
                    t.$media.prop('controls', true);
                } else {
                    t.media.remove();
                }

                // grab video and put it back in place
                if (!t.isDynamic) {
                    if (t.media.pluginType === 'native') {
                        // detach events from the video
                        // TODO: detach event listeners better than this;
                        //       also detach ONLY the events attached by this plugin!
                        //t.$node.clone().insertBefore(t.container);
                        //t.$node.remove();
                    }
                    /*else*/
                    t.$node.insertBefore(t.container)
                }

                // Remove the player from the mejs.players object so that pauseOtherPlayers doesn't blow up when trying to pause a non existance flash api.
                delete mejs.players[t.id];

                t.container.remove();
                t.globalUnbind();
                delete t.node.player;
            }
        };

        (function () {
            var rwindow = /^((after|before)print|(before)?unload|hashchange|message|o(ff|n)line|page(hide|show)|popstate|resize|storage)\b/;

            function splitEvents(events, id) {
                // add player ID as an event namespace so it's easier to unbind them all later
                var ret = {
                    d: [],
                    w: []
                };
                $.each((events || '').split(' '), function (k, v) {
                    var eventname = v + '.' + id;
                    if (eventname.indexOf('.') === 0) {
                        ret.d.push(eventname);
                        ret.w.push(eventname);
                    } else {
                        ret[rwindow.test(v) ? 'w' : 'd'].push(eventname);
                    }
                });
                ret.d = ret.d.join(' ');
                ret.w = ret.w.join(' ');
                return ret;
            }

            mejs.MediaElementPlayer.prototype.globalBind = function (events, data, callback) {
                var t = this;
                events = splitEvents(events, t.id);
                if (events.d) $(document).bind(events.d, data, callback);
                if (events.w) $(window).bind(events.w, data, callback);
            };

            mejs.MediaElementPlayer.prototype.globalUnbind = function (events, callback) {
                var t = this;
                events = splitEvents(events, t.id);
                if (events.d) $(document).unbind(events.d, callback);
                if (events.w) $(window).unbind(events.w, callback);
            };
        })();

        // turn into jQuery plugin
        if (typeof jQuery != 'undefined') {
            jQuery.fn.mediaelementplayer = function (options) {
                if (options === false) {
                    this.each(function () {
                        var player = jQuery(this).data('mediaelementplayer');
                        if (player) {
                            player.remove();
                        }
                        jQuery(this).removeData('mediaelementplayer');
                    });
                } else {
                    this.each(function () {
                        jQuery(this).data('mediaelementplayer', new mejs.MediaElementPlayer(this, options));
                    });
                }
                return this;
            };
        }

        $(document).ready(function () {
            // auto enable using JSON attribute
            $('.mejs-player').mediaelementplayer();
        });

        // push out to window
        window.MediaElementPlayer = mejs.MediaElementPlayer;

    })(mejs.$);

    define("mep/mep-player", function () {});

    (function ($) {

        $.extend(mejs.MepDefaults, {
            playpauseText: mejs.i18n.t('Play/Pause')
        });

        // PLAY/pause BUTTON
        $.extend(MediaElementPlayer.prototype, {
            buildplaypause: function (player, controls, layers, media) {
                var
                    t = this,
                    play =
                    $('<div class="mejs-button mejs-playpause-button mejs-play" >' +
                        '<button type="button" aria-controls="' + t.id + '" title="' + t.options.playpauseText + '" aria-label="' + t.options.playpauseText + '"></button>' +
                        '</div>')
                    .appendTo(controls)
                    .click(function (e) {
                        e.preventDefault();

                        if (media.paused) {
                            media.play();
                        } else {
                            media.pause();
                        }

                        return false;
                    });

                media.addEventListener('play', function () {
                    play.removeClass('mejs-play').addClass('mejs-pause');
                }, false);
                media.addEventListener('playing', function () {
                    play.removeClass('mejs-play').addClass('mejs-pause');
                }, false);


                media.addEventListener('pause', function () {
                    play.removeClass('mejs-pause').addClass('mejs-play');
                }, false);
                media.addEventListener('paused', function () {
                    play.removeClass('mejs-pause').addClass('mejs-play');
                }, false);
            }
        });

    })(mejs.$);

    define("mep/mep-feature-playpause", function () {});

    (function ($) {

        $.extend(mejs.MepDefaults, {
            stopText: 'Stop'
        });

        // STOP BUTTON
        $.extend(MediaElementPlayer.prototype, {
            buildstop: function (player, controls, layers, media) {
                var t = this,
                    stop =
                    $('<div class="mejs-button mejs-stop-button mejs-stop">' +
                        '<button type="button" aria-controls="' + t.id + '" title="' + t.options.stopText + '" aria-label="' + t.options.stopText + '"></button>' +
                        '</div>')
                    .appendTo(controls)
                    .click(function () {
                        if (!media.paused) {
                            media.pause();
                        }
                        if (media.currentTime > 0) {
                            media.setCurrentTime(0);
                            media.pause();
                            controls.find('.mejs-time-current').width('0px');
                            controls.find('.mejs-time-handle').css('left', '0px');
                            controls.find('.mejs-time-float-current').html(mejs.Utility.secondsToTimeCode(0));
                            controls.find('.mejs-currenttime').html(mejs.Utility.secondsToTimeCode(0));
                            layers.find('.mejs-poster').show();
                        }
                    });
            }
        });

    })(mejs.$);

    define("mep/mep-feature-stop", function () {});

    (function ($) {
        // progress/loaded bar
        $.extend(MediaElementPlayer.prototype, {
            buildprogress: function (player, controls, layers, media) {

                $('<div class="mejs-time-rail">' +
                        '<span class="mejs-time-total">' +
                        '<span class="mejs-time-buffering"></span>' +
                        '<span class="mejs-time-loaded"></span>' +
                        '<span class="mejs-time-current"></span>' +
                        '<span class="mejs-time-handle"></span>' +
                        '<span class="mejs-time-float">' +
                        '<span class="mejs-time-float-current">00:00</span>' +
                        '<span class="mejs-time-float-corner"></span>' +
                        '</span>' +
                        '</span>' +
                        '</div>')
                    .appendTo(controls);
                controls.find('.mejs-time-buffering').hide();

                var
                    t = this,
                    total = controls.find('.mejs-time-total'),
                    loaded = controls.find('.mejs-time-loaded'),
                    current = controls.find('.mejs-time-current'),
                    handle = controls.find('.mejs-time-handle'),
                    timefloat = controls.find('.mejs-time-float'),
                    timefloatcurrent = controls.find('.mejs-time-float-current'),
                    handleMouseMove = function (e) {
                        // mouse position relative to the object
                        var x = e.pageX,
                            offset = total.offset(),
                            width = total.outerWidth(true),
                            percentage = 0,
                            newTime = 0,
                            pos = 0;


                        if (media.duration) {
                            if (x < offset.left) {
                                x = offset.left;
                            } else if (x > width + offset.left) {
                                x = width + offset.left;
                            }

                            pos = x - offset.left;
                            percentage = (pos / width);
                            newTime = (percentage <= 0.02) ? 0 : percentage * media.duration;

                            // seek to where the mouse is
                            if (mouseIsDown && newTime !== media.currentTime) {
                                media.setCurrentTime(newTime);
                            }

                            // position floating time box
                            if (!mejs.MediaFeatures.hasTouch) {
                                timefloat.css('left', pos);
                                timefloatcurrent.html(mejs.Utility.secondsToTimeCode(newTime));
                                timefloat.show();
                            }
                        }
                    },
                    mouseIsDown = false,
                    mouseIsOver = false;

                // handle clicks
                //controls.find('.mejs-time-rail').delegate('span', 'click', handleMouseMove);
                total
                    .bind('mousedown', function (e) {
                        // only handle left clicks
                        if (e.which === 1) {
                            mouseIsDown = true;
                            handleMouseMove(e);
                            t.globalBind('mousemove.dur', function (e) {
                                handleMouseMove(e);
                            });
                            t.globalBind('mouseup.dur', function (e) {
                                mouseIsDown = false;
                                timefloat.hide();
                                t.globalUnbind('.dur');
                            });
                            return false;
                        }
                    })
                    .bind('mouseenter', function (e) {
                        mouseIsOver = true;
                        t.globalBind('mousemove.dur', function (e) {
                            handleMouseMove(e);
                        });
                        if (!mejs.MediaFeatures.hasTouch) {
                            timefloat.show();
                        }
                    })
                    .bind('mouseleave', function (e) {
                        mouseIsOver = false;
                        if (!mouseIsDown) {
                            t.globalUnbind('.dur');
                            timefloat.hide();
                        }
                    });

                // loading
                media.addEventListener('progress', function (e) {
                    player.setProgressRail(e);
                    player.setCurrentRail(e);
                }, false);

                // current time
                media.addEventListener('timeupdate', function (e) {
                    player.setProgressRail(e);
                    player.setCurrentRail(e);
                }, false);


                // store for later use
                t.loaded = loaded;
                t.total = total;
                t.current = current;
                t.handle = handle;
            },
            setProgressRail: function (e) {

                var
                    t = this,
                    target = (e != undefined) ? e.target : t.media,
                    percent = null;

                // newest HTML5 spec has buffered array (FF4, Webkit)
                if (target && target.buffered && target.buffered.length > 0 && target.buffered.end && target.duration) {
                    // TODO: account for a real array with multiple values (only Firefox 4 has this so far)
                    percent = target.buffered.end(0) / target.duration;
                }
                // Some browsers (e.g., FF3.6 and Safari 5) cannot calculate target.bufferered.end()
                // to be anything other than 0. If the byte count is available we use this instead.
                // Browsers that support the else if do not seem to have the bufferedBytes value and
                // should skip to there. Tested in Safari 5, Webkit head, FF3.6, Chrome 6, IE 7/8.
                else if (target && target.bytesTotal != undefined && target.bytesTotal > 0 && target.bufferedBytes != undefined) {
                    percent = target.bufferedBytes / target.bytesTotal;
                }
                // Firefox 3 with an Ogg file seems to go this way
                else if (e && e.lengthComputable && e.total != 0) {
                    percent = e.loaded / e.total;
                }

                // finally update the progress bar
                if (percent !== null) {
                    percent = Math.min(1, Math.max(0, percent));
                    // update loaded bar
                    if (t.loaded && t.total) {
                        t.loaded.width(t.total.width() * percent);
                    }
                }
            },
            setCurrentRail: function () {

                var t = this;

                if (t.media.currentTime != undefined && t.media.duration) {

                    // update bar and handle
                    if (t.total && t.handle) {
                        var
                            newWidth = Math.round(t.total.width() * t.media.currentTime / t.media.duration),
                            handlePos = newWidth - Math.round(t.handle.outerWidth(true) / 2);

                        t.current.width(newWidth);
                        t.handle.css('left', handlePos);
                    }
                }

            }
        });
    })(mejs.$);

    define("mep/mep-feature-progress", function () {});

    (function ($) {

        // options
        $.extend(mejs.MepDefaults, {
            duration: -1,
            timeAndDurationSeparator: ' <span> / </span> '
        });


        // current and duration 00:00 / 00:00
        $.extend(MediaElementPlayer.prototype, {
            buildcurrent: function (player, controls, layers, media) {
                var t = this;

                $('<div class="mejs-time">' +
                        '<span class="mejs-currenttime">' + (player.options.alwaysShowHours ? '00:' : '') + (player.options.showTimecodeFrameCount ? '00:00:00' : '00:00') + '</span>' +
                        '</div>')
                    .appendTo(controls);

                t.currenttime = t.controls.find('.mejs-currenttime');

                media.addEventListener('timeupdate', function () {
                    player.updateCurrent();
                }, false);
            },


            buildduration: function (player, controls, layers, media) {
                var t = this;

                if (controls.children().last().find('.mejs-currenttime').length > 0) {
                    $(t.options.timeAndDurationSeparator +
                            '<span class="mejs-duration">' +
                            (t.options.duration > 0 ?
                                mejs.Utility.secondsToTimeCode(t.options.duration, t.options.alwaysShowHours || t.media.duration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25) :
                                ((player.options.alwaysShowHours ? '00:' : '') + (player.options.showTimecodeFrameCount ? '00:00:00' : '00:00'))
                            ) +
                            '</span>')
                        .appendTo(controls.find('.mejs-time'));
                } else {

                    // add class to current time
                    controls.find('.mejs-currenttime').parent().addClass('mejs-currenttime-container');

                    $('<div class="mejs-time mejs-duration-container">' +
                            '<span class="mejs-duration">' +
                            (t.options.duration > 0 ?
                                mejs.Utility.secondsToTimeCode(t.options.duration, t.options.alwaysShowHours || t.media.duration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25) :
                                ((player.options.alwaysShowHours ? '00:' : '') + (player.options.showTimecodeFrameCount ? '00:00:00' : '00:00'))
                            ) +
                            '</span>' +
                            '</div>')
                        .appendTo(controls);
                }

                t.durationD = t.controls.find('.mejs-duration');

                media.addEventListener('timeupdate', function () {
                    player.updateDuration();
                }, false);
            },

            updateCurrent: function () {
                var t = this;

                if (t.currenttime) {
                    t.currenttime.html(mejs.Utility.secondsToTimeCode(t.media.currentTime, t.options.alwaysShowHours || t.media.duration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));
                }
            },

            updateDuration: function () {
                var t = this;

                //Toggle the long video class if the video is longer than an hour.
                t.container.toggleClass("mejs-long-video", t.media.duration > 3600);

                if (t.durationD && (t.options.duration > 0 || t.media.duration)) {
                    t.durationD.html(mejs.Utility.secondsToTimeCode(t.options.duration > 0 ? t.options.duration : t.media.duration, t.options.alwaysShowHours, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));
                }
            }
        });

    })(mejs.$);

    define("mep/mep-feature-time", function () {});

    (function ($) {

        $.extend(mejs.MepDefaults, {
            muteText: mejs.i18n.t('Mute Toggle'),
            hideVolumeOnTouchDevices: true,

            audioVolume: 'horizontal',
            videoVolume: 'vertical'
        });

        $.extend(MediaElementPlayer.prototype, {
            buildvolume: function (player, controls, layers, media) {

                // Android and iOS don't support volume controls
                if (mejs.MediaFeatures.hasTouch && this.options.hideVolumeOnTouchDevices)
                    return;

                var t = this,
                    mode = (t.isVideo) ? t.options.videoVolume : t.options.audioVolume,
                    mute = (mode == 'horizontal') ?

                    // horizontal version
                    $('<div class="mejs-button mejs-volume-button mejs-mute">' +
                        '<button type="button" aria-controls="' + t.id + '" title="' + t.options.muteText + '" aria-label="' + t.options.muteText + '"></button>' +
                        '</div>' +
                        '<div class="mejs-horizontal-volume-slider">' + // outer background
                        '<div class="mejs-horizontal-volume-total"></div>' + // line background
                        '<div class="mejs-horizontal-volume-current"></div>' + // current volume
                        '<div class="mejs-horizontal-volume-handle"></div>' + // handle
                        '</div>'
                    )
                    .appendTo(controls) :

                    // vertical version
                    $('<div class="mejs-button mejs-volume-button mejs-mute">' +
                        '<button type="button" aria-controls="' + t.id + '" title="' + t.options.muteText + '" aria-label="' + t.options.muteText + '"></button>' +
                        '<div class="mejs-volume-slider">' + // outer background
                        '<div class="mejs-volume-total"></div>' + // line background
                        '<div class="mejs-volume-current"></div>' + // current volume
                        '<div class="mejs-volume-handle"></div>' + // handle
                        '</div>' +
                        '</div>')
                    .appendTo(controls),
                    volumeSlider = t.container.find('.mejs-volume-slider, .mejs-horizontal-volume-slider'),
                    volumeTotal = t.container.find('.mejs-volume-total, .mejs-horizontal-volume-total'),
                    volumeCurrent = t.container.find('.mejs-volume-current, .mejs-horizontal-volume-current'),
                    volumeHandle = t.container.find('.mejs-volume-handle, .mejs-horizontal-volume-handle'),

                    positionVolumeHandle = function (volume, secondTry) {

                        if (!volumeSlider.is(':visible') && typeof secondTry == 'undefined') {
                            volumeSlider.show();
                            positionVolumeHandle(volume, true);
                            volumeSlider.hide()
                            return;
                        }

                        // correct to 0-1
                        volume = Math.max(0, volume);
                        volume = Math.min(volume, 1);

                        // ajust mute button style
                        if (volume == 0) {
                            mute.removeClass('mejs-mute').addClass('mejs-unmute');
                        } else {
                            mute.removeClass('mejs-unmute').addClass('mejs-mute');
                        }

                        // position slider
                        if (mode == 'vertical') {
                            var

                            // height of the full size volume slider background
                                totalHeight = volumeTotal.height(),

                                // top/left of full size volume slider background
                                totalPosition = volumeTotal.position(),

                                // the new top position based on the current volume
                                // 70% volume on 100px height == top:30px
                                newTop = totalHeight - (totalHeight * volume);

                            // handle
                            volumeHandle.css('top', Math.round(totalPosition.top + newTop - (volumeHandle.height() / 2)));

                            // show the current visibility
                            volumeCurrent.height(totalHeight - newTop);
                            volumeCurrent.css('top', totalPosition.top + newTop);
                        } else {
                            var

                            // height of the full size volume slider background
                                totalWidth = volumeTotal.width(),

                                // top/left of full size volume slider background
                                totalPosition = volumeTotal.position(),

                                // the new left position based on the current volume
                                newLeft = totalWidth * volume;

                            // handle
                            volumeHandle.css('left', Math.round(totalPosition.left + newLeft - (volumeHandle.width() / 2)));

                            // rezize the current part of the volume bar
                            volumeCurrent.width(Math.round(newLeft));
                        }
                    },
                    handleVolumeMove = function (e) {

                        var volume = null,
                            totalOffset = volumeTotal.offset();

                        // calculate the new volume based on the moust position
                        if (mode == 'vertical') {

                            var
                                railHeight = volumeTotal.height(),
                                totalTop = parseInt(volumeTotal.css('top').replace(/px/, ''), 10),
                                newY = e.pageY - totalOffset.top;

                            volume = (railHeight - newY) / railHeight;

                            // the controls just hide themselves (usually when mouse moves too far up)
                            if (totalOffset.top == 0 || totalOffset.left == 0)
                                return;

                        } else {
                            var
                                railWidth = volumeTotal.width(),
                                newX = e.pageX - totalOffset.left;

                            volume = newX / railWidth;
                        }

                        // ensure the volume isn't outside 0-1
                        volume = Math.max(0, volume);
                        volume = Math.min(volume, 1);

                        // position the slider and handle
                        positionVolumeHandle(volume);

                        // set the media object (this will trigger the volumechanged event)
                        if (volume == 0) {
                            media.setMuted(true);
                        } else {
                            media.setMuted(false);
                        }
                        media.setVolume(volume);
                    },
                    mouseIsDown = false,
                    mouseIsOver = false;

                // SLIDER

                mute
                    .hover(function () {
                        volumeSlider.show();
                        mouseIsOver = true;
                    }, function () {
                        mouseIsOver = false;

                        if (!mouseIsDown && mode == 'vertical') {
                            volumeSlider.hide();
                        }
                    });

                volumeSlider
                    .bind('mouseover', function () {
                        mouseIsOver = true;
                    })
                    .bind('mousedown', function (e) {
                        handleVolumeMove(e);
                        t.globalBind('mousemove.vol', function (e) {
                            handleVolumeMove(e);
                        });
                        t.globalBind('mouseup.vol', function () {
                            mouseIsDown = false;
                            t.globalUnbind('.vol');

                            if (!mouseIsOver && mode == 'vertical') {
                                volumeSlider.hide();
                            }
                        });
                        mouseIsDown = true;

                        return false;
                    });


                // MUTE button
                mute.find('button').click(function () {
                    media.setMuted(!media.muted);
                });

                // listen for volume change events from other sources
                media.addEventListener('volumechange', function (e) {
                    if (!mouseIsDown) {
                        if (media.muted) {
                            positionVolumeHandle(0);
                            mute.removeClass('mejs-mute').addClass('mejs-unmute');
                        } else {
                            positionVolumeHandle(media.volume);
                            mute.removeClass('mejs-unmute').addClass('mejs-mute');
                        }
                    }
                }, false);

                if (t.container.is(':visible')) {
                    // set initial volume
                    positionVolumeHandle(player.options.startVolume);

                    // mutes the media and sets the volume icon muted if the initial volume is set to 0
                    if (player.options.startVolume === 0) {
                        media.setMuted(true);
                    }

                    // shim gets the startvolume as a parameter, but we have to set it on the native <video> and <audio> elements
                    if (media.pluginType === 'native') {
                        media.setVolume(player.options.startVolume);
                    }
                }
            }
        });

    })(mejs.$);

    define("mep/mep-feature-volume", function () {});

    (function ($) {

        $.extend(mejs.MepDefaults, {
            usePluginFullScreen: true,
            newWindowCallback: function () {
                return '';
            },
            fullscreenText: mejs.i18n.t('Fullscreen')
        });

        $.extend(MediaElementPlayer.prototype, {

            isFullScreen: false,

            isNativeFullScreen: false,

            docStyleOverflow: null,

            isInIframe: false,

            isWebkitFullscreen: false,

            buildfullscreen: function (player, controls, layers, media) {

                if (!player.isVideo)
                    return;

                player.isInIframe = (window.location != window.parent.location);

                // native events
                if (mejs.MediaFeatures.hasTrueNativeFullScreen) {

                    // chrome doesn't alays fire this in an iframe
                    var func = function (e) {

                        if (mejs.MediaFeatures.isFullScreen()) {
                            player.isNativeFullScreen = true;
                            // reset the controls once we are fully in full screen
                            player.setControlsSize();
                        } else {
                            player.isNativeFullScreen = false;
                            // when a user presses ESC
                            // make sure to put the player back into place
                            player.exitFullScreen();
                        }
                    };

                    if (mejs.MediaFeatures.hasMozNativeFullScreen) {
                        player.globalBind(mejs.MediaFeatures.fullScreenEventName, func);
                    } else {
                        player.container.bind(mejs.MediaFeatures.fullScreenEventName, func);
                    }
                }

                var t = this,
                    normalHeight = 0,
                    normalWidth = 0,
                    container = player.container,
                    fullscreenBtn =
                    $('<div class="mejs-button mejs-fullscreen-button">' +
                        '<button type="button" aria-controls="' + t.id + '" title="' + t.options.fullscreenText + '" aria-label="' + t.options.fullscreenText + '"></button>' +
                        '</div>')
                    .appendTo(controls);

                if (t.media.pluginType === 'native' || (!t.options.usePluginFullScreen && !mejs.MediaFeatures.isFirefox)) {

                    fullscreenBtn.click(function () {
                        var isFullScreen = (mejs.MediaFeatures.hasTrueNativeFullScreen && mejs.MediaFeatures.isFullScreen()) || player.isFullScreen;

                        if (isFullScreen) {
                            player.exitFullScreen();
                        } else {
                            player.enterFullScreen();
                        }
                    });

                } else {

                    var hideTimeout = null,
                        supportsPointerEvents = (function () {
                            // TAKEN FROM MODERNIZR
                            var element = document.createElement('x'),
                                documentElement = document.documentElement,
                                getComputedStyle = window.getComputedStyle,
                                supports;
                            if (!('pointerEvents' in element.style)) {
                                return false;
                            }
                            element.style.pointerEvents = 'auto';
                            element.style.pointerEvents = 'x';
                            documentElement.appendChild(element);
                            supports = getComputedStyle &&
                                getComputedStyle(element, '').pointerEvents === 'auto';
                            documentElement.removeChild(element);
                            return !!supports;
                        })();

                    //console.log('supportsPointerEvents', supportsPointerEvents);

                    if (supportsPointerEvents && !mejs.MediaFeatures.isOpera) { // opera doesn't allow this :(

                        // allows clicking through the fullscreen button and controls down directly to Flash

                        /*
                                              When a user puts his mouse over the fullscreen button, the controls are disabled
                                               So we put a div over the video and another one on iether side of the fullscreen button
                                                 that caputre mouse movement
                                            and restore the controls once the mouse moves outside of the fullscreen button
                                                */

                        var fullscreenIsDisabled = false,
                            restoreControls = function () {
                                if (fullscreenIsDisabled) {
                                    // hide the hovers
                                    for (var i in hoverDivs) {
                                        hoverDivs[i].hide();
                                    }

                                    // restore the control bar
                                    fullscreenBtn.css('pointer-events', '');
                                    t.controls.css('pointer-events', '');

                                    // prevent clicks from pausing video
                                    t.media.removeEventListener('click', t.clickToPlayPauseCallback);

                                    // store for later
                                    fullscreenIsDisabled = false;
                                }
                            },
                            hoverDivs = {},
                            hoverDivNames = ['top', 'left', 'right', 'bottom'],
                            i, len,
                            positionHoverDivs = function () {
                                var fullScreenBtnOffsetLeft = fullscreenBtn.offset().left - t.container.offset().left,
                                    fullScreenBtnOffsetTop = fullscreenBtn.offset().top - t.container.offset().top,
                                    fullScreenBtnWidth = fullscreenBtn.outerWidth(true),
                                    fullScreenBtnHeight = fullscreenBtn.outerHeight(true),
                                    containerWidth = t.container.width(),
                                    containerHeight = t.container.height();

                                for (i in hoverDivs) {
                                    hoverDivs[i].css({
                                        position: 'absolute',
                                        top: 0,
                                        left: 0
                                    }); //, backgroundColor: '#f00'});
                                }

                                // over video, but not controls
                                hoverDivs['top']
                                    .width(containerWidth)
                                    .height(fullScreenBtnOffsetTop);

                                // over controls, but not the fullscreen button
                                hoverDivs['left']
                                    .width(fullScreenBtnOffsetLeft)
                                    .height(fullScreenBtnHeight)
                                    .css({
                                        top: fullScreenBtnOffsetTop
                                    });

                                // after the fullscreen button
                                hoverDivs['right']
                                    .width(containerWidth - fullScreenBtnOffsetLeft - fullScreenBtnWidth)
                                    .height(fullScreenBtnHeight)
                                    .css({
                                        top: fullScreenBtnOffsetTop,
                                        left: fullScreenBtnOffsetLeft + fullScreenBtnWidth
                                    });

                                // under the fullscreen button
                                hoverDivs['bottom']
                                    .width(containerWidth)
                                    .height(containerHeight - fullScreenBtnHeight - fullScreenBtnOffsetTop)
                                    .css({
                                        top: fullScreenBtnOffsetTop + fullScreenBtnHeight
                                    });
                            };

                        t.globalBind('resize', function () {
                            positionHoverDivs();
                        });

                        for (i = 0, len = hoverDivNames.length; i < len; i++) {
                            hoverDivs[hoverDivNames[i]] = $('<div class="mejs-fullscreen-hover" />').appendTo(t.container).mouseover(restoreControls).hide();
                        }

                        // on hover, kill the fullscreen button's HTML handling, allowing clicks down to Flash
                        fullscreenBtn.on('mouseover', function () {

                            if (!t.isFullScreen) {

                                var buttonPos = fullscreenBtn.offset(),
                                    containerPos = player.container.offset();

                                // move the button in Flash into place
                                media.positionFullscreenButton(buttonPos.left - containerPos.left, buttonPos.top - containerPos.top, false);

                                // allows click through
                                fullscreenBtn.css('pointer-events', 'none');
                                t.controls.css('pointer-events', 'none');

                                // restore click-to-play
                                t.media.addEventListener('click', t.clickToPlayPauseCallback);

                                // show the divs that will restore things
                                for (i in hoverDivs) {
                                    hoverDivs[i].show();
                                }

                                positionHoverDivs();

                                fullscreenIsDisabled = true;
                            }

                        });

                        // restore controls anytime the user enters or leaves fullscreen
                        media.addEventListener('fullscreenchange', function (e) {
                            t.isFullScreen = !t.isFullScreen;
                            // don't allow plugin click to pause video - messes with
                            // plugin's controls
                            if (t.isFullScreen) {
                                t.media.removeEventListener('click', t.clickToPlayPauseCallback);
                            } else {
                                t.media.addEventListener('click', t.clickToPlayPauseCallback);
                            }
                            restoreControls();
                        });


                        // the mouseout event doesn't work on the fullscren button, because we already killed the pointer-events
                        // so we use the document.mousemove event to restore controls when the mouse moves outside the fullscreen button

                        t.globalBind('mousemove', function (e) {

                            // if the mouse is anywhere but the fullsceen button, then restore it all
                            if (fullscreenIsDisabled) {

                                var fullscreenBtnPos = fullscreenBtn.offset();


                                if (e.pageY < fullscreenBtnPos.top || e.pageY > fullscreenBtnPos.top + fullscreenBtn.outerHeight(true) ||
                                    e.pageX < fullscreenBtnPos.left || e.pageX > fullscreenBtnPos.left + fullscreenBtn.outerWidth(true)
                                ) {

                                    fullscreenBtn.css('pointer-events', '');
                                    t.controls.css('pointer-events', '');

                                    fullscreenIsDisabled = false;
                                }
                            }
                        });



                    } else {

                        // the hover state will show the fullscreen button in Flash to hover up and click

                        fullscreenBtn
                            .on('mouseover', function () {

                                if (hideTimeout !== null) {
                                    clearTimeout(hideTimeout);
                                    delete hideTimeout;
                                }

                                var buttonPos = fullscreenBtn.offset(),
                                    containerPos = player.container.offset();

                                media.positionFullscreenButton(buttonPos.left - containerPos.left, buttonPos.top - containerPos.top, true);

                            })
                            .on('mouseout', function () {

                                if (hideTimeout !== null) {
                                    clearTimeout(hideTimeout);
                                    delete hideTimeout;
                                }

                                hideTimeout = setTimeout(function () {
                                    media.hideFullscreenButton();
                                }, 1500);


                            });
                    }
                }

                player.fullscreenBtn = fullscreenBtn;

                t.globalBind('keydown', function (e) {
                    if (((mejs.MediaFeatures.hasTrueNativeFullScreen && mejs.MediaFeatures.isFullScreen()) || t.isFullScreen) && e.keyCode == 27) {
                        player.exitFullScreen();
                    }
                });

            },

            cleanfullscreen: function (player) {
                player.exitFullScreen();
            },

            containerSizeTimeout: null,

            enterFullScreen: function () {
                console.log('enterFullScreen');

                var t = this;

                // firefox+flash can't adjust plugin sizes without resetting :(
                if (t.media.pluginType !== 'native' && (mejs.MediaFeatures.isFirefox || t.options.usePluginFullScreen)) {
                    //t.media.setFullscreen(true);
                    //player.isFullScreen = true;
                    return;
                }

                // store overflow
                docStyleOverflow = document.documentElement.style.overflow;
                // set it to not show scroll bars so 100% will work
                document.documentElement.style.overflow = 'hidden';

                // store sizing
                normalHeight = t.container.height();
                normalWidth = t.container.width();

                // attempt to do true fullscreen (Safari 5.1 and Firefox Nightly only for now)
                if (t.media.pluginType === 'native') {
                    if (mejs.MediaFeatures.hasTrueNativeFullScreen) {

                        mejs.MediaFeatures.requestFullScreen(t.container[0]);
                        //return;

                        if (t.isInIframe) {
                            // sometimes exiting from fullscreen doesn't work
                            // notably in Chrome <iframe>. Fixed in version 17
                            setTimeout(function checkFullscreen() {

                                if (t.isNativeFullScreen) {

                                    // check if the video is suddenly not really fullscreen
                                    if ($(window).width() !== screen.width) {
                                        // manually exit
                                        t.exitFullScreen();
                                    } else {
                                        // test again
                                        setTimeout(checkFullscreen, 500);
                                    }
                                }


                            }, 500);
                        }

                    } else if (mejs.MediaFeatures.hasSemiNativeFullScreen) {
                        // Can't use mejs's fullscreen here as interferes with
                        // Google IMA ad fullscreening.
                        //t.media.webkitEnterFullscreen();
                        // Instead, see if we are running an IMA ad.  If so, fullscreen it first.
                        t.isWebkitFullscreen = true;
                        if (t.media.isGoogle) {
                            t.media.parentNode.children[1].children[0].children[0].children[0].webkitEnterFullscreen();
                        } else {
                            t.media.webkitEnterFullscreen();
                        }

                        return;
                    }
                }

                // check for iframe launch
                if (t.isInIframe) {
                    var url = t.options.newWindowCallback(this);


                    if (url !== '') {

                        // launch immediately
                        if (!mejs.MediaFeatures.hasTrueNativeFullScreen) {
                            t.pause();
                            window.open(url, t.id, 'top=0,left=0,width=' + screen.availWidth + ',height=' + screen.availHeight + ',resizable=yes,scrollbars=no,status=no,toolbar=no');
                            return;
                        } else {
                            setTimeout(function () {
                                if (!t.isNativeFullScreen) {
                                    t.pause();
                                    window.open(url, t.id, 'top=0,left=0,width=' + screen.availWidth + ',height=' + screen.availHeight + ',resizable=yes,scrollbars=no,status=no,toolbar=no');
                                }
                            }, 250);
                        }
                    }

                }

                // full window code



                // make full size
                t.container
                    .addClass('mejs-container-fullscreen')
                    .width('100%')
                    .height('100%');
                //.css({position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden', width: '100%', height: '100%', 'z-index': 1000});

                // Only needed for safari 5.1 native full screen, can cause display issues elsewhere
                // Actually, it seems to be needed for IE8, too
                //if (mejs.MediaFeatures.hasTrueNativeFullScreen) {
                t.containerSizeTimeout = setTimeout(function () {
                    t.container.css({
                        width: '100%',
                        height: '100%'
                    });
                    t.setControlsSize();
                }, 500);
                //}




                if (t.media.pluginType === 'native') {
                    t.$media
                        .width('100%')
                        .height('100%');
                } else {
                    t.container.find('.mejs-shim')
                        .width('100%')
                        .height('100%');

                    //if (!mejs.MediaFeatures.hasTrueNativeFullScreen) {
                    t.media.setVideoSize($(window).width(), $(window).height());
                    //}
                }

                t.layers.children('div')
                    .width('100%')
                    .height('100%');

                if (t.fullscreenBtn) {
                    t.fullscreenBtn
                        .removeClass('mejs-fullscreen')
                        .addClass('mejs-unfullscreen');
                }

                t.setControlsSize();
                t.isFullScreen = true;
                // Custom enterFullScreen event
                t.container.trigger('enterFullScreen');
            },

            exitFullScreen: function () {

                var t = this;

                // Prevent container from attempting to stretch a second time
                clearTimeout(t.containerSizeTimeout);

                if (mejs.MediaFeatures.hasSemiNativeFullScreen) {
                    // Can't use mejs's fullscreen here as interferes with
                    // Google IMA ad fullscreening.
                    //t.media.webkitEnterFullscreen();
                    // Instead, see if we are running an IMA ad.  If so, exit its fullscreen.
                    if (t.media.isGoogle) {
                        t.media.parentNode.children[1].children[0].children[0].children[0].webkitExitFullscreen();
                        t.media.isGoogleFullscreen = false;
                    }
                }

                // firefox can't adjust plugins
                if (t.media.pluginType !== 'native' && mejs.MediaFeatures.isFirefox) {
                    t.media.setFullscreen(false);
                    //player.isFullScreen = false;
                    return;
                }

                // come outo of native fullscreen
                if (mejs.MediaFeatures.hasTrueNativeFullScreen && (mejs.MediaFeatures.isFullScreen() || t.isFullScreen)) {
                    mejs.MediaFeatures.cancelFullScreen();
                }

                // restore scroll bars to document
                document.documentElement.style.overflow = docStyleOverflow;

                t.container
                    .removeClass('mejs-container-fullscreen')
                    .width(normalWidth)
                    .height(normalHeight);
                //.css({position: '', left: '', top: '', right: '', bottom: '', overflow: 'inherit', width: normalWidth + 'px', height: normalHeight + 'px', 'z-index': 1});

                if (t.media.pluginType === 'native') {
                    t.$media
                        .width(normalWidth)
                        .height(normalHeight);
                } else {
                    t.container.find('.mejs-shim')
                        .width(normalWidth)
                        .height(normalHeight);

                    t.media.setVideoSize(normalWidth, normalHeight);
                }

                t.layers.children('div')
                    .width(normalWidth)
                    .height(normalHeight);

                t.fullscreenBtn
                    .removeClass('mejs-unfullscreen')
                    .addClass('mejs-fullscreen');

                t.setControlsSize();
                t.isFullScreen = false;
            }
        });

    })(mejs.$);

    define("mep/mep-feature-fullscreen", function () {});

    (function ($, _) {
        //###Extend options with defaults
        $.extend(mejs.MepDefaults, {
            //####Default options
            //question
            agegateText: 'Please enter your date of birth to continue',
            //reject message
            agegateTextReject: 'You are not old enough to view this content',
            //Age gate reject message
            minAge: 18,
            //Min selectable date
            agegateMinDate: '1913-01-01',
            //Max selectable date
            agegateMaxDate: '2013-01-01',
        });
        //###Extend the player with the agegate feature
        $.extend(MediaElementPlayer.prototype, {
            //the factory function
            buildagegate: function (player, controls, layers, media) {

                var t = this;
                //Check
                if (t.options.ageGate !== "true") {
                    return;
                }
                //Stop
                if (!media.paused) {
                    media.pause();
                }

                //Add layer overlay for agegate
                var select = function (items, name, ph) {
                    return $('<select name="' + name + '" placeholder="' + ph + '">' +
                        '<option> </option>' +
                        _(items).map(
                            function (d) {
                                return '<option>' + d + '</option>';
                            })
                        .join('') +
                        '</selec>');
                };
                player.agegateLayer =
                    $('<div class="mejs-layer mejs-overlay mejs-agegate">')
                    .append(
                        $('<div class="mejs-agegate-container">')
                        .append($('<span>').text(t.options.agegateText))
                        .append(
                            $('<div>')
                            //.append($('<input type="date" min="' + t.options.agegateMinDate + '" max="' + t.options.agegateMaxDate + '">'))
                            .append(select(_.range(1, 32), 'day', 'DD'))
                            .append(select(_.range(1, 13), 'month', 'MM'))
                            .append(select(_.range(1920, 2013).reverse(), 'year', 'YYYY'))
                        )
                        .append(
                            $('<div>')
                            .append(
                                $('<input type="submit">')
                                .on('click', function (e) {
                                    e.preventDefault();
                                    var year = parseInt($('.mejs-layer.mejs-agegate select[name=year] option:selected').val(), 0),
                                        n = new Date();
                                    if (n.getFullYear() - year >= t.options.minAge) {
                                        player.agegateLayer.hide();
                                        player.container.trigger('mejsagegate');
                                    } else {
                                        player.showError(t.options.agegateTextReject);
                                    }
                                })
                            )
                        )
                    )
                    .show()
                    .appendTo(layers);
            }

        });

    })(mejs.$, window._);

    define("features/mep-feature-agegate", function () {});

    //global MediaElementPlayer,mejs
    (function ($) {
        $.extend(mejs.MepDefaults, {});

        // Load ComScore.
        var comscore_base_url = (document.location.protocol === 'https:' ? 'https://sb' : 'http://b') + '.scorecardresearch.com';
        var comscore_script_url = comscore_base_url + '/beacon.js';
        console.log('loading comscore from ' + comscore_script_url);
        $.ajax({
            url: comscore_script_url,
            dataType: "script",
            async: false,
            timeout: 1000
        });

        $.extend(MediaElementPlayer.prototype, {
            fireComscoreCall: function (fields) {
                // Set guaranteed values
                fields.c1 = '1';
                fields.c2 = '6035334';
                fields.c7 = window.location.href;
                fields.c14 = this.deviceType();

                // Let's be careful to make sure ComScore's script loaded and has the 
                // function we need.
                console.log('Making call to ComScore; device type is ' + fields.c14);
                var comscore_call_url = comscore_base_url + '/p?';
                var comscore_call_fields = [];
                for (var prop in fields) {
                    comscore_call_fields.push(prop + '=' + fields[prop]);
                }
                comscore_call_url += comscore_call_fields.join('&');
                console.log('Call is to ' + comscore_call_url);
                $.ajax({
                    url: comscore_call_url,
                    async: true
                });
            },

            // Put the user's device type into one of ComScore's buckets.
            // Note that ComScore offers no good bucket for non-Android or -iOS mobile
            // devices, so they get stuck in the desktop category.
            deviceType: function () {
                if (typeof window.__deviceType === 'undefined') {
                    if (navigator.userAgent.match(/iPad/i)) {
                        window.__deviceType = 'tablet-ipad';
                    } else if ((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i))) {
                        window.__deviceType = 'mobile-iphone';
                    } else if (navigator.userAgent.match(/Android/i)) {
                        if (navigator.userAgent.match(/mobile/i)) {
                            window.__deviceType = 'mobile-android';
                        } else {
                            window.__deviceType = 'tablet-android';
                        }
                    } else {
                        window.__deviceType = 'desktop';
                    }
                }
                return window.__deviceType;
            }

        });
    })(mejs.$);

    define("features/mep-feature-comscore", function () {});

    (function ($) {
        $.extend(mejs.MepDefaults, {});

        $.extend(MediaElementPlayer.prototype, {

            // Core Google IMA properties.
            adDisplayContainer: '',
            videoContent: '',
            playerSelector: '',
            adPlaying: 'none', // What kind of ad is playing right now.
            adWidth: 0,
            adHeight: 0,
            bottomOffset: 40, // This is the number of pixels by which we force ads to be offset from the
            // video container top so as to leave room for the controls.
            maxFullSlotDuration: 14000, // This is how long we allow fullslot ads to play before stopping
            // them and playing the video.  In ms.
            maxOverlayDuration: 30000, // This is how long we show overlays, in ms.

            repositionNonLinearAd: function () {
                var t = this;

                // Reset the positioning of the ad if it is nonlinear; do nothing otherwise.
                if ((t.adPlaying === 'image') || (t.adPlaying === 'text') || (t.adPlaying === 'fullslot')) {
                    var isFullscreen = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
                    var adIframeSelector = t.playerSelector.find('.googleIMAAdContainer').find('iframe');
                    var newWidth, newHeight, containerWidth, containerHeight, newTop, newLeft;
                    newWidth = t.adWidth;
                    newHeight = t.adHeight;
                    containerHeight = t.playerSelector.height();
                    containerWidth = t.playerSelector.width();
                    if (t.adPlaying === 'fullslot') {
                        newHeight = newHeight + 10; // needed to make the close button fully visible
                        newTop = (containerHeight - newHeight) / 2; // center full slots vertically
                    } else {
                        newTop = (containerHeight - newHeight - t.bottomOffset);
                    }
                    newLeft = (containerWidth - newWidth) / 2;
                    adIframeSelector.width(newWidth).height(newHeight).css('top', newTop).css('left', newLeft);
                }
            },

            setUpGoogleIMAAdContainer: function () {

                var t = this;

                // Load Google SDK and set up the ad container when it's loaded.
                $.getScript('http://s0.2mdn.net/instream/html5/ima3.js', function () {

                    console.log("Google IMA script successfully responded");

                    // Find the player video element.
                    var playerId = t.id;
                    var playerElement = document.getElementById(playerId);
                    var playerSelectorString = 'div#' + playerId;
                    t.playerSelector = $(playerSelectorString);
                    var adOriginalWidth, adOriginalHeight;

                    // We assume the adContainer is the DOM id of the element that will house
                    // the ads.
                    var adContainer = document.createElement('div');
                    adContainer.className = 'googleIMAAdContainer';
                    t.videoContent = playerElement.children[0].children[0].children[0];
                    t.videoContent.parentNode.appendChild(adContainer);

                    t.adDisplayContainer =
                        new google.ima.AdDisplayContainer(adContainer);

                    t.googleAdContainerInitialized = false;

                    // Initialize the Google ad container when the player is clicked,
                    // if it is not already initialized.  Only do this once!  Reinitializing
                    // restarts the ad, and will result in the ad playing multiple times.
                    // Using jQuery here because it has robust click events.
                    t.playerSelector.on('click', function () {
                        if (t.googleAdContainerInitialized === false) {
                            // If the video is hidden (as on the iPhone), now it's time to show it
                            // and load it.
                            var videoSelector = t.playerSelector.find('video');
                            t.playerSelector.find('video').show();
                            t.videoContent.load();

                            console.log('initializing Google IMA container');
                            t.googleAdContainerInitialized = true;
                            t.adDisplayContainer.initialize();
                        }
                    });

                    // Entering fullscreen mode
                    t.playerSelector.bind('webkitfullscreenchange mozfullscreenchange fullscreenchange', function (e) {

                        console.log('fullscreenchange event');

                        var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
                        var event = state ? 'FullscreenOn' : 'FullscreenOff';

                        var adContainerSelector = t.playerSelector.find('.googleIMAAdContainer');

                        if (event === 'FullscreenOn') {
                            console.log('expanding IMA container and iframe');
                            adOriginalWidth = adContainerSelector.find('div').width();
                            adOriginalHeight = adContainerSelector.find('div').height();
                            adContainerSelector.find('div').css('width', window.screen.width).css('height', window.screen.height);
                            adContainerSelector.find('iframe').css('width', window.screen.width).css('height', window.screen.height);
                            console.log(adContainerSelector.find('div').width() + 'x' + adContainerSelector.find('div').height());
                        } else if (event === 'FullscreenOff') {
                            console.log('reducing IMA container and iframe');
                            adContainerSelector.find('div').css('width', adOriginalWidth).css('height', adOriginalHeight);
                            adContainerSelector.find('iframe').css('width', adOriginalWidth).css('height', adOriginalHeight);
                            console.log(adContainerSelector.find('div').width() + 'x' + adContainerSelector.find('div').height());
                        }

                        // Make sure the ad is in the right place after fullscreen is toggled.
                        t.repositionNonLinearAd();
                    });

                });
            },

            handleGoogleIMAResponse: function (response, params) {

                var t = this;

                var adsManager;
                var adsLoader;
                var intervalTimer, repositionIntervalTimer;

                console.log("Handling Google IMA response");

                // Reset the ad container (it could have been resized during playback of a previous ad).
                var adIframeSelector = t.playerSelector.find('.googleIMAAdContainer').find('iframe');
                adIframeSelector.width(t.playerSelector.width).height(t.playerSelector.height).css('top', 0).css('left', 0);

                // Process the Adtech response to get the necessary parameters to pass to
                // Google Ads.
                var channel = response.xml.documentElement.attributes[1].nodeValue;
                var publisherId = response.xml.documentElement.attributes[2].nodeValue;
                var pageURL = encodeURIComponent(window.location.href);
                var impressionTrackerURL = response.xml.firstChild.firstElementChild.firstChild.nodeValue;

                console.log('impressionTrackerURL: ' + impressionTrackerURL);

                var viewMode;

                function requestAds(params) {
                    console.log('requestAds');

                    var defaults = {
                        maxAdDuration: 3600000, // in ms; 3600000ms = 1h
                        adType: 'image_text', // returns any video ads, including TrueView
                        viewMode: 'FULLSCREEN', // set to fullscreen to allow full-slot ads to be returned
                        overlay: 0 // specifies that we'll take overlays of all sizes
                    };

                    var adParams = $.extend({}, defaults, params);

                    viewMode = adParams.viewMode;

                    // Create ads loader.
                    adsLoader = new google.ima.AdsLoader(t.adDisplayContainer);
                    // Listen and respond to ads loaded and error events.
                    adsLoader.addEventListener(
                        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
                        onAdsManagerLoaded,
                        false);
                    adsLoader.addEventListener(
                        google.ima.AdErrorEvent.Type.AD_ERROR,
                        onAdError,
                        false);

                    // Request video ads.
                    var adsRequest = new google.ima.AdsRequest();
                    adsRequest.adTagUrl = "http://googleads.g.doubleclick.net/pagead/ads?max_ad_duration=" + adParams.maxAdDuration + "&sdmax=" + adParams.maxAdDuration + "&ad_type=" + adParams.adType + "&overlay=" + adParams.overlay + "&channel=" + channel + "&client=" + publisherId + "&description_url=" + pageURL;

                    // FOR TESTING ONLY
                    //                var pageURL = encodeURIComponent(window.location.pathname);
                    //                var timestamp = (new Date()).toUTCString();
                    //                adsRequest.adTagUrl = "http://pubads.g.doubleclick.net/gampad/ads?sz=400x300&ad_type=image&iu=%2F6062%2Fiab_vast_samples&ciu_szs=300x250%2C728x90&impl=s&gdfp_req=1&env=vp&output=xml_vast2&unviewed_position_start=1&url=" + pageURL + '&correlator=' + timestamp + '&cust_params=iab_vast_samples%3Dlinear';

                    // Specify the linear and nonlinear slot sizes. This helps the SDK to
                    // select the correct creative if multiple are returned.
                    adsRequest.linearAdSlotWidth = t.media.clientWidth;
                    adsRequest.linearAdSlotHeight = t.media.clientHeight;

                    adsRequest.nonLinearAdSlotWidth = t.media.clientWidth;
                    adsRequest.nonLinearAdSlotHeight = t.media.clientHeight;

                    adsLoader.requestAds(adsRequest);
                }

                function onAdsManagerLoaded(adsManagerLoadedEvent) {
                    console.log('onAdsManagerLoaded');
                    // Get the ads manager.
                    adsManager = adsManagerLoadedEvent.getAdsManager(
                        t.videoContent); // should be set to the content video element

                    // Add listeners to the required events.
                    adsManager.addEventListener(
                        google.ima.AdErrorEvent.Type.AD_ERROR,
                        onAdError);
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
                        onContentPauseRequested);
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
                        onContentResumeRequested);
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
                        onAdEvent);

                    // Listen to any additional events, if necessary.
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.LOADED,
                        onAdEvent);
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.STARTED,
                        onAdEvent);
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.COMPLETE,
                        onAdEvent);
                    adsManager.addEventListener(
                        google.ima.AdEvent.Type.SKIPPED,
                        onAdEvent);

                    try {
                        // Initialize the ads manager. Ad rules playlist will start at this time. Size the ad manager
                        // according to whether we requested a full slot ad or not.
                        if (viewMode === 'FULLSCREEN') {
                            adsManager.init(t.media.clientWidth, t.media.clientHeight, google.ima.ViewMode.FULLSCREEN);
                        } else {
                            adsManager.init(t.media.clientWidth, t.media.clientHeight, google.ima.ViewMode.NORMAL);
                        }
                        // Call play to start showing the ad. Single video and overlay ads will
                        // start at this time; the call will be ignored for ad rules.
                        adsManager.start();
                        console.log('Google ads manager started');

                    } catch (adError) {
                        // An error may be thrown if there was a problem with the VAST response.
                        console.log('Google ads manager did not start');
                    }
                }

                function resetAdData() {
                    t.adPlaying = 'none';
                    t.adWidth = 0;
                    t.adHeight = 0;
                }

                function createPixelTracker() {
                    console.log('firing Google impression tracker: ' + impressionTrackerURL);
                    var i = new Image();
                    i.src = impressionTrackerURL;
                    i.style.display = 'none';
                    t.$media[0].parentNode.children[1].appendChild(i);
                }

                function setupTimeRail(duration) {
                    var remainingTime = duration; // in seconds
                    t.durationD.html(mejs.Utility.secondsToTimeCode(duration, false, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));

                    //t.durationD.html = '0';
                    intervalTimer = setInterval(function () {
                            // Set the time rail to show the latest time and progress info.
                            console.log('setting time');
                            remainingTime = remainingTime - 0.3;
                            var currentTime = duration - remainingTime;
                            var newWidth = Math.round(t.total.width() * currentTime / duration);
                            var handlePos = newWidth - Math.round(t.handle.outerWidth(true) / 2);
                            t.current.width(newWidth);
                            t.handle.css('left', handlePos);

                            t.currenttime.html(mejs.Utility.secondsToTimeCode(currentTime, false, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));

                            // Set the volume again, in case it was changed since the last poll.
                            if (t.$media[0].muted) {
                                adsManager.setVolume(0);
                            } else {
                                adsManager.setVolume(t.$media[0].volume);
                            }

                            // Set this again in case it gets reset elsewhere.  Not ideal, but haven't 
                            // been able to track down the code that's setting this to the publisher video's
                            // length when playing a midroll full-slot ad.
                            t.durationD.html(mejs.Utility.secondsToTimeCode(duration, false, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25));
                        },
                        300); // every 300ms
                }

                function onAdEvent(adEvent) {
                    console.log('onAdEvent');
                    // Retrieve the ad from the event. Some events (e.g. ALL_ADS_COMPLETED)
                    // don't have ad object associated.
                    var ad = adEvent.getAd();
                    switch (adEvent.type) {
                    case google.ima.AdEvent.Type.LOADED:
                        // This is the first event sent for an ad.

                        console.log('loading ad event');

                        t.adWidth = ad.getWidth();
                        t.adHeight = ad.getHeight();

                        console.log('dimensions: ' + t.adWidth + 'x' + t.adHeight);

                        if (ad.isLinear()) {
                            t.adPlaying = 'video';
                        } else {
                            if ((t.adHeight === 1) && (t.adWidth === 1)) {
                                t.adPlaying = 'text';
                            } else if (t.adHeight > 150) {
                                t.adPlaying = 'fullslot';
                            } else {
                                t.adPlaying = 'image';
                            }
                        }
                        t.googleAdType = t.adPlaying;

                        console.log('ad type: ' + t.adPlaying);

                        // See if we are currently fullscreen.
                        if (t.isWebkitFullscreen) {
                            // Switch the video out of fullscreen, switch the ad into it.
                            t.media.webkitExitFullscreen();
                            // Timeout needed to make sure the video has exitted fullscreen before the ad enters it.
                            // Otherwise bad things happen with the display.
                            setTimeout(function () {
                                t.media.parentNode.children[1].children[0].children[0].children[0].webkitEnterFullscreen();
                            }, 1500);
                        }

                        if (t.$media[0].muted) {
                            adsManager.setVolume(0);
                        } else {
                            adsManager.setVolume(t.$media[0].volume);
                        }
                        break;
                    case google.ima.AdEvent.Type.STARTED:
                        // This event indicates the ad has started - the video player
                        // can adjust the UI, for example display a pause button and
                        // remaining time.

                        console.log('start of ad event');
                        var duration;

                        // Create a pixel tracker.
                        createPixelTracker();

                        if (t.adPlaying === 'video') {

                            console.log("Google video ad started");

                            // Control bar masks portion of 'skip' button on iPad;
                            // shrink the IMA iframe to create some room.
                            if (mejs.MediaFeatures.isiPad) {
                                var newHeight = adIframeSelector.height() - t.bottomOffset;
                                adIframeSelector.height(newHeight);
                            }

                            duration = ad.getDuration();
                            setupTimeRail(duration);
                        } else if ((t.adPlaying === 'image') || (t.adPlaying === 'text')) {
                            console.log("Google nonlinear ad displayed");

                            // Hide the poster
                            t.playerSelector.find('.mejs-poster').hide();

                            // Give the nonlinear ad a z-index higher than the play/pause layer
                            adIframeSelector.css('z-index', 1000);

                            // Determine what the width and height of the ad is, if it is a text ad, because
                            // Google will not tell us through the API.
                            // Text ads are 480x63 if the video is wide enough to accommodate 480 width; they will
                            // go as low as 320x63 if necessary.
                            if (t.adType === 'text') {
                                t.adHeight = 63;
                                var containerWidth = t.media.clientWidth;
                                if (containerWidth >= 480) {
                                    t.adWidth = 480;
                                } else if (containerWidth < 320) {
                                    t.adWidth = 320;
                                } else {
                                    t.adWidth = containerWidth;
                                }
                            }

                            // Give the ad the correct position and size so it doesn't obscure controls.
                            t.repositionNonLinearAd();

                            repositionIntervalTimer = setInterval(function () {
                                t.repositionNonLinearAd();
                            }, 1000);

                            setTimeout(function () {
                                adsManager.stop();
                                onContentResumeRequested();
                            }, t.maxOverlayDuration);

                            t.videoContent.play();
                        } else if (t.adPlaying === 'fullslot') {
                            // Give the ad the correct position and size so it doesn't obscure controls.
                            t.repositionNonLinearAd();

                            repositionIntervalTimer = setInterval(function () {
                                t.repositionNonLinearAd();
                            }, 1000);

                            onContentPauseRequested();

                            setTimeout(function () {
                                adsManager.stop();
                                onContentResumeRequested();
                            }, t.maxFullSlotDuration);

                            // Hide the poster
                            t.playerSelector.find('.mejs-poster').css({
                                'background-color': '#aaaaaa'
                            }).css('background-image', 'none').show();

                            // Update the time rail.
                            duration = t.maxFullSlotDuration / 1000;
                            setupTimeRail(duration);
                        }
                        break;
                    case google.ima.AdEvent.Type.COMPLETE:
                        // This event indicates the ad has finished - the video player
                        // can perform appropriate UI actions, such as removing the timer for
                        // remaining time detection.

                        console.log('end of ad event');

                        if (t.isWebkitFullscreen) {
                            // Switch the video out of fullscreen, switch the ad into it.
                            t.media.parentNode.children[1].children[0].children[0].children[0].webkitExitFullscreen();

                            // Timeout needed to make sure the video has exitted fullscreen before the ad enters it.
                            // Otherwise bad things happen with the display.
                            setTimeout(function () {
                                t.media.webkitEnterFullscreen();
                            }, 2000);
                        }
                        break;
                    case google.ima.AdEvent.Type.SKIPPED:

                        console.log('ad skipped event');
                        t.videoContent.play();
                    }
                }

                function onAdError(adErrorEvent) {
                    console.log('onAdError');
                    // Handle the error logging.
                    console.log(adErrorEvent.getError().getMessage());
                    console.log(adErrorEvent.getError().getType());
                    console.log(adErrorEvent.getError().getInnerError());
                    console.log(adErrorEvent.getError().getVastErrorCode());
                    if ((typeof adsManager !== 'undefined') && (typeof adsManager.destroy !== 'undefined')) {
                        adsManager.destroy();
                    }
                    t.adsDataIsLoading = false;
                    t.vastAdTagIsLoaded = false;
                    t.vastAdTagIsLoading = false;
                    t.videoContent.play();
                }

                function onContentPauseRequested() {
                    console.log('onContentPauseRequested');
                    t.videoContent.pause();

                    t.media.isAd = true;
                    t.media.isGoogle = true;
                    t.vastAdTagIsLoaded = true;
                    t.vastAdTagIsLoading = false;
                    t.adsDataIsLoading = false;

                    // update player controls
                    t.setupPlayerControls();
                    t.adsPrerollStarted();

                    // Make sure we aren't showing the play overlay button.
                    var playOverlay = t.playerSelector.find('div.mejs-overlay-customplay');
                    playOverlay.css('background-color', 'rgba(0,0,0,0)');
                    playOverlay.css('z-index', 0);
                    playOverlay.find('.mejs-overlay-customplay-button,.mejs-title').hide();
                    t.playerSelector.find('div.googleIMAAdContainer').css('z-index', 1000).css('position', 'absolute').css('top', 0).css('left', 0);

                    // Hide the main video cuepoints.
                    t.playerSelector.find('.mejs-time-cuepoint').hide();
                    t.playerSelector.find('.mejs-time-loaded').hide();
                }

                function onContentResumeRequested() {
                    console.log('onContentResumeRequested');

                    t.media.isAd = false;
                    t.media.isGoogle = false;
                    t.vastAdTagIsLoaded = false;
                    t.vastAdTagIsLoading = false;
                    t.adsDataIsLoading = false;

                    // Remove ad-related timers.
                    clearInterval(intervalTimer);
                    clearInterval(repositionIntervalTimer);

                    t.videoContent.play();

                    // update player controls
                    t.setupPlayerControls();
                    t.playerSelector.find('div.googleIMAAdContainer').css('z-index', -1);

                    // Show the main video cuepoints.
                    t.playerSelector.find('.mejs-time-cuepoint').show();
                    t.playerSelector.find('.mejs-time-loaded').show();

                    resetAdData();
                }

                resetAdData();

                //Kick off the ads request
                requestAds(params);
            }
        });

    })(mejs.$);

    define("features/mep-feature-googleima", function () {});

    //global MediaElementPlayer,mejs
    (function ($) {
        $.extend(mejs.MepDefaults, {});

        $.extend(MediaElementPlayer.prototype, {
            buildcustomization: function (player, controls, layers, media) {
                var t = this;
                t.customizeControls(player, controls);
                t.bigplayLayer(player, layers);
                player.container.trigger('video-change', {
                    title: player.options.title
                });
                player.userHasClickedToPlay = false;
                //player.setControlsSize();
            },
            customizeControls: function (player, controls) {
                var t = player;
                //Add the progress container control
                $('<div>')
                    .addClass('mejs-progress')
                    .insertAfter(controls.find('.mejs-playpause-button'));
                //insert time and time-rail into the progress container
                var mejs_progress = controls.find('.mejs-progress');
                $('.mejs-time-rail', controls).appendTo(mejs_progress);
                $('.mejs-time', controls).appendTo(mejs_progress);

                //Monkey patch to adapt controls resizing the new progress container
                player.setControlsSize = function () {
                    var residual = function ($el) {
                            return Math.ceil($el.outerWidth(true) - parseInt($el.css('width'), 10));
                        },
                        t = player,
                        usedWidth = 0,
                        railWidth = 0,
                        rail = t.controls.find('.mejs-time-rail'),
                        progress = t.controls.find('.mejs-progress'),
                        total = t.controls.find('.mejs-time-total'),
                        current = t.controls.find('.mejs-time-current'),
                        loaded = t.controls.find('.mejs-time-loaded'),
                        time = t.controls.find('.mejs-time'),
                        others = progress.siblings();


                    // allow the size to come from custom CSS
                    if (t.options && !t.options.autosizeProgress) {
                        // Also, frontends devs can be more flexible
                        // due the opportunity of absolute positioning.
                        railWidth = parseInt(rail.css('width'), 10);
                    }

                    // attempt to autosize
                    if (railWidth === 0 || !railWidth) {

                        // find the size of all the other controls besides the rail
                        others.each(function () {
                            var $this = $(this);
                            if ($this.css('position') !== 'absolute' && $this.is(':visible')) {
                                usedWidth += $(this).outerWidth(true);
                            }
                        });
                        usedWidth += time.outerWidth(true);
                        usedWidth += residual(progress);
                        usedWidth += residual(controls);
                        usedWidth += 2;

                        // fit the rail into the remaining space
                        railWidth = controls.outerWidth(true) - usedWidth - residual(rail);
                        railWidth -= 2;
                    }

                    // outer area
                    rail.width(railWidth);
                    // dark space
                    total.width(railWidth - residual(total));

                    if (t.setProgressRail) {
                        t.setProgressRail();
                    }
                    if (t.setCurrentRail) {
                        t.setCurrentRail();
                    }
                };
            },
            bigplayLayer: function (player, layers) {
                var t = player;
                layers.find('.mejs-overlay-play').remove();

                // replace bigplay with a customized bigplay
                var bigPlay =
                    $('<div class="mejs-overlay mejs-layer mejs-overlay-customplay">' +
                        '<div class="mejs-title"></div>' +
                        '<div class="mejs-overlay-customplay-button"></div>' +
                        '</div>')
                    .appendTo(layers)

                .on('click', $.proxy(function () {
                    if (t.media.isAd && !t.media.paused) {
                        // ad clicked
                        t.container.trigger('mejsprerolladsclicked');
                        return true;
                    }

                    if (t.options.clickToPlayPause) {
                        console.log('clickToPlayPause');
                        console.log('paused? ' + t.media.paused);

                        // The first time the user clicks to play, 
                        // try an ad before playing.
                        if (!t.userHasClickedToPlay) {
                            console.log('first click, play an ad');
                            t.userHasClickedToPlay = true;
                            t.vastLoadAdTagInfo(
                                t.options.vastAdTagUrlTemplate,
                                function (ads) {
                                    console.log('cuepoints: successful ad response');
                                    var creative = ads[0].creatives[0],
                                        mediaFile = creative.mediaFiles[0];
                                    t.vastTracker = creative.makeTracker();
                                    t.vastTracker.on('clickthrough', function (url) {
                                        document.location.href = url;
                                    });
                                    t.adsStartPreroll(mediaFile);
                                },
                                function (code) {
                                    if (t.media.paused) {
                                        t.media.play();
                                    }
                                    console.log('play/pause: error loading VAST: ' + code);
                                }
                            );

                        } else {

                            if (t.media.paused) {
                                console.log('play it');
                                t.media.play();
                            } else {
                                console.log('pause it');
                                t.media.pause();
                            }
                        }
                    }
                }, this));
                var hideBigPlay = function () {
                    console.log('hiding play controls');
                    bigPlay.css('background-color', 'rgba(0,0,0,0)');
                    bigPlay.css('z-index', '0');
                    bigPlay.find('.mejs-overlay-customplay-button,.mejs-title').hide();

                    // If we are in an ad, make sure the ad clickthrough layer is shown.
                    if (this.media.isAd) {
                        this.adsLayer.show();
                    }
                };
                var showBigPlay = function () {
                    console.log('showing play controls');
                    // Deal with situations where iPad tries to show play overlay at strange
                    // times.  Ideally, we should track down why this is happening instead.
                    // Wrapped in a timeout to give time for the media to pause before 
                    // checking to see if it is paused.
                    setTimeout(function () {}, 100);
                    if ((!this.media.paused) || (this.media.isGoogle)) {
                        return;
                    }

                    bigPlay.css('background-color', 'rgba(0,0,0,0.3)');
                    bigPlay.css('z-index', '985');
                    bigPlay.find('.mejs-overlay-customplay-button,.mejs-title').show();

                    // We could be here because the browser auto-paused during an ad due to
                    // opening a new tab.  If so, make sure the ad clickthrough layer is hidden.
                    this.adsLayer.hide();
                };
                this.$media.on('play', $.proxy(hideBigPlay, this));
                this.$media.one('stalled', $.proxy(showBigPlay, this));
                this.$media.on('pause', $.proxy(showBigPlay, this));
                this.container.on('video-change',
                    $.proxy(
                        function (ev, data) {
                            this.bigPlayLegend = data.title;
                            bigPlay.find('.mejs-title').html(this.bigPlayLegend);
                        },
                        this
                    )
                );
            },
        });

    })(mejs.$);

    define("features/mep-feature-customization", function () {});

    // VAST ads plugin
    // Sponsored by Minoto Video

    // 2013/02/01       0.5     research
    // 2013/02/09       1.5     build loading mechanism
    // 2013/02/10       2.5     events to play preroll, skip function, start/end calls, \
    // 2013/02/11       2       click events
    // ----
    // 2013/02/23       3.5     split into a generic pre-roll plugin


    (function ($) {
        // on time insert into head
        $('head').append($('<style>' +
            '.mejs-ads a {' +
            '   display: block; ' +
            '   position: absolute;' +
            '   right: 0;' +
            '   top: 0;' +
            '   width: 100%; ' +
            '   height: 100%; ' +
            '   display: block; ' +
            '   z-index: 100000; ' +
            '}' +
            '.mejs-ads .mejs-ads-skip-block {' +
            '   display: block; ' +
            '   position: absolute;' +
            '   right: 0;' +
            '   top: 0;' +
            '   padding: 10px; ' +
            '   background: #000; ' +
            '   background: rgba(0,0,0,0.5); ' +
            '   color: #fff; ' +
            '}' +
            '.mejs-ads .mejs-ads-skip-button {' +
            '   cursor: pointer; ' +
            '}' +
            '.mejs-ads .mejs-ads-skip-button:hover {' +
            '   text-decoration: underline; ' +
            '}' +
            '</style>'));


        $.extend(mejs.MepDefaults, {
            // URL to a media file
            adsPrerollMediaUrl: '',

            // URL for lcicking ad
            adsPrerollAdUrl: '',

            // if true, allows user to skip the pre-roll ad
            adsPrerollAdEnableSkip: false,

            // if adsPrerollAdEnableSkip=true and this is a positive number, it will only allow skipping after the time has elasped
            adsPrerollAdSkipSeconds: -1,

            // if true, player controls are disabled until preroll ad completed
            adsDisableControls: false,

            // if true, player seeking is disabled until preroll ad completed
            adsDisableSeeking: true,

            // time in seconds between ads (default is 7 min)
            cuePointInterval: 420,

            // min time in seconds that shoud pass after an ad
            adInterval: -1
        });

        $.extend(MediaElementPlayer.prototype, {

            // allows other plugins to all this one
            adsLoaded: false,

            // prevents playback in until async ad data is ready (e.g. VAST)
            adsDataIsLoading: false,

            // stores the main media URL when an ad is playing
            adsCurrentMediaUrl: '',
            adsCurrentMediaTitle: '',
            adsCurrentMediaDuration: 0,

            // true when the user clicks play for the first time, or if autoplay is set
            adsPlayerHasStarted: false,

            // timestamp of the last time an ad was played
            lastPlayedAdTime: 0,

            buildads: function (player, controls, layers, media) {
                console.log('buildads');
                var t = this;

                if (t.adsLoaded) {
                    return;
                } else {
                    t.adsLoaded = true;
                }

                //Add seek bar blocker to disable seek control until the preroll is done
                if (t.options.adsDisableSeeking) {
                    if (!controls.find('.mejs-time-rail.blocker').length) {
                        $('<div class="mejs-time-rail blocker" style="position:absolute;z-index:1;"></div>')
                            .prependTo(controls)
                            .hide()
                            .click(function (e) {
                                e.preventDefault();
                            });
                    }
                }

                //Add the ad button tag to the controls
                var adButton = $(
                        '<div class="mejs-ad-title">' +
                        '<span>' +
                        'Advertisement' +
                        '</span>' +
                        '</div>')
                    .prependTo(controls)
                    .hide()
                    .click(function (e) {
                        e.preventDefault();
                    });

                // add layer for ad links and skipping
                player.adsLayer =
                    $('<div class="mejs-layer mejs-overlay mejs-ads">' +
                        '<a href="#" target="_blank">&nbsp;</a>' +
                        '<div class="mejs-ads-skip-block">' +
                        '<span class="mejs-ads-skip-message"></span>' +
                        '<span class="mejs-ads-skip-button">Skip Ad &raquo;</span>' +
                        '</div>' +
                        '</div>')
                    .appendTo(layers)
                    .hide();

                player.adsSkipBlock = player.adsLayer.find('.mejs-ads-skip-block').hide();
                player.adsSkipMessage = player.adsLayer.find('.mejs-ads-skip-message').hide();

                player.adsSkipButton = player.adsLayer.find('.mejs-ads-skip-button')
                    .on('click', $.proxy(t.adsSkipClick, t));

                // create proxies (only needed for events we want to remove later)
                t.adsMediaTryingToStartProxy = $.proxy(t.adsMediaTryingToStart, t);
                t.adsPrerollStartedProxy = $.proxy(t.adsPrerollStarted, t);
                t.adsPrerollMetaProxy = $.proxy(t.adsPrerollMeta, t);
                t.adsPrerollUpdateProxy = $.proxy(t.adsPrerollUpdate, t);
                t.adsPrerollEndedProxy = $.proxy(t.adsPrerollEnded, t);
                t.adsPrerollErrorProxy = $.proxy(t.adsPrerollError, t);

                // load Google IMA and set up the ad container
                t.setUpGoogleIMAAdContainer();

                // set up unique user ID in local storage, or retrieve it if we already have one
                if (window.localStorage) {
                    var storage = window.localStorage;
                    t.userID = storage.getItem('userID');
                    if (!t.userID) {
                        t.userID = Math.round(Math.random() * 1000000000);
                        storage.setItem('userID', t.userID);
                    }
                }
            },

            adsMediaTryingToStart: function () {
                console.log('adsMediaTryingToStart');
                var t = this;

                // make sure to pause until the ad data is loaded
                if (t.adsDataIsLoading && !t.media.paused) {
                    t.media.pause();
                }

                t.adsPlayerHasStarted = true;
                t.container.trigger('boltadstarted');
            },

            adsStartPreroll: function (mediaFile) {
                var t = this;

                console.log('adsStartPreroll', 'mediaFile', mediaFile);

                t.media.addEventListener('loadedmetadata', t.adsPrerollMetaProxy);
                t.media.addEventListener('playing', t.adsPrerollStartedProxy);
                t.media.addEventListener('ended', t.adsPrerollEndedProxy);
                t.media.addEventListener('error', t.adsPrerollErrorProxy);
                t.media.addEventListener('timeupdate', t.adsPrerollUpdateProxy);

                // change URLs to the preroll ad
                t.adsCurrentMediaUrl = t.media.src;
                t.adsCurrentMediaTitle = t.options.title;
                t.adsCurrentMediaDuration = t.media.duration;
                t.adsCurrentMediaTime = t.media.currentTime;

                // indicates current media is an ad
                t.media.isAd = true;

                // update player controls
                t.setupPlayerControls();

                t.media.setSrc(mediaFile.fileURL);
                t.container
                    .trigger('video-change', {
                        src: t.media.src,
                        title: t.adsCurrentMediaTitle
                    });
                t.media.load();
                t.container.trigger('boltrequestadspot');
                t.media.play();

                t.container.trigger('mejsprerollstart');
            },

            setupPlayerControls: function () {
                var t = this;

                if (t.media.isAd) {
                    // Hide controls for the Video
                    t.controls.find('.mejs-playpause-button').hide();
                    t.controls.find('.mejs-playwire-button').hide();
                    t.controls.find('.mejs-qualityselector-button').hide();
                    t.controls.find('.mejs-share-button').hide();

                    if (t.options.playlist && t.options.playlist.length) {
                        t.controls.find('.mejs-playlist-button').hide();
                    }
                    if (t.watermarkLayer && t.watermarkLayer.length) {
                        t.watermarkLayer.hide();
                    }

                    // Show Ad specific controls
                    t.controls.find('.mejs-ad-title').show();

                    if (t.options.adsDisableSeeking) {
                        t.controls.find('.mejs-time-rail.blocker').show();
                    }
                } else {
                    // Show controls for the Video
                    t.controls.find('.mejs-playpause-button').show();
                    t.controls.find('.mejs-playwire-button').show();
                    t.controls.find('.mejs-qualityselector-button').show();
                    t.controls.find('.mejs-share-button').show();

                    if (t.options.playlist && t.options.playlist.length) {
                        t.controls.find('.mejs-playlist-button').show();
                    }
                    if (t.watermarkLayer && t.watermarkLayer.length) {
                        t.watermarkLayer.show();
                    }

                    // Hide Ad specific controls
                    t.controls.find('.mejs-ad-title').hide();

                    if (t.options.adsDisableSeeking) {
                        t.controls.find('.mejs-time-rail.blocker').hide();
                    }
                }

                t.setControlsSize();
            },

            canPlayAd: function () {
                var t = this,
                    currentTime = new Date().getTime();

                // if it's the first time an ad is played
                if (!t.lastPlayedAdTime) {
                    return true;
                }

                // if more than the min time between ads has passed
                if ((currentTime - t.lastPlayedAdTime) > t.options.adInterval * 1000) {
                    return true;
                }

                return false;
            },

            adsPrerollMeta: function () {
                var t = this,
                    newDuration = 0;

                console.log('loadedmetadata', t.media.duration, t.adsCurrentMediaDuration);

                // if duration has been set, show that
                if (t.options.duration > 0) {
                    newDuration = t.options.duration;
                } else if (!isNaN(t.adsCurrentMediaDuration)) {
                    newDuration = t.adsCurrentMediaDuration;
                }

                setTimeout(function () {
                    t.controls.find('.mejs-duration').html(
                        mejs.Utility.secondsToTimeCode(newDuration, t.options.alwaysShowHours || newDuration > 3600, t.options.showTimecodeFrameCount, t.options.framesPerSecond || 25)
                    );
                }, 250);
            },

            adsPrerollStarted: function () {
                console.log('adsPrerollStarted');

                var t = this;

                t.media.removeEventListener('playing', t.adsPrerollStartedProxy);

                // turn off controls until the preroll is done
                if (t.options.adsDisableControls) {
                    t.disableControls();
                    t.hideControls();
                }

                // Enable clicking through on VAST ad, and track an impression
                if (typeof t.vastTracker !== 'undefined') {
                    t.adsLayer.show();
                    t.vastTracker.load();
                }

                // HACK:  Skipping the event model, which is failing to trigger so that adsPrerollAdUrl
                // never gets defined, and instead grabbing this out of the ad creative if it exists.
                if ((t.options.adsPrerollAdUrl === '') && (typeof t.vastTracker !== 'undefined') && (typeof t.vastTracker.creative !== 'undefined') && (typeof t.vastTracker.creative.videoClickThroughURLTemplate !== 'undefined')) {
                    t.options.adsPrerollAdUrl = t.vastTracker.creative.videoClickThroughURLTemplate;
                }

                if (t.options.adsPrerollAdUrl !== '') {
                    t.adsLayer.find('a').attr('href', t.options.adsPrerollAdUrl).on('click', function () {
                        t.vastTracker.click();
                    });
                }

                // Tell ComScore we hit an ad.
                var c5;
                if (t.cuepointsState.visited.length > 1) {
                    c5 = '11';
                } else {
                    c5 = '09';
                }
                t.fireComscoreCall({
                    'c5': c5
                });

                // possibly allow the skip button to work
                if (t.options.adsPrerollAdEnableSkip) {
                    t.adsSkipBlock.show();

                    if (t.options.adsPrerollAdSkipSeconds > 0) {
                        t.adsSkipMessage.html('Skip in ' + t.options.adsPrerollAdSkipSeconds.toString() + ' seconds.').show();
                        t.adsSkipButton.hide();
                    } else {
                        t.adsSkipMessage.hide();
                        t.adsSkipButton.show();
                    }
                } else {
                    t.adsSkipBlock.hide();
                }

                // send click events
                t.container.trigger('mejsprerollstarted');
            },

            adsPrerollUpdate: function () {
                console.log('adsPrerollUpdate');

                var t = this;

                // Track progress through ad; allows quartile and completion tracking.
                t.vastTracker.setProgress(t.media.currentTime);

                if (t.options.adsPrerollAdEnableSkip && t.options.adsPrerollAdSkipSeconds > 0) {
                    // update message
                    if (t.media.currentTime > t.options.adsPrerollAdSkipSeconds) {
                        t.adsSkipButton.show();
                        t.adsSkipMessage.hide();
                    } else {
                        t.adsSkipMessage.html('Skip in ' + Math.round(t.options.adsPrerollAdSkipSeconds - t.media.currentTime).toString() + ' seconds.');
                    }

                }

                t.container.trigger('mejsprerolltimeupdate');
            },

            adsPrerollError: function () {
                console.log('adsPrerollError');

                var t = this;

                t.container.trigger('mejsprerollerror');

            },

            adsPrerollEnded: function () {
                console.log('adsPrerollEnded');

                var t = this;

                // store the timestamp of the last played ad
                t.lastPlayedAdTime = new Date().getTime();

                t.container.trigger('mejsprerollended');

                t.adRestoreMainMedia();
            },

            adRestoreMainMedia: function () {

                console.log('adRestoreMainMedia', this.adsCurrentMediaUrl);

                var t = this;

                // indicates current media is not an ad
                t.media.isAd = false;

                // update player controls
                t.setupPlayerControls();

                t.media.setSrc(t.adsCurrentMediaUrl);
                t.container
                    .trigger('video-change', {
                        src: t.media.src,
                        title: t.adsCurrentMediaTitle
                    });
                setTimeout(function () {
                    t.media.load();
                    t.media.play();
                }, 10);

                t.enableControls();
                t.showControls();

                t.adsLayer.hide();

                t.media.removeEventListener('ended', t.adsPrerollEndedProxy);
                t.media.removeEventListener('error', t.adsPrerollErrorProxy);
                t.media.removeEventListener('loadedmetadata', t.adsPrerollMetaProxy);
                t.media.removeEventListener('timeupdate', t.adsPrerollUpdateProxy);

                t.container.trigger('mejsprerollmainstarted');
                t.container.trigger('boltadcomplete');
            },

            adsSkipClick: function () {
                console.log('adsSkipClick');
                var t = this;

                t.container.trigger('mejsprerollskipclicked');
                t.container.trigger('mejsprerollended');

                t.adRestoreMainMedia();
            },

            // fires off fake XHR requests
            adsLoadUrl: function (url) {
                console.log('adsLoadUrl', url);

                var img = new Image(),
                    rnd = Math.round(Math.random() * 100000);

                img.src = url + ((url.indexOf('?') > 0) ? '&' : '?') + 'random' + rnd + '=' + rnd;
                img.loaded = function () {
                    img = null;
                };
            }

        });

    })(mejs.$);

    define("features/mep-feature-ads", function () {});

    // VAST ads plugin
    // Sponsored by Minoto Video

    (function ($, _) {

        $.extend(mejs.MepDefaults, {
            // URL to vast data: 'http://minotovideo.com/sites/minotovideo.com/files/upload/eday_vast_tag.xml'
            vastAdTagUrlTemplate: '',
            vastAdTagUrl: ''
        });

        $.extend(MediaElementPlayer.prototype, {
            buildvast: function (player, controls, layers, media) {
                console.log('build VAST', 'loaded');
            },

            vastResetAdTagUrl: function (template) {
                var t = this;
                //expand the vast url template, and exclude any campaigns we've already
                //tried.

                template += ';acao=*';
                if (window.__ad_ids.length > 0) {
                    template = template + ';key=' + window.__ad_ids.join('+');
                }
                return template;
            },
            vastLoadAdTagInfo: function (tag, success, error) {
                console.log('loading vast ad data');

                var t = this,
                    url = t.vastResetAdTagUrl(tag),
                    attempts = 0,
                    max_attempts = 3,
                    error_code;
                t.adsDataIsLoading = true;
                t.vastAdTagIsLoading = true;

                var ERROR_CODES = {
                    NO_RESPONSE: 1,
                    NO_VALID_ADS: 2
                };

                // Clean up the list of rejected ad ids to eliminate dupes.
                window.__ad_ids.sort();
                for (var i = 1; i < window.__ad_ids.length; i++) {
                    if (window.__ad_ids[i] === window.__ad_ids[i - 1]) {
                        window.__ad_ids.splice(i--, 1);
                    }
                }

                // Get a VAST response.  If we don't get an ad back, try again, up
                // to our max_attempts.

                function handleVASTResponse(response) {
                    if ((!response) || (response.ads.length === 0)) {
                        error_code = ERROR_CODES.NO_RESPONSE;
                        console.log('Attempt #' + attempts + ' failed; error code ' + error_code);
                        if (attempts < max_attempts) {
                            attempts++;
                            console.log('Trying again');
                            url = t.vastResetAdTagUrl(tag);
                            DMVAST.client.get(
                                url,
                                t,
                                function (response) {
                                    handleVASTResponse(response);
                                }
                            );
                        } else {
                            console.log('Too many attempts; giving up');
                            t.vastAdTagIsLoaded = false;
                            t.vastAdTagIsLoading = false;
                            t.adsDataIsLoading = false;
                            error(error_code, ERROR_CODES, {
                                url: url,
                                response: response
                            });
                            return;
                        }
                    }
                    var ads = '';
                    if (response) {
                        ads = _(response.ads).reduce(
                            function (result, ad) {
                                var creatives = _(ad.creatives).reduce(
                                    function (result, creative) {
                                        var mediaFiles;
                                        if (creative.type === 'linear') {
                                            mediaFiles = _(creative.mediaFiles)
                                                .reduce(function (result, mediaFile) {
                                                    if ((mejs.MediaFeatures.isiPhone) || (mejs.MediaFeatures.isiPad)) {
                                                        if (/video\/mp4/.test(mediaFile.mimeType)) {
                                                            console.log('mp4 match');
                                                            result.push(mediaFile);
                                                        }
                                                    } else if ((mejs.MediaFeatures.isAndroid)) {
                                                        if (/video\/(mp4|webm)/.test(mediaFile.mimeType)) {
                                                            result.push(mediaFile);
                                                        }
                                                    } else {
                                                        if (/video\/(mp4|ogg|webm)/.test(mediaFile.mimeType)) {
                                                            result.push(mediaFile);
                                                        }
                                                    }
                                                    return result;
                                                }, []);
                                            if (!_.isEmpty(mediaFiles)) {
                                                result.push({
                                                    mediaFiles: mediaFiles,
                                                    makeTracker: function () {
                                                        return new DMVAST.tracker(ad, creative);
                                                    }
                                                });
                                            }
                                        }
                                        return result;
                                    }, []);
                                if (!_.isEmpty(creatives)) {
                                    result.push({
                                        creatives: creatives
                                    });
                                }
                                return result;
                            }, []
                        );
                    }
                    if (_.isEmpty(ads)) {
                        error_code = ERROR_CODES.NO_VALID_ADS;
                        console.log('Attempt #' + attempts + ' failed; error code ' + error_code);
                        if (attempts < max_attempts) {
                            attempts++;
                            console.log('Trying again');
                            url = t.vastResetAdTagUrl(tag);
                            DMVAST.client.get(
                                url,
                                t,
                                function (response) {
                                    handleVASTResponse(response);
                                }
                            );
                        } else {
                            console.log('Too many attempts; giving up');
                            t.vastAdTagIsLoaded = false;
                            t.vastAdTagIsLoading = false;
                            t.adsDataIsLoading = false;
                            error(error_code, ERROR_CODES, {
                                url: url,
                                response: response
                            });
                            t.play();
                        }
                    } else {
                        console.log('Successful ad response!');
                        t.vastAdTagIsLoaded = true;
                        t.vastAdTagIsLoading = false;
                        t.adsDataIsLoading = false;
                        success(ads, {
                            url: url,
                            response: response,
                            ads: ads
                        });
                    }
                }

                attempts++;
                DMVAST.client.get(
                    url,
                    t,
                    function (response) {
                        if ((typeof response !== 'undefined') && (response !== null) && (response.hasOwnProperty('xml'))) {
                            var params = {};
                            // Here are the rules for Google ads:
                            // 1. Once we've picked our params, stick with them.  Some ad types will cause problems
                            //    for others played during the same video.  (It's okay to swap between 'video' and
                            //    'standardvideo', or 'text' and 'image'.)
                            // 2. iPhones never get Trueview ads (i.e., no 'video'), and their videos have have max duration
                            //    of 30 seconds.
                            // 3. Midrolls never get Trueview ads, and their videos have max duration of 30 seconds.
                            // 4. iPhones don't play any midrolls (we can't yet support them elegantly).
                            var isMidroll = ((typeof t.cuepointsState !== 'undefined') &&
                                (t.cuepointsState.visited.length > 1)) ? true : false;

                            if (isMidroll) {
                                if (mejs.MediaFeatures.isiPhone) {
                                    t.vastAdTagIsLoaded = false;
                                    t.vastAdTagIsLoading = false;
                                    t.adsDataIsLoading = false;
                                    error(2, ERROR_CODES, {
                                        url: url,
                                        response: response
                                    });
                                    return;
                                } else {
                                    params.adType = t.googleAdType.replace('video', 'standardvideo').replace(/^(fullslot|text|image)$/, 'text_image');
                                    params.viewMode = t.googleAdViewMode;
                                    params.overlay = t.googleAdOverlay;
                                    params.maxAdDuration = '30000';
                                }
                            } else if (mejs.MediaFeatures.isiPhone) {
                                params.adType = 'standardvideo';
                                params.maxAdDuration = '30000';
                            } else {
                                params.adType = 'video_text_image';
                                params.viewMode = 'FULLSCREEN';
                                params.overlay = 0;
                            }

                            console.log('final adType params: ' + params.adType);

                            t.handleGoogleIMAResponse(response, params);
                        } else {
                            handleVASTResponse(response);
                        }
                    }
                );
            },
        });

    })(mejs.$, window._);

    define("features/mep-feature-ads-vast", function () {});

    /*
     * Google Analytics Plugin
     * Requires
     *
     * Based on https://developers.google.com/analytics/devguides/collection/gajs/gaTrackingCustomVariables?hl=en
     */

    (function ($) {

        $.extend(mejs.MepDefaults, {});

        $.extend(MediaElementPlayer.prototype, {
            buildgoogleanalytics: function (player, controls, layers, media) {
                if ((typeof player.options.googleAnalyticsTag !== 'undefined') && (typeof _gaq !== 'undefined')) {
                    player.googleAnalyticsSupport = true;
                    _gaq.push(['_setAccount', player.options.googleAnalyticsTag]);
                }
                var listen = function (category, events) {
                    $.each(events, function (n, event) {
                        player.on(event, function () {
                            console.log('addEventListener::' + event);
                            if (player.googleAnalyticsSupport) {
                                _gaq.push(['_trackEvent', 'event', category, event]);
                            }
                        }, false);
                    });
                };
                //CAtegory ui
                listen('ui', [
                    'boltToggleFullscreen',
                    'boltAgeGate',
                ]);
                //Category state
                listen('state', [
                    'boltAdStarted',
                    'boltAdComplete',
                    'boltContentStarted',
                    'boltContentComplete',
                    'boltLoaded',
                    'boltRequestAdSpot',
                    'boltContentRequested',
                    'boltAdRequestFailed'
                ]);
            }
        });
    })(mejs.$);

    define("features/mep-feature-googleanalytics", function () {});

    //global MediaElementPlayer,mejs
    (function ($) {
        $.extend(mejs.MepDefaults, {});

        $.extend(MediaElementPlayer.prototype, {
            buildintmp: function (player, controls, layers, media) {
                $(player.container).addClass('no-svg');
                var t = this;
                t.hideControlsOniPhone();
                t.hideVideoOniPhone();
                t.eventTranslator(player);
                t.sigmaTracker(player);
                t.automute(player);
                t.showError = function (message) {
                    t.$node.remove();
                    t.container.replaceWith(
                        $('<div class="error-fatal">')
                        .append($('<div class="error-container">')
                            .append($('<div class="error-kind">').text('Error'))
                            .append($('<div class="error-message">').text(message))
                        )
                        .css('height', player.container.css('height'))
                    );
                };
                player.container.on('adloadproxyfailed', function () {
                    t.showError('Fatal error loading ad');
                });
                player.$media.on('error', function () {
                    if (player.media.error === 2) {
                        console.log('Fatal error loading content: ', arguments);
                    } else {
                        //                    t.showError('Fatal error loading content');
                    }
                });
                player.container.on('mejsprerollstart', function (e, data) {
                    player.container.trigger('bolt.exit');
                });
                player.container.on('mejsprerollmainstarted', function (e) {
                    player.container.trigger('bolt.enter');
                });
            },
            hideControlsOniPhone: function () {
                var t = this;
                //Hide controls on iPhone
                if (mejs.MediaFeatures.isiPhone) {
                    this.container.on('controlsshown', function () {
                        t.disableControls();
                    });
                }
            },
            hideVideoOniPhone: function () {
                if (mejs.MediaFeatures.isiPhone) {
                    console.log('Found iPhone, hiding video');
                    var videoSelector = this.container.find('video');
                    videoSelector.hide();
                    /*   this.container.one('click', function() {
                    videoSelector.show();
                }); */
                }
            },
            eventTranslator: function (player) {
                //Bolt Library events translator            
                player.on = function (event_name, callback) {
                    (
                        ({
                            boltContentStarted: function (cb) {
                                player.$media.one('play', cb);
                            },
                            boltContentComplete: function (cb) {
                                player.$media.on('ended', cb);
                            },
                            boltContentError: function (cb) {
                                player.$media.on('error', cb);
                            },
                            boltContentStateChanged: function (cb) {
                                var ch_cb = function (state) {
                                    return function (e) {
                                        cb(e, {
                                            state: state
                                        });
                                    };
                                };
                                player.$media.on('canplay', ch_cb('ready'));
                                player.$media.on('pause', ch_cb('paused'));
                                player.$media.on('stop', ch_cb('stoped'));
                                player.$media.on('play', ch_cb('playing'));
                            },
                            boltAdStarted: function (cb) {
                                player.container.on('mejsprerollstarted', cb);
                            },
                            boltAdComplete: function (cb) {
                                player.container.on('mejsprerollended', cb);
                            },
                            boltAdError: function (cb) {
                                player.container.on('mejsprerollerror', cb);
                            },
                            boltAdRequestFailed: function (cb) {
                                player.container.on('mejsprerollerror', cb);
                            },
                            boltAdImpression: function (cb) {
                                player.container.on('mejsprerollstarted', cb);
                            },
                            boltAdClick: function (cb) {
                                player.container.on('mejsprerolladsclicked', cb);
                            },
                            boltAdDurationChanged: function (cb) {
                                player.container.on('mejsaddurationchage', function (e, d) {
                                    cb(e, {
                                        duration: d
                                    });
                                });
                            },
                            boltAdTimeChanged: function (cb) {
                                player.container.on('mejsprerolltimeupdate', function (e, t) {
                                    cb(e, {
                                        time: t
                                    });
                                });
                            },
                            boltContentRequested: function (cb) {
                                player.$media.one('loadstart', cb);
                            },
                            boltRequestAdSpot: function (cb) {
                                player.container.on('mejsprerollstarted', cb);
                            },
                            boltLoaded: function (cb) {
                                player.$media.one('canplay', cb);
                            },
                            boltToggleFullscreen: function (cb) {
                                document.addEventListener("fullscreenchange", cb, false);
                                document.addEventListener("mozfullscreenchange", cb, false);
                                document.addEventListener("webkitfullscreenchange", cb, false);
                            },
                            boltAgeGate: function (cb) {
                                player.container.on('mejsagegate', cb);
                            }
                        })[event_name] || function () {
                            console.error('error: ' + event_name + ' not found');
                        }
                    )(callback);
                };
            },
            // Adds tracking of video impressions.  Only track once per video.
            sigmaTracker: function (player) {
                player.media.sigmaTracked = false;
                player.$media.on('play', function () {
                    console.log('**** playing ' + player.media.src);
                    var src_id = player.media.src.match(/video-\d+-(\d+)/);
                    if (src_id === null) {
                        src_id = player.media.src.match(/(\d+)\/video-/);
                    }
                    if ((src_id !== null) && (src_id.length > 0) && (player.media.sigmaTracked === false)) {
                        console.log('tracking play of video ID ' + src_id[1]);
                        // For some reason, more requests are being made than expected.  Until this is examined,
                        // we are not doing Sigma tracking of the HTML5 Player.
                        //$.ajax({
                        //    type: "HEAD",
                        //    async: true,
                        //    url: "http://sigma.intergi.com/play/" + src_id[1]
                        //});

                        // This is the new playtracker service.
                        $.post("http://focus-invention-584.appspot.com/play", {
                            domain: document.domain
                        });

                        player.media.sigmaTracked = true;
                        // We also want to track a single video play to ComScore,
                        // if we have no cuepoints and therefore are not
                        // firing off a tracker when the cuepoint at the start
                        // of the video gets hit.
                        console.log('cue points length: ' + player.options.cuePoints.length);
                        if (player.options.cuePoints.length === 0) {
                            player.fireComscoreCall({
                                'c5': '02'
                            });
                        }
                    }
                });
            },
            automute: function (player) {
                if (player.options.automute) {
                    player.media.setMuted(true);
                }
            },
            loop: function (player) {
                if (player.options.loop) {
                    player.media.on('ended', function () {
                        player.media.play();
                    });
                }
            },
            loadVideo: function (video_file, callback) {
                var t = this,
                    parse_f4m = function (filename, callback) {
                        $.ajax({
                            'type': 'get',
                            'url': filename,
                            'dataType': 'xml',
                            'success': function (response) {
                                var $xml = $(response),
                                    $baseUrl = $('baseURL', $xml),
                                    $media = $('media:first', $xml);

                                if (!$baseUrl.length || !$media.length) {
                                    callback(false);
                                }
                                callback([$baseUrl.text(), $media.attr('url')].join('/'));
                            }
                        });

                    },
                    checkSrc = function (the_src) {
                        if (the_src.indexOf('rtmp') === 0) {
                            return the_src
                                .replace(/^rtmps?:/i, '')
                                .replace('streaming.playwire', 'cdn.playwire')
                                .replace(/\/[a-z]{2,3}\d?:/i, '/')
                                .replace('-hd', '');
                        }
                        return the_src;
                    };
                parse_f4m(
                    video_file,
                    function (src) {
                        if (!src) {
                            t.$node.trigger('boltContentError');
                            return;
                        }
                        console.log('setting new video source: ' + src);
                        t.$media.one('loadedmetadata', function (e) {
                            this.currentTime = 0;
                        });
                        t.media.setSrc(checkSrc(src));
                        t.media.load();
                        callback();
                    }
                );
            }
        });

    })(mejs.$);

    define("features/mep-feature-intmp", function () {});

    (function ($, _) {

        $.extend(mejs.MepDefaults, {
            //Default options
            playlistText: 'Playlist',
            playlist: []
        });

        //#Extend the player with the playlist feature
        $.extend(MediaElementPlayer.prototype, {

            //the factory function
            buildplaylist: function (player, controls, layers, media) {

                var t = this;
                if (t.options.playlist.length === 0) {
                    return;
                }

                //The playlist button in the controls bar
                player.playlistButton =
                    $('<div class="mejs-button mejs-playlist-button">' +
                        '<button ' +
                        ' type="button" aria-controls="' + t.id +
                        '" title="' + t.options.playlistText +
                        '" aria-label="' + t.options.playlistText + '"></button>' +
                        '</div>');

                if (t.options.playlist.length) {
                    player.playlistButton.appendTo(controls)

                    //Click handler
                    .on('click', function (e) {
                        e.preventDefault();
                        player.playlistLayer.fadeIn();

                        if (!media.paused) {
                            media.pause();
                            //t.toogleBigplay();
                        }
                    });
                }

                //Add layer overlay for playlist
                player.playlistLayer =
                    $('<div class="mejs-playlist-layer">' +
                        '<div class="mejs-playlist-wraper">' +
                        '<div class="mejs-playlist-container">' +
                        '</div>' +
                        '</div>' +
                        '</div>')
                    .appendTo(layers)
                    .on('click', function () {
                        player.playlistLayer.fadeOut();
                    })
                    .hide();

                //Load videos
                $(t.options.playlist).each(function (index, element) {
                    var playerHeight = layers.find('.mejs-playlist-layer').height(),
                        playerWidth = layers.find('.mejs-playlist-layer').width();

                    // Set the playlist height to the player's 32%
                    var playlistHeight = (playerHeight * 32 / 100);

                    // Set the video posters height to the playlist's 80%
                    var playlistVideoHeight = (playlistHeight * 80) / 100;

                    // Set the video posters width to 16:9 aspect ratio
                    var widthAspectCoef = 16 / 9;
                    var playlistVideoWidth = playlistVideoHeight * widthAspectCoef;

                    // Set the video poster margin to the players's 1%
                    var playlistVideoMargin = (playerHeight * 1) / 100;

                    // Set the playlist width to the all videos added width value (vid width + margins + paddings + borders * vid ammout)
                    var playlistWidth = (playlistVideoWidth + (playlistVideoMargin * 4) + 2) * t.options.playlist.length;
                    var playlistContainer = player.playlistLayer.find('.mejs-playlist-container');

                    // Set the container width for scrolling, if it's necessary
                    if (playlistWidth > playerWidth) {
                        playlistContainer.css('width', playlistWidth.toFixed(2) + 'px');
                    }

                    // Add the playlist videos
                    playlistContainer.append(
                        $('<div class="playlistVideo">' + element.title + '</div>')
                        .data('src', element.src)
                        .data('title', element.title)
                        .css({
                            'background-image': 'url(' + element.poster + ')',
                            'height': playlistVideoHeight.toFixed(2) + 'px',
                            'width': playlistVideoWidth.toFixed(2) + 'px',
                            'margin': playlistVideoMargin.toFixed(2) + 'px',
                            'padding': playlistVideoMargin.toFixed(2) + 'px'
                        })
                    );
                });
                t.container.on('click', 'div.playlistVideo', function (ev) {
                    ev.preventDefault();
                    $(ev.currentTarget).trigger('playlist-item-selected');
                    player.options.title = $(ev.currentTarget).data('title');
                    ev.stopPropagation();
                });
                t.container.on('playlist-item-selected', 'div.playlistVideo', function (event) {
                    player.endCuepoints(player, media, controls);
                    t.loadVideo(
                        $(event.target).data('src'),
                        function () {
                            t.adsCurrentMediaTime = 0;
                            player.vastLoadAdTagInfo(
                                player.options.vastAdTagUrlTemplate,
                                function (ads) {
                                    var creative = ads[0].creatives[0],
                                        mediaFile = creative.mediaFiles[0];
                                    player.vastTracker = creative.makeTracker();
                                    player.vastTracker.on('clickthrough', function (url) {
                                        document.location.href = url;
                                    });
                                    player.adsStartPreroll(mediaFile);
                                    if (player.media.paused) {
                                        // create cuepointsState
                                        player.options.cuePoints = [];
                                        player.startCuepoints(player, media, controls);
                                        player.media.play();
                                    }
                                },
                                function (code) {
                                    if (player.media.paused) {
                                        player.media.play();
                                    }
                                    console.log('cuepoints: error loading VAST: ' + code);
                                }
                            );
                            t.media.play();
                            $(event.currentTarget)
                                .trigger('video-change', {
                                    src: $(event.target).data('src'),
                                    title: $(event.target).data('title')
                                });
                            //player.toogleBigplay(player.options.title);
                            event.stopPropagation();
                        }
                    );
                });
            }
        });
    })(mejs.$, window._);

    define("features/mep-feature-playlist", function () {});

    (function ($, _) {

        $.extend(mejs.MepDefaults, {
            //Default options
            relatedText: 'Related Videos',
            related: []
        });

        //#Extend the player with the related feature
        $.extend(MediaElementPlayer.prototype, {

            //the factory function
            buildrelated: function (player, controls, layers, media) {

                var t = this;
                if (t.options.related.length === 0) {
                    return;
                }

                //Add layer overlay for related
                player.relatedLayer =
                    $('<div class="mejs-related-layer">' +
                        '<div class="mejs-title">' + t.options.title + '</div>' +
                        '<div class="mejs-related-title">' + t.options.relatedText + '</div>' +
                        '<div class="mejs-related-wrapper">' +
                        '<ul class="mejs-related-container">' +
                        '</ul>' +
                        '</div>' +
                        '</div>')
                    .appendTo(layers)
                    .hide();

                //Load videos
                _(t.options.related).first(8).each(function (element, index) {
                    // Add the related videos
                    player.relatedLayer.find('.mejs-related-container').append(
                        $('<li>').append(
                            $('<div data-src="' + element.src + '" data-title="' + element.title + '">')
                            .append(
                                $('<img>')
                                .attr('src', element.poster)
                            )
                            .css({
                                'height': '100%'
                            })
                            .append(
                                $('<div class="related-item-title">' + element.title + '</div>')
                            )
                        ).addClass('grid_1')
                    );
                });
                t.container.on('click', '.mejs-related-layer li [data-src]', function (event) {
                    event.preventDefault();
                    // Track a fresh video impression.
                    player.media.sigmaTracked = false;
                    t.$media.one('loadedmetadata', function (e) {
                        player.relatedLayer.hide();
                    });
                    player.endCuepoints(player, media, controls);
                    t.loadVideo(
                        $(event.currentTarget).data('src'),
                        function () {
                            player.options.title = $(event.currentTarget).data('title');
                            player.adsCurrentMediaTime = 0;
                            player.options.cuePoints = [];
                            player.startCuepoints(player, media, controls);
                            player.vastLoadAdTagInfo(
                                player.options.vastAdTagUrlTemplate,
                                function (ads) {
                                    var creative = ads[0].creatives[0],
                                        mediaFile = creative.mediaFiles[0];
                                    player.vastTracker = creative.makeTracker();
                                    player.vastTracker.on('clickthrough', function (url) {
                                        document.location.href = url;
                                    });
                                    player.adsStartPreroll(mediaFile);
                                    if (player.media.paused) {
                                        player.media.play();
                                    }
                                },
                                function (code) {
                                    if (player.media.paused) {
                                        player.options.cuePoints = [];
                                        player.restartCuepointsState();
                                        player.startCuepoints(player, controls, layers, media);
                                        player.media.play();
                                    }
                                    console.log('cuepoints: error loading VAST: ' + code);
                                }
                            );
                            player.media.play();
                            $(event.currentTarget)
                                .trigger('video-change', {
                                    src: $(event.currentTarget).data('src'),
                                    title: $(event.currentTarget).data('title')
                                });
                        }
                    );
                    event.stopPropagation();
                });
                var relatedEndedProxy = $.proxy(function () {
                    player.hidecuepoints(controls);
                    player.relatedLayer.show();
                }, player);
                player.container.on('bolt.enter', function (e, data) {
                    player.$media.on('ended', relatedEndedProxy);
                });
                player.container.on('bolt.exit', function (e) {
                    player.$media.off('ended', relatedEndedProxy);
                });
            }
        });
    })(mejs.$, window._);

    define("features/mep-feature-related", function () {});

    //global MediaElementPlayer,mejs
    (function ($) {
        $.extend(mejs.MepDefaults, {
            playwireLink: 'http://www.playwire.com',
            titleText: 'Playwire'
        });

        $.extend(MediaElementPlayer.prototype, {
            buildplaywire: function (player, controls, layers, media) {
                var t = this,
                    pwButton;
                //Add the playwire button tag unless it's been turned off
                if ((typeof player.options.branding === 'undefined') || (player.options.branding === true)) {
                    pwButton = $(
                            '<div class="mejs-button mejs-playwire-button">' +
                            '<button type="button" aria-controls="' +
                            t.id +
                            '" title="' +
                            t.options.titleText +
                            '"></button>' +
                            '</div>')
                        .appendTo(controls)
                        .click(function (e) {
                            e.preventDefault();
                            window.open(t.options.playwireLink, '_blank');
                        });
                }
            }
        });
    })(mejs.$);

    define("features/mep-feature-playwire", function () {});

    // Source Chooser Plugin
    (function ($) {

        $.extend(mejs.MepDefaults, {
            qualityselectorText: 'Toggle SD/HD',
            currentQuality: 'sd',
            qualitySelectorIsHD: false
        });

        $.extend(MediaElementPlayer.prototype, {
            buildqualityselector: function (player, controls, layers, media) {

                var t = this;

                console.log("Original src: " + media.src);

                t.sd_src = media.src;
                t.hd_src = media.src.replace(/(-sd|-mobile)*\.mp4/, '-hd.mp4');

                player.qualityselectorButton =
                    $('<div class="mejs-button mejs-qualityselector-button">' +
                        '<button ' +
                        ' type="button" aria-controls="' + t.id +
                        '" title="' + t.options.qualityselectorText +
                        '" aria-label="' + t.options.qualityselectorText + '"></button>' +
                        '</div>')
                    .appendTo(controls).hide()
                    // handle clicks to toggle hd/sd
                    .delegate('button', 'click', function ($event) {
                        var newQualityIsHD = !t.options.qualitySelectorIsHD,
                            currentTime,
                            paused,
                            src;

                        if (newQualityIsHD) {
                            src = t.hd_src;
                            $(this).addClass('down');
                        } else {
                            src = t.sd_src;
                            $(this).removeClass('down');
                        }

                        currentTime = media.currentTime;
                        paused = media.paused;
                        player.$media.one('loadedmetadata', function (e) {
                            media.currentTime = currentTime;
                        });
                        player.$media.one('canplay', function (e) {
                            if (!paused) {
                                player.play();
                            }
                        });
                        console.log("Setting src to " + src);
                        media.setSrc(src);
                        media.load();
                        t.options.qualitySelectorIsHD = newQualityIsHD;
                    });

                // Before displaying the HD toggle button, see if we have
                // an HD media file to work with.  Check for its existence
                // with a HEAD request so we don't pull down the whole
                // file unnecessarily.

                console.log("looking for HD at " + t.hd_src);
                $.ajax({
                    type: "HEAD",
                    async: true,
                    url: t.hd_src,
                    timeout: 1000,
                    statusCode: {
                        200: function () {
                            console.log("HD file found, building quality selector button");
                            player.qualityselectorButton.show();
                        }
                    }
                });
            },
        });

    })(mejs.$);

    define("features/mep-feature-qualityselector", function () {});

    (function ($, _) {
        //###Extend options with defaults
        $.extend(mejs.MepDefaults, {
            //Default options
            sharingText: 'Share',
            //The embed tag template
            sharingEmbed: '<script type="text/javascript" charset="utf-8" src="<%=src%>" data-width="<%=width%>" data-height="<%=height%>" data-config="<%=config%>" data-publisher-id="<%=publisher_id%>" data-video-id="<%=video_id%>"></script>',
            //The url to share
            sharingUrl: window.location.href,
            //The sharing services
            sharingServices: [{
                id: 'googleplus',
                title: 'Google+',
                url: 'https://plus.google.com/share?url=<%=url%>'
            }, {
                id: 'facebook',
                title: 'Facebook',
                url: 'https://www.facebook.com/sharer/sharer.php?u=<%=url%>'
                    //url: 'https://graph.facebook.com/me/video.watches?access_token=ACCESS_TOKEN&method=POST&movie=<%=url%>'
            }, {
                id: 'twitter',
                title: 'Twitter',
                url: 'https://twitter.com/intent/tweet?source=webclient&text=<%=url%>'
            }, {
                id: 'email',
                title: 'by Email',
                url: 'mailto:?body=<%=url%>',
            }]
        });
        //###Extend the player with the sharing feature
        $.extend(MediaElementPlayer.prototype, {
            //the factory function
            buildsharing: function (player, controls, layers, media) {

                var t = this;
                //The share button in the controls bar
                player.sharingButton =
                    $('<div class="mejs-button mejs-share-button">' +
                        '<button ' +
                        ' type="button" aria-controls="' + t.id +
                        '" title="' + t.options.sharingText +
                        '" aria-label="' + t.options.sharingText + '"></button>' +
                        '</div>')
                    .appendTo(controls)
                    //Click handler
                    .delegate('button', 'click', function (e) {
                        e.preventDefault();
                        player.sharingLayer.show();
                        media.pause();
                    });

                //Add layer overlay for sharing
                player.sharingLayer =
                    $('<div class="mejs-layer mejs-overlay mejs-sharing">' +
                        '<div class="mejs-sharing-container">' +
                        '</div>' +
                        '</div>')
                    .append(
                        $('<div class="mejs-button mejs-close">' +
                            '<button ' +
                            ' type="button" aria-controls="Close" title="Cose" aria-label="Cose"></button>' +
                            '</div>')
                        .css('float', 'right')
                        .on('click', function () {
                            player.sharingLayer.hide();
                        })
                    )
                    .hide()
                    .appendTo(layers);

                //Options to fill the embed template
                var embed_options = {
                    src: t.options.sharingUrl,
                    width: player.width,
                    height: player.height,
                    config: player.options.config,
                    video_id: player.options.video_id,
                    publisher_id: player.options.publisher_id
                };

                //###Fill values on input boxes
                //Fill link value
                $('<div>' + 'Embed Code<br>' + '</div>')
                    .append($('<input type="text">')
                        .val(_.template(t.options.sharingEmbed, embed_options)))
                    .appendTo(player.sharingLayer.find('.mejs-sharing-container'));
                //Fill embed code value
                $('<div>' + 'Share Link<br>' + '</div>')
                    .append($('<input type="text">')
                        .val(t.options.sharingUrl))
                    .appendTo(player.sharingLayer.find('.mejs-sharing-container'));
                //Select all text, ready to copy to clipboard
                $('input', player.sharingServices)
                    .on('click', function () {
                        $(this).select();
                    });
                //Generate a button for each service
                $('<div>')
                    .append(
                        $.map(
                            t.options.sharingServices,
                            function (svc) {
                                return $('<div class="mejs-button mejs-' + svc.id + '-button">')
                                    .append(
                                        $('<button ' +
                                            ' type="button" aria-controls="' + svc.title +
                                            '" title="' + svc.title +
                                            '" aria-label="' + svc.title + '">')
                                        //Store the service url in the data attribute
                                        .data('url', _.template(svc.url, {
                                            url: encodeURIComponent(t.options.sharingUrl)
                                        }))
                                    )
                                    .appendTo($('.mejs-sharing-container', player.sharingLayer));
                            }
                        )
                    ).delegate('button', 'click', function (e) {
                        e.preventDefault();
                        //Open the link in another browser window
                        window.open($(this).data('url'), '_blank');
                    }).appendTo(player.sharingLayer.find('.mejs-sharing-container'));
            }

        });

    })(mejs.$, window._);

    define("features/mep-feature-sharing", function () {});

    (function ($) {

        $.extend(MediaElementPlayer.prototype, {

            buildwatermark: function (player, controls, layers, media) {

                var t = this;

                // add layer for watermark
                player.watermarkLayer =
                    $('<div class="mejs-layer mejs-overlay mejs-watermark">' +
                        '<a href="' + t.options.watermarkUrl + '" target="_blank">' +
                        '<img class="mejs-watermark-image" src="' + t.options.watermark + '">' + '</img>' +
                        '</a>' +
                        '</div>')
                    .prependTo(layers);

                $('img.mejs-watermark-image')
                    .css({
                        position: 'absolute',
                        right: 0,
                        bottom: $('.mejs-controls').height()
                    });
            }

        });

    })(mejs.$);

    define("features/mep-feature-watermark", function () {});

    window.BOLT_JS_VERSION = 'HTML5-1ed4c917a3da8d4863298dd514b09c3518d90431-20140522101824';
    define('player', [
        'require',
        'module',
        'jquery',
        'mediaelement',
        'mep/mep-library',
        'mep/mep-player',

        'mep/mep-feature-playpause',
        'mep/mep-feature-stop',
        'mep/mep-feature-progress',
        'mep/mep-feature-time',
        'mep/mep-feature-volume',
        'mep/mep-feature-fullscreen',

        'features/mep-feature-agegate',
        'features/mep-feature-comscore',
        'features/mep-feature-googleima',
        'features/mep-feature-customization',
        'features/mep-feature-googleanalytics',
        'features/mep-feature-intmp',
        'features/mep-feature-playlist',
        'features/mep-feature-related',
        'features/mep-feature-playwire',
        'features/mep-feature-qualityselector',
        'features/mep-feature-sharing',
        'features/mep-feature-watermark'
    ], function (require, module, $) {
        MediaElementPlayer.profile = module.config().profile;
        switch (module.config().profile) {
        case 'full':
        case 'cuepoints':
            window.DMVAST = require('vast-client');
            require('features/mep-feature-ads');
            require('features/mep-feature-ads-vast');
            //require('features/mep-feature-cuepoints');
            break;
        case 'prerolls':
            window.DMVAST = require('vast-client');
            require('features/mep-feature-ads');
            require('features/mep-feature-ads-vast');
            break;
        case 'raw':
            //require('jquery-detect');
            break;
        }
        return mejs.MediaElementPlayer;
    });

    /**
     * Intergi Media Player v0.0.0 <http://www.playwire.com/bolt>
     * (c)2013 Intergi LLC
     * @author mway
     * @version 2.0.0
     */
    define('mp', [
        'jquery',
        'base64',
        'json2',
        'mediaelement',
        'player',
        'module'
    ], function ($, Base64, JSON, mejs, MediaElementPlayer, module) {


        var MP = {
            'players': {},
            'VERSION': '0.0.0',
            'BASE_URL': '//192.168.0.79/wp391/wp-content/plugins/playwire-for-wordpress-master/',

            'fn': {
                'setBaseUrl': function (baseUrl) {
                    if (baseUrl[baseUrl.length - 1] !== '/') {
                        baseUrl += '/';
                    }

                    if (baseUrl.indexOf('//') === 0) {
                        baseUrl = (window.location.protocol || 'http:') + baseUrl;
                    }

                    MP.BASE_URL = baseUrl;
                }
            }
        };

        MP.Util = {
            'fn': {
                'unitize': function (val) {
                    val = val.toString();
                    return ['px', 'em'].indexOf(val.slice(-2)) < 0 && ['%'].indexOf(val.slice(-1)) < 0 ? (val + 'px') : val;
                },

                'log': function () {
                    if (!window.__boltDebug) {
                        return;
                    }

                    var _args = Array.prototype.slice.call(arguments);
                    _args.unshift('[bolt:js]');

                    if (window.console && console.log) {
                        try {
                            console.log.apply(console, _args);
                        } catch (e) {}
                    }
                },

                'getUrlInfo': function (domain, path) {
                    var _parts = domain.split('//'),
                        _protocol = _parts.length > 1 ? _parts[0] : '',
                        _bareDomain = (_parts.length > 1 ? _parts.slice(1) : _parts).join('//').replace(/\/+$/, ''),
                        _path = (path.substr(0, 1) !== '/' ? '/' : '') + path.replace(/\/{2,}/g, '').replace(/\/+$/, '');

                    return {
                        'protocol': _protocol,
                        'bareDomain': _bareDomain,
                        'qualifiedDomain': _protocol + '//' + _bareDomain,
                        'path': _path,
                        'qualifiedPath': _protocol + '//' + _bareDomain + _path
                    };
                }
            }
        };

        MP.Player = {
            'ids': [],
            'allowedSettings': [
                'showShare', 'showEmbed', 'ageGate', 'minAge', 'autoplay', 'volume',
                'backgroundColor', 'foregroundColor', 'activeColor', 'adInterval', 'timedAdWait',
                'preload', 'jquery', 'stylesheet', 'automute', 'loop'
            ],
            'fn': {
                'playMedia': function (id) {
                    var _player = MP.players[id];
                    _player.play();
                },

                'pauseMedia': function (id) {
                    var _player = MP.players[id];
                    _player.pause();
                },

                'stopMedia': function (id) {
                    var _player = MP.players[id];
                    _player.pause();
                    _player.setCurrentTime(0);
                },

                'setData': function (id, flashvars) {
                    //TODO: What is `Bolt.Player.data`?
                    MP.Player.data[id] = (MP.Player.data[id] || {});

                    for (var p in flashvars) {
                        MP.Player.data[id][p] = flashvars[p];
                    }
                },

                'render': function (id, flashvars, params) {

                    var //_params         = params || {},
                        _settings = null,
                        _addedSuffix = false;

                    /*
                    _params.wmode               || (_params.wmode               = 'transparent');
                    _params.quality             || (_params.quality             = 'high');
                    _params.bgcolor             || (_params.bgcolor             = '#000000');
                    _params.allowscriptaccess   || (_params.allowscriptaccess   = 'always');
                    _params.allowfullscreen     || (_params.allowfullscreen     = 'true');
                    */

                    flashvars = (flashvars || {});

                    /*
                    if(MP.Player.data[id]) {
                        $.extend(flashvars, Bolt.Player.data[id]);
                    }
                    */

                    var _urlInfo = MP.Util.fn.getUrlInfo(
                        flashvars.baseDomain || '192.168.0.79/wp391/wp-content/plugins/',
                        flashvars.basePath || '/playwire-for-wordpress-master'
                    );

                    for (var p in flashvars) {
                        if (String(flashvars[p]).indexOf('//') === 0) {
                            flashvars[p] = window.location.protocol + flashvars[p];
                        }
                    }

                    MP.fn.setBaseUrl(_urlInfo.qualifiedPath);
                    delete flashvars.baseDomain;
                    delete flashvars.basePath;

                    if (window.__boltBaseUrl) {
                        MP.fn.setBaseUrl(window.__boltBaseUrl);
                    }

                    if ('settings' in flashvars) {
                        _settings = typeof (flashvars.settings) === 'object' ? flashvars.settings : {};
                        delete flashvars.settings;
                    }

                    for (var k in flashvars) {
                        if (MP.Player.allowedSettings.indexOf(k) >= 0) {
                            _settings = (_settings || {});
                            _settings[k] = flashvars[k];
                            delete flashvars[k];
                        }
                    }

                    if (_settings) {
                        flashvars.settings = _settings;
                    }

                    if (!id) {
                        id = 'bolt' + (Math.random() * Math.pow(10, 10)).toString().replace('.', '').substr(0, 10);
                    }

                    if (!flashvars.width) {
                        flashvars.width = '100%';
                    }

                    if (!flashvars.height) {
                        flashvars.height = '100%';
                    }

                    var _width = (window.innerWidth*2)/10;
                        _height = 100,
                        _fv = escape(Base64.encode(JSON.stringify(flashvars))),
                        _fvkey = 'fv' + (Math.random() * Math.pow(10, 10)).toString().replace('.', '').substr(0, 10),
                        _pac = flashvars.postAdContainer;
alert(_width);
                    //flashvars           = { 'key': _fvkey };
                    flashvars[_fvkey] = _fv;

                    //
                    // Now that we're sure we have a top-level container, let's go ahead and create the
                    // player-container (with width/height).
                    // iPhones get handled differently:  because Google ads cannot play unless the
                    // user first interacts with the page, and because clicking on a video does not
                    // count as an interaction, we start out by hiding the video, and attach a click
                    // handler to the container.  When the container is clicked, we reveal the video.

                    var _playerId = id + '-player',
                        $container = $('#' + id),
                        $playerContainer = $('<div>').attr({
                            'id': id + '-container'
                        }),
                        $playerPlaceholder = $('<div>').attr({
                            'id': _playerId,
                            'class': 'videoContainer mejs-bolt'
                        });

                    if (!$container.length) {
                        if (window.console) console.error('Must provide a valid container');
                        return;
                    }

                    $playerContainer.css({
                        'width': isNaN(_width) ? '' : (_width + 'px')
                    });
                    $playerContainer.css({
                        'height': isNaN(_height) ? '' : (_height + 'px')
                    });
                    $playerContainer.css({
                        'backgroundColor': '#1a1a1a'
                    });
                    $playerContainer.css({
                        'overflow': 'hidden'
                    })
                    $playerContainer.append($playerPlaceholder);

                    $container.css({
                        'width': _width,
                        'height': _height
                    });
                    $container.append($playerContainer);

                    // Don't forget our player stylesheet.
                    $('head').append('<link rel="Stylesheet" href="' + MP.BASE_URL + 'css/bolt_html5.css"></link>');

                    var videoHtml = '<video class="video" width="' + flashvars.width + '" height="' + flashvars.height + '" ' +
                        'id="bolt-player-' + flashvars.videoId + '" >' +
                        '</video>';
                    $playerPlaceholder.append(videoHtml);
                    /*                    
                    if (mejs.MediaFeatures.isiPhone) {
                        console.log ('Found iPhone when building video tag');
                        $playerPlaceholder.hide().append(videoHtml);
                        $playerPlaceholder.parent().one('click', function () { $playerPlaceholder.show(); });
                    } else {
                        console.log ('Found non-iPhone when building video tag');
                        $playerPlaceholder.append(videoHtml);
                    }
*/
                    var options = {
                        //mode: 'auto',
                        //Keyboard disabled
                        enableKeyboard: true,
                        //No flash plugin to debug
                        enablePluginDebug: false,
                        //Player autoresizing on load metadata
                        enableAutosize: true,
                        //Time rail autoresizing?
                        autosizeProgress: true,
                        // if the `video width` is not specified, this is the default
                        defaultVideoWidth: '100sdasdsa%',
                        // if the `video height` is not specified, this is the default
                        defaultVideoHeight: '10sadsadsa0%',
                        // if set, overrides `video width`
                        /* videoWidth: 640,*/
                        // if set, overrides `video height`
                        /* videoHeight: 480,*/
                        // enables Flash and Silverlight to resize to content size
                        /*enableAutosize: false,*/
                        //Hide/show controls
                        alwaysShowControls: false,
                        //TODO
                        clickToPlayPause: true,
                        //Show volume as a vertical slider
                        videoVolume: 'vertical',
                        // initial volume when the player starts
                        startVolume: 0.8,
                        // Android and iOS supports volume controls???
                        hideVolumeOnTouchDevices: (mejs.MediaFeatures.isAndroid || mejs.MediaFeatures.isiPad || mejs.MediaFeatures.isiPhone),
                        // force iPad's native controls
                        iPadUseNativeControls: false,
                        // force iPhone's native controls
                        iPhoneUseNativeControls: false,
                        // force Android's native controls
                        AndroidUseNativeControls: false,
                        //the config url
                        config: flashvars.config,
                        //the video id
                        video_id: flashvars.videoId,
                        //the video id
                        publisher_id: flashvars.publisherId,
                        // the order of controls you want on the control bar (and other plugins below
                        features: module.config().features
                    };

                    function _renderVideoTag(src) {
                        var sources = '';

                        if (src.indexOf('rtmp') === 0) {
                            src = src.replace(/^rtmps?:/i, '').replace('streaming.playwire', 'cdn.playwire').replace(/\/[a-z]{2,3}\d?:/i, '/').replace('-hd', '');
                        }

                        if (src.match(/\.mp4/)) {
                            sources = '<source id="sd" src="' + src + '" type="video/mp4" title="sd">' +
                                '<source id="hd" src="' + src.replace(/\.mp4/, '-hd.mp4') + '" type="video/mp4" title="hd">';
                        } else if (src.match(/\.m4v/)) {
                            sources = '<source id="sd" src="' + src + '" type="video/m4v" title="sd">' +
                                '<source id="hd" src="' + src.replace(/\.m4v/, '-hd.m4v') + '" type="video/m4v" title="hd">';
                        } else if (src.match(/\.webm/)) {
                            sources = '<source id="sd" src="' + src + '" type="video/webm" title="sd">' +
                                '<source id="hd" src="' + src.replace(/\.webm/, '-hd.webm') + '" type="video/webm" title="hd">';
                        } else if (src.match(/\.ogg/)) {
                            sources = '<source id="sd" src="' + src + '" type="video/ogg" title="sd">' +
                                '<source id="hd" src="' + src.replace(/\.ogg/, '-hd.ogg') + '" type="video/ogg" title="hd">';
                        }

                        $playerPlaceholder.find('video').append(sources);
                    }
                    $.getJSON(flashvars.config, function (response) {
                        var checkSrc = function (the_src) {
                                if (the_src.indexOf('rtmp') === 0) {
                                    return the_src.replace(/^rtmps?:/i, '').replace('streaming.playwire', 'cdn.playwire').replace(/\/[a-z]{2,3}\d?:/i, '/').replace('-hd', '');
                                }
                                return the_src;
                            },
                            _src = '';

                        if (response.src) {
                            _src = response.src;
                        } else if (response.playlist && response.playlist.length > 0 && response.playlist[0].src) {
                            $.extend(options, {
                                title: response.playlist[0].title
                            });
                            _src = response.playlist[0].src;
                        }

                        if (response.settings) {
                            $.extend(options, response.settings);
                        }

                        if (response.watermark) {
                            $.extend(options, {
                                watermark: response.watermark,
                                watermarkUrl: response.watermarkUrl
                            });
                            options.features.push('watermark');
                        }

                        if (response.playlist) {
                            $.extend(options, {
                                playlist: response.playlist
                            });
                        }

                        if (response.related) {
                            if (!$.isArray(response.related)) {
                                $.getJSON(response.related, function (response_related) {
                                    $.extend(options, {
                                        related: response_related
                                    });
                                });
                            } else {
                                $.extend(options, {
                                    related: response.related
                                });
                            }
                        }

                        if (response.title) {
                            $.extend(options, {
                                title: response.title
                            });
                        }

                        if (response.adInterval) {
                            $.extend(options, {
                                adInterval: response.adInterval
                            });
                        }

                        if (response.mobileVastSrc) {
                            $.extend(options, {
                                vastAdTagUrlTemplate: response.mobileVastSrc
                            });
                        } else if (response.adEnabledSites) {
                            var adTag;
                            var domain = document.domain;
                            for (var site in response.adEnabledSites) {
                                var re = new RegExp(site)
                                if (domain.match(re)) {
                                    adTag = response.adEnabledSites[site].mobileVastSrc;
                                    break;
                                } else {
                                    adTag = response.defaultAdTags.mobileVastSrc;
                                }
                            }
                            $.extend(options, {
                                vastAdTagUrlTemplate: adTag
                            });
                        }

                        if (response.googleAnalyticsTag) {
                            $.extend(options, {
                                googleAnalyticsTag: response.googleAnalyticsTag
                            });
                        }

                        options.poster = response.poster;
                        options.src = _src;
                        flashvars.videoId = flashvars.videoId || (Math.round(Math.random() * Math.pow(10, 10)));

                        if (_src) {
                            if (_src.match(/\.f4m(\?.*)?$/)) {
                                $.ajax({
                                    'type': 'get',
                                    'url': _src,
                                    'dataType': 'xml',
                                    'success': function (response) {
                                        var $xml = $(response),
                                            $baseUrl = $('baseURL', $xml),
                                            $media = $('media:first', $xml),
                                            _src;

                                        if (!$baseUrl.length || !$media.length) {
                                            return;
                                        }

                                        _src = [$baseUrl.text(), $media.attr('url')].join('/');
                                        _renderVideoTag(_src);
                                        MP.players[_playerId] = new MediaElementPlayer($playerPlaceholder.find('video'), options);
                                    }
                                });
                            } else {
                                _renderVideoTag(_src);
                                MP.players[_playerId] = new MediaElementPlayer($playerPlaceholder.find('video'), options);
                            }
                        } else {
                            console.error('Bad JSON:', response);
                        }
                    });
                    return _addedSuffix ? id.split('-').slice(0, -1)[0] : id;
                },

                'resize': function (id, width, height) {
                    var _player = MP.players[id];

                    if (!_player || !width || !height) {
                        return;
                    }

                    var _width = MP.Util.fn.unitize(width),
                        _height = MP.Util.fn.unitize(height);

                    _player.setPlayerSize(_width, _height);
                    _player.setControlsSize();
                },

                'remove': function (id, removeContainer) {
                    var _player = MP.players[id];
                    if (!removeContainer) {
                        try {
                            _player.remove();
                            //$('#' + id).replaceWith($('<div>').attr({ 'id': id }));
                            $('#' + id + '-container').remove();
                        } catch (e) {}
                    } else {
                        try {
                            _player.remove();
                            $('#' + id).remove();
                        } catch (e) {}
                    }
                }
            }
        };

        MP.EventDispatcher = {
            'eventMap': {},
            'fn': {
                'addEventListener': function (id, eventName, callback) {
                    MP.EventDispatcher.eventMap[id] = (MP.EventDispatcher.eventMap[id] || {});

                    var _nameParts = eventName.split(',');
                    for (var i = 0, l = _nameParts.length; i < l; i++) {
                        var _name = String(_nameParts[i]).trim();

                        if (!(_name in MP.EventDispatcher.eventMap[id])) {
                            MP.EventDispatcher.eventMap[id][_name] = [];
                        }

                        if (MP.EventDispatcher.eventMap[id][_name].indexOf(callback) >= 0) {
                            return;
                        }

                        MP.Util.fn.log('Added event listener for:', _name, '(' + id + ')');
                        //MP.EventDispatcher.eventMap[id][_name].push(callback);
                        MP.players[id].on(_name, callback);
                    }
                },

                'dispatchEvent': function (id, name, params) {
                    MP.Util.fn.log('Dispatching event for:', name, '(' + id + ')');

                    if (!(id in MP.EventDispatcher.eventMap) || !(name in MP.EventDispatcher.eventMap[id]) || !MP.EventDispatcher.eventMap[id][name].length) {
                        return;
                    }

                    params = (params || {});
                    params.type = name;
                    params.target = id;

                    for (var i = 0, l = MP.EventDispatcher.eventMap[id][name].length; i < l; i++) {
                        MP.EventDispatcher.eventMap[id][name][i](params);
                    }
                }
            }
        };
        // TODO: Remove this
        MP.Companion = {
            'fn': {
                'hasCompanionContainer': function () {
                    return !!MP.Companion.fn.getCompanionContainer();
                },

                'getCompanionContainer': function () {
                    return document.getElementById('companionAd');
                },

                'renderHtml': function (id, params) {
                    if (!MP.Companion.fn.hasCompanionContainer()) {
                        MP.Util.fn.log('HTML companion requested, but no companion container');
                        return;
                    }

                    if (!params || !params.src) {
                        MP.Util.fn.log('HTML companion requested, but no params', params);
                        return;
                    }

                    MP.Util.fn.log('Rendering HTML companion', params);
                    MP.Companion.fn.getCompanionContainer().innerHTML += params.src;
                },

                'renderIframe': function (id, params) {
                    if (!MP.Companion.fn.hasCompanionContainer()) {
                        MP.Util.fn.log('iFrame companion requested, but no companion container');
                        return;
                    }

                    if (!params || !params.src) {
                        MP.Util.fn.log('iFrame companion requested, but no params');
                        return;
                    }

                    MP.Util.fn.log('Rendering iFrame companion', params);

                    var _container = MP.Companion.fn.getCompanionContainer();
                    _container.innerHTML += '<iframe src="' + params.src + '" id="companionAdIFrame" />';
                },

                'renderImage': function (id, params) {
                    if (!MP.Companion.fn.hasCompanionContainer()) {
                        MP.Util.fn.log('Image companion requested, but no companion container');
                        return;
                    }

                    if (!params || !params.src) {
                        MP.Util.fn.log('Image companion requested, but no params');
                        return;
                    }

                    MP.Util.fn.log('Rendering image companion:', params);
                    MP.Companion.fn.getCompanionContainer().innerHTML += '<a href="' + params.url + '"><img src="' + params.src + '" /></a>';
                },

                'renderJavascript': function (id, params) {
                    if (!params || !params.src) {
                        MP.Util.fn.log('JS companion requested, but no params');
                        return;
                    }

                    MP.Util.fn.log('Rendering javascript companion:', params);

                    var _head = document.getElementByTagName('head')[0],
                        _script;

                    if (!_head) {
                        MP.Util.fn.log('JS companion requested, but no <head> element');
                        return;
                    }

                    _script = document.createElement('script');
                    _script.type = 'text/javascript';
                    _script.src = params.src;

                    _head.appendChild(_script);
                }
            }
        };
        return {
            'init': function (what) {
                MP.features = what;
            },
            'players': MP.players,
            'available': true,
            'version': MP.VERSION,
            'setBaseUrl': function (baseUrl) {
                MP.fn.setBaseUrl(baseUrl);
            },
            'setVideoData': function (id, flashvars) {
                MP.Player.fn.setData(id, flashvars);
            },

            'renderVideo': function (id, flashvars) {
                return MP.Player.fn.render(id, flashvars);
            },
            'resizeVideo': function (id, width, height) {
                MP.Player.fn.resize(id, width, height);
            },
            'removeVideo': function (id, removeContainer) {
                MP.Player.fn.remove(id, removeContainer);
            },

            // Playback
            'playMedia': function (id) {
                MP.Player.fn.playMedia(id);
            },
            'pauseMedia': function (id) {
                MP.Player.fn.pauseMedia(id);
            },
            'stopMedia': function (id) {
                MP.Player.fn.stopMedia(id);
            },

            // Companion rendering
            'renderHtmlCompanion': function (id, params) {
                MP.Companion.fn.renderHtml(id, params);
            },
            'renderIframeCompanion': function (id, params) {
                MP.Companion.fn.renderIframe(id, params);
            },
            'renderImageCompanion': function (id, params) {
                MP.Companion.fn.renderImage(id, params);
            },
            'renderJavascriptCompanion': function (id, params) {
                MP.Companion.fn.renderJavascript(id, params);
            },

            // Event handling
            'on': function (id, eventName, fn) {
                MP.EventDispatcher.fn.addEventListener(id, eventName, fn);
            },
            'addEventListener': function (id, eventName, fn) {
                MP.EventDispatcher.fn.addEventListener(id, eventName, fn);
            },
            'off': function (id, eventName) {},
            'removeEventListener': function (id, eventName) {},
            'dispatchEvent': function (id, eventName, params) {
                MP.EventDispatcher.fn.dispatchEvent(id, eventName, params);
            }
        };
        if (window.__boltBaseUrl) {
            MP.fn.setBaseUrl(window.__boltBaseUrl);
        }
        /**
         * Shims, libs, etc
         */
        if (!Array.prototype.indexOf) {
            Array.prototype.indexOf = function (obj, start) {
                for (var i = (start || 0), j = this.length; i < j; i++) {
                    if (this[i] === obj) {
                        return i;
                    }
                }

                return -1;
            };
        }
    });

    /*!
     * jQuery throttle / debounce - v1.1 - 3/7/2010
     * http://benalman.com/projects/jquery-throttle-debounce-plugin/
     *
     * Copyright (c) 2010 "Cowboy" Ben Alman
     * Dual licensed under the MIT and GPL licenses.
     * http://benalman.com/about/license/
     */

    // Script: jQuery throttle / debounce: Sometimes, less is more!
    //
    // *Version: 1.1, Last updated: 3/7/2010*
    //
    // Project Home - http://benalman.com/projects/jquery-throttle-debounce-plugin/
    // GitHub       - http://github.com/cowboy/jquery-throttle-debounce/
    // Source       - http://github.com/cowboy/jquery-throttle-debounce/raw/master/jquery.ba-throttle-debounce.js
    // (Minified)   - http://github.com/cowboy/jquery-throttle-debounce/raw/master/jquery.ba-throttle-debounce.min.js (0.7kb)
    //
    // About: License
    //
    // Copyright (c) 2010 "Cowboy" Ben Alman,
    // Dual licensed under the MIT and GPL licenses.
    // http://benalman.com/about/license/
    //
    // About: Examples
    //
    // These working examples, complete with fully commented code, illustrate a few
    // ways in which this plugin can be used.
    //
    // Throttle - http://benalman.com/code/projects/jquery-throttle-debounce/examples/throttle/
    // Debounce - http://benalman.com/code/projects/jquery-throttle-debounce/examples/debounce/
    //
    // About: Support and Testing
    //
    // Information about what version or versions of jQuery this plugin has been
    // tested with, what browsers it has been tested in, and where the unit tests
    // reside (so you can test it yourself).
    //
    // jQuery Versions - none, 1.3.2, 1.4.2
    // Browsers Tested - Internet Explorer 6-8, Firefox 2-3.6, Safari 3-4, Chrome 4-5, Opera 9.6-10.1.
    // Unit Tests      - http://benalman.com/code/projects/jquery-throttle-debounce/unit/
    //
    // About: Release History
    //
    // 1.1 - (3/7/2010) Fixed a bug in <jQuery.throttle> where trailing callbacks
    //       executed later than they should. Reworked a fair amount of internal
    //       logic as well.
    // 1.0 - (3/6/2010) Initial release as a stand-alone project. Migrated over
    //       from jquery-misc repo v0.4 to jquery-throttle repo v1.0, added the
    //       no_trailing throttle parameter and debounce functionality.
    //
    // Topic: Note for non-jQuery users
    //
    // jQuery isn't actually required for this plugin, because nothing internal
    // uses any jQuery methods or properties. jQuery is just used as a namespace
    // under which these methods can exist.
    //
    // Since jQuery isn't actually required for this plugin, if jQuery doesn't exist
    // when this plugin is loaded, the method described below will be created in
    // the `Cowboy` namespace. Usage will be exactly the same, but instead of
    // $.method() or jQuery.method(), you'll need to use Cowboy.method().

    (function (window, undefined) {
        '$:nomunge'; // Used by YUI compressor.

        // Since jQuery really isn't required for this plugin, use `jQuery` as the
        // namespace only if it already exists, otherwise use the `Cowboy` namespace,
        // creating it if necessary.
        var $ = window.jQuery || window.Cowboy || (window.Cowboy = {}),

            // Internal method reference.
            jq_throttle;

        // Method: jQuery.throttle
        //
        // Throttle execution of a function. Especially useful for rate limiting
        // execution of handlers on events like resize and scroll. If you want to
        // rate-limit execution of a function to a single time, see the
        // <jQuery.debounce> method.
        //
        // In this visualization, | is a throttled-function call and X is the actual
        // callback execution:
        //
        // > Throttled with `no_trailing` specified as false or unspecified:
        // > ||||||||||||||||||||||||| (pause) |||||||||||||||||||||||||
        // > X    X    X    X    X    X        X    X    X    X    X    X
        // >
        // > Throttled with `no_trailing` specified as true:
        // > ||||||||||||||||||||||||| (pause) |||||||||||||||||||||||||
        // > X    X    X    X    X             X    X    X    X    X
        //
        // Usage:
        //
        // > var throttled = jQuery.throttle( delay, [ no_trailing, ] callback );
        // >
        // > jQuery('selector').bind( 'someevent', throttled );
        // > jQuery('selector').unbind( 'someevent', throttled );
        //
        // This also works in jQuery 1.4+:
        //
        // > jQuery('selector').bind( 'someevent', jQuery.throttle( delay, [ no_trailing, ] callback ) );
        // > jQuery('selector').unbind( 'someevent', callback );
        //
        // Arguments:
        //
        //  delay - (Number) A zero-or-greater delay in milliseconds. For event
        //    callbacks, values around 100 or 250 (or even higher) are most useful.
        //  no_trailing - (Boolean) Optional, defaults to false. If no_trailing is
        //    true, callback will only execute every `delay` milliseconds while the
        //    throttled-function is being called. If no_trailing is false or
        //    unspecified, callback will be executed one final time after the last
        //    throttled-function call. (After the throttled-function has not been
        //    called for `delay` milliseconds, the internal counter is reset)
        //  callback - (Function) A function to be executed after delay milliseconds.
        //    The `this` context and all arguments are passed through, as-is, to
        //    `callback` when the throttled-function is executed.
        //
        // Returns:
        //
        //  (Function) A new, throttled, function.

        $.throttle = jq_throttle = function (delay, no_trailing, callback, debounce_mode) {
            // After wrapper has stopped being called, this timeout ensures that
            // `callback` is executed at the proper times in `throttle` and `end`
            // debounce modes.
            var timeout_id,

                // Keep track of the last time `callback` was executed.
                last_exec = 0;

            // `no_trailing` defaults to falsy.
            if (typeof no_trailing !== 'boolean') {
                debounce_mode = callback;
                callback = no_trailing;
                no_trailing = undefined;
            }

            // The `wrapper` function encapsulates all of the throttling / debouncing
            // functionality and when executed will limit the rate at which `callback`
            // is executed.
            function wrapper() {
                var that = this,
                    elapsed = +new Date() - last_exec,
                    args = arguments;

                // Execute `callback` and update the `last_exec` timestamp.
                function exec() {
                    last_exec = +new Date();
                    callback.apply(that, args);
                };

                // If `debounce_mode` is true (at_begin) this is used to clear the flag
                // to allow future `callback` executions.
                function clear() {
                    timeout_id = undefined;
                };

                if (debounce_mode && !timeout_id) {
                    // Since `wrapper` is being called for the first time and
                    // `debounce_mode` is true (at_begin), execute `callback`.
                    exec();
                }

                // Clear any existing timeout.
                timeout_id && clearTimeout(timeout_id);

                if (debounce_mode === undefined && elapsed > delay) {
                    // In throttle mode, if `delay` time has been exceeded, execute
                    // `callback`.
                    exec();

                } else if (no_trailing !== true) {
                    // In trailing throttle mode, since `delay` time has not been
                    // exceeded, schedule `callback` to execute `delay` ms after most
                    // recent execution.
                    //
                    // If `debounce_mode` is true (at_begin), schedule `clear` to execute
                    // after `delay` ms.
                    //
                    // If `debounce_mode` is false (at end), schedule `callback` to
                    // execute after `delay` ms.
                    timeout_id = setTimeout(debounce_mode ? clear : exec, debounce_mode === undefined ? delay - elapsed : delay);
                }
            };

            // Set the guid of `wrapper` function to the same of original callback, so
            // it can be removed in jQuery 1.4+ .unbind or .die by using the original
            // callback as a reference.
            if ($.guid) {
                wrapper.guid = callback.guid = callback.guid || $.guid++;
            }

            // Return the wrapper function.
            return wrapper;
        };

        // Method: jQuery.debounce
        //
        // Debounce execution of a function. Debouncing, unlike throttling,
        // guarantees that a function is only executed a single time, either at the
        // very beginning of a series of calls, or at the very end. If you want to
        // simply rate-limit execution of a function, see the <jQuery.throttle>
        // method.
        //
        // In this visualization, | is a debounced-function call and X is the actual
        // callback execution:
        //
        // > Debounced with `at_begin` specified as false or unspecified:
        // > ||||||||||||||||||||||||| (pause) |||||||||||||||||||||||||
        // >                          X                                 X
        // >
        // > Debounced with `at_begin` specified as true:
        // > ||||||||||||||||||||||||| (pause) |||||||||||||||||||||||||
        // > X                                 X
        //
        // Usage:
        //
        // > var debounced = jQuery.debounce( delay, [ at_begin, ] callback );
        // >
        // > jQuery('selector').bind( 'someevent', debounced );
        // > jQuery('selector').unbind( 'someevent', debounced );
        //
        // This also works in jQuery 1.4+:
        //
        // > jQuery('selector').bind( 'someevent', jQuery.debounce( delay, [ at_begin, ] callback ) );
        // > jQuery('selector').unbind( 'someevent', callback );
        //
        // Arguments:
        //
        //  delay - (Number) A zero-or-greater delay in milliseconds. For event
        //    callbacks, values around 100 or 250 (or even higher) are most useful.
        //  at_begin - (Boolean) Optional, defaults to false. If at_begin is false or
        //    unspecified, callback will only be executed `delay` milliseconds after
        //    the last debounced-function call. If at_begin is true, callback will be
        //    executed only at the first debounced-function call. (After the
        //    throttled-function has not been called for `delay` milliseconds, the
        //    internal counter is reset)
        //  callback - (Function) A function to be executed after delay milliseconds.
        //    The `this` context and all arguments are passed through, as-is, to
        //    `callback` when the debounced-function is executed.
        //
        // Returns:
        //
        //  (Function) A new, debounced, function.

        $.debounce = function (delay, at_begin, callback) {
            return callback === undefined ? jq_throttle(delay, at_begin, false) : jq_throttle(delay, callback, at_begin !== false);
        };

    })(this);

    define("throttle-debounce", ["jquery"], function () {});

    //
    // Cue Poitns and Midrolls
    // ===========================================
    // mep-feature-cuepoints.js
    //
    // Introduction:
    //   adds Visual Cues to the progress time rail and request ads on reaching them.
    //  1. Each cuepoint launhes a midroll, when it finish, the player resume from the point which it left
    //  2. If the user seeks beyound a non-visited cuepoint, the player force-seek to the first non-visited cuepoint
    //

    (function ($, _) {
        //###Extend options with defaults
        $.extend(mejs.MepDefaults, {
            cuepointVisitedColor: 'rgba(255, 255, 255, 0.9)',
            cuepointColor: '#999999',
            cuePoints: [],
            cuepointCallback: function () {}
        });
        //###Extend the player with the cuepoints feature
        $.extend(MediaElementPlayer.prototype, {
            //the factory function
            buildcuepoints: function (player, controls, layers, media) {
                player.startCuepoints(player, media, controls);
            },
            startCuepoints: function (player, media, controls, e) {
                console.log('startCuepoints');
                var t = this,
                    i = 0;

                // create cuepointsState
                t.restartCuepointsState();

                // if no cuepoints are defined, create cuePoints at the cuePointInterval value
                t.createCuepointsFromInterval();

                player.setcuepoints(controls);

                // create proxies (only needed for events we want to remove later)
                t.cuepointsDurationChangeProxy = $.proxy(t.cuepointsDurationChange, t, player, media, controls);
                t.cuepointsTimeUpdateProxy = $.throttle(500, $.proxy(t.cuepointsTimeUpdate, t, player, media));
                t.cuepointsMetaProxy = $.proxy(t.cuepointsMetadata, t, player, media);
                t.mainStartedProxy = $.proxy(t.mainStarted, t, player, media, controls);
                t.prerollStartProxy = $.proxy(t.prerollStart, t, player, media, controls);
                player.container.on('mejsprerollmainstarted', t.mainStartedProxy);
                player.container.on('mejsprerollstart', t.prerollStartProxy);
                t.container.trigger('mejsprerollmainstarted');
            },
            endCuepoints: function (player, media, controls, e) {
                console.log('endCuepoints');
                player.hidecuepoints(controls);
                player.container.off('mejsprerollmainstarted', this.mainStartedProxy);
                player.container.off('mejsprerollstart', this.prerollStartProxy);
            },
            mainStarted: function (player, media, controls) {
                console.log('mejsprerollmainstarted', 'reinstall cuepoints', this.cuepointsState);

                player.setcuepoints(controls);
                player.showcuepoints(controls);

                // reinstall event handlers after ads ended
                player.$media.on('durationchange', player.cuepointsDurationChangeProxy);
                player.$media.on('timeupdate', player.cuepointsTimeUpdateProxy);
                player.$media.on('loadedmetadata', player.cuepointsMetaProxy);
            },
            prerollStart: function (player, media, controls) {
                console.log('mejsprerollstart', 'remove cuepoints');
                player.hidecuepoints(controls);

                // remove event handlers on ads
                player.$media.off('durationchange', player.cuepointsDurationChangeProxy);
                player.$media.off('timeupdate', player.cuepointsTimeUpdateProxy);
                player.$media.off('loadedmetadata', player.cuepointsMetaProxy);
            },
            cuepointsMetadata: function (player, media, controls, e) {
                console.log('cuepointsMetadata', media.src, player.adsCurrentMediaTime);
                //To fix iOS issues with seek after load
                if (player.adsCurrentMediaTime > 0) {
                    if (mejs.MediaFeatures.isiOS) {
                        // iOS devices fire an error if currentTime is set before the video started playing
                        // this will only set the time on the first timeupdate after canplay... everything else fails
                        // http://stackoverflow.com/a/11266328
                        media.currentTime = player.adsCurrentMediaTime;
                        player.$media.one("canplay", function () {
                            player.$media.one("timeupdate", function () {
                                //restore the currentTime
                                media.currentTime = player.adsCurrentMediaTime;
                            });
                        });
                    } else {
                        // seek directly after play was executed for all other devices
                        media.currentTime = player.adsCurrentMediaTime;
                    }
                } else {
                    // seek not necessary
                }
            },
            createCuepointsFromInterval: function () {
                var t = this;

                console.log('createCuepointsFromInterval');

                // check if no cuepoints are defined but cuePointInterval value is
                if (!t.usingCuePointinterval && t.options.cuePoints.length === 0 && t.options.cuePointInterval !== 0) {
                    t.usingCuePointinterval = true;
                }

                if (t.usingCuePointinterval) {

                    // check if loaded source is not an ad and has a duration value
                    if (!t.media.isAd && !isNaN(t.media.duration)) {

                        // populate cuepoints array
                        t.options.cuePoints = _.range(t.options.cuePointInterval, t.media.duration, t.options.cuePointInterval);
                    }
                }
            },
            cuepointsDurationChange: function (player, media, controls, e) {
                console.log('cuepointsDurationChange', media.duration);

                var t = this;

                if (!t.media.isAd) {
                    // create cuePoints at the cuePointInterval value
                    t.createCuepointsFromInterval();

                    t.cuepointsState.duration = media.duration;
                    player.container.trigger('mejsaddurationchage', media.duration);
                    player.setcuepoints(controls);
                }
            },
            cuepointsTimeUpdate: function (player, media, e) {

                player.container.trigger('mejsadtimeupdate', media.currentTime);
                console.log('cuepointsTimeUpdate', media.src);

                var i = 0,
                    currentPos,
                    currentCuepoint;

                currentPos = Math.floor(media.currentTime);

                if (player.cuepointsState.lastPlayPos > currentPos) {
                    if (player.cuepointsState.lastCuepointCallBack > currentPos) {
                        player.cuepointsState.lastCuepointCallBack = -1;
                    }
                } else {
                    player.cuepointsState.lastPlayPos = currentPos;
                }

                currentCuepoint = _(player.options.cuePoints)
                    .sort(function (l, r) {
                        return (l * 1) > (r * 1);
                    })
                    .map(Math.floor)
                    .detect(function (currentCuepoint) {
                        return (player.cuepointsState.visited.indexOf(currentCuepoint) === -1) &&
                            (currentPos >= currentCuepoint && currentCuepoint !== player.cuepointsState.lastCuepointCallBack);
                    });

                if ((currentCuepoint === undefined) || (player.media.paused)) {
                    return;
                }

                player.cuepointsState.lastCuepointCallBack = currentCuepoint;
                player.cuepointsState.visited.push(currentCuepoint);

                if (!player.canPlayAd()) {
                    return;
                }

                console.log('hit cuepoint #' + player.cuepointsState.visited.length);
                // Tell ComScore we hit a cuepoint
                this.fireComscoreCall({
                    'c5': '02',
                    'c10': (player.cuepointsState.visited.length + '-' + this.options.cuePoints.length)
                });

                media.currentTime = currentCuepoint;

                // Are we at the beginning of the video?  If so, we are done:  the first ad call
                // is associated with hitting the play button.
                if (player.cuepointsState.visited.length === 1) {
                    console.log('cuepoint: first cuepoint, no need for ad call');
                    return;
                }

                // We must be at a midroll cuepoint.  Fire off an ad call.
                console.log('cuepoint: make ad call');
                player.vastLoadAdTagInfo(
                    player.options.vastAdTagUrlTemplate,
                    function (ads) {
                        console.log('cuepoints: successful ad response');
                        var creative = ads[0].creatives[0],
                            mediaFile = creative.mediaFiles[0];
                        player.vastTracker = creative.makeTracker();
                        player.vastTracker.on('clickthrough', function (url) {
                            document.location.href = url;
                        });
                        player.adsStartPreroll(mediaFile);
                        if (player.media.paused) {
                            player.media.play();
                        }
                    },
                    function (code) {
                        if (player.media.paused) {
                            player.media.play();
                        }
                        console.log('cuepoints: error loading VAST: ' + code);
                    }
                );
            },
            setcuepoints: function (controls) {
                var t = this,
                    i = 0,
                    left,
                    currentCuepoint;

                // remove existing cuepoints
                controls.find('.mejs-time-total').find('.mejs-time-cuepoint').remove();

                // add cuepoints
                for (i = 0; i < t.options.cuePoints.length; ++i) {
                    controls.find('.mejs-time-total').append('<span class="mejs-time-cuepoint"></span>');
                }

                for (i = 0; i < t.options.cuePoints.length; ++i) {
                    currentCuepoint = Math.floor(t.options.cuePoints[i]);
                    if (currentCuepoint <= t.cuepointsState.duration && Math.floor(t.options.cuePoints[i]) >= 0) {
                        left = 100 * currentCuepoint / t.cuepointsState.duration;
                        $(controls.find('.mejs-time-cuepoint')[i]).css({
                            "left": left + "%",
                            "background": (t.cuepointsState.visited.indexOf(currentCuepoint) !== -1) ? t.options.cuepointVisitedColor : t.options.cuepointColor
                        });
                    }
                }

                t.setControlsSize();
            },
            hidecuepoints: function (controls) {
                $(controls.find('.mejs-time-cuepoint')).hide();
            },
            showcuepoints: function (controls) {
                $(controls.find('.mejs-time-cuepoint')).show();
            },
            restartCuepointsState: function () {
                var t = this;

                t.cuepointsState = {
                    visited: [], //already visited
                    lastPlayPos: -1, //Track backward seek
                    lastCuepointCallBack: -1, //Prevents successive firing of callbacks
                    duration: 0 //Prevents successive firing of callbacks
                };
            }
        });
    })(mejs.$, window._);

    define("features/mep-feature-cuepoints", function () {});
    define('jquery', function () {
        return $;
    });
    define('lodash', function () {
        return _;
    });
    define('base64', function () {
        return Base64;
    });
    define('json2', function () {
        return JSON;
    });

    return require('mp');
}));