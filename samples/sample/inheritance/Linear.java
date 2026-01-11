package sample.inheritance;

/**
 * The inheritance is linear.
 */
//@formatter:off
/*
 Base
  |
  A
  |
  B
  |
  C
*/
//@formatter:on
public class Linear {
	interface Base {
		void print();
	}

	static class A implements Base {
		@Override
		public void print() {
			System.out.println("A");
		}
	}

	static class B extends A {
		@Override
		public void print() {
			System.out.println("B");
		}
	}

	static class C extends B {
		@Override
		public void print() {
			System.out.println("C");
		}
	}

	/**
	 * Entry point.
	 * 
	 * @param args
	 */
	public static void main(String[] args) {
		simple1();
		System.out.println("");
		simple2();
		System.out.println("");
		simple3();
	}

	private static void simple1() {
		A a = new A();
		B b = new B();
		C c = new C();
		a.print(); // A
		b.print(); // B
		c.print(); // C
	}

	private static void simple2() {
		A a = new A();
		a.print(); // A
		a = new B();
		a.print(); // B
		a = new C();
		a.print(); // C
	}

	private static void simple3() {
		A a = new C();
		((A) a).print(); // C
		((B) a).print(); // C
		((C) a).print(); // C
	}
}
