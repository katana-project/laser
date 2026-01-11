package sample.string;

import java.util.Scanner;

//@formatter:off
public class StringsDummyApp {
	private static final String WELCOME = 
					"==========================" +
					"===      WELCOME       ===" +
					"===        TO          ===" +
					"===     SOMETHING      ===" +
					"==========================";
	//@formatter:on
	public static void main(String[] args) {
		Scanner sc = new Scanner(System.in);
		String s = null;
		p(WELCOME);
		while (s == null || !s.equals("5")) {
			p("1. Option 1");
			p("2. Option 2");
			p("3. Option 3");
			p("4. Option 4");
			p("5. Exit");
			s = sc.nextLine();
			switch (s) {
			case "1": 
				p("a");
				p("b");
				p("c");
				break;
			case "2": 
				p("aa");
				p("bb");
				p("cc");
				break;
			case "3": 
				p("aaa");
				p("bbb");
				p("ccc");
				break;
			case "4": 
				p("aaaa");
				p("bbbb");
				p("cccc");
				break;
			}
		}
		sc.close();
	}

	public static void p(String s) {
		System.out.println(s);
	}
}
