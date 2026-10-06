# Terraform

Not yet implemented.

## Conventions, effective from the first module

- **No state in the repository.** State lives in a remote backend with locking and
  encryption. `*.tfstate`, `*.tfvars` and `.terraform/` are ignored by `.gitignore`.
- **No credentials in code or variables files.** Pipelines authenticate through OIDC
  federation with short-lived role credentials.
- **One module per regional cell**, instantiated per environment.
- **Plans are reviewed** in the pull request before any apply.

The remote backend, account structure and environment list are decided during
infrastructure implementation.
