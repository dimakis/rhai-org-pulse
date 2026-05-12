# Jira Cloud Automation Rule Setup for Activity Type Classification

This document provides step-by-step instructions for setting up a Jira Cloud automation rule that triggers real-time Activity Type classification when issues are created or updated.

**Platform:** Jira Cloud (redhat.atlassian.net)  
**User Level:** Jira Administrator  
**Time Required:** 15-20 minutes  
**Complexity:** Moderate - requires configuration in two systems (Org Pulse + Jira)

## Why This Is Complicated

Setting up auto-classification requires configuring **two separate systems**:

1. **Org Pulse** (backend service) - must know which Jira projects to classify
2. **Jira Cloud** (automation rule) - must know when to call Org Pulse

If these two configurations don't match (wrong project keys, different issue types, etc.), classification silently fails.

**Common failure mode:** You create a Jira automation rule that fires correctly, but Org Pulse skips the issue because the project isn't configured in Org Pulse Settings. The Jira audit log shows "success" but nothing happens.

This guide walks through both configurations step-by-step to ensure they match.

## Overview

The classification webhook integrates with Org Pulse's classification endpoint to auto-populate the Activity Type field (customfield_10464) based on issue type, summary, and description.

**Endpoint:** `POST https://<org-pulse-url>/api/modules/allocation-tracker/classify`

**Payload:**
```json
{
  "issueKey": "PROJECT-12345",
  "dryRun": false
}
```

## Prerequisites

Before you begin, you must have:

1. **Jira Administrator access** to redhat.atlassian.net
2. **Org Pulse admin access** to configure classification settings
3. **Activity Type field exists** in your Jira instance (customfield_10464)
4. **Your project key** - Find it in Project Settings → Details, or in the URL when viewing issues (e.g., `AIPCC`, `RHELAI`)

⚠️ **CRITICAL:** You must know your exact Jira project key before proceeding. The project key is NOT the same as the project name.

## How to Find Your Jira Project Key

**Method 1: From the Issue URL**
1. Open any issue in your project
2. Look at the browser URL: `https://redhat.atlassian.net/browse/XXXXX-123`
3. The letters before the dash are your project key (e.g., `AIPCC`, `RHELAI`)

**Method 2: From Project Settings**
1. Navigate to your project
2. Click **Project settings** (gear icon in left sidebar)
3. Click **Details** (first item in left sidebar)
4. Look for "Key: XXXXX" near the top
5. Write down this exact key - you'll need it multiple times

**Method 3: Verify via API (optional, for validation)**
```bash
# Replace YOUR-PROJECT-KEY with the key you found above
curl -s -u "${JIRA_EMAIL}:${JIRA_TOKEN}" \
  "https://redhat.atlassian.net/rest/api/3/project/YOUR-PROJECT-KEY" | \
  jq '.key, .name'
```

If this returns `null`, the project key doesn't exist - double-check spelling and capitalization.

## Step 0: Configure Org Pulse (REQUIRED FIRST)

**Before creating the Jira automation rule**, you must configure Org Pulse to recognize your project(s).

1. Navigate to **Org Pulse → Settings → Allocation Tracker → Classification tab**
2. In the **"Jira Projects"** field, enter your project keys (comma-separated):
   ```
   AIPCC, RHELAI, RHOAIEDGE
   ```
3. Verify other settings:
   - **Issue Types:** Story, Bug, Spike, Task, Epic, Vulnerability, Weakness
   - **Confidence Threshold:** 0.85 (85%)
   - **Enabled:** ✅
4. Click **"Save Configuration"**
5. **Test it works:**
   - Enter a real issue key from one of your projects
   - Click **"Test (Dry Run)"**
   - Verify you get a classification result (not "skipped: project not configured")

⚠️ **If you skip this step**, the Jira automation will trigger but classification will silently fail because the backend isn't configured for those projects.

## Jira Cloud Automation Rule Configuration

### Step 1: Navigate to Automation

1. In Jira Cloud, click the **gear icon** (⚙️) in the top-right corner
2. From the dropdown menu, select **System**
3. In the left sidebar under "APPS", click **Automation**
4. You should see the "Automation rules" page with a list of existing rules (if any)

### Step 2: Create New Rule

1. Click the blue **Create rule** button (top-right)
2. You'll see a page with trigger options - **ignore this for now**, we'll configure triggers in the next steps
3. Look for the rule name field at the top of the page (it may say "New rule" or have an edit icon)
4. Click the name field and enter: `Auto-Classify Activity Type (YOUR-PROJECT-KEY)`
   - Replace YOUR-PROJECT-KEY with your actual project key (e.g., `Auto-Classify Activity Type (AIPCC)`)
