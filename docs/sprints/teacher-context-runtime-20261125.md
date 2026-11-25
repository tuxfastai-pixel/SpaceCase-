# Teacher context runtime repair


## Assigned teacher context runtime repair — 25 November 2026

User reached Workspace temporarily unavailable after accepting Teacher invitation and administrator assignment. Canonical readback confirms active Grade 3C/2027 assignment in the isolated test school. Runtime log for GET /api/v1/school/context on exact deployed source b0c6ed4 reports PostgreSQL 42501. Both restricted product runtime roles lack school_ops USAGE and SELECT on the two configuration tables; the Finance test login inherits spacecase_runtime. This is a product runtime privilege gap, not a teacher-role or class assignment failure.

Additive 20261125190000_school_context_runtime_reads.sql grants only school_ops USAGE and SELECT on school_workspaces/class_workspaces to existing spacecase_runtime. No runtime INSERT/UPDATE/DELETE, all-table/default grants, canonical authority changes or role memberships are added. Repository reads still run only after current authenticated PEOS teacher context and requested class filtering. New PostgreSQL regression exercises actual repository SELECTs as spacecase_runtime, wrong-school/unknown-school empties, and absence of configuration write privileges. Full CI and guarded isolated migration pending at preparation. No teacher workspace rows are invented: missing class configuration will remain an explicit setup state. Signed-in post-repair acceptance pending. Production/WhatsApp unchanged.
