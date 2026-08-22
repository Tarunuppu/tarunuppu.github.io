---
sidebar_position: 5
---

# Creational Patterns

Creational patterns all attack the same coupling: the `new ConcreteClass()` sitting inside the code that uses the object. That one line ties the caller to a specific class, so changing what gets built means editing the caller. Each pattern below moves creation out of the using code in a different way, so that what is created can change without the code depending on it changing. They range from a plain helper method up to a family-swapping factory; the aim is to pick the lightest one that removes the coupling you actually have.

## Simple Factory

When several places in the code need the same kind of object and choose the concrete class by some input, each of them repeats the same create-and-branch logic. Change the set of classes, and every one of those places has to change with it.

The fix is to put that choice in one method behind a shared interface, and have everyone call it:

```java
class PaymentProcessorFactory {
    static PaymentProcessor create(PaymentType type) {
        return switch (type) {
            case CARD   -> new StripeProcessor();
            case WALLET -> new PayPalProcessor();
        };
    }
}
```

Callers now ask for a `PaymentProcessor` and never name a concrete class. This is not one of the classic catalogued patterns — it is usually called a simple factory — but it is the everyday baseline and what most people mean by "a factory." Its limit is that the branch still lives somewhere, and adding a type edits it.

:::note In your own code
Reach for it when the same "which class do I build" decision is duplicated across callers. The factory becomes the single place that maps input to concrete class, and callers depend only on the interface. Adding a type touches the factory alone. It is the right tool when creation is a standalone choice with no surrounding workflow to share.
:::

## Factory Method

A report always runs the same steps — fetch, validate, render, archive — and only the render step changes with the output format. The obvious approach is a single class with a flag for the format and a branch where rendering happens:

```java
class ReportJob {
    ReportType type;

    Report run(Query query) {
        Data data = fetch(query);
        validate(data);
        Renderer renderer = switch (type) {      // the format-specific choice,
            case PDF -> new PdfRenderer();        // wedged into the shared workflow
            case CSV -> new CsvRenderer();
        };
        return archive(renderer.render(data));
    }
}
```

This works, but the shared steps and the format-specific choice are tangled in one method, and the class has to know every format. Adding one means editing `run`, and if more than the renderer varies by format, the class fills with parallel switches.

Factory Method separates the two. The shared workflow moves into a base class and is written once; the step that varies becomes a method the base class declares but leaves for subclasses to implement. Each format is a subclass that fills in only that step:

```java
abstract class ReportJob {
    final Report run(Query query) {
        Data data = fetch(query);
        validate(data);
        Renderer renderer = createRenderer();    // the varying step, left open
        return archive(renderer.render(data));
    }

    protected abstract Renderer createRenderer();   // the factory method
}

class PdfReportJob extends ReportJob {
    protected Renderer createRenderer() { return new PdfRenderer(); }
}

class CsvReportJob extends ReportJob {
    protected Renderer createRenderer() { return new CsvRenderer(); }
}
```

Now `run` has no branch and names no format; each subclass owns one format's specifics and inherits the workflow untouched, so a new format is a new subclass that changes no existing code.

That is Factory Method: the creation of the product is an overridable method inside a shared workflow, so each subclass supplies the concrete product while the workflow itself is written once.

:::note In your own code
Three roles are in play: a workflow, a product it needs at one step, and the concrete kind of that product — which is the thing that varies. Reach for Factory Method when the workflow must stay identical while that product changes across cases. The workflow then depends only on the product's interface and never learns the concrete kinds; each concrete kind lives in its own subclass; and the caller, by choosing which subclass to instantiate, picks the variant. A new kind is one new subclass — the workflow is untouched, and only the caller's choice changes.
:::

## Abstract Factory

Sometimes several related objects must all come from the same variant and be used together. Create them one at a time and nothing stops code from combining one variant's object with another's — a mismatch that compiles cleanly and breaks at runtime.

Abstract Factory makes a single object responsible for producing the whole matching set, so the mismatch becomes impossible. It is an interface with one creation method per product, and one concrete factory per variant:

```java
interface CloudFactory {
    Compute compute();
    Storage storage();
    Queue   queue();
}

class AwsFactory implements CloudFactory {
    public Compute compute() { return new Ec2(); }
    public Storage storage() { return new S3(); }
    public Queue   queue()   { return new Sqs(); }
}
```

A `GcpFactory` would return the GCP counterparts. Code holding a `CloudFactory` gets a consistent set and cannot pair AWS compute with a GCP queue, because each factory makes only its own family. Swapping providers is swapping the one factory object.

That is Abstract Factory: one object that creates a whole family of related products belonging to the same variant.

:::note In your own code
The roles are a set of related product types, two or more variants of that whole set, and a client that uses the products together. Reach for it when mixing products from different variants would be a bug, and when a variant is swapped as a unit. The client depends only on the factory and product interfaces; each variant is one concrete factory producing a matching set; adding a variant is one new factory and leaves the client untouched. The line from Factory Method: that one makes a single product and varies it by subclass, this one makes a whole related set and varies it by which factory object you hold.
:::

## Builder

An object with many parts is awkward to construct. A constructor that takes them all becomes a long argument list — easy to misorder, and unreadable when half the parts are optional. Setters avoid the long list but leave the object mutable and, between calls, half-built and invalid.

