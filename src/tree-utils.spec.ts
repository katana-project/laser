import { parser } from "@run-slicer/lezer-java";
import { expect } from "chai";
import { findChild, findChildren, findDescendant, findDescendants, getChildren } from "./tree-utils.js";

describe("Tree Utilities", () => {
    const source = `package test;

public class Test {
  private int value;

  public void method() {
    System.out.println("hello");
  }
}`;
    const tree = parser.parse(source);

    describe("getChildren", () => {
        it("should return all direct children", () => {
            const children = getChildren(tree.topNode);

            expect(children).to.be.an("array");
            expect(children.length).to.be.greaterThan(0);
        });

        it("should include package declaration", () => {
            const children = getChildren(tree.topNode);
            const hasPackage = children.some((c) => c.type.name === "PackageDeclaration");

            expect(hasPackage).to.be.true;
        });

        it("should include class declaration", () => {
            const children = getChildren(tree.topNode);
            const hasClass = children.some((c) => c.type.name === "ClassDeclaration");

            expect(hasClass).to.be.true;
        });
    });

    describe("findChild", () => {
        it("should find first matching child", () => {
            const child = findChild(tree.topNode, (n) => n.type.name === "ClassDeclaration");

            expect(child).to.not.be.null;
            expect(child?.type.name).to.equal("ClassDeclaration");
        });

        it("should return null when no match", () => {
            const child = findChild(tree.topNode, (n) => n.type.name === "NonExistent");

            expect(child).to.be.null;
        });

        it("should only check direct children", () => {
            const methodNode = findChild(tree.topNode, (n) => n.type.name === "MethodDeclaration");

            expect(methodNode).to.be.null;
        });
    });

    describe("findChildren", () => {
        it("should find all matching children", () => {
            const classNode = findChild(tree.topNode, (n) => n.type.name === "ClassDeclaration");
            expect(classNode).to.not.be.null;

            const classBody = findChild(classNode!, (n) => n.type.name === "ClassBody");
            expect(classBody).to.not.be.null;

            const declarations = findChildren(
                classBody!,
                (n) => n.type.name === "FieldDeclaration" || n.type.name === "MethodDeclaration"
            );

            expect(declarations).to.have.lengthOf(2);
        });

        it("should return empty array when no matches", () => {
            const matches = findChildren(tree.topNode, (n) => n.type.name === "NonExistent");

            expect(matches).to.be.an("array");
            expect(matches).to.have.lengthOf(0);
        });
    });

    describe("findDescendant", () => {
        it("should find first matching descendant", () => {
            const methodDecl = findDescendant(tree.topNode, (n) => n.type.name === "MethodDeclaration");

            expect(methodDecl).to.not.be.null;
            expect(methodDecl?.type.name).to.equal("MethodDeclaration");
        });

        it("should search recursively", () => {
            const stringLiteral = findDescendant(tree.topNode, (n) => n.type.name === "StringLiteral");

            expect(stringLiteral).to.not.be.null;
            const text = source.slice(stringLiteral!.from, stringLiteral!.to);
            expect(text).to.equal('"hello"');
        });

        it("should match the node itself", () => {
            const program = findDescendant(tree.topNode, (n) => n.type.name === "Program");

            expect(program).to.not.be.null;
            expect(program?.type.name).to.equal(tree.topNode.type.name);
            expect(program?.from).to.equal(tree.topNode.from);
            expect(program?.to).to.equal(tree.topNode.to);
        });
    });

    describe("findDescendants", () => {
        it("should find all matching descendants", () => {
            const identifiers = findDescendants(tree.topNode, (n) => n.type.name === "Identifier");

            expect(identifiers).to.be.an("array");
            expect(identifiers.length).to.be.greaterThan(1);
        });

        it("should include the root if it matches", () => {
            const programs = findDescendants(tree.topNode, (n) => n.type.name === "Program");

            expect(programs).to.have.lengthOf(1);
            expect(programs[0].type.name).to.equal(tree.topNode.type.name);
            expect(programs[0].from).to.equal(tree.topNode.from);
            expect(programs[0].to).to.equal(tree.topNode.to);
        });

        it("should find all field and method declarations", () => {
            const declarations = findDescendants(
                tree.topNode,
                (n) => n.type.name === "FieldDeclaration" || n.type.name === "MethodDeclaration"
            );

            expect(declarations).to.have.lengthOf(2);
        });
    });

    describe("Complex navigation", () => {
        const complexSource = `package test;

import java.util.List;
import java.util.ArrayList;

public class Complex {
  private List<String> items = new ArrayList<>();

  public void addItem(String item) {
    items.add(item);
  }

  class Inner {
    void innerMethod() {}
  }
}`;
        const complexTree = parser.parse(complexSource);

        it("should navigate to nested class", () => {
            const innerClass = findDescendant(complexTree.topNode, (n) => {
                if (n.type.name !== "ClassDeclaration") return false;
                const def = findChild(n, (c) => c.type.name === "Definition");
                return def && complexSource.slice(def.from, def.to) === "Inner";
            });

            expect(innerClass).to.not.be.null;
        });

        it("should find all import declarations", () => {
            const imports = findDescendants(complexTree.topNode, (n) => n.type.name === "ImportDeclaration");

            expect(imports).to.have.lengthOf(2);
        });

        it("should find generic type with type arguments", () => {
            const genericType = findDescendant(complexTree.topNode, (n) => n.type.name === "GenericType");

            expect(genericType).to.not.be.null;
            const text = complexSource.slice(genericType!.from, genericType!.to);
            expect(text).to.equal("List<String>");
        });
    });
});
