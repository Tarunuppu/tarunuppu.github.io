---
sidebar_position: 6
---

# Structural Patterns

Structural patterns are about composition: how to fit objects together into larger structures while keeping the connections between them loose. Where creational patterns deal with making objects, structural patterns deal with wiring the ones you already have — wrapping one object in another, or arranging many into a whole — so that the arrangement can change without the pieces having to. Each pattern below is a different shape of that wiring.

## Adapter

You need to use a class whose interface does not match the one your code expects — a third-party SDK, or a legacy component — and you can change neither your own code nor that class.

An adapter is a thin wrapper that implements the interface your code expects and translates each call into the one the other class offers:

```java
interface PaymentGateway {                     // what your code speaks
    Receipt charge(Money amount);
}

class StripeClient {                           // the third-party class you cannot change
    StripeCharge createCharge(long amountInCents, String currency) { /* ... */ }
}

class StripeAdapter implements PaymentGateway {
    private final StripeClient stripe;
    StripeAdapter(StripeClient stripe) { this.stripe = stripe; }

    public Receipt charge(Money amount) {
        StripeCharge c = stripe.createCharge(amount.cents(), amount.currency());
        return new Receipt(c.id());
    }
}
```

Your code depends only on `PaymentGateway`; the adapter absorbs the mismatch. Moving to another provider is another adapter, with nothing else changed.

That is Adapter: a wrapper that converts one class's interface into the interface a client expects.

:::note In your own code
The roles are the interface your code speaks (the target), a class with an incompatible interface you cannot change (the adaptee), and the adapter that translates between them. Reach for it when integrating a third-party or legacy component whose shape does not match yours — the adapter keeps the translation in one place instead of spreading it through your callers.
:::

## Decorator

You want to add behavior to an object — compression, encryption, buffering — and to combine those behaviors freely. Doing it by subclassing produces a class for every combination: `CompressedStream`, `EncryptedStream`, `CompressedEncryptedStream`, and so on, multiplying as behaviors are added.

A decorator implements the same interface as the object it wraps, adds its behavior, and delegates the rest to the wrapped object. Because the decorator is itself that interface, decorators stack:

```java
interface DataSource {
    void write(byte[] data);
    byte[] read();
}

class CompressionDecorator implements DataSource {
    private final DataSource wrapped;
    CompressionDecorator(DataSource wrapped) { this.wrapped = wrapped; }

    public void write(byte[] data) { wrapped.write(compress(data)); }
    public byte[] read()           { return decompress(wrapped.read()); }
}
```

An `EncryptionDecorator` has the same shape. Compose behaviors by nesting them:

```java
DataSource source =
    new EncryptionDecorator(new CompressionDecorator(new FileDataSource("f.dat")));
```

Each layer adds one behavior and passes the rest down. Adding a new behavior is one new decorator, not a new subclass for every combination.

That is Decorator: wrap an object in another of the same interface to add behavior, stacking wrappers to combine behaviors.

:::note In your own code
The roles are a component interface, a plain concrete component, and decorators that implement the interface and hold another component. Reach for it when you need to add responsibilities to individual objects at runtime and in varying combinations — logging, caching, retry, compression — without a subclass for each combination.
:::

## Facade

Using a subsystem correctly takes several classes in a specific sequence — reserve inventory, price the order, take payment, send confirmation. Every caller that needs the operation repeats that whole sequence and becomes coupled to every class in it.

A facade is a single class that offers one simple method for the common operation and runs the sequence behind it:

```java
class CheckoutFacade {
    private final Inventory inventory;
    private final Pricing pricing;
    private final PaymentGateway payment;
    private final Notifier notifier;
    // constructor wires the four in...

    public Confirmation checkout(Cart cart) {
        inventory.reserve(cart.items());
        Money total = pricing.total(cart);
        Receipt receipt = payment.charge(total);
        notifier.orderPlaced(cart.customer());
        return new Confirmation(receipt);
    }
}
```

Callers now call `checkout(cart)` and depend on one class instead of four. The facade does not seal the subsystem off — code that needs finer control can still use the inner classes directly — it just gives the common path a simple door.

That is Facade: one simplified entry point in front of a subsystem of several classes.

:::note In your own code
The roles are a subsystem of several classes and clients that only need its common operations. Reach for it when callers keep repeating the same multi-step sequence against a subsystem; the facade puts that sequence in one place and gives callers a small surface. It simplifies access without hiding the subsystem — advanced callers may still reach past it.
:::

## Composite

Think of folders that hold files and other folders, nested to any depth. You want to run one operation across the whole tree — total up the size, say — but a file and a folder are different types, so the naive code keeps checking "is this a single file, or a folder?" and handling each case separately, at every level of the nesting.

Composite gives leaves and groups the same interface. A group holds children that are themselves that interface, and implements each operation by delegating to its children:

```java
interface Node {
    long size();
}

class File implements Node {           // leaf
    private final long bytes;
    public long size() { return bytes; }
}

class Directory implements Node {      // composite
    private final List<Node> children = new ArrayList<>();
    public void add(Node n) { children.add(n); }
    public long size() {
        return children.stream().mapToLong(Node::size).sum();
    }
}
```

A caller asks any `Node` for its `size` and never checks whether it is a file or a directory; a directory computes its size by asking its children, which may themselves be directories. The recursion falls out of the uniform interface.

That is Composite: arrange objects into a tree and give single objects and groups the same interface, so clients treat them alike.

:::note In your own code
The roles are a shared interface, leaf objects, and composites that hold children of that same interface. Reach for it when you have a tree-shaped structure and want an operation to work identically on a single element and on a group — the composite forwards the operation to its children, so callers never distinguish the two.
:::

## Proxy

You need to control access to an object — delay its expensive creation until first use, cache its results, check permissions, or reach it across a network — without changing the object or its callers.

A proxy implements the same interface as the real object and stands in for it, adding the control around a call before delegating to the real one:

```java
interface Image {
    void render();
}

class HeavyImage implements Image {    // costly to load
    HeavyImage(String path) { /* loads pixels from disk */ }
    public void render() { /* ... */ }
}

class LazyImage implements Image {     // proxy
    private final String path;
    private HeavyImage real;
    LazyImage(String path) { this.path = path; }

    public void render() {
        if (real == null) real = new HeavyImage(path);   // load on first use
        real.render();
    }
}
```

Callers hold an `Image` and cannot tell the proxy from the real thing; the heavy load happens only when `render` is first called. The same shape covers caching, permission checks, and remote calls — only the control added around the delegation changes.

That is Proxy: a stand-in with the same interface as the real object, controlling access to it.

:::note In your own code
The roles are a subject interface, the real subject, and a proxy that shares the interface and wraps the real subject. Reach for it when you need to interpose on access — lazy loading, caching, permission checks, remote calls — without callers knowing. It looks like Decorator, but the intent differs: a decorator adds new behavior and is built to stack, while a proxy controls access to one real object and usually stands alone.
:::

## In one view

- Adapter — converts one class's interface into the one a client expects.
- Decorator — wraps an object to add behavior, stacking to combine behaviors.
- Facade — puts one simple entry point in front of a complex subsystem.
- Composite — arranges objects into a tree and treats leaves and groups alike.
- Proxy — stands in for an object to control access to it.