5. Click the description field (below the name) and enter:
   ```
   Automatically classify issues into 40/40/20 allocation buckets using Org Pulse classification service
   ```

### Step 3: Add First Trigger - Field Value Changed

1. Click **New trigger** (or "+ Add trigger" - usually a prominent button in the "WHEN" section)
2. You'll see a modal/panel with trigger type options
3. Scroll down and click **Field value changed**
4. You should now see the field value changed configuration panel:

   **Fields to monitor:**
   - Click the dropdown
   - Type "Activity Type" or scroll to find it
   - Click **Activity Type** to select it

   **Change type:**
   - Click the dropdown under "Change type"
   - Select **Any changes to the field value**

5. Click **Save** or **Continue** (button at bottom of the panel)
6. You should now see "Field value changed: Activity Type" in the WHEN section

### Step 4: Add Second Trigger - Issue Created

1. Look for the **New trigger** button again (it should appear below your first trigger or in the WHEN section toolbar)
2. Click **New trigger**
3. From the trigger type options, select **Issue created**
4. No additional configuration needed - click **Save** or **Continue**
5. You should now see TWO triggers in the WHEN section:
   - Field value changed: Activity Type
   - Issue created

**Visual check:** The WHEN section should show both triggers with an implied "OR" relationship (the rule fires when either happens).

### Step 5: Add Condition - JQL Filter

Now we need to filter which issues get classified (only certain projects/issue types, and only when Activity Type is empty).

1. Scroll down to find the **IF** section (conditions section)
2. Click **Add condition** or **New condition**
3. You'll see a modal/panel with condition type options
4. Look for and click **Advanced compare condition** or **JQL condition** (the exact name varies)
   - If you don't see "JQL condition", look for "Advanced" or "Compare values" and check if it has a JQL option
5. In the JQL text box that appears, paste this JQL (replace YOUR-PROJECT-KEY):

   **For a single project:**
   ```jql
   project = YOUR-PROJECT-KEY AND type in (Story, Bug, Spike, Task, Epic, Vulnerability, Weakness) AND "Activity Type" is EMPTY
   ```

   **For multiple projects (if needed):**
   ```jql
   project in (PROJECT-A, PROJECT-B, PROJECT-C) AND type in (Story, Bug, Spike, Task, Epic, Vulnerability, Weakness) AND "Activity Type" is EMPTY
   ```

6. Click **Save** or **Continue**
7. You should see the JQL condition appear in the IF section

⚠️ **CRITICAL:** 
- Replace YOUR-PROJECT-KEY with your actual project key (e.g., `AIPCC`)
- The project key(s) in this JQL MUST match what you configured in Org Pulse Settings (Step 0)
- Test the JQL in Jira's issue search first if you want to verify it works

### Step 6: Add Action - Send Web Request

This is the action that actually calls Org Pulse to classify the issue.

1. Scroll down to the **THEN** section (actions section)
2. Click **Add action** or **New action**
3. You'll see a modal/panel with action type options
4. Look for and click **Send web request** (might be under "External" or "Integrations" category)
5. Configure the web request form:

   **Web request URL:**
   ```
   https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/modules/allocation-tracker/classify
   ```
   
   **HTTP method:**
   - Click the dropdown and select **POST**

   **HTTP headers:**
   - Click **Add header** or the "+ Headers" button
   - Header name: `Content-Type`
   - Header value: `application/json`

   **Webhook body:**
   - Select **Custom data** from the dropdown (not "Issue data" or other options)

   **Custom data (paste this exactly into the text box):**
   ```json
   {
     "issueKey": "{{issue.key}}",
     "dryRun": false
   }
   ```
   
   **Note:** The `{{issue.key}}` is a Jira smart value that will be replaced with the actual issue key (e.g., AIPCC-123) when the rule runs.

   **Timeout (if shown):**
   - Set to **10** seconds

   **Retry on error (if shown):**
   - Set to **No** or leave unchecked

6. Click **Save** or **Continue**
7. You should see "Send web request" in the THEN section

### Step 7: Review and Enable

1. Scroll to the top of the page - you should see a visual summary:
   ```
   WHEN:
     - Field value changed: Activity Type
     - Issue created
   
   IF:
     - JQL condition: project = YOUR-KEY AND ...
   
   THEN:
     - Send web request
   ```

2. Look for the **Turn it on** toggle or button (usually top-right)
3. Click **Turn it on** to enable the rule
4. You may see a confirmation dialog - click **Enable** or **Confirm**
5. The rule should now show as "Enabled" or "Active"

