var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { QueryDocumentKeys } from "graphql/language/visitor";
var CIRCULAR = Object.create(null);
var objToStr = Object.prototype.toString;
var QueryKeyMaker = (function () {
    function QueryKeyMaker(cacheKeyRoot) {
        this.cacheKeyRoot = cacheKeyRoot;
        this.perQueryKeyMakers = new Map();
    }
    QueryKeyMaker.prototype.forQuery = function (document) {
        if (!this.perQueryKeyMakers.has(document)) {
            this.perQueryKeyMakers.set(document, new PerQueryKeyMaker(this.cacheKeyRoot, document));
        }
        return this.perQueryKeyMakers.get(document);
    };
    return QueryKeyMaker;
}());
export { QueryKeyMaker };
var PerQueryKeyMaker = (function () {
    function PerQueryKeyMaker(cacheKeyRoot, query) {
        this.cacheKeyRoot = cacheKeyRoot;
        this.query = query;
        this.cache = new Map;
        this.lookupArray = this.cacheMethod(this.lookupArray);
        this.lookupObject = this.cacheMethod(this.lookupObject);
        this.lookupFragmentSpread = this.cacheMethod(this.lookupFragmentSpread);
    }
    PerQueryKeyMaker.prototype.cacheMethod = function (method) {
        var _this = this;
        return function (value) {
            if (_this.cache.has(value)) {
                var cached = _this.cache.get(value);
                if (cached === CIRCULAR) {
                    throw new Error("QueryKeyMaker cannot handle circular query structures");
                }
                return cached;
            }
            _this.cache.set(value, CIRCULAR);
            try {
                var result = method.call(_this, value);
                _this.cache.set(value, result);
                return result;
            }
            catch (e) {
                _this.cache.delete(value);
                throw e;
            }
        };
    };
    PerQueryKeyMaker.prototype.lookupQuery = function (document) {
        return this.lookupObject(document);
    };
    PerQueryKeyMaker.prototype.lookupSelectionSet = function (selectionSet) {
        return this.lookupObject(selectionSet);
    };
    PerQueryKeyMaker.prototype.lookupFragmentSpread = function (fragmentSpread) {
        var name = fragmentSpread.name.value;
        var fragment = null;
        this.query.definitions.some(function (definition) {
            if (definition.kind === "FragmentDefinition" &&
                definition.name.value === name) {
                fragment = definition;
                return true;
            }
            return false;
        });
        return this.lookupObject(__assign({}, fragmentSpread, { fragment: fragment }));
    };
    PerQueryKeyMaker.prototype.lookupAny = function (value) {
        if (Array.isArray(value)) {
            return this.lookupArray(value);
        }
        if (typeof value === "object" && value !== null) {
            if (value.kind === "FragmentSpread") {
                return this.lookupFragmentSpread(value);
            }
            return this.lookupObject(value);
        }
        return value;
    };
    PerQueryKeyMaker.prototype.lookupArray = function (array) {
        var elements = array.map(this.lookupAny, this);
        return this.cacheKeyRoot.lookup(objToStr.call(array), this.cacheKeyRoot.lookupArray(elements));
    };
    PerQueryKeyMaker.prototype.lookupObject = function (object) {
        var _this = this;
        var keys = safeSortedKeys(object);
        var values = keys.map(function (key) { return _this.lookupAny(object[key]); });
        return this.cacheKeyRoot.lookup(objToStr.call(object), this.cacheKeyRoot.lookupArray(keys), this.cacheKeyRoot.lookupArray(values));
    };
    return PerQueryKeyMaker;
}());
var queryKeyMap = Object.create(null);
Object.keys(QueryDocumentKeys).forEach(function (parentKind) {
    var childKeys = queryKeyMap[parentKind] = Object.create(null);
    QueryDocumentKeys[parentKind].forEach(function (childKey) {
        childKeys[childKey] = true;
    });
    if (parentKind === "FragmentSpread") {
        childKeys["fragment"] = true;
    }
});
function safeSortedKeys(object) {
    var keys = Object.keys(object);
    var keyCount = keys.length;
    var knownKeys = typeof object.kind === "string" && queryKeyMap[object.kind];
    var target = 0;
    for (var source = target; source < keyCount; ++source) {
        var key = keys[source];
        var value = object[key];
        var isObjectOrArray = value !== null && typeof value === "object";
        if (!isObjectOrArray || !knownKeys || knownKeys[key] === true) {
            keys[target++] = key;
        }
    }
    keys.length = target;
    return keys.sort();
}
//# sourceMappingURL=queryKeyMaker.js.map