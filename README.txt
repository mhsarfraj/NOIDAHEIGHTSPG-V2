NOIDA HEIGHTS PG — COMPLETE THREE-PORTAL MANAGEMENT SYSTEM
========================================================

WHAT IS INCLUDED
----------------
index.html       Public website and enquiry form.
student.html     Private resident portal.
admin.html       Private owner/manager portal.
style.css        Shared styling, responsive layouts and mobile refinements.
script.js        Public site + owner portal logic.
site.js          Public site interactions.
boot.js          Tiny script that enables page animations (kept separate for the security policy).
resident.js      Resident portal logic.
Google_Sheets_Code.gs  Google Apps Script API and shared Google Sheets database.

THREE PORTALS
-----------------------
1. PUBLIC WEBSITE
   - Property overview, rooms and prices, facilities, photo gallery, rules and location.
   - Enquiry form writes into the Enquiries sheet.
   - Links to the Resident and Owner portals.

2. STUDENT / RESIDENT PORTAL
   - Resident signs in with the Resident ID as User ID and a temporary password supplied by the owner.
   - Successful login hides the login card and shows the student's own records.
   - Profile: unique student ID, room/bed, plan, service package, joining date, guardian/emergency contact (when recorded), college/workplace, deposit and agreement status.
   - Fee summary and payment ledger.
   - Raise a maintenance request and see its status.
   - View owner notices and submit/track leave or outstation requests.
   - Personal records are filtered on the Apps Script server by the logged-in student's linked studentId.

3. OWNER / MANAGER PORTAL
   - KPI dashboard: active residents, expected monthly fees, outstanding balance, collections, occupancy estimate, overdue accounts and maintenance queue.
   - Student admissions and directory with search/edit/remove.
   - Auto-generated, unique Student ID shown in the admission form before saving. Format: NH-YYYY-0001. The same ID becomes the student's User ID and is linked in the Users sheet.
   - Resident detail fields: contact, room/bed, service plan, monthly fee, paid amount, due date, deposit, guardian and emergency contacts, college/workplace, food preference, agreement status, checkout date and notes.
   - Fee ledger, payment method/reference and collection history.
   - Maintenance register and resident-submitted tickets.
   - Website enquiries.
   - Leave/outstation requests with Approve/Decline actions.
   - Notice board: publish announcements and set category, audience, priority and expiry.
   - Expense ledger for utilities, food, maintenance, staff, internet and other costs.

GOOGLE SHEETS SETUP (NO PYTHON / NODE / XAMPP REQUIRED)
-------------------------------------------------------
1. Create a new Google Sheet for testing (recommended) or open the PG data spreadsheet.
2. Open Extensions → Apps Script.
3. Replace the editor code with the full contents of Google_Sheets_Code.gs. Save.
4. Select setup from the function dropdown and Run it once. Approve the requested Google permissions.
5. setup() creates/updates these tabs and appends any missing headers without deleting existing rows:
   - Students
   - Payments
   - Maintenance
   - Enquiries
   - Users
   - ResidentTickets
   - Notices
   - LeaveRequests
   - Expenses
6. Deploy → New deployment → select Web app.
   - Execute as: Me
   - Who has access: Anyone (required for static website access; protect the Sheet itself)
   - Deploy and copy the URL ending in /exec.
7. Open script.js and resident.js. Replace PASTE_NEW_APPS_SCRIPT_EXEC_URL_HERE in BOTH files with the exact deployed /exec URL.
8. If you change the Apps Script later, deploy a new version (Deploy → Manage deployments → Edit → New version) and ensure both JS files use that deployment URL.
9. Host every file in this folder together (index.html, student.html, admin.html, style.css, script.js, resident.js, site.js, boot.js) over HTTPS. Avoid opening file:// directly for testing; use a static host or local server.

FIRST SIGN-IN
-------------
Running setup() creates the Users sheet and one owner account (User ID OWNER001) with a randomly generated password.
The password appears once in the Apps Script execution log (View -> Logs). Sign in at admin.html and change it
immediately under Security. No default or shared passwords are shipped with this project.

ADDING A NEW STUDENT
--------------------
1. Sign in to admin.html with OWNER001 and your owner password.
2. Open Students → Add student.
3. The Unique Student ID field is filled automatically with the next available ID, such as NH-2026-0001. It is read-only to avoid accidental edits.
4. Fill in required name, phone, joining date and relevant room/fee details; optional guardian, emergency, deposit, college, food, agreement and checkout details can be completed as needed.
5. Save. The API validates that the ID is unique, saves the student and creates a Users row. User ID = Student ID. A temporary password appears in the owner dashboard message and is stored in Users. Share it privately with the resident.
6. If two owners add a student at almost the same time, the server rechecks uniqueness and assigns the next ID if needed.

SECURITY AND PRIVACY
--------------------
- Login details live in the Users sheet. A resident's row is created at the moment the owner saves the admission; the login form checks the typed password against that row. The password column holds a salted hash, so it is not readable in the sheet. The temporary password is shown once on the owner dashboard; use Reset login to issue another.
- A refresh keeps you signed in for the current tab (up to 60 minutes, 15 minutes idle). "Remember my User ID" saves only the User ID on that device, never the password. Let the browser's own password manager offer to save the password.
- Passwords are stored salted and hashed (never plain text). Older plain-text rows are upgraded automatically at next sign-in.
- Five wrong passwords lock that User ID for 15 minutes. Sessions end after 15 minutes of inactivity (and 60 minutes at most).
- The owner can issue a new temporary password for any resident (Students tab, Reset login). Residents and the owner can change their own password under Security.
- The owner dashboard never receives password data. The resident portal receives only that resident's own fields; owner notes and identity-proof numbers are not sent.
- Public enquiries are validated, length-limited, rate-limited per phone number and protected by a hidden honeypot field. Values that start with = + - or @ are stored as text so they cannot run as spreadsheet formulas.
- Pages ship with a Content-Security-Policy that allows scripts only from this site, and connections only to Google Apps Script.
- Keep the Google Sheet private (share it only with people who must see resident data). Do not store identity-document numbers unless necessary.
- This is a practical system for a single property, not a security-audited commercial product. Host it over HTTPS.
- The resident portal shows payments the owner has recorded; it does not take online payments.

TROUBLESHOOTING
---------------
- "User ID or password is incorrect": check the Users tab (active=TRUE, role, linked studentId), or use Reset login for residents. After five failed attempts wait 15 minutes.
- “Unknown action” or old API response: deploy the latest Apps Script as a new version and paste the new /exec URL into both JS files.
- Login works but resident profile is missing: verify Users.studentId exactly matches Students.id.
- Student ID preview unavailable: the Apps Script URL is missing/wrong or the owner session expired; the server still generates a unique ID when saving.
- Enquiries do not appear: verify the public page's script.js endpoint and the Enquiries sheet headers.
- If browser CORS blocks fetch requests on a host, use a compatible static host or a same-origin proxy. Do not put credentials in frontend source code.
- Owner password lost: in the Users sheet delete the OWNER001 row, run setup() again and read the new password from the log.

PROPERTY DETAILS
----------------
The public site preserves the existing NOIDA HEIGHTS PG details, including Sector 106, the NSEZ Metro walking-distance message, room prices and contact number. Confirm all public-facing details before publishing. The photos are stock images; replace them with real photos of the property (same <img> tags).
