# Demo script (about 5 minutes)

All demo accounts use the password `Demo#2026`. The login page has buttons that fill them in.

1. **Customer submits a return.** Sign in as `customer@example.com` (Jordan Lee). The dashboard
   lists items whose return window is closing. Open **My purchases**, pick an item with a green
   "Returnable until…" badge and choose **Start return**. Fill in reason, outcome and description,
   attach a photo, and submit.
2. **Show the request page.** Point out the progress bar, the timeline's "Request submitted" event,
   and the conversation panel. Mention that a customer can only ever see their own requests (the
   API returns 404 for anyone else's).
3. **Employee reviews it.** Sign out and sign in as `priya@example.com`. The dashboard shows her
   open work and workload. In **Work queue**, search the reference (e.g. `RD-00121`), open it,
   click **Assign to me**, then **Approve** and confirm. Record the fulfillment.
   Optionally show that **Reject** won't submit without a reason.
4. **Customer sees the update.** Back as Jordan: the bell shows unread notifications, the request
   says *Fulfilled*, and the timeline shows each step with who did it and when.
5. **Admin analytics.** Sign in as `admin@example.com`. Walk through the four KPI cards and pick one
   chart to explain, e.g. *Approval rate = approved ÷ (approved + rejected) decisions; shows N/A
   when nothing has been decided*. Change the date range and status filter to show the charts
   re-query, and export the CSV.
6. **Behind the scenes.** Open `/api/docs` for the OpenAPI docs, show one test command
   (`pytest` or `npx playwright test`), the GitHub Actions run, and the repository layout.

One-line summary: *a full-stack application that models product return and warranty
workflows, built with React, FastAPI and PostgreSQL.*