A builder is a small companion class that gathers the parts one call at a time and produces the finished, validated object at the end:

```java
public final class HttpRequest {
    private final String url;
    private final Map<String, String> headers;
    private final Duration timeout;

    private HttpRequest(Builder b) {              // only the builder can construct it
        this.url = b.url;
        this.headers = b.headers;
        this.timeout = b.timeout;
    }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String url;
        private final Map<String, String> headers = new HashMap<>();
        private Duration timeout = Duration.ofSeconds(30);   // default

        public Builder url(String url)            { this.url = url; return this; }
        public Builder header(String k, String v) { headers.put(k, v); return this; }
        public Builder timeout(Duration t)        { this.timeout = t; return this; }

        public HttpRequest build() {
            if (url == null) throw new IllegalStateException("url is required");
            return new HttpRequest(this);         // validated, immutable
        }
    }
}
```

Each setter returns the builder itself, so calls chain; `build` checks the invariants once and hands back the finished object. At the call site, construction reads as named steps:

```java
HttpRequest request = HttpRequest.builder()
    .url("https://api.example.com")
    .header("Accept", "application/json")
    .timeout(Duration.ofSeconds(5))
    .build();
```

The partial state stays inside the builder; the real object appears only at `build`, complete and immutable, where its invariants are checked once.

That is Builder: assemble a complex object through a series of steps, and hand back the finished object only when it is whole.

:::note In your own code
The roles are the object being built, its many parts (some optional), and the code assembling it. Reach for it when a constructor would be long or ambiguous, or when a half-built instance must never escape into the rest of the program. The payoff is construction that reads as named steps at the call site, and an object that is valid the moment it exists.
:::

## Prototype

You have an object configured exactly the way you need it and you want more like it. If the code making the copies uses `new`, it has to name their concrete class and re-supply all the configuration the original already carries; and when that code holds the object only through an interface, it cannot call `new` on it at all.

Prototype makes an object responsible for copying itself. It exposes a method that returns a new instance with the same state, so callers duplicate an existing object instead of constructing a fresh one:

```java
interface Shape {
    Shape copy();                          // each shape knows how to duplicate itself
    void moveBy(int dx, int dy);
}

class Circle implements Shape {
    private int x, y, radius;
    private Color fill;

    Circle(Circle source) {                // copy constructor: state from the original
        this.x = source.x; this.y = source.y;
        this.radius = source.radius; this.fill = source.fill;
    }

    public Shape copy() { return new Circle(this); }
    public void moveBy(int dx, int dy) { x += dx; y += dy; }
}
```

A drawing tool duplicating a selection asks each shape to copy itself, never naming the concrete kinds:

```java
List<Shape> duplicate(List<Shape> selection) {
    List<Shape> copies = new ArrayList<>();
    for (Shape s : selection) copies.add(s.copy());   // no instanceof, no new Circle
    return copies;
}
```

The selection may mix circles, rectangles, and polygons; each returns its own kind, and the tool stays free of both their concrete classes and their construction details.

That is Prototype: an object creates new instances by copying itself, so callers duplicate a configured instance without naming its concrete class.

:::note In your own code
The roles are a prototype interface with a copy method, concrete types that implement it, and a client that duplicates objects it holds only by interface. Reach for it when the copying code doesn't know — or shouldn't depend on — the concrete class, or when copying a ready-made instance is cheaper or less error-prone than constructing one and re-applying its configuration. The one thing to get right is depth: a copy must duplicate the mutable objects held inside it, or the copy and the original will quietly share them.
:::

## Singleton

Some resources should exist exactly once in a process — a configuration registry, a connection pool — and be reachable wherever they are needed. A second instance would be wrong, not merely wasteful.

Singleton guarantees the single instance and offers one point of access to it: a private constructor blocks outside creation, and a static accessor returns the one that exists.

```java
enum Config {
    INSTANCE;
    private final Properties props = load();
    public String get(String key) { return props.getProperty(key); }
}
// used as: Config.INSTANCE.get("db.url")
```

The enum form is the simplest correct Singleton in Java: the language itself guarantees a single instance and handles thread safety and serialization.

That is Singleton: exactly one instance of a class, with a single shared point of access.

:::note In your own code
Two ways to end up with one shared object:

- **Single instance** — create it once at startup and pass it to whoever needs it. Dependencies stay visible, tests can hand over a substitute, and no state leaks between them. This is the default choice.
- **Singleton** — the class forbids a second instance and is reachable from anywhere. Its one real advantage is guaranteeing that a second instance can never exist; it pays for that with hidden dependencies and state that leaks across tests.

Prefer a single instance. Reach for a true Singleton only when a second instance would genuinely be a bug, or for a universal, stable service such as logging.
:::

:::tip Interview note
Builder and Factory Method are the creational patterns worth being fluent in. If you propose a Singleton, be ready to justify it over simply passing one shared instance where it is needed.
:::

## In one view

- Simple Factory — gathers the choice of concrete class behind one method.
- Factory Method — defers that choice to subclasses of a shared workflow.
- Abstract Factory — creates a whole family of related objects from one swappable factory.
- Builder — assembles a complex object step by step and returns it complete and valid.
- Prototype — creates new objects by copying a configured instance.
- Singleton — guarantees a single instance with one point of access, used sparingly.
