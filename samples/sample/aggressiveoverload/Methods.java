package sample.aggressiveoverload;

public class Methods {
	// ==================== //
	// All of the methods here should
	// be renamed into the same name
	// if you are attempting to use
	// aggressive overloading for renaming.

	void noargs1() {}

	int noargs2() {
		return 0;
	}

	boolean noargs3() {
		return false;
	}

	String noargs4() {
		return "";
	}

	// ==================== //
	// All of the methods here should
	// be renamed into the same name
	// if you are attempting to use
	// aggressive overloading for renaming.

	void iarg1(int i) {}

	int iarg2(int i) {
		return i;
	}

	boolean iarg3(int i) {
		return i == 0;
	}

	String iarg4(int i) {
		return String.valueOf(i);
	}

	// ==================== //
	// All of the methods here should
	// be renamed into the same name
	// if you are attempting to use
	// aggressive overloading for renaming.

	void zarg(boolean b) {}

	void carg(char c) {}

	void jarg(long k) {}

	void barg1(byte b) {}

	void barg2(byte b1, byte b2) {}

	void barg3(byte b1, byte b2, byte b3) {}

	// ==================== //
	// All of the methods here should
	// be renamed into the same name
	// if you are attempting to use
	// aggressive overloading for renaming.

	void nothing1(float a, float b, float c) {}

	void nothing2(float a, float b, int c) {}

	void nothing3(float a, int b, float c) {}

	void nothing4(float a, int b, int c) {}

	void nothing5(int a, float b, float c) {}

	void nothing6(int a, float b, int c) {}

	void nothing8(int a, int b, float c) {}

	void nothing9(int a, int b, int c) {}

	// ==================== //
	// These will all have unique names
	// releative to each-other.

	void theSame1(String s1, String s2) {}

	void theSame2(String s1, String s2) {}

	void theSame3(String s1, String s2) {}

	void theSame4(String s1, String s2) {}

	void theSame5(String s1, String s2) {}

	void theSame6(String s1, String s2) {}
}