**If you can't find "Turn it on":** Look for a toggle switch near the rule name, or a "Publish" button, or check if there's a status dropdown.

## Step 8: Test the Automation

### Create a Test Issue

1. Navigate to your Jira project
2. Click **Create** (top navigation bar)
3. Fill in the issue:
   - **Project:** Your configured project
   - **Issue Type:** Story or Bug (must be one of the types in your JQL filter)
   - **Summary:** `Test classification - fix login bug`
   - **Description:** Leave blank or add details
   - **Activity Type:** **Leave empty** (critical - the rule only runs when this is empty)
4. Click **Create**
5. The issue page should open

### Verify Classification

1. **Wait 5-10 seconds** (the webhook call takes a few seconds)
2. **Refresh the page** (F5 or Cmd+R)
3. **Look at the Activity Type field** (usually in the right sidebar or details panel)
4. **Expected result:** Activity Type should now show **"Tech Debt & Quality"**
   - This happens because the summary contains "fix" and "bug" keywords

### If Activity Type Stays Empty

The rule didn't run or the classification failed. Follow these debugging steps:

**Step A: Check the Automation Audit Log**

1. Go to Jira Settings (⚙️) → System → **Automation**
2. Find your "Auto-Classify Activity Type" rule in the list
3. Click on the rule name to open it
4. Look for an **Audit log** tab or link (usually top-right or in a submenu)
5. Click **Audit log**
6. Look for the most recent execution matching your test issue:
   - **Success:** Shows green checkmark - the rule ran successfully
   - **Failed:** Shows red X - click to see error details
   - **Not listed:** The rule didn't run at all (trigger or condition didn't match)

**Step B: Check Why the Rule Didn't Run**

If your test issue doesn't appear in the audit log:

1. **Verify the issue type:** Go back to your issue, check that Type = Story or Bug (must match your JQL filter)
2. **Verify Activity Type was empty:** If you accidentally set it when creating the issue, the JQL condition fails
3. **Verify the project key:** Check the issue key (e.g., AIPCC-123) matches what's in your JQL filter
4. **Test your JQL directly:**
   - In Jira, go to **Filters** → **Advanced issue search**
   - Paste your exact JQL filter
   - Replace `"Activity Type" is EMPTY` with `"Activity Type" is EMPTY OR "Activity Type" is not EMPTY`
   - Click **Search**
   - Your test issue should appear - if not, the JQL is wrong

**Step C: Check if Org Pulse Received the Request**

If the audit log shows success but Activity Type is still empty:

1. Go to Org Pulse → **Settings** → **Allocation Tracker** → **Classification** tab
2. Enter your test issue key (e.g., AIPCC-123)
3. Click **Test (Dry Run)**
4. **If it returns a classification:** The webhook integration works, but the rule might not have called it correctly
5. **If it returns "skipped: project not configured":** Go back to Step 0 and verify your project key is in the "Jira Projects" field

**Step D: Check the Web Request Action**

1. Go back to your automation rule (Settings → System → Automation → your rule)
2. Click to edit the rule
3. Scroll to the "Send web request" action
4. Verify:
   - URL is exactly: `https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/modules/allocation-tracker/classify`
   - Method is POST
   - Header `Content-Type: application/json` exists
   - Custom data has `"issueKey": "{{issue.key}}"` (with the double curly braces)

### Expected Behavior Summary

**✅ High-confidence classifications (≥85%):**
- Activity Type auto-populated within 5-10 seconds
- Bug/Vulnerability issues → "Tech Debt & Quality"
- Keywords "fix", "test", "refactor" → "Tech Debt & Quality"
- Keywords "spike", "POC", "research" → "Learning & Enablement"
- Keywords "RFE", "enhancement", "feature" → "New Features"

**⚠️ Low-confidence classifications (<85%):**
- Activity Type stays empty (not confident enough to auto-classify)
- Can be classified manually via Org Pulse UI

**🚫 Already classified:**
- Automation skips issues that already have Activity Type set
- Manual entries are never overwritten

---

## Multi-Project Configuration Strategies

### Option 1: Single Automation Rule (Recommended)

Use **one** automation rule for all projects:

**Pros:**
- Single rule to manage
- Consistent behavior across all projects
- Easier to update configuration

**Cons:**
- All projects share same webhook timeout/retry settings
- Harder to disable for just one project

