import {mapValues} from './mapValues';
import {matches} from './matches';
import {DotNotationPointers} from './dotNotationPointers';
import {fa} from "@faker-js/faker";

// const DotNotationPointers = (exports.DotNotationPointers = DotNotationPointers0);

// routerDefinition should be a function that gets a Route object as its `this` context
// const Parse = function (mongoQuery) {
//     this.parts = parseQuery(mongoQuery);
// };
// Parse.prototype = {};

// instance methods
// Parse.prototype.map = function (callback) {
//     return map(this.parts, callback);
// };
// decanonicalizes the query to remove any $and or $eq that can be merged up with its parent object
// compresses in place (mutates)
// istanbul ignore next
export function compressQuery(x) {
    for (var operator in complexFieldIndependantOperators) {
        if (operator in x) {
            x[operator].forEach(function (query) {
                compressQuery(query);
            });
        }
    }
    if ('$and' in x) {
        x.$and.forEach(function (andOperand) {
            for (var k in andOperand) {
                if (k in x) {
                    if (!(x[k] instanceof Array) && typeof x[k] === 'object' && k[0] !== '$') {
                        for (var operator in andOperand[k]) {
                            if (!(operator in x[k])) {
                                x[k][operator] = andOperand[k][operator];
                                delete andOperand[k][operator];
                                if (Object.keys(andOperand[k]).length === 0) delete andOperand[k];
                            }
                        }
                    }
                } else {
                    x[k] = andOperand[k];
                    delete andOperand[k];
                }
            }
        });
        x.$and = filterEmpties(x.$and);
        if (x.$and.length === 0) {
            delete x.$and;
        }
    }
    if ('$or' in x) {
        x.$or = filterEmpties(x.$or);
        if (x.$or.length === 0) {
            delete x.$or;
        } else if (x.$or.length === 1) {
            var orOperand = x.$or[0];
            delete x.$or;
            mergeQueries(x, orOperand);
        }
    }

    for (var k in x) {
        if (x[k] && x[k].$eq !== undefined && Object.keys(x[k]).length === 1) {
            x[k] = x[k].$eq;
        }
        if (x[k] && x[k].$elemMatch !== undefined) {
            compressQuery(x[k].$elemMatch);
        }
    }

    return x;

    function filterEmpties(a) {
        return a.filter(function (operand) {
            if (Object.keys(operand).length === 0) return false;
            else return true;
        });
    }
}
//
// Parse.prototype.mapValues = function (callback) {
//     return compressQuery(mapValues(this.parts, callback));
// };
// Parse.prototype.matches = function (document, validate) {
//     return matches(this.parts, document, validate);
// };

export function parseProjection(mongoQuery: any) {
    return new Parse(mongoQuery);
}

export function inclusive(mongoProjection) {
    return isInclusive(mongoProjection);
}

export class Parse{public parts: Part[]
    constructor(mongoQuery: any) {
        this.parts = parseQuery(mongoQuery);
    }
    map(callback) {
        return map(this.parts, callback);
    }
    mapValues(callback) {
        return compressQuery(mapValues(this.parts, callback));
    }
    matches(document, validate) {
        return matches(this.parts, document, validate);
    }

    toJSON() {
        return {
            typeName: "Parse",
            parts: this.parts.map(p => p.toJSON())
        }
    }
    toTree(){

    }
}
//istanbul ignore next
export function search(documents, query, sort, validate) {
    const parsedQuery = new Parse(query);

    return documents
        .filter(function (doc) {
            return parsedQuery.matches(doc, validate);
        })
        .sort(function (a, b) {
            for (var k in sort) {
                var result = sortCompare(a, b, k);
                if (result !== 0) {
                    if (sort[k] < 0) result = -result;

                    return result;
                }
            }

            return 0; // if it got here, they're the same
        });
}

const complexFieldIndependantOperators = {$and: 1, $or: 1, $nor: 1};
const simpleFieldIndependantOperators = {$text: 1, $comment: 1};

// compares two documents by a single sort property
// istanbul ignore next
function sortCompare(a, b, sortProperty) {
    var aVal = DotNotationPointers(a, sortProperty)[0].val; // todo: figure out what mongo does with multiple matching sort properties
    var bVal = DotNotationPointers(b, sortProperty)[0].val;

    if (aVal > bVal) {
        return 1;
    } else if (aVal < bVal) {
        return -1;
    } else {
        return 0;
    }
}

// istanbul ignore next
function isInclusive(projection) {
    for (var k in projection) {
        if (!projection[k]) {
            if (k !== '_id') {
                return false;
            }
        } else if (k === '$meta') {
            return true;
        } else if (projection[k]) {
            if (projection[k] instanceof Object && ('$elemMatch' in projection[k] || '$slice' in projection[k])) {
                // ignore
            } else {
                return true;
            }
        }
    }
}

// istanbul ignore next
// const Part = function (field, operator, operand, parts, implicitField) {
//     if (parts === undefined) parts = [];
//
//     this.field = field;
//     this.operator = operator;
//     this.operand = operand;
//     this.parts = parts;
//     this.implicitField = implicitField; // only used for a certain type of $elemMatch part
// };
export class Part {
    constructor(
        public field: string,
        public operator: string,
        public operand: any,
        public parts: Part[] = [],
        public implicitField: boolean = false) {
    }



