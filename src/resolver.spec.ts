import { parser } from "@lezer/java";
import { expect } from "chai";
import { readFileSync } from "fs";
import { createTypeReferenceResolver } from "./resolver.js";

describe("Type Reference Resolver", () => {
    describe("Linear.java - simple inheritance", () => {
        const source = readFileSync("samples/sample/inheritance/Linear.java", "utf-8");
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve Base interface", () => {
            const baseOffset = source.indexOf("implements Base");
            const offset = baseOffset + "implements ".length;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("Base");
        });

        it("should resolve class A in extends", () => {
            const extendsAOffset = source.indexOf("extends A");
            const offset = extendsAOffset + "extends ".length;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("A");
        });

        it("should resolve class B in extends", () => {
            const extendsBOffset = source.indexOf("extends B");
            const offset = extendsBOffset + "extends ".length;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("B");
        });

        it("should resolve String as unresolved", () => {
            const stringOffset = source.indexOf("String[]");
            const offset = stringOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("unresolved");
            expect(resolved?.name).to.equal("String");
        });

        it("should parse unit correctly", () => {
            const unit = resolver.unit;

            expect(unit.packageName).to.equal("sample.inheritance");
            expect(unit.types).to.have.lengthOf(5);

            const classNames = unit.types.map((c) => c.name);
            expect(classNames).to.include("Linear");
            expect(classNames).to.include("A");
            expect(classNames).to.include("B");
            expect(classNames).to.include("C");
            expect(classNames).to.include("Base");
        });
    });

    describe("GenericListWrapper.java - generics and imports", () => {
        const source = readFileSync("samples/sample/generics/GenericListWrapper.java", "utf-8");
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should mark List from wildcard import as unresolved", () => {
            const listOffset = source.indexOf("List<String>");
            const offset = listOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("unresolved");
            expect(resolved?.name).to.equal("List");
        });

        it("should mark Set from wildcard import as unresolved", () => {
            const setOffset = source.indexOf("Set<String>");
            const offset = setOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("unresolved");
            expect(resolved?.name).to.equal("Set");
        });

        it("should mark HashSet from wildcard import as unresolved", () => {
            const hashSetOffset = source.indexOf("new HashSet<>");
            const offset = hashSetOffset + "new ".length;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("unresolved");
            expect(resolved?.name).to.equal("HashSet");
        });

        it("should resolve GenericListWrapper class", () => {
            const gwOffset = source.indexOf("new GenericListWrapper<>");
            const offset = gwOffset + "new ".length;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("GenericListWrapper");
        });

        it("should mark Collection from wildcard import as unresolved", () => {
            const collectionOffset = source.indexOf("Collection<T>");
            const offset = collectionOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("unresolved");
            expect(resolved?.name).to.equal("Collection");
        });

        it("should parse unit with imports", () => {
            const unit = resolver.unit;

            expect(unit.packageName).to.equal("sample.generics");
            expect(unit.imports).to.have.lengthOf(1);
            expect(unit.imports[0].isWildcard).to.be.true;
            expect(unit.imports[0].importedName).to.equal("java.util");
        });

        it("should parse class with type parameters", () => {
            const unit = resolver.unit;
            const genericListWrapper = unit.types.find((c) => c.name === "GenericListWrapper");

            expect(genericListWrapper).to.not.be.undefined;
            expect(genericListWrapper?.typeParameters).to.deep.equal(["T"]);
        });
    });

    describe("FixedDataProcessor.java - multiple imports", () => {
        const source = readFileSync("samples/sample/FixedDataProcessor.java", "utf-8");
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve Path from import", () => {
            const pathOffset = source.indexOf("Path path");
            const offset = pathOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("imported");
            expect(resolved?.name).to.equal("Path");
            expect(resolved?.qualifiedName).to.equal("java.nio.file.Path");
        });

        it("should resolve IOException from import", () => {
            const ioOffset = source.indexOf("IOException ex");
            const offset = ioOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("imported");
            expect(resolved?.name).to.equal("IOException");
            expect(resolved?.qualifiedName).to.equal("java.io.IOException");
        });

        it("should resolve ExampleFixedList", () => {
            const exampleOffset = source.indexOf("ExampleFixedList<String>");
            const offset = exampleOffset + 1;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("ExampleFixedList");
        });

        it("should parse multiple non-wildcard imports", () => {
            const unit = resolver.unit;

            expect(unit.imports).to.have.length.greaterThan(3);
            expect(unit.imports.every((i) => !i.isWildcard)).to.be.true;

            const importedNames = unit.imports.map((i) => i.importedName);
            expect(importedNames).to.include("java.io.IOException");
            expect(importedNames).to.include("java.nio.file.Path");
            expect(importedNames).to.include("java.nio.file.Paths");
        });
    });

    describe("Type reference finding", () => {
        const source = `package test;
import java.util.List;

public class Test {
  private List<String> items;

  public void process(String input) {
    List<Integer> numbers;
  }

  public java.util.Void method() {}
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should find type reference at field type", () => {
            const listOffset = source.indexOf("List<String>");
            const typeRef = resolver.resolveReferenceAt(listOffset + 1);

            expect(typeRef).to.not.be.null;
            expect(typeRef?.name).to.equal("List");
        });

        it("should find type reference at parameter type", () => {
            const stringOffset = source.indexOf("String input");
            const typeRef = resolver.resolveReferenceAt(stringOffset + 1);

            expect(typeRef).to.not.be.null;
            expect(typeRef?.name).to.equal("String");
        });

        it("should find type reference in local variable", () => {
            const listIntOffset = source.indexOf("List<Integer>");
            const typeRef = resolver.resolveReferenceAt(listIntOffset + 1);

            expect(typeRef).to.not.be.null;
            expect(typeRef?.name).to.equal("List");

            const integerTypeRef = resolver.resolveReferenceAt(source.indexOf("Integer") + 1);
            expect(integerTypeRef).to.not.be.null;
            expect(integerTypeRef?.name).to.equal("Integer");
        });

        it("should find type reference at fully qualified return type", () => {
            const voidOffset = source.indexOf("Void");
            const typeRef = resolver.resolveReferenceAt(voidOffset + 1);

            expect(typeRef).to.not.be.null;
            expect(typeRef?.name).to.equal("java.util.Void");
        });

        it("should return null when not on a type", () => {
            const offset = source.indexOf("items");
            const typeRef = resolver.resolveReferenceAt(offset);

            expect(typeRef).to.be.null;
        });
    });

    describe("Nested classes", () => {
        const source = `package test;

public class Outer {
  class Inner {
    void method() {
      Inner i;
      Outer o;
    }
  }
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve nested class reference", () => {
            const innerOffset = source.indexOf("Inner i");
            const resolved = resolver.resolveAt(innerOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("Inner");
        });

        it("should resolve outer class reference from nested context", () => {
            const outerOffset = source.indexOf("Outer o");
            const resolved = resolver.resolveAt(outerOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("Outer");
        });

        it("should parse nested class in unit", () => {
            const unit = resolver.unit;

            expect(unit.types).to.have.lengthOf(2);
            expect(unit.types.map((c) => c.name)).to.include.members(["Outer", "Inner"]);

            const inner = unit.types.find((c) => c.name === "Inner");
            expect(inner?.qualifiedName).to.equal("Outer.Inner");
        });
    });

    describe("Primitive types", () => {
        const source = `package test;

public class Primitives {
  int x;
  long y;
  double z;
  boolean flag;
  void method() {}
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve int as builtin", () => {
            const intOffset = source.indexOf("int x");
            const resolved = resolver.resolveAt(intOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("builtin");
            expect(resolved?.name).to.equal("int");
        });

        it("should resolve long as builtin", () => {
            const longOffset = source.indexOf("long y");
            const resolved = resolver.resolveAt(longOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("builtin");
            expect(resolved?.name).to.equal("long");
        });

        it("should resolve void as builtin", () => {
            const voidOffset = source.indexOf("void method");
            const resolved = resolver.resolveAt(voidOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("builtin");
            expect(resolved?.name).to.equal("void");
        });
    });

    describe("Interfaces", () => {
        const source = `package test;

public interface MyInterface {
  void doSomething();
}

class Implementation implements MyInterface {
  public void doSomething() {}
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve interface reference", () => {
            const interfaceOffset = source.indexOf("implements MyInterface");
            const offset = interfaceOffset + "implements ".length;
            const resolved = resolver.resolveAt(offset);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("MyInterface");
        });

        it("should parse interface in unit", () => {
            const unit = resolver.unit;

            expect(unit.types).to.have.lengthOf(2);
            expect(unit.types[0].name).to.equal("MyInterface");
        });
    });

    describe("Annotations", () => {
        const source = `package test;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

@Retention(RetentionPolicy.RUNTIME)
public @interface CustomAnnotation {
  String value() default "";
  int priority() default 0;
}

public class AnnotatedClass {
  @Override
  @Deprecated
  @CustomAnnotation(value = "test", priority = 1)
  public void annotatedMethod() {
    @SuppressWarnings("unchecked")
    Object obj = new Object();
  }
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve annotation type references", () => {
            const retentionOffset = source.indexOf("@Retention(");
            const resolved = resolver.resolveAt(retentionOffset + "@".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("imported");
            expect(resolved?.name).to.equal("Retention");
            expect(resolved?.qualifiedName).to.equal("java.lang.annotation.Retention");
        });

        it("should resolve annotation parameter types", () => {
            const policyOffset = source.indexOf("RetentionPolicy.RUNTIME");
            const resolved = resolver.resolveAt(policyOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("imported");
            expect(resolved?.name).to.equal("RetentionPolicy");
        });

        it("should resolve annotation value types", () => {
            const stringOffset = source.indexOf("String value()");
            const resolved = resolver.resolveAt(stringOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("String");
        });

        it("should resolve primitive types in annotations", () => {
            const intOffset = source.indexOf("int priority()");
            const resolved = resolver.resolveAt(intOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("builtin");
            expect(resolved?.name).to.equal("int");
        });

        it("should resolve custom annotation references", () => {
            const customOffset = source.indexOf("@CustomAnnotation");
            const resolved = resolver.resolveAt(customOffset + "@".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("CustomAnnotation");
        });

        it("should resolve marker annotations", () => {
            const overrideOffset = source.indexOf("@Override");
            const resolved = resolver.resolveAt(overrideOffset + "@".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("Override");
        });

        it("should resolve deprecated annotation", () => {
            const deprecatedOffset = source.indexOf("@Deprecated");
            const resolved = resolver.resolveAt(deprecatedOffset + "@".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("Deprecated");
        });

        it("should parse annotation type declaration in scope", () => {
            const unit = resolver.unit;

            const annotationType = unit.types.find((t) => t.name === "CustomAnnotation");
            expect(annotationType).to.not.be.undefined;
            expect(annotationType?.qualifiedName).to.equal("CustomAnnotation");
        });

        it("should find annotation type reference", () => {
            const typeRef = resolver.resolveReferenceAt(source.indexOf("@SuppressWarnings") + "@".length);

            expect(typeRef).to.not.be.null;
            expect(typeRef?.name).to.equal("SuppressWarnings");
        });
    });

    describe("Local classes", () => {
        const source = `package test;

public class Outer {
  public void method() {
    class LocalClass {
      private String value;

      public String getValue() {
        return value;
      }
    }

    LocalClass local = new LocalClass();
    String result = local.getValue();

    Runnable r = new Runnable() {
      @Override
      public void run() {
        System.out.println("anonymous");
      }
    };
  }

  public void anotherMethod() {
    class AnotherLocal {
      private int count;
    }

    AnotherLocal another = new AnotherLocal();
  }
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve local class reference", () => {
            const localOffset = source.indexOf("LocalClass local");
            const resolved = resolver.resolveAt(localOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("LocalClass");
        });

        it("should resolve local class in instantiation", () => {
            const newLocalOffset = source.indexOf("new LocalClass()");
            const resolved = resolver.resolveAt(newLocalOffset + "new ".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("LocalClass");
        });

        it("should resolve types within local class", () => {
            const stringOffset = source.indexOf("private String value");
            const resolved = resolver.resolveAt(stringOffset + "private ".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("String");
        });

        it("should resolve return types in local class methods", () => {
            const returnOffset = source.indexOf("public String getValue()");
            const resolved = resolver.resolveAt(returnOffset + "public ".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("String");
        });

        it("should resolve different local classes in different methods", () => {
            const anotherOffset = source.indexOf("AnotherLocal another");
            const resolved = resolver.resolveAt(anotherOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("AnotherLocal");
        });

        it("should resolve interface in anonymous class", () => {
            const runnableOffset = source.indexOf("Runnable r");
            const resolved = resolver.resolveAt(runnableOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("Runnable");
        });

        it("should resolve types in anonymous class instantiation", () => {
            const newRunnableOffset = source.indexOf("new Runnable()");
            const resolved = resolver.resolveAt(newRunnableOffset + "new ".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("Runnable");
        });

        it("should parse all local classes in scope", () => {
            const unit = resolver.unit;

            const localClasses = unit.types.filter((t) => t.name === "LocalClass" || t.name === "AnotherLocal");
            expect(localClasses.length).to.be.greaterThan(0);
        });
    });

    describe("Complex annotation scenarios", () => {
        const source = `package test;

import java.lang.annotation.Target;
import java.lang.annotation.ElementType;

@Target({ElementType.METHOD, ElementType.TYPE})
public @interface MultiTarget {
  String[] values() default {};
  Class<?>[] classes() default {};
}

@MultiTarget(values = {"test1", "test2"}, classes = {String.class, Integer.class})
public class AnnotatedWithArrays {
  public void method() {}
}`;
        const tree = parser.parse(source);
        const resolver = createTypeReferenceResolver(tree, source);

        it("should resolve Target annotation", () => {
            const targetOffset = source.indexOf("@Target");
            const resolved = resolver.resolveAt(targetOffset + "@".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("imported");
            expect(resolved?.name).to.equal("Target");
        });

        it("should resolve ElementType in annotation argument", () => {
            const elementTypeOffset = source.indexOf("ElementType.METHOD");
            const resolved = resolver.resolveAt(elementTypeOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("imported");
            expect(resolved?.name).to.equal("ElementType");
        });

        it("should resolve MultiTarget annotation usage", () => {
            const multiTargetOffset = source.indexOf("@MultiTarget(");
            const resolved = resolver.resolveAt(multiTargetOffset + "@".length);

            expect(resolved).to.not.be.null;
            expect(resolved?.kind).to.equal("declared");
            expect(resolved?.name).to.equal("MultiTarget");
        });

        it("should resolve array return types in annotation", () => {
            const stringArrayOffset = source.indexOf("String[] values()");
            const resolved = resolver.resolveAt(stringArrayOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("String");
        });

        it("should resolve generic class references in annotation", () => {
            const classOffset = source.indexOf("Class<?>");
            const resolved = resolver.resolveAt(classOffset + 1);

            expect(resolved).to.not.be.null;
            expect(resolved?.name).to.equal("Class");
        });

        it("should parse annotation with array parameters in scope", () => {
            const unit = resolver.unit;

            const multiTarget = unit.types.find((t) => t.name === "MultiTarget");
            expect(multiTarget).to.not.be.undefined;
        });
    });

    describe("resolveAll", () => {
        it("should resolve all type references in a simple class", () => {
            const source = `package test;

public class Simple {
  private String name;
  private int count;

  public String getName() {
    return name;
  }
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            expect(resolved.length).to.be.greaterThan(0);

            const stringRefs = resolved.filter((r) => r.name === "String");
            expect(stringRefs).to.have.lengthOf(2);

            const intRefs = resolved.filter((r) => r.name === "int");
            expect(intRefs).to.have.lengthOf(1);
            expect(intRefs[0].kind).to.equal("builtin");
        });

        it("should resolve all type references including generics", () => {
            const source = `package test;
import java.util.List;
import java.util.Map;

public class GenericTest {
  private List<String> items;
  private Map<Integer, String> map;
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            const listRefs = resolved.filter((r) => r.name === "List");
            expect(listRefs.length).to.be.greaterThan(0);
            expect(listRefs[0].kind).to.equal("imported");

            const mapRefs = resolved.filter((r) => r.name === "Map");
            expect(mapRefs.length).to.be.greaterThan(0);
            expect(mapRefs[0].kind).to.equal("imported");

            const stringRefs = resolved.filter((r) => r.name === "String");
            expect(stringRefs).to.have.lengthOf(2);

            const integerRefs = resolved.filter((r) => r.name === "Integer");
            expect(integerRefs).to.have.lengthOf(1);
        });

        it("should resolve all type references with inheritance", () => {
            const source = `package test;

interface Base {}
interface Another {}

class Parent implements Base {}

class Child extends Parent implements Another {
  private Base field;
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            const baseRefs = resolved.filter((r) => r.name === "Base");
            expect(baseRefs.length).to.be.greaterThan(1);
            expect(baseRefs.every((r) => r.kind === "declared")).to.be.true;

            const anotherRefs = resolved.filter((r) => r.name === "Another");
            expect(anotherRefs.length).to.be.greaterThan(0);
            expect(anotherRefs[0].kind).to.equal("declared");

            const parentRefs = resolved.filter((r) => r.name === "Parent");
            expect(parentRefs.length).to.be.greaterThan(0);
            expect(parentRefs[0].kind).to.equal("declared");
        });

        it("should resolve all type references with annotations", () => {
            const source = `package test;

import java.lang.Override;
import java.lang.Deprecated;

@Deprecated
public class AnnotatedClass {
  @Override
  public String toString() {
    return "";
  }
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            const overrideRefs = resolved.filter((r) => r.name === "Override");
            expect(overrideRefs).to.have.lengthOf(1);
            expect(overrideRefs[0].kind).to.equal("imported");

            const deprecatedRefs = resolved.filter((r) => r.name === "Deprecated");
            expect(deprecatedRefs).to.have.lengthOf(1);
            expect(deprecatedRefs[0].kind).to.equal("imported");

            const stringRefs = resolved.filter((r) => r.name === "String");
            expect(stringRefs).to.have.lengthOf(1);
        });

        it("should resolve all type references with local classes", () => {
            const source = `package test;

public class Outer {
  public void method() {
    class Local {
      private String value;
    }

    Local local = new Local();
  }
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            const localRefs = resolved.filter((r) => r.name === "Local");
            expect(localRefs.length).to.be.greaterThan(1);
            expect(localRefs.every((r) => r.kind === "declared")).to.be.true;

            const stringRefs = resolved.filter((r) => r.name === "String");
            expect(stringRefs).to.have.lengthOf(1);
        });

        it("should resolve all type references from real file", () => {
            const source = readFileSync("samples/sample/inheritance/Linear.java", "utf-8");
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            expect(resolved.length).to.be.greaterThan(0);

            const declaredTypes = resolved.filter((r) => r.kind === "declared");
            expect(declaredTypes.length).to.be.greaterThan(0);

            const builtinTypes = resolved.filter((r) => r.kind === "builtin");
            expect(builtinTypes.length).to.be.greaterThan(0);

            const unresolvedTypes = resolved.filter((r) => r.kind === "unresolved");
            expect(unresolvedTypes.some((r) => r.name === "String")).to.be.true;
        });

        it("should not duplicate type references", () => {
            const source = `package test;

public class Test {
  private String a;
  private String b;
  private String c;
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();
            const stringRefs = resolved.filter((r) => r.name === "String");

            expect(stringRefs).to.have.lengthOf(3);

            const uniquePositions = new Set(stringRefs.map((r) => r.ref.node.from));
            expect(uniquePositions.size).to.equal(3);
        });

        it("should resolve all types in complex generic scenarios", () => {
            const source = `package test;
import java.util.List;
import java.util.Map;

public class ComplexGenerics<T extends List<String>> {
  private Map<String, List<T>> data;

  public T get(String key) {
    return null;
  }
}`;
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            expect(resolved.length).to.be.greaterThan(0);

            const listRefs = resolved.filter((r) => r.name === "List");
            expect(listRefs.length).to.be.greaterThan(0);

            const mapRefs = resolved.filter((r) => r.name === "Map");
            expect(mapRefs.length).to.be.greaterThan(0);
            expect(mapRefs[0].kind).to.equal("imported");

            const stringRefs = resolved.filter((r) => r.name === "String");
            expect(stringRefs.length).to.be.greaterThan(1);
        });

        it("should resolve all types with wildcard imports", () => {
            const source = readFileSync("samples/sample/generics/GenericListWrapper.java", "utf-8");
            const tree = parser.parse(source);
            const resolver = createTypeReferenceResolver(tree, source);

            const resolved = resolver.resolveAll();

            expect(resolved.length).to.be.greaterThan(0);

            const unresolvedFromWildcard = resolved.filter(
                (r) =>
                    r.kind === "unresolved" &&
                    (r.name === "List" || r.name === "Set" || r.name === "HashSet" || r.name === "Collection")
            );
            expect(unresolvedFromWildcard.length).to.be.greaterThan(0);

            const declaredTypes = resolved.filter((r) => r.kind === "declared");
            expect(declaredTypes.some((r) => r.name === "GenericListWrapper")).to.be.true;
        });
    });
});