**JQL Example:**
```jql
project in (AIPCC, RHELAI, RHOAIEDGE) AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

### Option 2: Separate Rules Per Project

Create **separate** automation rules for each project:

**Pros:**
- Per-project customization (different timeouts, logging, etc.)
- Can disable one project without affecting others
- Easier troubleshooting

**Cons:**
- More rules to maintain
- Risk of configuration drift between rules

**When to use:**
- Different projects need different webhook settings
- You want to pilot on one project before rolling out
- Projects have different stakeholders/requirements

## Expected Behavior

### High-Confidence Classifications (≥0.85)
- Activity Type field is automatically set
- Issue types Bug/Vulnerability → "Tech Debt & Quality"
- Keywords "fix", "test", "refactor" → "Tech Debt & Quality"
- Keywords "spike", "POC", "research" → "Learning & Enablement"
- Keywords "RFE", "enhancement" → "New Features"

### Low-Confidence Classifications (<0.85)
- Activity Type field remains empty
- Issue logged for manual review
- Can be classified manually via Org Pulse UI

### Already Classified
- Webhook skips issues with existing Activity Type
- Manual entries are never overwritten

### Project Not Configured
- If project is in Jira automation JQL but NOT in Org Pulse settings
- Webhook runs but classification returns `{skipped: true, reason: "project not configured"}`
- **Fix:** Add project to Org Pulse Settings → Classification tab

## Monitoring

### View Classification Activity

1. Navigate to Org Pulse → Allocation Tracker → Settings
2. Click **Classification** tab
3. Test individual issues using dry-run mode

### Check Automation Rule Execution

1. Jira → Settings → System → Automation
2. Find your auto-classification rule
3. View **Audit log** for execution history

## Troubleshooting

### Jira Cloud UI Issues

**"I can't find the Automation menu"**
- You need Jira Administrator permissions
- Check: Settings (⚙️) → System → look for "Automation" under "APPS" section
- If not there, contact your Jira admin to request Automation access

**"I can't find the 'New trigger' button"**
- After selecting the first trigger, the button appears below it or in the toolbar
- Try scrolling down - it might be below the trigger configuration panel
- Look for "+ Add trigger" or a "+" icon in the WHEN section

**"I can't find 'JQL condition' in the condition types"**
- It might be called "Advanced compare condition" or just "Advanced"
- Try searching for "JQL" in the condition type search box
- Some Jira Cloud instances hide it under a "More" or "Advanced" submenu

**"The smart value {{issue.key}} isn't working"**
- Make sure you typed it exactly: `{{issue.key}}` with double curly braces
- Don't use single braces `{issue.key}` - that won't work
- The preview might show `{{issue.key}}` literally - that's normal, it gets replaced at runtime

**"I can't find the 'Turn it on' button"**
- Look for a toggle switch near the rule name (top-right)
- Or a "Publish" button
- Or a status dropdown where you can change from "Draft" to "Enabled"
- Some versions require you to click "Save" first, then "Enable"

**"The audit log is empty even though I created test issues"**
- Make sure the rule status is "Enabled" (not Draft or Disabled)
- Check that your test issue matches the trigger (Activity Type was empty or you just created it)
- Check that the JQL condition matches your test issue (run the JQL in issue search to verify)

### Issue Not Classified

**Checklist:**
1. ✓ Activity Type field is empty (rule skips classified issues)
2. ✓ Issue type is Story, Bug, Spike, Task, Epic, Vulnerability, or Weakness
3. ✓ Project key is in your automation JQL filter
4. ✓ Project key is in Org Pulse Settings → Classification → "Jira Projects"
5. ✓ Automation rule status is "Enabled" (not Draft)
6. ✓ Check automation rule audit log for execution attempts

**Verify project configuration:**
```bash
# Test classification endpoint directly
curl -X POST https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/modules/allocation-tracker/classify \
  -H "Content-Type: application/json" \
  -d '{"issueKey": "YOUR-PROJECT-123", "dryRun": true}'

