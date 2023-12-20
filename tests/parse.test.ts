import {describe, test, it, expect} from 'vitest'
import {parseProjection} from "../src";
import {Part} from "../src/mongoParse";

describe("Projections", function () {
    it("should project a document", function () {
        let p = parseProjection({a:4})
        let shouldBe = {
            typeName: 'Part',
            field: 'a',
            operator: '$eq',
            operand: 4,
            parts: [],
            implicitField: false
        }
        expect(p.parts.length).toEqual(1);
        expect(p.parts[0].toJSON()).toEqual(shouldBe);
        p = parseProjection({a:{$eq:4}})
        expect(p.parts[0].toJSON()).toEqual(shouldBe);

        p = parseProjection({$or:[{b:{$eq:4}},{c:{$eq:5}}]})

        expect(p.parts[0].parts.length).toEqual(2);
        console.log(p.toJSON())
    });
})
