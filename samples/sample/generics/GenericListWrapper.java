package sample.generics;

import java.util.*;

/**
 * Barebones wrapper.
 */
public class GenericListWrapper<T> implements List<T> {
	public static void main(String[] args) {
		case1();
		System.out.println("");
		case2();
	}

	private static void case1() {
		List<String> l = new GenericListWrapper<>("First", "Second", "Third", "Fourth", "Fith");
		l.addAll(l); // duplicate
		l = l.subList(l.size() / 2, l.size()); // sub-list of duplicates
		l.forEach(s -> System.out.println(s)); 
		//First
		//Second
		//Third
		//Fourth
		//Fith
	}
	
	private static void case2() {
		Set<String> s = new HashSet<>();
		s.add("one");
		s.add("two");
		s.add("three");
		s.add("four");
		GenericListWrapper<? extends CharSequence> l = new GenericListWrapper<String>(s);
		l.forEach(x -> System.out.println(x)); 
		// prints each in any order.
	}

	// ==================================================== //
	// ==================================================== //

	private final List<T> internal = new ArrayList<>();

	public GenericListWrapper(Collection<T> c) {
		addAll(c);
	}

	@SafeVarargs
	public GenericListWrapper(T... t) {
		for (T v : t) {
			add(v);
		}
	}

	@Override
	public int size() {
		return internal.size();
	}

	@Override
	public boolean isEmpty() {
		return internal.isEmpty();
	}

	@Override
	public boolean contains(Object o) {
		return internal.contains(o);
	}

	@Override
	public Iterator<T> iterator() {
		return internal.iterator();
	}

	@Override
	public Object[] toArray() {
		return internal.toArray();
	}

	@SuppressWarnings("hiding")
	@Override
	public <T> T[] toArray(T[] a) {
		return internal.toArray(a);
	}

	@Override
	public boolean add(T e) {
		return internal.add(e);
	}

	@Override
	public boolean remove(Object o) {
		return internal.remove(o);
	}

	@Override
	public boolean containsAll(Collection<?> c) {
		return internal.containsAll(c);
	}

	@Override
	public boolean addAll(Collection<? extends T> c) {
		return internal.addAll(c);
	}

	@Override
	public boolean addAll(int index, Collection<? extends T> c) {
		return internal.addAll(index, c);
	}

	@Override
	public boolean removeAll(Collection<?> c) {
		return internal.removeAll(c);
	}

	@Override
	public boolean retainAll(Collection<?> c) {
		return internal.retainAll(c);
	}

	@Override
	public void clear() {
		internal.clear();
	}

	@Override
	public T get(int index) {
		return internal.get(index);
	}

	@Override
	public T set(int index, T element) {
		return internal.set(index, element);
	}

	@Override
	public void add(int index, T element) {
		internal.add(index, element);
	}

	@Override
	public T remove(int index) {
		return internal.remove(index);
	}

	@Override
	public int indexOf(Object o) {
		return internal.indexOf(o);
	}

	@Override
	public int lastIndexOf(Object o) {
		return internal.lastIndexOf(o);
	}

	@Override
	public ListIterator<T> listIterator() {
		return internal.listIterator();
	}

	@Override
	public ListIterator<T> listIterator(int index) {
		return internal.listIterator(index);
	}

	@Override
	public List<T> subList(int fromIndex, int toIndex) {
		return internal.subList(fromIndex, toIndex);
	}
}
