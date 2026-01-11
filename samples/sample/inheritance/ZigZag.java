package sample.inheritance;

/**
 * The inheritance is in a ZigZag shape.
 */
//@formatter:off
/*
-Chain1      Chain2     Chain3     Chain4      Chain1-
      \     /     \     /    \     /    \     /
       Link1       Link2      Link3      Link4
*/
public class ZigZag {
	interface Chain1 {
		default void action1() { System.out.println("C1-A1"); }
		default void action2() { System.out.println("C1-A2"); }
	}
	interface Chain2 {
		default void action1() { System.out.println("C2-A1"); }
		default void action2() { System.out.println("C2-A2"); }
	}
	interface Chain3 {
		default void action1() { System.out.println("C3-A1"); }
		default void action2() { System.out.println("C3-A2"); }
	}
	interface Chain4 {
		default void action1() { System.out.println("C4-A1"); }
		default void action2() { System.out.println("C4-A2"); }
	}
	interface ChainUnused {
		default void actionUnused() { System.out.println("CU-AU"); }
	}
	static class Link1 implements Chain1, Chain2 {
		@Override public void action1() { Chain1.super.action1(); }
		@Override public void action2() { Chain1.super.action2(); }
	}
	static class Link2 implements Chain2, Chain3 {
		@Override public void action1() { Chain2.super.action1(); }
		@Override public void action2() { Chain2.super.action2(); }
	}
	static class Link3 implements Chain3, Chain4 {
		@Override public void action1() { Chain3.super.action1(); }
		@Override public void action2() { Chain3.super.action2(); }
	}
	static class Link4 implements Chain4, Chain1 {
		@Override public void action1() { Chain4.super.action1(); }
		@Override public void action2() { Chain4.super.action2(); }
	}
	//@formatter:on

	/**
	 * Entry point.
	 * 
	 * @param args
	 */
	public static void main(String[] args) {
		case1();
		System.out.println("");
		case2();
	}

	private static void case1() {
		Link1 link = new Link1();
		link.action1();
		link.action2();
		((Chain2) link).action1();
		((Chain2) link).action2();
		// C1-A1
		// C1-A2
		// C1-A1
		// C1-A2
	}

	private static void case2() {
		try {
			Chain1 b = new Link1();
			((Chain2) ((Link1) b)).action1();
			//C1-A1
		} catch (ClassCastException c) {
			System.out.println("case2: failed due to ClassCastException");
		}
	}
}
