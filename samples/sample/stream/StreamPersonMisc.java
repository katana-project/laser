package sample.stream;

//@formatter:off
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.stream.Collector;
import java.util.stream.Collectors;

/**
 * @author https://winterbe.com/posts/2014/07/31/java8-stream-tutorial-examples/
 */
public class StreamPersonMisc {
	/**
	 * Person structure to use for the following examples.
	 */
	static class Person {
	    String name;
	    int age;

	    Person(String name, int age) {
	        this.name = name;
	        this.age = age;
	    }

	    @Override
	    public String toString() {
	        return name;
	    }
	}
	
	public static void main(String[] args) {
		List<Person> persons =
			    Arrays.asList(
			        new Person("Max", 18),
			        new Person("Peter", 23),
			        new Person("Pamela", 23),
			        new Person("David", 12));
		filter(persons);
		age(persons);
		map(persons);
		collect(persons);
	}
	
	private static void collect(List<Person> persons) {
		Collector<Person, StringJoiner, String> personNameCollector =
			    Collector.of(
			        () -> new StringJoiner(" | "),          // supplier
			        (j, p) -> j.add(p.name.toUpperCase()),  // accumulator
			        (j1, j2) -> j1.merge(j2),               // combiner
			        StringJoiner::toString);                // finisher

		String names = persons
		    .stream()
		    .collect(personNameCollector);
		System.out.println(names);  
		// MAX | PETER | PAMELA | DAVID
	}

	private static void map(List<Person> persons) {
		Map<Integer, String> map = persons
				.stream()
				.collect(Collectors.toMap(
						p -> p.age,
						p -> p.name,
						(name1, name2) -> name1 + ";" + name2));
		System.out.println(map);
		// {18=Max, 23=Peter;Pamela, 12=David}
	}

	private static void age(List<Person> persons) {
		Map<Integer, List<Person>> personsByAge = persons
			    .stream()
			    .collect(Collectors.groupingBy(p -> p.age));

		personsByAge.forEach((age, p) -> System.out.format("age %s: %s\n", age, p));
		// age 18: [Max]
		// age 23: [Peter, Pamela]
		// age 12: [David]
	}

	private static void filter(List<Person> persons) {
		List<Person> filtered =
			    persons
			        .stream()
			        .filter(p -> p.name.startsWith("P"))
			        .collect(Collectors.toList());
		System.out.println(filtered); 
		// [Peter, Pamela]
	}
}
