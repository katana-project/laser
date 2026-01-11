package sample.stream;

//@formatter:off
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/**
 * @author https://winterbe.com/posts/2014/07/31/java8-stream-tutorial-examples/
 */
public class StreamMisc {
	public static void main(String[] args) {
		part1();
		part2();
		part3();
		part4();
		part5();
		part6();
	}

	private static void part1() {
		List<String> myList = Arrays.asList("a1", "a2", "b1", "c2", "c1");
		myList
			.stream()
			.filter(s -> s.startsWith("c"))
			.map(String::toUpperCase)
			.sorted()
			.forEach(System.out::println);
	}
	
	private static void part2() {
		IntStream.range(1, 10)
	    	.forEach(System.out::println);
	}
	
	private static void part3() {
		Arrays.stream(new int[] {1, 2, 3})
	    	.map(n -> 2 * n + 1)
	    	.average()
	    	.ifPresent(System.out::println);
	}
	
	private static void part4() {
		Stream.of("a1", "a2", "a3")
		    .map(s -> s.substring(1))
		    .mapToInt(Integer::parseInt)
		    .max()
		    .ifPresent(System.out::println);
	}
	
	private static void part5() {
		Stream.of("d2", "a2", "b1", "b3", "c")
		    .filter(s -> {
		        System.out.println("filter: " + s);
		        return true;
		    })
	    	.forEach(s -> System.out.println("forEach: " + s));
	}
	
	private static void part6() {
		Stream.of("d2", "a2", "b1", "b3", "c")
		    .map(s -> {
		        System.out.println("map: " + s);
		        return s.toUpperCase();
		    })
		    .anyMatch(s -> {
		        System.out.println("anyMatch: " + s);
		        return s.startsWith("A");
		    });
	}
}
