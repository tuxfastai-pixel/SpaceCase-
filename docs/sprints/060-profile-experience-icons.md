# Sprint 060 — Profile workspaces and recognisable tools

Goal: extend the approved calm teacher-home design across parent, principal, administrator, founder and operations home screens and add consistent icons beside meaningful text labels.

Scope: shared inline SVG icon component with accessible text retained; teacher tool and daily action icons; task-focused school leadership navigation; parent family setup and school connections; founder section navigation; operations overview; shared family/support styling. Navigation remains school-scoped and selects only existing destinations.

Acceptance: icons are decorative to screen readers and labelled with visible text; links and buttons retain their purpose and accessible names; desktop and narrow layouts are usable; principal/admin switching and current school selection remain; founder individual learner and family details remain excluded; parent draft and contact-connection boundaries remain clear. No changes to roles, identity, server-side authorization, data, migrations, dispatch, billing enforcement or AI execution.

Validation: local typecheck and lint passed; 243 tests passed, 19 database-dependent tests skipped locally. Synthetic Vercel preview dpl_C4Ffp2FZUVpsrw1irzhY4CKMGBae uses fictional data and rejects writes: desktop parent, principal, administrator, founder, operations and teacher views inspected; founder directory button switches views; parent and administrator layouts inspected at an actual 390px iframe viewport. No real account or production data used. Principal loading/error anchor was subsequently kept present independently of fetch result; final head requires CI. Physical phone and signed-in role-specific walkthroughs remain open.

Rollback: restore prior app deployment. No migration or configuration rollback required.

Release: PR65 head be879aa28a207fe7fb00e84f4e60ac8b5348904a passed CI 40444744220; merged as d8180105d5b38d9f6c32eb6d404f42293b0a4f67. Production dpl_BmS9RJXrgMvqsQUQ1oybKrrdhJfS READY, health/readiness 200 and scoped error/fatal scan empty. Signed-in production and physical phone walkthroughs remain open.
