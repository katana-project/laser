package sample.generics;

import java.util.*;
import java.util.function.Function;

/**
 * Assorted code that involves heavy usage of generics.
 */
public class GenericsMisc {
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
		Number n = 3.14F;
		float f = cast(n);
		System.out.println("F: " + f);
	}

	private static void case2() {
		Set<String> s1 = new HashSet<>();
		Set<String> s2 = new HashSet<>();
		s1.add("a");
		s1.add("b");
		s1.add("c");
		s1.add("d");
		s2.add("d");
		s2.add("e");
		s2.add("g");
		s2.add("h");
		s2.add("i");
		s2.add("j");
		Set<String> common = common(s1, s2);
		common.forEach(s -> System.out.println(s)); // d
	}

	private static void case3() {
		Set<String> chars = new HashSet<>();
		chars.add("a");
		chars.add("b");
		chars.add("c");
		chars.add("d");
		Function<String, Integer> capitalize = (s) -> {
			return s.charAt(0) + ('Z' - 'z');
		};
		Set<Integer> res = map(chars, capitalize);
		res.forEach(i -> {
			char c = (char) i.intValue();
			System.out.println(c);
		});
		// prints ABCD in some order.
	}

	private static void case4() {
		Map<String, String> m = new HashMap<>();
		m.put("Grape", "Raisin");
		m.put("Ice", "Water");
		m.put("Before", "After");
		// Order of prints does not matter.
		m.forEach((k, v) -> System.out.println(k + " -> " + v));
		// Before -> After
		// Grape -> Raisin
		// Ice -> Water
		invert(m).forEach((k, v) -> System.out.println(k + " -> " + v));
		// After -> Before
		// Raisin -> Grape
		// Water -> Ice
	}
	
	/**
	 * Cast the object to some type.
	 * 
	 * @param o
	 *            Object to cast.
	 * @return Casted object.
	 */
	@SuppressWarnings("unchecked")
	public static <T> T cast(Object o) {
		return (T) o;
	}

	/**
	 * @param collection1
	 * @param collection2
	 * @return Common values of each collection.
	 */
	public static <T> Set<T> common(Collection<T> collection1, Collection<T> collection2) {
		Set<T> set = new HashSet<>();
		set.addAll(collection1);
		set.retainAll(collection2);
		return set;
	}

	/**
	 * Map the values in the given collection to another type.
	 * 
	 * @param collection
	 *            Values to convert.
	 * @param converter
	 *            Conversion function. If two values map to the same output only the
	 *            first instance is retained in the returned set.
	 * @return Set of converted values.
	 */
	public static <K, V> Set<V> map(Collection<K> collection, Function<K, V> converter) {
		Set<V> set = new HashSet<>();
		for (K in : collection) {
			set.add(converter.apply(in));
		}
		return set;
	}

	/**
	 * Swaps the keys and values of the given map.
	 * 
	 * @param input
	 *            Map to invert.
	 * @return Map with inverted keys and values.
	 * @throws IllegalStateException
	 *             Thrown when the map cannot be inverted. This occurs when multiple
	 *             keys point to a single value.
	 */
	public static <K, V> Map<V, K> invert(Map<K, V> input) throws IllegalStateException {
		Map<V, K> out = new HashMap<>();
		for (K key : input.keySet()) {
			V value = input.get(key);
			if (out.containsKey(value)) {
				throw new IllegalStateException("Cannot invert, input is not a 1-to-1 map.");
			}
			out.put(value, key);
		}
		return out;
	}
}
