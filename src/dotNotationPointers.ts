/**
 * istanbul ignore next
 * @type {function(*, *): DotNotationPointer[]}
 */
export const DotNotationPointers = function (rootObject, property) {
    if (property === undefined) {
        property = [];
    } else if (!(property instanceof Array)) {
        property = property.split('.');
    }

    return createPointers(rootObject, property);
};

/**
 * istanbul ignore next
 * an object that is passed a dot-syntax property path and can manipulate the value at that path
 * rootObject is the object in which a value will be pointed to
 * property can either be:
 * a string, in which case it can have dot notation like "a.b.c"
 * an array, in which case, each member of the array is a property of the last property (e.g. ['a','b'] is the same thing as "a.b")
 * @param rootObject
 * @param property
 * @param propertyInfo
 * @constructor
 */
const DotNotationPointer = function (rootObject, property, propertyInfo) {
    this.root = rootObject;
    if (property === undefined) {
        this.property = [];
    } else if (property instanceof Array) {
        this.property = property;
    } else {
        this.property = property.split('.');
    }

    if (propertyInfo !== undefined) {
        this.propertyInfo = propertyInfo;
    }
};

/*istanbul ignore next*/
function createPointers(rootObject, propertyParts) {
    const initialObject = { dummy: rootObject };
    let curInfoObjects = [{ obj: initialObject, last: 'dummy', propertyPath: [] }];

    propertyParts.forEach(function (part) {
        const nextInfoObjects = [];
        curInfoObjects.forEach(function (current) {
            var curValue = getValue(current.obj, current.last);
            if (curValue instanceof Array && !isInteger(part)) {
                curValue.forEach(function (property, index) {
                    nextInfoObjects.push({ obj: getValue(curValue, index), propertyPath: current.propertyPath.concat(index, part), last: part });
                });
            } else {
                nextInfoObjects.push({ obj: curValue, propertyPath: current.propertyPath.concat(part), last: part });
            }
        });

        curInfoObjects = nextInfoObjects;
    });

    return curInfoObjects.map(function (current) {
        let last;
        let obj;
        if (current.obj === initialObject) {
            obj = current.obj.dummy;
            last = undefined;
        } else {
            obj = current.obj;
            last = current.last;
        }
        return new DotNotationPointer(rootObject, current.propertyPath, { obj: obj, last: last });
    });
}
/*istanbul ignore next*/

function getValue(object, key) {
    if (object === undefined) return undefined;
    else return object[key];
}

DotNotationPointer.prototype = {};

/**
 * getter and setter for the value being pointed to
 * istanbul ignore next
 */
Object.defineProperty(DotNotationPointer.prototype, 'val', {
    get: function () {
        var info = this.propertyInfo;
        if (info.obj === undefined) {
            return undefined;
        } else {
            if (info.last !== undefined) {
                return info.obj[info.last];
            } else {
                return info.obj;
            }
        }
    },
    set: function (value) {
        if (value === undefined) {
            if (this.propertyInfo.obj !== undefined) {
                delete this.propertyInfo.obj[this.propertyInfo.last];
            }
        } else {
            if (this.propertyInfo.obj === undefined) {
                // create the path if it doesn't exist
                createProperty(this);
            }

            this.propertyInfo.obj[this.propertyInfo.last] = value;
        }
    },
});

/*istanbul ignore next*/

function createProperty(that) {
    let newValue;
    let result = that.root;
    const lastIndex = that.property.length - 1;
    for (let n = 0; n < lastIndex; n++) {
        let value = result[that.property[n]];
        if (value === undefined) {
            if (isInteger(that.property[n + 1])) {
                newValue = [];
            } else {
                newValue = {};
            }

            value = result[that.property[n]] = newValue;
        }

        result = value;
    }

    that.propertyInfo = { obj: result, last: that.property[lastIndex] };
}

/**
 * istanbul ignore next
 * @param v
 * @returns {boolean}
 */
function isInteger(v) {
    const number = parseInt(v);
    return !isNaN(number);
}
