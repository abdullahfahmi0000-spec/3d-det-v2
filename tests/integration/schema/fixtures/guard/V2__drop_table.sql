-- Destructive: the guard must refuse this and name the statement (PLT.S4 acceptance criterion 2).
SET lock_timeout = '5s';
SET statement_timeout = '5min';

DROP TABLE AUDIT_LOG;
