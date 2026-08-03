# Project Principles

The following core principles govern all architectural design, code implementation, and documentation for **Forge**. Every contributor and AI agent working on this codebase must adhere strictly to these principles.

---

## Core Principles

1. **Build Only What Belongs in the Current Phase**  
   Never implement, stub, or prepare code for future phases (e.g., AI, forums, notification engines) ahead of time.

2. **Prefer Modular Architecture**  
   Organize code into self-contained, independent modules grouped by feature rather than generic technical types.

3. **Separate Business Logic from UI**  
   UI components should only be responsible for rendering data and user input handling. Domain logic, calculations, and data access must live in independent service modules.

4. **Keep Features Independently Maintainable**  
   Modifying or replacing one feature module should have minimal impact on other unrelated feature modules.

5. **Reuse Components Whenever Possible**  
   Build small, versatile UI primitives and utility functions to avoid duplicate code.

6. **Keep Documentation as the Source of Truth**  
   No feature or architectural shift is complete until the relevant documentation in `docs/` is updated.

7. **Never Silently Change Architecture**  
   Any structural or architectural change must be explained in plain language and recorded in `docs/project/decisions.md` before implementation.

8. **Explain Concepts Simply**  
   Write code, comments, and documentation targeting engineers who are actively learning. Avoid overly cryptic abstractions.

9. **Prefer Clarity Over Cleverness**  
   Readable, predictable, straightforward code is always preferred over compact or overly complex code tricks.

10. **Avoid Unnecessary Dependencies**  
    Keep external libraries and dependencies to a minimum. Write lightweight custom solutions where simple and practical.

11. **Keep Future Expansion Possible Without Implementing Future Features Today**  
    Design clean interfaces and decoupled data structures so future phase capabilities can be added seamlessly later, without building those capabilities now.

---

## Document Purpose & Beginner Context

### Why does this document exist?
It establishes the decision-making rules for the project. When deciding how to write a piece of code or structure a file, these principles provide the definitive guidance.
