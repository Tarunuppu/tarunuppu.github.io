---
sidebar_position: 1
---

# OOP Foundations for Design

The four pillars of object-oriented programming are usually taught as definitions to memorize, which misses what they are for. Each pillar is a decision about change — about which parts of a system are allowed to shift without forcing edits everywhere else. Read this way, each has a *purpose* (the design problem it solves) that is separate from its *mechanism* (the language feature that solves it). Mistaking the mechanism for the purpose is the root of most misuse: the feature gets applied where the problem doesn't exist, and you pay for structure you never needed.

## Encapsulation

The purpose of encapsulation is to protect invariants. The mechanism — hiding fields behind methods — is only how that purpose is met.

An *invariant* is a property an object must always satisfy, for its whole lifetime, no matter what is done to it: an account balance is never negative; a rate limiter's token count never exceeds its capacity. Encapsulation's job is to give that rule exactly one home — inside the object that owns the state — so that no outside code can move the object into a state the rule forbids.

A token-bucket rate limiter has the invariant `0 <= tokens <= capacity`. The count is reachable only through methods that enforce those bounds:

```java
public final class RateLimiter {
    private final int capacity;
    private int tokens;

    public RateLimiter(int capacity) {
        this.capacity = capacity;
        this.tokens = capacity;                    // the invariant holds from construction
    }

    public synchronized boolean tryAcquire() {
        if (tokens == 0) return false;             // never drops below zero
        tokens--;
        return true;
    }

    public synchronized void refill(int n) {
        tokens = Math.min(capacity, tokens + n);   // never exceeds capacity
    }
}
```

If `tokens` were public, any caller could set it to ten times capacity or to a negative number, and the limiter would silently stop limiting — nothing would throw. The rule survives only because the field cannot be reached except through methods that enforce it.

This yields a precise test for whether encapsulation holds: can any outside object put this one into an illegal state? If it can, encapsulation is leaking — whether or not the field is marked private.

## Abstraction

The purpose of abstraction is to let code depend on *what* something does, never on *how* it does it. The mechanism is to hide the how behind a named surface — a method, a class — so the how can change without the caller noticing.

Often a single class is the whole abstraction. A service that needs a user by id could carry the database detail itself — the SQL, the connection, the mapping of rows to objects — which chains it to the driver and the column names. Moving that detail into a class whose only job is to hold it severs the chain:

```java
class UserRepository {
    private final DataSource dataSource;
    UserRepository(DataSource ds) { this.dataSource = ds; }

    User findById(long id) {
        // the connection, the SQL, the row mapping — all sealed in here
    }
}

class UserService {
    private final UserRepository repo;
    void handle(long id) {
        User u = repo.findById(id);   // the caller sees only this
    }
}
```

`UserService` knows one fact: a `findById` exists that returns a `User`. It cannot tell whether the data came from SQL, a cache, or a network call, and it needs no edit if that source changes. One class and a clean method name are enough — there is no interface here and no second implementation.

An interface enters only when the *how* must exist in several interchangeable forms at once. Publishing a domain event is such a case: the real transport is a message broker, but tests need an in-memory stand-in. Naming the surface as an interface lets both live behind it:

```java
public interface EventPublisher {
    void publish(DomainEvent event);
}

final class OrderService {
    private final EventPublisher publisher;          // depends on the surface, not the broker
    OrderService(EventPublisher publisher) { this.publisher = publisher; }

    void place(Order order) {
        // ...persist the order...
        publisher.publish(new OrderPlaced(order.id()));
    }
}

final class InMemoryPublisher implements EventPublisher {   // the test stand-in
    final List<DomainEvent> captured = new ArrayList<>();
    public void publish(DomainEvent e) { captured.add(e); }
}
```

Both cases make the same move: the caller commits to a surface and stays ignorant of the detail behind it. The single class is the ordinary form; the interface is the form you reach for when there are several implementations to hold at once, and not before. Adding an interface for a how that will only ever take one form buys nothing and costs a layer of indirection.

## Polymorphism

The purpose of polymorphism is to let one piece of calling code drive many different behaviors without knowing which one it is driving. The mechanism is runtime dispatch: given an object of a shared type, a call resolves to that object's own implementation, decided when the program runs rather than when it is compiled.

This is what collapses a `switch` on a type field. Instead of the caller inspecting a kind and branching, each kind carries its own behavior and the right one runs on its own. A retry loop needs a delay between attempts, and each backoff policy is a type that computes its own:

```java
interface BackoffStrategy {
    Duration nextDelay(int attempt);
}

final class ExponentialBackoff implements BackoffStrategy {
    public Duration nextDelay(int attempt) {
        return Duration.ofMillis((long) (100 * Math.pow(2, attempt)));
    }
}

// inside the retry loop — no branching on which policy this is:
Duration delay = strategy.nextDelay(attempt);
```

The loop knows only `BackoffStrategy`; adding a jittered policy is a new class, and the loop never changes.

The loop cannot pick its own policy, though — something outside it must choose which `BackoffStrategy` to build and hand in. Without polymorphism that choice would sit inside the loop as a `switch (backoffType)` re-evaluated on every attempt. Polymorphism lets you make it once, up front, and it need not even be a branch — a table can map each name to a ready instance:

```java
Map<String, BackoffStrategy> strategies = Map.of(
    "exponential", new ExponentialBackoff(),
    "fixed",       new FixedBackoff());

BackoffStrategy chosen = strategies.get(config.backoffType());   // built once, handed to the loop
```

Adding a policy is a new row in that table, not an edit to a branch buried in the loop. So polymorphism does not remove the decision of which behavior to use; it moves that decision out of the working code and into one replaceable spot.

## Inheritance and composition

These are two ways to relate and reuse types, and the purpose that separates them is the crux. Inheritance expresses *is-a*: the subtype is a kind of the parent and can stand in for it anywhere. Composition expresses *has-a*: an object holds another and uses it, without claiming to be it. The common and costly mistake is to reach for inheritance when all you wanted was to reuse the parent's code — borrowing behavior while silently promising a substitutability you cannot keep.

The test for a true is-a is substitutability: code written for the parent must keep working when handed the child. A quick proxy is to say the relationship aloud. "A circle is a shape" holds — a circle honors everything a shape promises. "A stack is a vector" fails the moment you say it, and the JDK made exactly that claim. Because `java.util.Stack extends Vector` for code reuse, a stack inherited the vector's entire surface, including insertion at an arbitrary index:

```java
Stack<Integer> stack = new Stack<>();
stack.push(1);
stack.push(2);
stack.insertElementAt(99, 0);   // legal — inherited from Vector
// a "stack" now has an element wedged beneath its bottom
```

A real stack forbids that; the inheritance published an operation that contradicts what a stack is. The fix is to hold what you need rather than inherit everything:

```java
public final class Stack<T> {
    private final Deque<T> items = new ArrayDeque<>();
    public void push(T t) { items.push(t); }
    public T pop() { return items.pop(); }
}
```

This is the mechanical difference between the two. Inheritance hands down the parent's whole public surface whether it fits or not; composition holds the other object privately and exposes only the operations that belong. That control is why composition is the safer default, and why inheritance earns its place only when the subtype is genuinely substitutable for its parent.

## The four in one view

Each pillar draws a line and decides what is allowed to change on the far side of it.

- Encapsulation puts a rule in one place, so state cannot drift into an illegal shape.
- Abstraction puts a stable surface in front of volatile detail, so the detail can change unseen.
- Polymorphism lets fixed code run varying behavior, so new behavior can be added without editing the caller.
- Inheritance and composition decide how types relate — is-a only where substitutability truly holds, has-a everywhere else.
