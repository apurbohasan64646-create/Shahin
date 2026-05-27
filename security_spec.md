# Firebase Security Specification (Al-Jabbar Healthcare)

## Data Invariants
1. Only users with verified `@gmail.com` accounts logged in via Google Auth can access clinical records.
2. The user `apurbohasan948@gmail.com` is the Master Administrator and cannot be deleted or demoted.
3. Only Administrators in the `admins` collection can delete report records or manage the admins list.
4. Agents can only submit reports labeled under forced agency constraints ("SHAHIN/AF-1") and cannot modify approved records or self-approve them.

## The Dirty Dozen (Malicious Payloads)
1. **Admin privilege escalation**: An agent logs in and attempts to write to `admins/malicious@gmail.com` to make themselves an admin. (Rejected by rules)
2. **Master Admin hijacking**: An unauthorized user attempts to delete `admins/apurbohasan948@gmail.com`. (Rejected by rules)
3. **Invalid ID Inject**: Trying to create a report with a 1MB string document ID instead of a standard alphanumeric string. (Rejected by rules)
4. **Agent bypassing agency**: An agent attempts to create a report with agency "GOVERNMENT/HQ-10" instead of "SHAHIN/AF-1". (Rejected by rules)
5. **Agent self-approval**: An agent attempts to update a report with `approvalStatus: "Approved"`. (Rejected by rules)
6. **Agent editing approved reports**: An agent attempts to edit a report whose current `approvalStatus` is already `"Approved"`. (Rejected by rules)
7. **Junk Admin Gmail**: Trying to register `malicious-domain.com` email address in the admin list. (Rejected by rules)
8. **Malicious Delete**: A logged-in non-admin attempts to issue a bulk delete on `/reports`. (Rejected by rules)
9. **PiI Harvesting attempt**: A logged out user attempts to read any document under `/reports`. (Rejected by rules)
10. **Malicious timestamp spoofing**: User attempts to set a custom timestamp into history records bypassing structural validation. (Rejected by rules)
11. **Spoofed owner metadata**: User modifies clinical readings for reports registered by another agency. (Rejected by rules)
12. **Null auth bypass**: Accessing DB nodes with an empty token header. (Rejected by rules)

## Test Configuration
All malicious actions verified to return `PERMISSION_DENIED` in local testing.
