(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('apollo-cache'), require('graphql/language/visitor'), require('graphql/language/printer'), require('apollo-utilities')) :
    typeof define === 'function' && define.amd ? define(['exports', 'apollo-cache', 'graphql/language/visitor', 'graphql/language/printer', 'apollo-utilities'], factory) :
    (factory((global.apollo = global.apollo || {}, global.apollo.cache = global.apollo.cache || {}, global.apollo.cache.inmemory = {}),global.apolloCache.core,global.visitor,global.print,global.apollo.utilities));
}(this, (function (exports,apolloCache,visitor,printer,apolloUtilities) { 'use strict';

    var testMap = new Map();
    if (testMap.set(1, 2) !== testMap) {
        var set_1 = testMap.set;
        Map.prototype.set = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            set_1.apply(this, args);
            return this;
        };
    }
    var testSet = new Set();
    if (testSet.add(3) !== testSet) {
        var add_1 = testSet.add;
        Set.prototype.add = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            add_1.apply(this, args);
            return this;
        };
    }
    var frozen = {};
    if (typeof Object.freeze === 'function') {
        Object.freeze(frozen);
    }
    try {
        testMap.set(frozen, frozen).delete(frozen);
    }
    catch (_a) {
        var wrap = function (method) {
            return method && (function (obj) {
                try {
                    testMap.set(obj, obj).delete(obj);
                }
                finally {
                    return method.call(Object, obj);
                }
            });
        };
        Object.freeze = wrap(Object.freeze);
        Object.seal = wrap(Object.seal);
        Object.preventExtensions = wrap(Object.preventExtensions);
    }

    var haveWarned = false;
    var HeuristicFragmentMatcher = (function () {
        function HeuristicFragmentMatcher() {
        }
        HeuristicFragmentMatcher.prototype.ensureReady = function () {
            return Promise.resolve();
        };
        HeuristicFragmentMatcher.prototype.canBypassInit = function () {
            return true;
        };
        HeuristicFragmentMatcher.prototype.match = function (idValue, typeCondition, context) {
            var obj = context.store.get(idValue.id);
            if (!obj && idValue.id === 'ROOT_QUERY') {
                return true;
            }
            if (!obj) {
                return false;
            }
            if (!obj.__typename) {
                if (!haveWarned) {
                    console.warn("You're using fragments in your queries, but either don't have the addTypename:\n  true option set in Apollo Client, or you are trying to write a fragment to the store without the __typename.\n   Please turn on the addTypename option and include __typename when writing fragments so that Apollo Client\n   can accurately match fragments.");
                    console.warn('Could not find __typename on Fragment ', typeCondition, obj);
                    console.warn("DEPRECATION WARNING: using fragments without __typename is unsupported behavior " +
                        "and will be removed in future versions of Apollo client. You should fix this and set addTypename to true now.");
                    if (!apolloUtilities.isTest()) {
                        haveWarned = true;
                    }
                }
                return 'heuristic';
            }
            if (obj.__typename === typeCondition) {
                return true;
            }
            apolloUtilities.warnOnceInDevelopment('You are using the simple (heuristic) fragment matcher, but your ' +
                'queries contain union or interface types. Apollo Client will not be ' +
                'able to accurately map fragments. To make this error go away, use ' +
                'the `IntrospectionFragmentMatcher` as described in the docs: ' +
                'https://www.apollographql.com/docs/react/recipes/fragment-matching.html', 'error');
            return 'heuristic';
        };
        return HeuristicFragmentMatcher;
    }());
    var IntrospectionFragmentMatcher = (function () {
        function IntrospectionFragmentMatcher(options) {
            if (options && options.introspectionQueryResultData) {
                this.possibleTypesMap = this.parseIntrospectionResult(options.introspectionQueryResultData);
                this.isReady = true;
            }
            else {
                this.isReady = false;
            }
            this.match = this.match.bind(this);
        }
        IntrospectionFragmentMatcher.prototype.match = function (idValue, typeCondition, context) {
            if (!this.isReady) {
                throw new Error('FragmentMatcher.match() was called before FragmentMatcher.init()');
            }
            var obj = context.store.get(idValue.id);
            if (!obj) {
                return false;
            }
            if (!obj.__typename) {
                throw new Error("Cannot match fragment because __typename property is missing: " + JSON.stringify(obj));
            }
            if (obj.__typename === typeCondition) {
                return true;
            }
            var implementingTypes = this.possibleTypesMap[typeCondition];
            if (implementingTypes && implementingTypes.indexOf(obj.__typename) > -1) {
                return true;
            }
            return false;
        };
        IntrospectionFragmentMatcher.prototype.parseIntrospectionResult = function (introspectionResultData) {
            var typeMap = {};
            introspectionResultData.__schema.types.forEach(function (type) {
                if (type.kind === 'UNION' || type.kind === 'INTERFACE') {
                    typeMap[type.name] = type.possibleTypes.map(function (implementingType) { return implementingType.name; });
                }
            });
            return typeMap;
        };
        return IntrospectionFragmentMatcher;
    }());

    var wrap$1 = require('optimism').wrap;
    var CacheKeyNode = (function () {
        function CacheKeyNode() {
            this.children = null;
            this.key = null;
        }
        CacheKeyNode.prototype.lookup = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return this.lookupArray(args);
        };
        CacheKeyNode.prototype.lookupArray = function (array) {
            var node = this;
            array.forEach(function (value) {
                node = node.getOrCreate(value);
            });
            return node.key || (node.key = Object.create(null));
        };
        CacheKeyNode.prototype.getOrCreate = function (value) {
            var map = this.children || (this.children = new Map());
            var node = map.get(value);
            if (!node) {
                map.set(value, node = new CacheKeyNode());
            }
            return node;
        };
        return CacheKeyNode;
    }());

    var hasOwn = Object.prototype.hasOwnProperty;
    var DepTrackingCache = (function () {
        function DepTrackingCache(data) {
            if (data === void 0) { data = Object.create(null); }
            var _this = this;
            this.data = data;
            this.depend = wrap$1(function (dataId) { return _this.data[dataId]; }, {
                disposable: true,
                makeCacheKey: function (dataId) {
                    return dataId;
                }
            });
        }
        DepTrackingCache.prototype.toObject = function () {
            return this.data;
        };
        DepTrackingCache.prototype.get = function (dataId) {
            this.depend(dataId);
            return this.data[dataId];
        };
        DepTrackingCache.prototype.set = function (dataId, value) {
            var oldValue = this.data[dataId];
            if (value !== oldValue) {
                this.data[dataId] = value;
                this.depend.dirty(dataId);
            }
        };
        DepTrackingCache.prototype.delete = function (dataId) {
            if (hasOwn.call(this.data, dataId)) {
                delete this.data[dataId];
                this.depend.dirty(dataId);
            }
        };
        DepTrackingCache.prototype.clear = function () {
            this.replace(null);
        };
        DepTrackingCache.prototype.replace = function (newData) {
            var _this = this;
            if (newData) {
                Object.keys(newData).forEach(function (dataId) {
                    _this.set(dataId, newData[dataId]);
                });
                Object.keys(this.data).forEach(function (dataId) {
                    if (!hasOwn.call(newData, dataId)) {
                        _this.delete(dataId);
                    }
                });
            }
            else {
                Object.keys(this.data).forEach(function (dataId) {
                    _this.delete(dataId);
                });
            }
        };
        return DepTrackingCache;
    }());
    function defaultNormalizedCacheFactory(seed) {
        return new DepTrackingCache(seed);
    }

    var __assign = (undefined && undefined.__assign) || function () {
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
    Object.keys(visitor.QueryDocumentKeys).forEach(function (parentKind) {
        var childKeys = queryKeyMap[parentKind] = Object.create(null);
        visitor.QueryDocumentKeys[parentKind].forEach(function (childKey) {
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

    var __assign$1 = (undefined && undefined.__assign) || function () {
        __assign$1 = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign$1.apply(this, arguments);
    };
    var StoreReader = (function () {
        function StoreReader(cacheKeyRoot) {
            if (cacheKeyRoot === void 0) { cacheKeyRoot = new CacheKeyNode; }
            var _this = this;
            this.cacheKeyRoot = cacheKeyRoot;
            var reader = this;
            var executeStoreQuery = reader.executeStoreQuery, executeSelectionSet = reader.executeSelectionSet;
            reader.keyMaker = new QueryKeyMaker(cacheKeyRoot);
            this.executeStoreQuery = wrap$1(function (options) {
                return executeStoreQuery.call(_this, options);
            }, {
                makeCacheKey: function (_a) {
                    var query = _a.query, rootValue = _a.rootValue, contextValue = _a.contextValue, variableValues = _a.variableValues, fragmentMatcher = _a.fragmentMatcher;
                    if (contextValue.store instanceof DepTrackingCache) {
                        return reader.cacheKeyRoot.lookup(reader.keyMaker.forQuery(query).lookupQuery(query), contextValue.store, fragmentMatcher, JSON.stringify(variableValues), rootValue.id);
                    }
                    return;
                }
            });
            this.executeSelectionSet = wrap$1(function (options) {
                return executeSelectionSet.call(_this, options);
            }, {
                makeCacheKey: function (_a) {
                    var selectionSet = _a.selectionSet, rootValue = _a.rootValue, execContext = _a.execContext;
                    if (execContext.contextValue.store instanceof DepTrackingCache) {
                        return reader.cacheKeyRoot.lookup(reader.keyMaker.forQuery(execContext.query).lookupSelectionSet(selectionSet), execContext.contextValue.store, execContext.fragmentMatcher, JSON.stringify(execContext.variableValues), rootValue.id);
                    }
                    return;
                }
            });
        }
        StoreReader.prototype.readQueryFromStore = function (options) {
            var optsPatch = { returnPartialData: false };
            return this.diffQueryAgainstStore(__assign$1({}, options, optsPatch)).result;
        };
        StoreReader.prototype.diffQueryAgainstStore = function (_a) {
            var store = _a.store, query = _a.query, variables = _a.variables, previousResult = _a.previousResult, _b = _a.returnPartialData, returnPartialData = _b === void 0 ? true : _b, _c = _a.rootId, rootId = _c === void 0 ? 'ROOT_QUERY' : _c, fragmentMatcherFunction = _a.fragmentMatcherFunction, config = _a.config;
            var queryDefinition = apolloUtilities.getQueryDefinition(query);
            variables = apolloUtilities.assign({}, apolloUtilities.getDefaultValues(queryDefinition), variables);
            var context = {
                store: store,
                dataIdFromObject: (config && config.dataIdFromObject) || null,
                cacheRedirects: (config && config.cacheRedirects) || {},
            };
            var execResult = this.executeStoreQuery({
                query: query,
                rootValue: {
                    type: 'id',
                    id: rootId,
                    generated: true,
                    typename: 'Query',
                },
                contextValue: context,
                variableValues: variables,
                fragmentMatcher: fragmentMatcherFunction,
            });
            var hasMissingFields = execResult.missing && execResult.missing.length > 0;
            if (hasMissingFields && !returnPartialData) {
                execResult.missing.forEach(function (info) {
                    if (info.tolerable)
                        return;
                    throw new Error("Can't find field " + info.fieldName + " on object " + JSON.stringify(info.object, null, 2) + ".");
                });
            }
            if (previousResult) {
                if (apolloUtilities.isEqual(previousResult, execResult.result)) {
                    execResult.result = previousResult;
                }
            }
            return {
                result: execResult.result,
                complete: !hasMissingFields,
            };
        };
        StoreReader.prototype.executeStoreQuery = function (_a) {
            var query = _a.query, rootValue = _a.rootValue, contextValue = _a.contextValue, variableValues = _a.variableValues, _b = _a.fragmentMatcher, fragmentMatcher = _b === void 0 ? defaultFragmentMatcher : _b;
            var mainDefinition = apolloUtilities.getMainDefinition(query);
            var fragments = apolloUtilities.getFragmentDefinitions(query);
            var fragmentMap = apolloUtilities.createFragmentMap(fragments);
            var execContext = {
                query: query,
                fragmentMap: fragmentMap,
                contextValue: contextValue,
                variableValues: variableValues,
                fragmentMatcher: fragmentMatcher,
            };
            return this.executeSelectionSet({
                selectionSet: mainDefinition.selectionSet,
                rootValue: rootValue,
                execContext: execContext,
            });
        };
        StoreReader.prototype.executeSelectionSet = function (_a) {
            var _this = this;
            var selectionSet = _a.selectionSet, rootValue = _a.rootValue, execContext = _a.execContext;
            var fragmentMap = execContext.fragmentMap, contextValue = execContext.contextValue, variables = execContext.variableValues;
            var finalResult = {
                result: {},
            };
            var objectsToMerge = [];
            var object = contextValue.store.get(rootValue.id);
            var typename = (object && object.__typename) ||
                (rootValue.id === 'ROOT_QUERY' && 'Query') ||
                void 0;
            function handleMissing(result) {
                var _a;
                if (result.missing) {
                    finalResult.missing = finalResult.missing || [];
                    (_a = finalResult.missing).push.apply(_a, result.missing);
                }
                return result.result;
            }
            selectionSet.selections.forEach(function (selection) {
                var _a;
                if (!apolloUtilities.shouldInclude(selection, variables)) {
                    return;
                }
                if (apolloUtilities.isField(selection)) {
                    var fieldResult = handleMissing(_this.executeField(object, typename, selection, execContext));
                    if (typeof fieldResult !== 'undefined') {
                        objectsToMerge.push((_a = {},
                            _a[apolloUtilities.resultKeyNameFromField(selection)] = fieldResult,
                            _a));
                    }
                }
                else {
                    var fragment = void 0;
                    if (apolloUtilities.isInlineFragment(selection)) {
                        fragment = selection;
                    }
                    else {
                        fragment = fragmentMap[selection.name.value];
                        if (!fragment) {
                            throw new Error("No fragment named " + selection.name.value);
                        }
                    }
                    var typeCondition = fragment.typeCondition.name.value;
                    var match = execContext.fragmentMatcher(rootValue, typeCondition, contextValue);
                    if (match) {
                        var fragmentExecResult = _this.executeSelectionSet({
                            selectionSet: fragment.selectionSet,
                            rootValue: rootValue,
                            execContext: execContext,
                        });
                        if (match === 'heuristic' && fragmentExecResult.missing) {
                            fragmentExecResult = __assign$1({}, fragmentExecResult, { missing: fragmentExecResult.missing.map(function (info) {
                                    return __assign$1({}, info, { tolerable: true });
                                }) });
                        }
                        objectsToMerge.push(handleMissing(fragmentExecResult));
                    }
                }
            });
            merge(finalResult.result, objectsToMerge);
            return finalResult;
        };
        StoreReader.prototype.executeField = function (object, typename, field, execContext) {
            var variables = execContext.variableValues, contextValue = execContext.contextValue;
            var fieldName = field.name.value;
            var args = apolloUtilities.argumentsObjectFromField(field, variables);
            var info = {
                resultKey: apolloUtilities.resultKeyNameFromField(field),
                directives: apolloUtilities.getDirectiveInfoFromField(field, variables),
            };
            var readStoreResult = readStoreResolver(object, typename, fieldName, args, contextValue, info);
            if (Array.isArray(readStoreResult.result)) {
                return this.combineExecResults(readStoreResult, this.executeSubSelectedArray(field, readStoreResult.result, execContext));
            }
            if (!field.selectionSet) {
                assertSelectionSetForIdValue(field, readStoreResult.result);
                return readStoreResult;
            }
            if (readStoreResult.result == null) {
                return readStoreResult;
            }
            return this.combineExecResults(readStoreResult, this.executeSelectionSet({
                selectionSet: field.selectionSet,
                rootValue: readStoreResult.result,
                execContext: execContext,
            }));
        };
        StoreReader.prototype.combineExecResults = function () {
            var execResults = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                execResults[_i] = arguments[_i];
            }
            var missing = null;
            execResults.forEach(function (execResult) {
                if (execResult.missing) {
                    missing = missing || [];
                    missing.push.apply(missing, execResult.missing);
                }
            });
            return {
                result: execResults.pop().result,
                missing: missing,
            };
        };
        StoreReader.prototype.executeSubSelectedArray = function (field, result, execContext) {
            var _this = this;
            var missing = null;
            function handleMissing(childResult) {
                if (childResult.missing) {
                    missing = missing || [];
                    missing.push.apply(missing, childResult.missing);
                }
                return childResult.result;
            }
            result = result.map(function (item) {
                if (item === null) {
                    return null;
                }
                if (Array.isArray(item)) {
                    return handleMissing(_this.executeSubSelectedArray(field, item, execContext));
                }
                if (field.selectionSet) {
                    return handleMissing(_this.executeSelectionSet({
                        selectionSet: field.selectionSet,
                        rootValue: item,
                        execContext: execContext,
                    }));
                }
                assertSelectionSetForIdValue(field, item);
                return item;
            });
            return { result: result, missing: missing };
        };
        return StoreReader;
    }());
    function assertSelectionSetForIdValue(field, value) {
        if (!field.selectionSet && apolloUtilities.isIdValue(value)) {
            throw new Error("Missing selection set for object of type " + value.typename + " returned for query field " + field.name.value);
        }
    }
    function defaultFragmentMatcher() {
        return true;
    }
    function assertIdValue(idValue) {
        if (!apolloUtilities.isIdValue(idValue)) {
            throw new Error("Encountered a sub-selection on the query, but the store doesn't have an object reference. This should never happen during normal use unless you have custom code that is directly manipulating the store; please file an issue.");
        }
    }
    function readStoreResolver(object, typename, fieldName, args, context, _a) {
        var resultKey = _a.resultKey, directives = _a.directives;
        var storeKeyName = fieldName;
        if (args || directives) {
            storeKeyName = apolloUtilities.getStoreKeyName(storeKeyName, args, directives);
        }
        var fieldValue = void 0;
        if (object) {
            fieldValue = object[storeKeyName];
            if (typeof fieldValue === 'undefined' &&
                context.cacheRedirects &&
                typeof typename === 'string') {
                var type = context.cacheRedirects[typename];
                if (type) {
                    var resolver = type[fieldName];
                    if (resolver) {
                        fieldValue = resolver(object, args, {
                            getCacheKey: function (storeObj) {
                                return apolloUtilities.toIdValue({
                                    id: context.dataIdFromObject(storeObj),
                                    typename: storeObj.__typename,
                                });
                            },
                        });
                    }
                }
            }
        }
        if (typeof fieldValue === 'undefined') {
            return {
                result: fieldValue,
                missing: [{
                        object: object,
                        fieldName: storeKeyName,
                        tolerable: false,
                    }],
            };
        }
        if (apolloUtilities.isJsonValue(fieldValue)) {
            fieldValue = fieldValue.json;
        }
        return {
            result: fieldValue,
        };
    }
    var hasOwn$1 = Object.prototype.hasOwnProperty;
    function merge(target, sources) {
        var pastCopies = [];
        sources.forEach(function (source) {
            mergeHelper(target, source, pastCopies);
        });
        return target;
    }
    function mergeHelper(target, source, pastCopies) {
        if (source !== null && typeof source === 'object') {
            if (Object.isExtensible && !Object.isExtensible(target)) {
                target = shallowCopyForMerge(target, pastCopies);
            }
            Object.keys(source).forEach(function (sourceKey) {
                var sourceValue = source[sourceKey];
                if (hasOwn$1.call(target, sourceKey)) {
                    var targetValue = target[sourceKey];
                    if (sourceValue !== targetValue) {
                        target[sourceKey] = mergeHelper(shallowCopyForMerge(targetValue, pastCopies), sourceValue, pastCopies);
                    }
                }
                else {
                    target[sourceKey] = sourceValue;
                }
            });
        }
        return target;
    }
    function shallowCopyForMerge(value, pastCopies) {
        if (value !== null &&
            typeof value === 'object' &&
            pastCopies.indexOf(value) < 0) {
            if (Array.isArray(value)) {
                value = value.slice(0);
            }
            else {
                value = __assign$1({}, value);
            }
            pastCopies.push(value);
        }
        return value;
    }

    var ObjectCache = (function () {
        function ObjectCache(data) {
            if (data === void 0) { data = Object.create(null); }
            this.data = data;
        }
        ObjectCache.prototype.toObject = function () {
            return this.data;
        };
        ObjectCache.prototype.get = function (dataId) {
            return this.data[dataId];
        };
        ObjectCache.prototype.set = function (dataId, value) {
            this.data[dataId] = value;
        };
        ObjectCache.prototype.delete = function (dataId) {
            this.data[dataId] = undefined;
        };
        ObjectCache.prototype.clear = function () {
            this.data = Object.create(null);
        };
        ObjectCache.prototype.replace = function (newData) {
            this.data = newData || Object.create(null);
        };
        return ObjectCache;
    }());
    function defaultNormalizedCacheFactory$1(seed) {
        return new ObjectCache(seed);
    }

    var __extends = (undefined && undefined.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __assign$2 = (undefined && undefined.__assign) || function () {
        __assign$2 = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign$2.apply(this, arguments);
    };
    var WriteError = (function (_super) {
        __extends(WriteError, _super);
        function WriteError() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.type = 'WriteError';
            return _this;
        }
        return WriteError;
    }(Error));
    function enhanceErrorWithDocument(error, document) {
        var enhancedError = new WriteError("Error writing result to store for query:\n " + printer.print(document));
        enhancedError.message += '\n' + error.message;
        enhancedError.stack = error.stack;
        return enhancedError;
    }
    var StoreWriter = (function () {
        function StoreWriter() {
        }
        StoreWriter.prototype.writeQueryToStore = function (_a) {
            var query = _a.query, result = _a.result, _b = _a.store, store = _b === void 0 ? defaultNormalizedCacheFactory() : _b, variables = _a.variables, dataIdFromObject = _a.dataIdFromObject, fragmentMatcherFunction = _a.fragmentMatcherFunction;
            return this.writeResultToStore({
                dataId: 'ROOT_QUERY',
                result: result,
                document: query,
                store: store,
                variables: variables,
                dataIdFromObject: dataIdFromObject,
                fragmentMatcherFunction: fragmentMatcherFunction,
            });
        };
        StoreWriter.prototype.writeResultToStore = function (_a) {
            var dataId = _a.dataId, result = _a.result, document = _a.document, _b = _a.store, store = _b === void 0 ? defaultNormalizedCacheFactory() : _b, variables = _a.variables, dataIdFromObject = _a.dataIdFromObject, fragmentMatcherFunction = _a.fragmentMatcherFunction;
            var operationDefinition = apolloUtilities.getOperationDefinition(document);
            try {
                return this.writeSelectionSetToStore({
                    result: result,
                    dataId: dataId,
                    selectionSet: operationDefinition.selectionSet,
                    context: {
                        store: store,
                        processedData: {},
                        variables: apolloUtilities.assign({}, apolloUtilities.getDefaultValues(operationDefinition), variables),
                        dataIdFromObject: dataIdFromObject,
                        fragmentMap: apolloUtilities.createFragmentMap(apolloUtilities.getFragmentDefinitions(document)),
                        fragmentMatcherFunction: fragmentMatcherFunction,
                    },
                });
            }
            catch (e) {
                throw enhanceErrorWithDocument(e, document);
            }
        };
        StoreWriter.prototype.writeSelectionSetToStore = function (_a) {
            var _this = this;
            var result = _a.result, dataId = _a.dataId, selectionSet = _a.selectionSet, context = _a.context;
            var variables = context.variables, store = context.store, fragmentMap = context.fragmentMap;
            selectionSet.selections.forEach(function (selection) {
                if (!apolloUtilities.shouldInclude(selection, variables)) {
                    return;
                }
                if (apolloUtilities.isField(selection)) {
                    var resultFieldKey = apolloUtilities.resultKeyNameFromField(selection);
                    var value = result[resultFieldKey];
                    if (typeof value !== 'undefined') {
                        _this.writeFieldToStore({
                            dataId: dataId,
                            value: value,
                            field: selection,
                            context: context,
                        });
                    }
                    else {
                        var isDefered = selection.directives &&
                            selection.directives.length &&
                            selection.directives.some(function (directive) { return directive.name && directive.name.value === 'defer'; });
                        if (!isDefered && context.fragmentMatcherFunction) {
                            if (!apolloUtilities.isProduction()) {
                                console.warn("Missing field " + resultFieldKey + " in " + JSON.stringify(result, null, 2).substring(0, 100));
                            }
                        }
                    }
                }
                else {
                    var fragment = void 0;
                    if (apolloUtilities.isInlineFragment(selection)) {
                        fragment = selection;
                    }
                    else {
                        fragment = (fragmentMap || {})[selection.name.value];
                        if (!fragment) {
                            throw new Error("No fragment named " + selection.name.value + ".");
                        }
                    }
                    var matches = true;
                    if (context.fragmentMatcherFunction && fragment.typeCondition) {
                        var idValue = apolloUtilities.toIdValue({ id: 'self', typename: undefined });
                        var fakeContext = {
                            store: new ObjectCache({ self: result }),
                            cacheRedirects: {},
                        };
                        var match = context.fragmentMatcherFunction(idValue, fragment.typeCondition.name.value, fakeContext);
                        if (!apolloUtilities.isProduction() && match === 'heuristic') {
                            console.error('WARNING: heuristic fragment matching going on!');
                        }
                        matches = !!match;
                    }
                    if (matches) {
                        _this.writeSelectionSetToStore({
                            result: result,
                            selectionSet: fragment.selectionSet,
                            dataId: dataId,
                            context: context,
                        });
                    }
                }
            });
            return store;
        };
        StoreWriter.prototype.writeFieldToStore = function (_a) {
            var field = _a.field, value = _a.value, dataId = _a.dataId, context = _a.context;
            var _b;
            var variables = context.variables, dataIdFromObject = context.dataIdFromObject, store = context.store;
            var storeValue;
            var storeObject;
            var storeFieldName = apolloUtilities.storeKeyNameFromField(field, variables);
            if (!field.selectionSet || value === null) {
                storeValue =
                    value != null && typeof value === 'object'
                        ?
                            { type: 'json', json: value }
                        :
                            value;
            }
            else if (Array.isArray(value)) {
                var generatedId = dataId + "." + storeFieldName;
                storeValue = this.processArrayValue(value, generatedId, field.selectionSet, context);
            }
            else {
                var valueDataId = dataId + "." + storeFieldName;
                var generated = true;
                if (!isGeneratedId(valueDataId)) {
                    valueDataId = '$' + valueDataId;
                }
                if (dataIdFromObject) {
                    var semanticId = dataIdFromObject(value);
                    if (semanticId && isGeneratedId(semanticId)) {
                        throw new Error('IDs returned by dataIdFromObject cannot begin with the "$" character.');
                    }
                    if (semanticId ||
                        (typeof semanticId === 'number' && semanticId === 0)) {
                        valueDataId = semanticId;
                        generated = false;
                    }
                }
                if (!isDataProcessed(valueDataId, field, context.processedData)) {
                    this.writeSelectionSetToStore({
                        dataId: valueDataId,
                        result: value,
                        selectionSet: field.selectionSet,
                        context: context,
                    });
                }
                var typename = value.__typename;
                storeValue = apolloUtilities.toIdValue({ id: valueDataId, typename: typename }, generated);
                storeObject = store.get(dataId);
                var escapedId = storeObject && storeObject[storeFieldName];
                if (escapedId !== storeValue && apolloUtilities.isIdValue(escapedId)) {
                    var hadTypename = escapedId.typename !== undefined;
                    var hasTypename = typename !== undefined;
                    var typenameChanged = hadTypename && hasTypename && escapedId.typename !== typename;
                    if (generated && !escapedId.generated && !typenameChanged) {
                        throw new Error("Store error: the application attempted to write an object with no provided id" +
                            (" but the store already contains an id of " + escapedId.id + " for this object. The selectionSet") +
                            " that was trying to be written is:\n" +
                            printer.print(field));
                    }
                    if (hadTypename && !hasTypename) {
                        throw new Error("Store error: the application attempted to write an object with no provided typename" +
                            (" but the store already contains an object with typename of " + escapedId.typename + " for the object of id " + escapedId.id + ". The selectionSet") +
                            " that was trying to be written is:\n" +
                            printer.print(field));
                    }
                    if (escapedId.generated) {
                        if (typenameChanged) {
                            if (!generated) {
                                store.delete(escapedId.id);
                            }
                        }
                        else {
                            mergeWithGenerated(escapedId.id, storeValue.id, store);
                        }
                    }
                }
            }
            storeObject = store.get(dataId);
            if (!storeObject || !apolloUtilities.isEqual(storeValue, storeObject[storeFieldName])) {
                store.set(dataId, __assign$2({}, storeObject, (_b = {}, _b[storeFieldName] = storeValue, _b)));
            }
        };
        StoreWriter.prototype.processArrayValue = function (value, generatedId, selectionSet, context) {
            var _this = this;
            return value.map(function (item, index) {
                if (item === null) {
                    return null;
                }
                var itemDataId = generatedId + "." + index;
                if (Array.isArray(item)) {
                    return _this.processArrayValue(item, itemDataId, selectionSet, context);
                }
                var generated = true;
                if (context.dataIdFromObject) {
                    var semanticId = context.dataIdFromObject(item);
                    if (semanticId) {
                        itemDataId = semanticId;
                        generated = false;
                    }
                }
                if (!isDataProcessed(itemDataId, selectionSet, context.processedData)) {
                    _this.writeSelectionSetToStore({
                        dataId: itemDataId,
                        result: item,
                        selectionSet: selectionSet,
                        context: context,
                    });
                }
                return apolloUtilities.toIdValue({ id: itemDataId, typename: item.__typename }, generated);
            });
        };
        return StoreWriter;
    }());
    function isGeneratedId(id) {
        return id[0] === '$';
    }
    function mergeWithGenerated(generatedKey, realKey, cache) {
        if (generatedKey === realKey) {
            return false;
        }
        var generated = cache.get(generatedKey);
        var real = cache.get(realKey);
        var madeChanges = false;
        Object.keys(generated).forEach(function (key) {
            var value = generated[key];
            var realValue = real[key];
            if (apolloUtilities.isIdValue(value) &&
                isGeneratedId(value.id) &&
                apolloUtilities.isIdValue(realValue) &&
                !apolloUtilities.isEqual(value, realValue) &&
                mergeWithGenerated(value.id, realValue.id, cache)) {
                madeChanges = true;
            }
        });
        cache.delete(generatedKey);
        var newRealValue = __assign$2({}, generated, real);
        if (apolloUtilities.isEqual(newRealValue, real)) {
            return madeChanges;
        }
        cache.set(realKey, newRealValue);
        return true;
    }
    function isDataProcessed(dataId, field, processedData) {
        if (!processedData) {
            return false;
        }
        if (processedData[dataId]) {
            if (processedData[dataId].indexOf(field) >= 0) {
                return true;
            }
            else {
                processedData[dataId].push(field);
            }
        }
        else {
            processedData[dataId] = [field];
        }
        return false;
    }

    var __assign$3 = (undefined && undefined.__assign) || function () {
        __assign$3 = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign$3.apply(this, arguments);
    };
    var RecordingCache = (function () {
        function RecordingCache(data) {
            if (data === void 0) { data = {}; }
            this.data = data;
            this.recordedData = {};
        }
        RecordingCache.prototype.record = function (transaction) {
            transaction(this);
            var recordedData = this.recordedData;
            this.recordedData = {};
            return recordedData;
        };
        RecordingCache.prototype.toObject = function () {
            return __assign$3({}, this.data, this.recordedData);
        };
        RecordingCache.prototype.get = function (dataId) {
            if (this.recordedData.hasOwnProperty(dataId)) {
                return this.recordedData[dataId];
            }
            return this.data[dataId];
        };
        RecordingCache.prototype.set = function (dataId, value) {
            if (this.get(dataId) !== value) {
                this.recordedData[dataId] = value;
            }
        };
        RecordingCache.prototype.delete = function (dataId) {
            this.recordedData[dataId] = undefined;
        };
        RecordingCache.prototype.clear = function () {
            var _this = this;
            Object.keys(this.data).forEach(function (dataId) { return _this.delete(dataId); });
            this.recordedData = {};
        };
        RecordingCache.prototype.replace = function (newData) {
            this.clear();
            this.recordedData = __assign$3({}, newData);
        };
        return RecordingCache;
    }());
    function record(startingState, transaction) {
        var recordingCache = new RecordingCache(startingState);
        return recordingCache.record(transaction);
    }

    var __extends$1 = (undefined && undefined.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __assign$4 = (undefined && undefined.__assign) || function () {
        __assign$4 = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign$4.apply(this, arguments);
    };
    var defaultConfig = {
        fragmentMatcher: new HeuristicFragmentMatcher(),
        dataIdFromObject: defaultDataIdFromObject,
        addTypename: true,
    };
    function defaultDataIdFromObject(result) {
        if (result.__typename) {
            if (result.id !== undefined) {
                return result.__typename + ":" + result.id;
            }
            if (result._id !== undefined) {
                return result.__typename + ":" + result._id;
            }
        }
        return null;
    }
    var InMemoryCache = (function (_super) {
        __extends$1(InMemoryCache, _super);
        function InMemoryCache(config) {
            if (config === void 0) { config = {}; }
            var _this = _super.call(this) || this;
            _this.optimistic = [];
            _this.watches = new Set();
            _this.typenameDocumentCache = new Map();
            _this.cacheKeyRoot = new CacheKeyNode();
            _this.silenceBroadcast = false;
            _this.config = __assign$4({}, defaultConfig, config);
            if (_this.config.customResolvers) {
                console.warn('customResolvers have been renamed to cacheRedirects. Please update your config as we will be deprecating customResolvers in the next major version.');
                _this.config.cacheRedirects = _this.config.customResolvers;
            }
            if (_this.config.cacheResolvers) {
                console.warn('cacheResolvers have been renamed to cacheRedirects. Please update your config as we will be deprecating cacheResolvers in the next major version.');
                _this.config.cacheRedirects = _this.config.cacheResolvers;
            }
            _this.addTypename = _this.config.addTypename;
            _this.data = defaultNormalizedCacheFactory();
            _this.storeReader = new StoreReader(_this.cacheKeyRoot);
            _this.storeWriter = new StoreWriter();
            var cache = _this;
            var maybeBroadcastWatch = cache.maybeBroadcastWatch;
            _this.maybeBroadcastWatch = wrap$1(function (c) {
                return maybeBroadcastWatch.call(_this, c);
            }, {
                makeCacheKey: function (c) {
                    if (c.optimistic && cache.optimistic.length > 0) {
                        return;
                    }
                    if (c.previousResult) {
                        return;
                    }
                    if (cache.data instanceof DepTrackingCache) {
                        return cache.cacheKeyRoot.lookup(c.query, JSON.stringify(c.variables));
                    }
                }
            });
            return _this;
        }
        InMemoryCache.prototype.restore = function (data) {
            if (data)
                this.data.replace(data);
            return this;
        };
        InMemoryCache.prototype.extract = function (optimistic) {
            if (optimistic === void 0) { optimistic = false; }
            if (optimistic && this.optimistic.length > 0) {
                var patches = this.optimistic.map(function (opt) { return opt.data; });
                return Object.assign.apply(Object, [{}, this.data.toObject()].concat(patches));
            }
            return this.data.toObject();
        };
        InMemoryCache.prototype.read = function (query) {
            if (query.rootId && this.data.get(query.rootId) === undefined) {
                return null;
            }
            var store = (query.optimistic && this.optimistic.length)
                ? defaultNormalizedCacheFactory(this.extract(true))
                : this.data;
            return this.storeReader.readQueryFromStore({
                store: store,
                query: this.transformDocument(query.query),
                variables: query.variables,
                rootId: query.rootId,
                fragmentMatcherFunction: this.config.fragmentMatcher.match,
                previousResult: query.previousResult,
                config: this.config,
            });
        };
        InMemoryCache.prototype.write = function (write) {
            this.storeWriter.writeResultToStore({
                dataId: write.dataId,
                result: write.result,
                variables: write.variables,
                document: this.transformDocument(write.query),
                store: this.data,
                dataIdFromObject: this.config.dataIdFromObject,
                fragmentMatcherFunction: this.config.fragmentMatcher.match,
            });
            this.broadcastWatches();
        };
        InMemoryCache.prototype.diff = function (query) {
            var store = (query.optimistic && this.optimistic.length)
                ? defaultNormalizedCacheFactory(this.extract(true))
                : this.data;
            return this.storeReader.diffQueryAgainstStore({
                store: store,
                query: this.transformDocument(query.query),
                variables: query.variables,
                returnPartialData: query.returnPartialData,
                previousResult: query.previousResult,
                fragmentMatcherFunction: this.config.fragmentMatcher.match,
                config: this.config,
            });
        };
        InMemoryCache.prototype.watch = function (watch) {
            var _this = this;
            this.watches.add(watch);
            return function () {
                _this.watches.delete(watch);
            };
        };
        InMemoryCache.prototype.evict = function (query) {
            throw new Error("eviction is not implemented on InMemory Cache");
        };
        InMemoryCache.prototype.reset = function () {
            this.data.clear();
            this.broadcastWatches();
            return Promise.resolve();
        };
        InMemoryCache.prototype.removeOptimistic = function (id) {
            var _this = this;
            var toPerform = this.optimistic.filter(function (item) { return item.id !== id; });
            this.optimistic = [];
            toPerform.forEach(function (change) {
                _this.recordOptimisticTransaction(change.transaction, change.id);
            });
            this.broadcastWatches();
        };
        InMemoryCache.prototype.performTransaction = function (transaction) {
            var alreadySilenced = this.silenceBroadcast;
            this.silenceBroadcast = true;
            transaction(this);
            if (!alreadySilenced) {
                this.silenceBroadcast = false;
            }
            this.broadcastWatches();
        };
        InMemoryCache.prototype.recordOptimisticTransaction = function (transaction, id) {
            var _this = this;
            this.silenceBroadcast = true;
            var patch = record(this.extract(true), function (recordingCache) {
                var dataCache = _this.data;
                _this.data = recordingCache;
                _this.performTransaction(transaction);
                _this.data = dataCache;
            });
            this.optimistic.push({
                id: id,
                transaction: transaction,
                data: patch,
            });
            this.silenceBroadcast = false;
            this.broadcastWatches();
        };
        InMemoryCache.prototype.transformDocument = function (document) {
            if (this.addTypename) {
                var result = this.typenameDocumentCache.get(document);
                if (!result) {
                    result = apolloUtilities.addTypenameToDocument(document);
                    this.typenameDocumentCache.set(document, result);
                    this.typenameDocumentCache.set(result, result);
                }
                return result;
            }
            return document;
        };
        InMemoryCache.prototype.readQuery = function (options, optimistic) {
            if (optimistic === void 0) { optimistic = false; }
            return this.read({
                query: options.query,
                variables: options.variables,
                optimistic: optimistic,
            });
        };
        InMemoryCache.prototype.readFragment = function (options, optimistic) {
            if (optimistic === void 0) { optimistic = false; }
            return this.read({
                query: this.transformDocument(apolloUtilities.getFragmentQueryDocument(options.fragment, options.fragmentName)),
                variables: options.variables,
                rootId: options.id,
                optimistic: optimistic,
            });
        };
        InMemoryCache.prototype.writeQuery = function (options) {
            this.write({
                dataId: 'ROOT_QUERY',
                result: options.data,
                query: this.transformDocument(options.query),
                variables: options.variables,
            });
        };
        InMemoryCache.prototype.writeFragment = function (options) {
            this.write({
                dataId: options.id,
                result: options.data,
                query: this.transformDocument(apolloUtilities.getFragmentQueryDocument(options.fragment, options.fragmentName)),
                variables: options.variables,
            });
        };
        InMemoryCache.prototype.broadcastWatches = function () {
            var _this = this;
            if (!this.silenceBroadcast) {
                var optimistic_1 = this.optimistic.length > 0;
                this.watches.forEach(function (c) {
                    _this.maybeBroadcastWatch(c);
                    if (optimistic_1) {
                        _this.maybeBroadcastWatch.dirty(c);
                    }
                });
            }
        };
        InMemoryCache.prototype.maybeBroadcastWatch = function (c) {
            c.callback(this.diff({
                query: c.query,
                variables: c.variables,
                previousResult: c.previousResult && c.previousResult(),
                optimistic: c.optimistic,
            }));
        };
        return InMemoryCache;
    }(apolloCache.ApolloCache));

    exports.InMemoryCache = InMemoryCache;
    exports.defaultDataIdFromObject = defaultDataIdFromObject;
    exports.StoreReader = StoreReader;
    exports.assertIdValue = assertIdValue;
    exports.WriteError = WriteError;
    exports.enhanceErrorWithDocument = enhanceErrorWithDocument;
    exports.StoreWriter = StoreWriter;
    exports.HeuristicFragmentMatcher = HeuristicFragmentMatcher;
    exports.IntrospectionFragmentMatcher = IntrospectionFragmentMatcher;
    exports.ObjectCache = ObjectCache;
    exports.defaultNormalizedCacheFactory = defaultNormalizedCacheFactory$1;
    exports.RecordingCache = RecordingCache;
    exports.record = record;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=bundle.umd.js.map
