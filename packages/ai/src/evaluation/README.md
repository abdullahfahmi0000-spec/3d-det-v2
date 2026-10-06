# Evaluation

Golden-set evaluation for AI behaviour: schema validity of structured output, refusal
behaviour on tasks that require human judgement, and regression detection when a model
version or routing policy changes.

Evaluation runs on a schedule rather than on every pull request, because it depends on an
external provider. Changes to `packages/ai` make it a required check.
