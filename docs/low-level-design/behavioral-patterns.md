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

## Chain of Responsibility

A request has to pass through a series of steps, and any step might handle it or let it move on. An expense needs approval, and the level that can approve depends on the amount — a team lead up to a point, a director above that, a VP beyond that. Written as one method that knows every level, the decision becomes a single branch that has to be edited to change a limit, add a tier, or reorder them:

```java
Approver approverFor(Expense e) {
    if (e.amount().isAtMost(Money.of(1_000)))  return teamLead;
    if (e.amount().isAtMost(Money.of(10_000))) return director;   // one branch that
    return vp;                                                    // knows every level
}
```

Chain of Responsibility gives each handler its own class holding a link to the next. A handler either handles the request or passes it along, and no handler knows the whole sequence:

```java
abstract class Approver {
    private Approver next;
    Approver chainTo(Approver next) { this.next = next; return next; }   // returns next, to chain

    final void handle(Expense e) {
        if (canApprove(e)) approve(e);
        else if (next != null) next.handle(e);        // pass it on
        else throw new IllegalStateException("no approver for " + e);
    }

    protected abstract boolean canApprove(Expense e);
    protected abstract void approve(Expense e);
}

class TeamLead extends Approver {
    protected boolean canApprove(Expense e) { return e.amount().isAtMost(Money.of(1_000)); }
    protected void approve(Expense e) { /* record the approval */ }
}
```

The chain is assembled once, and the caller hands the request to its front without knowing who will act on it:

```java
Approver chain = new TeamLead();
chain.chainTo(new Director()).chainTo(new Vp());
chain.handle(expense);        // stops at the first handler that can approve
```

Each handler owns only its own rule and its link forward. Changing a limit, inserting a tier, or reordering the line is a change to one handler or to how the chain is wired — never to a branch that knew them all.

That is Chain of Responsibility: pass a request along a line of handlers, each of which either handles it or forwards it to the next.

## Mediator

Several objects have to coordinate, and left to themselves each ends up holding a reference to every other. In a chat room, a participant who wants to reach the others would keep the full roster and drive the delivery itself:

```java
class Participant {
    private final List<Participant> peers;        // every participant holds every other
    void send(String msg) {
        for (Participant p : peers) p.receive(msg);   // and runs the broadcast itself
    }
}
```

Everyone knows everyone, the same routing logic is copied into each participant, and adding one means updating every roster. Mediator puts a hub between them: each object talks only to the hub, and the hub holds the logic that routes between them.

```java
interface ChatRoom {                              // the mediator
    void join(Participant p);
    void broadcast(Participant from, String msg);
}

class Participant {
    private final String name;
    private final ChatRoom room;                   // knows only the hub
    Participant(String name, ChatRoom room) {
        this.name = name; this.room = room; room.join(this);
    }
    void send(String msg)    { room.broadcast(this, msg); }   // hand off to the hub
    void receive(String msg) { /* display it */ }
    String name()            { return name; }
}

class GroupChat implements ChatRoom {
    private final List<Participant> members = new ArrayList<>();
    public void join(Participant p) { members.add(p); }
    public void broadcast(Participant from, String msg) {
        for (Participant p : members)                 // routing lives here, in one place
            if (p != from) p.receive(from.name() + ": " + msg);
    }
}
```

Each participant holds one reference — the room — and the routing lives in the room alone. Adding a participant touches only the room; changing how messages flow, whether that is private messages, muting, or history, is a change to the mediator rather than to every object that talks through it.

That is Mediator: route interaction between objects through a central hub, so each one knows only the hub instead of every peer.

## Memento

An object needs to be returned to an earlier state — a saved game reloaded, a transaction rolled back, an edit undone. The direct way is to read the object's fields out to store them and write them back to restore, but that forces the object to expose its internals to whatever holds the saved copy, and every field added later has to be threaded through that external save-and-restore code.

Memento has the object produce a snapshot of its own state as a sealed object and accept one back to restore itself. Whatever holds the snapshot can keep it but cannot look inside or change it:

```java
class GameState {
    private int level;
    private int score;
    private Point position;

    Snapshot save() {                          // the object makes its own snapshot
        return new Snapshot(level, score, position);
    }
    void restore(Snapshot s) {                 // and restores itself from one
        this.level = s.level; this.score = s.score; this.position = s.position;
    }

    static final class Snapshot {              // opaque to everyone but GameState
        private final int level, score;
        private final Point position;
        private Snapshot(int level, int score, Point position) {
            this.level = level; this.score = score; this.position = position;
        }
    }
}
```

The code that triggers and stores saves keeps a history of snapshots without ever seeing their contents:

```java
Deque<GameState.Snapshot> history = new ArrayDeque<>();
history.push(game.save());        // checkpoint
// ...play continues...
game.restore(history.pop());      // roll back to the checkpoint
```

Only `GameState` can create a `Snapshot` or read one, because the snapshot's fields are private to it. The history holds them as opaque tokens, so it never depends on what a game state contains; adding a field changes `save` and `restore` alone, not the code that stores the checkpoints.

That is Memento: let an object hand out and take back sealed snapshots of its own state, so its history can be saved and restored without exposing what it holds.

:::tip Interview note
Mediator and Observer both loosen who-talks-to-whom, and interviews lean on the difference. Observer is a one-to-many broadcast in a fixed direction: a subject notifies subscribers that don't know each other or the subject. Mediator is many-to-many coordination through a hub that holds the routing and can send in any direction. Reach for Observer when one thing changes and others must react; reach for Mediator when many things must coordinate and you want their tangled references pulled into one place.
:::

:::tip Interview note
A switch on a "type" field is the usual cue for Strategy; a switch on a "status" or "mode" field that also changes behavior is the cue for State. Noticing the switch is often how you find the pattern the question is really asking for.
:::

## In one view

- Strategy — swap an interchangeable behavior through an injected object.
- Observer — broadcast events to a changing set of subscribers.
- State — change behavior by switching the object's current state class.
- Command — turn an action into an object that can be stored, queued, and undone.
- Template Method — fix an algorithm's skeleton and let subclasses supply the varying steps.
- Chain of Responsibility — pass a request along handlers until one handles it.
- Mediator — route interaction through a hub so objects don't reference each other.
- Memento — capture and restore an object's state without exposing it.
