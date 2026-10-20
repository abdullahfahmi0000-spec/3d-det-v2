-- 3D.DET baseline schema, client DDL V62 (Flyway version 1).
-- Converted from database/source/ddl-postgresql-v62.sql; see database/README.md.
-- Once applied to a shared environment this file must never change (Flyway checksums it):
-- every later schema change is a new migration in database/migrations/.
--
-- Family E — Availability: 1 table(s).
-- Foreign keys are added by V1.200 once every table exists, so a table may reference
-- a table of any family, whichever file creates it.

-- 25. PERSON_AVAILABILITY
CREATE TABLE PERSON_AVAILABILITY (
    AVAILABILITY_ID BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    TENANT_ID BIGINT NOT NULL,
    SCENARIO_ID BIGINT NOT NULL DEFAULT 0,
    PERSON_ID BIGINT NOT NULL,
    DATE_FROM DATE NOT NULL,
    DATE_TO DATE NOT NULL,
    AVAILABILITY_STATUS VARCHAR(13) CHECK (AVAILABILITY_STATUS IN ('Working','Vacation','Sick','Training','Travel','Maternity','Other_Leave')) NOT NULL,
    DECLARED_BY VARCHAR(10) CHECK (DECLARED_BY IN ('HRIS','Manual','Calendar','System')) DEFAULT 'HRIS',
    CAPACITY_PCT DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    DELEGATE_PERSON_ID BIGINT,
    SOURCE_SYSTEM VARCHAR(50),
    NOTES TEXT
);
