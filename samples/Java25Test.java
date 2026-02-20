package test;

import module java.base;
import module java.desktop;

import java.util.stream.Gatherers;
import java.util.concurrent.StructuredTaskScope;

sealed interface Protocol permits HTTP, FTP, SSH {}

record HTTP(String url, int port) implements Protocol {}
record FTP(String server, boolean secure) implements Protocol {}
record SSH(String host) implements Protocol {}

record Point(int x, int y) {}
record Window(Point topLeft, Point bottomRight) {}

class BaseConnection {
    BaseConnection() {
        IO.println("Base connection established");
    }
}

class FlexibleConnection extends BaseConnection {
    private final String id;

    FlexibleConnection(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("ID cannot be empty");
        }
        this.id = id;
        super();
    }
}

static final ScopedValue<String> CONTEXT = ScopedValue.newInstance();

void main() {
    var points = List.of(new Point(0, 0), new Point(10, 10), new Point(20, 20));

    var pairs = points.stream()
        .gather(Gatherers.windowFixed(2))
        .toList();

    for (var pair : pairs) {
        if (pair instanceof List<Point>(Point(int x1, int y1), Point(int x2, int y2))) {
            IO.println("Segment from " + x1 + "," + y1 + " to " + x2 + "," + y2);
        }
    }

    Object data = 42;
    String description = switch (data) {
        case Integer i when i > 100 -> "Large integer";
        case int i -> "Primitive-friendly int: " + i;
        case String s -> "String of length " + s.length();
        case Point(int x, _) -> "Point at x=" + x;
        case null -> "Nothingness";
        default -> "Unknown type";
    };

    Protocol proto = new HTTP("https://example.com", 443);
    switch (proto) {
        case HTTP(var url, int port) -> IO.println("Web: " + url + ":" + port);
        case FTP(var server, _) -> IO.println("File transfer: " + server);
        case SSH(_) -> IO.println("Secure Shell");
    }

    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        ScopedValue.where(CONTEXT, "Production").run(() -> {
            var task = scope.fork(() -> {
                String env = CONTEXT.get();
                return "Running in " + env;
            });

            try {
                scope.join().throwIfFailed();
                IO.println(task.get());
            } catch (Exception _) {
                IO.println("Task failed");
            }
        });
    }

    String multiline = """
            {
                "status": "success",
                "version": 25,
                "features": ["FlexibleConstructors", "ModuleImports"]
            }
            """;

    long bigValue = 1_000_000L;
    if (bigValue instanceof long l) {
        IO.println("Primitive pattern match: " + l);
    }

    var connection = new FlexibleConnection("CONN-001");
}
