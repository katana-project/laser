import { parser } from "@run-slicer/lezer-java";
import { expect } from "chai";
import { parseUnit } from "./unit.js";

describe("Unit Parser", () => {
    describe("Package declaration", () => {
        it("should parse simple package", () => {
            const source = "package com.example;";
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.packageName).to.equal("com.example");
        });

        it("should parse nested package", () => {
            const source = "package com.example.deep.nested;";
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.packageName).to.equal("com.example.deep.nested");
        });

        it("should handle missing package", () => {
            const source = "public class Test {}";
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.packageName).to.be.null;
        });
    });

    describe("Import declarations", () => {
        it("should parse single import", () => {
            const source = `package test;
import java.util.List;`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.imports).to.have.lengthOf(1);
            expect(unit.imports[0].importedName).to.equal("java.util.List");
            expect(unit.imports[0].kind).to.equal("type");
        });

        it("should parse wildcard import", () => {
            const source = `package test;
import java.util.*;`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.imports).to.have.lengthOf(1);
            expect(unit.imports[0].importedName).to.equal("java.util");
            expect(unit.imports[0].kind).to.equal("wildcard");
        });

        it("should parse static import", () => {
            const source = `package test;
import static java.lang.Math.PI;`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.imports).to.have.lengthOf(1);
            expect(unit.imports[0].importedName).to.equal("java.lang.Math.PI");
            expect(unit.imports[0].kind).to.equal("static");
        });

        it("should parse multiple imports", () => {
            const source = `package test;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.imports).to.have.lengthOf(3);
            expect(unit.imports[0].importedName).to.equal("java.util.List");
            expect(unit.imports[1].importedName).to.equal("java.util.ArrayList");
            expect(unit.imports[2].importedName).to.equal("java.util.Map");
        });
    });

    describe("Class declarations", () => {
        it("should parse simple class", () => {
            const source = `package test;
public class MyClass {}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].name).to.equal("MyClass");
            expect(unit.types[0].qualifiedName).to.equal("MyClass");
        });

        it("should parse class with type parameters", () => {
            const source = `package test;
public class Generic<T, U> {}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].name).to.equal("Generic");
            expect(unit.types[0].typeParameters).to.deep.equal(["T", "U"]);
        });

        it("should parse nested classes", () => {
            const source = `package test;
public class Outer {
  class Inner {
    class DeepInner {}
  }
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(3);

            const outer = unit.types.find((c) => c.name === "Outer");
            expect(outer?.qualifiedName).to.equal("Outer");

            const inner = unit.types.find((c) => c.name === "Inner");
            expect(inner?.qualifiedName).to.equal("Outer.Inner");

            const deepInner = unit.types.find((c) => c.name === "DeepInner");
            expect(deepInner?.qualifiedName).to.equal("Outer.Inner.DeepInner");
        });

        it("should parse multiple top-level classes", () => {
            const source = `package test;
class First {}
class Second {}
class Third {}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(3);
            expect(unit.types.map((c) => c.name)).to.include.members(["First", "Second", "Third"]);
        });
    });

    describe("Interface declarations", () => {
        it("should parse simple interface", () => {
            const source = `package test;
public interface MyInterface {}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].name).to.equal("MyInterface");
            expect(unit.types[0].qualifiedName).to.equal("MyInterface");
        });

        it("should parse interface with type parameters", () => {
            const source = `package test;
public interface Generic<T> {}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].typeParameters).to.deep.equal(["T"]);
        });

        it("should parse nested interfaces", () => {
            const source = `package test;
public class Outer {
  interface Inner {}
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(2);
            expect(unit.types[1].qualifiedName).to.equal("Outer.Inner");
        });

        it("should parse interface within interface", () => {
            const source = `package test;
public interface Outer {
  interface Inner {}
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(2);

            const inner = unit.types.find((i) => i.name === "Inner");
            expect(inner?.qualifiedName).to.equal("Outer.Inner");
        });
    });

    describe("Enum declarations", () => {
        it("should parse simple enum", () => {
            const source = `package test;
public enum Color {
  RED, GREEN, BLUE
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].name).to.equal("Color");
            expect(unit.types[0].typeParameters).to.have.lengthOf(0);
        });

        it("should parse nested enum", () => {
            const source = `package test;
public class Outer {
  enum Status { ACTIVE, INACTIVE }
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(2);
            const status = unit.types.find((c) => c.name === "Status");
            expect(status?.qualifiedName).to.equal("Outer.Status");
        });
    });

    describe("Complex scenarios", () => {
        it("should parse complete file structure", () => {
            const source = `package com.example.project;

import java.util.List;
import java.util.ArrayList;
import java.io.*;

public class MainClass<T> {
  private class PrivateInner {}

  public static class StaticNested {
    interface NestedInterface {}
  }
}

interface TopLevelInterface {
  class InterfaceClass {}
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.packageName).to.equal("com.example.project");
            expect(unit.imports).to.have.lengthOf(3);
            expect(unit.types).to.have.lengthOf(6);

            expect(unit.types.map((c) => c.name)).to.include.members([
                "MainClass",
                "PrivateInner",
                "StaticNested",
                "InterfaceClass",
                "TopLevelInterface",
                "NestedInterface",
            ]);
        });

        it("should handle deeply nested structures", () => {
            const source = `package test;
public class A {
  class B {
    class C {
      class D {}
    }
  }
}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(4);

            const d = unit.types.find((c) => c.name === "D");
            expect(d?.qualifiedName).to.equal("A.B.C.D");
        });

        it("should parse class with multiple type parameters", () => {
            const source = `package test;
public class MultiGeneric<K, V, T extends Comparable<T>> {}`;
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].typeParameters).to.deep.equal(["K", "V", "T"]);
        });
    });

    describe("Real sample files", () => {
        it("should parse Linear.java correctly", () => {
            const { readFileSync } = require("fs");
            const source = readFileSync("samples/sample/inheritance/Linear.java", "utf-8");
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.packageName).to.equal("sample.inheritance");
            expect(unit.types).to.have.lengthOf(5);
        });

        it("should parse GenericListWrapper.java correctly", () => {
            const { readFileSync } = require("fs");
            const source = readFileSync("samples/sample/generics/GenericListWrapper.java", "utf-8");
            const tree = parser.parse(source);
            const unit = parseUnit(tree, source);

            expect(unit.packageName).to.equal("sample.generics");
            expect(unit.types).to.have.lengthOf(1);
            expect(unit.types[0].typeParameters).to.deep.equal(["T"]);
        });
    });
});
