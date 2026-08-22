---
sidebar_position: 4
---

# Design Patterns: Orientation

A design pattern is a named, reusable solution to a problem that keeps recurring in object-oriented design. The weight is on *named*: a pattern is not a library you import or code you paste, but a shape a solution takes, given a name so that two engineers can agree on a design in a single word. Saying "make discounts a Strategy" conveys an entire structure — an interface, interchangeable implementations, a point where one is chosen — that would otherwise take a paragraph to describe. More than anything else, the catalog of patterns is a shared vocabulary.

Patterns are recognized, not invented. Each is a solution many people arrived at independently for the same recurring problem, then wrote down. That origin governs how you should use them: you reach for a pattern when you feel the specific pain it relieves, never as a checklist to apply up front. Applying one before the problem exists adds indirection to buy flexibility you may never need — the most common way a good intention turns into over-engineered code. The skill worth building is not memorizing all of them, but recognizing the smell each one answers.

Underneath, most patterns are disciplined applications of a few ideas you may already hold: program to an interface rather than a concrete type, favor composition over inheritance, and supply dependencies from outside rather than constructing them inline. A pattern is usually one of these ideas applied to a specific recurring situation and given a name, which is why patterns feel obvious in hindsight — they are principles you already trust, frozen into a fixed shape.

The classic catalog sorts patterns into three groups by what each one manages.

**Creational patterns** govern how objects are made. They separate the code that needs an object from the concrete class it would otherwise name and construct directly, so that what gets created can vary without the caller changing. Factory Method, Abstract Factory, Builder, and Singleton live here.

**Structural patterns** govern how objects are composed into larger structures. They fit smaller pieces into bigger ones while keeping the coupling between those pieces loose, so the structure can grow or be rearranged without rewrites. Adapter, Decorator, Facade, Composite, and Proxy live here.

**Behavioral patterns** govern how objects communicate and how responsibility is divided among them at runtime. They describe the flow of messages and the assignment of work, so collaboration stays flexible and no single object accumulates everything. Strategy, Observer, State, Command, and Template Method live here.

The three questions behind the groups are the thing to hold onto: creational asks *how is this made*, structural asks *how is this put together*, behavioral asks *how do these talk to each other*. Almost every pattern you meet is one of those three questions with a specific, named answer.
