---
sidebar_position: 2
---

# SOLID Principles

SOLID is five rules, one per letter, and they share a single aim: to keep a change local. Each rule attacks a specific kind of coupling — the kind that makes one change force many edits — and each has a *purpose* (the coupling it removes) distinct from its *mechanism* (how you remove it). Learned as slogans they sound interchangeable; learned as five different answers to the question "what forces an edit here?" they stop blurring together.

## Single Responsibility Principle

The purpose is to keep the number of reasons a class can change down to one. The usual phrasing — "a class should do one thing" — is misleading, because "one thing" has no fixed size. The precise version is that a class should have one reason to change: it should answer to a single concern, and usually to a single stakeholder. When two unrelated concerns share a class, a change demanded by one risks breaking the other, and the two are forced to move together for no reason.

Consider a class that both computes an employee's pay and renders it as a report:

```java
class Payslip {
    Money calculateNetPay(Employee e) { /* tax rules, deductions */ }
    String renderHtml(Employee e)     { /* layout, styling */ }
}
```

Two concerns live here that change for different reasons and at the request of different people: the finance team changes tax logic, a designer changes the report layout. A layout tweak now means touching, recompiling, and retesting the class that owns payroll correctness. Splitting them into `PayCalculator` and `PayslipRenderer` gives each concern its own home, so a change to one cannot reach the other.

The test is not "how many methods does this class have" but "how many distinct reasons would make me open this file." More than one is the smell.

## Open/Closed Principle

The purpose is to let you add new behavior without editing code that already works. Code you have to modify is code you have to re-test and can re-break; the aim is for new cases to arrive as new code, not as edits to old code. A class is open for extension — new behavior can be added — yet closed for modification, meaning its existing source stays untouched.

The mechanism is a stable surface with interchangeable implementations behind it. The smell is a conditional that grows a new branch every time a case is added:

```java
Money discountFor(Customer c) {
    switch (c.type()) {
        case REGULAR: return ...;
        case PREMIUM: return ...;
        // every new tier reopens and edits this method
    }
}
```

Turn each case into a type behind a shared surface:

```java
interface DiscountPolicy { Money apply(Order order); }

final class PremiumDiscount implements DiscountPolicy { /* ... */ }
```

A new tier is now a new class implementing `DiscountPolicy`; the code that applies a policy never changes. The decision of which policy to use moves to wherever customers are matched to policies, leaving the calculation itself closed.

There is a limit worth stating: you cannot close code against every possible change, only against the one axis you expect to vary. Choosing that axis correctly is the skill. Guess wrong and the abstraction sits unused while change arrives from a direction you never protected.

## Liskov Substitution Principle

The purpose is to keep inheritance honest: a subtype must be usable anywhere its base type is expected, without the caller noticing the difference. This is substitutability stated as a hard rule, and it is about behavior, not just method signatures. A subclass can compile perfectly and still violate it by breaking a promise the base type made.

The violation usually takes the form of a subtype that refuses part of the base's contract:

```java
class Storage {
    void save(String key, byte[] data) { /* writes */ }
    byte[] read(String key)            { /* reads */ }
}

class ReadOnlyStorage extends Storage {
    @Override void save(String key, byte[] data) {
        throw new UnsupportedOperationException();   // takes away a promised capability
    }
}
```

Any code holding a `Storage` is entitled to call `save`. Hand it a `ReadOnlyStorage` and that code breaks — not because it did anything wrong, but because the subtype claimed to be a `Storage` and then refused a `Storage` operation. It is not substitutable, so the is-a claim is false however plausible it sounds.

The fix is to stop forcing the false relationship: put in the base type only the contract every subtype can actually honor. If some storages cannot write, writing does not belong in the shared base. A subtype may extend what a base does; it must never quietly take capability away.

## Interface Segregation Principle

The purpose is to stop a client from depending on methods it never calls. A wide interface couples every implementer and every caller to its full surface, so a change to one corner of that interface disturbs code that had no interest in that corner. The mechanism is to split one broad interface into several narrow, role-specific ones.

A single device interface makes the problem concrete:

```java
interface MultiFunctionDevice {
    void print(Doc d);
    void scan(Doc d);
    void fax(Doc d);
}
```

A plain printer forced to implement this must stub `scan` and `fax` with empty bodies or exceptions, and any change to the fax signature now reaches the printer that never faxes. Split the interface by role instead:

```java
interface Printer { void print(Doc d); }
interface Scanner { void scan(Doc d); }
```

A device implements only the roles it actually fills, and a caller that only prints depends on `Printer` alone — nothing about scanning or faxing can reach it. Narrow interfaces confine a change to the code that uses the changed capability.

## Dependency Inversion Principle

The purpose is to keep high-level logic — the part holding your business rules — independent of low-level detail such as databases, brokers, and HTTP clients. Left to itself, high-level code tends to name and construct its concrete dependencies directly, which chains stable, valuable logic to volatile infrastructure. The principle inverts that arrangement: both the high-level module and the low-level module depend on an abstraction, and that abstraction belongs to the high-level side.

The inversion is the whole point. Instead of a `PricingService` reaching down and constructing a concrete rate source:

```java
class PricingService {
    private final HttpExchangeRateProvider rates = new HttpExchangeRateProvider();  // chained to HTTP
}
```

it depends on an interface defined in its own terms, and the concrete implementation is supplied from outside:

```java
class PricingService {
    private final ExchangeRateProvider rates;                  // an abstraction it owns
    PricingService(ExchangeRateProvider rates) { this.rates = rates; }
}
```

The arrow of dependency now points from the infrastructure toward the business logic rather than the reverse. `HttpExchangeRateProvider` implements `ExchangeRateProvider`; the service knows only the interface. Swapping the rate source, or running the logic under test with a fixed-rate stand-in, leaves the high-level module untouched, because it was never looking at the detail to begin with.

## The five in one view

Each letter removes a different thing that forces an edit, and each governs a different unit of code — a useful way to keep them apart.

- Single Responsibility — how to define a **class**: keep it answerable to one concern, so unrelated changes do not collide.
- Open/Closed — how a class should **grow**: add new behavior as new code rather than edits, so working code stays shut.
- Liskov — when to use **inheritance**: only when the subtype honors every promise the base makes, so callers never break on a substitute.
- Interface Segregation — how to define an **interface**: keep it narrow, so a change reaches only the clients that use it.
- Dependency Inversion — the **direction of dependency** between units: point it at abstractions, so business logic outlives its infrastructure.
