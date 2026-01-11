package sample.string;

public class StringsDuplicates {
	private static final String F = "Hello this is a duplicate string";

	public static void main(String[] args) {
		String s = "Hello this is a duplicate string";
		p(F);
		p(s);
		p(duplicate());
		p("Hello this is a duplicate string");
	}

	private static String duplicate() {
		return "Hello this is a duplicate string";
	}

	public static void p(String s) {
		System.out.println(s);
	}
}