    toJSON() {
        return {
            typeName: "Part",
            field: this.field,
            operator: this.operator,
            operand: this.operand,
            parts: this.parts.map(p => p.toJSON()),
            implicitField: this.implicitField
        }
    }
}

// istanbul ignore next
function parseQuery(query) {
    if (query instanceof Function || typeof query === 'string') {
        if (query instanceof Function) {
            query = '(' + query + ').call(obj)';
        }

        var normalizedFunction = new Function('return function(){var obj=this; return ' + query + '}')();
        return [new Part(undefined, '$where', normalizedFunction)];
    }
    // else

    var parts = [];
    for (var key in query) {
        if (key in complexFieldIndependantOperators) {
            // a field-independant operator
            var operator = key;
            var operands = query[key];
            var innerParts = [];
            operands.forEach(function (operand) {
                innerParts.push(new Part(undefined, '$and', [operand], parseQuery(operand)));
            });

            parts.push(new Part(undefined, operator, query[key], innerParts));
        } else if (key in simpleFieldIndependantOperators) {
            parts.push(new Part(undefined, key, query[key]));
        } else {
            // a field
            var field = key;
            if (isObject(query[key]) && fieldOperand(query[key])) {
                for (var innerOperator in query[key]) {
                    var innerOperand = query[key][innerOperator];
                    parts.push(parseFieldOperator(field, innerOperator, innerOperand));
                }
            } else {
                // just a value, shorthand for $eq
                parts.push(new Part(field, '$eq', query[key]));
            }
        }
    }

    return parts;
}

// istanbul ignore next
function map(parts, callback) {
    const result = {};
    parts.forEach(function (part) {
        let mappedResult;
        if (part.operator === '$and') {
            mappedResult = map(part.parts, callback);
        } else if (part.operator in complexFieldIndependantOperators) {
            var mappedParts = part.parts.map(function (part) {
                return map(part.parts, callback);
            });
            mappedResult = {$or: mappedParts};
        } else {
            var value = {};
            value[part.operator] = part.operand;
            var cbResult = callback(part.field, value);
            mappedResult = processMappedResult(part, cbResult);
        }

        mergeQueries(result, mappedResult);
    });

    compressQuery(result);
    return result;

    function processMappedResult(part, mappedResult) {
        if (mappedResult === undefined) {
            var result = {};
            if (part.field === undefined) {
                result[part.operator] = part.operand;
            } else {
                var operation = {};
                operation[part.operator] = part.operand;
                result[part.field] = operation;
            }

            return result;
        } else if (mappedResult === null) {
            return {};
        } else {
            return mappedResult;
        }
    }
}

// merges query b into query a, resolving conflicts by using $and (or other techniques)
// istanbul ignore next
function mergeQueries(a, b) {
    for (var k in b) {
        if (k in a) {
            if (k === '$and') {
                a[k] = a[k].concat(b[k]);
            } else {
                var andOperandA = {};
                andOperandA[k] = a[k];
                var andOperandB = {};
                andOperandB[k] = b[k];
                var and = {$and: [andOperandA, andOperandB]};
                delete a[k];
                mergeQueries(a, and);
            }
        } else {
            a[k] = b[k];
        }
    }
}

// returns a Part object
// istanbul ignore next
function parseFieldOperator(field, operator, operand) {
    let innerParts, implicitField;
    if (operator === '$elemMatch') {
        const elemMatchInfo = parseElemMatch(operand);
        innerParts = elemMatchInfo.parts;
        implicitField = elemMatchInfo.implicitField;
    } else if (operator === '$not') {
        innerParts = parseNot(field, operand);
    } else {
        innerParts = [];
    }
    return new Part(field, operator, operand, innerParts, implicitField);
}

// takes in the operand of the $elemMatch operator
// returns the parts that operand parses to, and the implicitField value
// istanbul ignore next
function parseElemMatch(operand) {
    if (fieldOperand(operand)) {
        const parts = [];
        for (const operator in operand) {
            const innerOperand = operand[operator];
            parts.push(parseFieldOperator(undefined, operator, innerOperand));
        }
        return {parts: parts, implicitField: true};
    } else {
        // non-field operators ( stuff like {a:5} or {$and:[...]} )
        return {parts: parseQuery(operand), implicitField: false};
    }
}

// istanbul ignore next
function parseNot(field, operand) {
    var parts = [];
    for (var operator in operand) {
        var subOperand = operand[operator];
        parts.push(parseFieldOperator(field, operator, subOperand));
    }
    return parts;
}

// returns true for objects like {$gt:5}, {$elemMatch:{...}}
// returns false for objects like {x:4} and {$or:[...]}
// istanbul ignore next
function fieldOperand(obj) {
    for (var key in obj) {
        return key[0] === '$' && !(key in complexFieldIndependantOperators); // yes i know this won't actually loop
    }
}

// returns true if the value is an object and *not* an array
// istanbul ignore next
function isObject(value) {
    return value instanceof Object && !(value instanceof Array);
}
