---
sidebar_position: 7
---

# Behavioral Patterns

Behavioral patterns are about interaction: how objects communicate and how responsibility is divided among them at runtime. Creational patterns make objects and structural patterns arrange them; behavioral patterns govern what happens between them once they exist — who calls whom, who decides what, and how work and messages flow. Each pattern below assigns those responsibilities in a different way.

## Strategy

A class needs to do something that has several interchangeable ways of being done — compute shipping cost by standard, express, or free-shipping rules — and baking all of them into the class with conditionals ties it to every variant and forces an edit to add one.

Strategy pulls the varying behavior into its own interface. The class that needs it (the context) holds a strategy and delegates to it; each way of doing the job is a separate class implementing that interface:

```java
interface ShippingStrategy {
    Money cost(Cart cart);
}

class ExpressShipping implements ShippingStrategy {
    public Money cost(Cart cart) { /* express rates */ }
}

class Checkout {
    private final ShippingStrategy shipping;      // injected, not hardcoded
    Checkout(ShippingStrategy shipping) { this.shipping = shipping; }

    Money total(Cart cart) {
        return cart.subtotal().plus(shipping.cost(cart));
    }
}
```

`Checkout` knows only `ShippingStrategy`; the caller decides which one to hand it. A new shipping rule is a new class, and `Checkout` never changes.

That is Strategy: put each interchangeable version of a behavior behind a common interface, and let the object hold and delegate to whichever one it was given.

## Observer

When one object changes, several others need to react — placing an order should update inventory, email the customer, and record analytics — but hardwiring those calls into the order couples it to every reactor, and the set of reactors changes over time.

The changing object (the subject) keeps a list of observers that share an interface, and on a change notifies each one. It knows only the interface, not the concrete reactors:

```java
interface OrderObserver {
    void onPlaced(Order order);
}

class Order {
    private final List<OrderObserver> observers = new ArrayList<>();
    public void subscribe(OrderObserver o) { observers.add(o); }

    public void place() {
        // ...place the order...
        for (OrderObserver o : observers) o.onPlaced(this);   // fan out
    }
}
```

Inventory, email, and analytics each implement `OrderObserver` and subscribe. Adding or removing a reactor never touches `Order`; it only changes who subscribes.

That is Observer: a subject broadcasts events to a set of subscribed observers without knowing who they are.

## State

An object behaves differently depending on the mode it is in — a document that is draft, submitted, or approved responds to the same actions differently, and some actions are illegal in some modes. Coded as a status field checked by a switch in every method, the mode logic scatters across the class and illegal transitions are easy to miss:

```java
class Document {
    Status status;

    void submit() {
        switch (status) {                        // and every other method
            case DRAFT     -> status = SUBMITTED; // repeats a switch like this
            case SUBMITTED -> throw new IllegalStateException();
            case APPROVED  -> throw new IllegalStateException();
        }
    }
}
```

State gives each mode its own class behind a shared interface. The object holds a current state object and delegates to it; each state defines how it responds and which state comes next:

```java
interface DocState {
    DocState submit();
    DocState approve();
}

class Draft implements DocState {
    public DocState submit()  { return new Submitted(); }
    public DocState approve() { throw new IllegalStateException("a draft can't be approved"); }
}

class Document {
    private DocState state = new Draft();
    public void submit()  { state = state.submit(); }
    public void approve() { state = state.approve(); }
}
```

Each mode's rules live in one class, and a transition is just returning the next state. Illegal actions are refused by the state that forbids them, and adding a mode is a new class rather than another case in every switch.

That is State: give each mode its own class and let the object change behavior by swapping which state object it currently holds.

## Command

A text editor supports undo and redo, so it has to remember the actions the user performed, in order, and be able to reverse each one — it keeps a history of them. That history holds many different kinds of actions — inserting text, deleting text, formatting — and must run whichever one it is holding the same way: execute it, or undo it. If each action is its own class with its own method names (`InsertText.insert()`, `DeleteText.delete()`), the history has no single method it can call on an arbitrary entry; it would need to know the concrete type of whatever it just popped.

Command gives every action the same two methods, `execute` and `undo`, so the history can hold a plain list of `Command` and call either method on whichever one it is holding, without knowing which concrete action that is:

```java
interface Command {
    void execute();
    void undo();
}

class InsertText implements Command {
    private final Document doc;
    private final String text;
    InsertText(Document doc, String text) { this.doc = doc; this.text = text; }

    public void execute() { doc.append(text); }
    public void undo()    { doc.removeLast(text.length()); }
}
```

An editor keeps its history as a plain `List<Command>`; undo pops the last entry and calls `undo` on it, never checking what kind of action it is. Wrapping the action in an object is what lets it sit in that list at all; the shared `execute`/`undo` contract is what lets the history call it without a type check.

That is Command: give every action the same execute/undo contract, so a generic invoker can hold and run a list of different actions without knowing which one it is holding.

## Template Method

Several variants follow the same overall procedure but differ in a step or two — importing data runs the same open, parse, validate, save sequence whether the source is CSV or JSON, and only the parse step changes. Writing the whole procedure once per variant duplicates the shared skeleton.

A base class writes the procedure once in a single method, calling steps that subclasses fill in. The skeleton is fixed; only the open steps vary:

```java
abstract class DataImport {
    final void run(Path file) {                   // the fixed skeleton
        String raw = open(file);
        List<Record> records = parse(raw);         // the varying step
        validate(records);
        save(records);
    }

    protected abstract List<Record> parse(String raw);   // filled by subclasses
    // open, validate, save are shared
}

class CsvImport extends DataImport {
    protected List<Record> parse(String raw) { /* CSV parsing */ }
}
```

The order of steps is locked in `run`; a new source format overrides only `parse`. The shared steps are written once and cannot be reordered or skipped by a subclass.

That is Template Method: fix an algorithm's skeleton in a base method and let subclasses supply the steps that vary.

:::tip Interview note
A switch on a "type" field is the usual cue for Strategy; a switch on a "status" or "mode" field that also changes behavior is the cue for State. Noticing the switch is often how you find the pattern the question is really asking for.
:::

## In one view

- Strategy — swap an interchangeable behavior through an injected object.
- Observer — broadcast events to a changing set of subscribers.
- State — change behavior by switching the object's current state class.
- Command — turn an action into an object that can be stored, queued, and undone.
- Template Method — fix an algorithm's skeleton and let subclasses supply the varying steps.
