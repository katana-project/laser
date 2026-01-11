package sample.math;

public class Fibonacci {
	public static int fibonacci(int n) {
		if (n <= 1) {
			return n;
		}
		return fibonacci(n - 1) + fibonacci(n - 2);
	}
	
	public static void main(String[] args) {
		System.out.println("n:1 -> f(n)=" + fibonacci(1));
		System.out.println("n:2 -> f(n)=" + fibonacci(2));
		System.out.println("n:3 -> f(n)=" + fibonacci(3));
		System.out.println("n:4 -> f(n)=" + fibonacci(4));
		System.out.println("n:5 -> f(n)=" + fibonacci(5));
		System.out.println("n:6 -> f(n)=" + fibonacci(6));
		System.out.println("n:7 -> f(n)=" + fibonacci(7));
		System.out.println("n:8 -> f(n)=" + fibonacci(8));
		System.out.println("n:9 -> f(n)=" + fibonacci(9));
		/*
		n:1 -> f(n)=1
		n:2 -> f(n)=1
		n:3 -> f(n)=2
		n:4 -> f(n)=3
		n:5 -> f(n)=5
		n:6 -> f(n)=8
		n:7 -> f(n)=13
		n:8 -> f(n)=21
		n:9 -> f(n)=34
		 */
	}	
}