# Expected: {"classified": true, ...}
# Bad: {"skipped": true, "reason": "project not configured"}
```

**Manual Classification:**
1. Navigate to Org Pulse → Allocation Tracker → Settings → Classification
2. Enter issue key (e.g., RHELAI-12345)
3. Click "Test (Dry Run)" to preview
4. Click "Classify & Write" to apply

### Low Classification Rate

If >20% of issues remain unclassified:

1. Review low-confidence issues in audit log
2. Check if keywords need adjustment
3. Consider lowering confidence threshold (contact admin)

### Webhook Errors

**Common Issues:**
- **401 Unauthorized:** API token missing or expired (add Authorization header)
- **404 Not Found:** Wrong endpoint URL
- **500 Internal Server Error:** Org Pulse backend issue (check logs)
- **Timeout:** Classification took >10 seconds (increase timeout)

### "Project Not Configured" Error

**Symptoms:**
- Jira automation runs (shows in audit log)
- But Activity Type field stays empty
- Webhook returns `{skipped: true, reason: "project not configured"}`

**Fix:**
1. Go to Org Pulse → Settings → Allocation Tracker → Classification
2. Verify your project key is in the "Jira Projects" field
3. If missing, add it (comma-separated)
4. Click "Save Configuration"
5. Re-test a sample issue

### Wrong Project Keys

**Symptoms:**
- No issues are being classified
- Jira automation audit log shows no executions
- Or audit log shows executions, but Org Pulse test returns "project not configured"

**Root cause:** Project key mismatch between Jira automation JQL and Org Pulse Settings.

**How to fix:**

1. **Find the correct project key** (see "How to Find Your Jira Project Key" section above)

2. **Update Org Pulse Settings:**
   - Go to Org Pulse → Settings → Allocation Tracker → Classification
   - In "Jira Projects" field, replace the wrong key with the correct one
   - Click "Save Configuration"
   - Test with a real issue key to verify it works

3. **Update Jira automation rule:**
   - Go to Jira Settings → System → Automation
   - Click on your "Auto-Classify Activity Type" rule
   - Click "Edit" or the pencil icon
   - Find the JQL condition (in the IF section)
   - Update the project key in the JQL to match what you put in Org Pulse
   - Click "Save" or "Update"

4. **Verify they match:**
   - Org Pulse "Jira Projects" field: `AIPCC, CORRECTKEY`
   - Jira automation JQL: `project in (AIPCC, CORRECTKEY) AND ...`
   - These must be **identical**

5. **Test again** by creating a new issue

## Adding More Projects Later

To enable classification for additional Jira projects:

1. **Update Org Pulse configuration:**
   - Go to Settings → Allocation Tracker → Classification tab
   - Add the project key to the "Jira Projects" field (comma-separated)
   - Click "Save Configuration"

2. **Update Jira automation rule:**
   - **Option A (Recommended):** Edit existing rule's JQL filter to add new project
     ```jql
     project in (AIPCC, RHELAI, RHOAIEDGE, NEW-PROJECT) AND ...
     ```
   - **Option B:** Create a separate automation rule for the new project

3. **Test on small batch:**
   - Run on 10-20 issues first
   - Verify classification accuracy
   - Monitor manual override rate

## Rollback

To disable auto-classification:

**Disable for all projects:**
1. Jira → Settings → System → Automation
2. Find your auto-classification rule
3. Click **Turn it off**

**Disable for specific projects:**
1. Edit automation rule's JQL filter
2. Remove project from `project in (...)` list
3. Save rule

Manual classification via Org Pulse UI remains available.

## Configuration Examples

### Example 1: Single Project (Red Hat Enterprise Linux AI)

**Org Pulse Settings:**
```
Jira Projects: RHELAI
Issue Types: Story, Bug, Task, Epic
Confidence Threshold: 0.85
Enabled: ✅
```

**Jira Automation JQL:**
```jql
project = RHELAI AND 
type in (Story, Bug, Task, Epic) AND 
"Activity Type" is EMPTY
```

**Rule Name:** `Auto-Classify Activity Type (RHELAI)`

### Example 2: Multiple Projects (AI Platform)

**Org Pulse Settings:**
```
Jira Projects: AIPCC, RHELAI, RHOAIEDGE
Issue Types: Story, Bug, Spike, Task, Epic
Confidence Threshold: 0.85
Enabled: ✅
```

**Jira Automation JQL:**
```jql
project in (AIPCC, RHELAI, RHOAIEDGE) AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

**Rule Name:** `Auto-Classify Activity Type (AI Platform)`

## Future Enhancements

### Phase 2: AI Fallback (Not Yet Implemented)

For low-confidence cases (<0.85), send to Claude API:
- Requires `ANTHROPIC_API_KEY` env var
- Costs ~$0.01 per classification
- Improves coverage from 80% → 95%+

### Phase 3: Learning System (Not Yet Implemented)

Track manual overrides to improve classification:
- Store corrections in `data/allocation-tracker/classification-learning.json`
- Feed corrections back into keyword patterns
- Monitor override rate trends

## Support

- **Jira Ticket:** [AIPCC-15448](https://redhat.atlassian.net/browse/AIPCC-15448)
- **Feature Request:** [AIPCC-15139](https://redhat.atlassian.net/browse/AIPCC-15139)
- **Code Location:** `modules/allocation-tracker/server/classification/`
- **API Endpoint:** POST `/api/modules/allocation-tracker/classify`
