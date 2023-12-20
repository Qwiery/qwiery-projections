const singleValueOperators = { $gt: 1, $gte: 1, $lt: 1, $lte: 1, $not: 1 }; // note that $not is only this type if it has no 'parts'
const possibleMultiValueOperators = { $eq: 1, $ne: 1 };
const arrayOperators = { $nin: 1, $all: 1, $in: 1 };

/**
 * istanbul ignore next
 * @type {function(*, *, *): {}}
 */
export const mapValues = function (parts, callback, prefix=undefined) {
    const result = {};
    parts.forEach(function (part) {
        let value;
        let field;
        if (part.field !== undefined) {
            if (prefix !== undefined) {
                field = prefix + '.' + part.field;
            } else {
                field = part.field;
            }
        } else {
            field = prefix;
        }

        if (part.parts.length === 0) {
            if (part.operator in singleValueOperators) {
                if (part.field !== undefined) {
                    // normal situation
                    addOperator(result, part.field, part.operator, callback(field, part.operand));
                } else {
                    // if its inside an $elemMatch query
                    result[part.operator] = callback(field, part.operand);
                }
            } else if (part.operator in possibleMultiValueOperators) {
                if (part.operand instanceof Array) {
                    value = part.operand.map(function (v) {
                        return callback(field, v);
                    });
                } else {
                    value = callback(field, part.operand);
                }

                addOperator(result, part.field, part.operator, value);
            } else if (part.operator in arrayOperators) {
                addOperator(
                    result,
                    part.field,
                    part.operator,
                    part.operand.map(function (v) {
                        return callback(part.field, v);
                    })
                );
            } else if (part.operator === '$text') {
                result.$text = { $search: callback(field, part.operand.$search) };
                if (part.operand.$language !== undefined) {
                    result.$text.$language = part.operand.$language;
                }
            } else {
                // independent operators with no value
                // don't map anything
                if (part.field !== undefined) {
                    addOperator(result, part.field, part.operator, part.operand);
                } else {
                    result[part.operator] = part.operand;
                }
            }
        } else {
            if (part.operator === '$elemMatch') {
                const mappedValue = mapValues(part.parts, callback, field);
                addOperator(result, part.field, part.operator, mappedValue);
            } else if (part.operator === '$not') {
                result[part.operator] = mapValues(part.parts, callback, field);
            } else {
                const operands = [];
                part.parts.forEach(function (innerPart) {
                    operands.push(mapValues(innerPart.parts, callback));
                });
                result[part.operator] = operands;
            }
        }
    });

    return result;
};

/**
 * adds an operator to a field, handling the case where there is already another operator there
 * istanbul ignore next
 * @param obj
 * @param field
 * @param operator
 * @param operand
 */
function addOperator(obj, field, operator, operand) {
    if (obj[field] === undefined) {
        obj[field] = {};
    }

    obj[field][operator] = operand;
}
