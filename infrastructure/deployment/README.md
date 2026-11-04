# Deployment assets

The root compose.yaml is a local infrastructure stack only. No production deployment is represented as complete. Environment gates, migration flow and launch requirements are documented in docs/deployment. CI validates the local stack in an isolated GitHub runner when executed.

Application container packaging, managed secrets, ingress, TLS, backup schedules and monitoring belong to the release phase after feature acceptance. They have not been provisioned in this repository.
