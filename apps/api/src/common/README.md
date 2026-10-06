# common

Cross-cutting infrastructure shared by the domain modules: request context, error mapping,
validation pipes, and the guards that resolve tenant context and run authorisation.

Business rules do not belong here. If something is specific to one domain module it lives in
that module; if it is framework-independent it belongs in `@3ddet/domain`.
