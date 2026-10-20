-- 3D.DET baseline schema, client DDL V62 (Flyway version 1).
-- Converted from database/source/ddl-postgresql-v62.sql; see database/README.md.
-- Once applied to a shared environment this file must never change (Flyway checksums it):
-- every later schema change is a new migration in database/migrations/.
--
-- Row-Level Security: 106 policies.
-- Every organizational table is confined to the tenant and scenario held in the session
-- variables app.tenant_id and app.scenario_id (set per transaction by withTenantTransaction
-- in packages/db). The two global catalogues carry neither column and have no policy.

-- Family A — Permanent Organizational Structure
ALTER TABLE TENANT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TENANT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE NODE_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON NODE_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BOM_HEADER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BOM_HEADER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BOM_LINK ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BOM_LINK
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERSON_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERSON_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BUILDING_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BUILDING_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE HOLDS_POSITION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON HOLDS_POSITION
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERSON_ENGAGEMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERSON_ENGAGEMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE TASK_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TASK_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERSON_TASK_RACI ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERSON_TASK_RACI
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE JOB_TASK_RACI ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON JOB_TASK_RACI
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERMISSION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERMISSION
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE REGISTRATIONS ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON REGISTRATIONS
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERMISSION_PROFILE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERMISSION_PROFILE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROFILE_ASSIGNMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROFILE_ASSIGNMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Family B — Initiative
ALTER TABLE INITIATIVE_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON INITIATIVE_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE INITIATIVE_LINK ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON INITIATIVE_LINK
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Family C — End-to-End Processes
ALTER TABLE PROCESS_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROCESS_TASK_FLOW ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_TASK_FLOW
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROCESS_GATEWAY ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_GATEWAY
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROCESS_INSTANCE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_INSTANCE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROCESS_INSTANCE_EVENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_INSTANCE_EVENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Family D — Assessment Assets
ALTER TABLE PAEI_ASSESSMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PAEI_ASSESSMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LIFECYCLE_ASSESSMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LIFECYCLE_ASSESSMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PATHOLOGY_DETECTED ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PATHOLOGY_DETECTED
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE CONSULTING_NOTE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON CONSULTING_NOTE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE AUDIT_LOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON AUDIT_LOG
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Family E — Availability
ALTER TABLE PERSON_AVAILABILITY ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERSON_AVAILABILITY
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Platform (Ch.6) — Infrastructure & Product Layer
ALTER TABLE KPI_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON KPI_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE KPI_MEASUREMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON KPI_MEASUREMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BPR_WORKSPACE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BPR_WORKSPACE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE DOCUMENT_ATTACHMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON DOCUMENT_ATTACHMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE NOTIFICATION_LOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON NOTIFICATION_LOG
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LIBRARY_CATALOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LIBRARY_CATALOG
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LIBRARY_ITEM ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LIBRARY_ITEM
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE AI_AGENT_PROFILE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON AI_AGENT_PROFILE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BOM_CLOSURE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BOM_CLOSURE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE SYNC_JOB_LOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON SYNC_JOB_LOG
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE JOB_GAP_ASSESSMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON JOB_GAP_ASSESSMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE TASK_CATEGORY_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TASK_CATEGORY_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROCESS_CATEGORY_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_CATEGORY_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BPR_WORKSPACE_MEMBER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BPR_WORKSPACE_MEMBER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LIBRARY_MERGE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LIBRARY_MERGE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LIBRARY_MERGE_SOURCE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LIBRARY_MERGE_SOURCE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE MERGE_CONFLICT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON MERGE_CONFLICT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BPR_WORKSPACE_SCOPE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BPR_WORKSPACE_SCOPE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PROCESS_TRIGGER_TYPE_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PROCESS_TRIGGER_TYPE_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ALLOCATION_RULE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ALLOCATION_RULE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE TRANSACTION_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TRANSACTION_MASTER
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Family F — Risk / Control / Skills
ALTER TABLE RISK_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON RISK_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE CONTROL_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON CONTROL_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE RISK_CONTROL_LINK ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON RISK_CONTROL_LINK
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE RISK_ASSESSMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON RISK_ASSESSMENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE REGULATORY_OBLIGATION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON REGULATORY_OBLIGATION
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE SKILL_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON SKILL_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERSON_SKILL ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERSON_SKILL
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE JOB_SKILL_REQUIRED ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON JOB_SKILL_REQUIRED
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ONBOARDING_PLAN ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ONBOARDING_PLAN
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Automation (Ch.9) — Agent & Model Routing
ALTER TABLE JOB_AUTOMATION_SNAPSHOT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON JOB_AUTOMATION_SNAPSHOT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE AI_MODEL_CATALOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON AI_MODEL_CATALOG
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE MODEL_ROUTING_POLICY ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON MODEL_ROUTING_POLICY
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ROUTING_SUBMODEL_VERSION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ROUTING_SUBMODEL_VERSION
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Family G — Strategy, Mission & KPI Cascade
ALTER TABLE VISION_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON VISION_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE MISSION_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON MISSION_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE STRATEGIC_OBJECTIVE_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON STRATEGIC_OBJECTIVE_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE KPI_CASCADE_LINK ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON KPI_CASCADE_LINK
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Business Rules (Ch.13)
ALTER TABLE BUSINESS_RULE_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BUSINESS_RULE_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE BUSINESS_RULE_PARAMETER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON BUSINESS_RULE_PARAMETER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE TASK_BUSINESS_RULE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TASK_BUSINESS_RULE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ROLE_RULE_CONSTRAINT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ROLE_RULE_CONSTRAINT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Process Engine Extension (Ch.14)
ALTER TABLE GATEWAY_FLOW_LINK ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON GATEWAY_FLOW_LINK
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE COMMITMENT_TYPE_MASTER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON COMMITMENT_TYPE_MASTER
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE DELEGATION_OF_AUTHORITY ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON DELEGATION_OF_AUTHORITY
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ESCALATION_RULE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ESCALATION_RULE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE EVENT_CATALOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON EVENT_CATALOG
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE TASK_BOUNDARY_EVENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TASK_BOUNDARY_EVENT
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE STANDING_APPROVAL ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON STANDING_APPROVAL
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE APPROVAL_ATTESTATION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON APPROVAL_ATTESTATION
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- C/ALL-Level Twinning & Organizational Memory (Ch.15)
ALTER TABLE TWIN_OBSERVATION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TWIN_OBSERVATION
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE TWIN_OBSERVATION_EVIDENCE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON TWIN_OBSERVATION_EVIDENCE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE PERSON_OBSERVATION_SCOPE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON PERSON_OBSERVATION_SCOPE
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE DECISION_RECORD ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON DECISION_RECORD
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ORG_MEMORY_ENTRY ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ORG_MEMORY_ENTRY
    USING (TENANT_ID = current_setting('app.tenant_id')::bigint
       AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- Didactic (SCHOOL) — Teaching Cycle
ALTER TABLE ACADEMIC_UNIT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ACADEMIC_UNIT
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE STUDENT_PROFILE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON STUDENT_PROFILE
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE COURSE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON COURSE
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE COURSE_VERTICAL ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON COURSE_VERTICAL
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ENROLLMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ENROLLMENT
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE STUDENT_WORKSPACE ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON STUDENT_WORKSPACE
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE SIMULATOR ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON SIMULATOR
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE SIMULATOR_VERTICAL_MAP ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON SIMULATOR_VERTICAL_MAP
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE VOLUME_DRIVER ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON VOLUME_DRIVER
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE SIMULATOR_SESSION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON SIMULATOR_SESSION
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE DIDACTIC_OBSERVATION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON DIDACTIC_OBSERVATION
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE ASSESSMENT_RECORD ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON ASSESSMENT_RECORD
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);

-- LMS (Embedded) — Phase 1
ALTER TABLE LMS_RUBRIC ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_RUBRIC
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_RUBRIC_CRITERION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_RUBRIC_CRITERION
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_CONTENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_CONTENT
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_ASSIGNMENT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_ASSIGNMENT
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_SUBMISSION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_SUBMISSION
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_QUIZ ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_QUIZ
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_QUESTION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_QUESTION
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_QUIZ_QUESTION ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_QUIZ_QUESTION
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_QUIZ_ATTEMPT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_QUIZ_ATTEMPT
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE LMS_GRADE_CATEGORY ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON LMS_GRADE_CATEGORY
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
ALTER TABLE VERTICAL_VARIANT ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scenario_isolation ON VERTICAL_VARIANT
USING (TENANT_ID = current_setting('app.tenant_id')::bigint
AND SCENARIO_ID = current_setting('app.scenario_id')::bigint);
