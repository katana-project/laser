package sample.inheritance;

/**
 * The inheritance is in a diamond shape.
 */
//@formatter:off
/*
       Root
      /    \
 ChildA    ChildB
      \    /
      ChildC
*/
//@formatter:on
public class Diamond {
	interface Root {
		void action();
	}

	interface ChildA extends Root {
		@Override
		default void action() {
			doA();
		}

		default void doA() {
			System.out.println("A");
		}
	}

	interface ChildB extends Root {
		@Override
		default void action() {
			doB();
		}

		default void doB() {
			System.out.println("B");
		}
	}

	static class ChildC implements ChildA, ChildB {
		@Override
		public void action() {
			actionSubA();
			actionSubB();
		}

		private void actionSubA() {
			ChildA.super.action();
		}

		private void actionSubB() {
			ChildB.super.action();
		}
	}

	/**
	 * Entry point.
	 * 
	 * @param args
	 */
	public static void main(String[] args) {
		case1();
		System.out.println("");
		case2();
		System.out.println("");
		case3();
		System.out.println("");
		case4();
	}

	private static void case1() {
		ChildC c = new ChildC();
		c.action();
		// A
		// B
	}

	private static void case2() {
		ChildC c = new ChildC();
		((ChildA) c).action();
		((ChildB) c).action();
		// A
		// B
		// A
		// B
	}

	private static void case3() {
		ChildB b = new ChildC();
		((ChildC) ((Root) b)).doA();
		// A
	}

	private static void case4() {
		try {
			ChildB b = new ChildB() {};
			((ChildC) ((Root) b)).doA();
			// ClassCastException
		} catch (ClassCastException c) {
			System.out.println("case4: successfully thrown ClassCastException");
		}
	}
}
